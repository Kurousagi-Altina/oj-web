'use strict';
/* Static audit: every OJ.ai.* / OJ.engine.* referenced in ui.js must exist */
const fs = require('fs');
const path = require('path');
const load = (f) => eval(fs.readFileSync(path.join('E:/鲜橙汁/web/js', f), 'utf8'));
globalThis.OJ = {};
for (const f of ['data.js', 'boards.js', 'engine.js', 'ai.js']) load(f);
const OJ = globalThis.OJ;

const uiSrc = fs.readFileSync('E:/鲜橙汁/web/js/ui.js', 'utf8');
const mainSrc = fs.readFileSync('E:/鲜橙汁/web/js/main.js', 'utf8');
const refs = {};
for (const [name, src] of [['ui.js', uiSrc], ['main.js', mainSrc]]) {
  for (const m of src.matchAll(/OJ\.(ai|engine)\.(\w+)\s*\(/g)) {
    refs['OJ.' + m[1] + '.' + m[2]] = name;
  }
}
let fail = 0;
for (const [ref, file] of Object.entries(refs)) {
  const [, ns, fn] = ref.split('.');
  const ok = typeof OJ[ns][fn] === 'function';
  if (!ok) { console.log('MISSING', ref, 'used in', file); fail = 1; }
}
console.log(fail ? 'AUDIT FAIL' : 'AUDIT OK (' + Object.keys(refs).length + ' refs checked)');
process.exit(fail);
