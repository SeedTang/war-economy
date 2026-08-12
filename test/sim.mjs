/* Balance simulation for WAR ECONOMY.
   A heuristic bot plays full runs headlessly (instant timers) and we
   tally win rates per faction. The bot uses one shared policy with
   light faction awareness, so RELATIVE spread between factions is the
   signal; absolute win rates depend on bot skill.
     node test/sim.mjs [runsPerFaction]                              */
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function makeEl() {
  return {
    innerHTML: "", textContent: "", style: {}, disabled: false,
    className: "", lang: "", dir: "",
    classList: { add() {}, remove() {}, toggle() {} },
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 40 }),
    appendChild() {}, remove() {}, offsetWidth: 0,
  };
}
const els = new Map();
const storage = new Map();
const sandbox = {
  console, Math, JSON, Intl, Promise, Object, Array, String, Number, Set, Map, Date,
  document: {
    querySelector(sel) { if (!els.has(sel)) els.set(sel, makeEl()); return els.get(sel); },
    createElement: () => makeEl(),
    documentElement: makeEl(),
    body: makeEl(),
  },
  localStorage: {
    getItem: k => (storage.has(k) ? storage.get(k) : null),
    setItem: (k, v) => storage.set(k, String(v)),
    removeItem: k => storage.delete(k),
  },
  navigator: { language: "en", languages: ["en"] },
  setTimeout: (fn) => { fn(); return 0; },   // instant — sims don't wait
  clearInterval: () => {},
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
const ctx = vm.createContext(sandbox);

for (const f of ["i18n.js", "lang/en.js", "sprites.js", "game.js"]) {
  vm.runInContext(readFileSync(join(ROOT, f), "utf8"), ctx, { filename: f });
}

/* ---------------- the bot (runs inside the game context) ---------------- */
vm.runInContext(`
function estIncoming() {
  if (!B || B.enemySkip) return 0;
  if (!B.foresight) return 6;   // blind: assume a middling hit (spec 3.1)
  const a = enemyAction(B.enemy.actIdx);
  if (!a) return 0;
  const iv = G.intervention ? 3 : 0, w = B.winterTurns > 0 ? 2 : 0;
  const adj = v => Math.max(0, v + iv - w);
  if (a.kind === "attack") return a.hits.reduce((s, h) => s + adj(h), 0);
  if (a.kind === "kamikaze" || a.kind === "nuke") return adj(a.dmg);
  return 0;
}

function totalAttackAvail() {
  if (B.bankrupt || B.noAttacks) return 0;
  const base = { charge:6, double_tap:10, big_boom:14, burn_it_all:18, death_above:8,
    scorched_sky:20, guderian:9, desert_fox:9, wolfpack:4, zhukov:10, katyusha:16,
    deep_battle:10, night_raid:7, zero_rush:(B.lootArrived?8:5), patton_push:Math.floor(1.5*grossIncome()),
    taierzhuang:Math.min(14, 4 + Math.max(0, B.turn - 1)), flying_tigers:8,
    desert_rats:(B.foresight ? 13 : 9), lancaster:16,
    free_france:(lowHp() ? 12 : 6), leclerc:(lowHp() ? 16 : 10) };
  let gold = B.gold, dmg = 0;
  const items = B.hand
    .map((h, i) => ({ id: h.id, c: effCost(h), d: (base[h.id] || 0) + (CARDS[h.id].atk ? B.permAtk + B.turnAtkBonus : 0) }))
    .filter(x => CARDS[x.id].atk && x.d > 0)
    .sort((a, b) => b.d / (b.c + 1) - a.d / (a.c + 1));
  for (const x of items) if (x.c <= gold) { gold -= x.c; dmg += x.d; }
  return dmg;
}

function scoreCard(h) {
  const id = h.id, e = B.enemy;
  const inc = estIncoming();
  const early = G.battleIdx < 2 && B.turn <= 4;
  const hpLow = G.hp <= 30;
  const ehp = e.hp + e.block;
  const avail = totalAttackAvail();
  const lethal = avail >= ehp;
  let s;
  switch (id) {
    case "war_machine": case "liberty_ships": s = early ? 9 : (B.turn <= 6 ? 4 : 1); break;
    case "ural": s = early ? 8 : 3; break;
    case "arsenal_democracy": s = early ? 9 : 3; break;
    case "enchilada": s = early ? 7 : 3; break;
    case "shadow_economy": s = (early && e.chest >= 3) ? 8 : 1; break;
    case "ike_arsenal": s = grossIncome() >= 8 ? 7 : 0; break;
    case "rosie": s = B.hand.some(x => x !== h && CARDS[x.id].cat === "bld" && effCost(x) <= B.gold - effCost(h)) ? 5 : 0; break;
    case "bigger_guns": s = B.turn <= 5 ? 6 : 2; break;
    case "dig_in": s = inc >= 6 ? 8 : (inc >= 4 && hpLow ? 6 : 1); break;
    case "little_friend": s = inc >= 6 ? 7 : 1; break;
    case "nope_zone": s = inc >= 7 ? 6 : 1; break;
    case "talk_out": s = inc >= 10 ? 8 : 1; break;
    case "general_winter": s = inc >= 8 ? 7 : 2; break;
    case "time_out": s = inc >= 14 ? 9 : 0; break;
    case "patch_up": s = G.hp <= G.maxHp - 12 ? (hpLow ? 8 : 4) : 0; break;
    case "good_guy": s = G.rep <= 3 ? 9 : 0; break;
    case "eye_sky": s = B.foresight ? 0 : 7; break;
    case "all_aboard": s = B.gold >= 2 ? 3 : 1; break;
    case "autobahn": s = B.gold >= 3 ? 4 : 1; break;
    // at 3 gold it only pays off with a full hand AND gold left to spend the discount
    case "all_hands": s = (B.hand.length >= 4 && B.gold >= 6) ? 3 : 0; break;
    case "buy_now": s = (B.gold <= 1 && ehp <= 14) ? 3 : 0; break;
    case "art_deal": s = G.rep >= 8 ? 2 : 0; break;
    case "fake_news": s = (G.rep >= 6 && G.hp <= 38) ? 4 : 0; break;
    case "sucker_punch": s = (G.rep >= 5 && (lethal || ehp <= 20)) ? 7 : 0; break;
    case "scorched_sky": s = G.rep >= 5 ? (lethal ? 10 : 6) : 0; break;
    case "lets_have_it": s = avail >= 10 ? 6 : 0; break;
    case "schwerpunkt": s = B.hand.some(x => ["big_boom","burn_it_all","katyusha","patton_push","charge","double_tap"].includes(x.id)) ? 6 : 0; break;
    case "tokyo_express": s = e.chest > 0 ? (early ? 8 : 6) : 0; break;
    case "wolfpack": s = e.chest > 0 ? 6 : 4; break;
    case "yamamoto": s = e.chest >= 3 ? 7 : 2; break;
    case "zero_rush": s = B.lootArrived ? 8 : 4; break;
    case "night_raid": s = effCost(h) === 0 ? 9 : 5; break;
    case "deep_battle": s = G.hp > 15 ? 5 : 0; break;
    case "burn_it_all": s = lethal ? 9 : (B.turn >= 4 ? 5 : 2); break;
    case "big_boom": s = 6; break;
    case "double_tap": s = 5; break;
    case "charge": s = 4; break;
    case "death_above": s = e.block > 0 ? 7 : 4; break;
    case "guderian": s = B.cardsPlayed === 0 ? 7 : 5; break;
    case "zhukov": s = 6; break;
    case "katyusha": s = 7; break;
    case "desert_fox": s = 6; break;
    case "patton_push": s = grossIncome() >= 6 ? 8 : 3; break;

    /* --- 中国 --- */
    // 台儿庄越拖越强,前期打是浪费
    case "taierzhuang": s = B.turn >= 5 ? 8 : (B.turn >= 3 ? 5 : 3); break;
    case "flying_tigers": s = e.block > 0 ? 8 : 6; break;
    case "the_hump": s = early ? 8 : 3; break;
    case "guerrilla": s = inc >= 8 ? 7 : 2; break;
    case "changsha": s = inc >= 8 ? 8 : (inc >= 5 ? 5 : 1); break;

    /* --- 英国 --- */
    case "bletchley": s = B.foresight ? 1 : 7; break;
    case "chain_home": s = inc >= 8 ? 7 : 1; break;
    case "desert_rats": s = 6; break;
    // 封锁金库:对靠钱开大招的敌人才值钱
    case "convoy_blockade": s = e.chest >= 3 ? (["usa","germany","uk","china"].includes(e.id) ? 7 : 5) : 1; break;
    case "lancaster": s = 7; break;

    /* --- 法国 --- */
    // 自由法国/勒克莱尔在残血时翻倍,健康时别急着打
    case "free_france": s = lowHp() ? 8 : 5; break;
    case "maginot": s = inc >= 9 ? 8 : (inc >= 6 ? 5 : 1); break;
    case "resistance_net": s = e.chest > 0 ? (early ? 6 : 4) : 2; break;
    case "leclerc": s = lowHp() ? 8 : 6; break;
    case "liberation": s = G.hp <= G.maxHp - 10 ? (hpLow ? 8 : 5) : (G.rep <= 6 ? 3 : 0); break;

    default: s = 1;
  }
  if (CARDS[id].atk) {
    if (e.id === "soviet") s += 2;                    // don't leave it wounded
    if (e.id === "usa" && usaClock() <= 4) s += 3;    // beat the deadline
    if (lethal) s += 4;
  }
  // reputation is a one-way budget: don't spend the last of it casually
  const repCost = CARDS[id].rep;
  if (repCost && repCost < 0) {
    const after = G.rep + repCost;
    if (after <= 0 && !G.pariah) s -= lethal ? 2 : 9;       // arms every enemy for the rest of the run
    else if (after <= 2 && !G.intervention) s -= lethal ? 1 : 5;
  }
  return s;
}

async function botPlayPhase() {
  const skippedIds = new Set();
  for (let guard = 0; guard < 25; guard++) {
    if (G.over || B.won) return;
    let best = -1, bestS = 0;
    for (let i = 0; i < B.hand.length; i++) {
      const h = B.hand[i], c = CARDS[h.id];
      if (skippedIds.has(h.id)) continue;
      if (spentOnce(h.id)) continue;        // capped card: dead in hand, don't stall on it
      if (usedThisTurn(h.id)) continue;     // faction cards are once per turn
      if (effCost(h) > B.gold) continue;
      if (c.atk && (B.bankrupt || B.noAttacks)) continue;
      const s = scoreCard(h);
      if (s > bestS) { bestS = s; best = i; }
    }
    if (best === -1) return;
    const id = B.hand[best].id;
    if (CARDS[id].choice) {
      if (G.rep >= 8) await UI.dealChoice(best, "sell");
      else skippedIds.add(id);
      continue;
    }
    await playCard(best);
  }
}

function botPickReward() {
  const val = { war_machine:8, liberty_ships:8, ural:7, arsenal_democracy:8, enchilada:6,
    bigger_guns:6, ike_arsenal:6, big_boom:6, katyusha:7, death_above:5, double_tap:5,
    patton_push:6, night_raid:6, zero_rush:5, wolfpack:5, yamamoto:5, shadow_economy:5,
    tokyo_express:5, dig_in:4, little_friend:4, nope_zone:4, talk_out:3, general_winter:5,
    autobahn:5, all_aboard:4, patch_up:5, eye_sky:2, good_guy:2, time_out:2, art_deal:1,
    fake_news:2, sucker_punch:3, scorched_sky:4, burn_it_all:5, charge:3, lets_have_it:4,
    all_hands:3, buy_now:1, deep_battle:4, schwerpunkt:4, desert_fox:5, guderian:5,
    zhukov:6, rosie:3,
    taierzhuang:6, flying_tigers:6, the_hump:7, guerrilla:4, changsha:5,
    bletchley:4, chain_home:4, desert_rats:6, convoy_blockade:5, lancaster:7,
    free_france:6, maginot:4, resistance_net:5, leclerc:6, liberation:5 };
  const early = G.battleIdx === 0;
  let best = rewardPicks[0], bs = -1;
  for (const id of rewardPicks) {
    let s = val[id] || 1;
    if (early && CARDS[id].cat === "bld") s += 2;
    if (!early && CARDS[id].atk) s += 1;
    if (CARDS[id].faction) s += 1;
    if (s > bs) { bs = s; best = id; }
  }
  UI.pickReward(best);
}

async function simRun(faction) {
  modeSelected = globalThis.__HELL ? "hell" : "std";
  UI.pickCountry(faction);
  UI.fight();
  for (let safety = 0; safety < 500; safety++) {
    if (G.over) return { win: false, battles: G.battleIdx, turns: G.totalTurns };
    if (B.won) {
      if (G.battleIdx === 2) return { win: true, battles: 3, turns: G.totalTurns };
      // dilemma first: take heals when hurt, cards when healthy, never sell
      // reputation below the allied-aid line
      if (currentDilemma) {
        const d = currentDilemma;
        let take = false;
        if (d.id === "salvage") take = G.hp <= G.maxHp - 14 && G.rep >= 5;
        else if (d.id === "requisition") take = G.rep >= 6;
        else if (d.id === "accords") take = G.hp > 24 && G.rep <= 5;
        else if (d.id === "amnesty") take = G.rep <= 4;
        UI.dilemma(take);
      }
      while (rewardPicks) botPickReward();
      UI.fight();
      continue;
    }
    await botPlayPhase();
    if (G.over || B.won) continue;
    await endTurn();
  }
  return { win: false, battles: G.battleIdx, turns: G.totalTurns, stalled: true };
}
`, ctx, { filename: "bot.js" });

/* ---------------- optional A/B: pre-change theft (same-turn pocket) ----------------
   `node test/sim.mjs 1000 oldtheft` re-runs with the OLD rule for comparison. */
if (process.argv[3] === "oldtheft") {
  vm.runInContext(`
    stealFromChest = function (n) {
      const e = B.enemy;
      const actual = Math.min(e.chest, n);
      e.chest -= actual;
      if (actual > 0) {
        B.gold += actual + B.shadowEconomy;   // straight into the pocket
        B.lootArrived = true;                 // act-based Zero Rush, as before
        B.stolenTotal += actual;
        if (B.stolenTotal >= 15) ach("pickpocket");
      }
      updateBattle();
    };
  `, ctx, { filename: "oldtheft-patch.js" });
  console.log("=== A/B mode: OLD theft rule (same-turn gold) ===");
}

/* ---------------- driver ---------------- */
const N = parseInt(process.argv[2] || "1000", 10);
if (process.argv.includes("hell")) { vm.runInContext("globalThis.__HELL = true;", ctx); console.log("=== HELL MODE (every battle is a boss) ==="); }
const factions = ["germany", "soviet", "japan", "usa", "china", "uk", "france"];
const results = {};

for (const f of factions) {
  let wins = 0, turns = 0, stalled = 0;
  const lostAt = [0, 0, 0];
  for (let i = 0; i < N; i++) {
    const r = await vm.runInContext(`simRun(${JSON.stringify(f)})`, ctx);
    if (r.win) wins++;
    else lostAt[Math.min(2, r.battles)]++;
    turns += r.turns;
    if (r.stalled) stalled++;
  }
  results[f] = { winPct: (100 * wins / N), avgTurns: turns / N, lostAt, stalled };
  console.log(
    `${f.padEnd(8)} win ${results[f].winPct.toFixed(1)}%  ` +
    `avg turns ${results[f].avgTurns.toFixed(1)}  ` +
    `losses at battle1/2/3: ${lostAt.join("/")}` +
    (stalled ? `  STALLED ${stalled}` : "")
  );
}

const rates = factions.map(f => results[f].winPct);
const spread = Math.max(...rates) - Math.min(...rates);
console.log(`\nspread: ${spread.toFixed(1)} percentage points (target ≤ 10)`);
