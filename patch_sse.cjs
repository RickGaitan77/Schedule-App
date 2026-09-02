const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

const sseBlock = `
  // SSE connections
  let clients: any[] = [];
  
  app.get('/api/shifts/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    // Send initial state
    res.write(\`data: \${JSON.stringify({ type: 'sync', shifts: shiftsStore })}\\n\\n\`);

    clients.push(res);

    req.on('close', () => {
      clients = clients.filter(client => client !== res);
    });
  });

  const notifyClients = () => {
    const data = JSON.stringify({ type: 'sync', shifts: shiftsStore });
    clients.forEach(client => client.write(\`data: \${data}\\n\\n\`));
  };
`;

// Insert the block before app.get('/api/shifts'
code = code.replace(`  app.get('/api/shifts', (req, res) => {`, sseBlock + `\n  app.get('/api/shifts', (req, res) => {`);

// Add notifyClients() after every saveShifts() call.
code = code.replace(/saveShifts\(\);\s+res\.json/g, 'saveShifts();\n    notifyClients();\n    res.json');

fs.writeFileSync('server.ts', code);
console.log('patched SSE');
