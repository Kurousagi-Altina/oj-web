/* Grid board definitions, transcribed from official wiki layout images
   (https://100orangejuice.fandom.com/wiki/<Board> — Layout / panel tables) */
(function () {
  'use strict';
  const OJ = (globalThis.OJ = globalThis.OJ || {});

  // helper: build board from ascii-ish coordinate list
  // panels: [x, y, type]; edges: [fromX,fromY,toX,toY]; homes: panel coords for P1..P4
  function build(def) {
    const panels = def.panels.map(([x, y, type], i) => ({ id: i, x, y, type, next: [] }));
    const idx = {};
    panels.forEach((p) => { idx[p.x + ',' + p.y] = p.id; });
    for (const [a, b] of def.edges) {
      panels[idx[a]].next.push(panels[idx[b]].id);
    }
    const homes = def.homes.map((c) => idx[c]);
    return {
      panels, homes,
      name: def.name, nameZh: def.nameZh, bg: def.bg,
      boss: def.boss, events: def.events || [],
      cols: Math.max(...panels.map((p) => p.x)) + 1,
      rows: Math.max(...panels.map((p) => p.y)) + 1,
    };
  }

  OJ.BOARDS = {
    // ============ Clover (wiki: 4 Home, 8 Bonus, 4 Draw, 4 Draw(x2),
    // 4 Drop(x2), 8 Encounter, 4 Move, 4 Warp — 40 panels) ============
    clover: build({
      name: 'Clover', nameZh: '三叶草', bg: 'clover', boss: 'shifu',
      events: [{ id: 'miracle', every: 5 }, { id: 'backtrack', every: 8 }],
      homes: ['2,1', '7,2', '1,6', '6,7'],
      panels: [
        [2, 0, 'drop2'], [3, 0, 'bonus'], [4, 0, 'encounter'], [5, 0, 'draw'],
        [2, 1, 'home'], [5, 1, 'move'],
        [2, 2, 'encounter'], [3, 2, 'draw2'], [4, 2, 'warp'], [5, 2, 'bonus'], [6, 2, 'encounter'], [7, 2, 'home'], [8, 2, 'drop2'],
        [0, 3, 'draw'], [1, 3, 'move'], [2, 3, 'bonus'], [6, 3, 'draw2'], [8, 3, 'bonus'],
        [0, 4, 'encounter'], [2, 4, 'warp'], [6, 4, 'warp'], [8, 4, 'encounter'],
        [0, 5, 'bonus'], [2, 5, 'draw2'], [6, 5, 'bonus'], [7, 5, 'move'], [8, 5, 'draw'],
        [0, 6, 'drop2'], [1, 6, 'home'], [2, 6, 'encounter'], [3, 6, 'bonus'], [4, 6, 'warp'], [5, 6, 'draw2'], [6, 6, 'encounter'],
        [3, 7, 'move'], [6, 7, 'home'],
        [3, 8, 'draw'], [4, 8, 'encounter'], [5, 8, 'bonus'], [6, 8, 'drop2'],
      ],
      edges: [
        // main loop (counterclockwise)
        ['2,0', '2,1'], ['2,1', '2,2'], ['2,2', '2,3'], ['2,3', '1,3'], ['1,3', '0,3'],
        ['0,3', '0,4'], ['0,4', '0,5'], ['0,5', '0,6'], ['0,6', '1,6'], ['1,6', '2,6'],
        ['2,6', '3,6'], ['3,6', '3,7'], ['3,7', '3,8'], ['3,8', '4,8'], ['4,8', '5,8'],
        ['5,8', '6,8'], ['6,8', '6,7'], ['6,7', '6,6'], ['6,6', '6,5'], ['6,5', '7,5'],
        ['7,5', '8,5'], ['8,5', '8,4'], ['8,4', '8,3'], ['8,3', '8,2'], ['8,2', '7,2'],
        ['7,2', '6,2'], ['6,2', '5,2'], ['5,2', '5,1'], ['5,1', '5,0'], ['5,0', '4,0'],
        ['4,0', '3,0'], ['3,0', '2,0'],
        // 4 inner shortcuts (each: Warp + Draw(x2) bypassing a home stub)
        ['2,3', '2,4'], ['2,4', '2,5'], ['2,5', '2,6'],
        ['3,6', '4,6'], ['4,6', '5,6'], ['5,6', '6,6'],
        ['6,5', '6,4'], ['6,4', '6,3'], ['6,3', '6,2'],
        ['5,2', '4,2'], ['4,2', '3,2'], ['3,2', '2,2'],
      ],
    }),

    // ============ Practice Field (36 panels) ============
    practice: build({
      name: 'Practice Field', nameZh: '练习场', bg: 'clover', boss: 'manager',
      events: [],
      homes: ['2,2', '6,2', '6,6', '2,6'],
      panels: [
        [3, 0, 'bonus'], [4, 0, 'warp'], [5, 0, 'drop2'],
        [3, 1, 'draw'], [5, 1, 'draw'],
        [2, 2, 'home'], [3, 2, 'encounter'], [4, 2, 'draw'], [5, 2, 'bonus'], [6, 2, 'home'],
        [0, 3, 'encounter'], [1, 3, 'bonus'], [2, 3, 'draw'], [6, 3, 'encounter'], [7, 3, 'draw'], [8, 3, 'bonus'],
        [0, 4, 'warp'], [2, 4, 'bonus'], [6, 4, 'bonus'], [8, 4, 'warp'],
        [0, 5, 'bonus'], [1, 5, 'draw'], [2, 5, 'drop2'], [6, 5, 'draw'], [7, 5, 'bonus'], [8, 5, 'drop2'],
        [2, 6, 'home'], [3, 6, 'bonus'], [4, 6, 'draw'], [5, 6, 'encounter'], [6, 6, 'home'],
        [3, 7, 'draw'], [5, 7, 'draw'],
        [3, 8, 'drop2'], [4, 8, 'warp'], [5, 8, 'bonus'],
      ],
      edges: [
        // main loop (clockwise)
        ['2,2', '2,3'], ['2,3', '1,3'], ['1,3', '0,3'], ['0,3', '0,4'], ['0,4', '0,5'],
        ['0,5', '1,5'], ['1,5', '2,5'], ['2,5', '2,6'], ['2,6', '3,6'], ['3,6', '4,6'],
        ['4,6', '5,6'], ['5,6', '6,6'], ['6,6', '6,5'], ['6,5', '7,5'], ['7,5', '8,5'],
        ['8,5', '8,4'], ['8,4', '8,3'], ['8,3', '7,3'], ['7,3', '6,3'], ['6,3', '6,2'],
        ['6,2', '5,2'], ['5,2', '4,2'], ['4,2', '3,2'], ['3,2', '2,2'],
        // 4 shortcuts
        ['2,3', '2,4'], ['2,4', '2,5'],
        ['3,2', '3,1'], ['3,1', '3,0'], ['3,0', '4,0'], ['4,0', '5,0'], ['5,0', '5,1'], ['5,1', '5,2'],
        ['6,3', '6,4'], ['6,4', '6,5'],
        ['3,6', '3,7'], ['3,7', '3,8'], ['3,8', '4,8'], ['4,8', '5,8'], ['5,8', '5,7'], ['5,7', '5,6'],
      ],
    }),

    // ============ Space Wanderer (wiki: 12 Bonus, 8 Draw, 4 Drop(x2),
    // 4 Encounter, 12 Warp, 4 Home — 44 panels; event: Random Warp) ============
    spacewanderer: build({
      name: 'Space Wanderer', nameZh: '太空流浪者', bg: 'clover', boss: 'manager',
      events: [{ id: 'randomwarp', every: 5 }],
      homes: ['2,2', '6,2', '6,6', '2,6'],
      panels: [
        [0, 0, 'drop2'], [1, 0, 'bonus'], [2, 0, 'warp'], [6, 0, 'warp'], [7, 0, 'draw'], [8, 0, 'drop2'],
        [0, 1, 'draw'], [2, 1, 'encounter'], [3, 1, 'bonus'], [4, 1, 'warp'], [5, 1, 'draw'], [6, 1, 'bonus'], [8, 1, 'bonus'],
        [0, 2, 'warp'], [1, 2, 'bonus'], [2, 2, 'home'], [6, 2, 'home'], [7, 2, 'encounter'], [8, 2, 'warp'],
        [1, 3, 'draw'], [7, 3, 'bonus'],
        [1, 4, 'warp'], [7, 4, 'warp'],
        [1, 5, 'bonus'], [7, 5, 'draw'],
        [0, 6, 'warp'], [1, 6, 'encounter'], [2, 6, 'home'], [6, 6, 'home'], [7, 6, 'bonus'], [8, 6, 'warp'],
        [0, 7, 'bonus'], [2, 7, 'bonus'], [3, 7, 'draw'], [4, 7, 'warp'], [5, 7, 'bonus'], [6, 7, 'encounter'], [8, 7, 'draw'],
        [0, 8, 'drop2'], [1, 8, 'draw'], [2, 8, 'warp'], [6, 8, 'warp'], [7, 8, 'bonus'], [8, 8, 'drop2'],
      ],
      edges: [
        // main loop (counterclockwise)
        ['2,2', '1,2'], ['1,2', '1,3'], ['1,3', '1,4'], ['1,4', '1,5'], ['1,5', '1,6'],
        ['1,6', '2,6'], ['2,6', '2,7'], ['2,7', '3,7'], ['3,7', '4,7'], ['4,7', '5,7'],
        ['5,7', '6,7'], ['6,7', '6,6'], ['6,6', '7,6'], ['7,6', '7,5'], ['7,5', '7,4'],
        ['7,4', '7,3'], ['7,3', '7,2'], ['7,2', '6,2'], ['6,2', '6,1'], ['6,1', '5,1'],
        ['5,1', '4,1'], ['4,1', '3,1'], ['3,1', '2,1'], ['2,1', '2,2'],
        // outer shortcuts
        ['1,6', '0,6'], ['0,6', '0,7'], ['0,7', '0,8'], ['0,8', '1,8'], ['1,8', '2,8'], ['2,8', '2,7'],
        ['6,7', '6,8'], ['6,8', '7,8'], ['7,8', '8,8'], ['8,8', '8,7'], ['8,7', '8,6'], ['8,6', '7,6'],
        ['6,2', '7,2'], ['7,2', '8,2'], ['8,2', '8,1'], ['8,1', '8,0'], ['8,0', '7,0'], ['7,0', '6,0'], ['6,0', '6,1'],
        ['2,1', '2,0'], ['2,0', '1,0'], ['1,0', '0,0'], ['0,0', '0,1'], ['0,1', '0,2'], ['0,2', '1,2'],
      ],
    }),
  };

  OJ.buildBoardById = function (id) {
    const def = OJ.BOARDS[id] || OJ.BOARDS.clover;
    const b = def; // already built
    return b;
  };
})();
