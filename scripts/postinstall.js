#!/usr/bin/env node
// バイナリが既に存在する場合は setup をスキップする

const fs = require('fs');
const os = require('os');
const { execSync } = require('child_process');
const path = require('path');

const platform = os.platform();
const binaryName =
  platform === 'win32' ? 'FBX2glTF-windows-x64.exe' :
  platform === 'linux' ? 'FBX2glTF-linux-x64' :
                         'FBX2glTF-darwin-x64';

const binaryPath = path.join(__dirname, '..', binaryName);

if (fs.existsSync(binaryPath)) {
  console.log(`FBX2glTF binary already exists: ${binaryName} — skipping setup.`);
  process.exit(0);
}

const setupScript = platform === 'win32' ? 'setup.bat' : './setup.sh';
console.log(`FBX2glTF binary not found. Running ${setupScript}...`);

try {
  execSync(setupScript, { stdio: 'inherit', cwd: path.join(__dirname, '..') });
} catch (e) {
  console.warn('Setup script failed. Run "npm run setup" manually to download FBX2glTF.');
  // postinstall の失敗で npm install 全体を止めない
  process.exit(0);
}
