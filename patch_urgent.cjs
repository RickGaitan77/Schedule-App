const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

const oldUrgent = `    if (shift.colorCode === 'red') {
      borderColorClass = 'border-2 border-red-500 shadow-[0_0_10px_rgba(239,68,68,0.4)]';
      textColorClass = 'text-red-400';
      label = 'URGENT';
      pulseClass = 'animate-pulse';
    }`;

const newUrgent = `    if (shift.colorCode === 'red') {
      borderColorClass = 'border-2 border-red-500';
      textColorClass = 'text-red-400';
      label = 'URGENT';
      pulseClass = 'animate-pulse-shadow-urgent';
    }`;

code = code.replace(oldUrgent, newUrgent);
fs.writeFileSync('src/App.tsx', code);
console.log('patched urgent care');
