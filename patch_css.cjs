const fs = require('fs');
let code = fs.readFileSync('src/index.css', 'utf-8');

code += `
@keyframes pulse-shadow-red {
  0%, 100% {
    box-shadow: 0 0 12px rgba(239, 68, 68, 0.4);
    border-color: rgba(239, 68, 68, 0.6);
  }
  50% {
    box-shadow: 0 0 24px rgba(239, 68, 68, 1), inset 0 0 8px rgba(239, 68, 68, 0.2);
    border-color: rgba(239, 68, 68, 1);
  }
}

.animate-pulse-shadow-urgent {
  animation: pulse-shadow-red 2.5s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}
`;
fs.writeFileSync('src/index.css', code);
console.log('patched index.css');
