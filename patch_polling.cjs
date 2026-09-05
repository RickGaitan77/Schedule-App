const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

const oldEffect = `  useEffect(() => {
    // Initial fetch to handle backup restoration if server is empty
    fetch('/api/shifts')
      .then(res => res.json())
      .then(async data => {
        if (data.success && data.shifts && data.shifts.length > 0) {
          setShifts(data.shifts);
        } else {
          const backup = localStorage.getItem('vet_shifts_backup') || localStorage.getItem('schedule_sync_shifts');
          if (backup) {
            try {
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
            } catch (e) {
              console.error('Failed to parse backup shifts:', e);
            }
          }
        }
      })
      .catch(err => {
        console.error('Error fetching shifts:', err);
        const backup = localStorage.getItem('vet_shifts_backup') || localStorage.getItem('schedule_sync_shifts');
        if (backup) {
          try {
            const parsedBackup = JSON.parse(backup);
            if (parsedBackup && parsedBackup.length > 0) {
              setShifts(parsedBackup);
            }
          } catch (e) {
            console.error('Failed to parse backup shifts:', e);
          }
        }
      });

    // Real-Time Cross-Device Sync via SSE
    const eventSource = new EventSource('/api/shifts/stream');
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'sync' && Array.isArray(data.shifts)) {
          setShifts(data.shifts);
        }
      } catch (err) {
        console.error('SSE parsing error:', err);
      }
    };

    return () => {
      eventSource.close();
    };
  }, []);`;

const newEffect = `  const fetchSchedule = async (isInitial = false) => {
    try {
      const res = await fetch('/api/shifts');
      const data = await res.json();
      
      if (data.success && data.shifts && data.shifts.length > 0) {
        setShifts(data.shifts);
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
  };

  useEffect(() => {
    // Initial fetch to handle backup restoration if server is empty
    fetchSchedule(true);

    // 5-second setInterval background polling loop
    const pollingInterval = setInterval(() => {
      fetchSchedule(false);
    }, 5000);

    // Real-Time Cross-Device Sync via SSE (Kept as primary immediate sync)
    const eventSource = new EventSource('/api/shifts/stream');
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'sync' && Array.isArray(data.shifts)) {
          setShifts(data.shifts);
        }
      } catch (err) {
        console.error('SSE parsing error:', err);
      }
    };

    return () => {
      clearInterval(pollingInterval);
      eventSource.close();
    };
  }, []);`;

code = code.replace(oldEffect, newEffect);
fs.writeFileSync('src/App.tsx', code);
console.log('patched polling');
