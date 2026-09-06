const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

const target = `      const data = await response.json();
      if (data.success) {
        try {
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
        }
      } else {
        console.error("Server parse error:", data.error);`;

const replacement = `      const data = await response.json();
      if (data.success) {
        try {
          setShifts(prev => {
            const combined = [...data.shifts, ...prev];
            const unique = Array.from(new Map(combined.map(item => [item.id, item])).values()) as Shift[];
            return unique;
          });
          setTranscript(prev => (prev ? prev + '\\n' : '') + '[Audio parsed successfully]');
        } catch (e) {
          console.error("Failed to apply generated shifts:", e);
        }
      } else {
        console.error("Server parse error:", data.error);`;

if(code.includes(target)) {
  code = code.replace(target, replacement);
  fs.writeFileSync('src/App.tsx', code);
  console.log('patched successfully');
} else {
  console.log('Target still not found.');
}
