'use strict';
/* Regression tests for card usage timing + Aru's hyper (Present for You) */
const fs = require('fs');
const path = require('path');
for (const f of ['data.js', 'boards.js', 'engine.js', 'ai.js']) {
  eval(fs.readFileSync(path.join('E:/鲜橙汁/web/js', f), 'utf8'));
}
const OJ = globalThis.OJ;
let failed = 0;
function check(name, cond) { console.log(cond ? 'PASS' : 'FAIL', '-', name); if (!cond) failed++; }

async function main() {
  // ---- Present for You (wiki/Aru/Hyper): ALL players draw, caster included ----
  {
    const G = OJ.engine.newGame({ p0cpu: true, charIds: ['aru', 'qp', 'kai', 'poppo'], boardId: 'practice' });
    const p = G.players[0]; p.charId = 'aru'; p.level = 2; p.stars = 200;
    p.hand = ['HYPER_ARU'];               // after removal: 0/4 -> draws 4
    G.players[1].hand = [];                // qp 0/3 -> draws 3
    G.players[2].hand = ['COOKIE', 'COOKIE', 'COOKIE']; // kai full -> draws 1
    G.players[3].hand = [];                // poppo 0/3 -> draws 3
    const io = OJ.ai.cpuIO();
    const ok = await OJ.engine.useCard(G, io, p, 'HYPER_ARU', null);
    const sizes = G.players.map((q) => q.hand.length);
    // total drawn = 4+3+1+3 = 11 -> +110; cost 30 -> 200-30+110 = 280
    check('hyper resolves (ok=' + ok + ')', ok === true);
    check('caster also fills hand (sizes=' + sizes.join(',') + ')',
      sizes.join(',') === '4,3,3,3' && p.hand.length === 4);
    check('stars = 10x all drawn (' + p.stars + ')', p.stars === 280);
  }
  {
    // KO'd players are skipped by the hyper
    const G = OJ.engine.newGame({ p0cpu: true, charIds: ['aru', 'qp', 'kai', 'poppo'], boardId: 'practice' });
    const p = G.players[0]; p.charId = 'aru'; p.level = 2; p.stars = 100;
    p.hand = ['HYPER_ARU'];
    G.players[1].ko = true;               // skipped
    G.players[2].hand = [];
    G.players[3].hand = [];
    await OJ.engine.useCard(G, OJ.ai.cpuIO(), p, 'HYPER_ARU', null);
    // drawn = 4 (aru) + 3 + 3 = 10 -> -30 +100 -> 170
    const koHandBefore = G.players[1].hand.length;
    check('KO players skipped, stars ' + p.stars,
      p.stars === 170 && G.players[1].hand.length === koHandBefore);
  }

  // ---- field phase rejects battle-timed cards WITHOUT consuming them ----
  {
    const G = OJ.engine.newGame({ p0cpu: true, boardId: 'practice' });
    const p = G.players[0]; p.charId = 'kai'; p.level = 4; p.stars = 100;
    p.hand = ['BIGMAGNUM', 'DASH'];
    const discards = G.centerDiscard.length;
    const ok = await OJ.engine.useCard(G, OJ.ai.cpuIO(), p, 'BIGMAGNUM', null);
    check('Big Magnum fizzles outside battle (ok=' + ok + ', in hand=' + p.hand.includes('BIGMAGNUM') +
          ', stars=' + p.stars + ', discarded +' + (G.centerDiscard.length - discards) + ')',
      ok === false && p.hand.includes('BIGMAGNUM') && p.stars === 100 &&
      G.centerDiscard.length === discards && p.hp === p.maxhp);
  }
  {
    // field helper gates every battle card & battle hyper
    const p = { charId: 'qp', level: 5, stars: 999, hand: [], eff: {} };
    const G = { global: {}, players: [p] };
    const battles = ['BIGMAGNUM', 'FINALBATTLE', 'ONFIRE', 'RAINBOW', 'RBITS', 'REVERSE', 'SHIELD'];
    check('all Battle cards marked battle-timed', battles.every((c) => OJ.engine.isBattleTiming(c)));
    check('battle hypers are battle-timed, event hypers are not',
      OJ.engine.isBattleTiming('HYPER_QP') && OJ.engine.isBattleTiming('HYPER_PEAT') &&
      !OJ.engine.isBattleTiming('HYPER_ARU') && !OJ.engine.isBattleTiming('HYPER_MARC'));
    check('battle cards rejected on field',
      battles.concat(['HYPER_QP', 'HYPER_PEAT']).every((c) => !OJ.engine.playableOnField(G, p, c)));
    check('field cards pass on field',
      ['DASH', 'NICEPRESENT', 'HYPER_ARU', 'MIMYUU'].every((c) => OJ.engine.playableOnField(G, p, c)));
  }

  // ---- battle phase only accepts battle-timed cards (+ defender-only rule) ----
  {
    const G = OJ.engine.newGame({ p0cpu: true, boardId: 'practice' });
    const p = G.players[0]; p.charId = 'qp'; p.level = 5; p.stars = 999; p.hp = 5;
    p.hand = ['SHIELD', 'ONFIRE', 'HYPER_ARU', 'HYPER_PEAT', 'BIGMAGNUM'];
    const ctx = { buffs: G.players.map(() => ({ atk: 0, def: 0, evd: 0 })), buffTags: G.players.map(() => []), noEvade: {}, noAttack: {}, hyperMode: {} };
    const io = OJ.ai.cpuIO();
    check('Shield is defender-only', !OJ.engine.playableInBattle(G, p, 'SHIELD', 'attacker') && OJ.engine.playableInBattle(G, p, 'SHIELD', 'defender'));
    check('event hyper rejected in battle window', !OJ.engine.playableInBattle(G, p, 'HYPER_ARU', 'attacker') && !OJ.engine.playableInBattle(G, p, 'HYPER_ARU', 'defender'));
    check('battle hyper & Big Magnum usable by attacker',
      OJ.engine.playableInBattle(G, p, 'HYPER_PEAT', 'attacker') && OJ.engine.playableInBattle(G, p, 'BIGMAGNUM', 'attacker'));

    // applyBattleCard hard-rejects wrong side without consuming
    const d0 = G.centerDiscard.length;
    await OJ.engine.applyBattleCard(G, io, ctx, p, 'HYPER_ARU', 'defender');
    await OJ.engine.applyBattleCard(G, io, ctx, p, 'SHIELD', 'attacker');
    check('applyBattleCard ignores field hyper / wrong-role Shield (hand intact)',
      p.hand.includes('HYPER_ARU') && p.hand.includes('SHIELD') && ctx.buffs[p.idx].def === 0);
    // correct use works
    await OJ.engine.applyBattleCard(G, io, ctx, p, 'SHIELD', 'defender');
    check('Shield applied as defender (def=' + ctx.buffs[p.idx].def + ', removed=' + !p.hand.includes('SHIELD') + ')',
      ctx.buffs[p.idx].def === 3 && ctx.noAttack[p.idx] === true && !p.hand.includes('SHIELD') && ctx.buffTags[p.idx].includes('Shield'));
    void d0;
  }
  {
    // AI never picks a battle card during the play phase nor a field card in battle
    const G = OJ.engine.newGame({ p0cpu: true, boardId: 'practice' });
    const p = G.players[0]; p.charId = 'marc'; p.level = 5; p.stars = 999; p.hp = 5;
    p.hand = ['BIGMAGNUM', 'ONFIRE', 'HYPER_ARU', 'NICEPRESENT'];
    const played = OJ.ai.wantPlayCard(G, p, 'BIGMAGNUM') || OJ.ai.wantPlayCard(G, p, 'ONFIRE');
    check('AI wantPlayCard rejects battle cards', !played);
    check('AI wantBattleCard stays within battle cards (role-gated)',
      OJ.ai.wantBattleCard(G, p, {}, 'defender') !== 'HYPER_ARU');
  }

  // ---- CPU turn flow does not consume the turn on invalid picks ----
  {
    let prompts = 0;
    const G = OJ.engine.newGame({ p0cpu: false, boardId: 'practice' });
    const p = G.players[0]; p.charId = 'qp'; p.level = 5; p.stars = 100;
    p.hand = ['BIGMAGNUM', 'DASH'];
    const io = {
      ...OJ.ai.cpuIO(),
      async promptCardPlay() { prompts++; return prompts === 1 ? 'BIGMAGNUM' : (prompts === 2 ? 'DASH' : null); },
      async promptCardTarget() { return null; },
    };
    await OJ.engine.playTurn(G, io);
    const dashes = p.hand.filter((c) => c === 'DASH').length;
    check('rejected battle-card pick re-prompts (prompts=' + prompts + ', dash left=' + dashes + ')',
      prompts >= 2 && dashes === 0 && p.hand.includes('BIGMAGNUM'));
  }
}

main().then(() => { console.log(failed ? 'TIMING TEST FAIL' : 'TIMING TEST ALL OK'); process.exit(failed ? 1 : 0); })
  .catch((e) => { console.error('ERR', e); process.exit(1); });
