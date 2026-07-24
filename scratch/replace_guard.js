const fs = require('fs');
const path = require('path');

function replaceInDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      replaceInDir(fullPath);
    } else if (fullPath.endsWith('.ts')) {
      let content = fs.readFileSync(fullPath, 'utf-8');
      
      // Don't replace inside the clerk-auth.guard.ts itself
      if (file === 'clerk-auth.guard.ts') continue;
      
      let changed = false;
      
      // Update imports
      if (content.includes('ClerkAuthGuard')) {
        content = content.replace(/ClerkAuthGuard/g, 'FirebaseAuthGuard');
        content = content.replace(/clerk-auth\.guard/g, 'firebase-auth.guard');
        changed = true;
      }
      
      if (changed) {
        fs.writeFileSync(fullPath, content);
        console.log('Updated', fullPath);
      }
    }
  }
}

replaceInDir('c:\\\\Users\\\\Fejoe\\\\OneDrive\\\\Desktop\\\\AI Agent\\\\apps\\\\api\\\\src');
