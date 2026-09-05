const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

code = code.replace(/setTimeout\(\(\) => reject\(new Error\('GEMINI_TIMEOUT'\)\), 8000\)/g, "setTimeout(() => reject(new Error('GEMINI_TIMEOUT')), 25000)");
code = code.replace(/setTimeout\(\(\) => reject\(new Error\('GEMINI_TIMEOUT'\)\), 12000\)/g, "setTimeout(() => reject(new Error('GEMINI_TIMEOUT')), 35000)");

fs.writeFileSync('server.ts', code);
console.log('patched server timeouts');
