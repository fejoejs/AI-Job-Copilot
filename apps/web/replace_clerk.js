const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src', 'app');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

walkDir(srcDir, function(filePath) {
  if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;

    // Replace @clerk/nextjs imports with FirebaseAuthContext in dashboard pages
    if (filePath.includes('(dashboard)') || filePath.endsWith('profile-setup\\page.tsx') || filePath.endsWith('profile-setup/page.tsx')) {
        content = content.replace(/from '@clerk\/nextjs'/g, "from '@/context/FirebaseAuthContext'");
        // If they imported SignOutButton, just remove it from the import list since it's not exported
        content = content.replace(/,\s*SignOutButton/g, '');
        content = content.replace(/SignOutButton,\s*/g, '');
    }

    if (content !== original) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log('Updated', filePath);
    }
  }
});
