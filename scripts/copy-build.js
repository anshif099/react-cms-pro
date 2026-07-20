const fs = require('fs');
const path = require('path');

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  let entries = fs.readdirSync(src, { withFileTypes: true });

  for (let entry of entries) {
    let srcPath = path.join(src, entry.name);
    let destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

const srcDir = path.join(__dirname, '../apps/dashboard/dist');
const destDir = path.join(__dirname, '../dist');

if (fs.existsSync(srcDir)) {
  console.log(`Copying build output from ${srcDir} to ${destDir}...`);
  if (fs.existsSync(destDir)) {
    fs.rmSync(destDir, { recursive: true, force: true });
  }
  copyDir(srcDir, destDir);
  console.log('Build output copied successfully!');
} else {
  console.error(`Source directory ${srcDir} does not exist!`);
  process.exit(1);
}
