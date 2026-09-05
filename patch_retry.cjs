const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

code = code.replace(/if \(err\.message === 'GEMINI_TIMEOUT' \|\| err\.status === 503 \|\| err\.message\?\.includes\('503'\) \|\| err\.message\?\.includes\('UNAVAILABLE'\)\) \{/g,
  "if (err.message === 'GEMINI_TIMEOUT' || err.status === 503 || err.status === 429 || err.message?.includes('503') || err.message?.includes('429') || err.message?.includes('UNAVAILABLE') || err.message?.includes('RESOURCE_EXHAUSTED')) {");

fs.writeFileSync('server.ts', code);
console.log('patched retry');
