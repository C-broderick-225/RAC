const fs = require('fs');
const { execSync } = require('child_process');

const version = execSync('git rev-parse --short HEAD').toString().trim();
const filePath = 'index.html';

let html = fs.readFileSync(filePath, 'utf8');
html = html.replace(/v__VERSION__/, `v${version}`);
fs.writeFileSync(filePath, html); 