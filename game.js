"use strict";
/* ============================================================
   WAR ECONOMY — a roguelike deckbuilder about the price of winning
   Pure front-end SPA. No server, no saves (achievements excepted),
   no mercy. Implements the Consolidated Edition spec.
   ============================================================ */

/* ---------------- helpers ---------------- */
const $ = s => document.querySelector(s);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const sleep = ms => new Promise(r => setTimeout(r, ms));
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;"); }

/* ---------------- audio (WebAudio synth, no assets) ----------------
   Phones need two things desktop doesn't:
   1. A fresh AudioContext is suspended until it is resumed inside a real
      user gesture, so we unlock on the first touch anywhere on the page.
   2. iOS routes Web Audio through the ringer, which means the hardware
      silent switch mutes the game. Declaring a "playback" audio session
      (Safari 16.4+) opts out of that. */
let audioCtx = null, muted = false, audioUnlocked = false;

function ac() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}

function unlockAudio() {
  if (audioUnlocked) return;
  try {
    if (navigator.audioSession) navigator.audioSession.type = "playback";
  } catch (e) { /* older Safari: no session API, silent switch still applies */ }
  try {
    const c = ac();
    // playing one silent sample is what actually flips iOS out of "suspended"
    const src = c.createBufferSource();
    src.buffer = c.createBuffer(1, 1, 22050);
    src.connect(c.destination);
    src.start(0);
    if (c.state === "running") {
      audioUnlocked = true;
      bgm.resume();          // a battle may already be waiting for music
    }
  } catch (e) { /* try again on the next gesture */ }
}

if (typeof document !== "undefined" && document.addEventListener) {
  for (const evt of ["pointerdown", "touchend", "click", "keydown"]) {
    document.addEventListener(evt, unlockAudio, { passive: true });
  }
  // coming back from a locked screen or another tab leaves the context suspended
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && audioCtx && audioCtx.state === "suspended") {
      audioCtx.resume().catch(() => {});
    }
  });
}
function tone(freq, dur, type = "square", vol = 0.1, delay = 0, slideTo = 0) {
  if (muted) return;
  try {
    const c = ac(), o = c.createOscillator(), g = c.createGain();
    o.type = type;
    const t = c.currentTime + delay;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo > 0) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(c.destination);
    o.start(t); o.stop(t + dur);
  } catch (e) { /* audio is a nice-to-have */ }
}
function noise(dur, vol = 0.2, delay = 0) {
  if (muted) return;
  try {
    const c = ac(), n = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, n, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = c.createBufferSource(); src.buffer = buf;
    const g = c.createGain(); g.gain.value = vol;
    src.connect(g); g.connect(c.destination);
    src.start(c.currentTime + delay);
  } catch (e) { /* ignore */ }
}
const sfx = {
  click() { tone(660, .05, "sine", .05); },
  card()  { tone(523, .06, "triangle", .09); tone(784, .09, "triangle", .07, .05); },
  hit()   { noise(.09, .15); tone(220, .13, "square", .1, 0, 90); },
  bigHit(){ noise(.3, .32); tone(170, .38, "sawtooth", .16, 0, 50); },
  block() { tone(392, .06, "square", .08); tone(494, .09, "square", .06, .05); },
  heal()  { tone(523, .09, "sine", .09); tone(659, .09, "sine", .08, .08); tone(784, .15, "sine", .08, .16); },
  coin()  { tone(988, .05, "square", .06); tone(1319, .12, "square", .06, .05); },
  bad()   { tone(311, .16, "sawtooth", .08, 0, 220); tone(220, .22, "sawtooth", .07, .12, 155); },
  nuke()  { noise(1.1, .4); tone(85, 1.1, "sawtooth", .2, 0, 28); },
  win()   {
    [523, 659, 784, 1047].forEach((f, i) => tone(f, .17, "square", .07, i * .11));
    [262, 330, 392, 523].forEach((f, i) => tone(f, .2, "triangle", .06, i * .11));
  },
  lose()  {
    [392, 370, 349, 262].forEach((f, i) => tone(f, .24, "sawtooth", .07, i * .17));
    tone(131, .8, "triangle", .06, .5, 65);
  },
  ach()   { [784, 988, 1319, 1568].forEach((f, i) => tone(f, .11, "triangle", .08, i * .09)); },
};

/* ---------------- battle BGM ----------------
   A synthesized chiptune march loop: triangle bass, quiet square
   arpeggio, noise-tick hats. Lookahead scheduler so timing stays
   tight; the boss fight runs a notch faster. Silently does nothing
   when WebAudio is unavailable (tests, ancient browsers). */
const bgm = {
  timer: null, next: 0, step: 0, boss: false, wanted: false,
  // A natural-minor bass line, one note per half-beat slot (MIDI numbers)
  bass: [45, 45, 45, 48, 41, 41, 41, 45, 43, 43, 43, 47, 40, 40, 43, 47],
  arp: [0, 3, 7, 12],
  start(boss = false) {
    this.wanted = true;
    this.boss = boss;
    if (muted || this.timer) return;
    try { ac(); } catch (e) { return; }
    this.step = 0;
    this.next = ac().currentTime + 0.06;
    this.timer = setInterval(() => this.tick(), 80);
  },
  stop() {
    this.wanted = false;
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
  },
  pause() { // mute toggle: stop playback but remember we want music
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
  },
  resume() { if (this.wanted && !this.timer) { const b = this.boss; this.wanted = false; this.start(b); } },
  tick() {
    try {
      const c = ac();
      // a suspended context has a frozen clock — don't pile up notes that
      // would all fire at once the moment it resumes
      if (c.state !== "running") { this.next = c.currentTime + 0.06; return; }
      const spb = this.boss ? 0.135 : 0.165; // seconds per half-beat
      if (this.next < c.currentTime - 0.5) this.next = c.currentTime + 0.06; // fell behind: resync
      while (this.next < c.currentTime + 0.22) {
        this.sched(this.next - c.currentTime, this.step);
        this.step = (this.step + 1) % 32;
        this.next += spb;
      }
    } catch (e) { this.pause(); }
  },
  sched(delay, s) {
    const f = m => 440 * Math.pow(2, (m - 69) / 12);
    const root = this.bass[s % 16];
    if (s % 2 === 0) tone(f(root - 12), .14, "triangle", .045, delay);      // bass
    if (s % 4 === 2) noise(.018, .022, delay);                              // hat
    if (s % 8 === 1 || s % 8 === 5)                                         // sparse arpeggio
      tone(f(root + 12 + this.arp[(s >> 3) % 4]), .09, "square", .02, delay);
    if (s === 24) tone(f(root), .3, "square", .03, delay, f(root - 5));     // fill
  },
};

/* ---------------- cards ----------------
   Mechanics only. Names / rules text / flavor live in lang packs.
   `atk` = counts as an attack card (blocked by strike / Time Out). */
const CARDS = {
  /* --- Shared: Military --- */
  charge: { cost: 1, cat: "mil", atk: true,
    async play() { await attackEnemy(6); } },
  double_tap: { cost: 2, cat: "mil", atk: true,
    async play() { await attackEnemy(5); await sleep(200); await attackEnemy(5); } },
  big_boom: { cost: 3, cat: "mil", atk: true,
    async play() { await attackEnemy(14); } },
  dig_in: { cost: 1, cat: "mil",
    async play() { gainBlock(8); } },
  little_friend: { cost: 2, cat: "mil",
    async play() { gainBlock(6); B.thorns += 8; } },
  burn_it_all: { cost: 3, cat: "mil", atk: true,
    async play() { await attackEnemy(18); B.incomeDebuffs.push({ amt: 2, turns: 1 }); } },
  death_above: { cost: 2, cat: "mil", atk: true,
    async play() { await attackEnemy(8, { pierce: true }); } },
  lets_have_it: { cost: 1, cat: "mil",
    async play() { B.turnAtkBonus += 4; log(T("log_safety")); } },

  /* --- Shared: Buildings --- */
  war_machine: { cost: 2, cat: "bld", oncePerBattle: true,
    async play() { gainIncome(1); log(T("log_income")); } },
  all_aboard: { cost: 1, cat: "bld",
    async play() { draw(2); } },
  patch_up: { cost: 1, cat: "bld",
    async play() { heal(6); } },
  bigger_guns: { cost: 2, cat: "bld",
    async play() { B.permAtk += 2; log(T("log_bigger")); } },
  buy_now: { cost: 0, cat: "bld",
    async play() { B.gold += 3; sfx.coin(); B.incomeDebuffs.push({ amt: 1, turns: 3 }); popup("#player-panel", "+3 💰", "pop-steal"); } },
  nope_zone: { cost: 2, cat: "bld",
    async play() { B.nopeStacks.push({ turns: 3 }); log(T("log_nope")); sfx.block(); } },
  all_hands: { cost: 3, cat: "bld", rewardWeight: 1,
    async play() { B.allHands = true; log(T("log_allhands")); sfx.coin(); } },
  enchilada: { cost: 3, cat: "bld",
    async play() { draw(3); heal(3); gainIncome(1); } },

  /* --- Shared: Politics, dirty --- */
  scorched_sky: { cost: 3, cat: "pol", dirty: true, atk: true, rep: -1,
    async play() { await attackEnemy(20); changeRep(-2); } },
  sucker_punch: { cost: 1, cat: "pol", dirty: true, rep: -1,
    async play() { B.suckerPunch = true; changeRep(-2); log(T("log_sucker")); } },
  fake_news: { cost: 1, cat: "pol", dirty: true, rep: -1,
    async play() { draw(2); heal(5); changeRep(-1); } },

  /* --- Shared: Politics, clean --- */
  eye_sky: { cost: 0, cat: "pol",
    async play() { B.foresight = true; log(T("log_recon")); sfx.click(); } },
  talk_out: { cost: 1, cat: "pol",
    async play() { B.talkItOut = true; log(T("log_talk")); } },
  art_deal: { cost: 0, cat: "pol", choice: true },
  good_guy: { cost: 2, cat: "pol",
    async play() { changeRep(2); sfx.heal(); } },
  time_out: { cost: 2, cat: "pol", exhaust: true,
    async play() { B.enemySkip = true; B.noAttacks = true; log(T("log_timeout")); } },

  /* --- Faction: Germany — Tempo --- */
  guderian: { cost: 1, cat: "mil", atk: true, faction: "germany", sig: true, rep: -1,
    async play() {
      const v = 4 + (B.ctxFirst ? 2 : 0);
      await attackEnemy(v); await sleep(200); await attackEnemy(v);
    } },
  desert_fox: { cost: 2, cat: "mil", atk: true, faction: "germany",
    async play() {
      const n = nextEnemyAction();
      const pierce = !!n && (n.kind === "attack" || n.kind === "kamikaze" || n.kind === "nuke");
      await attackEnemy(9, { pierce });
    } },
  wolfpack: { cost: 2, cat: "mil", atk: true, faction: "germany",
    async play() { stealFromChest(3); await sleep(180); await attackEnemy(4); } },
  schwerpunkt: { cost: 1, cat: "mil", faction: "germany", exhaust: true,
    async play() { B.schwerpunkt = true; log(T("log_schwerpunkt")); } },
  autobahn: { cost: 2, cat: "bld", faction: "germany",
    async play() { draw(2, true); } },

  /* --- Faction: Soviet Union — Attrition --- */
  zhukov: { cost: 2, cat: "mil", atk: true, faction: "soviet", sig: true, rep: -1,
    async play() {
      for (let k = 0; k < 2; k++) {
        const r = await attackEnemy(5);
        if (r.hpDmg > 0 && !G.over && !B.won) heal(2);
        if (k === 0) await sleep(220);
      }
    } },
  katyusha: { cost: 3, cat: "mil", atk: true, faction: "soviet",
    async play() {
      for (let k = 0; k < 4; k++) {
        await attackEnemy(4);
        if (B.won || G.over) return;
        if (k < 3) await sleep(170);
      }
    } },
  general_winter: { cost: 2, cat: "pol", faction: "soviet",
    async play() { B.winterTurns = 3; log(T("log_winter")); sfx.block(); } },
  deep_battle: { cost: 1, cat: "mil", atk: true, faction: "soviet",
    async play() { selfDamage(3); if (!G.over) await attackEnemy(10); } },
  ural: { cost: 2, cat: "bld", faction: "soviet",
    async play() { gainIncome(1); heal(4); } },

  /* --- Faction: Japan — Piracy --- */
  tokyo_express: { cost: 2, cat: "mil", faction: "japan", sig: true, rep: -1,
    async play() { stealFromChest(2); } },
  zero_rush: { cost: 1, cat: "mil", atk: true, faction: "japan",
    async play() { await attackEnemy(B.lootArrived ? 8 : 5); } },
  yamamoto: { cost: 2, cat: "pol", faction: "japan",
    async play() { stealFromChest(5); B.fundedDisabled = true; log(T("log_yamamoto")); } },
  night_raid: { cost: 2, cat: "mil", atk: true, faction: "japan",
    async play() { await attackEnemy(7, { pierce: true }); } },
  shadow_economy: { cost: 2, cat: "bld", faction: "japan",
    async play() { B.shadowEconomy++; log(T("log_shadow")); sfx.coin(); } },

  /* --- Faction: USA — Snowball --- */
  liberty_ships: { cost: 3, cat: "bld", faction: "usa", sig: true, rep: -1,
    async play() {
      gainIncome(1);
      if (B.handCap < 6) { B.handCap = 6; log(T("log_handcap")); }
      draw(1);
    } },
  rosie: { cost: 2, cat: "bld", faction: "usa",
    async play() { B.rosie = true; log(T("log_rosie")); sfx.coin(); } },
  ike_arsenal: { cost: 4, cat: "bld", faction: "usa",
    async play() {
      const n = Math.floor(grossIncome() / 4);
      if (n > 0) B.permAtk += n;
      log(T("log_ike", n));
    } },
  patton_push: { cost: 2, cat: "mil", atk: true, faction: "usa",
    async play() { await attackEnemy(Math.floor(1.5 * grossIncome())); } },
  arsenal_democracy: { cost: 4, cat: "bld", faction: "usa",
    async play() { gainIncome(2); changeRep(1); } },

  /* --- 阵营:中国 — 持久战 --- */
  taierzhuang: { cost: 2, cat: "mil", atk: true, faction: "china", sig: true, rep: -1,
    async play() { await attackEnemy(Math.min(14, 4 + Math.max(0, B.turn - 1))); } },
  flying_tigers: { cost: 2, cat: "mil", atk: true, faction: "china",
    async play() { await attackEnemy(8, { pierce: true }); } },
  the_hump: { cost: 2, cat: "bld", faction: "china",
    async play() { gainIncome(1); draw(1); } },
  guerrilla: { cost: 1, cat: "pol", faction: "china",
    async play() { B.winterTurns = 3; B.winterAmt = 3; log(T("log_guerrilla")); sfx.block(); } },
  changsha: { cost: 3, cat: "mil", faction: "china",
    async play() { gainBlock(10); B.thorns += 10; } },

  /* --- 阵营:英国 — 情报 --- */
  bletchley: { cost: 2, cat: "pol", faction: "uk", sig: true, rep: -1,
    async play() { B.foresight = true; log(T("log_recon")); draw(1); } },
  chain_home: { cost: 1, cat: "bld", faction: "uk",
    async play() { B.chainHome = true; log(T("log_chain_home")); sfx.block(); } },
  desert_rats: { cost: 2, cat: "mil", atk: true, faction: "uk",
    async play() { await attackEnemy(B.foresight ? 13 : 9); } },
  convoy_blockade: { cost: 2, cat: "mil", faction: "uk",
    async play() { stealFromChest(3); B.chestFrozen = 3; log(T("log_blockade")); } },
  lancaster: { cost: 3, cat: "mil", atk: true, faction: "uk",
    async play() { await attackEnemy(16); } },

  /* --- 阵营:法国 — 抵抗 --- */
  free_france: { cost: 2, cat: "mil", atk: true, faction: "france", sig: true, rep: -1,
    async play() { await attackEnemy(lowHp() ? 12 : 6); } },
  maginot: { cost: 2, cat: "mil", faction: "france",
    async play() { gainBlock(12); } },
  resistance_net: { cost: 1, cat: "bld", faction: "france",
    async play() { stealFromChest(2); draw(1); } },
  leclerc: { cost: 2, cat: "mil", atk: true, faction: "france",
    async play() {
      const v = lowHp() ? 8 : 5;
      await attackEnemy(v); await sleep(200); await attackEnemy(v);
    } },
  liberation: { cost: 3, cat: "bld", faction: "france",
    async play() { heal(10); changeRep(1); } },
};

/* 法国的整套卡组只在落后时才付得起回报 */
function lowHp() { return G.hp <= G.maxHp / 2; }

const SHARED_IDS = Object.keys(CARDS).filter(id => !CARDS[id].faction);

const FACTIONS = {
  germany: { sig: "guderian",      pool: ["desert_fox", "wolfpack", "schwerpunkt", "autobahn"] },
  soviet:  { sig: "zhukov",        pool: ["katyusha", "general_winter", "deep_battle", "ural"] },
  japan:   { sig: "tokyo_express", pool: ["zero_rush", "yamamoto", "night_raid", "shadow_economy"] },
  usa:     { sig: "liberty_ships", pool: ["rosie", "ike_arsenal", "patton_push", "arsenal_democracy"] },
  china:   { sig: "taierzhuang",   pool: ["flying_tigers", "the_hump", "guerrilla", "changsha"] },
  uk:      { sig: "bletchley",     pool: ["chain_home", "desert_rats", "convoy_blockade", "lancaster"] },
  france:  { sig: "free_france",   pool: ["maginot", "resistance_net", "leclerc", "liberation"] },
};

/* Spec 5.4: 3× Charge! (signature replaces one), 2× Dig In,
   War Machine, All Aboard, Patch 'Em Up. */
function starterDeck(faction) {
  return ["charge", "charge", FACTIONS[faction].sig,
          "dig_in", "dig_in", "war_machine", "all_aboard", "patch_up"];
}

/* ---------------- countries / enemies ---------------- */
const COUNTRIES = {
  germany: { flag: "🇩🇪", hp: 35 },
  soviet:  { flag: "☭",  hp: 50, bossHp: 5 },
  japan:   { flag: "🇯🇵", hp: 45 },
  usa:     { flag: "🇺🇸", hp: 45, bossHp: 5 },
  china:   { flag: "🇨🇳", hp: 55 },
  uk:      { flag: "🇬🇧", hp: 40 },
  france:  { flag: "🇫🇷", hp: 38 },
};

function repTitle(r) {
  if (r >= 7) return T("rep_good");
  if (r >= 3) return T("rep_mid");
  return T("rep_bad");
}

/* ---------------- achievements ---------------- */
const ACH_GENERAL = ["baptism", "mission_accomplished", "geneva", "war_criminal", "textbook",
                     "economist", "pickpocket", "no_scratch", "photo_finish", "polyglot",
                     "spotless", "rockbottom", "slippery",
                     "endless5", "endless10", "world_tour"];
const ACH_MATCHUP = ["m_germany_soviet", "m_germany_usa", "m_germany_japan",
                     "m_soviet_germany", "m_soviet_usa", "m_soviet_japan",
                     "m_japan_usa", "m_japan_soviet", "m_japan_germany",
                     "m_usa_germany", "m_usa_japan", "m_usa_soviet"];
const ACH_DEATH   = ["maginot", "winter_regards", "broke_dead", "read_clock", "own_goal", "hague"];
const ACH_ORDER   = [...ACH_GENERAL, ...ACH_MATCHUP, ...ACH_DEATH];

function loadAch() {
  try { return JSON.parse(localStorage.getItem("we_ach") || "{}"); }
  catch (e) { return {}; }
}
let ACH_STATE = loadAch();

function ach(id) {
  if (!ACH_ORDER.includes(id) || ACH_STATE[id]) return;
  ACH_STATE[id] = true;
  try { localStorage.setItem("we_ach", JSON.stringify(ACH_STATE)); } catch (e) { /* ignore */ }
  if (G && !G.newAch.includes(id)) G.newAch.push(id);
}
function achCount() { return ACH_ORDER.filter(id => ACH_STATE[id]).length; }
function allAchDone() { return achCount() === ACH_ORDER.length; }

function polyglotRecord() {
  try {
    const s = new Set(JSON.parse(localStorage.getItem("we_polyglot") || "[]"));
    s.add(LANG);
    localStorage.setItem("we_polyglot", JSON.stringify([...s]));
    if (s.size >= 3) ach("polyglot");
  } catch (e) { /* private mode etc. */ }
}

/* ---------------- game state ---------------- */
const REP_MAX = 8;   // reputation ceiling (spec 9)

let G = null; // run state
let B = null; // battle state

function newRun(playerCountry, hell = false, endless = false) {
  const others = Object.keys(COUNTRIES).filter(c => c !== playerCountry);
  G = {
    playerCountry,
    hell, endless,
    // 标准/地狱:从其余六国里随机抽三个。无尽:永远续上下一个对手
    queue: endless ? shuffle(others) : shuffle(others).slice(0, 3),
    battleIdx: 0,
    hp: 50, maxHp: 50,
    rep: 8, repFloor: 8,
    deck: starterDeck(playerCountry),
    intervention: false,
    interventionTurn: -99,
    pariah: false,
    dirtyPlayed: false,
    repHitZero: false,
    newAch: [],
    extraPicks: 0,
    over: false,
    totalTurns: 0,
  };
}

function initBattle() {
  while (G.endless && G.battleIdx >= G.queue.length) queueMoreOpponents();
  // 无尽:每一波开场血量回满。难度靠敌人涨,不靠你的血条慢慢磨没
  if (G.endless) G.hp = G.maxHp;
  const id = G.queue[G.battleIdx];
  // 无尽:每三波一个 Boss;标准:只有最后一场
  const boss = G.endless ? (G.battleIdx % 3 === 2) : (G.battleIdx === 2 || G.hell);
  const wave = G.endless ? G.battleIdx : 0;
  const maxHp = COUNTRIES[id].hp + (boss ? (COUNTRIES[id].bossHp ?? 15) : 0) + 8 * wave;
  B = {
    enemy: { id, boss, maxHp, hp: maxHp, wave, block: 0, chest: 10, usaAtk: 4,
             actIdx: 0, annStacks: 0, kamAnn: false, fumesAnn: false, stacks: 0 },
    draw: shuffle(G.deck), discard: [], exhausted: [], hand: [],
    turn: 0, gold: 0,
    permIncome: 0, permAtk: 0,
    incomeDebuffs: [], stealNext: 0, nopeStacks: [],
    playerBlock: 0, thorns: 0, turnAtkBonus: 0,
    suckerPunch: false, allHands: false, rosie: false, noAttacks: false,
    talkItOut: false, enemySkip: false, foresight: false,
    schwerpunkt: false, winterTurns: 0, winterAmt: 2, fundedDisabled: false,
    chainHome: false, chestFrozen: 0,
    shadowEconomy: 0, lootNext: 0, lootArrived: false, stolenTotal: 0,
    oncePlayed: [], handCap: HAND_LIMIT,
    cardsPlayed: 0, ctxFirst: false, playedThisTurn: [], factionThisTurn: [],
    selfHarmTurn: -1, tookDamage: false, lastHandIds: [],
    repStart: G.rep, repFloor: G.rep,
    bankrupt: false, busy: false, won: false,
  };
  renderBattleSkeleton();
  bgm.start(boss);
  startPlayerTurn();
}

/* ---------------- enemy scripts (fixed sequences) ----------------
   Actions carry `funded: cost` when they draw on the War Chest
   (spec 4.2) and are recomputed live so the telegraph never lies. */
function chestGain(e) { return e.id === "usa" ? 2 : 1; }

function enemyAction(idx) {
  const e = B.enemy, boss = e.boss;
  switch (e.id) {
    case "germany": {
      const cyc = Math.floor(idx / 3), pos = idx % 3;
      const d = v => Math.max(0, v - (cyc >= 3 ? 2 : 0));
      if (pos === 0) return { kind: "attack", hits: [d(8)], src: "attack" };
      if (pos === 1) {
        const b = d(boss ? 8 : 6);
        return { kind: "attack", hits: [b, b], src: "blitz", funded: 3, warn: T("warn_blitz") };
      }
      return { kind: "attack", hits: [d(10)], src: "attack" };
    }
    case "soviet": {
      const pos = idx % 3;
      if (pos === 2) return { kind: "block", amount: 6, funded: 2 };
      return { kind: "attack", hits: [5 + sovietStacks() * (boss ? 4 : 3)], src: "attack" };
    }
    case "japan": {
      const pos = idx % 2;
      if (pos === 0) return { kind: "attack", hits: [4], steal: 2, src: "attack" };
      if (e.hp < e.maxHp / 2)
        return { kind: "kamikaze", dmg: boss ? 16 : 12, self: 5, funded: 4, warn: T("warn_divine"), src: "attack" };
      return { kind: "attack", hits: [4], src: "attack" };
    }
    case "china": {
      const pos = idx % 3;
      const p = protractedBonus();
      if (pos === 1) return { kind: "block", amount: 8, funded: 2 };
      return { kind: "attack", hits: [(pos === 0 ? 5 : 7) + p], src: "attack" };
    }
    case "uk": {
      const pos = idx % 3;
      if (pos === 1) return { kind: "attack", hits: [0], steal: 2, chestGain: 3, src: "blockade" };
      if (pos === 2 && idx >= 3)
        return { kind: "attack", hits: [boss ? 19 : 14], funded: 4, src: "bomber", warn: T("warn_bomber") };
      return { kind: "attack", hits: [pos === 0 ? 6 : 9], src: "attack" };
    }
    case "france": {
      const pos = idx % 3;
      if (pos === 2) return { kind: "block", amount: 6, funded: 2 };
      return { kind: "attack", hits: [5 + (franceCornered() ? 5 : 0)], src: "attack" };
    }
    case "usa": {
      if (idx === 7) return { kind: "nuke", dmg: boss ? 52 : 40, warn: T("warn_nuke"), src: "nuke" };
      // project +2 per future funded ramp so Eye in the Sky forecasts honestly
      // (no ramp happens on the nuke turn itself)
      const rampTurns = Math.max(0, idx - e.actIdx - (e.actIdx <= 7 && idx > 7 ? 1 : 0));
      return { kind: "attack", hits: [e.usaAtk + 2 * rampTurns], src: "attack", fundBadge: true };
    }
  }
}

function nextEnemyAction() {
  if (!B || B.enemySkip) return null;
  return enemyAction(B.enemy.actIdx);
}

function sovietStacks() {
  const e = B.enemy;
  if (e.id !== "soviet") return 0;
  // monotonic: once a 25% threshold is crossed the buff never goes away
  const current = clamp(Math.floor(((e.maxHp - e.hp) / e.maxHp) / 0.25), 0, 3);
  e.stacks = Math.max(e.stacks || 0, current);
  return e.stacks;
}
/* 中国:伤害挂在"你花了多少回合"上,而不是"它掉了多少血" */
/* 无尽:每挺过一波,所有敌人的每次攻击 +1 */
function waveBonus() {
  return (B && B.enemy && B.enemy.wave) ? B.enemy.wave : 0;
}

function protractedBonus() {
  if (!B || B.enemy.id !== "china") return 0;
  return 2 * Math.floor(Math.max(0, B.turn - 1) / 3);
}
/* 法国:半血以下才露出獠牙 */
function franceCornered() {
  const e = B && B.enemy;
  return !!e && e.id === "france" && e.hp > 0 && e.hp < e.maxHp / 2;
}

function usaClock() {
  return Math.max(0, 8 - B.enemy.actIdx);
}
function nopeReduction() {
  return B.nopeStacks.length * 3;
}
function germanyFumes() {
  return B.enemy.id === "germany" && Math.floor(B.enemy.actIdx / 3) >= 3;
}
function grossIncome() { return 3 + B.permIncome; }

/* War Chest funding. Yamamoto's Wager eats the next attempt. */
function tryFund(cost) {
  const e = B.enemy;
  if (B.fundedDisabled) { B.fundedDisabled = false; return false; }
  if (e.chest >= cost) { e.chest -= cost; return true; }
  return false;
}

/* ---------------- core mechanics ---------------- */
async function attackEnemy(base, opts = {}) {
  const e = B.enemy;
  if (!e || e.hp <= 0 || G.over || B.won) return { hpDmg: 0 };
  let dmg = base + B.permAtk + B.turnAtkBonus;
  if (B.schwerpunkt) { dmg *= 2; B.schwerpunkt = false; }
  let pierce = !!opts.pierce;
  if (B.suckerPunch) { dmg = Math.round(dmg * 1.5); pierce = true; }
  let remaining = dmg;
  if (!pierce && e.block > 0) {
    const ab = Math.min(e.block, remaining);
    e.block -= ab; remaining -= ab;
    if (ab > 0) popup("#enemy-panel", `🛡️${ab}`, "pop-block");
  }
  if (remaining > 0) {
    e.hp = Math.max(0, e.hp - remaining);
    popup("#enemy-panel", `-${remaining}`, "pop-dmg");
    if (remaining >= 15) { shake(); sfx.bigHit(); } else sfx.hit();
  } else {
    sfx.block();
  }
  afterEnemyDamage();
  updateBattle();
  if (e.hp <= 0) { await sleep(450); await winBattle(); }
  return { hpDmg: remaining };
}

function afterEnemyDamage() {
  const e = B.enemy;
  if (e.hp <= 0) return;
  if (e.id === "soviet") {
    const s = sovietStacks();
    if (s > e.annStacks) {
      e.annStacks = s;
      log(T("log_soviet", s * (e.boss ? 4 : 3)));
      sfx.bad();
    }
  }
  if (e.id === "japan" && !e.kamAnn && e.hp < e.maxHp / 2) {
    e.kamAnn = true;
    log(T("log_divine"));
    sfx.bad();
  }
}

async function enemyHit(raw, { halve = false, src = "attack" } = {}) {
  if (G.over || B.won) return;
  let dmg = raw + (G.intervention ? 3 : 0) + (G.pariah ? 2 : 0) + waveBonus();
  if (B.winterTurns > 0) dmg = Math.max(0, dmg - (B.winterAmt || 2));
  if (B.chainHome) dmg = Math.max(0, dmg - 4);
  if (halve) dmg = Math.floor(dmg / 2);
  dmg = Math.max(0, dmg - nopeReduction());
  const blocked = Math.min(B.playerBlock, dmg);
  B.playerBlock -= blocked;
  const hpDmg = dmg - blocked;
  if (hpDmg > 0) {
    G.hp = Math.max(0, G.hp - hpDmg);
    B.tookDamage = true;
    popup("#player-panel", `-${hpDmg}`, "pop-dmg");
    if (hpDmg >= 15) { shake(); sfx.bigHit(); } else sfx.hit();
  } else if (dmg > 0) {
    popup("#player-panel", T("blocked_pop"), "pop-block");
    sfx.block();
    if (blocked === dmg && B.thorns > 0 && B.enemy.hp > 0) {
      await sleep(220);
      const t = B.thorns;
      B.enemy.hp = Math.max(0, B.enemy.hp - t);
      popup("#enemy-panel", `-${t}`, "pop-dmg");
      log(T("log_thorns", t));
      sfx.hit();
      afterEnemyDamage();
    }
  } else {
    popup("#player-panel", "0", "pop-block");
  }
  updateBattle();
  if (G.hp <= 0) { die(src); return; }
  if (B.enemy.hp <= 0) { await sleep(450); await winBattle(); }
}

function gainBlock(n) {
  B.playerBlock += n;
  popup("#player-panel", `🛡️+${n}`, "pop-block");
  sfx.block();
}
function heal(n) {
  const before = G.hp;
  G.hp = clamp(G.hp + n, 0, G.maxHp);
  popup("#player-panel", `+${G.hp - before}`, "pop-heal");
  sfx.heal();
}
function selfDamage(n) {
  G.hp = Math.max(0, G.hp - n);
  B.selfHarmTurn = B.turn;
  popup("#player-panel", `-${n}`, "pop-dmg");
  sfx.hit();
  updateBattle();
  if (G.hp <= 0) die("self");
}
function gainIncome(n) {
  B.permIncome += n;
  sfx.coin();
  if (grossIncome() >= 8) ach("economist");
}
/* Hand limit is 4 for everyone; Liberty Ships buys the USA a 5th slot.
   Card-driven draw may exceed it (spec 3) — HAND_MAX only keeps the
   hand renderable. */
const HAND_LIMIT = 5;
const HAND_MAX = 10;

function draw(n, autobahn = false, cap = HAND_MAX) {
  for (let k = 0; k < n; k++) {
    if (B.hand.length >= cap) break;
    if (B.draw.length === 0) {
      if (B.discard.length === 0) break;
      B.draw = shuffle(B.discard);
      B.discard = [];
    }
    B.hand.push({ id: B.draw.pop(), disc: autobahn });
  }
}

/* Player steals from the enemy War Chest. Spec 3.2 theft rule:
   the chest loses the gold immediately, but the loot only arrives
   with the player's NEXT income — never this turn's pocket. */
function stealFromChest(n) {
  const e = B.enemy;
  const actual = Math.min(e.chest, n);
  e.chest -= actual;
  if (actual > 0) {
    const gain = actual + B.shadowEconomy;
    B.lootNext += gain;
    B.stolenTotal += actual;
    if (B.stolenTotal >= 15) ach("pickpocket");
    popup("#enemy-panel", `💰-${actual}`, "pop-steal");
    popup("#player-panel", `+${gain} 💰`, "pop-steal");
    log(T("log_stole", gain));
    sfx.coin();
  } else {
    log(T("log_steal_dry"));
    sfx.bad();
  }
  updateBattle();
}

function changeRep(d) {
  G.rep = clamp(G.rep + d, 0, REP_MAX);
  G.repFloor = Math.min(G.repFloor, G.rep);
  B.repFloor = Math.min(B.repFloor, G.rep);
  if (G.rep === 0) G.repHitZero = true;
  if (B.repFloor === 0 && B.repStart >= 8) ach("slippery");
  popup("#rep-box", T("rep_pop", d), d > 0 ? "pop-heal" : "pop-steal");
  if (d < 0) sfx.bad();
  const live = B && !B.won && !G.over && B.enemy && B.enemy.hp > 0;
  if (G.rep <= 2 && !G.intervention) {
    G.intervention = true;
    G.interventionTurn = G.totalTurns;
    // between battles there is no enemy standing to reinforce — the
    // permanent +3 attack still applies via the flag
    if (live) { B.enemy.maxHp += 15; B.enemy.hp += 15; }
    log(T("log_world"));
    banner(T("banner_intervention"), T("banner_intervention_sub"), true);
    sfx.lose(); shake();
  }
  /* Rock bottom: every nation left in the run turns on you. Once per run,
     and Reputation never refills, so there is no way back (spec 9). */
  if (G.rep === 0 && !G.pariah) {
    G.pariah = true;
    log(T("log_pariah"));
    banner(T("banner_pariah"), T("banner_pariah_sub"), true);
    sfx.lose(); shake();
  }
  updateBattle();
}

/* Once-per-battle cards (War Machine): extra copies are dead weight
   for the rest of this battle — the effect caps, per spec 5.5. */
function spentOnce(id) {
  return !!CARDS[id].oncePerBattle && B.oncePlayed.includes(id);
}

/* Faction cards are once per turn each: no chaining two copies of the
   same national trick in one go. Resets every turn. */
function usedThisTurn(id) {
  return !!CARDS[id].faction && B.factionThisTurn.includes(id);
}

function effCost(entry) {
  const c = CARDS[entry.id];
  let cost = c.cost;
  if (entry.id === "night_raid" && B.enemy.chest === 0) cost = 0;
  if (B.allHands) cost -= 1;
  if (B.rosie && c.cat === "bld") cost -= 1;
  if (entry.disc) cost -= 1;
  return Math.max(0, cost);
}

/* ---------------- turn flow ---------------- */
function startPlayerTurn() {
  if (G.over || B.won) return;
  B.turn++; G.totalTurns++;
  B.playerBlock = 0; B.thorns = 0; B.turnAtkBonus = 0;
  B.suckerPunch = false; B.allHands = false; B.rosie = false; B.noAttacks = false;
  B.schwerpunkt = false; B.chainHome = false;
  B.cardsPlayed = 0; B.playedThisTurn = []; B.factionThisTurn = [];
  B.busy = false;

  // 1) income — spec 3.2: enemy theft/debuffs never drive income below 0;
  //    stolen loot arrives on top, one payday late
  let income = 3 + B.permIncome;
  if (G.rep >= 7) income += 1;                 // lend-lease keeps arriving (spec 9.1)
  for (const d of B.incomeDebuffs) { if (d.turns > 0) { income -= d.amt; d.turns--; } }
  B.incomeDebuffs = B.incomeDebuffs.filter(d => d.turns > 0);
  if (B.stealNext > 0) { income -= B.stealNext; B.stealNext = 0; }
  income = Math.max(0, income);
  B.lootArrived = B.lootNext > 0;
  income += B.lootNext;
  B.lootNext = 0;
  // allied field hospitals, only at a spotless record (spec 9.1)
  if (G.rep >= REP_MAX && G.hp < G.maxHp && B.turn > 1) heal(2);
  // 2) upkeep
  B.gold = income - 1;
  B.bankrupt = B.gold < 0;
  if (B.bankrupt) {
    log(T("log_bankrupt"));
    sfx.bad();
  }
  // 3) refill to the hand limit (only this refill respects the cap)
  draw(B.handCap - B.hand.length, false, B.handCap);
  updateBattle();
}

async function playCard(i) {
  if (B.busy || G.over || B.won) return;
  const entry = B.hand[i];
  if (!entry) return;
  const card = CARDS[entry.id];
  const cost = effCost(entry);
  if (spentOnce(entry.id)) { log(T("log_once_spent")); sfx.bad(); return; }
  if (usedThisTurn(entry.id)) { log(T("log_once_turn")); sfx.bad(); return; }
  if (B.gold < cost) { log(T("log_nogold")); sfx.bad(); return; }
  if (card.atk && (B.bankrupt || B.noAttacks)) {
    log(T(B.bankrupt ? "log_strike" : "log_notimeout"));
    sfx.bad();
    return;
  }
  if (card.choice) { openDealModal(i); return; }
  B.busy = true;
  B.gold -= cost;
  B.hand.splice(i, 1);
  B.ctxFirst = B.cardsPlayed === 0;
  B.cardsPlayed++;
  B.playedThisTurn.push(entry.id);
  if (card.dirty) G.dirtyPlayed = true;
  if (card.oncePerBattle) B.oncePlayed.push(entry.id);
  if (card.faction) B.factionThisTurn.push(entry.id);
  sfx.card();
  updateBattle();
  await card.play();
  // signature cards bill Reputation after they resolve (spec 9)
  if (card.sig && card.rep && !G.over && !B.won) changeRep(card.rep);
  if (G.over) return;
  (card.exhaust ? B.exhausted : B.discard).push(entry.id);
  if (["lets_have_it", "double_tap", "sucker_punch"].every(x => B.playedThisTurn.includes(x)))
    ach("textbook");
  B.busy = false;
  if (!B.won) updateBattle();
}

async function endTurn() {
  if (B.busy || G.over || B.won) return;
  B.busy = true;
  sfx.click();
  B.lastHandIds = B.hand.map(h => h.id); // what you were "holding" when the enemy swung
  B.discard.push(...B.hand.map(h => h.id));
  B.hand = [];
  updateBattle();
  await sleep(350);
  await enemyTurn();
}

async function enemyTurn() {
  if (G.over || B.won) return;
  const e = B.enemy;
  e.block = 0;
  // 皇家海军的封锁反过来用:金库停止增长
  if (B.chestFrozen > 0) B.chestFrozen--;
  else e.chest += chestGain(e); // war chest income, even while chilling

  if (B.enemySkip) {
    B.enemySkip = false;
    log(T("log_chill"));
    updateBattle();
    await sleep(750);
    startPlayerTurn();
    return;
  }

  let a = enemyAction(e.actIdx);

  /* Funded moves draw on the War Chest; broke (or sabotaged) enemies downgrade. */
  if (a.funded && !tryFund(a.funded)) {
    if (a.src === "blitz") {
      a = { kind: "attack", hits: [Math.max(0, 6 - (germanyFumes() ? 2 : 0))], src: "attack" };
      log(T("log_blitz_broke"));
    } else if (a.kind === "block") {
      a = null;
      log(T("log_supply_cut"));
    } else if (a.kind === "kamikaze") {
      a = { kind: "attack", hits: [4], src: "attack" };
      log(T("log_divine_broke"));
    }
    sfx.bad();
    updateBattle();
    await sleep(600);
  }

  e.actIdx++;
  const halve = B.talkItOut && a && (a.kind === "attack" || a.kind === "kamikaze" || a.kind === "nuke");
  if (halve) { B.talkItOut = false; log(T("log_letter")); await sleep(350); }

  if (a && a.kind === "attack") {
    for (const h of a.hits) {
      await enemyHit(h, { halve, src: a.src });
      if (G.over || B.won) return;
      await sleep(340);
    }
    if (a.steal) {
      B.stealNext += a.steal;
      e.chest += a.chestGain || a.steal; // 掠夺者把战利品存进自己金库
      popup("#player-panel", `💰-${a.steal}`, "pop-steal");
      sfx.coin();
      log(T("log_steal", a.steal));
    }
  } else if (a && a.kind === "block") {
    e.block += a.amount;
    popup("#enemy-panel", `🛡️+${a.amount}`, "pop-block");
    sfx.block();
  } else if (a && a.kind === "kamikaze") {
    log(T("log_divine"));
    await enemyHit(a.dmg, { halve, src: "attack" });
    if (G.over) return;
    e.hp = Math.max(0, e.hp - a.self);
    popup("#enemy-panel", `-${a.self}`, "pop-dmg");
    updateBattle();
    if (e.hp <= 0) { await sleep(450); await winBattle(); return; }
  } else if (a && a.kind === "nuke") {
    log(T("log_tick"));
    shake(); sfx.nuke();
    await sleep(500);
    await enemyHit(a.dmg, { halve, src: "nuke" });
    if (G.over) return;
  }

  /* USA: escalation is itself a Funded purchase (2 gold per +2).
     The Manhattan Clock does not care about the chest. */
  if (e.id === "usa" && a && a.kind === "attack") {
    if (tryFund(2)) e.usaAtk += 2;
    else { log(T("log_ramp_broke")); sfx.bad(); }
  }

  if (e.id === "germany" && !e.fumesAnn && germanyFumes()) {
    e.fumesAnn = true;
    log(T("log_fumes"));
  }

  // duration ticks
  B.nopeStacks.forEach(s => s.turns--);
  B.nopeStacks = B.nopeStacks.filter(s => s.turns > 0);
  if (B.winterTurns > 0) B.winterTurns--;

  if (G.over || B.won) return;
  updateBattle();
  await sleep(550);
  startPlayerTurn();
}

/* ---------------- win / lose ---------------- */
async function winBattle() {
  if (B.won || G.over) return;
  B.won = true;
  bgm.stop();
  sfx.win();

  ach("baptism");
  (G.beaten = G.beaten || []).push(B.enemy.id);
  ach(`m_${G.playerCountry}_${B.enemy.id}`);
  if (!B.tookDamage) ach("no_scratch");
  polyglotRecord();

  const last = !G.endless && G.battleIdx === 2;
  if (G.endless) {
    G.streak = (G.streak || 0) + 1;
    recordStreak(G.streak);
    if (G.streak >= 5) ach("endless5");
    if (G.streak >= 10) ach("endless10");
    if (new Set(G.beaten || []).size >= 6) ach("world_tour");
  }
  if (last) {
    ach("mission_accomplished");
    if (!G.dirtyPlayed) ach("geneva");
    if (G.repHitZero) ach("war_criminal");
    if (G.hp <= 5) ach("photo_finish");
    if (G.repFloor >= 7) ach("spotless");
    if (G.pariah) ach("rockbottom");
  }

  await banner(T("banner_win"), T("banner_win_sub", coName(B.enemy.id)));
  if (last) { showVictory(); return; }

  // no refill: what you spent is spent for the rest of the run (spec 9)
  showDilemma();
}

function blockCardsInHand() {
  // during the enemy's turn the hand was just discarded — judge the hand
  // the player ended their turn with (Maginot Mindset would be dead otherwise)
  const ids = B.hand.length ? B.hand.map(h => h.id) : (B.lastHandIds || []);
  return ids.filter(id => id === "dig_in" || id === "little_friend").length;
}

function die(src) {
  if (G.over) return;
  G.over = true;
  bgm.stop();
  sfx.lose();
  let cause;
  if (src === "nuke") cause = "NUKED";
  else if (src === "blitz") cause = "BLITZED";
  else if (G.intervention) cause = "PARIAH";
  else if (B.enemy.id === "japan" && B.bankrupt) cause = "BANKRUPTED";
  else if (B.enemy.id === "soviet" && sovietStacks() > 0) cause = "OUTLASTED";
  else cause = "KILLED_IN_ACTION";

  if (cause === "NUKED") ach("read_clock");
  if (src === "blitz" && blockCardsInHand() >= 2) ach("maginot");
  if (B.enemy.id === "soviet" && sovietStacks() >= 3) ach("winter_regards");
  if (B.enemy.id === "japan" && B.bankrupt) ach("broke_dead");
  if (B.selfHarmTurn === B.turn) ach("own_goal");
  if (G.intervention && G.totalTurns - G.interventionTurn <= 3) ach("hague");

  updateBattle();
  setTimeout(() => showDeath(cause), 1000);
}

/* ============================================================
   RENDERING
   ============================================================ */
function popup(sel, text, cls) {
  const target = $(sel);
  if (!target) return;
  const r = target.getBoundingClientRect();
  const d = document.createElement("div");
  d.className = `pop ${cls}`;
  d.textContent = text;
  d.style.left = (r.left + r.width / 2 + (Math.random() * 60 - 30)) + "px";
  d.style.top = (r.top + r.height / 2) + "px";
  $("#fx-layer").appendChild(d);
  setTimeout(() => d.remove(), 1000);
}
function shake() {
  document.body.classList.remove("shake");
  void document.body.offsetWidth;
  document.body.classList.add("shake");
  setTimeout(() => document.body.classList.remove("shake"), 400);
}
function log(msg) {
  const el = $("#battle-log");
  if (!el) return;
  el.textContent = msg;
  el.classList.remove("flash");
  void el.offsetWidth;
  el.classList.add("flash");
}
function banner(title, subHtml, bad = false) {
  return new Promise(res => {
    const d = document.createElement("div");
    d.className = "banner-overlay";
    d.innerHTML = `<div class="banner"><h2 class="${bad ? "bad" : ""}">${title}</h2>${subHtml ? `<p>${subHtml}</p>` : ""}</div>`;
    document.body.appendChild(d);
    setTimeout(() => {
      d.classList.add("out");
      setTimeout(() => { d.remove(); res(); }, 300);
    }, 1500);
  });
}

function flagHtml(id, cls = "") {
  // pixel sprite when canvas is available, emoji flag otherwise
  const img = pixImg("countries", id, "pix-co");
  if (img) return `<span class="pixwrap ${cls}">${img}</span>`;
  const c = COUNTRIES[id];
  const soviet = id === "soviet" ? " soviet-flag" : "";
  return `<span class="${cls}${soviet}">${c.flag}</span>`;
}

function cardHtml(id, { click = "", disabled = false, showCost = null, big = false } = {}) {
  const c = CARDS[id];
  const cost = showCost === null ? c.cost : showCost;
  const cls = `card ${c.cat}${c.dirty ? " dirty" : ""}${disabled ? " unplayable" : ""}${big ? " big" : ""}`;
  const tag = click ? "button" : "div";
  const art = pixImg("cards", id, "pix-card");
  const facBadge = c.faction
    ? `<div class="cfaction">${c.sig ? "★" : ""}${pixImg("countries", c.faction, "pix-mini") || COUNTRIES[c.faction].flag}</div>`
    : "";
  return `<${tag} class="${cls}" ${click ? `onclick="${click}"` : ""}>
    <div class="cost${cost < c.cost ? " discount" : ""}">${cost}</div>
    ${c.rep ? `<div class="repcost">${T("rep_short")} ${c.rep}</div>` : ""}
    ${facBadge}
    ${art ? `<div class="cart">${art}</div>` : ""}
    <div class="cname">${esc(cardName(id))}</div>
    <div class="ctext">${esc(cardText(id))}</div>
    <div class="cflavor">${esc(cardFlavor(id))}</div>
  </${tag}>`;
}

/* Which screen is showing, so a language switch can redraw it in place. */
let rerender = () => showTitle();

/* Language is locked for the duration of a run. Switching mid-fight is almost
   always a misclick, and having the game change language under you while you
   are reading intents is worse than having to finish the run first. */
let runLocked = false;

function langBtnHtml(extraClass = "") {
  const m = langMeta(LANG);
  return `<button class="icon-btn lang-btn ${extraClass}" onclick="UI.openLangPicker()"
    title="${esc(T("language"))}" aria-label="${esc(T("language"))}">🌐 <span>${esc(m.code.split("-")[0].toUpperCase())}</span></button>`;
}

/* ---------------- screens ---------------- */
function showTitle() {
  G = null; B = null;
  runLocked = false;
  bgm.stop();
  rerender = showTitle;
  const done = allAchDone();
  $("#app").innerHTML = `
  <div class="screen">
    <div class="corner-bar">${langBtnHtml()}</div>
    <div class="logo">WAR<span>ECONOMY</span></div>
    ${T("logo_sub") ? `<div class="logo-zh">${T("logo_sub")}</div>` : ""}
    ${done ? `<div class="badge-gold">🏅 ${T("badge_war_over")}<span>${T("badge_war_over_sub")}</span></div>` : ""}
    ${bestStreak() ? `<div class="streak-badge">♾️ ${T("best_streak", bestStreak())}</div>` : ""}
    <p class="tag">${T("tagline")}</p>
    <ul class="howto">
      <li>${T("howto1")}</li>
      <li>${T("howto2")}</li>
      <li>${T("howto3")}</li>
    </ul>
    <button class="btn big" onclick="UI.toSelect()">${T("start")}</button>
    <div class="title-btns">
      <button class="btn ghost" onclick="UI.showHelp()">📖 ${T("help")}</button>
      <button class="btn ghost" onclick="UI.showAch()">🏆 ${T("achievements")} · ${achCount()}/${ACH_ORDER.length}</button>
    </div>
  </div>`;
}

/* Difficulty is chosen on the select screen and survives a language
   switch (which re-renders the screen in place). */
let modeSelected = "std";   // "std" | "hell" | "endless"

function showSelect() {
  rerender = showSelect;
  const cards = Object.keys(COUNTRIES).map(id =>
    `<button class="country-card" onclick="UI.pickCountry('${id}')">
      ${flagHtml(id, "flag")}
      <div class="cname">${coName(id)}</div>
      <div class="carch">${T("arch_" + id)}</div>
      <div class="cpro">✅ ${T("pro_" + id)}</div>
      <div class="ccon">⚠️ ${T("con_" + id)}</div>
      <div class="csig">★ ${esc(cardName(FACTIONS[id].sig))}</div>
    </button>`).join("");
  $("#app").innerHTML = `
  <div class="screen">
    <div class="corner-bar">${langBtnHtml()}</div>
    <h1 class="screen-title">${T("pick_side")}</h1>
    <p class="subtitle">${T("pick_side_sub")}</p>

    <div class="diff-row">
      <button class="diff-btn${modeSelected === "std" ? " on" : ""}" onclick="UI.setMode('std')">
        <b>${T("diff_normal")}</b><span>${T("diff_normal_sub")}</span>
      </button>
      <button class="diff-btn hell${modeSelected === "hell" ? " on" : ""}" onclick="UI.setMode('hell')">
        <b>🔥 ${T("diff_hell")}</b><span>${T("diff_hell_sub")}</span>
      </button>
      <button class="diff-btn endless${modeSelected === "endless" ? " on" : ""}" onclick="UI.setMode('endless')">
        <b>♾️ ${T("diff_endless")}</b><span>${T("diff_endless_sub", bestStreak())}</span>
      </button>
    </div>

    <div class="country-grid">${cards}</div>
    <button class="btn ghost" onclick="UI.showHelp()">📖 ${T("help")}</button>
  </div>`;
}

function showHelpModal() {
  const rules = [1, 2, 3, 4, 5, 6].map(i => `<li>${T("help_r" + i)}</li>`).join("");
  const facs = Object.keys(COUNTRIES).map(id => `
    <div class="fac-row">
      <div class="fac-head">${flagHtml(id, "fac-flag")}<b>${coName(id)}</b>
        <span class="fac-arch">${T("arch_" + id)}</span></div>
      <div class="cpro">✅ ${T("pro_" + id)}</div>
      <div class="ccon">⚠️ ${T("con_" + id)}</div>
    </div>`).join("");
  $("#modal-root").innerHTML = `
  <div class="modal-overlay" onclick="if(event.target===this)UI.closeModal()">
    <div class="modal help-modal">
      <h3>📖 ${T("help")}</h3>
      <div class="help-scroll">
        <div class="ach-sec">${T("help_rules_title")}</div>
        <ul class="help-list">${rules}</ul>
        <div class="ach-sec">${T("help_factions_title")}</div>
        ${facs}
      </div>
      <button class="btn" onclick="UI.closeModal()">${T("close")}</button>
    </div>
  </div>`;
}

function showBattleIntro() {
  rerender = showBattleIntro;
  const id = G.queue[G.battleIdx];
  const boss = G.endless ? (G.battleIdx % 3 === 2) : (G.battleIdx === 2 || G.hell);
  const opener = G.battleIdx === 0
    ? `<p class="subtitle">${T("opener", coName(G.playerCountry))}</p>` : "";
  $("#app").innerHTML = `
  <div class="screen">
    ${opener}
    <span class="vs-badge ${boss ? "boss" : ""}">${
      G.endless ? T("endless_badge", G.battleIdx + 1)
        : G.hell ? T("hell_badge", G.battleIdx + 1)
        : (boss ? T("boss_badge") : T("battle_badge", G.battleIdx + 1))}</span>
    ${flagHtml(id, "intro-flag")}
    <div class="intro-name">${coName(id)}</div>
    <p class="intro-quote">“${esc(coIntro(id))}”</p>
    <div class="intel">📋 <b>${T("intel")}</b> ${coGimmick(id)}<br><br>${T("intel_chest")}${boss ? `<br><br>${T("boss_buff")}` : ""}</div>
    <div class="mini-stats">${T("ministats", G.hp, G.maxHp, G.rep, repTitle(G.rep), G.deck.length)}</div>
    <button class="btn big" onclick="UI.fight()">${boss ? T("finish_it") : T("fight")}</button>
  </div>`;
}

function renderBattleSkeleton() {
  rerender = renderBattleSkeleton;
  const e = B.enemy;
  $("#app").innerHTML = `
  <div class="battle">
    <div class="topbar">
      <span class="battle-no">${G.endless ? T("wave_no", G.battleIdx + 1) : `⚔️ ${G.battleIdx + 1}/3`}</span>
      <div id="rep-box">
        <span>🌍</span>
        <div class="repbar"><div id="rep-fill"></div></div>
        <span class="rep-title" id="rep-title"></span>
      </div>
      <button class="icon-btn" onclick="UI.showDeck()" title="${T("view_deck")}">🃏</button>
      <button class="icon-btn" id="mute-btn" onclick="UI.toggleMute()" title="${T("sound")}">${muted ? "🔇" : "🔊"}</button>
    </div>

    <div class="panel" id="enemy-panel">
      <div id="usa-clock" style="display:none"></div>
      <div class="enemy-head">
        ${flagHtml(e.id, "enemy-flag")}
        <div style="flex:1;min-width:0">
          <div class="enemy-name">${coName(e.id)}${
            e.boss ? ` <span class="boss-tag">${G.endless ? T("endless_tag") : G.hell ? T("hell_tag") : T("final_boss_tag")}</span>` : ""}</div>
          <div class="hpbar"><div id="enemy-hp-fill"></div></div>
          <div class="hp-line"><span id="enemy-hp-text"></span><span id="enemy-chest" title="${esc(T("war_chest"))}"></span><span id="enemy-block"></span></div>
        </div>
      </div>
      <div class="status-row" id="enemy-status"></div>
      <div class="intent-row"><span class="intent-label">${T("next_label")}</span><span id="intents"></span></div>
      <div class="warn-text" id="warn-text" style="display:none"></div>
    </div>

    <div id="battle-log"></div>

    <div class="panel" id="player-panel">
      <div class="hpbar player"><div id="player-hp-fill"></div></div>
      <div class="hp-line"><span id="player-hp-text"></span><span id="player-block"></span></div>
      <div class="gold-row">
        <span class="gold-big" id="gold-text"></span>
        <span class="income-note" id="income-note"></span>
      </div>
      <div class="status-row" id="player-status"></div>
    </div>

    <div class="hand" id="hand"></div>

    <div class="actions">
      <div id="pile-info"></div>
      <button class="btn" id="send-it" onclick="UI.endTurn()">${T("send_it")}</button>
    </div>
  </div>`;
  updateBattle();
}

function intentHtml(a, future = false) {
  if (!a) return "";
  const e = B.enemy;
  const iv = (G.intervention ? 3 : 0) + (G.pariah ? 2 : 0) + waveBonus();
  const winter = (B.winterTurns > 0 ? (B.winterAmt || 2) : 0) + (B.chainHome ? 4 : 0);
  const adj = v => Math.max(0, v + iv - winter);
  let txt = "", warn = false;
  if (a.kind === "attack") {
    const per = adj(a.hits[0]);
    txt = `⚔️${a.hits.length > 1 ? `${per}×${a.hits.length}` : per}`;
    if (a.steal) txt += ` 💰-${a.steal}`;
    if (a.src === "blitz") warn = true;
  } else if (a.kind === "block") {
    txt = `🛡️${a.amount}`;
  } else if (a.kind === "kamikaze") {
    txt = `🔥${adj(a.dmg)}`;
    warn = true;
  } else if (a.kind === "nuke") {
    txt = `☢${adj(a.dmg)}`;
    warn = true;
  }
  let badge = "";
  if (a.funded || a.fundBadge) {
    const broke = B.fundedDisabled || (a.funded && e.chest + chestGain(e) < a.funded);
    badge = `<span class="fund${broke ? " broke" : ""}">💰${a.funded || ""}</span>`;
  }
  return `<span class="intent${warn ? " warn" : ""}${future ? " future" : ""}">${txt}${badge}</span>`;
}

function updateBattle() {
  if (!B || !$("#enemy-panel")) return;
  const e = B.enemy;

  // enemy
  $("#enemy-hp-fill").style.width = (100 * e.hp / e.maxHp) + "%";
  $("#enemy-hp-text").textContent = `❤️ ${e.hp}/${e.maxHp}`;
  $("#enemy-chest").textContent = `💰 ${e.chest}`;
  $("#enemy-block").textContent = e.block > 0 ? `🛡️ ${e.block}` : "";

  // usa clock
  const clockEl = $("#usa-clock");
  if (e.id === "usa") {
    clockEl.style.display = "block";
    clockEl.textContent = e.actIdx > 7 ? T("boom") : `☢ ${usaClock()}`;
  }

  // enemy statuses
  const es = [];
  if (e.id === "soviet" && sovietStacks() > 0)
    es.push(`<span class="chip warnchip">${T("chip_soviet", sovietStacks() * (e.boss ? 4 : 3))}</span>`);
  if (e.id === "japan" && e.hp < e.maxHp / 2 && e.hp > 0)
    es.push(`<span class="chip warnchip">${T("chip_divine")}</span>`);
  if (germanyFumes())
    es.push(`<span class="chip">${T("chip_fumes")}</span>`);
  if (G.intervention)
    es.push(`<span class="chip warnchip">${T("chip_intervention")}</span>`);
  if (G.pariah)
    es.push(`<span class="chip warnchip">${T("chip_pariah")}</span>`);
  if (B.fundedDisabled)
    es.push(`<span class="chip">${T("chip_funded_off")}</span>`);
  if (B.winterTurns > 0)
    es.push(`<span class="chip">${T("chip_winter", B.winterTurns)}</span>`);
  $("#enemy-status").innerHTML = es.join("");

  /* Intents are classified. Without recon you are guessing — Eye in the
     Sky is what buys you the enemy's plan (spec 3.1). */
  let intents, warnMsg = null;
  if (B.won || e.hp <= 0) {
    intents = "";
  } else if (!B.foresight) {
    intents = `<span class="intent unknown">${T("intent_unknown")}</span>`;
  } else if (B.enemySkip) {
    intents = `<span class="intent">${T("skipping")}</span>` + intentHtml(enemyAction(e.actIdx), true);
  } else {
    const next = enemyAction(e.actIdx);
    intents = intentHtml(next) + intentHtml(enemyAction(e.actIdx + 1), true);
    if (next.warn) warnMsg = next.warn;
    else {
      // Blitzkrieg gets an extra turn of warning (spec 3.1 / 6.1)
      const after = enemyAction(e.actIdx + 1);
      if (after && after.src === "blitz") warnMsg = T("warn_blitz_early");
    }
  }
  $("#intents").innerHTML = intents;
  const wt = $("#warn-text");
  if (warnMsg) { wt.style.display = "block"; wt.textContent = warnMsg; }
  else wt.style.display = "none";

  // rep
  $("#rep-fill").style.width = (100 * G.rep / REP_MAX) + "%";
  $("#rep-fill").style.background = G.rep >= 7 ? "var(--green)" : G.rep >= 3 ? "var(--amber)" : "var(--dirty)";
  $("#rep-title").textContent = `${G.rep} · ${repTitle(G.rep)}`;

  // player
  $("#player-hp-fill").style.width = (100 * G.hp / G.maxHp) + "%";
  $("#player-hp-text").textContent = `❤️ ${G.hp}/${G.maxHp}`;
  $("#player-block").textContent = B.playerBlock > 0 ? `🛡️ ${B.playerBlock}` : "";
  const goldEl = $("#gold-text");
  goldEl.textContent = `💰 ${B.gold}`;
  goldEl.classList.toggle("broke", B.bankrupt);

  const nextIncome = Math.max(0, 3 + B.permIncome
    - B.incomeDebuffs.reduce((s, d) => s + (d.turns > 0 ? d.amt : 0), 0)
    - B.stealNext) + B.lootNext - 1;
  $("#income-note").textContent = T("payday", nextIncome);

  const ps = [];
  if (B.bankrupt) ps.push(`<span class="chip warnchip">${T("chip_strike")}</span>`);
  if (B.noAttacks && !B.bankrupt) ps.push(`<span class="chip">${T("chip_timeout")}</span>`);
  if (B.permAtk > 0) ps.push(`<span class="chip">${T("chip_permatk", B.permAtk)}</span>`);
  if (B.turnAtkBonus > 0) ps.push(`<span class="chip">${T("chip_turnatk", B.turnAtkBonus)}</span>`);
  if (B.schwerpunkt) ps.push(`<span class="chip">${T("chip_schwerpunkt")}</span>`);
  if (B.suckerPunch) ps.push(`<span class="chip">${T("chip_sucker")}</span>`);
  if (B.permIncome > 0) ps.push(`<span class="chip">${T("chip_income", B.permIncome)}</span>`);
  if (G.rep >= 7) ps.push(`<span class="chip">${T("chip_aid")}</span>`);
  if (G.rep >= REP_MAX) ps.push(`<span class="chip">${T("chip_aid_max")}</span>`);
  if (B.oncePlayed.includes("war_machine")) ps.push(`<span class="chip">${T("chip_wm_spent")}</span>`);
  if (B.handCap > HAND_LIMIT) ps.push(`<span class="chip">${T("chip_handcap", B.handCap)}</span>`);
  if (B.lootNext > 0) ps.push(`<span class="chip">${T("chip_loot", B.lootNext)}</span>`);
  if (B.lootArrived) ps.push(`<span class="chip">${T("chip_loot_in")}</span>`);
  if (B.shadowEconomy > 0) ps.push(`<span class="chip">${T("chip_shadow", B.shadowEconomy)}</span>`);
  if (B.nopeStacks.length) ps.push(`<span class="chip">${T("chip_nope", nopeReduction(), Math.max(...B.nopeStacks.map(s => s.turns)))}</span>`);
  if (B.talkItOut) ps.push(`<span class="chip">${T("chip_talk")}</span>`);
  if (B.thorns > 0) ps.push(`<span class="chip">${T("chip_thorns", B.thorns)}</span>`);
  if (B.allHands) ps.push(`<span class="chip">${T("chip_allhands")}</span>`);
  if (B.rosie) ps.push(`<span class="chip">${T("chip_rosie")}</span>`);
  if (B.foresight) ps.push(`<span class="chip">${T("chip_recon")}</span>`);
  ps.push(...B.incomeDebuffs.map(d => `<span class="chip warnchip">${T("chip_debuff", d.amt, d.turns)}</span>`));
  if (B.stealNext > 0) ps.push(`<span class="chip warnchip">${T("chip_steal", B.stealNext)}</span>`);
  $("#player-status").innerHTML = ps.join("");

  // hand
  $("#hand").innerHTML = B.hand.map((entry, i) => {
    const c = CARDS[entry.id];
    const cost = effCost(entry);
    const disabled = B.gold < cost || spentOnce(entry.id) || usedThisTurn(entry.id)
      || (c.atk && (B.bankrupt || B.noAttacks));
    return cardHtml(entry.id, { click: `UI.play(${i})`, disabled, showCost: cost });
  }).join("");

  // piles + button
  $("#pile-info").textContent = T("piles", B.draw.length, B.discard.length, B.exhausted.length);
  $("#send-it").disabled = B.busy || B.won || G.over;
}

/* 无尽模式:对手永远续得上,且不会连着重复同一个 */
function queueMoreOpponents() {
  const others = Object.keys(COUNTRIES).filter(c => c !== G.playerCountry);
  let next = shuffle(others);
  if (next[0] === G.queue[G.queue.length - 1] && next.length > 1)
    [next[0], next[1]] = [next[1], next[0]];
  G.queue = G.queue.concat(next);
}

/* 最长连胜是无尽模式唯一的跨局存档 */
function bestStreak() {
  try { return parseInt(localStorage.getItem("we_streak") || "0", 10) || 0; }
  catch (e) { return 0; }
}
function recordStreak(n) {
  try { if (n > bestStreak()) localStorage.setItem("we_streak", String(n)); }
  catch (e) { /* 无痕模式等 */ }
}

/* ---------------- between-battle dilemmas (spec 9.2) ----------------
   One randomly drawn deal after each victory, priced in Reputation, HP,
   or the card reward itself. Declining is always free. */
const DILEMMAS = [
  { id: "salvage",     rep: -2, heal: 14 },
  { id: "requisition", rep: -2, extraPick: true },
  { id: "accords",     rep: 3,  hp: -8 },
  { id: "amnesty",     rep: 3,  skipReward: true },
];

let currentDilemma = null;

function showDilemma() {
  rerender = showDilemma;
  // keep the same offer if the player switches language while deciding
  if (!currentDilemma) {
    const pool = DILEMMAS.filter(d =>
      !(d.hp && G.hp + d.hp <= 0) &&      // never offer a suicide deal
      !(G.endless && (d.hp || d.heal)));  // 无尽下波回满血,拿血当筹码的抉择全是假的
    currentDilemma = shuffle(pool.length ? pool : DILEMMAS)[0];
  }
  const d = currentDilemma;
  $("#app").innerHTML = `
  <div class="screen">
    <span class="vs-badge">${T("dilemma_badge")}</span>
    <h1 class="screen-title">${T("dil_" + d.id + "_name")}</h1>
    <p class="intro-quote">“${esc(T("dil_" + d.id + "_flavor"))}”</p>
    <div class="intel">📋 ${T("dil_" + d.id + "_desc")}</div>
    <div class="dil-row">
      <button class="btn" onclick="UI.dilemma(true)">${T("dil_accept")}</button>
      <button class="btn ghost" onclick="UI.dilemma(false)">${T("dil_decline")}</button>
    </div>
    <div class="mini-stats">${T("ministats", G.hp, G.maxHp, G.rep, repTitle(G.rep), G.deck.length)}</div>
  </div>`;
}

function resolveDilemma(accept) {
  const d = currentDilemma;
  currentDilemma = null;
  if (!accept) { sfx.click(); showReward(); return; }
  sfx.card();
  if (d.hp) { G.hp = Math.max(1, G.hp + d.hp); sfx.hit(); }
  if (d.heal) { G.hp = clamp(G.hp + d.heal, 0, G.maxHp); sfx.heal(); }
  if (d.rep) changeRep(d.rep);
  if (d.extraPick) G.extraPicks = (G.extraPicks || 0) + 1;
  if (d.skipReward) { nextBattle(); return; }
  showReward();
}

function nextBattle() {
  G.battleIdx++;
  rewardPicks = null;
  showBattleIntro();
}

/* ---------------- reward / end screens ---------------- */
let rewardPicks = null;

/* Spec 2: reward pool = shared pool + own faction pool, faction ×1.5.
   奖励不给你已经有的牌——三张全是牌组里的旧牌等于没得选。
   只有在无尽模式里把所有牌都收齐之后,才会退回去允许重复。 */
function rollRewards() {
  const owned = new Set(G.deck);
  const all = [];
  for (const id of SHARED_IDS) all.push({ id, w: CARDS[id].rewardWeight || 2 });
  for (const id of FACTIONS[G.playerCountry].pool) all.push({ id, w: (CARDS[id].rewardWeight || 2) * 1.5 });
  let items = all.filter(x => !owned.has(x.id));
  if (items.length < 3) items = items.concat(all.filter(x => owned.has(x.id)));
  const picks = [];
  while (picks.length < 3 && items.length) {
    const total = items.reduce((s, x) => s + x.w, 0);
    let r = Math.random() * total, idx = 0;
    for (let i = 0; i < items.length; i++) { r -= items[i].w; if (r <= 0) { idx = i; break; } }
    picks.push(items[idx].id);
    items.splice(idx, 1);
  }
  return picks;
}

function showReward() {
  rerender = showReward;
  // keep the same three cards if the player switches language mid-choice
  if (!rewardPicks) rewardPicks = rollRewards();
  const cards = rewardPicks.map(id => cardHtml(id, { click: `UI.pickReward('${id}')` })).join("");
  $("#app").innerHTML = `
  <div class="screen">
    <h1 class="screen-title">${T("pick_poison")}</h1>
    <p class="subtitle">${T("pick_poison_sub")}</p>
    <div class="reward-row">${cards}</div>
    <div class="mini-stats">${T("reward_stats", G.hp, G.maxHp)}</div>
  </div>`;
}

function newAchHtml() {
  if (!G || !G.newAch.length) return "";
  const rows = G.newAch.map((id, i) =>
    `<div class="ach-item" style="animation-delay:${0.35 + i * 0.45}s">
      <span class="ach-ico">🏆</span>
      <div><b>${esc(achName(id))}</b><span>${esc(achText(id))}</span></div>
    </div>`).join("");
  return `<div class="ach-scroll"><div class="ach-scroll-title">${T("new_ach")}</div>${rows}</div>`;
}

function showVictory() {
  rerender = showVictory;
  runLocked = false;   // run is over — language is changeable again
  sfx.win();
  if (G.newAch.length) setTimeout(() => sfx.ach(), 700);
  $("#app").innerHTML = `
  <div class="screen">
    <div class="corner-bar">${langBtnHtml()}</div>
    <span class="vs-badge">${T("war_over")}</span>
    <h1 class="screen-title" style="font-size:clamp(30px,9vw,46px)">${T("victory_title")}</h1>
    <p class="tag">${T("victory_tag")}</p>
    <div class="stat-grid">
      <span class="k">${T("k_hp")}</span><span class="v">❤️ ${G.hp}/${G.maxHp}</span>
      <span class="k">${T("k_rep")}</span><span class="v">🌍 ${G.rep}/${REP_MAX} — ${repTitle(G.rep)}</span>
      <span class="k">${T("k_turns")}</span><span class="v">⏱ ${G.totalTurns}</span>
      <span class="k">${T("k_deck")}</span><span class="v">${T("v_deck", G.deck.length)}</span>
    </div>
    <p class="subtitle">${T("verdict", repTitle(G.rep), G.intervention)}</p>
    ${newAchHtml()}
    <button class="btn big" onclick="UI.restart()">${T("run_it_back")}</button>
  </div>`;
}

function showDeath(cause) {
  rerender = () => showDeath(cause);
  runLocked = false;   // run is over — language is changeable again
  const e = B ? coName(B.enemy.id) : "?";
  if (G.newAch.length) setTimeout(() => sfx.ach(), 700);
  $("#app").innerHTML = `
  <div class="screen">
    <div class="corner-bar">${langBtnHtml()}</div>
    <h1 class="screen-title">${T("death_title")}</h1>
    <div class="cause">☠ ${deathText(cause)}</div>
    <p class="subtitle">${G.endless
        ? T("endless_result", G.streak || 0, bestStreak())
        : T("defeated_by", e, G.battleIdx + 1)}</p>
    <div class="stat-grid">
      <span class="k">${T("k_rep")}</span><span class="v">🌍 ${G.rep}/10 — ${repTitle(G.rep)}</span>
      <span class="k">${T("k_turns_survived")}</span><span class="v">⏱ ${G.totalTurns}</span>
      <span class="k">${T("k_deck")}</span><span class="v">${T("v_deck", G.deck.length)}</span>
    </div>
    ${newAchHtml()}
    <button class="btn big" onclick="UI.restart()">${T("run_it_back")}</button>
  </div>`;
}

/* ---------------- modals ---------------- */
function openDealModal(handIdx) {
  const canBuy = B.gold >= 3;
  $("#modal-root").innerHTML = `
  <div class="modal-overlay" onclick="if(event.target===this)UI.closeModal()">
    <div class="modal">
      <h3>${T("deal_title")}</h3>
      <p class="subtitle" style="text-align:left">${T("deal_flavor")}</p>
      <button class="btn ghost" onclick="UI.dealChoice(${handIdx},'sell')">${T("deal_sell")}</button>
      <button class="btn ghost" onclick="UI.dealChoice(${handIdx},'buy')" ${canBuy ? "" : "disabled"}>${T("deal_buy")}</button>
      <button class="btn" onclick="UI.closeModal()">${T("never_mind")}</button>
    </div>
  </div>`;
}

function showLangModal() {
  const buttons = LANGS.map(l =>
    `<button class="lang-option${l.code === LANG ? " current" : ""}" onclick="UI.setLanguage('${l.code}')">
      <span class="lang-flag">${l.flag}</span><span>${esc(l.name)}</span>
    </button>`).join("");
  $("#modal-root").innerHTML = `
  <div class="modal-overlay" onclick="if(event.target===this)UI.closeModal()">
    <div class="modal">
      <h3>🌐 ${esc(T("pick_language"))}</h3>
      <div class="lang-grid">${buttons}</div>
      <button class="btn" onclick="UI.closeModal()">${esc(T("close"))}</button>
    </div>
  </div>`;
}

function showDeckModal() {
  const counts = {};
  for (const id of G.deck) counts[id] = (counts[id] || 0) + 1;
  const collator = new Intl.Collator(sortLocale());
  const rows = Object.keys(counts)
    .sort((a, b) => collator.compare(cardName(a), cardName(b)))
    .map(id => `<div>${counts[id]}× ${esc(cardName(id))} <span>(${CARDS[id].cost}💰)</span></div>`)
    .join("");
  $("#modal-root").innerHTML = `
  <div class="modal-overlay" onclick="if(event.target===this)UI.closeModal()">
    <div class="modal">
      <h3>${T("deck_title", G.deck.length)}</h3>
      <div class="deck-list">${rows}</div>
      <button class="btn" onclick="UI.closeModal()">${T("close")}</button>
    </div>
  </div>`;
}

/* Every row shows how to unlock it, locked or not — the list doubles as
   the reference sheet for what the game rewards. */
function achRowHtml(id) {
  const un = !!ACH_STATE[id];
  return `<div class="ach-row${un ? "" : " locked"}">
    <span class="ach-ico">${un ? "🏆" : "🔒"}</span>
    <div>
      <b>${un ? esc(achName(id)) : T("ach_locked_name")}</b>
      <span class="ach-cond">${T("ach_how")} ${esc(achHint(id))}</span>
      ${un ? `<span class="ach-flavor">${esc(achText(id))}</span>` : ""}
    </div>
  </div>`;
}

function showAchModal() {
  const sec = (label, ids) =>
    `<div class="ach-sec">${label} · ${ids.filter(i => ACH_STATE[i]).length}/${ids.length}</div>`
    + ids.map(achRowHtml).join("");
  $("#modal-root").innerHTML = `
  <div class="modal-overlay" onclick="if(event.target===this)UI.closeModal()">
    <div class="modal ach-modal">
      <h3>🏆 ${T("achievements")} · ${achCount()}/${ACH_ORDER.length}</h3>
      ${allAchDone() ? `<div class="badge-gold">🏅 ${T("badge_war_over")}<span>${T("badge_war_over_sub")}</span></div>` : ""}
      <div class="ach-list">
        ${sec(T("ach_sec_general"), ACH_GENERAL)}
        ${sec(T("ach_sec_matchup"), ACH_MATCHUP)}
        ${sec(T("ach_sec_death"), ACH_DEATH)}
      </div>
      <button class="btn" onclick="UI.closeModal()">${T("close")}</button>
    </div>
  </div>`;
}

/* ---------------- UI handlers ---------------- */
window.UI = {
  toSelect() { sfx.click(); showSelect(); },
  setMode(m) { modeSelected = m; sfx.click(); showSelect(); },
  setHell(v) { modeSelected = v ? "hell" : "std"; sfx.click(); showSelect(); },
  pickCountry(id) {
    sfx.click();
    newRun(id, modeSelected === "hell", modeSelected === "endless");
    runLocked = true;
    showBattleIntro();
  },
  showHelp() { sfx.click(); showHelpModal(); },
  fight() { sfx.click(); initBattle(); },
  play(i) { playCard(i); },
  endTurn() { endTurn(); },
  pickReward(id) {
    sfx.card();
    G.deck.push(id);
    rewardPicks = null;
    if (G.extraPicks > 0) { G.extraPicks--; showReward(); return; }  // Requisition the Yards
    nextBattle();
  },
  dilemma(accept) { resolveDilemma(accept); },
  restart() { sfx.click(); rewardPicks = null; currentDilemma = null; showTitle(); },
  showAch() { sfx.click(); showAchModal(); },
  openLangPicker() {
    if (runLocked) return;
    sfx.click();
    showLangModal();
  },
  setLanguage(code) {
    if (runLocked) { UI.closeModal(); return; }  // never swap language mid-run
    setLang(code);
    sfx.click();
    UI.closeModal();
    rerender();          // redraw the current screen in the new language
  },
  toggleMute() {
    muted = !muted;
    const b = $("#mute-btn");
    if (b) b.textContent = muted ? "🔇" : "🔊";
    if (muted) bgm.pause(); else bgm.resume();
    sfx.click();
  },
  showDeck() { sfx.click(); showDeckModal(); },
  closeModal() { $("#modal-root").innerHTML = ""; },
  async dealChoice(handIdx, which) {
    UI.closeModal();
    if (B.busy || G.over || B.won) return;
    B.busy = true;
    B.hand.splice(handIdx, 1);
    B.discard.push("art_deal");
    B.cardsPlayed++;
    B.playedThisTurn.push("art_deal");
    sfx.card();
    if (which === "sell") {
      B.gold += 4;
      popup("#player-panel", "+4 💰", "pop-steal");
      sfx.coin();
      changeRep(-1);
      log(T("log_sold"));
    } else {
      B.gold -= 3;
      changeRep(1);
      log(T("log_respect"));
    }
    B.busy = false;
    updateBattle();
  },
};

/* ---------------- boot ---------------- */
setLang(detectLang());
showTitle();
