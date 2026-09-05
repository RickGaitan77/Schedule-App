const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

const oldPostShifts = `  app.post('/api/shifts', (req, res) => {
    const { shifts } = req.body;
    if (Array.isArray(shifts)) {
      shiftsStore = [...shifts, ...shiftsStore];
    } else if (shifts) {
      shiftsStore.unshift(shifts);
    }
    saveShifts();
    notifyClients();
    res.json({ success: true, shifts: shiftsStore });
  });`;

const newPostShifts = `  app.post('/api/shifts', (req, res) => {
    const { shifts } = req.body;
    let newShifts = Array.isArray(shifts) ? shifts : (shifts ? [shifts] : []);
    
    // Deduplicate on server
    const existingIds = new Set(shiftsStore.map(s => s.id));
    const toAdd = newShifts.filter(s => !existingIds.has(s.id));
    const toUpdate = newShifts.filter(s => existingIds.has(s.id));

    toUpdate.forEach(updatedShift => {
      shiftsStore = shiftsStore.map(s => s.id === updatedShift.id ? updatedShift : s);
    });

    if (toAdd.length > 0) {
      shiftsStore = [...toAdd, ...shiftsStore];
    }

    saveShifts();
    notifyClients();
    res.json({ success: true, shifts: shiftsStore });
  });`;

code = code.replace(oldPostShifts, newPostShifts);
fs.writeFileSync('server.ts', code);
console.log('patched server duplicates');
