const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

// 1. Add transcriptRef
code = code.replace(
  "const recognitionRef = useRef<any>(null);",
  "const recognitionRef = useRef<any>(null);\n  const transcriptRef = useRef<HTMLTextAreaElement>(null);"
);

// 2. Update toggleListening
const oldToggleListening = `  const toggleListening = () => {
    if (isListening) {
      if (recognitionRef.current) recognitionRef.current.stop();
      setIsListening(false);
    } else {
      if (recognitionRef.current) {
        let finalTranscript = transcript ? transcript + ' ' : '';
        
        recognitionRef.current.onresult = (event: any) => {
          let interimTranscript = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              finalTranscript += event.results[i][0].transcript + ' ';
            } else {
              interimTranscript += event.results[i][0].transcript;
            }
          }
          setTranscript(finalTranscript + interimTranscript);
        };

        recognitionRef.current.onerror = (event: any) => {
          console.error('Speech error:', event.error);
          setIsListening(false);
        };

        recognitionRef.current.onend = () => {
          setIsListening(false);
        };

        recognitionRef.current.start();
        setIsListening(true);
      } else {
        alert('Web Speech API is not supported in this browser.');
      }
    }
  };`;

const newToggleListening = `  const toggleListening = () => {
    if (isListening) {
      if (recognitionRef.current) recognitionRef.current.stop();
      setIsListening(false);
    } else {
      if (recognitionRef.current) {
        let finalTranscript = transcriptRef.current ? transcriptRef.current.value : transcript;
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
        };

        recognitionRef.current.onerror = (event: any) => {
          console.error('Speech error:', event.error);
          setIsListening(false);
          if (transcriptRef.current) setTranscript(transcriptRef.current.value);
        };

        recognitionRef.current.onend = () => {
          setIsListening(false);
          if (transcriptRef.current) setTranscript(transcriptRef.current.value);
        };

        recognitionRef.current.start();
        setIsListening(true);
      } else {
        alert('Web Speech API is not supported in this browser.');
      }
    }
  };`;

code = code.replace(oldToggleListening, newToggleListening);

// 3. Update processTranscript
const oldProcessTranscript = `  const processTranscript = async () => {
    if (isListening) {
      if (recognitionRef.current) recognitionRef.current.stop();
      setIsListening(false);
    }

    if (!transcript.trim()) return;
    setIsProcessing(true);
    
    try {
      const response = await fetch('/api/parse-voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: transcript, month, year })
      });
      
      const data = await response.json();
      if (data.success) {
        try {
          await fetch('/api/shifts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ shifts: data.shifts })
          });
        } catch (e) {
          console.error('Failed to sync new shifts to server', e);
        }
        setShifts((prev) => [...data.shifts, ...prev]);
        setTranscript('');
      } else {
        alert('Error parsing shifts: ' + data.error);
      }`;

const newProcessTranscript = `  const processTranscript = async () => {
    if (isListening) {
      if (recognitionRef.current) recognitionRef.current.stop();
      setIsListening(false);
    }

    const textToProcess = transcriptRef.current ? transcriptRef.current.value : transcript;
    if (!textToProcess.trim()) return;
    setIsProcessing(true);
    
    try {
      const response = await fetch('/api/parse-voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: textToProcess, month, year })
      });
      
      const data = await response.json();
      if (data.success) {
        try {
          await fetch('/api/shifts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ shifts: data.shifts })
          });
        } catch (e) {
          console.error('Failed to sync new shifts to server', e);
        }
        setShifts((prev) => [...data.shifts, ...prev]);
        setTranscript('');
        if (transcriptRef.current) transcriptRef.current.value = '';
      } else {
        alert('Error parsing shifts: ' + data.error);
      }`;

code = code.replace(oldProcessTranscript, newProcessTranscript);

// 4. Update textarea
// Find the exact textarea block
const oldTextarea = `<textarea
                      value={transcript}
                      onChange={(e) => setTranscript(e.target.value)}
                      className="w-full h-full min-h-[120px] bg-slate-950/50 border border-slate-800 rounded-2xl p-4 pb-14 text-sm text-slate-200 focus:outline-none focus:border-violet-500/50 transition-all placeholder:text-slate-700 resize-none custom-scrollbar"
                      placeholder="PASTE SCHEDULE DATA OR SPEAK..."
                    ></textarea>`;

const newTextarea = `<textarea
                      ref={transcriptRef}
                      defaultValue={transcript}
                      onChange={(e) => setTranscript(e.target.value)}
                      className="w-full h-full min-h-[120px] bg-slate-950/50 border border-slate-800 rounded-2xl p-4 pb-14 text-sm text-slate-200 focus:outline-none focus:border-violet-500/50 transition-all placeholder:text-slate-700 resize-none custom-scrollbar"
                      placeholder="PASTE SCHEDULE DATA OR SPEAK..."
                    ></textarea>`;

// Because spacing might be different, let's use regex
const regexTextarea = /<textarea\s+value=\{transcript\}\s+onChange=\{\(e\) => setTranscript\(e\.target\.value\)\}/g;
code = code.replace(regexTextarea, `<textarea\n                      ref={transcriptRef}\n                      onChange={(e) => setTranscript(e.target.value)}`);

// Need to also manually handle the case if user typed something and we want React to update the defaultValue.
// Actually just making it uncontrolled is fine. It will preserve user input.
// But wait, if they switch tabs and come back? App component doesn't unmount, so textarea value stays.

fs.writeFileSync('src/App.tsx', code);
console.log('patched UI bugs');
