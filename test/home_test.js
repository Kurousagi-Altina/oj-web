'use strict';
/* Deterministic test: landing on ANY home panel should trigger norma check */
const fs = require('fs');
const path = require('path');
for (const f of ['data.js', 'boards.js', 'engine.js', 'ai.js']) {
  eval(fs.readFileSync(path.join('E:/鲜橙汁/web/js', f), 'utf8'));
}
const OJ = globalThis.OJ;

async function main() {
  const G = OJ.engine.newGame({ p0cpu: true, boardId: 'clover' });
  const p = G.players[0];
  const io = OJ.ai.cpuIO();

  // Test 1: land on OWN home (2,1) with 10 stars
  p.stars = 10; p.wins = 0;
  p.pos = G.board.homes[0];
  let leveled = await OJ.engine.panelEffect(G, io, p, {});
  console.log('T1 own home, 10 stars -> level', p.level, '(expect 2)', p.level === 2 ? 'PASS' : 'FAIL');

  // Test 2: land on OTHER player's home (7,2) with 10 stars
  p.level = 1; p.stars = 10;
  p.pos = G.board.homes[1];
  await OJ.engine.panelEffect(G, io, p, {});
  console.log('T2 other home, 10 stars -> level', p.level, '(expect 2)', p.level === 2 ? 'PASS' : 'FAIL');

  // Test 3: land on home with 5 stars (below req) -> no level
  p.level = 1; p.stars = 5;
  p.pos = G.board.homes[2];
  await OJ.engine.panelEffect(G, io, p, {});
  console.log('T3 home, 5 stars -> level', p.level, '(expect 1)', p.level === 1 ? 'PASS' : 'FAIL');

  // Test 4: full turn flow landing exactly on a home (move + panelEffect like playTurn)
  p.level = 1; p.stars = 30;
  const homeId = G.board.homes[0];
  let pred = null;
  for (const q of G.board.panels) if (q.next.includes(homeId)) pred = q.id;
  p.pos = pred;
  const state = { extraRolls: 0 };
  await OJ.engine.move(G, io, p, 1, state);
  await OJ.engine.panelEffect(G, io, p, state);
  console.log('T4 move onto home -> pos is home:', p.pos === homeId, 'level:', p.level, '(expect 2)', p.level === 2 ? 'PASS' : 'FAIL');

  // Test 5: passing own home and declining stop -> no norma (still level 1), keeps moving
  p.level = 1; p.stars = 30;
  p.pos = pred;
  const oldStop = io.promptStopHome;
  io.promptStopHome = async () => false;
  await OJ.engine.move(G, io, p, 1, state);
  io.promptStopHome = oldStop;
  console.log('T5 (info) after declining stop, pos:', JSON.stringify(G.board.panels[p.pos].x + ',' + G.board.panels[p.pos].y), 'level:', p.level, '(expect 1, no check when just passing)');
}

main().then(() => console.log('DONE')).catch((e) => { console.error('ERR', e); process.exit(1); });
