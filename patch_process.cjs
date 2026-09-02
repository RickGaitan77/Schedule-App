const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

const regexProcess = /  const processTranscript = async \(\) => \{\n    if \(isListening\) \{\n      if \(mediaRecorderRef\.current && mediaRecorderRef\.current\.state !== 'inactive'\) \{\n        mediaRecorderRef\.current\.stop\(\);\n      \}\n      setIsListening\(false\);\n      return;\n    \}/s;

const newProcess = `  const processTranscript = async () => {
    if (isListening) {
      if (recognitionRef.current) recognitionRef.current.stop();
      setIsListening(false);
      return;
    }`;

code = code.replace(regexProcess, newProcess);
fs.writeFileSync('src/App.tsx', code);
console.log('patched processTranscript');
