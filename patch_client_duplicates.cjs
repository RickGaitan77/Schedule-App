const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

const oldSetShifts = `        // Instead of overriding, we'll prepend them. SSE will also update this, but doing it optimistically.
        setShifts((prev) => [...data.shifts, ...prev]);`;

const newSetShifts = `        // Instead of overriding, we'll prepend them. SSE will also update this, but doing it optimistically.
        setShifts((prev) => {
          const prevIds = new Set(prev.map(s => s.id));
          const toAdd = data.shifts.filter((s: any) => !prevIds.has(s.id));
          return [...toAdd, ...prev];
        });`;

code = code.replace(oldSetShifts, newSetShifts);
fs.writeFileSync('src/App.tsx', code);
console.log('patched client duplicates');
