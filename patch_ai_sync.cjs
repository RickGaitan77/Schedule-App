const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

const oldAudioSync = `        try {
          await fetch('/api/shifts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ shifts: data.shifts })
          });
          const res = await fetch('/api/shifts');
          const finalData = await res.json();
          if (finalData.success) {
            setShifts(prev => JSON.stringify(prev) === JSON.stringify(finalData.shifts) ? prev : finalData.shifts);
            setTranscript(prev => (prev ? prev + '\\n' : '') + '[Audio parsed successfully]');
          }
        } catch (e) {
          console.error("Failed to sync generated shifts:", e);
        }`;

const newAudioSync = `        try {
          setShifts(prev => {
            const combined = [...data.shifts, ...prev];
            const unique = Array.from(new Map(combined.map(item => [item.id, item])).values()) as Shift[];
            return unique;
          });
          setTranscript(prev => (prev ? prev + '\\n' : '') + '[Audio parsed successfully]');
        } catch (e) {
          console.error("Failed to apply generated shifts:", e);
        }`;

if (code.includes(oldAudioSync)) {
  code = code.replace(oldAudioSync, newAudioSync);
} else {
  console.log("oldAudioSync not found.");
}

const oldTextSync = `        try {
          await fetch('/api/shifts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ shifts: data.shifts })
          });
        } catch (e) {
          console.error('Failed to sync new shifts to server', e);
        }`;

const newTextSync = `        // No server sync needed, it's local only`;

if (code.includes(oldTextSync)) {
  code = code.replace(oldTextSync, newTextSync);
} else {
  console.log("oldTextSync not found.");
}

fs.writeFileSync('src/App.tsx', code);
console.log('AI sync patched successfully');
