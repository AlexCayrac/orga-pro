const fs = require('fs');
const path = require('path');
const exts = ['.js', '.jsx', '.ts', '.tsx', '.css', '.json'];
function walk(d){ let out=[]; for(const e of fs.readdirSync(d,{withFileTypes:true})){ const p=path.join(d,e.name); if(e.isDirectory()) out = out.concat(walk(p)); else out.push(p); } return out }
const candidates = walk('src');
const files = candidates.filter(f => /\.jsx?$/.test(f));
const fixes = [];
for(const file of files){
  const src = fs.readFileSync(file,'utf8');
  const re = /import\s+[^'\"]+['\"](.+?)['\"]/g;
  let m;
  while((m = re.exec(src))){
    const imp = m[1];
    if(!imp.startsWith('.')) continue;
    const base = path.resolve(path.dirname(file), imp);
    let found = false;
    for(const e of exts){ if(fs.existsSync(base + e)){ found = true; break; } }
    if(!found){ if(fs.existsSync(base) && fs.statSync(base).isDirectory()){ for(const e of exts){ if(fs.existsSync(path.join(base, 'index' + e))){ found = true; break; } } } }
    if(!found){
      const name = imp.split('/').pop();
      const matches = candidates.filter(c => path.basename(c).toLowerCase() === name.toLowerCase() || path.basename(c).toLowerCase() === (name.toLowerCase()+'.jsx'));
      if(matches.length === 1){
        const rel = path.relative(path.dirname(file), matches[0]).replace(/\\/g,'/');
        fixes.push({file, imp, match: matches[0], replace: (rel.startsWith('.') ? rel : './' + rel)});
      }
    }
  }
}
console.log(JSON.stringify(fixes, null, 2));
