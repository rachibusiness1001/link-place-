const fs = require('fs');
const path = require('path');
function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;
  
  if (content.includes('http://localhost:3000')) {
    content = content.replace(/['"]http:\/\/localhost:3000(.*?)\"|['"]http:\/\/localhost:3000(.*?)'/g, '`${process.env.NEXT_PUBLIC_API_URL}$1$2`');
    changed = true;
  }
  if (content.includes('https://link-place.onrender.com')) {
    content = content.replace(/['"]https:\/\/link-place\.onrender\.com(.*?)\"|['"]https:\/\/link-place\.onrender\.com(.*?)'/g, '`${process.env.NEXT_PUBLIC_API_URL}$1$2`');
    changed = true;
  }
  
  if (content.includes('const backendUrl')) {
    content = content.replace(/const backendUrl = [^;]+;/g, '');
    content = content.replace(/\$\{backendUrl\}/g, '${process.env.NEXT_PUBLIC_API_URL}');
    changed = true;
  }
  
  if (content.includes('`http://localhost:3000')) {
    content = content.replace(/`http:\/\/localhost:3000(.*?)`/g, '`${process.env.NEXT_PUBLIC_API_URL}$1`');
    changed = true;
  }
  
  if (changed) {
    fs.writeFileSync(filePath, content);
    console.log('Updated', filePath);
  }
}
const dirs = ['dashboard-ui/src/app'];
while(dirs.length > 0) {
  const dir = dirs.shift();
  const files = fs.readdirSync(dir);
  for (const f of files) {
    const full = path.join(dir, f);
    if (fs.statSync(full).isDirectory()) dirs.push(full);
    else if (full.endsWith('.tsx') || full.endsWith('.ts')) processFile(full);
  }
}
