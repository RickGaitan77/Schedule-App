import express from 'express';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '50mb' }));

  // File-based store for shifts
  const dataDir = path.join(process.cwd(), 'data');
  const dataFile = path.join(dataDir, 'shifts.json');

  // Ensure data directory exists
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  let shiftsStore: any[] = [];
  
  // Load shifts on startup
  if (fs.existsSync(dataFile)) {
    try {
      const fileData = fs.readFileSync(dataFile, 'utf-8');
      shiftsStore = JSON.parse(fileData);
    } catch (e) {
      console.error('Error reading shifts.json:', e);
      shiftsStore = [];
    }
  }

  const saveShifts = () => {
    try {
      fs.writeFileSync(dataFile, JSON.stringify(shiftsStore, null, 2), 'utf-8');
    } catch (e) {
      console.error('Error writing to shifts.json:', e);
    }
  };


  // SSE connections
  let clients: any[] = [];
  
  app.get('/api/shifts/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    // Send initial state
    res.write(`data: ${JSON.stringify({ type: 'sync', shifts: shiftsStore })}\n\n`);

    clients.push(res);

    req.on('close', () => {
      clients = clients.filter(client => client !== res);
    });
  });

  const notifyClients = () => {
    const data = JSON.stringify({ type: 'sync', shifts: shiftsStore });
    clients.forEach(client => client.write(`data: ${data}\n\n`));
  };

  // Legacy endpoints for old clients
  app.get('/api/get-schedule', (req, res) => {
    res.json({ success: true, shifts: shiftsStore });
  });

  app.post('/api/update-schedule', (req, res) => {
    const { shifts } = req.body;
    if (Array.isArray(shifts)) {
      shiftsStore = shifts;
      saveShifts();
      notifyClients();
      res.json({ success: true, shifts: shiftsStore });
    } else {
      res.status(400).json({ success: false, error: 'Invalid shifts data' });
    }
  });

  app.get('/api/shifts', (req, res) => {
    res.json({ success: true, shifts: shiftsStore });
  });

  app.post('/api/shifts', (req, res) => {
    const { shifts } = req.body;
    let newShifts = Array.isArray(shifts) ? shifts : (shifts ? [shifts] : []);
    
    // Deduplicate on server
    const existingIds = new Set(shiftsStore.map(s => s.id));
    const toAdd = newShifts.filter(s => !existingIds.has(s.id));
    const toUpdate = newShifts.filter(s => existingIds.has(s.id));

    toUpdate.forEach(updatedShift => {
      shiftsStore = shiftsStore.map(s => s.id === updatedShift.id ? updatedShift : s);
    });

    if (toAdd.length > 0) {
      shiftsStore = [...toAdd, ...shiftsStore];
    }

    saveShifts();
    notifyClients();
    res.json({ success: true, shifts: shiftsStore });
  });

  app.put('/api/shifts/:id', (req, res) => {
    const { id } = req.params;
    const update = req.body;
    shiftsStore = shiftsStore.map(s => s.id === id ? { ...s, ...update } : s);
    saveShifts();
    notifyClients();
    res.json({ success: true, shifts: shiftsStore });
  });

  app.delete('/api/shifts/:id', (req, res) => {
    const { id } = req.params;
    shiftsStore = shiftsStore.filter(s => s.id !== id);
    saveShifts();
    notifyClients();
    res.json({ success: true });
  });

  // Parse voice text into structured shifts using Gemini
  app.post('/api/parse-voice', async (req, res) => {
    try {
      const { text, month, year } = req.body;
      if (!text) {
        return res.status(400).json({ success: false, error: 'Text is required' });
      }

      if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({ success: false, error: 'GEMINI_API_KEY is not set' });
      }

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const prompt = `Extract schedule shifts from text for month ${month}, year ${year}.
Text: "${text}"
Return ONLY a JSON object with a 'shifts' array. Each shift MUST contain:
- title: string (e.g., "Regular Shift", "Urgent Care", "Night Shift")
- start: Local datetime (e.g., "2026-08-28T07:30:00", no 'Z')
- end: Local datetime (e.g., "2026-08-28T18:00:00", no 'Z')
- details: string (any location, room, or additional details)
- colorCode: string ("blue" for regular, "red" for urgent care, "amber" for surgery, "violet" for drop-off)

RULES:
1. "7 to 5" = 07:00:00 to 17:00:00. "2:30 to 11" = 14:30:00 to 23:00:00. Assume daytime clinical hours.
2. ALL dates MUST be strictly within month ${month}, year ${year}.
3. Works for a single day or multiple days equally well.
Return ONLY valid JSON matching this exact schema.`;

      let response: any;
      let retries = 5;
      let delay = 1000;
      
      while (retries > 0) {
        try {
          const fetchPromise = ai.models.generateContent({
            model: 'gemini-3.7-flash',
            contents: prompt,
            config: {
                temperature: 0.1,
                responseMimeType: 'application/json',
            }
          });
          
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('GEMINI_TIMEOUT')), 25000)
          );

          response = await Promise.race([fetchPromise, timeoutPromise]);
          break; // Success
        } catch (err: any) {
          if (err.message === 'GEMINI_TIMEOUT' || err.status === 503 || err.status === 429 || err.message?.includes('503') || err.message?.includes('429') || err.message?.includes('UNAVAILABLE') || err.message?.includes('RESOURCE_EXHAUSTED')) {
            retries--;
            if (retries === 0) throw err;
            await new Promise(resolve => setTimeout(resolve, delay));
            delay *= 2; // Exponential backoff
          } else {
            throw err;
          }
        }
      }
      const parsedText = response?.text;
      let shifts = [];
      if (parsedText) {
          const data = JSON.parse(parsedText);
          if (data.shifts) shifts = data.shifts;
      }

      // Append random IDs for React rendering
      shifts = shifts.map((s: any) => ({ ...s, id: Math.random().toString(36).substring(7) }));

      res.json({ success: true, shifts });
    } catch (error: any) {
      console.error("Parse error:", error);
      let errorMsg = error.message;
      if (error.status === 429 || errorMsg?.includes('429') || errorMsg?.includes('RESOURCE_EXHAUSTED') || errorMsg?.includes('Quota exceeded')) {
        errorMsg = 'AI rate limit exceeded. Please wait a minute before trying again.';
      }
      res.status(500).json({ success: false, error: errorMsg });
    }
  });

  app.post('/api/parse-audio', async (req, res) => {
    try {
      const { month, year, audioBase64, mimeType } = req.body;

      if (!audioBase64) {
        return res.status(400).json({ success: false, error: 'Audio base64 data is required' });
      }

      if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({ success: false, error: 'GEMINI_API_KEY is not set' });
      }

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const prompt = `Extract schedule shifts from the audio for month ${month}, year ${year}.
Return ONLY a JSON object with a 'shifts' array. Each shift MUST contain:
- title: string (e.g., "Regular Shift", "Urgent Care", "Night Shift")
- start: Local datetime (e.g., "2026-08-28T07:30:00", no 'Z')
- end: Local datetime (e.g., "2026-08-28T18:00:00", no 'Z')
- details: string (any location, room, or additional details)
- colorCode: string ("blue" for regular, "red" for urgent care, "amber" for surgery, "violet" for drop-off)

RULES:
1. "7 to 5" = 07:00:00 to 17:00:00. "2:30 to 11" = 14:30:00 to 23:00:00. Assume daytime clinical hours.
2. ALL dates MUST be strictly within month ${month}, year ${year}.
3. Works for a single day or multiple days equally well.
Return ONLY valid JSON matching this exact schema.`;

      let response: any;
      let retries = 5;
      let delay = 1000;
      
      while (retries > 0) {
        try {
          const fetchPromise = ai.models.generateContent({
            model: 'gemini-3.7-flash',
            contents: [
                {
                    role: 'user',
                    parts: [
                        { text: prompt },
                        { inlineData: { data: audioBase64, mimeType: mimeType || 'audio/webm' } }
                    ]
                }
            ],
            config: {
                temperature: 0.1,
                responseMimeType: 'application/json',
            }
          });
          
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('GEMINI_TIMEOUT')), 35000)
          );

          response = await Promise.race([fetchPromise, timeoutPromise]);
          break; // Success
        } catch (err: any) {
          if (err.message === 'GEMINI_TIMEOUT' || err.status === 503 || err.status === 429 || err.message?.includes('503') || err.message?.includes('429') || err.message?.includes('UNAVAILABLE') || err.message?.includes('RESOURCE_EXHAUSTED')) {
            retries--;
            if (retries === 0) throw err;
            await new Promise(resolve => setTimeout(resolve, delay));
            delay *= 2; // Exponential backoff
          } else {
            throw err;
          }
        }
      }
      const parsedText = response?.text;
      let shifts = [];
      if (parsedText) {
          const data = JSON.parse(parsedText);
          if (data.shifts) shifts = data.shifts;
      }
      
      shifts = shifts.map((s: any) => ({ ...s, id: Math.random().toString(36).substring(7) }));
      res.json({ success: true, shifts });
    } catch (error: any) {
      console.error("Audio parse error:", error);
      let errorMsg = error.message;
      if (error.status === 429 || errorMsg?.includes('429') || errorMsg?.includes('RESOURCE_EXHAUSTED') || errorMsg?.includes('Quota exceeded')) {
        errorMsg = 'AI rate limit exceeded. Please wait a minute before trying again.';
      }
      res.status(500).json({ success: false, error: errorMsg });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
