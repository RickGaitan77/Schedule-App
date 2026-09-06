const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

// Update imports
code = code.replace(/import {([^}]+)} from 'lucide-react';/, (match, p1) => {
  if(!p1.includes('Smartphone')) {
    return `import {${p1}, Smartphone} from 'lucide-react';`;
  }
  return match;
});

// Find start of fetchSchedule logic
const startToken = "  useEffect(() => {\n    localStorage.setItem('vet_shifts_backup', JSON.stringify(shifts));\n  }, [shifts]);";
const endToken = "  const processAudioBlob = async (audioBlob: Blob) => {";

const startIndex = code.indexOf(startToken);
const endIndex = code.indexOf(endToken);

if (startIndex !== -1 && endIndex !== -1) {
  const replacement = `
  const [showQrModal, setShowQrModal] = useState(false);
  const [syncAlert, setSyncAlert] = useState(false);

  useEffect(() => {
    localStorage.setItem('vet_shifts_backup', JSON.stringify(shifts));
  }, [shifts]);

  useEffect(() => {
    const hash = window.location.hash;
    if (hash.startsWith('#sync=')) {
      try {
        const encodedData = hash.substring(6);
        const decodedData = JSON.parse(decodeURIComponent(atob(encodedData)));
        
        // Restore from minified
        const restoredShifts = decodedData.map((s: any) => ({
          id: s.i || Date.now().toString() + Math.random().toString(),
          start: s.s,
          end: s.e,
          title: s.t,
          details: s.d || '',
          colorCode: s.c || 'blue'
        }));

        localStorage.setItem('vet_shifts_backup', JSON.stringify(restoredShifts));
        setShifts(restoredShifts);
        
        window.history.replaceState(null, '', window.location.pathname);
        setSyncAlert(true);
        setTimeout(() => setSyncAlert(false), 3000);
      } catch (e) {
        console.error('Failed to parse synced shifts:', e);
      }
    }
  }, []);

  useEffect(() => {
    if (showQrModal) {
      const qrContainer = document.getElementById('qrcode');
      if (qrContainer && (window as any).QRCode) {
        qrContainer.innerHTML = '';
        const minified = shifts.map(s => ({
          i: s.id.substring(0, 8), // just a short id
          s: s.start,
          e: s.end,
          t: s.title,
          c: s.colorCode,
          d: s.details
        }));
        
        const encoded = btoa(encodeURIComponent(JSON.stringify(minified)));
        const syncUrl = window.location.origin + window.location.pathname + '#sync=' + encoded;
        
        new (window as any).QRCode(qrContainer, {
          text: syncUrl,
          width: 240,
          height: 240,
          colorDark: "#000000",
          colorLight: "#ffffff",
          correctLevel: (window as any).QRCode.CorrectLevel.L
        });
      }
    }
  }, [showQrModal, shifts]);

`;
  code = code.slice(0, startIndex) + replacement + code.slice(endIndex);
} else {
  console.log("Could not find start/end tokens for fetch replacement.");
}

fs.writeFileSync('src/App.tsx', code);
console.log('fetch/sync patched successfully');
