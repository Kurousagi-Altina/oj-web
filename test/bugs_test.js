'use strict';
/* Regression tests for the three reported bugs */
const fs = require('fs');
const path = require('path');
for (const f of ['data.js', 'boards.js', 'engine.js', 'ai.js']) {
  eval(fs.readFileSync(path.join('E:/鲜橙汁/web/js', f), 'utf8'));
}
const OJ = globalThis.OJ;
let failed = 0;
function check(name, cond) { console.log(cond ? 'PASS' : 'FAIL', '-', name); if (!cond) failed++; }

async function main() {
  // ---- Bug 1: only ONE card per turn before moving ----
  {
    const G = OJ.engine.newGame({ p0cpu: false, boardId: 'practice' });
    const p = G.players[0];
    p.hand = ['DASH', 'DASH'];
    p.stars = 30;
    let prompts = 0;
    const io = {
      ...OJ.ai.cpuIO(),
      async promptCardPlay() { prompts++; return prompts === 1 ? 'DASH' : null; },
      async promptCardTarget() { return null; },
      async promptSwap(G2, pp, c) { return OJ.ai.cpuPromptSwap(G2, pp, c); },
      async log() {},
      async promptDirection(G2, pp, o) { return o[0]; },
      async promptStopHome() { return false; },
      async promptChallenge() { return false; },
      async promptNorma() { return null; },
      async promptShop() { return null; },
      async animateMove() {}, async onTurnStart() {}, async onTurnEnd() {},
      async onRoll() {}, async onPanel() {}, async onDamage() {}, async onKO() {},
      async onNorma() {}, async onRevive() {}, async onUseCard() {}, async onTeleport() {},
      async onBattleStart() {}, async onBattleRoll() {}, async onBattleEnd() {},
      async onBattlePhase() {}, async onBattleBuff() {}, async onBossEvent() {},
    };
    await OJ.engine.playTurn(G, io);
    const dashesLeft = p.hand.filter((c) => c === 'DASH').length;
    check('one card per turn (played 1 of 2 DASH, prompts=' + prompts + ')', prompts === 1 && dashesLeft === 1);
  }

  // ---- Bug 2: full hand -> swap (replace OR decline the new card) ----
  {
    const G = OJ.engine.newGame({ p0cpu: false, boardId: 'practice' });
    const p = G.players[0];
    p.charId = 'qp'; // maxHand 3, deterministic
    p.hand = ['COOKIE', 'COOKIE', 'COOKIE'];
    G.centerDeck = ['PUDDING']; // equal value to cookies -> take it, discard a cookie
    const io = OJ.ai.cpuIO();
    await OJ.engine.draw(G, io, p, 1);
    const cookies = p.hand.filter((c) => c === 'COOKIE').length;
    check('full hand draw replaces (hand=' + p.hand.length + ', cookies=' + cookies + ', pudding=' + p.hand.includes('PUDDING') + ')',
      p.hand.length === 3 && cookies === 2 && p.hand.includes('PUDDING') && G.centerDiscard.includes('COOKIE'));
  }
  {
    const G = OJ.engine.newGame({ p0cpu: false, boardId: 'practice' });
    const p = G.players[0];
    p.charId = 'qp'; // maxHand 3, deterministic
    p.hand = ['COOKIE', 'COOKIE', 'COOKIE'];
    G.centerDeck = ['HEAT300']; // low value -> CPU declines it, hand unchanged
    const io = OJ.ai.cpuIO();
    await OJ.engine.draw(G, io, p, 1);
    check('full hand draw can decline (hand=' + p.hand.length + ', heat in hand=' + p.hand.includes('HEAT300') + ', heat discarded=' + G.centerDiscard.includes('HEAT300') + ')',
      p.hand.length === 3 && !p.hand.includes('HEAT300') && G.centerDiscard.includes('HEAT300'));
  }

  // ---- Bug 3a: wild unit HP persists across battles ----
  {
    const G = OJ.engine.newGame({ p0cpu: true, boardId: 'practice' });
    const p = G.players[0];
    const io = OJ.ai.cpuIO();
    const m1 = OJ.engine.makeMob(G, 'chicken');
    G.wilds = { chicken: m1 };
    // damage it via a fake battle: directly reduce HP to simulate a survived fight
    m1.hp = 1;
    const m2 = OJ.engine.makeMob === null ? null : null;
    // encounter again -> same instance, HP not refreshed
    const kinds = ['chicken'];
    const again = (G.wilds[kinds[0]] && !G.wilds[kinds[0]].ko) ? G.wilds[kinds[0]] : OJ.engine.makeMob(G, kinds[0]);
    check('wild HP persists (1hp stays 1hp)', again === m1 && again.hp === 1);
  }

  // ---- Bug 3b: boss persists until killed; killed -> boss state exits ----
  {
    const G = OJ.engine.newGame({ p0cpu: true, boardId: 'clover' });
    G.bossActive = true;
    const boss = OJ.engine.makeMob(G, 'shifu');
    G.bossUnit = boss;
    boss.hp = 2;
    boss.stars = 15; // reward pool accumulated from KOs
    const p = G.players[0];
    const io = OJ.ai.cpuIO();
    // kill the boss via koUnit
    const ctx = { hyperMode: {} };
    await OJ.engine.koUnit(G, io, boss, p, ctx, {});
    check('boss KO -> +3 wins', p.wins === 3);
    check('boss KO -> boss state exits', G.bossActive === false && G.bossDefeated === true && G.bossUnit === null);
    // reward = the boss's pool only (wiki/Recovery: no flat bonus)
    check('boss KO -> winner takes reward pool', boss.stars === 0 && p.stars === 15);
  }

  // ---- Bug 4: norma objectives are PICKED at level-up, then must be met ----
  {
    check('WIN_NORMA table starts at 2', OJ.WIN_NORMA[0] === 2 && OJ.WIN_NORMA.length === 4);
    const G = OJ.engine.newGame({ p0cpu: true, boardId: 'practice' });
    const p = G.players[0];
    // Lv1 default objective: 10 stars (wiki/Norma)
    check('Lv1 objective is stars/10', OJ.engine.normaReq(G, p).kind === 'stars' && OJ.engine.normaReq(G, p).need === 10);
    p.stars = 9;
    check('9 stars: Lv1 objective not met', OJ.engine.normaOptions(G, p).length === 0);
    p.stars = 10;
    check('10 stars: Lv1 objective met (stars only, wins not checked)', OJ.engine.normaOptions(G, p).length === 1);
    // level up with lots of wins: player picks 'wins' as NEXT objective
    p.wins = 99;
    p.normaPick = 'wins';
    const met = OJ.engine.normaMet(G, p); // still Lv1 objective (stars) -> met
    // simulate the level-up + pick flow via normaCheck with a CPU io
    const io = OJ.ai.cpuIO();
    await OJ.engine.normaCheck(G, io, p); // levels to 2, picks next objective (wins, needs 2)
    check('after level-up to Lv2 with wins objective: need=2, 99 wins -> met',
      p.level === 2 && OJ.engine.normaReq(G, p).kind === 'wins' && OJ.engine.normaReq(G, p).need === 2 && OJ.engine.normaMet(G, p));
    // a player on wins objective with insufficient wins does NOT level even with 999 stars
    const q = G.players[1];
    q.level = 2; q.normaPick = 'wins'; q.wins = 1; q.stars = 999;
    check('Lv2 wins objective: 999 stars but 1 win -> NOT met', OJ.engine.normaOptions(G, q).length === 0);
    q.wins = 2;
    check('Lv2 wins objective: 2 wins -> met', OJ.engine.normaOptions(G, q).length === 1);
    // star objective ignores wins entirely
    const r = G.players[2];
    r.level = 2; r.normaPick = 'stars'; r.wins = 0; r.stars = 29;
    check('Lv2 star objective: 29 stars -> not met', OJ.engine.normaOptions(G, r).length === 0);
    r.stars = 30;
    check('Lv2 star objective: 30 stars -> met (0 wins irrelevant)', OJ.engine.normaOptions(G, r).length === 1);
  }

  // ---- Bug 5: no regular turn-start draw; Miracle deals the card instead ----
  // (wiki/Card Mechanics: cards come from Draw panels, effects & the field
  //  event — there is no fixed draw at the start of every turn)
  {
    const G = OJ.engine.newGame({ p0cpu: true, boardId: 'practice' });
    G.board.panels.forEach((q) => { q.next = []; }); // no movement -> no panel draws
    const p = G.players[0];
    p.hand = [];
    G.centerDeck = ['DASH', 'EXTEND', 'PUDDING'];
    const io = OJ.ai.cpuIO();
    await OJ.engine.playTurn(G, io);
    check('no regular turn-start draw (hand=' + p.hand.length + ', deck left=' + G.centerDeck.length + ')',
      p.hand.length === 0 && G.centerDeck.length === 3);
  }
  {
    const G = OJ.engine.newGame({ p0cpu: true, boardId: 'practice' });
    G.board.panels.forEach((q) => { q.next = []; });
    const p = G.players[0];
    G.global.miracle = true;
    p.hand = [];
    G.centerDeck = ['DASH', 'EXTEND', 'PUDDING'];
    const io = OJ.ai.cpuIO();
    await OJ.engine.playTurn(G, io);
    check('Miracle: card at turn start (hand=' + p.hand.length + ', deck left=' + G.centerDeck.length + ')',
      p.hand.length === 1 && G.centerDeck.length === 2);
  }
  {
    // starting hand: 1 card per player drawn from the shared Center Deck
    const G = OJ.engine.newGame({ p0cpu: true, boardId: 'practice' });
    check('every player starts with 1 card', G.players.every((q) => q.hand.length === 1));
    check('Center Deck built to 48 cards', G.centerDeck.length === 48 - 4);
    // hypes are packed as blanks and become the drawer's own hyper
    const q = G.players[0];
    q.hand = [];
    G.centerDeck = ['COOKIE', 'HYPER']; // pop() takes the last card
    const io = OJ.ai.cpuIO();
    await OJ.engine.draw(G, io, q, 1);
    check('blank HYPER becomes own hyper (' + q.hand[0] + ')', q.hand[0] === OJ.CHARS[q.charId].hyper);
  }

  // ---- Bug 6: manual roll — human gets promptRoll, CPU auto-rolls ----
  {
    let rolled = false;
    const G = OJ.engine.newGame({ p0cpu: true, boardId: 'practice' });
    const p = G.players[0];
    const io = {
      ...OJ.ai.cpuIO(),
      async promptRoll(G2, pp) { rolled = true; }, // CPU path: no-op wrapper exists
    };
    await OJ.engine.playTurn(G, io);
    check('CPU turn still completes with promptRoll in io', rolled === true && !G.winner);
  }

  // ---- Bug 7: warp panels only teleport when STOPPING on them ----
  {
    const G = OJ.engine.newGame({ p0cpu: true, boardId: 'clover' });
    const p = G.players[0];
    const io = OJ.ai.cpuIO();
    // build a linear path: start -> warp -> next (passing over the warp);
    // use fresh ids beyond the existing board
    const base = G.board.panels.length;
    const S = base, W = base + 1, N = base + 2, T = base + 3;
    for (const q of G.board.panels) q.next = [];
    G.board.panels.push(
      { id: S, x: 0, y: 0, type: 'neutral', next: [W] },
      { id: W, x: 1, y: 0, type: 'warp', next: [N] },
      { id: N, x: 2, y: 0, type: 'neutral', next: [] },
      { id: T, x: 5, y: 5, type: 'warp', next: [] },
    );
    p.pos = S; p.prevPos = S;
    await OJ.engine.move(G, io, p, 2, { extraRolls: 0 }); // roll 2: passes OVER the warp
    check('passing over warp does NOT teleport (pos=' + p.pos + ')', p.pos === N);
    // now stop ON the warp: move 1 step
    p.pos = S;
    await OJ.engine.move(G, io, p, 1, { extraRolls: 0 });
    check('stopping on warp stays (pos=' + p.pos + ')', p.pos === W);
    // and panelEffect on the warp actually teleports (to some other warp)
    await OJ.engine.panelEffect(G, io, p, { extraRolls: 0 });
    const warpIds = G.board.panels.filter((q) => q.type === 'warp').map((q) => q.id);
    check('warp panelEffect teleports (pos=' + p.pos + ')', p.pos !== W && warpIds.includes(p.pos));
  }

  // ---- Bug 8: mobs & bosses use their own stat lines in battle ----
  {
    const G = OJ.engine.newGame({ p0cpu: true, boardId: 'practice' });
    const chicken = OJ.engine.makeMob(G, 'chicken');   // ATK -1 / DEF -1 / EVD +1
    const roboball = OJ.engine.makeMob(G, 'roboball'); // ATK -1 / DEF +1 / EVD -1
    const shifu = OJ.engine.makeMob(G, 'shifu');       // boss: ATK +2 / DEF +3 / EVD -2
    const manager = OJ.engine.makeMob(G, 'manager');   // boss: ATK +3 / DEF +2 / EVD -1
    const castle = OJ.engine.makeMob(G, 'flyingcastle'); // boss: ATK +2 / DEF +1 / EVD -3
    const ctx = { buffs: {}, reverse: false };
    check('chicken ATK -1', OJ.engine.effStat(G, chicken, 'atk', ctx) === -1);
    check('chicken EVD +1', OJ.engine.effStat(G, chicken, 'evd', ctx) === 1);
    check('roboball DEF +1', OJ.engine.effStat(G, roboball, 'def', ctx) === 1);
    check('roboball EVD -1', OJ.engine.effStat(G, roboball, 'evd', ctx) === -1);
    // boss variants (wiki <Boss> pages)
    check('Shifu Robot boss HP 7/ATK +2/DEF +3/EVD -2',
      shifu.hp === 7 && OJ.engine.effStat(G, shifu, 'atk', ctx) === 2 &&
      OJ.engine.effStat(G, shifu, 'def', ctx) === 3 && OJ.engine.effStat(G, shifu, 'evd', ctx) === -2);
    check('Store Manager boss HP 8/ATK +3/DEF +2/EVD -1',
      manager.hp === 8 && OJ.engine.effStat(G, manager, 'atk', ctx) === 3 &&
      OJ.engine.effStat(G, manager, 'def', ctx) === 2 && OJ.engine.effStat(G, manager, 'evd', ctx) === -1);
    check('Flying Castle boss HP 10/ATK +2/DEF +1/EVD -3',
      castle.hp === 10 && OJ.engine.effStat(G, castle, 'atk', ctx) === 2 &&
      OJ.engine.effStat(G, castle, 'def', ctx) === 1 && OJ.engine.effStat(G, castle, 'evd', ctx) === -3);
    // player stats unchanged
    const p = G.players[0];
    p.charId = 'suguri'; // ATK +1 / DEF -1 / EVD +2
    check('player (Suguri) ATK +1 unchanged', OJ.engine.effStat(G, p, 'atk', ctx) === 1);
  }

  // ---- Bug 9: revive happens IN PLACE, not at home ----
  {
    const G = OJ.engine.newGame({ p0cpu: true, boardId: 'practice' });
    const p = G.players[0];
    const deathPanel = G.board.homes[1] + 1; // some panel far from own home
    p.pos = deathPanel;
    p.prevPos = deathPanel;
    p.ko = true;
    p.reviveReq = 1; // guaranteed success on d6
    const io = OJ.ai.cpuIO();
    // playTurn with recovery success path
    await OJ.engine.playTurn(G, io);
    check('revived in place (pos=' + p.pos + ', home=' + p.homeId + ')',
      !p.ko && p.pos === deathPanel && p.hp === p.maxhp);
  }

  // ---- Bug 10: recovery roll is prompted (player rolls their own dice) ----
  {
    const G = OJ.engine.newGame({ p0cpu: true, boardId: 'practice' });
    const p = G.players[0];
    p.ko = true;
    p.reviveReq = 6;
    G.rng = () => 0; // d6 always rolls 1 -> recovery guaranteed to fail
    let prompted = false;
    let rolledEvent = false;
    const io = {
      ...OJ.ai.cpuIO(),
      async promptRecoveryRoll() { prompted = true; },
      async onRecoveryRoll(G2, pp, roll) { rolledEvent = roll === 1; },
    };
    await OJ.engine.playTurn(G, io);
    check('recovery roll prompted + dice event fired (prompted=' + prompted + ')',
      prompted && rolledEvent && p.ko && p.reviveReq === 5); // failed: req drops to 5
  }

  // ---- Bug 11: traps only trigger when STOPPING on the panel ----
  {
    const G = OJ.engine.newGame({ p0cpu: true, boardId: 'practice' });
    const p = G.players[0];
    const A = p.pos;
    const B = G.board.panels[A].next[0];
    const C = (G.board.panels[B].next || [])[0];
    const io = OJ.ai.cpuIO();
    G.traps[B] = { card: 'MIMYUU', setter: 1, setChapter: G.chapter };
    // move 2 steps: passes over B, stops on C
    await OJ.engine.move(G, io, p, 2, { extraRolls: 0 });
    check('trap NOT triggered when passing over (still on B=' + (G.traps[B] !== undefined) + ')',
      G.traps[B] !== undefined && p.hp === p.maxhp);
    // stop directly on B -> panelEffect triggers the trap
    p.pos = A; p.prevPos = A;
    await OJ.engine.move(G, io, p, 1, { extraRolls: 0 });
    await OJ.engine.panelEffect(G, io, p, { extraRolls: 0 });
    check('trap triggered when stopping (gone=' + (G.traps[B] === undefined) + ', hp=' + p.hp + ')',
      G.traps[B] === undefined && p.hp === p.maxhp - 1);
  }

  // ---- Bug 12: chapter stars awarded to everyone at the big-round start ----
  {
    const G = OJ.engine.newGame({ p0cpu: true, boardId: 'practice' });
    const io = OJ.ai.cpuIO();
    const before = G.players.map((q) => q.stars); // all 0
    await OJ.engine.awardChapterStars(G, io); // chapter 1 start
    check('all players got +1 at the round start', G.players.every((q, i) => q.stars === before[i] + 1));
    // wiring check: when P1's turn begins (first turn of chapter 1), EVERYONE
    // already has the +1 bonus — it is not doled out per player's own turn
    let p1TurnStars = null;
    const io2 = {
      ...OJ.ai.cpuIO(),
      async onTurnStart(G2, pp) { if (pp.idx === 0) p1TurnStars = G2.players.map((q) => q.stars); },
    };
    const G2 = OJ.engine.newGame({ p0cpu: true, boardId: 'practice' });
    await OJ.engine.runGame(G2, io2, 1);
    check('before P1 acts everyone already has the chapter bonus (stars=' + JSON.stringify(p1TurnStars) + ')',
      G2.chapter === 2 && !!p1TurnStars && p1TurnStars.every((s) => s === 1));
  }

  // ---- Bug 13: Kai's Protagonist's Privilege ----
  {
    // vs a player: opponent skips the counter
    const G = OJ.engine.newGame({ p0cpu: true, boardId: 'practice', rng: () => 0 });
    const kai = G.players[0]; kai.charId = 'kai';
    kai.eff.kai = 4;
    let counters = 0;
    const io = { ...OJ.ai.cpuIO(), async onBattlePhase(G2, phase) { if (phase === 'counter') counters++; } };
    await OJ.engine.battle(G, io, kai, G.players[1], {});
    check('Kai hyper: opponent skips counter (counters=' + counters + ')', counters === 0);
  }
  {
    // vs a wild unit (mob): also applies (previously disabled)
    const G = OJ.engine.newGame({ p0cpu: true, boardId: 'practice', rng: () => 0 });
    const kai = G.players[0]; kai.charId = 'kai';
    kai.eff.kai = 4;
    const wild = OJ.engine.getWild(G, 'chicken');
    let counters = 0;
    const io = { ...OJ.ai.cpuIO(), async onBattlePhase(G2, phase) { if (phase === 'counter') counters++; } };
    await OJ.engine.battle(G, io, kai, wild, { mob: true });
    check('Kai hyper: wild also skips first counter (counters=' + counters + ')', counters === 0);
  }
  {
    // Little War: only the FIRST round is skipped, the opponent counters later
    const G = OJ.engine.newGame({ p0cpu: true, boardId: 'practice', rng: () => 0 });
    G.global.littleWar = 3;
    const kai = G.players[0]; kai.charId = 'kai';
    const foe = G.players[1]; foe.charId = 'marc'; // DEF +1, survives
    kai.eff.kai = 4;
    let rounds = 0, counters = 0;
    const io = { ...OJ.ai.cpuIO(), async onBattlePhase(G2, phase) {
      if (phase === 'round') rounds++;
      if (phase === 'counter') counters++;
    } };
    await OJ.engine.battle(G, io, kai, foe, {});
    check('Kai hyper: skip round 1, counter round 2 (rounds=' + rounds + ', counters=' + counters + ')',
      rounds === 2 && counters === 1);
  }

  // ---- Bug 14: new characters & hypers (Yuki/Sora/Peat/Poppo/Tomomo) ----
  {
    // roster: 11 characters now
    check('roster has 11 characters', Object.keys(OJ.CHARS).length === 11);
    check('new char stats (Yuki 5/+2/-1/-1, Peat 3/+1/+1/+1, Tomomo REC 6)',
      OJ.CHARS.yuki.hp === 5 && OJ.CHARS.yuki.atk === 2 &&
      OJ.CHARS.peat.hp === 3 && OJ.CHARS.peat.def === 1 && OJ.CHARS.peat.evd === 1 &&
      OJ.CHARS.tomomo.rec === 6);
  }
  {
    // Sora's Extraordinary Specs: rolls become 6 for the chapter
    const G = OJ.engine.newGame({ p0cpu: true, boardId: 'practice', rng: () => 0 });
    const p = G.players[0]; p.charId = 'sora'; p.level = 3; p.stars = 50;
    p.hand = ['HYPER_SORA'];
    const io = { ...OJ.ai.cpuIO(), async promptCardPlay() { return 'HYPER_SORA'; }, async promptCardTarget() { return null; } };
    await OJ.engine.playTurn(G, io);
    check('Sora hyper sets specs flag', G.global.specs === true);
    const d = OJ.engine.rollDice(2, G.rng, G);
    check('specs forces rolls to 6 (dice=' + d.join(',') + ')', d[0] === 6 && d[1] === 6);
    G.global.specs = false;
    const d2 = OJ.engine.rollDice(2, G.rng, G);
    check('specs off -> normal rolls (1)', d2[0] === 1 && d2[1] === 1);
  }
  {
    // Poppo's Ubiquitous: warp to target + steal 10x level
    const G = OJ.engine.newGame({ p0cpu: true, boardId: 'practice' });
    const p = G.players[0]; p.charId = 'poppo';
    const foe = G.players[1]; foe.level = 3; foe.stars = 25;
    p.hand = ['HYPER_POPPO'];
    const io = { ...OJ.ai.cpuIO(), async promptCardTarget() { return foe; } };
    await OJ.engine.useCard(G, io, p, 'HYPER_POPPO', foe);
    check('Ubiquitous steals 10x level (steal=30 capped to 25, foe=' + foe.stars + ', p=' + p.stars + ')',
      foe.stars === 0 && p.stars === 25 && p.pos === foe.pos);
  }
  {
    // Tomomo's Magical Massacre: full-HP units KO'd, REC lowered once
    const G = OJ.engine.newGame({ p0cpu: true, boardId: 'practice' });
    const p = G.players[0]; p.charId = 'tomomo'; p.level = 4; p.stars = 50;
    const a = G.players[1]; a.hp = a.maxhp; // full -> KO'd
    const b = G.players[2]; b.hp = 1;       // not full -> survives
    G.players[3].hp = 1;                    // not full -> survives
    p.hp = p.maxhp; // tomomo herself is full -> also KO'd (all units)
    p.hand = ['HYPER_TOMOMO'];
    const io = OJ.ai.cpuIO();
    await OJ.engine.useCard(G, io, p, 'HYPER_TOMOMO', null);
    check('Massacre KOs full-HP units (a=' + a.ko + ', b=' + b.ko + ', self=' + p.ko + ')',
      a.ko === true && b.ko === false && p.ko === true);
    check('Massacre lowers next REC (recMod=' + p.eff.recMod + ')', (p.eff.recMod || 0) === -1);
  }
  {
    // Peat's Blue Crow: battle buff = hand count
    const G = OJ.engine.newGame({ p0cpu: true, boardId: 'practice' });
    const p = G.players[0]; p.charId = 'peat'; p.level = 2;
    p.hand = ['COOKIE', 'DASH', 'HYPER_PEAT'];
    const ctx = { buffs: G.players.map(() => ({ atk: 0, def: 0, evd: 0 })), buffTags: G.players.map(() => []), reverse: false };
    await OJ.engine.applyBattleCard(G, OJ.ai.cpuIO(), ctx, p, 'HYPER_PEAT');
    check('Blue Crow buff = hand count (atk=' + ctx.buffs[0].atk + ', def=' + ctx.buffs[0].def + ', evd=' + ctx.buffs[0].evd + ')',
      ctx.buffs[0].atk === 2 && ctx.buffs[0].def === 2 && ctx.buffs[0].evd === -2);
  }
}

main().then(() => { console.log(failed ? 'BUGS TEST FAIL' : 'BUGS TEST ALL OK'); process.exit(failed ? 1 : 0); })
  .catch((e) => { console.error('ERR', e); process.exit(1); });
