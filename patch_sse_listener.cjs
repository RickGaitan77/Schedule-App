const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

code = code.replace("if (data.type === 'sync' && data.shifts && data.shifts.length > 0) {", "if (data.type === 'sync' && Array.isArray(data.shifts)) {");

fs.writeFileSync('src/App.tsx', code);
console.log('patched SSE listener');
