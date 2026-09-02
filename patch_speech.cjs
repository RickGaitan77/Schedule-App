const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

const oldToggleListening = `  const toggleListening = async () => {
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

const newToggleListening = `  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognitionRef.current = recognition;
    }
  }, []);

  const toggleListening = () => {
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

code = code.replace(oldToggleListening, newToggleListening);
fs.writeFileSync('src/App.tsx', code);
console.log('patched toggleListening');
