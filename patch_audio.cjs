const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

// Replace gemini-2.5-flash with gemini-3.6-flash globally
code = code.replace(/gemini-2.5-flash/g, 'gemini-3.6-flash');

// Update /api/parse-audio to use req.body
const oldAudio = `  app.post('/api/parse-audio', upload.single('audio'), async (req, res) => {
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
      const prompt = \`You are a scheduling assistant. Extract schedule shifts from the provided audio for month \${month} and year \${year}.
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
- The user is currently viewing Month: \${month} and Year: \${year}.
- ALL relative dates mentioned (e.g., "the 1st", "Friday", "Monday through Wednesday") MUST be anchored STRICTLY to this exact Month (\${month}) and Year (\${year}).
- Do NOT overflow into previous or future months unless the user explicitly names a different month (e.g., "September 2nd").
- Example: If the selected month is 8 (August) and the user says "the 5th and the 12th", you MUST return "2026-08-05" and "2026-08-12".

Infer exact dates and times relative to month \${month} and year \${year}. Return ONLY valid JSON matching the schema.\`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
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
      });`;

const newAudio = `  app.post('/api/parse-audio', async (req, res) => {
    try {
      const { month, year, audioBase64, mimeType } = req.body;

      if (!audioBase64) {
        return res.status(400).json({ success: false, error: 'Audio base64 data is required' });
      }

      if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({ success: false, error: 'GEMINI_API_KEY is not set' });
      }

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const prompt = \`You are a scheduling assistant. Extract schedule shifts from the provided audio for month \${month} and year \${year}.
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
- The user is currently viewing Month: \${month} and Year: \${year}.
- ALL relative dates mentioned (e.g., "the 1st", "Friday", "Monday through Wednesday") MUST be anchored STRICTLY to this exact Month (\${month}) and Year (\${year}).
- Do NOT overflow into previous or future months unless the user explicitly names a different month (e.g., "September 2nd").
- Example: If the selected month is 8 (August) and the user says "the 5th and the 12th", you MUST return "2026-08-05" and "2026-08-12".

Infer exact dates and times relative to month \${month} and year \${year}. Return ONLY valid JSON matching the schema.\`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
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
            responseMimeType: 'application/json',
        }
      });`;

code = code.replace(oldAudio, newAudio);

fs.writeFileSync('server.ts', code);
console.log('patched');
