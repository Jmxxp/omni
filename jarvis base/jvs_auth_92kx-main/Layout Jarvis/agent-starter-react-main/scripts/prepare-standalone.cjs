const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const standaloneDir = path.join(root, '.next', 'standalone');
const publicSource = path.join(root, 'public');
const staticSource = path.join(root, '.next', 'static');
const publicTarget = path.join(standaloneDir, 'public');
const staticTarget = path.join(standaloneDir, '.next', 'static');

function copyDir(source, target) {
  if (!fs.existsSync(source)) return;
  fs.rmSync(target, { force: true, recursive: true });
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.cpSync(source, target, { recursive: true });
}

if (!fs.existsSync(path.join(standaloneDir, 'server.js'))) {
  throw new Error('Next standalone server.js não foi gerado. Rode next build primeiro.');
}

copyDir(publicSource, publicTarget);
copyDir(staticSource, staticTarget);

console.log('Standalone pronto para Electron.');
