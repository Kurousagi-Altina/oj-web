/* Headless smoke test: simulate full CPU games */
'use strict';
const fs = require('fs');
const path = require('path');

const files = ['data.js', 'boards.js', 'engine.js', 'ai.js'];
for (const f of files) {
  const src = fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8');
  eval(src);
}
const OJ = globalThis.OJ;

async function main() {
  const games = Number(process.argv[2] || 5);
  let wins = {};
  let totalChapters = 0;
  for (let g = 0; g < games; g++) {
    const G = OJ.engine.newGame({ rng: Math.random, p0cpu: true });
    const logs = [];
    const io = OJ.ai.cpuIO((m) => logs.push(m));
    const t0 = Date.now();
    const winner = await OJ.engine.runGame(G, io, 400);
    const dt = Date.now() - t0;
    totalChapters += G.chapter;
    const key = winner ? winner.name : 'DRAW';
    wins[key] = (wins[key] || 0) + 1;
    console.log(`game ${g + 1}: winner=${key} chapters=${G.chapter} ${dt}ms logs=${logs.length}`);
    if (!winner) {
      console.log('--- draw dump ---');
      for (const p of G.players) console.log(` ${p.name} lvl${p.level} ${p.stars}s ${p.wins}w hp${p.hp}`);
    }
    // sanity checks
    for (const p of G.players) {
      if (p.stars < 0) throw new Error('negative stars');
      if (p.hp > p.maxhp) throw new Error('hp above max');
      if (p.hand.length > OJ.CHARS[p.charId].maxHand) throw new Error('hand overflow');
    }
  }
  console.log('wins:', JSON.stringify(wins), 'avg chapters:', (totalChapters / games).toFixed(1));
}

main().then(() => console.log('SMOKE OK')).catch((e) => { console.error('SMOKE FAIL', e); process.exit(1); });
