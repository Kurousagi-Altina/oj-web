/* 100% OJ web replica - game engine
   Rules verified against the official wiki:
   - Battle (wiki/Battle): cards once at battle start; attacker rolls; defender
     sees roll then Defends (min 1 dmg) or Evades (dodge if EVD > ATK);
     roles reverse; Little War / Final Battle loop rounds.
   - KO & Recovery (wiki/Recovery): player KO = 2 wins + half stars to winner;
     wild KO = 1 win; boss KO = 3 wins; card KO = no reward; KO by wild/boss:
     lost stars join the reward pool. Recovery = roll >= requirement (starts at
     REC, -1 per failed chapter, auto at 1), revive full HP.
   - Norma (wiki/Norma): norma check on ANY home panel; stop prompt only at
     own home; chapter start stars = floor(chapter/5)+1.
   - Panels (wiki/Panels): Move = roll again (max 5 extra rolls), Warp
     teleports, Home heals 1, Heal heals 1, bonus/drop = roll x level.
*/
(function () {
  'use strict';
  const OJ = (globalThis.OJ = globalThis.OJ || {});
  const C = () => OJ.CARDS;
  const L = () => OJ.L;

  function d6(rng) { return 1 + Math.floor((rng || Math.random)() * 6); }
  function rollDice(n, rng, G) {
    // Extraordinary Specs (Sora hyper): force 6s for that chapter
    const spec = !!(G && G.global && G.global.specs);
    const dice = [];
    for (let i = 0; i < Math.min(4, n); i++) dice.push(spec ? 6 : d6(rng)); // dice cap 4
    return dice;
  }
  function shuffle(a, rng) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor((rng || Math.random)() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function cardCost(cardId, p) {
    const c = C()[cardId];
    if (c.dynamicCost === 'level10') return p.level * 10;
    return c.cost;
  }
  function canPay(p, cardId) { return p.stars >= cardCost(cardId, p); }
  function levelOk(p, cardId) { return p.level >= C()[cardId].lvl; }

  function baseUsable(G, p, cardId) {
    const c = C()[cardId];
    if (!c) return false;
    if (G.global.outOfAmmo > 0 && c.type !== 'Hyper') return false;
    if (!levelOk(p, cardId)) return false;
    if (!canPay(p, cardId)) return false;
    if (cardId === 'PRINCESS') {
      if (!(p.hand.length === 1 || p.hand.length >= 3)) return false;
    }
    if (cardId === 'BIGMAGNUM' && p.hp <= 1) return false;
    if (cardId === 'TOYSTORE' && p.stars >= 50) return false;
    return true;
  }

  // ---- usage timing (wiki/Battle & card types) ----
  // Battle-type cards AND battle Hypers (Hyper Mode, Blue Crow) are only
  // playable at battle start; everything else only during your own turn.
  function isBattleTiming(cardId) {
    const c = C()[cardId];
    return !!(c && c.battle);
  }
  function playableOnField(G, p, cardId) {
    return !isBattleTiming(cardId) && baseUsable(G, p, cardId);
  }
  function playableInBattle(G, p, cardId, role) {
    const c = C()[cardId];
    if (!c || !c.battle) return false;
    if (c.defenderOnly && role !== 'defender') return false;
    return baseUsable(G, p, cardId);
  }

  // ---------------- game construction ----------------
  function newGame(opts) {
    opts = Object.assign({ rng: Math.random, charIds: null, p0cpu: false, boardId: 'clover' }, opts);
    // copy the board so each game is isolated (tests mutate panels/next)
    const board = JSON.parse(JSON.stringify(OJ.BOARDS[opts.boardId] || OJ.BOARDS.clover));
    const charIds = opts.charIds || shuffle(Object.keys(OJ.CHARS).slice(), opts.rng);
    const playerIds = Array.from({ length: 4 }, (_, i) => charIds[i % charIds.length]);
    const centerDeck = buildCenterDeck(playerIds, opts.rng);
    const players = [];
    for (let i = 0; i < 4; i++) {
      const cid = charIds[i % charIds.length];
      const ch = OJ.CHARS[cid];
      players.push({
        idx: i, charId: cid, name: OJ.charName(cid), isCPU: i === 0 ? !!opts.p0cpu : true,
        hp: ch.hp, maxhp: ch.hp, stars: 0, wins: 0, level: 1,
        pos: board.homes[i], homeId: board.homes[i], prevPos: board.homes[i],
        hand: [drawCenterCard(centerDeck, cid)], // 1 starting card (wiki/Card Mechanics)
        ko: false, reviveReq: 0,
        eff: {}, stock: [], normaPick: 'stars', // Lv1 objective: 10 stars
      });
    }
    return {
      board, boardId: opts.boardId, players, chapter: 1, turnIdx: 0, rng: opts.rng,
      traps: {}, bossActive: false, bossDefeated: false,
      centerDeck, centerDiscard: [],
      global: { outOfAmmo: 0, littleWar: 0, miracle: false, backtrack: false, sprint: false, specs: false },
      winner: null, logs: [],
    };
  }

  // wiki/Card Mechanics: all players' packs merge into ONE 48-card Center
  // Deck that everyone draws from. Hypers are packed as blanks — whoever
  // draws one gets THEIR OWN hyper (guarantees hyper density in the pool).
  function buildCenterDeck(charIds, rng) {
    const cards = [];
    for (const cid of charIds) {
      cards.push('HYPER', 'HYPER'); // blank hyper markers
      const pool = [];
      for (const [id, w] of OJ.DECK_POOL) for (let i = 0; i < w; i++) pool.push(id);
      for (let i = 0; i < 10; i++) cards.push(pool[Math.floor(rng() * pool.length)]);
    }
    return shuffle(cards, rng);
  }

  function isHyperCard(cardId) {
    if (cardId === 'HYPER') return true;
    const c = C()[cardId];
    return !!(c && c.type === 'Hyper');
  }

  function drawCenterCard(deck, charId) {
    let card = deck.pop();
    if (isHyperCard(card)) card = OJ.CHARS[charId].hyper;
    return card;
  }

  async function draw(G, io, p, n) {
    for (let i = 0; i < n; i++) {
      if (G.centerDeck.length === 0) {
        if (G.centerDiscard.length === 0) return;
        G.centerDeck = shuffle(G.centerDiscard.splice(0), G.rng);
      }
      const card = drawCenterCard(G.centerDeck, p.charId);
      const max = OJ.CHARS[p.charId].maxHand;
      if (p.hand.length >= max) {
        // hand full: the drawn card replaces one chosen from hand (wiki rule),
        // or the player may decline the new card entirely (keep the hand)
        const discardId = await io.promptSwap(G, p, card);
        if (discardId === null) {
          G.centerDiscard.push(card);
          await io.log(L()(`${p.name} 拒绝了 ${OJ.t(card, 'name')}。`, `${p.name} declines ${OJ.t(card, 'name')}.`));
        } else {
          const idx = p.hand.indexOf(discardId);
          if (idx >= 0) {
            const old = p.hand.splice(idx, 1)[0];
            G.centerDiscard.push(old);
          }
          p.hand.push(card);
        }
      } else {
        p.hand.push(card);
      }
    }
  }

  function otherPlayers(G, p) { return G.players.filter((q) => q !== p); }
  function panelAt(G, id) { return G.board.panels[id]; }
  function homeOwner(G, panelId) {
    const i = G.board.homes.indexOf(panelId);
    return i;
  }

  function bfsDist(G, from) {
    const dist = new Array(G.board.panels.length).fill(Infinity);
    dist[from] = 0;
    const q = [from];
    while (q.length) {
      const cur = q.shift();
      for (const nx of panelAt(G, cur).next) {
        if (dist[nx] === Infinity) { dist[nx] = dist[cur] + 1; q.push(nx); }
      }
    }
    return dist;
  }

  function reverseAdj(G) {
    const rev = G.board.panels.map(() => []);
    for (const p of G.board.panels) for (const n of p.next) rev[n].push(p.id);
    return rev;
  }

  // effective panel type (miracle transform + boss event)
  function effType(G, panel) {
    let t = panel.type;
    if (G.global.miracle && ['bonus', 'drop', 'draw', 'move', 'encounter', 'heal', 'damage'].includes(t)) t += '2';
    if (G.bossActive && t === 'encounter') t = 'boss';
    return t;
  }

  function makeMob(G, kind) {
    const m = OJ.MOBS[kind];
    return {
      idx: -1, charId: null, name: OJ.mobName(kind), isCPU: true, isMobUnit: true,
      hp: m.hp, maxhp: m.hp, stars: 0, wins: 0, level: 1,
      hand: [], deck: [], discard: [], ko: false, eff: {}, stock: [],
      mobKind: kind, mobBoss: !!m.boss, bossRevived: false,
    };
  }

  // wild units & the boss are persistent: HP carries over between battles
  // until they are actually defeated (then a fresh one appears later)
  function getWild(G, kind) {
    if (!G.wilds) G.wilds = {};
    let m = G.wilds[kind];
    if (!m || m.ko) { m = makeMob(G, kind); G.wilds[kind] = m; }
    return m;
  }

  function getBoss(G) {
    if (!G.bossUnit) G.bossUnit = makeMob(G, G.board.boss || 'shifu');
    return G.bossUnit;
  }

  // ---------------- battle ----------------
  function effStat(G, p, stat, ctx) {
    // mobs & bosses use their own stat line (OJ.MOBS), players their character's
    let v;
    if (p.isMobUnit && OJ.MOBS[p.mobKind]) v = OJ.MOBS[p.mobKind][stat];
    else v = OJ.CHARS[p.charId] ? OJ.CHARS[p.charId][stat] : 0;
    const e = ctx && ctx.buffs ? (ctx.buffs[p.idx] || null) : null;
    if (e) v += e[stat] || 0;
    if (stat === 'evd' && p.eff.bound > 0) v -= 2;
    if (ctx && ctx.reverse) v = -v;
    return v;
  }

  function diceCount(G, p) { return p.eff.accel > 0 ? 2 : 1; }

  async function battle(G, io, attacker, defender, opts) {
    opts = opts || {};
    const ctx = {
      buffs: G.players.map(() => ({ atk: 0, def: 0, evd: 0 })),
      buffTags: G.players.map(() => []),
      reverse: false, noEvade: {}, noAttack: {}, rounds: 0,
      finalBattle: false, hyperMode: {}, kaiUsed: false,
    };
    for (const pl of [attacker, defender]) {
      if (pl.stock.includes('HEAT300')) {
        ctx.buffs[pl.idx].def -= 2;
        ctx.buffTags[pl.idx].push('Heat 300%');
        pl.stock.splice(pl.stock.indexOf('HEAT300'), 1);
      }
      if (pl.stock.includes('ALLOUTMODE')) {
        ctx.buffs[pl.idx].atk += 2;
        ctx.buffTags[pl.idx].push('All-Out');
        pl.stock.splice(pl.stock.indexOf('ALLOUTMODE'), 1);
      }
    }
    await io.onBattleStart(G, attacker, defender, opts);

    // ---- battle card phase: ONCE at battle start (wiki/Battle) ----
    await io.onBattlePhase(G, 'attackCards', { ctx });
    if (!attacker.isMobUnit) {
      const pa = await io.promptBattleCard(G, attacker, ctx, 'attacker');
      if (pa) await applyBattleCard(G, io, ctx, attacker, pa, 'attacker');
    }
    await io.onBattlePhase(G, 'defendCards', { ctx });
    if (!defender.isMobUnit) {
      const pd = await io.promptBattleCard(G, defender, ctx, 'defender');
      if (pd) await applyBattleCard(G, io, ctx, defender, pd, 'defender');
    }

    // Kai's Protagonist's Privilege (wiki/Kai Hyper): if the unit that
    // attacks first has the effect, the opposing unit skips its attack —
    // only in the FIRST round of combat (Little War note on the wiki)
    let skipCounter = false;
    if (!opts.noKai && attacker.eff.kai > 0) {
      skipCounter = true;
      await io.log(L()(`主角光环发动！${defender.name} 第一回合无法反击！`, `Protagonist's Privilege! ${defender.name} skips the first counter!`));
    }

    const cap = () => (ctx.finalBattle ? 10 : (G.global.littleWar > 0 ? 2 : 1));
    while (!attacker.ko && !defender.ko && ctx.rounds < cap()) {
      ctx.rounds++;
      await io.onBattlePhase(G, 'round', { n: ctx.rounds, ctx });
      const r1 = await strike(G, io, ctx, attacker, defender, opts);
      if (r1) break;
      const skipThisRound = skipCounter;
      skipCounter = false; // privilege covers the first round only
      if (!skipThisRound && !ctx.noAttack[defender.idx] && !defender.ko) {
        await io.onBattlePhase(G, 'counter', { ctx });
        const r2 = await strike(G, io, ctx, defender, attacker, opts);
        if (r2) break;
      }
      ctx.noAttack[defender.idx] = false;
    }
    const result = {
      winner: attacker.ko ? defender : (defender.ko ? attacker : null),
      loser: attacker.ko ? attacker : (defender.ko ? defender : null),
    };
    await io.onBattleEnd(G, result.winner, result.loser, ctx, opts);
    return result;
  }

  async function strike(G, io, ctx, src, dst, opts) {
    const dice = rollDice(diceCount(G, src), G.rng, G);
    const atkTotal = Math.max(1, dice.reduce((a, b) => a + b, 0) + effStat(G, src, 'atk', ctx));
    await io.onBattleRoll(G, src, dst, { kind: 'attack', dice, total: atkTotal, ctx });
    let choice = 'defend';
    if (dst.isMobUnit) {
      choice = effStat(G, dst, 'evd', ctx) > effStat(G, dst, 'def', ctx) ? 'evade' : 'defend';
    } else {
      choice = await io.promptDefend(G, dst, ctx, atkTotal, dice);
    }
    let dmg = 0;
    let defDice = [], defTotal = 0;
    if (choice === 'evade' && !(ctx.noEvade || {})[dst.idx]) {
      defDice = rollDice(diceCount(G, dst), G.rng, G);
      defTotal = Math.max(1, defDice.reduce((a, b) => a + b, 0) + effStat(G, dst, 'evd', ctx));
      dmg = atkTotal >= defTotal ? Math.max(1, atkTotal) : 0;
    } else {
      defDice = rollDice(diceCount(G, dst), G.rng, G);
      defTotal = Math.max(1, defDice.reduce((a, b) => a + b, 0) + effStat(G, dst, 'def', ctx));
      dmg = Math.max(1, atkTotal - defTotal);
    }
    await io.onBattleRoll(G, dst, src, { kind: choice, dice: defDice, total: defTotal, dmg, atkTotal, ctx });
    if (dmg > 0) {
      dst.hp = Math.max(0, dst.hp - dmg);
      await io.onDamage(G, dst, dmg, ctx);
      if (dst.hp <= 0) {
        await koUnit(G, io, dst, src, ctx, opts);
        return true;
      }
    }
    return false;
  }

  async function applyBattleCard(G, io, ctx, p, cardId, role) {
    if (!playableInBattle(G, p, cardId, role || 'attacker')) return false; // wrong timing/role — no effect
    const idx = p.hand.indexOf(cardId);
    if (idx >= 0) p.hand.splice(idx, 1);
    G.centerDiscard.push(cardId);
    await io.log(L()(`${p.name} 使用了 ${OJ.t(cardId, 'name')}！`, `${p.name} uses ${C()[cardId].name}!`));
    await io.onUseCard(G, p, cardId);
    await io.onBattleBuff(G, p, cardId, ctx);
    switch (cardId) {
      case 'BIGMAGNUM': p.hp -= 1; ctx.buffs[p.idx].atk += 2; ctx.buffTags[p.idx].push('Magnum'); break;
      case 'ONFIRE': ctx.buffs[p.idx].atk += 1; ctx.buffs[p.idx].def -= 1; ctx.buffTags[p.idx].push('On Fire'); break;
      case 'RAINBOW': ctx.buffs[p.idx].evd += 2; ctx.buffs[p.idx].def -= 1; ctx.buffTags[p.idx].push('Rainbow'); break;
      case 'RBITS': ctx.buffs[p.idx].def += 2; ctx.noEvade[p.idx] = true; ctx.buffTags[p.idx].push('Rbits'); break;
      case 'SHIELD': ctx.buffs[p.idx].def += 3; ctx.noAttack[p.idx] = true; ctx.buffTags[p.idx].push('Shield'); break;
      case 'REVERSE': ctx.reverse = true; ctx.buffTags[p.idx].push('Reverse'); break;
      case 'FINALBATTLE': ctx.finalBattle = true; ctx.buffTags[p.idx].push('Final'); break;
      case 'HYPER_QP': ctx.buffs[p.idx].atk += 3; ctx.hyperMode[p.idx] = true; ctx.buffTags[p.idx].push('Hyper Mode'); break;
      case 'HYPER_PEAT': {
        const n = p.hand.length; // gain ATK/DEF, lose EVD = cards in hand
        ctx.buffs[p.idx].atk += n;
        ctx.buffs[p.idx].def += n;
        ctx.buffs[p.idx].evd -= n;
        ctx.buffTags[p.idx].push('Blue Crow x' + n);
        break;
      }
      default: break;
    }
  }

  // who: the unit credited with the KO (may be null for non-battle KOs)
  async function koUnit(G, io, victim, who, ctx, opts) {
    opts = opts || {};
    victim.ko = true;
    const hyperSaved = ctx && ctx.hyperMode ? ctx.hyperMode[victim.idx] : false;

    if (victim.isMobUnit) {
      // ---- wild unit / boss defeated ----
      // defeated wild/boss leaves its pool (boss: boss state ends entirely)
      if (G.wilds && G.wilds[victim.mobKind] === victim) delete G.wilds[victim.mobKind];
      if (G.bossUnit === victim) G.bossUnit = null;
      if (who && !who.isMobUnit) {
        const wins = victim.mobBoss ? 3 : ((opts.winMult || 1) * 1); // boss 3, encounter 1 (x2 panel: 2)
        // reward = the wild/boss's accumulated pool (half-stars from KOs,
        // wiki/Recovery) — no flat bonus
        const gain = victim.stars;
        who.stars += gain;
        victim.stars = 0;
        who.wins += wins;
        await io.log(L()(
          `${who.name} 讨伐了 ${victim.name}！+${wins} WIN，+${gain} 星星！`,
          `${who.name} defeated ${victim.name}! +${wins} Win, +${gain} stars!`));
        if (victim.mobBoss) {
          G.bossActive = false; G.bossDefeated = true;
          await io.log(L()('Boss 已被讨伐！遭遇格恢复正常。', 'The boss is slain! Encounter panels return to normal.'));
          await io.onBossEvent(G);
        }
      }
      await io.onKO(G, victim, who, 0);
      return;
    }

    // ---- player KO'd ----
    if (hyperSaved) {
      victim.reviveReq = 1;
      await io.log(L()(`${victim.name} 被击倒，但 Hyper Mode 保护了她！`, `${victim.name} is KO'd, but Hyper Mode protects them!`));
      await io.onKO(G, victim, who, 0);
      return;
    }
    let lost = 0;
    // Tomomo's Magical Massacre can lower the next revive requirement (one-time)
    const setReviveReq = (v) => {
      v.reviveReq = Math.max(1, OJ.CHARS[v.charId].rec + (v.eff.recMod || 0));
      if (v.eff.recMod) v.eff.recMod = 0;
    };
    if (opts.noReward) {
      // KO by card effect / panel: no stars or wins change (wiki/Recovery)
      setReviveReq(victim);
      await io.log(L()(`${victim.name} 被击倒！`, `${victim.name} is KO'd!`));
    } else if (who && !who.isMobUnit) {
      // KO by player: 2 wins + half stars (wiki/Battle)
      lost = Math.floor(victim.stars / 2);
      victim.stars -= lost;
      who.stars += lost;
      who.wins += 2;
      setReviveReq(victim);
      await io.log(L()(`${who.name} 击倒了 ${victim.name}！+2 WIN，+${lost} 星星。`, `${who.name} KO'd ${victim.name}! +2 Win, +${lost} stars.`));
    } else if (who && who.isMobUnit) {
      // KO by wild/boss: half stars join the reward pool
      lost = Math.floor(victim.stars / 2);
      victim.stars -= lost;
      who.stars += lost;
      setReviveReq(victim);
      await io.log(L()(`${victim.name} 被 ${who.name} 击倒！${lost} 星星加入了奖励池……`, `${victim.name} is KO'd by ${who.name}! ${lost} stars join the reward pool...`));
    } else {
      setReviveReq(victim);
      await io.log(L()(`${victim.name} 被击倒！`, `${victim.name} is KO'd!`));
    }
    if (victim.stock.includes('EXTEND')) {
      victim.stock.splice(victim.stock.indexOf('EXTEND'), 1);
      victim.reviveReq = 1;
      await io.log(L()(`${victim.name} 的残机奖励发动！下回合自动复活。`, `Extend activates for ${victim.name}!`));
    }
    await io.onKO(G, victim, who, lost);
  }

  // ---------------- traps ----------------
  function setTrap(G, panelId, cardId, setter) {
    G.traps[panelId] = { card: cardId, setter: setter.idx, setChapter: G.chapter };
  }

  async function triggerTrap(G, io, p, panelId, state) {
    const t = G.traps[panelId];
    if (!t || t.setter === p.idx) return false;
    const setter = G.players[t.setter];
    const cardId = t.card;
    delete G.traps[panelId];
    G.centerDiscard.push(cardId);
    await io.log(L()(`${p.name} 踩中了 ${OJ.t(cardId, 'name')}（${setter.name} 设置）！`, `${p.name} steps on ${C()[cardId].name} (by ${setter.name})!`));
    switch (cardId) {
      case 'MIMYUU':
        p.hp = Math.max(0, p.hp - 1);
        await io.onDamage(G, p, 1);
        if (p.hp <= 0) await koUnit(G, io, p, null, { hyperMode: {} }, { noReward: true });
        return true;
      case 'GOAWAY': {
        const dest = G.board.panels[Math.floor(G.rng() * G.board.panels.length)].id;
        p.pos = dest;
        await io.log(L()(`${p.name} 被传送到随机格子！`, `${p.name} is moved to a random panel!`));
        await io.onTeleport(G, p);
        return false;
      }
      case 'HEAT300': p.stock.push('HEAT300'); return false;
      case 'PIGGYBANK': {
        const gain = 5 * (G.chapter - t.setChapter);
        setter.stars += gain;
        await io.log(L()(`${setter.name} 从存钱罐获得 ${gain} 星星！`, `${setter.name} gains ${gain} stars from Piggy Bank!`));
        return false;
      }
      case 'TOYSTORE': {
        const lost = Math.floor(p.stars / 2);
        p.stars -= lost; setter.stars += lost;
        await io.log(L()(`${p.name} 失去 ${lost} 星星，被 ${setter.name} 获得了！`, `${p.name} loses ${lost} stars to ${setter.name}!`));
        return false;
      }
      case 'PURES': {
        const lost = Math.floor(p.stars / 2);
        p.stars -= lost;
        p.hp = p.maxhp;
        await io.log(L()(`${p.name} 失去 ${lost} 星星，但完全恢复了！`, `${p.name} loses ${lost} stars but fully recovers!`));
        return false;
      }
      case 'TRAGEDY': {
        if (p.hand.length) {
          const i = Math.floor(G.rng() * p.hand.length);
          const c = p.hand.splice(i, 1)[0];
          setter.hand.length < OJ.CHARS[setter.charId].maxHand
            ? setter.hand.push(c) : G.centerDiscard.push(c);
          await io.log(L()(`${p.name} 的 ${OJ.t(c, 'name')} 被抢走了！`, `${p.name}'s ${C()[c].name} is stolen!`));
        }
        return false;
      }
      case 'DANGEROUSPUDDING':
        p.skipTurns = (p.skipTurns || 0) + 1;
        await io.log(L()(`${p.name} 的下回合将被跳过！`, `${p.name}'s next turn will be skipped!`));
        return false;
      case 'BADPUDDING': {
        if (p.hand.length) {
          const i = Math.floor(G.rng() * p.hand.length);
          const c = p.hand.splice(i, 1)[0];
          G.centerDiscard.push(c);
          await io.log(L()(`${p.name} 丢弃了 ${OJ.t(c, 'name')}！`, `${p.name} discards ${C()[c].name}!`));
        }
        return false;
      }
      case 'ASSAULT':
        await io.log(L()(`${p.name} 被迫与 ${setter.name} 战斗！`, `${p.name} is forced to battle ${setter.name}!`));
        await battle(G, io, setter, p, {});
        return true;
      case 'INVASION': {
        await io.log(L()(`敌人从阴影中袭来！`, `An enemy attacks from the shadows!`));
        const kinds = ['chicken', 'roboball', 'seagull'];
        const mob = getWild(G, kinds[Math.floor(G.rng() * kinds.length)]);
        await battle(G, io, mob, p, { mob: true });
        return true;
      }
      default: return false;
    }
  }

  // ---------------- norma ----------------
  // wiki/Norma: on leveling up the player CHOOSES their next norma objective
  // (stars or wins). Only the chosen objective can level them up afterwards.
  // Lv1 starts with the star objective (10 stars).
  function normaReq(G, p) {
    if (p.level >= 6) return null;
    const si = p.level - 1; // requirement index for the CURRENT objective
    if (p.normaPick === 'wins') {
      // win objectives exist from the Lv2->3 step onward; Lv1 is always stars
      return { kind: 'wins', need: OJ.WIN_NORMA[Math.max(0, si - 1)] };
    }
    return { kind: 'stars', need: OJ.STAR_NORMA[si] };
  }

  function normaMet(G, p) {
    const req = normaReq(G, p);
    if (!req) return false;
    return req.kind === 'stars' ? p.stars >= req.need : p.wins >= req.need;
  }

  // legacy helper kept for AI/tests: what the player may level up with NOW
  function normaOptions(G, p) {
    return normaMet(G, p) ? [normaReq(G, p).kind] : [];
  }

  async function normaCheck(G, io, p) {
    if (!normaMet(G, p)) return false;
    p.level++;
    await io.log(L()(`NORMA 达成！${p.name} 升到 Lv${p.level}！`, `NORMA CLEAR! ${p.name} is now Lv${p.level}!`));
    await io.onNorma(G, p);
    if (p.level >= 6) {
      G.winner = p;
      await io.log(L()(`${p.name} 获得胜利！！`, `${p.name} wins the game!`));
      return true;
    }
    // immediately choose the objective for the NEXT level (wiki/Norma)
    const si = p.level - 1;
    const opts = ['stars'];
    if (p.level >= 2) opts.push('wins'); // win norma first exists for Lv2->3
    const pick = await io.promptNorma(G, p, opts, si);
    p.normaPick = pick || 'stars';
    const req = normaReq(G, p);
    await io.log(L()(
      `${p.name} 的下一个目标：${req.kind === 'stars' ? req.need + ' 星星' : req.need + ' 击杀'}`,
      `${p.name}'s next objective: ${req.need} ${req.kind}`));
    if (io.onNormaPick) await io.onNormaPick(G, p, p.normaPick);
    if (p.level >= 4 && !G.bossDefeated && !G.bossActive) {
      G.bossActive = true;
      await io.log(L()(`⚠ 有人达到 Lv4，所有遭遇格变成了 Boss 格！`, `⚠ Lv4 reached — all Encounter panels are now Boss panels!`));
      await io.onBossEvent(G);
    }
    return true;
  }

  // ---------------- cards ----------------
  function cardTargets(G, p, cardId) {
    const c = C()[cardId];
    if (c.target === 'enemy') return otherPlayers(G, p).filter((q) => !q.ko);
    return null;
  }

  async function useCard(G, io, p, cardId, target) {
    const c = C()[cardId];
    // field timing only: battle cards used outside battle would fizzle here
    if (!c || !playableOnField(G, p, cardId)) return false;
    const i = p.hand.indexOf(cardId);
    if (i < 0) return false;
    p.stars -= cardCost(cardId, p);
    p.hand.splice(i, 1);
    await io.log(L()(`${p.name} 使用了 ${OJ.t(cardId, 'name')}！`, `${p.name} uses ${c.name}!`));
    await io.onUseCard(G, p, cardId);
    const consume = () => G.centerDiscard.push(cardId);

    switch (cardId) {
      case 'DASH': p.eff.dashThisTurn = true; consume(); break;
      case 'LONGSHOT':
        target.hp = Math.max(0, target.hp - 1);
        await io.onDamage(G, target, 1);
        if (target.hp <= 0) await koUnit(G, io, target, null, { hyperMode: {} }, { noReward: true });
        consume(); break;
      case 'NICEPRESENT': await draw(G, io, p, 2); consume(); break;
      case 'PRINCESS': {
        G.centerDiscard.push(...p.hand.splice(0));
        await draw(G, io, p, 3);
        consume(); break;
      }
      case 'PUDDING': p.hp = p.maxhp; consume(); break;
      case 'COOKIE': p.hp = Math.min(p.maxhp, p.hp + 1); consume(); break;
      case 'EXTEND': case 'FLIPOUT': case 'NICEJINGLE': case 'HEAT300': case 'ALLOUTMODE':
        p.stock.push(cardId);
        await io.log(L()(`变为储备效果。`, `Stocked as an effect.`));
        break;
      case 'ASSAULT': case 'GOAWAY': case 'MIMYUU': case 'PIGGYBANK':
      case 'TOYSTORE': case 'PURES': case 'TRAGEDY': case 'INVASION':
        setTrap(G, p.pos, cardId, p);
        await io.log(L()(`在面板上设置了陷阱。`, `A trap is set on the panel.`));
        break;
      case 'SEAGULLS': {
        const cands = G.players.filter((q) => !q.ko);
        const v = cands[Math.floor(G.rng() * cands.length)];
        v.hp = Math.max(0, v.hp - 2);
        await io.log(L()(`${v.name} 受到 2 点伤害！`, `${v.name} takes 2 damage!`));
        await io.onDamage(G, v, 2);
        if (v.hp <= 0) await koUnit(G, io, v, null, { hyperMode: {} }, { noReward: true });
        consume(); break;
      }
      case 'DINNER':
        for (const q of G.players) if (!q.ko) q.hp = Math.min(q.maxhp, q.hp + 3);
        await io.log(L()('所有单位恢复 3 HP！', 'Everyone recovers 3 HP!'));
        consume(); break;
      case 'FORCEDREVIVAL':
        for (const q of G.players) {
          if (q.ko) { q.ko = false; q.hp = 1; q.reviveReq = 0; } // revives in place
        }
        await io.log(L()('所有被击倒的单位以 1 HP 复活！', "All KO'd units revive with 1 HP!"));
        consume(); break;
      case 'HOLYNIGHT': G.global.holyNight = true; consume(); break;
      case 'LITTLEWAR': G.global.littleWar = 3; consume(); break;
      case 'OHMYFRIEND': {
        await io.log(L()('巨大的敌人出现了……！', 'A huge enemy appears...!'));
        if (!G.bossActive && !G.bossDefeated) {
          G.bossActive = true;
          await io.onBossEvent(G);
        }
        const mob = getBoss(G);
        await battle(G, io, p, mob, { mob: true });
        consume(); break;
      }
      case 'OUTOFAMMO': G.global.outOfAmmo = 1; consume(); break;
      case 'SEALEDGUARDIAN':
        for (const q of G.players) if (!q.ko) q.hp = 1;
        await io.log(L()('所有单位的 HP 变为 1！', "All units' HP drop to 1!"));
        consume(); break;
      case 'WARUDA': {
        const entries = Object.entries(G.traps);
        G.traps = {};
        for (const [, t] of entries) {
          const dest = G.board.panels[Math.floor(G.rng() * G.board.panels.length)].id;
          G.traps[dest] = t;
        }
        consume(); break;
      }
      case 'HYPER_SUGURI': p.eff.accel = 2; consume(); break;
      case 'HYPER_KAI': p.eff.kai = 4; consume(); break;
      case 'HYPER_MARC': {
        target.hp = Math.max(0, target.hp - p.level);
        await io.log(L()(`${target.name} 受到 ${p.level} 点伤害！`, `${target.name} takes ${p.level} damage!`));
        await io.onDamage(G, target, p.level);
        if (target.hp <= 0) {
          // rocket explicitly grants 2 wins (no star transfer)
          await koUnit(G, io, target, null, { hyperMode: {} }, { noReward: true });
          p.wins += 2;
          await io.log(L()(`${p.name} 的火箭击倒！+2 WIN！`, `${p.name}'s rocket KO! +2 Wins!`));
        }
        consume(); break;
      }
      case 'HYPER_ARU': {
        // wiki/Aru/Hyper: ALL players draw up to a full hand (full hands draw
        // 1 instead) — including the caster; user gains 10★ per card drawn.
        // The count happens after this card left the hand, so the caster
        // draws too (Aru's maxHand 4: solo play = +40★ minimum & a new hand).
        let total = 0;
        for (const q of G.players) {
          if (q.ko) continue;
          const max = OJ.CHARS[q.charId].maxHand;
          const n = q.hand.length >= max ? 1 : max - q.hand.length;
          await draw(G, io, q, n);
          total += n;
        }
        p.stars += 10 * total;
        await io.log(L()(`${p.name} 获得了 ${10 * total} 星星！`, `${p.name} gains ${10 * total} stars!`));
        consume(); break;
      }
      case 'HYPER_HIME': {
        p.stock.push('HYPER_HIME');
        await io.log(L()(`束缚之链将在回合结束时发动。`, `Binding Chains activate at the end of this turn.`));
        break;
      }
      case 'HYPER_YUKI': {
        // Gamble!: a randomly chosen unit (anyone, including yourself) is KO'd
        const v = G.players[Math.floor(G.rng() * G.players.length)];
        await io.log(L()(`赌博！${v.name} 被选中了……！`, `Gamble! ${v.name} is chosen...!`));
        await koUnit(G, io, v, null, { hyperMode: {} }, { noReward: true });
        consume(); break;
      }
      case 'HYPER_SORA': {
        // Extraordinary Specs: roll 6 for movement/battle/bonus/drop this chapter
        G.global.specs = true;
        await io.log(L()(`荒唐的性能！本章移动/战斗/奖励/掉落全部掷 6！`, `Extraordinary Specs! Roll 6 for movement, battle, bonus & drop this chapter!`));
        consume(); break;
      }
      case 'HYPER_PEAT': consume(); break; // battle card — handled in applyBattleCard
      case 'HYPER_TOMOMO': {
        // Magical Massacre: every unit at full HP (or higher) is KO'd
        let koCount = 0;
        for (const q of G.players.slice()) {
          if (q.hp >= q.maxhp) {
            await koUnit(G, io, q, null, { hyperMode: {} }, { noReward: true });
            if (q !== p) koCount++;
          }
        }
        if (koCount > 0) {
          p.eff.recMod = (p.eff.recMod || 0) - koCount;
          await io.log(L()(`杀戮魔法！${koCount} 名单位被击倒，${p.name} 下次复活需求 -${koCount}。`, `Magical Massacre! ${koCount} unit(s) KO'd, ${p.name}'s next REC -${koCount}.`));
        } else {
          await io.log(L()(`杀戮魔法！但没有满血单位……`, `Magical Massacre! No full-HP units...`));
        }
        consume(); break;
      }
      case 'HYPER_POPPO': {
        // Ubiquitous: warp to the target enemy's panel and steal 10x their level
        if (target) {
          p.prevPos = p.pos;
          p.pos = target.pos;
          await io.log(L()(`${p.name} 瞬移到 ${target.name} 的格子！`, `${p.name} warps to ${target.name}'s panel!`));
          await io.onTeleport(G, p);
          const steal = Math.min(target.stars, target.level * 10);
          target.stars -= steal;
          p.stars += steal;
          await io.log(L()(`${p.name} 偷走了 ${steal} 星星！`, `${p.name} steals ${steal} stars!`));
        }
        consume(); break;
      }
      default: consume();
    }
    return true;
  }

  async function resolveBindingChains(G, io, p) {
    const i = p.stock.indexOf('HYPER_HIME');
    if (i < 0) return;
    p.stock.splice(i, 1);
    G.centerDiscard.push('HYPER_HIME');
    for (const q of otherPlayers(G, p)) {
      q.skipTurns = (q.skipTurns || 0) + 1;
      if (!q.ko) q.eff.bound = Math.max(q.eff.bound || 0, 2);
    }
    await io.log(L()(`${p.name} 的束缚之链！其他所有单位将跳过下回合！`, `${p.name}'s Binding Chains! All others skip their next turn!`));
  }

  // ---------------- panel effects ----------------
  function moveDiceCount(G, p) {
    let n = p.eff.accel > 0 ? 2 : 1;
    if (G.global.sprint) n *= 2;
    return n;
  }

  function warpPanels(G) { return G.board.panels.filter((q) => q.type === 'warp'); }

  async function panelEffect(G, io, p, state) {
    const panel = panelAt(G, p.pos);
    const lvl = p.level;
    const t = effType(G, panel);
    switch (t) {
      case 'bonus': case 'bonus2': {
        const n = moveDiceCount(G, p) * (t === 'bonus2' ? 2 : 1);
        const dice = rollDice(n, G.rng, G);
        let stars = dice.reduce((a, b) => a + b, 0) * lvl;
        if (p.stock.includes('NICEJINGLE')) {
          p.stock.splice(p.stock.indexOf('NICEJINGLE'), 1);
          stars *= 2;
          await io.log(L()(`美妙的叮铃铃！星星变为 2 倍！`, `Nice Jingle doubles the stars!`));
        }
        p.stars += stars;
        await io.log(L()(`${p.name} 获得 ${stars} 星星！（奖励格）`, `${p.name} gains ${stars} stars! (Bonus)`));
        await io.onPanel(G, p, panel, stars, dice);
        break;
      }
      case 'drop': case 'drop2': {
        const n = moveDiceCount(G, p) * (t === 'drop2' ? 2 : 1);
        const dice = rollDice(n, G.rng, G);
        const stars = dice.reduce((a, b) => a + b, 0) * lvl;
        if (p.stock.includes('FLIPOUT')) {
          // official: player still loses the stars; richest other loses the same
          p.stock.splice(p.stock.indexOf('FLIPOUT'), 1);
          p.stars = Math.max(0, p.stars - stars);
          const others = G.players.filter((q) => q !== p);
          const maxStars = Math.max(...others.map((q) => q.stars));
          const rich = others.filter((q) => q.stars === maxStars && maxStars > 0);
          for (const q of rich) q.stars = Math.max(0, q.stars - stars);
          await io.log(L()(`迁怒于你！${p.name} 和 ${rich.map((q) => q.name).join('、')} 各失去 ${stars} 星星！`, `Flip Out! ${p.name} and ${rich.map((q) => q.name).join(', ')} lose ${stars} stars!`));
          await io.onPanel(G, p, panel, -stars, dice);
        } else {
          p.stars = Math.max(0, p.stars - stars);
          await io.log(L()(`${p.name} 失去 ${stars} 星星……（掉落格）`, `${p.name} loses ${stars} stars... (Drop)`));
          await io.onPanel(G, p, panel, -stars, dice);
        }
        break;
      }
      case 'draw': case 'draw2':
        await draw(G, io, p, t === 'draw2' ? 2 : 1);
        await io.log(L()(`${p.name} 抽了 ${t === 'draw2' ? 2 : 1} 张卡。`, `${p.name} draws ${t === 'draw2' ? 2 : 1} card(s).`));
        break;
      case 'encounter': case 'encounter2': {
        const kinds = ['chicken', 'roboball', 'seagull'];
        const mob = getWild(G, kinds[Math.floor(G.rng() * kinds.length)]);
        await io.log(L()(`遭遇了敌人！`, `An enemy appears!`));
        await battle(G, io, p, mob, { mob: true, winMult: t === 'encounter2' ? 2 : 1 });
        break;
      }
      case 'boss': {
        const mob = getBoss(G);
        await io.log(L()(`Boss 出现了！`, `The Boss appears!`));
        await battle(G, io, p, mob, { mob: true });
        break;
      }
      case 'move': case 'move2': {
        if (state.extraRolls >= 5) {
          await io.log(L()(`本回合的追加移动已达上限。`, `Move limit reached this turn.`));
          break;
        }
        const n = moveDiceCount(G, p) * (t === 'move2' ? 2 : 1);
        const dice = rollDice(n, G.rng, G);
        const r = dice.reduce((a, b) => a + b, 0);
        await io.log(L()(`移动格！${p.name} 再移动 ${r} 格！`, `Move panel! ${p.name} moves ${r} more!`));
        await io.onPanel(G, p, panel, 0, dice);
        state.extraRolls++;
        await move(G, io, p, r, state);
        // the panel finally landed on also triggers its effect
        // (recursion is bounded by the extraRolls cap of 5)
        if (!G.winner && !p.ko) {
          await panelEffect(G, io, p, state);
        }
        break;
      }
      case 'warp': {
        const ws = warpPanels(G).filter((q) => q.id !== p.pos);
        if (ws.length) {
          const dest = ws[Math.floor(G.rng() * ws.length)];
          p.pos = dest.id;
          await io.log(L()(`传送格！${p.name} 被传送到别的传送格。`, `Warp! ${p.name} teleports.`));
          await io.onTeleport(G, p);
        }
        break;
      }
      case 'heal': case 'heal2': {
        const n = t === 'heal2' ? 2 : 1;
        p.hp = Math.min(p.maxhp, p.hp + n);
        await io.log(L()(`${p.name} 恢复了 ${n} HP。`, `${p.name} recovers ${n} HP.`));
        break;
      }
      case 'damage': case 'damage2': {
        const n = t === 'damage2' ? 2 : 1;
        p.hp = Math.max(0, p.hp - n);
        await io.log(L()(`${p.name} 受到 ${n} 点伤害！`, `${p.name} takes ${n} damage!`));
        await io.onDamage(G, p, n);
        if (p.hp <= 0) await koUnit(G, io, p, null, { hyperMode: {} }, { noReward: true });
        break;
      }
      case 'home': {
        p.hp = Math.min(p.maxhp, p.hp + 1);
        const owner = homeOwner(G, p.pos);
        await io.log(L()(`${p.name} 停在了${owner === p.idx ? '自己' : (owner >= 0 ? 'P' + (owner + 1) + ' 的' : '')}家！（恢复 1 HP）`, `${p.name} is on a home panel! (Heal 1 HP)`));
        await normaCheck(G, io, p);
        break;
      }
      default: break;
    }
    if (!G.winner && !p.ko && G.traps[p.pos]) {
      await triggerTrap(G, io, p, p.pos, state);
    }
  }

  // ---------------- movement ----------------
  async function move(G, io, p, steps, state) {
    state = state || {};
    const rev = G.global.backtrack ? reverseAdj(G) : null;
    let remaining = steps;
    let stopped = false;
    while (remaining > 0 && !stopped && !G.winner && !p.ko) {
      const cur = panelAt(G, p.pos);
      const options = rev ? rev[cur.id] : cur.next.slice();
      if (!options.length) break;
      let nextId;
      if (options.length === 1) nextId = options[0];
      else nextId = await io.promptDirection(G, p, options);
      p.prevPos = p.pos;
      p.pos = nextId;
      remaining--;
      await io.animateMove(G, p, nextId, remaining);
      // traps (like warp) only trigger when the unit STOPS on the panel —
      // passing over does nothing; handled by panelEffect after the move ends
      // crossing an opponent: prompt challenge (wiki/Battle)
      if (!G.winner && !p.ko) {
        const foe = G.players.find((q) => q !== p && !q.ko && q.pos === p.pos);
        if (foe) {
          const challenge = await io.promptChallenge(G, p, foe);
          if (challenge) {
            await io.log(L()(`${p.name} 向 ${foe.name} 发起挑战！`, `${p.name} challenges ${foe.name}!`));
            await battle(G, io, p, foe, {});
            stopped = true;
            break;
          }
        }
      }
      // own home: may stop when passing
      if (homeOwner(G, p.pos) === p.idx && remaining > 0) {
        const stop = await io.promptStopHome(G, p, remaining);
        if (stop) { await io.log(L()(`${p.name} 在家停下了。`, `${p.name} stops at home.`)); stopped = true; }
      }
    }
  }

  // ---------------- field events ----------------
  async function runFieldEvents(G, io) {
    const defs = G.board.events || [];
    for (const ev of defs) {
      if (G.chapter % ev.every !== 0) continue;
      if (ev.id === 'miracle') {
        G.global.miracle = true;
        await io.log(L()(`✨ 奇迹！本章奖励/掉落/抽卡/移动/遭遇/恢复/伤害格全部双倍！`, `✨ Miracle! Panels are doubled this chapter!`));
      } else if (ev.id === 'backtrack') {
        G.global.backtrack = true;
        await io.log(L()(`↩ 逆行！本章所有单位反向移动！`, `↩ Backtrack! All units move in reverse this chapter!`));
      } else if (ev.id === 'randomwarp') {
        for (const p of G.players) {
          if (p.ko) continue;
          const dest = G.board.panels[Math.floor(G.rng() * G.board.panels.length)].id;
          p.pos = dest;
          await io.onTeleport(G, p);
        }
        await io.log(L()(`🌀 随机传送！所有单位被传送到随机格子！`, `🌀 Random Warp! All units are warped!`));
      }
    }
  }

  // ---------------- turn flow ----------------
  // chapter-start stars are awarded to EVERYONE at the big-round start
  // (before player 1 acts — wiki/Norma), including KO'd players
  async function awardChapterStars(G, io) {
    const bonus = Math.floor(G.chapter / 5) + 1 + (G.global.holyNight ? 1 : 0);
    for (const q of G.players) q.stars += bonus;
    await io.log(L()(`第 ${G.chapter} 章开始，全员 +${bonus} 星星`, `Chapter ${G.chapter}: everyone +${bonus} stars`));
  }

  async function playTurn(G, io) {
    const p = G.players[G.turnIdx];
    await io.onTurnStart(G, p);
    if (G.winner) return;

    // recovery roll (wiki/Recovery): the player rolls their own dice and
    // revives IN PLACE (the character stays on the panel they were KO'd on)
    if (p.ko) {
      await io.promptRecoveryRoll(G, p);
      const roll = d6(G.rng);
      await io.onRecoveryRoll(G, p, roll);
      await io.log(L()(`${p.name} 恢复检定：掷出 ${roll}，需要 ≥${p.reviveReq}`, `${p.name} recovery: rolled ${roll}, needs ${p.reviveReq}+`));
      if (roll >= p.reviveReq) {
        p.ko = false;
        p.hp = p.maxhp;
        p.reviveReq = 0;
        await io.log(L()(`${p.name} 复活了！`, `${p.name} recovers!`));
        await io.onRevive(G, p);
        await endTurn(G, io, p);
        return;
      }
      p.reviveReq = Math.max(1, p.reviveReq - 1);
      await endTurn(G, io, p);
      return;
    }

    if (p.skipTurns > 0) {
      p.skipTurns--;
      await io.log(L()(`${p.name} 的回合被跳过了！`, `${p.name}'s turn is skipped!`));
      await endTurn(G, io, p);
      return;
    }

    if (p.eff.accel > 0) p.eff.accel--;
    if (p.eff.kai > 0) p.eff.kai--;
    if (p.eff.bound > 0) p.eff.bound--;

    // Miracle field event: a card at the start of the turn (no regular
    // turn-start draw — cards normally come from Draw panels / effects)
    if (G.global.miracle) {
      await draw(G, io, p, 1);
      await io.log(L()(`✨ 奇迹！${p.name} 抽了 1 张卡。`, `✨ Miracle! ${p.name} draws a card.`));
    }

    // pre-move card play: ONE card per turn (battle cards are separate)
    let played = false;
    while (!played && !G.winner) {
      const cardId = await io.promptCardPlay(G, p);
      if (!cardId) break;
      let target = null;
      if (cardTargets(G, p, cardId)) {
        target = await io.promptCardTarget(G, p, cardId, cardTargets(G, p, cardId));
        if (!target) continue; // cancelled target -> choose again / move
      }
      const ok = await useCard(G, io, p, cardId, target);
      if (!ok) continue; // wrong timing/cost -> pick another card or move
      played = true;
    }
    if (G.winner) { await endTurn(G, io, p); return; }

    const ndice = (p.eff.dashThisTurn ? 1 : 0) + moveDiceCount(G, p);
    p.eff.dashThisTurn = false;
    await io.promptRoll(G, p); // human: ritual roll button; CPU: auto-roll
    const dice = rollDice(ndice, G.rng, G);
    const roll = dice.reduce((a, b) => a + b, 0);
    await io.onRoll(G, p, roll, dice);
    await io.log(L()(`${p.name} 掷出了 ${roll}。`, `${p.name} rolls ${roll}.`));

    const state = { extraRolls: 0 };
    await move(G, io, p, Math.max(1, roll - (p.eff.bound > 0 ? 1 : 0)), state);

    if (!G.winner && !p.ko) await panelEffect(G, io, p, state);

    await endTurn(G, io, p);
  }

  async function endTurn(G, io, p) {
    await resolveBindingChains(G, io, p);
    const max = OJ.CHARS[p.charId].maxHand;
    while (p.hand.length > max) {
      const i = Math.floor(G.rng() * p.hand.length);
      const c = p.hand.splice(i, 1)[0];
      G.centerDiscard.push(c);
    }
    if (G.global.outOfAmmo > 0) G.global.outOfAmmo--;
    G.turnIdx = (G.turnIdx + 1) % G.players.length;
    if (G.turnIdx === 0) {
      G.chapter++;
      G.global.littleWar = Math.max(0, G.global.littleWar - 1);
      G.global.miracle = false;
      G.global.backtrack = false;
      G.global.sprint = false;
      G.global.specs = false;
      await runFieldEvents(G, io);
      await awardChapterStars(G, io); // big-round start: everyone gets stars
    }
    await io.onTurnEnd(G, p);
  }

  async function runGame(G, io, maxChapters) {
    await io.onStart(G);
    await runFieldEvents(G, io);
    await awardChapterStars(G, io); // chapter 1 bonus before P1 acts
    while (!G.winner && (!maxChapters || G.chapter <= maxChapters)) {
      await playTurn(G, io);
    }
    if (!G.winner) {
      let best = G.players[0];
      for (const p of G.players) {
        if (p.level > best.level || (p.level === best.level && p.stars > best.stars)) best = p;
      }
      G.winner = best;
      await io.log(L()('时间到！进度最高者获胜。', 'Time up! Highest progress wins.'));
    }
    await io.onEnd(G, G.winner);
    return G.winner;
  }

  OJ.engine = {
    newGame, runGame, playTurn, battle, applyBattleCard, useCard, panelEffect, move, normaCheck,
    awardChapterStars, draw, d6, rollDice, shuffle, cardCost, canPay, levelOk, baseUsable, cardTargets,
    isBattleTiming, playableOnField, playableInBattle,
    normaOptions, normaReq, normaMet, makeMob, setTrap, effStat, diceCount, bfsDist, effType, homeOwner,
    koUnit, getWild, getBoss,
  };
})();
