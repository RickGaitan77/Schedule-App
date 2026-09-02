const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

const oldAudioCall = `      const response = await ai.models.generateContent({
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

const newAudioCall = `      let response;
      let retries = 5;
      let delay = 1000;
      
      while (retries > 0) {
        try {
          response = await ai.models.generateContent({
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
          });
          break; // Success
        } catch (err: any) {
          if (err.status === 503 || err.message?.includes('503') || err.message?.includes('UNAVAILABLE')) {
            retries--;
            if (retries === 0) throw err;
            await new Promise(resolve => setTimeout(resolve, delay));
            delay *= 2; // Exponential backoff
          } else {
            throw err;
          }
        }
      }`;

code = code.replace(oldAudioCall, newAudioCall);

// Let's also update the parse-voice endpoint to check for UNAVAILABLE and increase retries
code = code.replace(`let retries = 3;`, `let retries = 5;`);
code = code.replace(`if (err.status === 503 || err.message?.includes('503')) {`, `if (err.status === 503 || err.message?.includes('503') || err.message?.includes('UNAVAILABLE')) {`);

fs.writeFileSync('server.ts', code);
console.log('patched');
