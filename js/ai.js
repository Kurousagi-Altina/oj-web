/* CPU AI + headless IO adapter for the 100% OJ web replica */
(function () {
  'use strict';
  const OJ = (globalThis.OJ = globalThis.OJ || {});
  const E = () => OJ.engine;
  const C = () => OJ.CARDS;

  function panelWeight(type, p) {
    switch (type) {
      case 'bonus': case 'bonus2': return 5;
      case 'draw': return 3;
      case 'draw2': return 4;
      case 'encounter': case 'encounter2':
        return p.level >= 2 && p.wins >= OJ.WIN_NORMA[p.level - 2] ? 4 : (OJ.CHARS[p.charId].atk >= 1 ? 3 : 0);
      case 'boss': return -2;
      case 'heal': case 'heal2': return p.hp <= p.maxhp - 2 ? 5 : 0;
      case 'drop': return -4;
      case 'drop2': return -7;
      case 'damage': return -4;
      case 'move': case 'move2': return 1;
      case 'warp': return 1;
      default: return 0;
    }
  }

  function bestDirection(G, p, options) {
    let best = options[0], bestScore = -Infinity;
    for (const opt of options) {
      const dist = E().bfsDist(G, opt);
      let score = -Infinity;
      for (const panel of G.board.panels) {
        const d = dist[panel.id];
        if (d === Infinity || d > 8) continue;
        let w = panelWeight(E().effType(G, panel), p);
        if (E().homeOwner(G, panel.id) === p.idx && E().normaOptions(G, p).length) w = 8;
        const s = w - d * 1.2;
        if (s > score) score = s;
      }
      if (score > bestScore) { bestScore = score; best = opt; }
    }
    return best;
  }

  function shouldStopHome(G, p) {
    // stop only when the CURRENT norma objective is already met
    return E().normaOptions(G, p).length > 0;
  }

  function shouldChallenge(G, p, foe) {
    const atk = OJ.CHARS[p.charId].atk + (p.stock.includes('ALLOUTMODE') ? 2 : 0);
    if (foe.hp <= 2 && atk >= -1) return true;
    if (atk >= 1 && foe.hp <= 4) return true;
    if (foe.stars > 100 && atk >= 1 && foe.hp <= 3) return true;
    return false;
  }

  function chooseNorma(G, p, opts) {
    // picking the NEXT objective after a level-up
    if (opts.length === 1) return opts[0];
    const si = p.level - 1; // index of the requirement for the next step
    const starRatio = p.stars / OJ.STAR_NORMA[si];
    const winRatio = (p.wins + 1) / (OJ.WIN_NORMA[Math.max(0, si - 1)] + 1);
    return starRatio >= winRatio ? 'stars' : 'wins';
  }

  const PREMOVE_PRIORITY = [
    'PUDDING', 'COOKIE', 'HYPER_ARU', 'NICEPRESENT', 'HYPER_SUGURI', 'HYPER_KAI',
    'HYPER_MARC', 'HYPER_HIME', 'HYPER_SORA', 'HYPER_TOMOMO', 'HYPER_YUKI', 'HYPER_POPPO',
    'DINNER', 'EXTEND', 'PRINCESS',
    'PIGGYBANK', 'MIMYUU', 'TOYSTORE', 'ASSAULT', 'GOAWAY', 'HEAT300', 'PURES', 'TRAGEDY',
    'SEAGULLS', 'HOLYNIGHT', 'LITTLEWAR', 'ALLOUTMODE', 'SEALEDGUARDIAN', 'OUTOFAMMO',
    'OHMYFRIEND', 'WARUDA', 'FLIPOUT', 'NICEJINGLE',
  ];

  function wantPlayCard(G, p, cardId) {
    const c = C()[cardId];
    if (!c || !E().baseUsable(G, p, cardId) || !p.hand.includes(cardId)) return false;
    if (E().isBattleTiming(cardId)) return false; // battle cards only via wantBattleCard
    const hurt = p.maxhp - p.hp;
    switch (cardId) {
      case 'PUDDING': return hurt >= 3;
      case 'COOKIE': return p.hp <= 2;
      case 'NICEPRESENT': return p.hand.length <= 1;
      case 'PRINCESS': return p.hand.length >= 3;
      case 'EXTEND': return p.level >= 3 && Math.random() < 0.4;
      case 'HYPER_SUGURI': return p.level >= 3;
      case 'HYPER_KAI': return p.level >= 3;
      case 'HYPER_MARC': return G.players.some((q) => q !== p && !q.ko && q.hp <= p.level);
      case 'HYPER_ARU': return p.hand.length >= 2;
      case 'HYPER_HIME': return p.level >= 3;
      case 'HYPER_SORA': return p.level >= 2 && Math.random() < 0.7;
      case 'HYPER_YUKI': {
        // gamble: worth it when a big enemy could be hit or we're desperate
        const strongEnemy = G.players.some((q) => q !== p && !q.ko && (q.level >= 4 || q.stars >= 80));
        return strongEnemy && Math.random() < 0.5;
      }
      case 'HYPER_POPPO': {
        // steal 10x level from the richest enemy
        const rich = G.players.some((q) => q !== p && !q.ko && q.level * 10 <= q.stars);
        return rich && Math.random() < 0.5;
      }
      case 'HYPER_TOMOMO': {
        // massacre: worth it when 2+ full-HP enemies exist
        const full = G.players.filter((q) => q !== p && !q.ko && q.hp >= q.maxhp).length;
        return full >= 2;
      }
      case 'DINNER': return hurt >= 2 && G.players.some((q) => q !== p && q.maxhp - q.hp >= 2);
      case 'SEAGULLS': return Math.random() < 0.25;
      case 'HOLYNIGHT': return true;
      case 'LITTLEWAR': return OJ.CHARS[p.charId].atk >= 1;
      case 'ALLOUTMODE': return OJ.CHARS[p.charId].atk >= 1;
      case 'SEALEDGUARDIAN': return false;
      case 'OUTOFAMMO': return false;
      case 'OHMYFRIEND': return false;
      case 'WARUDA': return Object.values(G.traps).some((t) => t.setter === p.idx);
      case 'FLIPOUT': return p.stars <= 5;
      case 'NICEJINGLE': return p.stars <= 10;
      default:
        if (c.type === 'Trap') {
          const cur = G.board.panels[p.pos];
          const plain = ['neutral', 'bonus', 'draw'].includes(cur.type) && !G.traps[p.pos];
          return plain && Math.random() < 0.5;
        }
        return false;
    }
  }

  function pickTarget(G, p, cardId, targets) {
    switch (cardId) {
      case 'HYPER_MARC': {
        const kill = targets.filter((t) => t.hp <= p.level);
        if (kill.length) return kill.sort((a, b) => b.stars - a.stars)[0];
        return targets.sort((a, b) => a.hp - b.hp)[0];
      }
      case 'HYPER_POPPO':
        return targets.sort((a, b) => Math.min(a.stars, a.level * 10) - Math.min(b.stars, b.level * 10)).reverse()[0];
      case 'LONGSHOT':
        return targets.sort((a, b) => a.hp - b.hp)[0];
      default:
        return targets.sort((a, b) => b.stars - a.stars)[0];
    }
  }

  const BATTLE_CARDS_ATTACK = ['HYPER_QP', 'BIGMAGNUM', 'ONFIRE', 'FINALBATTLE', 'HYPER_PEAT'];
  const BATTLE_CARDS_DEFEND = ['RBITS', 'RAINBOW', 'SHIELD', 'REVERSE', 'HYPER_QP', 'HYPER_PEAT'];

  function wantBattleCard(G, p, ctx, role) {
    if (p.isMobUnit) return null;
    const list = role === 'attacker' ? BATTLE_CARDS_ATTACK : BATTLE_CARDS_DEFEND;
    for (const cid of list) {
      if (!p.hand.includes(cid)) continue;
      if (!E().playableInBattle(G, p, cid, role)) continue; // timing/role/cost/level gate
      const c = C()[cid];
      if (cid === 'HYPER_QP' && role === 'attacker') return cid;
      if (cid === 'HYPER_QP' && role === 'defender' && p.hp <= 2) return cid;
      if (cid === 'BIGMAGNUM' && p.hp >= 3) return cid;
      if (cid === 'ONFIRE' && p.hp >= 3) return cid;
      if (cid === 'FINALBATTLE' && role === 'attacker' && p.hp >= p.maxhp - 1) return cid;
      if (cid === 'RBITS') return cid;
      if (cid === 'RAINBOW') return cid;
      if (cid === 'SHIELD' && role === 'defender') return cid;
      if (cid === 'REVERSE') return cid;
      if (cid === 'HYPER_PEAT' && p.hand.length >= 2) return cid;
    }
    return null;
  }

  function chooseDefend(G, p, ctx, atkTotal) {
    const evd = E().effStat(G, p, 'evd', ctx);
    const def = E().effStat(G, p, 'def', ctx);
    if ((ctx.noEvade || {})[p.idx]) return 'defend';
    const expDefDmg = Math.max(1, atkTotal - (def + 3.5));
    const dodgeChance = evd >= atkTotal ? 1 : Math.max(0, (evd + 6 - atkTotal) / 6);
    const expEvdDmg = (1 - dodgeChance) * atkTotal;
    const lethalDef = expDefDmg >= p.hp;
    const lethalEvd = atkTotal >= p.hp;
    if (lethalDef && !lethalEvd) return 'evade';
    if (expEvdDmg < expDefDmg) return 'evade';
    return 'defend';
  }

  function shopPick(G, p, offers) {
    const likes = ['PUDDING', 'COOKIE', 'RBITS', 'BIGMAGNUM', 'NICEPRESENT', 'DASH', 'SHIELD', 'RAINBOW'];
    for (const cid of offers) {
      const cost = E().cardCost(cid, p) + 5;
      if (likes.includes(cid) && p.stars - cost >= 0 && p.hand.length < OJ.CHARS[p.charId].maxHand) return cid;
    }
    return null;
  }

  function cpuPromptSwap(G, p, newCard) {
    // hand full: take the new card if it is at least as valuable as the worst
    // card in hand (discarding that); otherwise decline the new card
    const score = (cid) => {
      const c = C()[cid];
      if (c.hyper) return 100;
      if (cid === 'PUDDING' || cid === 'COOKIE' || cid === 'EXTEND') return 50;
      if (c.type === 'Battle' && OJ.CHARS[p.charId].atk >= 1) return 40;
      if (c.type === 'Trap') return 10;
      return 20;
    };
    let worst = p.hand[0], worstScore = Infinity;
    for (const cid of p.hand) {
      const s = score(cid);
      if (s < worstScore) { worstScore = s; worst = cid; }
    }
    if (score(newCard) < worstScore) return null; // decline the new card
    return worst;
  }

  function cpuIO(logFn) {
    const io = {
      async onStart(G) { if (logFn) logFn('Game start'); },
      async log(msg) { if (logFn) logFn(msg); },
      async onTurnStart() {}, async onTurnEnd() {}, async onRoll() {},
      async onPanel() {}, async onDamage() {}, async onKO() {}, async onNorma() {},
      async onRevive() {}, async onUseCard() {}, async onTeleport() {},
      async onBattleStart() {}, async onBattleRoll() {}, async onBattleEnd() {},
      async onBattlePhase() {}, async onBattleBuff() {}, async onBossEvent() {},
      async animateMove() {},
      async promptDirection(G, p, options) { return bestDirection(G, p, options); },
      async promptStopHome(G, p) { return shouldStopHome(G, p); },
      async promptChallenge(G, p, foe) { return shouldChallenge(G, p, foe); },
      async promptNorma(G, p, opts, si) { return chooseNorma(G, p, opts, si); },
      async promptCardPlay(G, p) {
        for (const cid of PREMOVE_PRIORITY) {
          if (wantPlayCard(G, p, cid)) return cid;
        }
        return null;
      },
      async promptCardTarget(G, p, cardId, targets) { return pickTarget(G, p, cardId, targets); },
      async promptRoll() {}, // CPU always rolls automatically
      async promptRecoveryRoll() {}, // CPU rolls recovery automatically
      async onRecoveryRoll() {},
      async promptBattleCard(G, p, ctx, role) { return wantBattleCard(G, p, ctx, role); },
      async promptDefend(G, p, ctx, atkTotal) { return chooseDefend(G, p, ctx, atkTotal); },
      async promptSwap(G, p, newCard) { return cpuPromptSwap(G, p, newCard); },
      async promptShop(G, p, offers) { return shopPick(G, p, offers); },
      async onEnd(G, winner) { if (logFn) logFn(winner ? `Winner: ${winner.name}` : 'Draw'); },
    };
    return io;
  }

  OJ.ai = {
    cpuIO, bestDirection, shouldStopHome, shouldChallenge, chooseNorma, wantPlayCard,
    pickTarget, wantBattleCard, chooseDefend, shopPick, panelWeight, cpuPromptSwap,
  };
})();
