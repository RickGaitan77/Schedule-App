const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

const fetchApiShifts = `          await fetch('/api/shifts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ shifts: data.shifts })
          });
          const res = await fetch('/api/shifts');
          const finalData = await res.json();
          if (finalData.success) {
            setShifts(prev => JSON.stringify(prev) === JSON.stringify(finalData.shifts) ? prev : finalData.shifts);
            setTranscript(prev => (prev ? prev + '\\n' : '') + '[Audio parsed successfully]');
          }`;

const newFetchApiShifts = `          setShifts(prev => {
            const combined = [...data.shifts, ...prev];
            const unique = Array.from(new Map(combined.map(item => [item.id, item])).values()) as Shift[];
            return unique;
          });
          setTranscript(prev => (prev ? prev + '\\n' : '') + '[Audio parsed successfully]');`;

if (code.includes(fetchApiShifts)) {
  code = code.replace(fetchApiShifts, newFetchApiShifts);
}

const oldRemoveShift = `  const removeShift = async (id: string) => {
    try {
      await fetch(\`/api/shifts/\${id}\`, { method: 'DELETE' });
      setShifts(prev => prev.filter(s => s.id !== id));
    } catch (e) {
      console.error('Failed to remove shift', e);
    }
  };`;

const newRemoveShift = `  const removeShift = (id: string) => {
    setShifts(prev => prev.filter(s => s.id !== id));
  };`;

if (code.includes(oldRemoveShift)) {
  code = code.replace(oldRemoveShift, newRemoveShift);
}

fs.writeFileSync('src/App.tsx', code);
console.log('cleanup patched');
