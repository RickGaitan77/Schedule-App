const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

const anchor = "  app.get('/api/shifts', (req, res) => {";
const legacyRoutes = `  // Legacy endpoints for old clients
  app.get('/api/get-schedule', (req, res) => {
    res.json({ success: true, shifts: shiftsStore });
  });

  app.post('/api/update-schedule', (req, res) => {
    const { shifts } = req.body;
    if (Array.isArray(shifts)) {
      shiftsStore = shifts;
      saveShifts();
      notifyClients();
      res.json({ success: true, shifts: shiftsStore });
    } else {
      res.status(400).json({ success: false, error: 'Invalid shifts data' });
    }
  });

`;

code = code.replace(anchor, legacyRoutes + anchor);
fs.writeFileSync('server.ts', code);
console.log('patched legacy routes');
