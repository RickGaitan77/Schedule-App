const fs = require('fs');
let code = fs.readFileSync('index.html', 'utf-8');
const headEnd = '</head>';
const injection = '    <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>\n  </head>';
code = code.replace(headEnd, injection);
fs.writeFileSync('index.html', code);
console.log('patched index.html');
