/* Browser IO adapter: DOM UI + promises (bilingual) */
(function () {
  'use strict';
  const OJ = (globalThis.OJ = globalThis.OJ || {});
  const E = () => OJ.engine;
  const C = () => OJ.CARDS;
  const L = (zh, en) => OJ.L(zh, en);

  const $ = (sel) => document.querySelector(sel);
  const el = (tag, cls, html) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  };
  const sign = (v) => (v > 0 ? '+' + v : '' + v);

  // ---------- dice ----------
  function diceHTML(dice, cls) {
    return `<span class="dice ${cls || ''}">${dice.map((d) => `<span class="die" data-v="${d}">${d}</span>`).join('')}</span>`;
  }

  // ---------- cards ----------
  function cardHTML(cardId, opts) {
    opts = opts || {};
    const c = C()[cardId];
    const cost = opts.cost !== undefined ? opts.cost : E().cardCost(cardId, opts.player || { level: 1 });
    const typeCls = { Boost: 't-boost', Battle: 't-battle', Trap: 't-trap', Event: 't-event', Hyper: 't-hyper' }[c.type] || '';
    const name = OJ.t(cardId, 'name');
    return `<div class="card ${typeCls} ${opts.disabled ? 'disabled' : ''}" data-card="${cardId}">
      <div class="card-art"><img src="assets/cards/${c.art}.webp" onerror="this.style.display='none'"></div>
      <div class="card-name">${name}</div>
      <div class="card-cost">${cost > 0 ? cost + '★' : L('免费', 'Free')}</div>
      <div class="card-type">${({ Boost: L('强化', 'Boost'), Battle: L('战斗', 'Battle'), Trap: L('陷阱', 'Trap'), Event: L('事件', 'Event'), Hyper: 'Hyper' })[c.type]}</div>
    </div>`;
  }

  function showCardTooltip(cardId, x, y) {
    const c = C()[cardId];
    const tip = $('#tooltip');
    const name = OJ.t(cardId, 'name');
    const descr = (OJ.lang === 'zh' ? (OJ.I18N_DATA.card[c.key] || {}).zh : (OJ.I18N_DATA.card[c.key] || {}).en);
    const d = (descr && descr.descr) || c.descr;
    const typeLabel = { Boost: L('强化', 'Boost'), Battle: L('战斗', 'Battle'), Trap: L('陷阱', 'Trap'), Event: L('事件', 'Event'), Hyper: 'Hyper' }[c.type];
    tip.innerHTML = `<b>${name}</b> <span class="tt-cost">${E().cardCost(cardId, { level: 3 }) > 0 ? E().cardCost(cardId, { level: 3 }) + '★' : ''}</span><br>
      <span class="tt-type">${typeLabel}${c.lvl > 1 ? ' · Lv' + c.lvl : ''}</span><br>${d.replace(/\n/g, '<br>')}`;
    tip.style.display = 'block';
    const w = 300;
    tip.style.left = Math.max(6, Math.min(window.innerWidth - w - 10, x + 16)) + 'px';
    tip.style.top = Math.max(6, Math.min(window.innerHeight - 180, y + 12)) + 'px';
  }
  function hideTooltip() { $('#tooltip').style.display = 'none'; }

  function bindCardTooltip(container) {
    container.addEventListener('mousemove', (ev) => {
      const cardEl = ev.target.closest('.card');
      if (cardEl) showCardTooltip(cardEl.dataset.card, ev.clientX, ev.clientY);
    });
    container.addEventListener('mouseleave', hideTooltip);
  }

  function banner(text, cls, ms) {
    const holder = $('#banners');
    while (holder.children.length >= 3) holder.firstChild.remove();
    const b = el('div', 'banner ' + (cls || ''), text);
    $('#banners').appendChild(b);
    setTimeout(() => b.remove(), ms || 1500);
  }

  function modal(html, setup, cls) {
    return new Promise((resolve) => {
      const ov = el('div', 'modal-overlay');
      const box = el('div', 'modal-box ' + (cls || ''));
      box.innerHTML = html;
      ov.appendChild(box);
      $('#modals').appendChild(ov);
      const done = (v) => { ov.remove(); resolve(v); };
      if (setup) setup(box, done);
    });
  }

  // ---------- sidebar ----------
  function plateHTML(p, active) {
    const ch = OJ.CHARS[p.charId];
    // current norma objective (wiki/Norma: picked at the previous level-up)
    const req = OJ.engine.normaReq(st_G(), p);
    const objLabel = req.kind === 'stars'
      ? `<span class="obj sel-star">★ ${p.stars}<small>/${req.need}</small></span><span class="obj dim">⚔ ${p.wins}</span>`
      : `<span class="obj dim">★ ${p.stars}</span><span class="obj sel-win">⚔ ${p.wins}<small>/${req.need}</small></span>`;
    return `<img class="face" src="assets/faces/${ch.sprite}.png">
      <div class="pinfo">
        <div class="pname">${OJ.charName(p.charId)} <span class="plvl">Lv${p.level}</span>${p.isCPU ? '' : ` <span class="you">${L('你', 'YOU')}</span>`}</div>
        <div class="hpbar"><div class="hpfill" style="width:${(p.hp / p.maxhp) * 100}%"></div><span>HP ${p.hp}/${p.maxhp}</span></div>
        <div class="pstats">${objLabel}
          <span class="mini">A${sign(ch.atk)} D${sign(ch.def)} E${sign(ch.evd)}</span>
        </div>
      </div>`;
  }

  // the G captured by the last updateAll call (plates are re-rendered often)
  let lastG = null;
  function st_G() { return lastG; }

  function updateAll(G, active) {
    lastG = G;
    const list = $('#plates');
    list.innerHTML = '';
    G.players.forEach((p) => {
      const plate = el('div', 'player-plate' + (p === active ? ' active' : '') + (p.ko ? ' ko' : ''));
      plate.style.setProperty('--pc', OJ.render.PLAYER_COLORS[p.idx]);
      plate.innerHTML = plateHTML(p, p === active);
      list.appendChild(plate);
    });
    $('#chapter').textContent = L(`第 ${G.chapter} 章`, 'Chapter ' + G.chapter);
    const dc = $('#deckcount');
    if (dc) dc.textContent = `🂠 ${G.centerDeck.length}`;
    const ev = [];
    if (G.global.miracle) ev.push(L('✨奇迹', '✨Miracle'));
    if (G.bossActive) ev.push(L('👹Boss出现', '👹Boss'));
    if (G.global.littleWar > 0) ev.push(L('⚔小战争', '⚔Little War'));
    if (G.global.outOfAmmo > 0) ev.push(L('🚫弹尽粮绝', '🚫Out of Ammo'));
    $('#fieldevents').innerHTML = ev.join(' ');
  }

  function updateHand(G, p) {
    const hand = $('#hand');
    hand.innerHTML = '';
    if (!p || p.isCPU || p.isMobUnit) return;
    for (const cid of p.hand) {
      hand.insertAdjacentHTML('beforeend', cardHTML(cid, { cost: E().cardCost(cid, p) }));
    }
  }

  // ---------- battle UI ----------
  function btUnitHTML(u, color) {
    const isMob = !!u.isMobUnit;
    const sprite = isMob ? OJ.MOBS[u.mobKind].sprite : OJ.CHARS[u.charId].sprite;
    const nm = u.name;
    const src = isMob ? OJ.MOBS[u.mobKind] : OJ.CHARS[u.charId];
    const stats = `ATK ${sign(src.atk)} / DEF ${sign(src.def)} / EVD ${sign(src.evd)}`
      + (isMob && u.mobBoss ? ` · ${L('BOSS', 'BOSS')}` : '');
    return `<img class="bt-face" src="assets/faces/${sprite}.png" onerror="this.src='assets/faces/chicken.png'">
      <div class="bt-name" style="color:${color}">${nm}</div>
      <div class="bt-hp"><div class="bt-hpfill" style="width:${(u.hp / u.maxhp) * 100}%"></div><span>HP ${u.hp}/${u.maxhp}</span></div>
      <div class="bt-stats">${stats}</div>
      <div class="bt-buffs"></div>
      <div class="bt-roll"></div>`;
  }

  function btUpdateHP(u) {
    const which = u.idx === btAidx ? 'a' : 'b';
    const box = $('#bt-' + which);
    if (!box) return;
    box.querySelector('.bt-hpfill').style.width = (u.hp / u.maxhp) * 100 + '%';
    box.querySelector('.bt-hp span').textContent = `HP ${u.hp}/${u.maxhp}`;
  }
  let btAidx = 0, btBidx = 1;

  function BrowserIO(state) {
    const st = state;
    const io = {
      speed: 1,
      async onStart(G) {
        st.G = G;
        await OJ.render.init($('#board'), G);
        updateAll(G, null);
      },
      async log(msg) {
        const box = $('#log');
        const line = el('div', 'log-line', msg);
        box.appendChild(line);
        box.scrollTop = box.scrollHeight;
        while (box.children.length > 150) box.firstChild.remove();
      },
      async onTurnStart(G, p) {
        st.turnPlayer = p;
        updateAll(G, p);
        updateHand(G, p);
        banner(L(`${OJ.charName(p.charId)} 的回合`, `${p.name}'s turn`), 'turn', 800);
      },
      async onTurnEnd(G, p) { updateAll(G, st.turnPlayer); },
      async onRoll(G, p, roll, dice) {
        OJ.render.startRollCutscene(G, p, dice, roll);
        banner(`${OJ.charName(p.charId)} → ${roll}！`, 'roll', 1100);
        await OJ.render.wait(2350);
      },
      async onPanel(G, p, panel, stars, dice) {
        if (stars) OJ.render.popTextAt(p.pos, (stars > 0 ? '+' : '') + stars + '★', stars > 0 ? '#ffe25a' : '#ff7a7a');
        updateAll(G, st.turnPlayer);
        await OJ.render.wait(350);
      },
      async onDamage(G, p, dmg) {
        if (p.pos !== undefined && p.pos !== -1) OJ.render.popTextAt(p.pos, '-' + dmg, '#ff5a5a');
        updateAll(G, st.turnPlayer);
        btUpdateHP(p);
        await OJ.render.wait(280);
      },
      async onKO(G, p) {
        banner(L(`${p.name} 被击倒！`, `${p.name} is KO'd!`), 'ko', 1600);
        updateAll(G, st.turnPlayer);
        await OJ.render.wait(800);
      },
      async onNorma(G, p) {
        banner(`${OJ.charName(p.charId)} ${L('达成 NORMA！→ Lv', 'NORMA CLEAR! → Lv')}${p.level}`, 'norma', 1900);
        updateAll(G, st.turnPlayer);
      },
      async onNormaPick(G, p, pick) {
        updateAll(G, st.turnPlayer);
      },
      async onBossEvent(G) {
        banner(G.bossActive ? L('⚠ Boss 出现！', '⚠ Boss Encounter!') : L('Boss 已被讨伐！', 'Boss defeated!'), 'ko', 2200);
        updateAll(G, st.turnPlayer);
      },
      async onRevive(G, p) {
        if (p && p.pos !== undefined && p.pos !== -1) OJ.render.popTextAt(p.pos, L('复活！', 'REVIVED!'), '#8cff8a', 22);
        updateAll(st.G, st.turnPlayer);
      },
      async onUseCard(G, p, cardId) { updateAll(G, st.turnPlayer); updateHand(G, st.turnPlayer); },
      async onTeleport(G, p) {
        await OJ.render.animateTeleport(G, p);
        updateAll(G, st.turnPlayer);
      },
      async animateMove(G, p, panelId, remaining) {
        await OJ.render.animateMove(G, p, panelId);
        updateAll(G, st.turnPlayer);
      },

      // ---------- battle ----------
      async onBattleStart(G, a, d, opts) {
        btAidx = a.idx; btBidx = d.idx;
        const box = $('#battle');
        box.style.display = 'flex';
        box.innerHTML = `
          <div class="bt-phase">${L('战斗开始', 'Battle Start')}</div>
          <div class="bt-row">
            <div class="bt-unit" id="bt-a">${btUnitHTML(a, OJ.render.PLAYER_COLORS[a.idx] || '#fff')}</div>
            <div class="bt-mid"><div class="bt-vs">VS</div><div class="bt-round"></div></div>
            <div class="bt-unit" id="bt-b">${btUnitHTML(d, OJ.render.PLAYER_COLORS[d.idx] || '#fff')}</div>
          </div>
          <div class="bt-log"></div>`;
        $('#battle .bt-log').innerHTML = '';
        banner(L('战斗！', 'Battle!'), 'battle', 800);
        await OJ.render.wait(500);
      },
      async onBattlePhase(G, phase, data) {
        const ph = $('#battle .bt-phase');
        if (!ph) return;
        const labels = {
          round: L(`第 ${data.n} 回合`, `Round ${data.n}`),
          attackCards: L('攻击方：可使用战斗卡', 'Attacker: battle cards?'),
          defendCards: L('防守方：可使用战斗卡', 'Defender: battle cards?'),
          counter: L('反击！', 'Counter-attack!'),
        };
        ph.textContent = labels[phase] || '';
        if (phase === 'round' && $('#battle .bt-round')) {
          $('#battle .bt-round').textContent = L(`Round ${data.n}`, `Round ${data.n}`);
        }
      },
      async onBattleBuff(G, p, cardId, ctx) {
        const box = p.idx === btAidx ? $('#bt-a .bt-buffs') : $('#bt-b .bt-buffs');
        if (!box) return;
        box.insertAdjacentHTML('beforeend', `<span class="bt-chip">${OJ.t(cardId, 'name')}</span>`);
      },
      async onBattleRoll(G, src, dst, info) {
        const bl = $('#battle .bt-log');
        if (!bl) return;
        if (info.kind === 'attack') {
          const line = el('div', 'battle-line',
            `<b>${src.name}</b> ${L('攻击宣言', 'ATK')} ${diceHTML(info.dice)} ${info.dice.length > 1 ? '= ' : '+stat= '}<b class="bt-num">${info.total}</b>`);
          bl.appendChild(line);
          // show in roll area
          const ra = src.idx === btAidx ? $('#bt-a .bt-roll') : $('#bt-b .bt-roll');
          if (ra) ra.innerHTML = diceHTML(info.dice, 'big') + `<span class="bt-total">${info.total}</span>`;
        } else {
          const verb = info.kind === 'evade'
            ? (info.dmg === 0 ? L('闪避成功！', 'dodged!') : L('闪避失败！', 'evade failed!'))
            : L('防御', 'defends');
          const line = el('div', 'battle-line' + (info.dmg === 0 ? ' bt-dodge' : ''),
            `<b>${src.name}</b> ${info.kind === 'evade' ? 'EVD' : 'DEF'} ${diceHTML(info.dice)} = <b class="bt-num">${info.total}</b>
             → ${info.dmg === 0 ? L('伤害 0！', '0 damage!') : L('受到 ' + info.dmg + ' 伤害', info.dmg + ' damage')}`);
          bl.appendChild(line);
          const ra = src.idx === btAidx ? $('#bt-a .bt-roll') : $('#bt-b .bt-roll');
          if (ra) ra.innerHTML = diceHTML(info.dice, 'big') + `<span class="bt-total">${info.total}</span><span class="bt-dmg ${info.dmg === 0 ? 'miss' : ''}">${info.dmg === 0 ? 'MISS' : '-' + info.dmg}</span>`;
        }
        bl.scrollTop = bl.scrollHeight;
        await OJ.render.wait(info.kind === 'attack' ? 750 : 950);
      },
      async onBattleEnd(G, winner, loser) {
        await OJ.render.wait(650);
        $('#battle').style.display = 'none';
        updateAll(G, st.turnPlayer);
      },

      // ---------- prompts ----------
      async promptDirection(G, p, options) {
        return new Promise((resolve) => {
          if (p.isCPU) { resolve(OJ.ai.bestDirection(G, p, options)); return; }
          OJ.render.setHighlights(options.map((id) => ({ panelId: id })), (id) => resolve(id));
        });
      },
      async promptChallenge(G, p, foe) {
        if (p.isCPU) return OJ.ai.shouldChallenge(G, p, foe);
        return modal(`<h3>${L('遭遇对手！', 'Opponent encountered!')}</h3>
          <p>${OJ.charName(foe.charId)} · HP ${foe.hp}/${foe.maxhp} · ${foe.stars}★</p>
          <p class="hint">${L('是否停下并挑战？（拒绝则继续移动）', 'Stop and challenge? (No = keep moving)')}</p>`,
          (box, done) => {
            const yes = el('button', 'btn primary', L('挑战！', 'Challenge!'));
            const no = el('button', 'btn', L('继续移动', 'Keep moving'));
            yes.onclick = () => done(true);
            no.onclick = () => done(false);
            box.appendChild(yes); box.appendChild(no);
          });
      },
      async promptStopHome(G, p, remaining) {
        if (p.isCPU) return OJ.ai.shouldStopHome(G, p);
        const opts = E().normaOptions(G, p);
        return modal(`<h3>${L('自家面板', 'Home Panel')}</h3>
          <p>${L(`还剩 ${remaining} 格移动。要停下吗？`, `${remaining} panels left. Stop here?`)}</p>
          ${opts.length ? `<p class="hint">${L('✔ Norma 条件已达成！', '✔ Norma requirement met!')}</p>` : ''}`,
          (box, done) => {
            const yes = el('button', 'btn primary', L('停下', 'Stop'));
            const no = el('button', 'btn', L('继续移动', 'Keep moving'));
            yes.onclick = () => done(true);
            no.onclick = () => done(false);
            box.appendChild(yes); box.appendChild(no);
          });
      },
      async promptNorma(G, p, opts, si) {
        // choosing the objective for the NEXT level (wiki/Norma)
        if (p.isCPU) return OJ.ai.chooseNorma(G, p, opts, si);
        return modal(`<h3>${OJ.charName(p.charId)} — ${L(`选择升级到 Lv${p.level + 1} 的目标`, `choose your objective for Lv${p.level + 1}`)}</h3>
          <p class="hint">${L('目标一经选择不可更改', 'The objective cannot be changed once chosen')}</p>`, (box, done) => {
          for (const o of opts) {
            const req = o === 'stars' ? OJ.STAR_NORMA[si] + '★' : OJ.WIN_NORMA[Math.max(0, si - 1)] + ' ⚔';
            const b = el('button', 'btn norma-btn ' + o,
              `${o === 'stars' ? L('星星', 'Stars') : L('击杀', 'Wins')}<br><small>${req}</small>`);
            b.onclick = () => done(o);
            box.appendChild(b);
          }
        });
      },
      async promptCardPlay(G, p) {
        if (p.isCPU) {
          for (const cid of ['PUDDING', 'COOKIE', 'HYPER_ARU', 'NICEPRESENT', 'HYPER_SUGURI', 'HYPER_KAI', 'HYPER_MARC', 'HYPER_HIME', 'DINNER', 'EXTEND', 'PRINCESS']) {
            if (OJ.ai.wantPlayCard(G, p, cid)) return cid;
          }
          return null;
        }
        return modal(`<h3>${L('出牌阶段 — 使用卡牌或移动', 'Play a card or move')}</h3>`, (box, done) => {
          const hand = el('div', 'hand');
          for (const cid of p.hand) {
            // battle-timed cards are greyed out: they can only be used at battle start
            const usable = E().playableOnField(G, p, cid);
            hand.insertAdjacentHTML('beforeend', cardHTML(cid, { disabled: !usable, cost: E().cardCost(cid, p) }));
          }
          box.appendChild(hand);
          const hint = el('p', 'hint', L('灰暗的卡现在无法使用（战斗卡要在战斗开始时使用）', 'Greyed cards cannot be used now (battle cards only when battle starts)'));
          box.appendChild(hint);
          const skip = el('button', 'btn primary big', L('掷骰移动 ▶', 'Roll & Move ▶'));
          skip.onclick = () => done(null);
          box.appendChild(skip);
          hand.addEventListener('click', (ev) => {
            const cardEl = ev.target.closest('.card');
            if (!cardEl || cardEl.classList.contains('disabled')) return;
            done(cardEl.dataset.card);
          });
          bindCardTooltip(hand);
        }, 'wide').then((cid) => { hideTooltip(); return cid; });
      },
      async promptCardTarget(G, p, cardId, targets) {
        if (p.isCPU) return OJ.ai.pickTarget(G, p, cardId, targets);
        return modal(`<h3>${OJ.t(cardId, 'name')} — ${L('选择目标', 'choose a target')}</h3>`, (box, done) => {
          for (const t of targets) {
            const b = el('button', 'btn target-btn',
              `<img src="assets/faces/${OJ.CHARS[t.charId].sprite}.png" class="mini-face">${OJ.charName(t.charId)}
               <small>HP ${t.hp}/${t.maxhp} · ${t.stars}★ · Lv${t.level}</small>`);
            b.onclick = () => done(t);
            box.appendChild(b);
          }
          const cancel = el('button', 'btn', L('取消', 'Cancel'));
          cancel.onclick = () => done(null);
          box.appendChild(cancel);
        });
      },
      async promptRoll(G, p) {
        // manual, ritual dice roll for the human player (CPU auto-rolls)
        if (p.isCPU || p.isMobUnit) return;
        const ch = OJ.CHARS[p.charId];
        return modal(`<h3>${OJ.charName(p.charId)} — ${L('掷骰移动', 'Roll to move')}</h3>
          <div class="roll-face"><img src="assets/faces/${ch.sprite}.png"></div>
          <p class="hint">${L('点击掷骰，开始移动！', 'Roll the dice to start moving!')}</p>`,
          (box, done) => {
            const b = el('button', 'btn primary big roll-btn', `🎲 ${L('掷骰子！', 'Roll!')}`);
            b.onclick = () => done(true);
            box.appendChild(b);
          });
      },
      async promptRecoveryRoll(G, p) {
        // the player rolls their own recovery check (wiki/Recovery)
        const ch = p.isMobUnit ? OJ.MOBS[p.mobKind] : OJ.CHARS[p.charId];
        const sprite = ch.sprite;
        const human = !(p.isCPU || p.isMobUnit);
        if (!human) return;
        return modal(`<h3>${OJ.charName(p.charId)} — ${L('恢复检定', 'Recovery Check')}</h3>
          <div class="roll-face ko-face"><img src="assets/faces/${sprite}.png"></div>
          <p>${L('需要掷出', 'You need to roll')} <b class="rec-req">${p.reviveReq}</b> ${L('以上才能复活', 'or higher to recover')}</p>
          <p class="hint">${L('点击掷骰，尝试复活！', 'Roll the dice to recover!')}</p>`,
          (box, done) => {
            const b = el('button', 'btn primary big roll-btn', `🎲 ${L('恢复检定！', 'Recovery Roll!')}`);
            b.onclick = () => done(true);
            box.appendChild(b);
          });
      },
      async onRecoveryRoll(G, p, roll) {
        // dice tumble at the KO'd unit's position; green if success, red if fail
        OJ.render.animateDice(p.pos, [roll], roll);
        await OJ.render.wait(950);
      },
      async promptBattleCard(G, p, ctx, role) {
        if (p.isMobUnit) return null;
        if (p.isCPU) return OJ.ai.wantBattleCard(G, p, ctx, role);
        // only battle-timed cards here (Battle cards + battle Hypers);
        // field cards like event Hypers would fizzle with no effect
        const usable = p.hand.filter((cid) => E().playableInBattle(G, p, cid, role));
        const title = role === 'attacker'
          ? L('你的攻击回合 — 使用战斗卡？', 'Your attack — play a battle card?')
          : L('防御准备 — 使用防御卡？', 'Defending — play a battle card?');
        if (!usable.length) {
          // quick "no cards" flash for pacing
          await OJ.render.wait(150);
          return null;
        }
        return modal(`<h3>${title}</h3>`, (box, done) => {
          const hand = el('div', 'hand');
          for (const cid of usable) hand.insertAdjacentHTML('beforeend', cardHTML(cid, { cost: E().cardCost(cid, p) }));
          box.appendChild(hand);
          const skip = el('button', 'btn primary', L('不用', 'Skip'));
          skip.onclick = () => done(null);
          box.appendChild(skip);
          hand.addEventListener('click', (ev) => {
            const cardEl = ev.target.closest('.card');
            if (cardEl) done(cardEl.dataset.card);
          });
          bindCardTooltip(hand);
        }, 'wide').then((cid) => { hideTooltip(); return cid; });
      },
      async promptDefend(G, p, ctx, atkTotal, atkDice) {
        if (p.isCPU || p.isMobUnit) return OJ.ai.chooseDefend(G, p, ctx, atkTotal);
        const ch = OJ.CHARS[p.charId];
        const evd = E().effStat(G, p, 'evd', ctx);
        const def = E().effStat(G, p, 'def', ctx);
        return modal(`
          <h3>${OJ.charName(p.charId)} — ${L('受到攻击！', 'Incoming attack!')}</h3>
          <div class="atk-show">${L('对方攻击值', 'Enemy ATK')} ${diceHTML(atkDice || [atkTotal])} <b class="bt-num">${atkTotal}</b></div>
          <p class="def-hint">
            <span>${L('防御', 'DEF')} ${def}: ${L('最少受 1 伤', 'min 1 dmg')}</span> ·
            <span>EVD ${evd}: ${L('EVD>ATK 完全闪避', 'dodge if EVD>ATK')}</span>
          </p>`, (box, done) => {
          const d = el('button', 'btn defend', `${L('防御', 'Defend')}<br><small>${L('掷骰减伤（最少1）', 'roll reduces (min 1)')}</small>`);
          const e = el('button', 'btn evade', `${L('闪避', 'Evade')}<br><small>${L('大于则免伤，否则吃满', 'dodge all or take full')}</small>`);
          if ((ctx.noEvade || {})[p.idx]) { e.disabled = true; e.title = L('Rbits 效果', 'Rbits'); }
          d.onclick = () => done('defend');
          e.onclick = () => done('evade');
          box.appendChild(d); box.appendChild(e);
        });
      },
      async promptSwap(G, p, newCard) {
        if (p.isCPU) return OJ.ai.cpuPromptSwap(G, p, newCard);
        const c = C()[newCard];
        return modal(`<h3>${L('手牌已满！', 'Hand full!')}</h3>
          <p>${L('抽到了', 'You drew')} <b>${OJ.t(newCard, 'name')}</b> — ${L('选择一张手牌替换，或不要这张卡', 'replace one of your cards, or decline it')}</p>`,
          (box, done) => {
            const hand = el('div', 'hand');
            for (const cid of p.hand) hand.insertAdjacentHTML('beforeend', cardHTML(cid, { cost: E().cardCost(cid, p) }));
            box.appendChild(hand);
            const skip = el('button', 'btn', L('不要这张卡', "Don't take it"));
            skip.onclick = () => done(null);
            box.appendChild(skip);
            hand.addEventListener('click', (ev) => {
              const cardEl = ev.target.closest('.card');
              if (cardEl) done(cardEl.dataset.card);
            });
            bindCardTooltip(hand);
          }, 'wide').then((cid) => { hideTooltip(); return cid; });
      },
      async promptShop(G, p, offers) {
        if (p.isCPU) return OJ.ai.shopPick(G, p, offers);
        if (!offers.length) return null;
        return modal(`<h3>${L('商店', 'Shop')} — ${p.stars}★</h3><p class="hint">${L('卡价 +5 星', 'card cost +5 stars')}</p>`, (box, done) => {
          const hand = el('div', 'hand');
          for (const cid of offers) {
            const cost = E().cardCost(cid, p) + 5;
            hand.insertAdjacentHTML('beforeend', cardHTML(cid, { disabled: p.stars < cost || p.hand.length >= OJ.CHARS[p.charId].maxHand, cost }));
          }
          box.appendChild(hand);
          const leave = el('button', 'btn primary', L('离开', 'Leave'));
          leave.onclick = () => done(null);
          box.appendChild(leave);
          hand.addEventListener('click', (ev) => {
            const cardEl = ev.target.closest('.card');
            if (!cardEl || cardEl.classList.contains('disabled')) return;
            done(cardEl.dataset.card);
          });
          bindCardTooltip(hand);
        }, 'wide').then((cid) => { hideTooltip(); return cid; });
      },
      async onEnd(G, winner) {
        banner(`${OJ.charName(winner.charId)} ${L('获胜！', 'wins!')}`, 'win', 5000);
        await modal(`<h2 class="win-title">${OJ.charName(winner.charId)} ${L('获胜！', 'wins!')}</h2>
          <p>${L('第', 'Chapter')} ${G.chapter} · Lv${winner.level} · ${winner.stars}★ · ${winner.wins}⚔</p>`, (box, done) => {
          const b = el('button', 'btn primary', L('回到主菜单', 'Back to menu'));
          b.onclick = () => done(true);
          box.appendChild(b);
        });
        st.ended = true;
      },
    };
    return io;
  }

  OJ.ui = { BrowserIO, banner, updateAll, updateHand, cardHTML, modal, hideTooltip };
})();
