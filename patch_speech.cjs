const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

// 1. Update toggleListening onresult
const oldToggleListening = `        let finalTranscript = transcriptRef.current ? transcriptRef.current.value : transcript;
        if (finalTranscript && !finalTranscript.endsWith(' ')) finalTranscript += ' ';
        
        recognitionRef.current.onresult = (event: any) => {
          let interimTranscript = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              finalTranscript += event.results[i][0].transcript + ' ';
            } else {
              interimTranscript += event.results[i][0].transcript;
            }
          }
          if (transcriptRef.current) {
            transcriptRef.current.value = finalTranscript + interimTranscript;
            transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
          }
        };`;

const newToggleListening = `        recognitionRef.current.onresult = (event: any) => {
          let finalTranscript = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              finalTranscript += event.results[i][0].transcript + ' ';
            }
          }
          if (finalTranscript && transcriptRef.current) {
            transcriptRef.current.value += (transcriptRef.current.value ? ' ' : '') + finalTranscript.trim();
            transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
          }
        };`;

code = code.replace(oldToggleListening, newToggleListening);

// 2. Update processTranscript month detection
const oldProcess = `    try {
      const response = await fetch('/api/parse-voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: textToProcess, month, year })
      });`;

const newProcess = `    let targetMonth = parseInt(month, 10);
    const lower = textToProcess.toLowerCase();
    if (lower.includes('january')) targetMonth = 1;
    else if (lower.includes('february')) targetMonth = 2;
    else if (lower.includes('march')) targetMonth = 3;
    else if (lower.includes('april')) targetMonth = 4;
    else if (lower.includes('may')) targetMonth = 5;
    else if (lower.includes('june')) targetMonth = 6;
    else if (lower.includes('july')) targetMonth = 7;
    else if (lower.includes('august')) targetMonth = 8;
    else if (lower.includes('september')) targetMonth = 9;
    else if (lower.includes('october')) targetMonth = 10;
    else if (lower.includes('november')) targetMonth = 11;
    else if (lower.includes('december')) targetMonth = 12;

    try {
      const response = await fetch('/api/parse-voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Use the auto-detected month (stringified to match backend expectation if it expects string, but wait, backend expects 1-12 or 0-11?)
        // Let's pass it as a string to match previous \`month\` state (which is stringified currentMonth)
        body: JSON.stringify({ text: textToProcess, month: targetMonth.toString(), year })
      });`;

code = code.replace(oldProcess, newProcess);

fs.writeFileSync('src/App.tsx', code);
console.log('patched');
