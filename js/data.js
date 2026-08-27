/* 100% Orange Juice web replica - game data */
(function () {
  'use strict';
  const OJ = (globalThis.OJ = globalThis.OJ || {});
  OJ.lang = 'zh';

  // ---- characters (stats from official wiki) ----
  OJ.CHARS = {
    qp:     { name: 'QP',     nameZh: 'QP',    hp: 5, atk: 0,  def: 0,  evd: 0,  rec: 5, hyper: 'HYPER_QP',   maxHand: 3, unitKey: 'CARD_UNIT_QP',
              passive: 'None', passiveZh: '无', sprite: 'qp' },
    suguri: { name: 'Suguri', nameZh: '须玖莉', hp: 4, atk: 1,  def: -1, evd: 2,  rec: 5, hyper: 'HYPER_SUGURI', maxHand: 3, unitKey: 'CARD_UNIT_SUGURI',
              passive: 'None', passiveZh: '无', sprite: 'suguri' },
    marc:   { name: 'Marc',   nameZh: '玛露',   hp: 4, atk: 1,  def: 1,  evd: -1, rec: 5, hyper: 'HYPER_MARC', maxHand: 3, unitKey: 'CARD_UNIT_MARC',
              passive: 'None', passiveZh: '无', sprite: 'marc' },
    kai:    { name: 'Kai',    nameZh: '凯',    hp: 5, atk: 1,  def: 0,  evd: 0,  rec: 5, hyper: 'HYPER_KAI',  maxHand: 3, unitKey: 'CARD_UNIT_KAI',
              passive: 'None', passiveZh: '无', sprite: 'kai' },
    aru:    { name: 'Aru',    nameZh: '亚露',   hp: 5, atk: -1, def: -1, evd: 2,  rec: 5, hyper: 'HYPER_ARU',  maxHand: 4, unitKey: 'CARD_UNIT_ARU',
              passive: 'Can hold 4 cards', passiveZh: '手牌上限4张', sprite: 'aru' },
    hime:   { name: 'Hime',   nameZh: '姬梅',   hp: 5, atk: 1,  def: -1, evd: 1,  rec: 5, hyper: 'HYPER_HIME', maxHand: 3, unitKey: 'CARD_UNIT_HIME',
              passive: 'None', passiveZh: '无', sprite: 'hime' },
    yuki:   { name: 'Yuki',   nameZh: '由希',   hp: 5, atk: 2,  def: -1, evd: -1, rec: 5, hyper: 'HYPER_YUKI', maxHand: 3, unitKey: 'CARD_UNIT_YUKI',
              passive: 'None', passiveZh: '无', sprite: 'yuki' },
    sora:   { name: 'Sora',   nameZh: '优空',   hp: 4, atk: 1,  def: 0,  evd: 1,  rec: 5, hyper: 'HYPER_SORA', maxHand: 3, unitKey: 'CARD_UNIT_SORA',
              passive: 'None', passiveZh: '无', sprite: 'sora' },
    peat:   { name: 'Peat',   nameZh: '彼特',   hp: 3, atk: 1,  def: 1,  evd: 1,  rec: 4, hyper: 'HYPER_PEAT', maxHand: 3, unitKey: 'CARD_UNIT_PEAT',
              passive: 'None', passiveZh: '无', sprite: 'peat' },
    poppo:  { name: 'Marie Poppo', nameZh: '玛丽啵噗', hp: 7, atk: -1, def: -1, evd: -1, rec: 5, hyper: 'HYPER_POPPO', maxHand: 3, unitKey: 'CARD_UNIT_POPPO',
              passive: 'None', passiveZh: '无', sprite: 'poppo' },
    tomomo: { name: 'Tomomo', nameZh: '兔萌萌', hp: 4, atk: 2,  def: 0,  evd: 0,  rec: 6, hyper: 'HYPER_TOMOMO', maxHand: 3, unitKey: 'CARD_UNIT_TOMOMO',
              passive: 'None', passiveZh: '无', sprite: 'tomomo' },
  };

  // ---- mobs (official stats from wiki) ----
  OJ.MOBS = {
    chicken:  { name: 'Chicken',   nameZh: '小鸡',     hp: 3, atk: -1, def: -1, evd: 1,  sprite: 'chicken' },
    roboball: { name: 'Robo Ball', nameZh: '机器球',   hp: 3, atk: -1, def: 1,  evd: -1, sprite: 'roboball' },
    seagull:  { name: 'Seagull',   nameZh: '海鸥',     hp: 3, atk: 1,  def: -1, evd: -1, sprite: 'seagull' },
    // boss variants — wiki "<Boss>" pages, NOT the playable character stats
    shifu:        { name: 'Shifu Robot',   nameZh: '师傅机器人', hp: 7,  atk: 2, def: 3, evd: -2, sprite: 'shifu', boss: true },
    manager:      { name: 'Store Manager', nameZh: '店长',      hp: 8,  atk: 3, def: 2, evd: -1, sprite: 'manager', boss: true },
    flyingcastle: { name: 'Flying Castle', nameZh: '飞天城堡',  hp: 10, atk: 2, def: 1, evd: -3, sprite: 'flyingcastle', boss: true },
  };

  // ---- norma requirements ----
  // Stars: Lv1->2=10, 2->3=30, 3->4=70, 4->5=120, 5->6=200.
  // Wins: only offered from Lv2 onward (wiki/Norma table) — the first win
  // objective is 2 wins (Lv2->3), then 5, 9, 14.
  OJ.STAR_NORMA = [10, 30, 70, 120, 200];
  OJ.WIN_NORMA = [2, 5, 9, 14];

  const T = { BOOST: 'Boost', BATTLE: 'Battle', TRAP: 'Trap', EVENT: 'Event', HYPER: 'Hyper' };

  const C = {};
  function card(id, o) { o.id = id; C[id] = o; return o; }

  card('DASH',        { name: 'Dash!', type: T.BOOST, cost: 3, lvl: 1, art: 'DASH', key: 'CARD_BOOST_DASH',
    descr: 'For this turn, roll two dice for movement.' });
  card('EXTEND',      { name: 'Extend', type: T.BOOST, cost: 10, lvl: 3, art: 'EXTEND', key: 'CARD_BOOST_EXTEND', stock: true,
    descr: 'Stock Effect\nAfter suffering KO, you will revive on the following turn.' });
  card('FLIPOUT',     { name: 'Flip Out', type: T.BOOST, cost: 0, lvl: 1, art: 'FLIPOUT', key: 'CARD_BOOST_FLIPOUT', stock: true,
    descr: 'Stock Effect\nNext time you land on a drop panel, the player(s) with the highest number of stars will lose the same number of stars as you.' });
  card('LONGSHOT',    { name: 'Long-Distance Shot', type: T.BOOST, cost: 5, lvl: 1, art: 'LONGSHOT', key: 'CARD_BOOST_LONGSHOT', target: 'enemy',
    descr: 'Deals 1 damage to the selected enemy unit.' });
  card('NICEJINGLE',  { name: 'Nice Jingle', type: T.BOOST, cost: 0, lvl: 1, art: 'NICEJINGLE', key: 'CARD_BOOST_NICEJINGLE', stock: true,
    descr: 'Stock Effect.\nThe next bonus panel gives you twice as many stars.' });
  card('NICEPRESENT', { name: 'Nice Present', type: T.BOOST, cost: 10, lvl: 2, art: 'NICEPRESENT', key: 'CARD_BOOST_NICEPRESENT',
    descr: 'Draw 2 cards.' });
  card('PRINCESS',    { name: "Princess's Privilege", type: T.BOOST, cost: 20, lvl: 4, art: 'PRINCESS', key: 'CARD_BOOST_PRINCESS',
    descr: "Discard all cards in your hand and draw 3 cards.\nCan only be used when holding only Princess's Privilege or you have at least 3 cards in your hand." });
  card('PUDDING',     { name: 'Pudding', type: T.BOOST, cost: 0, lvl: 4, art: 'PUDDING', key: 'CARD_BOOST_PUDDING',
    descr: 'Fully restore HP.' });
  card('COOKIE',      { name: "Saki's Cookie", type: T.BOOST, cost: 0, lvl: 1, art: 'COOKIE', key: 'CARD_BOOST_COOKIE',
    descr: 'Heals 1 HP.' });

  card('BIGMAGNUM',   { name: 'Big Magnum', type: T.BATTLE, cost: 20, lvl: 3, art: 'BIGMAGNUM', key: 'CARD_BATTLE_BIGMAGNUM', battle: 'self',
    descr: 'Pay 1 HP when you use this card. During this battle, gain +2 ATK. If you would suffer KO from using this card, the card cannot be used.' });
  card('FINALBATTLE', { name: 'Final Battle', type: T.BATTLE, cost: 30, lvl: 4, art: 'FINALBATTLE', key: 'CARD_BATTLE_FINALBATTLE', battle: 'field',
    descr: 'This battle will last until either unit suffers KO (Maximum of 10 rounds).' });
  card('ONFIRE',      { name: "I'm on Fire!", type: T.BATTLE, cost: 5, lvl: 1, art: 'ONFIRE', key: 'CARD_BATTLE_ONFIRE', battle: 'self',
    descr: 'During this battle,\ngain +1 ATK and -1 DEF.' });
  card('RAINBOW',     { name: 'Rainbow-Colored Circle', type: T.BATTLE, cost: 5, lvl: 2, art: 'RAINBOW', key: 'CARD_BATTLE_RAINBOW', battle: 'self',
    descr: 'During this battle, gain +2 EVD and -1 DEF.' });
  card('RBITS',       { name: 'Rbits', type: T.BATTLE, cost: 3, lvl: 2, art: 'RBITS', key: 'CARD_BATTLE_RBITS', battle: 'self',
    descr: 'During this battle, gain +2 DEF. You may not use the Evade command.' });
  card('REVERSE',     { name: 'Reverse Attribute Field', type: T.BATTLE, cost: 10, lvl: 3, art: 'REVERSE', key: 'CARD_BATTLE_REVERSE', battle: 'field',
    descr: 'During this battle, the positive and negative values of each ability of both units are inverted after adjustment.' });
  card('SHIELD',      { name: 'Shield', type: T.BATTLE, cost: 5, lvl: 3, art: 'SHIELD', key: 'CARD_BATTLE_SHIELD', battle: 'self', defenderOnly: true,
    descr: 'Gain +3 DEF during this battle. However, you may not attack. May only be used by the defender.' });

  card('ASSAULT',     { name: 'Assault', type: T.TRAP, cost: 0, lvl: 2, art: 'ASSAULT', key: 'CARD_TRAP_ASSAULT',
    descr: 'Battle the player who set this card, starting with their attack.' });
  card('GOAWAY',      { name: 'Go Away', type: T.TRAP, cost: 0, lvl: 1, art: 'GOAWAY', key: 'CARD_TRAP_GOAWAY',
    descr: 'You are moved to a randomly chosen panel.' });
  card('HEAT300',     { name: 'Heat 300%', type: T.TRAP, cost: 0, lvl: 1, art: 'HEAT300', key: 'CARD_TRAP_HEAT300', stock: true,
    descr: 'Stock Effect(1):\nIn the next battle, gain -2 DEF.' });
  card('MIMYUU',      { name: "Mimyuu's Hammer", type: T.TRAP, cost: 0, lvl: 1, art: 'MIMYUU', key: 'CARD_TRAP_MIMYUU',
    descr: 'Deals 1 damage.' });
  card('PIGGYBANK',   { name: 'Piggy Bank', type: T.TRAP, cost: 0, lvl: 1, art: 'PIGGYBANK', key: 'CARD_TRAP_PIGGYBANK',
    descr: 'Gain stars equal to five times the number of chapters passed since this card was set.' });
  card('TOYSTORE',    { name: 'For the Future of the Toy Store', type: T.TRAP, cost: 0, lvl: 2, art: 'TOYSTORE', key: 'CARD_TRAP_TOYSTORE',
    descr: 'Lose half your stars. The player who set this card will gain the lost stars. This card can only be used with less than 50 stars.' });
  card('PURES',       { name: "Sky Restaurant 'Pures'", type: T.TRAP, cost: 0, lvl: 4, art: 'PURES', key: 'CARD_TRAP_PURES',
    descr: 'Lose half your stars and fully restore HP.' });
  card('TRAGEDY',     { name: 'Tragedy in the Dead of Night', type: T.TRAP, cost: 0, lvl: 3, art: 'TRAGEDY', key: 'CARD_TRAP_TRAGEDY',
    descr: 'Discard a random card. That card will go to the player who set this card.' });

  card('SEAGULLS',    { name: 'Cloud of Seagulls', type: T.EVENT, cost: 0, lvl: 1, art: 'SEAGULLS', key: 'CARD_EVENT_SEAGULLS',
    descr: 'A randomly chosen unit will receive 2 damage.' });
  card('DINNER',      { name: 'Dinner', type: T.EVENT, cost: 10, lvl: 3, art: 'DINNER', key: 'CARD_EVENT_DINNER',
    descr: 'Heals all units for 3 HP.' });
  card('FORCEDREVIVAL', { name: 'Forced Revival', type: T.EVENT, cost: 30, lvl: 3, art: 'FORCEDREVIVAL', key: 'CARD_EVENT_FORCEDREVIVAL',
    descr: 'All units suffering KO are revived with 1 HP.' });
  card('HOLYNIGHT',   { name: 'Holy Night', type: T.EVENT, cost: 0, lvl: 1, art: 'HOLYNIGHT', key: 'CARD_EVENT_HOLYNIGHT',
    descr: 'Permanent Effect\nStart-of-chapter bonus stars are increased by one.' });
  card('LITTLEWAR',   { name: 'Little War', type: T.EVENT, cost: 50, lvl: 4, art: 'LITTLEWAR', key: 'CARD_EVENT_LITTLEWAR',
    descr: 'Effect Duration: 3 chapters\nOffense and defense will happen twice in all battles.' });
  card('OHMYFRIEND',  { name: 'Oh My Friend', type: T.EVENT, cost: 30, lvl: 1, art: 'OHMYFRIEND', key: 'CARD_EVENT_OHMYFRIEND',
    descr: 'A boss will show up.' });
  card('OUTOFAMMO',   { name: 'Out of Ammo', type: T.EVENT, cost: 5, lvl: 2, art: 'OUTOFAMMO', key: 'CARD_EVENT_OUTOFAMMO',
    descr: 'Effect Duration: 1 chapter\nNo player may use any cards.' });
  card('SEALEDGUARDIAN', { name: 'Sealed Guardian', type: T.EVENT, cost: 50, lvl: 5, art: 'SEALEDGUARDIAN', key: 'CARD_EVENT_SEALEDGUARDIAN',
    descr: "Every unit's HP becomes 1." });
  card('ALLOUTMODE',  { name: 'Super All-Out Mode', type: T.EVENT, cost: 30, lvl: 3, art: 'ALLOUTMODE', key: 'CARD_EVENT_ALLOUTMODE', stock: true,
    descr: 'Stock Effect\nAll units gain +2 ATK during their next battle.' });
  card('WARUDA',      { name: 'We Are Waruda', type: T.EVENT, cost: 5, lvl: 2, art: 'WARUDA', key: 'CARD_EVENT_WARUDA',
    descr: 'Move all trap cards onto randomly chosen panels.' });

  card('HYPER_QP',     { name: 'Hyper Mode', type: T.HYPER, cost: 10, lvl: 1, art: 'HYPER_QP', key: 'CARD_HYPER_QP', battle: 'self', hyper: 'qp',
    descr: 'Gain +3 ATK during this battle. If your unit suffers KO during this battle, you give no stars or Wins and the unit will revive next turn.' });
  card('HYPER_SUGURI', { name: 'Accelerator', type: T.HYPER, cost: 30, lvl: 3, art: 'HYPER_SUGURI', key: 'CARD_HYPER_SUGURI', hyper: 'suguri',
    descr: 'Effect Duration: 1 chapter\nRoll two dice for movement, battle, bonus and drop.' });
  card('HYPER_MARC',   { name: 'x16 Big Rocket', type: T.HYPER, cost: 30, lvl: 1, art: 'HYPER_MARC', key: 'CARD_HYPER_MARC', hyper: 'marc', dynamicCost: 'level10', target: 'enemy',
    descr: '\u2605Cost: Level x10\nDeal damage equal to your level to target enemy. A KO from this effect gives you 2 Wins.' });
  card('HYPER_KAI',    { name: "Protagonist's Privilege", type: T.HYPER, cost: 20, lvl: 3, art: 'HYPER_KAI', key: 'CARD_HYPER_KAI', hyper: 'kai',
    descr: 'Effect Duration: 3 chapters\nWhen you are allowed to attack first, the opposing unit cannot attack (once per combat).' });
  card('HYPER_ARU',    { name: 'Present for You', type: T.HYPER, cost: 30, lvl: 2, art: 'HYPER_ARU', key: 'CARD_HYPER_ARU', hyper: 'aru',
    descr: 'All players draw cards until they have a full hand. Those with full hand draw 1 card instead. Gain stars equal to 10x the number of all cards drawn.' });
  card('HYPER_HIME',   { name: 'Binding Chains', type: T.HYPER, cost: 10, lvl: 3, art: 'HYPER_HIME', key: 'CARD_HYPER_HIME', hyper: 'hime',
    descr: 'Stock Effect\nAll Units except yours will skip their next turn. Apply "Bound" to all active enemies. Effect Duration: 2 Chapters. Gain -2 EVD and -1 MOV.' });
  card('HYPER_YUKI',   { name: 'Gamble!', type: T.HYPER, cost: 13, lvl: 3, art: 'HYPER_YUKI', key: 'CARD_HYPER_YUKI', hyper: 'yuki',
    descr: "A randomly chosen unit is KO'd." });
  card('HYPER_SORA',   { name: 'Extraordinary Specs', type: T.HYPER, cost: 30, lvl: 3, art: 'HYPER_SORA', key: 'CARD_HYPER_SORA', hyper: 'sora',
    descr: 'Effect Duration: 1 chapter\nRoll 6 for movement, battle, bonus and drop.' });
  card('HYPER_PEAT',   { name: 'Blue Crow the Second', type: T.HYPER, cost: 10, lvl: 2, art: 'HYPER_PEAT', key: 'CARD_HYPER_PEAT', hyper: 'peat', battle: 'self',
    descr: 'During this battle, gain ATK and DEF but lose EVD equal to the number of cards in your hand.' });
  card('HYPER_TOMOMO', { name: 'Magical Massacre', type: T.HYPER, cost: 20, lvl: 4, art: 'HYPER_TOMOMO', key: 'CARD_HYPER_TOMOMO', hyper: 'tomomo',
    descr: "All units whose HP is full or higher will suffer KO. Gain -1 REC on next Revive roll per unit KO'd (other than yourself)." });
  card('HYPER_POPPO',  { name: 'Ubiquitous', type: T.HYPER, cost: 0, lvl: 1, art: 'HYPER_POPPO', key: 'CARD_HYPER_POPPO', hyper: 'poppo', target: 'enemy',
    descr: "Warp to target active enemy's panel. In addition, steal stars equal to 10x their level." });

  // ---- shared deck composition (weights) ----
  OJ.DECK_POOL = [
    ['DASH', 3], ['EXTEND', 1], ['FLIPOUT', 3], ['LONGSHOT', 3], ['NICEJINGLE', 1],
    ['NICEPRESENT', 1], ['PRINCESS', 1], ['PUDDING', 3], ['COOKIE', 3],
    ['BIGMAGNUM', 3], ['FINALBATTLE', 1], ['ONFIRE', 3], ['RAINBOW', 3], ['RBITS', 3],
    ['REVERSE', 1], ['SHIELD', 3],
    ['ASSAULT', 3], ['GOAWAY', 3], ['HEAT300', 3], ['MIMYUU', 3], ['PIGGYBANK', 3],
    ['TOYSTORE', 1], ['PURES', 1], ['TRAGEDY', 3],
    ['SEAGULLS', 3], ['DINNER', 3], ['FORCEDREVIVAL', 3], ['HOLYNIGHT', 1],
    ['LITTLEWAR', 1], ['OHMYFRIEND', 1], ['OUTOFAMMO', 3], ['SEALEDGUARDIAN', 1],
    ['ALLOUTMODE', 3], ['WARUDA', 3],
  ];

  OJ.CARDS = C;
  OJ.TYPES = T;

  // ---- i18n helpers ----
  OJ.t = function (cardId, field) {
    const c = C[cardId];
    if (!c) return cardId;
    const data = (globalThis.OJ.I18N_DATA || {}).card || {};
    const rec = data[c.key];
    if (rec && OJ.lang === 'zh' && rec.zh && rec.zh[field]) return rec.zh[field];
    return c[field] || '';
  };
  OJ.charName = function (charId) {
    const ch = OJ.CHARS[charId];
    return OJ.lang === 'zh' ? (ch.nameZh || ch.name) : ch.name;
  };
  OJ.mobName = function (kind) {
    const m = OJ.MOBS[kind];
    return OJ.lang === 'zh' ? (m.nameZh || m.name) : m.name;
  };
  OJ.L = function (zh, en) { return OJ.lang === 'zh' ? zh : en; };
})();
