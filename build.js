const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const src = 'index.html';
const destDir = 'build';
const dest = path.join(destDir, 'index.html');

if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir);
}

fs.copyFileSync(src, dest);
console.log(`Copied ${src} to ${dest}`);

execSync(`node inject-version.js ${dest}`, { stdio: 'inherit' }); 