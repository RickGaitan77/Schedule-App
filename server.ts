import express from 'express';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  app.use(express.json());

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

  app.get('/api/shifts', (req, res) => {
    res.json({ success: true, shifts: shiftsStore });
  });

  app.post('/api/shifts', (req, res) => {
    const { shifts } = req.body;
    if (Array.isArray(shifts)) {
      shiftsStore = [...shifts, ...shiftsStore];
    } else if (shifts) {
      shiftsStore.unshift(shifts);
    }
    saveShifts();
    res.json({ success: true, shifts: shiftsStore });
  });

  app.put('/api/shifts/:id', (req, res) => {
    const { id } = req.params;
    const update = req.body;
    shiftsStore = shiftsStore.map(s => s.id === id ? { ...s, ...update } : s);
    saveShifts();
    res.json({ success: true, shifts: shiftsStore });
  });

  app.delete('/api/shifts/:id', (req, res) => {
    const { id } = req.params;
    shiftsStore = shiftsStore.filter(s => s.id !== id);
    saveShifts();
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
      const prompt = `You are a scheduling assistant. Extract schedule shifts from the following text for month ${month} and year ${year}.
Text: "${text}"

Return a JSON object with a single 'shifts' array. Each shift object MUST contain:
- title: string (e.g., "Regular Shift", "Urgent Care", "Night Shift")
- start: Local datetime string (e.g., "2026-08-28T07:30:00") - DO NOT INCLUDE 'Z'
- end: Local datetime string (e.g., "2026-08-28T18:00:00") - DO NOT INCLUDE 'Z'
- details: string (any location, room, or additional details mentioned)
- colorCode: string (use "blue" for regular, "red" for urgent care/emergency, "amber" for surgery, "violet" for drop-off)

CRITICAL AM/PM INFERENCE RULES:
Assume standard daytime clinical hours. For example:
- "7:30 to 1" means 7:30 AM to 1:00 PM (13:00).
- "2:30 to 1" means 2:30 PM (14:30) to 1:00 AM the next day, or if they say "2:30 to 11" it means 2:30 PM to 11:00 PM.
- Single digits like "7 to 5" mean 7:00 AM to 5:00 PM.
- "7 to 6" means 7:00 AM to 6:00 PM (07:00:00 to 18:00:00).
Do not assume early morning (e.g., 2:30 AM) unless explicitly stated.

CRITICAL DATE ENFORCEMENT:
- The user is currently viewing Month: ${month} and Year: ${year}.
- ALL relative dates mentioned (e.g., "the 1st", "Friday", "Monday through Wednesday") MUST be anchored STRICTLY to this exact Month (${month}) and Year (${year}).
- Do NOT overflow into previous or future months unless the user explicitly names a different month (e.g., "September 2nd").
- Example: If the selected month is 8 (August) and the user says "the 5th and the 12th", you MUST return "2026-08-05" and "2026-08-12".

Infer exact dates and times relative to month ${month} and year ${year}. Return ONLY valid JSON matching the schema.`;

      let response;
      let retries = 3;
      let delay = 1000;
      
      while (retries > 0) {
        try {
          response = await ai.models.generateContent({
            model: 'gemini-3.6-flash',
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
            }
          });
          break; // Success
        } catch (err: any) {
          if (err.status === 503 || err.message?.includes('503')) {
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
      res.status(500).json({ success: false, error: error.message });
    }
  });

  const upload = multer();

  app.post('/api/parse-audio', upload.single('audio'), async (req, res) => {
    try {
      const { month, year } = req.body;
      const audioFile = req.file;

      if (!audioFile) {
        return res.status(400).json({ success: false, error: 'Audio file is required' });
      }

      if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({ success: false, error: 'GEMINI_API_KEY is not set' });
      }

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const prompt = `You are a scheduling assistant. Extract schedule shifts from the provided audio for month ${month} and year ${year}.
Return a JSON object with a single 'shifts' array. Each shift object MUST contain:
- title: string (e.g., "Regular Shift", "Urgent Care", "Night Shift")
- start: Local datetime string (e.g., "2026-08-28T07:30:00") - DO NOT INCLUDE 'Z'
- end: Local datetime string (e.g., "2026-08-28T18:00:00") - DO NOT INCLUDE 'Z'
- details: string (any location, room, or additional details mentioned)
- colorCode: string (use "blue" for regular, "red" for urgent care/emergency, "amber" for surgery, "violet" for drop-off)

CRITICAL AM/PM INFERENCE RULES:
Assume standard daytime clinical hours. For example:
- "7:30 to 1" means 7:30 AM to 1:00 PM (13:00).
- "2:30 to 1" means 2:30 PM (14:30) to 1:00 AM the next day, or if they say "2:30 to 11" it means 2:30 PM to 11:00 PM.
- Single digits like "7 to 5" mean 7:00 AM to 5:00 PM.
- "7 to 6" means 7:00 AM to 6:00 PM (07:00:00 to 18:00:00).
Do not assume early morning (e.g., 2:30 AM) unless explicitly stated.

CRITICAL DATE ENFORCEMENT:
- The user is currently viewing Month: ${month} and Year: ${year}.
- ALL relative dates mentioned (e.g., "the 1st", "Friday", "Monday through Wednesday") MUST be anchored STRICTLY to this exact Month (${month}) and Year (${year}).
- Do NOT overflow into previous or future months unless the user explicitly names a different month (e.g., "September 2nd").
- Example: If the selected month is 8 (August) and the user says "the 5th and the 12th", you MUST return "2026-08-05" and "2026-08-12".

Infer exact dates and times relative to month ${month} and year ${year}. Return ONLY valid JSON matching the schema.`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
            {
                role: 'user',
                parts: [
                    { text: prompt },
                    { inlineData: { data: audioFile.buffer.toString("base64"), mimeType: audioFile.mimetype } }
                ]
            }
        ],
        config: {
            responseMimeType: 'application/json',
        }
      });

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
      res.status(500).json({ success: false, error: error.message });
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
