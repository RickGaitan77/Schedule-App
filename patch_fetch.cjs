const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

const oldCode = `  const fetchSchedule = async (isInitial = false) => {
    try {
      const res = await fetch('/api/shifts');
      const data = await res.json();
      
      if (data.success && data.shifts && data.shifts.length > 0) {
        setShifts(prev => JSON.stringify(prev) === JSON.stringify(data.shifts) ? prev : data.shifts);
      } else if (isInitial) {
        // Only attempt to restore from backup on initial load if server is empty
        const backup = localStorage.getItem('vet_shifts_backup') || localStorage.getItem('schedule_sync_shifts');
        if (backup) {
          const parsedBackup = JSON.parse(backup);
          if (parsedBackup && parsedBackup.length > 0) {
            await fetch('/api/shifts', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ shifts: parsedBackup })
            });
            setShifts(parsedBackup);
            console.log('Restored shifts from local backup to server.');
          }
        }
      }
    } catch (err) {
      console.error('Error fetching shifts:', err);
      if (isInitial) {
        const backup = localStorage.getItem('vet_shifts_backup') || localStorage.getItem('schedule_sync_shifts');
        if (backup) {
          try {
            const parsedBackup = JSON.parse(backup);
            if (parsedBackup && parsedBackup.length > 0) setShifts(parsedBackup);
          } catch (e) {
            console.error('Failed to parse backup shifts:', e);
          }
        }
      }
    }
  };`;

const newCode = `  const fetchSchedule = async (isInitial = false) => {
    try {
      const res = await fetch('/api/shifts');
      const data = await res.json();
      
      if (data.success && data.shifts && data.shifts.length > 0) {
        setShifts(prev => JSON.stringify(prev) === JSON.stringify(data.shifts) ? prev : data.shifts);
        localStorage.setItem('vet_shifts_backup', JSON.stringify(data.shifts));
      } else {
        // Server returned an empty list - restore from local backup immediately
        const backup = localStorage.getItem('vet_shifts_backup') || localStorage.getItem('schedule_sync_shifts');
        if (backup) {
          const parsedBackup = JSON.parse(backup);
          if (parsedBackup && parsedBackup.length > 0) {
            await fetch('/api/shifts', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ shifts: parsedBackup })
            });
            setShifts(prev => JSON.stringify(prev) === JSON.stringify(parsedBackup) ? prev : parsedBackup);
            console.log('Restored shifts from local backup to server.');
          }
        }
      }
    } catch (err) {
      console.error('Error fetching shifts:', err);
      // Always fallback to local backup on error
      const backup = localStorage.getItem('vet_shifts_backup') || localStorage.getItem('schedule_sync_shifts');
      if (backup) {
        try {
          const parsedBackup = JSON.parse(backup);
          if (parsedBackup && parsedBackup.length > 0) {
            setShifts(prev => JSON.stringify(prev) === JSON.stringify(parsedBackup) ? prev : parsedBackup);
          }
        } catch (e) {
          console.error('Failed to parse backup shifts:', e);
        }
      }
    }
  };`;

if (code.includes(oldCode)) {
  code = code.replace(oldCode, newCode);
  fs.writeFileSync('src/App.tsx', code);
  console.log('fetchSchedule patched successfully');
} else {
  console.log('Could not find fetchSchedule block to patch. Please check the exact string.');
}
