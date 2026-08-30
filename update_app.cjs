const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

// 1. Remove SpeechRecognition initialization
code = code.replace("const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;", "");

// 2. Remove recognitionRef
code = code.replace("const recognitionRef = useRef<any>(null);", "");

// 3. Remove SpeechRecognition useEffect
const useEffectStart = `  useEffect(() => {
    if (SpeechRecognition) {`;
const useEffectEnd = `      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [isListening]);`;

const p1 = code.indexOf(useEffectStart);
const p2 = code.indexOf(useEffectEnd);
if (p1 !== -1 && p2 !== -1) {
    code = code.substring(0, p1) + code.substring(p2 + useEffectEnd.length);
}

// 4. Update toggleListening
const oldToggle = `  const toggleListening = async () => {
    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      setIsListening(false);
    } else {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.start();
          setIsListening(true);
          return;
        } catch (e: any) {
          console.error('Failed to start recognition, falling back to MediaRecorder:', e);
          if (e.name === 'InvalidStateError') {
            setIsListening(true);
            return;
          }
        }
      }
      
      // Fallback to MediaRecorder for iOS Safari and other browsers without SpeechRecognition
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        // Let Safari pick a supported mimeType or default
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];
        
        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) {
            audioChunksRef.current.push(e.data);
          }
        };

        mediaRecorder.onstop = () => {
          const mimeType = mediaRecorder.mimeType || 'audio/webm';
          const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
          stream.getTracks().forEach(track => track.stop());
          processAudioBlob(audioBlob);
        };

        mediaRecorder.start();
        setIsListening(true);
      } catch (err: any) {
        console.error('Microphone access denied or error:', err);
        alert('Microphone access denied or unavailable. Please check your browser permissions.');
      }
    }
  };`;

const newToggle = `  const toggleListening = async () => {
    if (isListening) {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      setIsListening(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];
        
        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) {
            audioChunksRef.current.push(e.data);
          }
        };

        mediaRecorder.onstop = () => {
          const mimeType = mediaRecorder.mimeType || 'audio/webm';
          const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
          stream.getTracks().forEach(track => track.stop());
          processAudioBlob(audioBlob);
        };

        mediaRecorder.start();
        setIsListening(true);
      } catch (err: any) {
        console.error('Microphone access denied or error:', err);
        alert('Microphone access denied or unavailable. Please check your browser permissions.');
      }
    }
  };`;

code = code.replace(oldToggle, newToggle);

// 5. Update processTranscript logic
const oldProcess = `  const processTranscript = async () => {
    if (!transcript.trim()) return;`;

const newProcess = `  const processTranscript = async () => {
    if (isListening) {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      setIsListening(false);
      return;
    }

    if (!transcript.trim()) return;`;

code = code.replace(oldProcess, newProcess);

// 6. Update disabled condition
code = code.replace(
    "disabled={!transcript.trim() || isProcessing}",
    "disabled={(!transcript.trim() && !isListening) || isProcessing}"
);

fs.writeFileSync('src/App.tsx', code);
console.log('App.tsx updated');
