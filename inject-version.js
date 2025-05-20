const fs = require('fs');
const { execSync } = require('child_process');

const version = execSync('git rev-parse --short HEAD').toString().trim();
const filePath = process.argv[2] || 'index.html';

let html = fs.readFileSync(filePath, 'utf8');
const replaced = html.includes('v__VERSION__');
html = html.replace(/v__VERSION__/, `v${version}`);
fs.writeFileSync(filePath, html);

if (replaced) {
  console.log(`Version updated to v${version} in ${filePath}`);
} else {
  console.log('No v__VERSION__ placeholder found in', filePath);
} 