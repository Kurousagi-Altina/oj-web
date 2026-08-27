/* Canvas renderer — isometric board (matches the original game's view):
   panels are 2:1 diamonds on an isometric plane, characters are upright
   billboards standing on the tiles, painter's order by grid depth. */
(function () {
  'use strict';
  const OJ = (globalThis.OJ = globalThis.OJ || {});

  const PLAYER_COLORS = ['#ff5a5a', '#4d8dff', '#ffd25a', '#7dee5a'];

  const R = {
    canvas: null, ctx: null, G: null,
    playerView: {}, highlights: [], bgPattern: null, images: {}, speed: 1, fx: [], t: 0,
    tileW: 100, tileH: 50, cx: 480, cy: 200,
  };

  function loadImage(src) {
    return new Promise((res) => {
      const im = new Image();
      im.onload = () => res(im);
      im.onerror = () => res(null);
      im.src = src;
    });
  }

  const PANEL_IMGS = ['neutral', 'bonus', 'bonus2', 'drop', 'drop2', 'draw', 'draw2',
    'encounter', 'encounter2', 'boss', 'move', 'move2', 'heal', 'heal2', 'home', 'damage', 'warp'];

  // grid -> screen (classic 2:1 isometric)
  function project(gx, gy) {
    return {
      x: R.cx + (gx - gy) * R.tileW / 2,
      y: R.cy + (gx + gy) * R.tileH / 2,
    };
  }

  async function init(canvas, G) {
    R.canvas = canvas;
    R.ctx = canvas.getContext('2d');
    R.G = G;
    const spanX = (G.board.cols + G.board.rows - 2);   // in half-tiles
    const spanY = spanX;
    R.tileW = Math.floor(Math.min((canvas.width * 0.94) / (spanX / 2 + 1), 120));
    R.tileH = Math.floor(R.tileW / 2);
    R.cx = Math.floor(canvas.width / 2);
    R.cy = Math.floor((canvas.height - spanY * R.tileH / 2) / 2);
    const imgs = {};
    for (const t of PANEL_IMGS) imgs['panel_' + t] = await loadImage('assets/panels/' + t + '.png');
    imgs.ring = await loadImage('assets/ui/ring.png');
    for (const ch of Object.keys(OJ.CHARS)) {
      imgs['unit_' + ch] = [];
      for (let f = 0; f < 6; f++) {
        imgs['unit_' + ch].push(await loadImage(`assets/units/${ch}/${String(f).padStart(2, '0')}.png`));
      }
    }
    for (const m of ['chicken', 'roboball', 'shifu', 'manager', 'flyingcastle']) {
      imgs['unit_' + m] = [];
      for (let f = 0; f < 6; f++) {
        imgs['unit_' + m].push(await loadImage(`assets/units/${m}/${String(f).padStart(2, '0')}.png`));
      }
    }
    R.images = imgs;
    const bg = await loadImage('assets/board/clover_l.png');
    if (bg) R.bgPattern = R.ctx.createPattern(bg, 'repeat');
    for (const p of G.players) {
      const c = panelPix(p.pos);
      R.playerView[p.idx] = { x: c.x, y: c.y, frame: 0, moving: false };
    }
    requestAnimationFrame(tick);
  }

  function panel(id) { return R.G.board.panels[id]; }
  function panelPix(id) {
    const p = panel(id);
    return project(p.x, p.y);
  }

  function tintRing(color) {
    const key = 'ring_' + color;
    if (R.images[key]) return R.images[key];
    const im = R.images.ring;
    const c = document.createElement('canvas');
    c.width = im.width; c.height = im.height;
    const cx = c.getContext('2d');
    cx.drawImage(im, 0, 0);
    cx.globalCompositeOperation = 'source-in';
    cx.fillStyle = color;
    cx.fillRect(0, 0, c.width, c.height);
    R.images[key] = c;
    return c;
  }

  function diamondPath(ctx, cx, cy, w, h) {
    ctx.beginPath();
    ctx.moveTo(cx, cy - h / 2);
    ctx.lineTo(cx + w / 2, cy);
    ctx.lineTo(cx, cy + h / 2);
    ctx.lineTo(cx - w / 2, cy);
    ctx.closePath();
  }

  function drawPanel(p) {
    const { ctx, G } = R;
    const c = project(p.x, p.y);
    const w = R.tileW * 0.96, h = R.tileH * 0.96;
    const bob = Math.sin(R.t / 700 + p.id * 1.9) * 1.8;
    const cx = c.x, cy = c.y + bob;
    const t = OJ.engine.effType(G, p);

    // tile base (slightly larger dark diamond underneath = edge/thickness hint)
    diamondPath(ctx, cx, cy + 2, w * 1.02, h * 1.02);
    ctx.fillStyle = 'rgba(25,18,10,0.55)';
    ctx.fill();

    // top face: panel image mapped onto the diamond
    ctx.save();
    ctx.setTransform(w / 2, h / 2, -w / 2, h / 2, cx, cy - h / 2);
    if (p.type === 'home') {
      ctx.drawImage(R.images.panel_home, 0, 0, 1, 1);
    } else {
      const img = R.images['panel_' + t] || R.images.panel_neutral;
      ctx.drawImage(img, 0, 0, 1, 1);
    }
    ctx.restore();

    if (p.type === 'home') {
      const owner = OJ.engine.homeOwner(G, p.id);
      ctx.fillStyle = PLAYER_COLORS[owner];
      ctx.font = `bold ${Math.floor(R.tileW * 0.3)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.strokeStyle = 'rgba(0,0,0,.75)';
      ctx.lineWidth = 4;
      ctx.strokeText('P' + (owner + 1), cx, cy);
      ctx.fillText('P' + (owner + 1), cx, cy);
    }
    if (G.traps[p.id]) {
      ctx.fillStyle = 'rgba(220,40,40,0.95)';
      ctx.beginPath();
      ctx.arc(cx + w * 0.32, cy - h * 0.18, R.tileW * 0.09, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${Math.floor(R.tileW * 0.13)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('!', cx + w * 0.32, cy - h * 0.17);
    }
    const hi = R.highlights.find((hl) => hl.panelId === p.id);
    if (hi) {
      const pulse = 0.5 + 0.5 * Math.sin(R.t / 120);
      diamondPath(ctx, cx, cy, w * 1.08, h * 1.08);
      ctx.strokeStyle = `rgba(255,240,120,${0.6 + pulse * 0.4})`;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.fillStyle = `rgba(255,240,120,${0.15 + pulse * 0.12})`;
      ctx.fill();
    }
  }

  function draw() {
    const { ctx, canvas, G } = R;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // dark backdrop
    ctx.fillStyle = '#0d1116';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // grass band across the middle (like the original's field strip)
    const bandTop = R.cy - R.tileH * 1.5;
    const bandH = spanYpx() + R.tileH * 3;
    if (R.bgPattern) {
      ctx.fillStyle = R.bgPattern;
      ctx.fillRect(0, bandTop, canvas.width, bandH);
    }
    const grad = ctx.createLinearGradient(0, bandTop, 0, bandTop + bandH);
    grad.addColorStop(0, 'rgba(8,16,8,0.5)');
    grad.addColorStop(0.5, 'rgba(8,16,8,0.28)');
    grad.addColorStop(1, 'rgba(8,16,8,0.5)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, bandTop, canvas.width, bandH);
    // band edges
    ctx.fillStyle = 'rgba(255,220,150,0.10)';
    ctx.fillRect(0, bandTop - 3, canvas.width, 3);
    ctx.fillRect(0, bandTop + bandH, canvas.width, 3);

    // paths
    ctx.lineCap = 'round';
    for (const pass of [[R.tileW * 0.2, 'rgba(50,36,20,0.95)'], [R.tileW * 0.13, 'rgba(158,128,86,0.5)']]) {
      ctx.lineWidth = pass[0];
      ctx.strokeStyle = pass[1];
      for (const p of G.board.panels) {
        const a = project(p.x, p.y);
        for (const n of p.next) {
          const q = panelPix(n);
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(q.x, q.y);
          ctx.stroke();
        }
      }
    }

    // panels in painter's order (back = small gx+gy)
    const sorted = G.board.panels.slice().sort((a, b) => (a.x + a.y) - (b.x + b.y));
    for (const p of sorted) drawPanel(p);

    // players: upright billboards, sorted by depth (gx+gy).
    // KO'd players stay on their panel lying down (frame 4 is the KO pose)
    const alive = Object.keys(R.playerView).map(Number);
    const perPanel = {};
    for (const i of alive) {
      const key = G.players[i].pos;
      (perPanel[key] = perPanel[key] || []).push(i);
    }
    const withDepth = alive.map((i) => {
      const pp = panel(G.players[i].pos);
      return { i, d: pp.x + pp.y };
    }).sort((a, b) => a.d - b.d);
    for (const { i: idx } of withDepth) {
      const v = R.playerView[idx];
      if (v.blink) continue;
      const p = G.players[idx];
      const c = panelPix(p.pos);
      const group = perPanel[p.pos] || [idx];
      const gi = group.indexOf(idx);
      const spread = group.length > 1 ? (gi - (group.length - 1) / 2) * R.tileW * 0.3 : 0;
      const px = v.x + spread, py = v.y;
      const ch = p.isMobUnit ? { sprite: p.mobKind } : OJ.CHARS[p.charId];
      const frames = R.images['unit_' + ch.sprite];
      if (!frames) continue;
      const ko = !!p.ko;
      const f = frames[ko ? 4 : v.frame % frames.length];
      const s = (R.tileW * 1.05) / f.width;
      const w = f.width * s, h = f.height * s;
      const baseY = py - h * 0.72;

      // shadow
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.ellipse(px, py + R.tileH * 0.18, R.tileW * 0.26, R.tileH * 0.22, 0, 0, Math.PI * 2);
      ctx.fill();

      if (ko) {
        // KO'd: lying sprite on the panel, dimmed, no ring/name
        ctx.globalAlpha = 0.6;
        ctx.drawImage(f, px - w / 2, baseY, w, h);
        ctx.globalAlpha = 1;
        continue;
      }

      const active = G.players[G.turnIdx] === p;
      const ring = tintRing(PLAYER_COLORS[idx]);
      const rw = R.tileW * (active ? 0.92 + Math.sin(R.t / 180) * 0.05 : 0.78);
      ctx.drawImage(ring, px - rw / 2, py + R.tileH * 0.1 - rw / 2, rw, rw);
      ctx.drawImage(f, px - w / 2, baseY, w, h);
      ctx.font = `bold ${Math.max(11, Math.floor(R.tileW * 0.16))}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(0,0,0,0.72)';
      const nm = OJ.charName(p.charId);
      const tw = ctx.measureText(nm).width + 10;
      const ty = baseY - R.tileH * 0.34;
      ctx.fillRect(px - tw / 2, ty, tw, R.tileH * 0.44);
      ctx.fillStyle = PLAYER_COLORS[idx];
      ctx.fillText(nm, px, ty + R.tileH * 0.22);
    }

    R.fx = R.fx.filter((fx) => R.t - fx.t0 < fx.dur);
    for (const fx of R.fx) {
      const k = (R.t - fx.t0) / fx.dur;
      if (fx.type === 'rollCut') {
        drawRollCut(fx, k);
        continue;
      }
      if (fx.type === 'dice') {
        // dice popup showing the actual faces (recovery rolls etc.)
        if (k < 0 || k > 1) continue;
        const n = fx.dice.length;
        const size = Math.min(64, R.tileW * 0.62), gap = 8;
        const totalW = n * size + (n - 1) * gap;
        const rise = k * 26;
        for (let i = 0; i < n; i++) {
          const x = fx.x - totalW / 2 + i * (size + gap) + size / 2;
          const y = fx.y - rise;
          const img = dieFaceImg(fx.dice[i]);
          if (img && img.complete && img.naturalWidth) {
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate((1 - Math.min(1, k * 2)) * 0.35);
            ctx.drawImage(img, -size / 2, -size / 2, size, size);
            ctx.restore();
          }
        }
        ctx.font = `bold ${Math.floor(size * 0.55)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillStyle = fx.color || '#ffd25a';
        ctx.strokeStyle = 'rgba(0,0,0,.85)';
        ctx.lineWidth = 4;
        ctx.strokeText(fx.roll, fx.x, fx.y - rise - size * 0.72);
        ctx.fillText(fx.roll, fx.x, fx.y - rise - size * 0.72);
        continue;
      }
      ctx.globalAlpha = 1 - k;
      ctx.font = `bold ${fx.size || 24}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillStyle = fx.color || '#fff';
      ctx.strokeStyle = 'rgba(0,0,0,0.85)';
      ctx.lineWidth = 5;
      ctx.strokeText(fx.text, fx.x, fx.y - k * 34);
      ctx.fillText(fx.text, fx.x, fx.y - k * 34);
      ctx.globalAlpha = 1;
    }
  }

  function spanYpx() {
    return (R.G.board.cols + R.G.board.rows - 2) * R.tileH / 2;
  }

  function tick(t) {
    R.t = t;
    for (const idx in R.playerView) {
      const v = R.playerView[idx];
      // walk cycle: frame 0 (stand) <-> frame 5 (step) — the other frames
      // are emotes (cheer/hurt/pose/KO) and don't belong in walking
      if (v.moving && t - (v.lastFrame || 0) > 110) {
        v.frame = v.frame === 5 ? 0 : 5;
        v.lastFrame = t;
      } else if (!v.moving) v.frame = 0;
    }
    draw();
    requestAnimationFrame(tick);
  }

  const wait = (ms) => new Promise((r) => setTimeout(r, Math.max(1, ms * R.speed)));

  async function animateMove(G, p, panelId) {
    const v = R.playerView[p.idx];
    const target = panelPix(panelId);
    const sx = v.x, sy = v.y;
    const dx = target.x - sx, dy = target.y - sy;
    const steps = 7;
    v.moving = true;
    for (let i = 1; i <= steps; i++) {
      v.x = sx + (dx * i) / steps;
      v.y = sy + (dy * i) / steps;
      await wait(24);
    }
    v.x = target.x; v.y = target.y;
    v.moving = false;
  }

  async function animateTeleport(G, p) {
    const v = R.playerView[p.idx];
    v.moving = false;
    const target = panelPix(p.pos);
    v.blink = true;
    await wait(120);
    v.x = target.x; v.y = target.y;
    await wait(120);
    v.blink = false;
  }

  // small dice popup above a panel (used for recovery rolls): shows the
  // actual face immediately, green ring on success / red on fail via color
  function animateDice(panelId, dice, roll, color) {
    const c = panelPix(panelId);
    for (const d of dice) dieFaceImg(d);
    R.fx.push({
      type: 'dice', x: c.x, y: c.y - R.tileH * 1.2, dice, roll,
      color: color || '#ffd25a', t0: R.t, dur: 1100,
    });
  }

  // ---- roll cutscene (original-style): the character slides in close-up,
  // winds up and throws; the dice fly out tumbling and settle on the ACTUAL
  // rolled faces (assets/ui/dice/1..6.png from the game files). ----
  const DIE_FACES = [null, 'assets/ui/dice/1.png', 'assets/ui/dice/2.png', 'assets/ui/dice/3.png',
    'assets/ui/dice/4.png', 'assets/ui/dice/5.png', 'assets/ui/dice/6.png'];

  function dieFaceImg(val) {
    const key = 'die' + val;
    if (!R.images[key]) {
      const im = new Image();
      im.src = DIE_FACES[val];
      R.images[key] = im; // may not be decoded yet; drawImage skips broken imgs
    }
    return R.images[key];
  }

  function startRollCutscene(G, p, dice, roll) {
    for (const d of dice) dieFaceImg(d); // start decoding needed faces
    const c = panelPix(p.pos);
    R.fx.push({
      type: 'rollCut', dice, roll,
      px: c.x, py: c.y,
      sprite: OJ.CHARS[p.charId] ? OJ.CHARS[p.charId].sprite : 'qp',
      color: PLAYER_COLORS[p.idx],
      name: OJ.charName(p.charId),
      t0: R.t, dur: 2300,
    });
  }

  function drawRollCut(fx, k) {
    const ctx = R.ctx, W = R.canvas.width, H = R.canvas.height;
    // dim the board, fading out at the very end
    const dim = 0.52 * Math.min(1, k * 5) * (k > 0.9 ? (1 - k) / 0.1 : 1);
    ctx.fillStyle = `rgba(6,8,12,${dim})`;
    ctx.fillRect(0, 0, W, H);

    // ---------- character close-up (right side, facing left) ----------
    const frames = R.images['unit_' + fx.sprite];
    let handX = W * 0.7, handY = H * 0.42;
    if (frames && frames[0] && frames[0].width) {
      const f0 = frames[0];
      const scale = Math.max(2.0, (H * 0.6) / f0.height);
      const w = f0.width * scale, h = f0.height * scale;
      const slide = Math.min(1, k / 0.14);
      const ease = 1 - Math.pow(1 - slide, 3);
      const bx = W + w * 0.4 - (w * 0.95 + W * 0.24) * ease; // slides in from the right
      const by = H * 0.82;
      // pose: walk-cycle while sliding (frames 0/5), stand (0) for the
      // windup, arm raised (1) for the throw
      let rot = 0, fi = 0;
      if (k < 0.2) fi = Math.floor(k * 30) % 2 === 0 ? 0 : 5;
      else if (k < 0.34) { fi = 0; rot = 0.14 * ((k - 0.2) / 0.14); }
      else { fi = 1; rot = -0.1 * Math.min(1, (k - 0.34) / 0.1); }
      const f = frames[fi] || f0;
      ctx.save();
      ctx.translate(bx + w / 2, by);
      ctx.rotate(rot);
      // colored glow behind the character
      const gr = ctx.createRadialGradient(0, -h * 0.45, 10, 0, -h * 0.45, w * 0.8);
      gr.addColorStop(0, fx.color + '55');
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gr;
      ctx.fillRect(-w, -h * 1.35, w * 2, h * 1.6);
      ctx.drawImage(f, -w / 2, -h, w, h);
      ctx.restore();
      // throwing hand: sprite's leading arm, roughly chest height
      handX = bx + w * 0.2;
      handY = by - h * 0.58;
      // name tag (left of the character, above dice height)
      ctx.font = `bold ${Math.floor(H * 0.03)}px sans-serif`;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      const nw = ctx.measureText(fx.name).width + 18;
      const nx = bx - w * 0.02;
      ctx.fillStyle = 'rgba(0,0,0,.72)';
      ctx.fillRect(nx - nw, by - h * 1.02, nw, H * 0.044);
      ctx.fillStyle = fx.color;
      ctx.fillText(fx.name, nx - 9, by - h * 1.02 + H * 0.023);
    }

    // ---------- dice: fly from the hand, tumble, settle on real faces ----------
    const dk = (k - 0.3) / 0.62; // dice active between k=0.3 and k=0.92
    if (dk > 0) {
      const n = fx.dice.length;
      const size = Math.min(150, W * 0.13) * (n > 1 ? 0.72 : 1);
      const gap = size * 0.26;
      const totalW = n * size + (n - 1) * gap;
      const cxT = W * 0.4, cyT = H * 0.34;
      const settleAt = 0.6;
      for (let i = 0; i < n; i++) {
        const tx = cxT - totalW / 2 + i * (size + gap) + size / 2;
        let x, y, rot, val;
        if (dk < settleAt) {
          // arc from the hand to the settle spot while tumbling random faces
          const t = dk / settleAt;
          const e = t * t * (3 - 2 * t);
          x = handX + (tx - handX) * e;
          y = handY + (cyT - handY) * e - Math.sin(t * Math.PI) * H * 0.12;
          rot = (1 - t) * 2.2 + i * 0.6;
          val = 1 + (Math.floor((R.t - fx.t0) / 85) * 5 + i * 3) % 6; // deterministic tumble
        } else {
          // settled: the ACTUAL rolled face, small landing bounce
          const t = (dk - settleAt) / (1 - settleAt);
          const bounce = Math.abs(Math.sin(t * Math.PI * 2)) * size * 0.16 * (1 - t);
          x = tx;
          y = cyT - bounce;
          rot = (1 - Math.min(1, t * 3)) * 0.3;
          val = fx.dice[i];
        }
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.beginPath();
        ctx.ellipse(x, cyT + size * 0.55, size * 0.4, size * 0.1, 0, 0, Math.PI * 2);
        ctx.fill();
        const img = dieFaceImg(val);
        if (img && img.complete && img.naturalWidth) {
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(rot);
          ctx.drawImage(img, -size / 2, -size / 2, size, size);
          ctx.restore();
        }
      }
      if (dk >= settleAt) {
        ctx.font = `bold ${Math.floor(size * 0.5)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.strokeStyle = 'rgba(0,0,0,.9)';
        ctx.lineWidth = 7;
        ctx.fillStyle = '#ffd25a';
        const ty = cyT + size * 0.95;
        ctx.strokeText(fx.roll, cxT, ty);
        ctx.fillText(fx.roll, cxT, ty);
      }
    }
  }

  function popTextAt(panelId, text, color, size) {
    const c = panelPix(panelId);
    R.fx.push({ text, x: c.x, y: c.y - R.tileH, color, size, t0: R.t, dur: 950 });
  }

  function popText(text, x, y, color, size) {
    R.fx.push({ text, x, y, color, size, t0: R.t, dur: 950 });
  }

  function setHighlights(list, cb) {
    R.highlights = list || [];
    R.highlightCb = cb || null;
  }

  function canvasClick(x, y) {
    if (!R.highlights.length) return false;
    let best = null, bestD = Infinity;
    for (const h of R.highlights) {
      const c = panelPix(h.panelId);
      // elliptical distance in isometric space
      const dx = (c.x - x) / (R.tileW * 0.55);
      const dy = (c.y - y) / (R.tileH * 0.75);
      const d = Math.hypot(dx, dy);
      if (d < 1 && d < bestD) { bestD = d; best = h; }
    }
    if (best) {
      const cb = R.highlightCb;
      setHighlights([], null);
      if (cb) cb(best.panelId);
      return true;
    }
    return false;
  }

  OJ.render = { init, animateMove, animateTeleport, animateDice, startRollCutscene, popText, popTextAt, setHighlights, canvasClick, R, PLAYER_COLORS, wait };
})();
