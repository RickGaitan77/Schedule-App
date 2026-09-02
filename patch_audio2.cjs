const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

const regex = /const prompt = `You are a scheduling assistant.*?\n\s+let response;\n\s+let retries = 5;.*?\s+const parsedText = response\?\.text;/s;

const newPromptBlock = `const prompt = \`Extract schedule shifts from the audio for month \${month}, year \${year}.
Return ONLY a JSON object with a 'shifts' array. Each shift MUST contain:
- title: string (e.g., "Regular Shift", "Urgent Care", "Night Shift")
- start: Local datetime (e.g., "2026-08-28T07:30:00", no 'Z')
- end: Local datetime (e.g., "2026-08-28T18:00:00", no 'Z')
- details: string (any location, room, or additional details)
- colorCode: string ("blue" for regular, "red" for urgent care, "amber" for surgery, "violet" for drop-off)

RULES:
1. "7 to 5" = 07:00:00 to 17:00:00. "2:30 to 11" = 14:30:00 to 23:00:00. Assume daytime clinical hours.
2. ALL dates MUST be strictly within month \${month}, year \${year}.
3. Works for a single day or multiple days equally well.
Return ONLY valid JSON matching this exact schema.\`;

      let response: any;
      let retries = 5;
      let delay = 1000;
      
      while (retries > 0) {
        try {
          const fetchPromise = ai.models.generateContent({
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
                temperature: 0.1,
                responseMimeType: 'application/json',
            }
          });
          
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('GEMINI_TIMEOUT')), 12000)
          );

          response = await Promise.race([fetchPromise, timeoutPromise]);
          break; // Success
        } catch (err: any) {
          if (err.message === 'GEMINI_TIMEOUT' || err.status === 503 || err.message?.includes('503') || err.message?.includes('UNAVAILABLE')) {
            retries--;
            if (retries === 0) throw err;
            await new Promise(resolve => setTimeout(resolve, delay));
            delay *= 2; // Exponential backoff
          } else {
            throw err;
          }
        }
      }
      const parsedText = response?.text;`;

const replaced = code.replace(regex, newPromptBlock);
if (replaced !== code) {
  fs.writeFileSync('server.ts', replaced);
  console.log('patched successfully');
} else {
  console.log('regex did not match');
}
