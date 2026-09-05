const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

const oldCode = `  const [shifts, setShifts] = useState<Shift[]>(() => {
    const saved = localStorage.getItem('schedule_sync_shifts');
    return saved ? JSON.parse(saved) : [];
  });`;

const newCode = `  const [shifts, setShifts] = useState<Shift[]>(() => {
    try {
      const saved = localStorage.getItem('vet_shifts_backup') || localStorage.getItem('schedule_sync_shifts');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.error('Failed to parse initial shifts:', e);
    }
    return [];
  });`;

if (code.includes(oldCode)) {
  code = code.replace(oldCode, newCode);
  fs.writeFileSync('src/App.tsx', code);
  console.log('patched useState initialization');
} else {
  console.log('Could not find useState initialization.');
}
