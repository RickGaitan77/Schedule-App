const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

const regexVoiceError = /    \} catch \(error: any\) \{\n      console\.error\("Parse error:", error\);\n      res\.status\(500\)\.json\(\{ success: false, error: error\.message \}\);\n    \}/s;

const newVoiceError = `    } catch (error: any) {
      console.error("Parse error:", error);
      let errorMsg = error.message;
      if (error.status === 429 || errorMsg?.includes('429') || errorMsg?.includes('RESOURCE_EXHAUSTED') || errorMsg?.includes('Quota exceeded')) {
        errorMsg = 'AI rate limit exceeded. Please wait a minute before trying again.';
      }
      res.status(500).json({ success: false, error: errorMsg });
    }`;

const regexAudioError = /    \} catch \(error: any\) \{\n      console\.error\("Audio parse error:", error\);\n      res\.status\(500\)\.json\(\{ success: false, error: error\.message \}\);\n    \}/s;

const newAudioError = `    } catch (error: any) {
      console.error("Audio parse error:", error);
      let errorMsg = error.message;
      if (error.status === 429 || errorMsg?.includes('429') || errorMsg?.includes('RESOURCE_EXHAUSTED') || errorMsg?.includes('Quota exceeded')) {
        errorMsg = 'AI rate limit exceeded. Please wait a minute before trying again.';
      }
      res.status(500).json({ success: false, error: errorMsg });
    }`;

let replaced = code.replace(regexVoiceError, newVoiceError);
replaced = replaced.replace(regexAudioError, newAudioError);

fs.writeFileSync('server.ts', replaced);
console.log('patched error handlers');
