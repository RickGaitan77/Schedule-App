const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

// 1. Add state
code = code.replace(
  "const [isSyncing, setIsSyncing] = useState(false);",
  "const [isSyncing, setIsSyncing] = useState(false);\n  const [statusMsg, setStatusMsg] = useState('');"
);

// 2. Update processTranscript
const oldProcessTranscript = `  const processTranscript = async () => {
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
      }
    } catch (error) {
      console.error(error);
      alert('Network error while processing.');
    } finally {
      setIsProcessing(false);
    }
  };`;

const newProcessTranscript = `  const processTranscript = async () => {
    if (isListening) {
      if (recognitionRef.current) recognitionRef.current.stop();
      setIsListening(false);
    }

    const textToProcess = transcriptRef.current ? transcriptRef.current.value : transcript;
    if (!textToProcess.trim()) {
      setStatusMsg('Please provide some text or speech to process.');
      return;
    }
    
    setIsProcessing(true);
    setStatusMsg('Processing Neural Feed...');
    
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
        // Instead of overriding, we'll prepend them. SSE will also update this, but doing it optimistically.
        setShifts((prev) => [...data.shifts, ...prev]);
        setTranscript('');
        if (transcriptRef.current) transcriptRef.current.value = '';
        setStatusMsg('Successfully processed ' + (data.shifts ? data.shifts.length : 0) + ' shifts.');
      } else {
        setStatusMsg('Error parsing shifts: ' + data.error);
      }
    } catch (error: any) {
      console.error(error);
      setStatusMsg('Network error while processing: ' + (error.message || 'Unknown error'));
    } finally {
      setIsProcessing(false);
    }
  };`;

code = code.replace(oldProcessTranscript, newProcessTranscript);

// 3. Update UI
const oldUI = `                    )}
                  </button>
                </div>
                
                <div className="mt-6 pt-6 border-t border-slate-800/50 shrink-0">`;

const newUI = `                    )}
                  </button>
                  {statusMsg && (
                    <div className="mt-2 text-center text-xs font-mono text-emerald-400 p-2 bg-slate-900/50 rounded border border-emerald-500/20">
                      {statusMsg}
                    </div>
                  )}
                </div>
                
                <div className="mt-6 pt-6 border-t border-slate-800/50 shrink-0">`;

code = code.replace(oldUI, newUI);

// Let's also fix the disabled logic of the button: 
// disabled={(!transcript.trim() && !isListening) || isProcessing}
// Since transcript may not be updated if we typed (uncontrolled component), 
// let's just use \`isProcessing\` or allow it to click and show the error.
const regexDisabled = /disabled=\{\(\!transcript\.trim\(\) \&\& \!isListening\) \|\| isProcessing\}/g;
code = code.replace(regexDisabled, "disabled={isProcessing}");

fs.writeFileSync('src/App.tsx', code);
console.log('patched statusMsg');
