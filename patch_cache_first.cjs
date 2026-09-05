const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

const oldCode = `  const fetchSchedule = async (isInitial = false) => {
    try {
      const res = await fetch('/api/shifts');
      const data = await res.json();
      
      if (data.success && data.shifts && data.shifts.length > 0) {
        setShifts(prev => JSON.stringify(prev) === JSON.stringify(data.shifts) ? prev : data.shifts);
        try {
          localStorage.setItem('vet_shifts_backup', JSON.stringify(data.shifts));
        } catch (e) {}
      } else {
        // Server returned an empty list - restore from local backup immediately
        let parsedBackup = null;
        try {
          const backup = localStorage.getItem('vet_shifts_backup') || localStorage.getItem('schedule_sync_shifts');
          if (backup) {
            parsedBackup = JSON.parse(backup);
          }
        } catch (e) {
          console.error('Failed to parse backup shifts:', e);
        }

        if (parsedBackup && Array.isArray(parsedBackup) && parsedBackup.length > 0) {
          try {
            await fetch('/api/update-schedule', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ shifts: parsedBackup })
            });
            setShifts(prev => JSON.stringify(prev) === JSON.stringify(parsedBackup) ? prev : parsedBackup);
            console.log('Restored shifts from local backup to server.');
          } catch (err) {
            console.error('Failed to send backup to server:', err);
            setShifts(prev => JSON.stringify(prev) === JSON.stringify(parsedBackup) ? prev : parsedBackup);
          }
        } else if (isInitial) {
           // Ensure it doesn't stay stuck
           setShifts([]);
        }
      }
    } catch (err) {
      console.error('Error fetching shifts:', err);
      // Always fallback to local backup on error
      try {
        const backup = localStorage.getItem('vet_shifts_backup') || localStorage.getItem('schedule_sync_shifts');
        if (backup) {
          const parsedBackup = JSON.parse(backup);
          if (parsedBackup && Array.isArray(parsedBackup) && parsedBackup.length > 0) {
            setShifts(prev => JSON.stringify(prev) === JSON.stringify(parsedBackup) ? prev : parsedBackup);
          }
        }
      } catch (e) {
        console.error('Failed to parse backup shifts:', e);
      }
    }
  };`;

const newCode = `  const fetchSchedule = async (isInitial = false) => {
    // 1. Instant Cache Display on Launch
    if (isInitial) {
      try {
        const backup = localStorage.getItem('vet_shifts_backup') || localStorage.getItem('schedule_sync_shifts');
        if (backup) {
          const parsedBackup = JSON.parse(backup);
          if (parsedBackup && Array.isArray(parsedBackup) && parsedBackup.length > 0) {
            setShifts(prev => JSON.stringify(prev) === JSON.stringify(parsedBackup) ? prev : parsedBackup);
            console.log('Instant Cache Display on Launch triggered.');
          }
        }
      } catch (e) {
        console.error('Failed instant cache load:', e);
      }
    }

    try {
      // 2. Fetch in the background using the requested endpoint
      const res = await fetch('/api/get-schedule');
      const data = await res.json();
      
      if (data.success && data.shifts && data.shifts.length > 0) {
        setShifts(prev => {
          const isSame = JSON.stringify(prev) === JSON.stringify(data.shifts);
          // 3. Save Shifts During Polling if differs
          if (!isSame) {
            try {
              localStorage.setItem('vet_shifts_backup', JSON.stringify(data.shifts));
            } catch (e) {}
          }
          return isSame ? prev : data.shifts;
        });
      } else {
        // Server returned an empty list - restore from local backup immediately
        let parsedBackup = null;
        try {
          const backup = localStorage.getItem('vet_shifts_backup') || localStorage.getItem('schedule_sync_shifts');
          if (backup) {
            parsedBackup = JSON.parse(backup);
          }
        } catch (e) {
          console.error('Failed to parse backup shifts:', e);
        }

        // Re-seed Wiped Server
        if (parsedBackup && Array.isArray(parsedBackup) && parsedBackup.length > 0) {
          try {
            await fetch('/api/update-schedule', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ shifts: parsedBackup })
            });
            setShifts(prev => JSON.stringify(prev) === JSON.stringify(parsedBackup) ? prev : parsedBackup);
            console.log('Restored shifts from local backup to server.');
          } catch (err) {
            console.error('Failed to send backup to server:', err);
            setShifts(prev => JSON.stringify(prev) === JSON.stringify(parsedBackup) ? prev : parsedBackup);
          }
        } else if (isInitial) {
           setShifts([]);
        }
      }
    } catch (err) {
      console.error('Error fetching shifts:', err);
      // Always fallback to local backup on error
      try {
        const backup = localStorage.getItem('vet_shifts_backup') || localStorage.getItem('schedule_sync_shifts');
        if (backup) {
          const parsedBackup = JSON.parse(backup);
          if (parsedBackup && Array.isArray(parsedBackup) && parsedBackup.length > 0) {
            setShifts(prev => JSON.stringify(prev) === JSON.stringify(parsedBackup) ? prev : parsedBackup);
          }
        }
      } catch (e) {
        console.error('Failed to parse backup shifts:', e);
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
