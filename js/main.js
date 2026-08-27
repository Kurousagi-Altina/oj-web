/* Boot: character & map select + game driver + language toggle */
(function () {
  'use strict';
  const OJ = (globalThis.OJ = globalThis.OJ || {});
  const E = () => OJ.engine;
  const $ = (sel) => document.querySelector(sel);
  const el = (tag, cls, html) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  };
  const L = (zh, en) => OJ.L(zh, en);

  let running = false;
  let selectedBoard = 'clover';

  function showMenu() {
    $('#game').style.display = 'none';
    const menu = $('#menu');
    menu.style.display = 'flex';
    $('#menu h1 .sub').textContent = L('网页复刻版 DEMO', 'Web Replica Demo');
    $('.menu-hint').textContent = L('选择地图与角色（与 3 名 CPU 对战 · 率先完成 Norma 6 者获胜）', 'Pick a board & character (vs 3 CPU · first to Norma 6 wins)');

    // board select
    const brow = $('#boardrow');
    brow.innerHTML = '';
    for (const bid of Object.keys(OJ.BOARDS)) {
      const b = OJ.BOARDS[bid];
      const card = el('div', 'boardcard' + (bid === selectedBoard ? ' sel' : ''));
      const evNames = (b.events || []).map((e) => ({ miracle: L('奇迹', 'Miracle'), backtrack: L('逆行', 'Backtrack'), randomwarp: L('随机传送', 'Random Warp') }[e.id] || e.id));
      const bossName = OJ.mobName(b.boss || 'shifu');
      card.innerHTML = `
        <div class="bname">${OJ.lang === 'zh' ? b.nameZh : b.name}</div>
        <div class="binfo">${b.panels.length} ${L('格', 'panels')}</div>
        <div class="binfo boss">Boss: ${bossName}</div>
        <div class="binfo ev">${evNames.length ? evNames.join(' · ') : L('无场地事件', 'No events')}</div>`;
      card.onclick = () => { selectedBoard = bid; showMenu(); };
      brow.appendChild(card);
    }

    // character select
    const grid = $('#chargrid');
    grid.innerHTML = '';
    for (const cid of Object.keys(OJ.CHARS)) {
      const ch = OJ.CHARS[cid];
      const sgn = (v) => (v > 0 ? '+' + v : '' + v);
      const hyperName = OJ.lang === 'zh' ? (OJ.I18N_DATA.card[OJ.CARDS[ch.hyper].key] || {}).zh?.name || OJ.CARDS[ch.hyper].name : OJ.CARDS[ch.hyper].name;
      const passive = OJ.lang === 'zh' ? ch.passiveZh : ch.passive;
      const card = document.createElement('div');
      card.className = 'charcard';
      card.innerHTML = `
        <img class="charportrait" src="assets/faces/${ch.sprite}.png">
        <div class="charname">${OJ.charName(cid)}</div>
        <div class="charstats">HP ${ch.hp} · ATK ${sgn(ch.atk)} · DEF ${sgn(ch.def)} · EVD ${sgn(ch.evd)} · REC ${ch.rec}</div>
        <div class="charpassive">${passive}</div>
        <div class="charhyper">Hyper: ${hyperName}</div>`;
      card.onclick = () => startGame(cid);
      grid.appendChild(card);
    }
  }

  async function startGame(charId) {
    if (running) return;
    running = true;
    OJ.ui.hideTooltip();
    $('#menu').style.display = 'none';
    $('#game').style.display = 'grid';
    $('#log').innerHTML = '';
    const pool = Object.keys(OJ.CHARS).filter((c) => c !== charId);
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const charIds = [charId, ...pool.slice(0, 3)];
    const G = E().newGame({ charIds, p0cpu: false, boardId: selectedBoard });
    const io = OJ.ui.BrowserIO({ G });
    document.querySelectorAll('.speed').forEach((b) => {
      b.onclick = () => {
        OJ.render.R.speed = Number(b.dataset.s);
        document.querySelectorAll('.speed').forEach((x) => x.classList.toggle('sel', x === b));
      };
    });
    $('#btn_restart').onclick = () => { location.reload(); };
    try {
      await E().runGame(G, io, 150);
    } catch (err) {
      console.error(err);
      OJ.ui.banner('Error: ' + err.message, 'ko', 4000);
    }
    running = false;
  }

  window.addEventListener('DOMContentLoaded', () => {
    // the character select scrolls vertically with the page (mouse wheel /
    // touch native scrolling) — no custom drag needed

    // mobile log drawer toggle
    $('#btn_log').onclick = () => { $('#rightbar').classList.toggle('open'); };

    $('#board').addEventListener('click', (ev) => {
      const rect = ev.target.getBoundingClientRect();
      const scale = OJ.render.R.canvas.width / rect.width;
      OJ.render.canvasClick((ev.clientX - rect.left) * scale, (ev.clientY - rect.top) * scale);
    });
    $('#btn_lang').onclick = () => {
      OJ.lang = OJ.lang === 'zh' ? 'en' : 'zh';
      $('#btn_lang').textContent = OJ.lang === 'zh' ? 'EN' : '中文';
      showMenu();
    };
    if (location.search.includes('auto')) {
      $('#menu').style.display = 'none';
      $('#game').style.display = 'grid';
      const bid = new URLSearchParams(location.search).get('board') || 'clover';
      const G = E().newGame({ p0cpu: true, boardId: bid });
      const io = OJ.ui.BrowserIO({ G });
      OJ.render.R.speed = 0.02;
      running = true;
      E().runGame(G, io, 150).catch((e) => console.error(e));
    } else if (location.search.includes('battle')) {
      $('#menu').style.display = 'none';
      $('#game').style.display = 'grid';
      const G = E().newGame({ p0cpu: false });
      const io = OJ.ui.BrowserIO({ G });
      OJ.render.init($('#board'), G).then(async () => {
        const a = G.players[1], d = G.players[0];
        await io.onBattleStart(G, a, d, {});
        await io.onBattlePhase(G, 'round', { n: 1 });
        await io.onBattleRoll(G, a, d, { kind: 'attack', dice: [4, 3], total: 8 });
        io.promptDefend(G, d, {}, 8, [4, 3]);
      });
    } else {
      showMenu();
    }
  });

  OJ.main = { startGame, showMenu };
})();
