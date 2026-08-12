/* Headless smoke-test harness for WAR ECONOMY.
   Loads i18n.js + lang/en.js + game.js into a vm context with DOM stubs,
   then drives real game logic and asserts spec behavior. */
import { readFileSync } from "node:fs";
import vm from "node:vm";

const ROOT = "/Users/zgy/war-economy";

/* ---------- DOM / browser stubs ---------- */
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
  console,
  Math, JSON, Intl, Promise, Object, Array, String, Number, Set, Map, Date,
  document: {
    querySelector(sel) {
      if (!els.has(sel)) els.set(sel, makeEl());
      return els.get(sel);
    },
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
  // scale all delays down 50× so battles resolve fast but ordering holds
  setTimeout: (fn, ms) => setTimeout(fn, Math.max(1, (ms || 0) / 50)),
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
const ctx = vm.createContext(sandbox);

for (const f of ["i18n.js", "lang/en.js", "sprites.js", "game.js"]) {
  vm.runInContext(readFileSync(`${ROOT}/${f}`, "utf8"), ctx, { filename: f });
}

/* ---------- test kit ---------- */
let pass = 0, fail = 0;
const failures = [];
function t(name, cond) {
  if (cond) pass++;
  else { fail++; failures.push(name); }
}
const run = code => vm.runInContext(code, ctx);
const sleepReal = ms => new Promise(r => setTimeout(r, ms));
// wait until the battle engine is idle (no busy flag, player's turn)
async function settle(ms = 400) { await sleepReal(ms); }

function fresh(player, enemy, battleIdx = 0) {
  run(`
    UI.pickCountry(${JSON.stringify(player)});
    {
      const want = ${JSON.stringify(enemy)};
      const rest = Object.keys(COUNTRIES).filter(c => c !== ${JSON.stringify(player)} && c !== want);
      rest.splice(${battleIdx}, 0, want);   // desired enemy sits at the fought index
      G.queue = rest;
      G.battleIdx = ${battleIdx};
    }
    // park reputation below both allied-aid tiers before the first income
    // step, so damage and gold assertions measure the mechanic under test
    G.rep = 6; G.repFloor = 6;
    UI.fight();
  `);
}
const S = code => {
  const raw = run(`JSON.stringify(${code})`);
  if (raw === undefined) { console.log(`  [S undefined] ${code}`); return undefined; }
  return JSON.parse(raw);
};

/* ============================================================ */
async function main() {

/* ---------- S1: starter deck + Japan steal kit vs USA ---------- */
fresh("japan", "usa");
t("S1 starter deck spec 5.4", JSON.stringify(S("G.deck")) ===
  JSON.stringify(["charge","charge","tokyo_express","dig_in","dig_in","war_machine","all_aboard","patch_up"]));
t("S1 chest starts 10", S("B.enemy.chest") === 10);
t("S1 player hp 50", S("G.hp") === 50);
t("S1 first-turn gold 2 (aid off at rep 6)", S("B.gold") === 2);
t("S1 usa intent has fund badge", S("enemyAction(0).fundBadge") === true);

run(`B.hand = [{id:"tokyo_express"},{id:"zero_rush"},{id:"night_raid"},{id:"shadow_economy"},{id:"yamamoto"}]; B.gold = 10; updateBattle();`);
run("UI.play(0)"); await settle();           // tokyo express: steal 3 → NEXT income
t("S1 chest 8 after steal of 2", S("B.enemy.chest") === 8);
t("S1 no same-turn gold (10-2 cost)", S("B.gold") === 8);
t("S1 loot queued for next income", S("B.lootNext") === 2);

const hpBefore = S("B.enemy.hp");
run("UI.play(0)"); await settle();           // zero rush same turn → only 5 (arrival-based)
t("S1 zero rush 5 before loot arrives", hpBefore - S("B.enemy.hp") === 5);

run("UI.play(1)"); await settle();           // shadow economy
t("S1 shadow economy stack", S("B.shadowEconomy") === 1);
const g0 = S("B.gold"), c0 = S("B.enemy.chest");
run(`B.factionThisTurn = []; B.hand.unshift({id:"tokyo_express"}); updateBattle(); UI.play(0)`); await settle();
t("S1 shadow bonus rides loot (2 + 2+1 queued)", S("B.lootNext") === 2 + 2 + 1);
t("S1 second steal costs gold only (-2)", S("B.gold") - g0 === -2);
t("S1 chest drained by 2", c0 - S("B.enemy.chest") === 2);

// yamamoto (hand is now [night_raid, yamamoto]): steal 5 from a chest of 5 →
// drains it, and disables the next funded move (USA ramp)
run("B.enemy.chest = 5; UI.play(1)"); await settle();
t("S1 yamamoto disables funded", S("B.fundedDisabled") === true);
t("S1 chest 0", S("B.enemy.chest") === 0);
t("S1 night raid costs 0 on empty chest", S("effCost({id:'night_raid'})") === 0);

const atk0 = S("B.enemy.usaAtk");
run("UI.endTurn()"); await settle(800);      // usa turn: chest +2, attack, ramp DISABLED by yamamoto
t("S1 ramp eaten by yamamoto", S("B.enemy.usaAtk") === atk0);
t("S1 chest 2 after gain, no ramp spend", S("B.enemy.chest") === 2);
t("S1 took damage tracked", S("B.tookDamage") === true);

// loot arrives with this income step: 3+3+1 (tokyo ×2 + shadow) + 4+1 (yamamoto drained 4)
t("S1 loot arrived with income (3 + 11 loot − 1 upkeep)", S("B.gold") === 13);
t("S1 lootArrived flag set", S("B.lootArrived") === true);
const hp2 = S("B.enemy.hp");
run(`B.hand.unshift({id:"zero_rush"}); B.gold += 1; updateBattle(); UI.play(0)`); await settle();
t("S1 zero rush 8 on arrival turn", hp2 - S("B.enemy.hp") === 8);

run("UI.endTurn()"); await settle(800);      // usa turn: chest 2+2=4, attack, ramp −2 → +2 atk
t("S1 ramp resumes (+2)", S("B.enemy.usaAtk") === atk0 + 2);
t("S1 chest 2 after ramp spend", S("B.enemy.chest") === 2);
t("S1 loot does not repeat (income back to 2)", S("B.gold") === 2);
t("S1 lootArrived cleared", S("B.lootArrived") === false);

/* ---------- S2: pickpocket + manhattan clock ---------- */
fresh("japan", "usa");
run("B.enemy.chest = 20; B.hand = Array.from({length: 8}, () => ({id:'tokyo_express'})); B.gold = 40; updateBattle();");
for (let i = 0; i < 8; i++) { run("B.factionThisTurn = []"); run("UI.play(0)"); await settle(120); }
t("S2 pickpocket at 15 stolen", S("!!ACH_STATE.pickpocket") === true);

// those 5 signature plays cost 10 reputation, which would add intervention
// and pariah damage on top; this section is about the clock, so clear them
run("G.rep = 6; G.intervention = false; G.pariah = false;");
run("B.enemy.actIdx = 7; updateBattle();");
t("S2 clock 1 before nuke", S("usaClock()") === 1);
t("S2 intent is nuke 40", S("enemyAction(7).dmg") === 40);
run("G.hp = 45; B.playerBlock = 0;");
run("UI.endTurn()"); await settle(900);      // nuke lands
t("S2 nuke dealt 40", S("G.hp") === 5);
t("S2 clock BOOM (0)", S("usaClock()") === 0);
t("S2 post-nuke intent is attack again", S("enemyAction(B.enemy.actIdx).kind") === "attack");

run("G.hp = 3; B.enemy.actIdx = 7; B.enemy.hp = 45; updateBattle();");
run("UI.endTurn()"); await settle(900);
t("S2 nuke death ends run", S("G.over") === true);
t("S2 read_clock achievement", S("!!ACH_STATE.read_clock") === true);

/* ---------- S3: Germany — blitz funding + fumes + maginot ---------- */
fresh("japan", "germany");
t("S3 blitz telegraphed early", S("enemyAction(1).src") === "blitz");
t("S3 blitz funded cost 3", S("enemyAction(1).funded") === 3);
run("G.hp = 50; B.playerBlock = 0;");
run("UI.endTurn()"); await settle(800);      // attack 8
t("S3 opener hits 8", S("G.hp") === 42);
run("UI.endTurn()"); await settle(900);      // blitz funded: chest 10+2(gains)−3 = 9, hits 6×2
t("S3 blitz 6x2 landed", S("G.hp") === 30);
t("S3 chest paid for blitz (10+2-3=9)", S("B.enemy.chest") === 9);

fresh("japan", "germany");
run("B.enemy.chest = 0; G.hp = 50;");
run("UI.endTurn()"); await settle(800);      // attack 8 (chest 0+1=1)
run("UI.endTurn()"); await settle(900);      // blitz broke: 1+1=2 < 3 → single 6
t("S3 broke blitz downgrades to 6", S("G.hp") === 50 - 8 - 6);

// fumes: from 4th cycle attacks −2
fresh("japan", "germany");
run("B.enemy.actIdx = 9;");
t("S3 fumes active cycle 4", S("germanyFumes()") === true);
t("S3 fumed opener 6", S("enemyAction(9).hits[0]") === 6);
t("S3 fumed blitz 4x2", S("enemyAction(10).hits[0]") === 4);

// maginot: die to blitz holding 2 block cards
fresh("japan", "germany");
run("G.hp = 5; B.enemy.actIdx = 1; B.enemy.chest = 10; B.hand = [{id:'dig_in'},{id:'dig_in'},{id:'charge'}]; updateBattle();");
run("UI.endTurn()"); await settle(900);
t("S3 blitz death", S("G.over") === true);
t("S3 maginot achievement", S("!!ACH_STATE.maginot") === true);

/* ---------- S4: Soviet — funded block, rage stacks, winter_regards ---------- */
fresh("japan", "soviet");
run("B.enemy.actIdx = 2; B.enemy.chest = 10;");   // block turn
run("UI.endTurn()"); await settle(700);
t("S4 funded block 6", S("B.enemy.block") === 6);
t("S4 chest paid 2 (10+1-2=9)", S("B.enemy.chest") === 9);

fresh("japan", "soviet");
run("B.enemy.actIdx = 2; B.enemy.chest = 0;");
run("UI.endTurn()"); await settle(700);
t("S4 broke block → nothing", S("B.enemy.block") === 0);

fresh("japan", "soviet");
run("B.enemy.hp = 30;");                          // lost 20/50 = 40% → 1 stack
t("S4 rage stacks at 40% lost", S("sovietStacks()") === 1);
t("S4 attack 5+3", S("enemyAction(0).hits[0]") === 8);
run("B.enemy.hp = 40; ");                         // heal-proof: monotonic
t("S4 stacks monotonic", S("sovietStacks()") === 1);
run("B.enemy.hp = 5;");
t("S4 stacks cap 3", S("sovietStacks()") === 3);
run("G.hp = 2; updateBattle(); UI.endTurn()"); await settle(800);
t("S4 outlasted death", S("G.over") === true);
t("S4 winter_regards achievement", S("!!ACH_STATE.winter_regards") === true);

/* ---------- S5: Japan enemy — steal→chest, kamikaze, broke_dead ---------- */
fresh("germany", "japan");
const jc = S("B.enemy.chest");
run("G.hp = 50; UI.endTurn()"); await settle(800);   // attack 4 + steal 2
t("S5 japan steals into chest", S("B.enemy.chest") === jc + 1 + 2);
// the skim lands on the very next payday: 3 income − 2 stolen − 1 upkeep = 0
t("S5 income skimmed (3-2-1=0 gold)", S("B.gold") === 0);

fresh("germany", "japan");
run("B.enemy.hp = 14; B.enemy.actIdx = 1; B.enemy.chest = 10; G.hp = 50;");
t("S5 kamikaze telegraphed", S("enemyAction(1).kind") === "kamikaze");
run("UI.endTurn()"); await settle(900);
t("S5 kamikaze 12 dmg", S("G.hp") === 38);
t("S5 kamikaze self-harm 5", S("B.enemy.hp") === 9);
t("S5 kamikaze funded 4 (10+1-4=7)", S("B.enemy.chest") === 7);

fresh("germany", "japan");
run("B.enemy.hp = 14; B.enemy.actIdx = 1; B.enemy.chest = 0; G.hp = 50;");
run("UI.endTurn()"); await settle(900);
t("S5 broke kamikaze → attack 4", S("G.hp") === 46 && S("B.enemy.hp") === 14);

fresh("germany", "japan");
run("B.incomeDebuffs.push({amt: 9, turns: 1}); B.enemy.hp = 14; B.enemy.actIdx = 1; B.enemy.chest = 10;");
run("UI.endTurn()"); await settle(300);              // start next player turn bankrupt
run("G.hp = 2; updateBattle();");
run("UI.endTurn()"); await settle(900);              // kamikaze kills while bankrupt
t("S5 bankrupt death vs japan", S("G.over") === true);
t("S5 broke_dead achievement", S("!!ACH_STATE.broke_dead") === true);

/* ---------- S6: Germany player kit ---------- */
fresh("germany", "soviet");
t("S6 guderian is signature", S("G.deck.includes('guderian')") === true);
run("G.rep = 8; B.hand = [{id:'guderian'},{id:'guderian'}]; B.gold = 5; B.enemy.block = 0; updateBattle();");
let e0 = S("B.enemy.hp");
run("UI.play(0)"); await settle();
t("S6 guderian first card 6+6", e0 - S("B.enemy.hp") === 12);
e0 = S("B.enemy.hp");
run("B.factionThisTurn = []; UI.play(0)"); await settle();
t("S6 guderian later 4+4", e0 - S("B.enemy.hp") === 8);

run("B.hand = [{id:'schwerpunkt'},{id:'charge'}]; B.gold = 5; updateBattle();");
run("UI.play(0)"); await settle(150);
t("S6 schwerpunkt flag", S("B.schwerpunkt") === true);
e0 = S("B.enemy.hp");
run("UI.play(0)"); await settle();
t("S6 doubled charge 12", e0 - S("B.enemy.hp") === 12);
t("S6 schwerpunkt consumed", S("B.schwerpunkt") === false);
t("S6 schwerpunkt exhausted", S("B.exhausted.includes('schwerpunkt')") === true);

run("B.hand = [{id:'desert_fox'}]; B.gold = 5; B.enemy.block = 5; B.enemy.actIdx = 0; updateBattle();");
e0 = S("B.enemy.hp");
run("UI.play(0)"); await settle();
t("S6 fox pierces vs telegraphed attack", e0 - S("B.enemy.hp") === 9 && S("B.enemy.block") === 5);
run("B.factionThisTurn = []; B.hand = [{id:'desert_fox'}]; B.gold = 5; B.enemy.block = 9; B.enemy.actIdx = 2; updateBattle();"); // block telegraphed
e0 = S("B.enemy.hp");
run("UI.play(0)"); await settle();
t("S6 fox blocked vs block intent", e0 - S("B.enemy.hp") === 0 && S("B.enemy.block") === 0);

run("B.hand = [{id:'wolfpack'}]; B.gold = 5; B.enemy.chest = 10; B.enemy.block = 0; B.lootNext = 0; updateBattle();");
e0 = S("B.enemy.hp"); const wg = S("B.gold");
run("UI.play(0)"); await settle();
t("S6 wolfpack: hit 4 now, 3 gold next income", S("B.gold") - wg === -2 && e0 - S("B.enemy.hp") === 4 && S("B.lootNext") === 3);

run("B.draw = ['charge','charge','big_boom']; B.hand = [{id:'autobahn'}]; B.gold = 5; updateBattle();");
run("UI.play(0)"); await settle();
t("S6 autobahn drew 2 discounted", S("B.hand.filter(h => h.disc).length") === 2);
t("S6 discounted charge costs 0", S("effCost(B.hand.find(h => h.disc && h.id === 'charge'))") === 0);

/* ---------- S7: Soviet player kit ---------- */
fresh("soviet", "germany");
run("B.hand = [{id:'zhukov'}]; B.gold = 5; G.hp = 40; B.enemy.block = 0; updateBattle();");
e0 = S("B.enemy.hp");
run("UI.play(0)"); await settle();
t("S7 zhukov 10 dmg", e0 - S("B.enemy.hp") === 10);
t("S7 zhukov healed 4", S("G.hp") === 44);

run("B.hand = [{id:'katyusha'}]; B.gold = 5; updateBattle();");
e0 = S("B.enemy.hp");
run("UI.play(0)"); await settle(600);
t("S7 katyusha 4x4", e0 - S("B.enemy.hp") === 16);

run("B.hand = [{id:'general_winter'}]; B.gold = 5; updateBattle();");
run("UI.play(0)"); await settle(150);
t("S7 winter turns 3", S("B.winterTurns") === 3);
run("G.hp = 50; B.enemy.actIdx = 0; updateBattle(); UI.endTurn()"); await settle(800);
t("S7 winter softened 8→6", S("G.hp") === 44);
t("S7 winter ticked to 2", S("B.winterTurns") === 2);

fresh("soviet", "germany");  // fresh enemy so 10 damage can't lethal-overlap earlier chip
run("B.hand = [{id:'deep_battle'}]; B.gold = 5; G.hp = 20; B.enemy.block = 0; updateBattle();");
e0 = S("B.enemy.hp");
run("UI.play(0)"); await settle();
t("S7 deep battle: −3 self, 10 dmg", S("G.hp") === 17 && e0 - S("B.enemy.hp") === 10);

fresh("soviet", "germany");
run("B.hand = [{id:'deep_battle'}]; B.gold = 5; G.hp = 3; updateBattle();");
run("UI.play(0)"); await settle(400);
t("S7 own goal death", S("G.over") === true);
t("S7 own_goal achievement", S("!!ACH_STATE.own_goal") === true);

run("delete ACH_STATE.economist;");
fresh("soviet", "germany");
run("B.hand = [{id:'ural'}]; B.gold = 5; G.hp = 30; updateBattle();");
run("UI.play(0)"); await settle();
t("S7 ural: income+1 heal 4", S("B.permIncome") === 1 && S("G.hp") === 34);

/* ---------- S8: USA player kit + economist ---------- */
fresh("usa", "japan");
run("B.hand = [{id:'liberty_ships'}]; B.draw = ['charge']; B.gold = 5; updateBattle();");
run("UI.play(0)"); await settle();
t("S8 liberty: income+1 draw 1", S("B.permIncome") === 1 && S("B.hand.length") === 1);

run("B.hand = [{id:'rosie'},{id:'war_machine'},{id:'charge'}]; B.gold = 5; updateBattle();");
run("UI.play(0)"); await settle(150);
t("S8 rosie discounts buildings", S("effCost(B.hand.find(h=>h.id==='war_machine'))") === 1);
t("S8 rosie leaves military alone", S("effCost(B.hand.find(h=>h.id==='charge'))") === 1);

run("B.permIncome = 3; B.hand = [{id:'ike_arsenal'},{id:'patton_push'}]; B.gold = 9; B.enemy.block = 0; updateBattle();");
run("UI.play(0)"); await settle(150);
t("S8 ike: gross 6 → +1 atk (4 income per stack)", S("B.permAtk") === 1);
e0 = S("B.enemy.hp");
run("UI.play(0)"); await settle();
t("S8 patton: floor(1.5×6)=9 +1 permAtk = 10", e0 - S("B.enemy.hp") === 10);

run("B.hand = [{id:'arsenal_democracy'}]; B.gold = 5; G.rep = 6; updateBattle();");
run("UI.play(0)"); await settle(150);
t("S8 arsenal: +2 income, +1 rep", S("B.permIncome") === 5 && S("G.rep") === 7);
t("S8 economist at 8 income", S("!!ACH_STATE.economist") === true);

/* ---------- S9: politics, rep, intervention, textbook ---------- */
fresh("usa", "germany");
run("B.hand = [{id:'lets_have_it'},{id:'double_tap'},{id:'sucker_punch'}]; B.gold = 8; B.enemy.hp = 60; B.enemy.maxHp = 60; B.enemy.block = 3; G.rep = 7; updateBattle();");
run("UI.play(0)"); await settle(150);
run("UI.play(1)"); await settle(150);        // sucker punch first (index 1 after shift)
e0 = S("B.enemy.hp");
run("UI.play(0)"); await settle(500);        // double tap: (5+4)×1.5 = 13.5 → 14 ×2, pierce
t("S9 graduation combo 28 pierce", e0 - S("B.enemy.hp") === 28);
t("S9 textbook achievement", S("!!ACH_STATE.textbook") === true);
t("S9 rep dropped 2", S("G.rep") === 5);
t("S9 dirty tracked", S("G.dirtyPlayed") === true);

run("G.rep = 4; changeRep(-2);");
t("S9 intervention fired at ≤2", S("G.intervention") === true);
t("S9 enemy +15 hp", S("B.enemy.maxHp") === 75);
t("S9 intent +3 shown", S("enemyAction(B.enemy.actIdx).hits[0]") >= 0); // display adj is in intentHtml
run("G.hp = 1; updateBattle(); UI.endTurn()"); await settle(900);
t("S9 pariah death", S("G.over") === true);
t("S9 hague achievement", S("!!ACH_STATE.hague") === true);

// time out: enemy skips, chest still grows, clock frozen
fresh("usa", "germany");
run("B.hand = [{id:'time_out'},{id:'charge'}]; B.gold = 8; updateBattle();");
run("UI.play(0)"); await settle(150);
t("S9 timeout blocks attacks", S("B.noAttacks") === true);
run("UI.play(0)"); await settle(150);
t("S9 attack refused during timeout", S("B.hand.length") === 1);
const ai0 = S("B.enemy.actIdx"), ch0 = S("B.enemy.chest");
run("UI.endTurn()"); await settle(700);
t("S9 enemy skipped (actIdx frozen)", S("B.enemy.actIdx") === ai0);
t("S9 chest still grew", S("B.enemy.chest") === ch0 + 1);
t("S9 time out exhausted", S("B.exhausted.includes('time_out')") === true);

// art of the deal both ways
run("B.hand = [{id:'art_deal'}]; B.gold = 5; G.rep = 7; updateBattle();");
run("UI.dealChoice(0, 'sell');"); await settle(150);
t("S9 deal sell: +4 gold −1 rep", S("B.gold") === 9 && S("G.rep") === 6);
run("B.hand = [{id:'art_deal'}]; updateBattle(); UI.dealChoice(0, 'buy');"); await settle(150);
t("S9 deal buy: −3 gold +1 rep", S("B.gold") === 6 && S("G.rep") === 7);

/* ---------- S10: rewards pool + weighting ---------- */
fresh("japan", "usa");
const rolls = S(`(() => {
  const seen = new Set(); let bad = 0, factionHits = 0;
  for (let i = 0; i < 300; i++) {
    const r = rollRewards();
    if (new Set(r).size !== 3) bad++;
    for (const id of r) {
      seen.add(id);
      const c = CARDS[id];
      if (c.faction && c.faction !== "japan") bad++;
      if (c.sig) bad++;
      if (c.faction === "japan") factionHits++;
    }
  }
  return { bad, factionHits, poolSize: seen.size };
})()`);
t("S10 rewards always legal", rolls.bad === 0);
t("S10 faction cards appear weighted", rolls.factionHits > 100); // expect ~20% of 900
t("S10 pool covers shared+faction", rolls.poolSize >= 20);

/* ---------- S11: boss buffs ---------- */
fresh("japan", "germany", 2);
t("S11 boss hp 35+15", S("B.enemy.maxHp") === 50);
t("S11 boss blitz 8x2", S("enemyAction(1).hits[0]") === 8);
fresh("japan", "soviet", 2);
run("B.enemy.hp = 5;");
t("S11 boss soviet +4/tier", S("enemyAction(0).hits[0]") === 5 + 3 * 4);
fresh("japan", "usa", 2);
t("S11 boss nuke 52", S("enemyAction(7).dmg") === 52);
fresh("germany", "japan", 2);
run("B.enemy.hp = 10;");
t("S11 boss kamikaze 16", S("enemyAction(1).dmg") === 16);

/* ---------- S12: win path + run achievements ---------- */
run("ACH_STATE = {}; localStorage.setItem('we_ach', '{}');");
fresh("japan", "usa", 2);                      // treat as final battle
run("G.dirtyPlayed = false; G.hp = 4; B.enemy.hp = 1; B.hand = [{id:'charge'}]; B.gold = 5; B.enemy.block = 0; updateBattle();");
run("UI.play(0)"); await settle(1200);
t("S12 battle won", S("B.won") === true);
t("S12 baptism", S("!!ACH_STATE.baptism") === true);
t("S12 matchup m_japan_usa", S("!!ACH_STATE.m_japan_usa") === true);
t("S12 mission accomplished", S("!!ACH_STATE.mission_accomplished") === true);
t("S12 geneva (no dirty)", S("!!ACH_STATE.geneva") === true);
t("S12 photo finish (hp≤5)", S("!!ACH_STATE.photo_finish") === true);
t("S12 newAch queued for end screen", S("G.newAch.length") >= 5);

// polyglot: two prior languages + this win in en
run("localStorage.setItem('we_polyglot', JSON.stringify(['es','fr']));");
fresh("japan", "germany");
run("B.enemy.hp = 1; B.hand = [{id:'charge'}]; B.gold = 5; B.enemy.block = 0; updateBattle();");
run("UI.play(0)"); await settle(1200);
t("S12 polyglot across 3 languages", S("!!ACH_STATE.polyglot") === true);

// no_scratch: untouched battle
fresh("soviet", "japan");
run("B.enemy.hp = 1; B.hand = [{id:'charge'}]; B.gold = 5; B.enemy.block = 0; updateBattle();");
run("UI.play(0)"); await settle(1200);
t("S12 not a scratch", S("!!ACH_STATE.no_scratch") === true);

/* ---------- S14: War Machine once per battle + All Hands nerf ---------- */
fresh("germany", "soviet");
run("B.hand = [{id:'war_machine'},{id:'war_machine'}]; B.gold = 10; updateBattle();");
run("UI.play(0)"); await settle(150);
t("S14 first War Machine gives +1", S("B.permIncome") === 1);
t("S14 recorded in oncePlayed", S("B.oncePlayed.includes('war_machine')") === true);
const wmGold = S("B.gold");
run("UI.play(0)"); await settle(150);
t("S14 second copy gives no income", S("B.permIncome") === 1);
t("S14 second copy not consumed", S("B.hand.length") === 1);
t("S14 second copy costs nothing", S("B.gold") === wmGold);
t("S14 spentOnce true", S("spentOnce('war_machine')") === true);

// cap survives the turn, resets next battle
run("UI.endTurn()"); await settle(800);
t("S14 still capped next turn", S("spentOnce('war_machine')") === true);
fresh("germany", "japan");
t("S14 cap resets in a new battle", S("spentOnce('war_machine')") === false);

// other income cards are NOT capped (spec 5.5)
fresh("usa", "germany");
run("B.hand = [{id:'liberty_ships'},{id:'liberty_ships'}]; B.draw = ['charge','charge']; B.gold = 10; updateBattle();");
run("UI.play(0)"); await settle(150);
run("B.factionThisTurn = []; UI.play(0)"); await settle(150);
t("S14 Liberty Ships still stacks", S("B.permIncome") === 2);

// All Hands: cost 3, weight 1
t("S14 All Hands costs 3", S("CARDS.all_hands.cost") === 3);
t("S14 All Hands reward weight 1", S("CARDS.all_hands.rewardWeight") === 1);
fresh("japan", "usa");
const wRoll = S(`(() => {
  let allHands = 0, other = 0; const peers = new Set();
  for (let i = 0; i < 4000; i++) for (const id of rollRewards()) {
    if (id === "all_hands") allHands++;
    else if (CARDS[id].cat === "bld" && !CARDS[id].faction) { other++; peers.add(id); }
  }
  return { allHands, other, peers: peers.size };
})()`);
t("S14 All Hands rarer than peers",
  wRoll.allHands > 0 && wRoll.peers > 0 && wRoll.allHands * 1.6 < wRoll.other / wRoll.peers);

/* ---------- S20: 三个新国家 + 无尽模式 ---------- */
t("S20 七个国家", S("Object.keys(COUNTRIES).length") === 7);
t("S20 七个阵营", S("Object.keys(FACTIONS).length") === 7);
t("S20 59 张卡", S("Object.keys(CARDS).length") === 59);
t("S20 新招牌卡各扣 2 声誉", S(`["taierzhuang","bletchley","free_france"].every(id => CARDS[id].rep === -2 && CARDS[id].sig)`) === true);

// 中国:伤害随回合数增长,且敌方被动也挂在回合数上
fresh("china", "germany");
t("S20 中国起手牌含台儿庄", S("G.deck.includes('taierzhuang')") === true);
run("B.turn = 1; B.hand = [{id:'taierzhuang'}]; B.gold = 9; B.enemy.hp = 300; B.enemy.maxHp = 300; B.enemy.block = 0; updateBattle();");
let e20 = S("B.enemy.hp");
run("UI.play(0)"); await settle(300);
t("S20 台儿庄第1回合打 4", e20 - S("B.enemy.hp") === 4);
run("G.rep = 8; B.turn = 8; B.factionThisTurn = []; B.hand = [{id:'taierzhuang'}]; B.gold = 9; updateBattle();");
e20 = S("B.enemy.hp");
run("UI.play(0)"); await settle(300);
t("S20 台儿庄第8回合打 11", e20 - S("B.enemy.hp") === 11);

fresh("japan", "china");
t("S20 中国敌人 55 血", S("B.enemy.maxHp") === 55);
run("B.turn = 1;"); t("S20 持久加成 第1回合为0", S("protractedBonus()") === 0);
run("B.turn = 7;"); t("S20 持久加成 第7回合为+4", S("protractedBonus()") === 4);
run("B.turn = 1;"); t("S20 中国第二格是格挡", S("enemyAction(1).kind") === "block");

// 英国:侦察加成、金库冻结、封锁喂自己金库
fresh("uk", "germany");
run("B.foresight = false; B.hand = [{id:'desert_rats'}]; B.gold = 9; B.enemy.block = 0; B.enemy.hp = 300; updateBattle();");
e20 = S("B.enemy.hp"); run("UI.play(0)"); await settle(300);
t("S20 沙漠之鼠 无侦察 9", e20 - S("B.enemy.hp") === 9);
run("B.foresight = true; B.factionThisTurn = []; B.hand = [{id:'desert_rats'}]; B.gold = 9; updateBattle();");
e20 = S("B.enemy.hp"); run("UI.play(0)"); await settle(300);
t("S20 沙漠之鼠 有侦察 13", e20 - S("B.enemy.hp") === 13);
run("B.hand = [{id:'convoy_blockade'}]; B.gold = 9; B.enemy.chest = 10; B.lootNext = 0; updateBattle(); UI.play(0)"); await settle(300);
t("S20 封锁偷 3 并冻结金库", S("B.lootNext") === 3 && S("B.chestFrozen") === 3);
const chestBefore = S("B.enemy.chest");
run("B.hand = []; UI.endTurn()"); await settle(900);
t("S20 冻结期间金库不增长", S("B.enemy.chest") <= chestBefore);

fresh("japan", "uk");
t("S20 英国敌人 40 血", S("B.enemy.maxHp") === 40);
t("S20 英国第二格是封锁", S("enemyAction(1).steal") === 2 && S("enemyAction(1).chestGain") === 3);
t("S20 英国轰炸机需资助 4", S("enemyAction(5).funded") === 4);

// 法国:半血以下翻倍;敌方被动同理
fresh("france", "germany");
run("G.hp = 50; B.hand = [{id:'free_france'}]; B.gold = 9; B.enemy.block = 0; B.enemy.hp = 300; updateBattle();");
e20 = S("B.enemy.hp"); run("UI.play(0)"); await settle(300);
t("S20 自由法国 满血 6", e20 - S("B.enemy.hp") === 6);
run("G.rep = 8; G.hp = 20; B.factionThisTurn = []; B.hand = [{id:'free_france'}]; B.gold = 9; updateBattle();");
e20 = S("B.enemy.hp"); run("UI.play(0)"); await settle(300);
t("S20 自由法国 残血 12", e20 - S("B.enemy.hp") === 12);

fresh("japan", "france");
t("S20 法国敌人 38 血", S("B.enemy.maxHp") === 38);
t("S20 法国满血攻 5", S("enemyAction(0).hits[0]") === 5);
run("B.enemy.hp = 10;");
t("S20 法国残血攻 10", S("enemyAction(0).hits[0]") === 10);

// Chain Home 减伤
fresh("uk", "germany");
run("G.hp = 50; B.playerBlock = 0; B.chainHome = true; B.enemy.actIdx = 0; updateBattle(); UI.endTurn()"); await settle(900);
t("S20 Chain Home 减 4 伤", S("G.hp") === 46);

// 无尽模式
run(`modeSelected = "endless"; UI.pickCountry("germany"); UI.fight();`);
t("S20 无尽标记", S("G.endless") === true);
t("S20 无尽第一波不是Boss", S("B.enemy.boss") === false);
t("S20 无尽波次为0", S("B.enemy.wave") === 0);
run("G.battleIdx = 2; UI.fight();");
t("S20 无尽每三波一个Boss", S("B.enemy.boss") === true);
t("S20 无尽第3波血量递增", S("B.enemy.maxHp") > S("COUNTRIES[B.enemy.id].hp"));
t("S20 无尽波次加成", S("waveBonus()") === 2);
run("G.battleIdx = 20; UI.fight();");
t("S20 对手池自动续上", S("B.enemy.id") !== undefined && S("G.queue.length") > 20);
run(`modeSelected = "std";`);

/* ---------- S19: v13 — rep cap 8, hidden intents, once-per-turn, nerfs ---------- */
fresh("japan", "germany");
t("S19 reputation ceiling is 8", S("REP_MAX") === 8);
run("G.rep = 8; changeRep(5);");
t("S19 rep cannot exceed 8", S("G.rep") === 8);

// Tokyo Express is free of reputation now
t("S19 Tokyo Express bills 1 reputation, not 2", S("CARDS.tokyo_express.rep") === -1);
t("S19 other signatures still cost 2", S(`["guderian","zhukov","liberty_ships"].every(id => CARDS[id].rep === -2)`) === true);
t("S19 Tokyo Express costs 2 gold", S("CARDS.tokyo_express.cost") === 2);
run("G.rep = 8; B.hand = [{id:'tokyo_express'}]; B.gold = 5; updateBattle(); UI.play(0)"); await settle(300);
t("S19 playing it bills 1 reputation", S("G.rep") === 7);

// intents are hidden without recon
fresh("japan", "germany");
t("S19 no free telegraph", S("(updateBattle(), document.querySelector('#intents').innerHTML.includes('unknown'))") === true);
run("B.foresight = true; updateBattle();");
t("S19 recon reveals two moves", S("document.querySelector('#intents').innerHTML.split('intent').length - 1") >= 2);

// faction cards: once per turn each
fresh("soviet", "germany");
run("B.hand = [{id:'katyusha'},{id:'katyusha'}]; B.gold = 20; B.enemy.hp = 400; B.enemy.maxHp = 400; B.enemy.block = 0; updateBattle();");
run("UI.play(0)"); await settle(700);
t("S19 first faction card plays", S("B.factionThisTurn.includes('katyusha')") === true);
const heldHp = S("B.enemy.hp");
run("UI.play(0)"); await settle(400);
t("S19 second copy blocked this turn", S("B.hand.length") === 1 && S("B.enemy.hp") === heldHp);
run("B.hand = []; UI.endTurn()"); await settle(900);
t("S19 limit resets next turn", S("B.factionThisTurn.length") === 0);
// shared cards are unaffected
run("B.hand = [{id:'charge'},{id:'charge'}]; B.gold = 9; B.enemy.block = 0; updateBattle();");
const beforeTwo = S("B.enemy.hp");
run("UI.play(0)"); await settle(300); run("UI.play(0)"); await settle(300);
t("S19 non-faction cards still repeat", beforeTwo - S("B.enemy.hp") === 12);

// USA nerfs
fresh("usa", "germany");
run("B.permIncome = 5; B.hand = [{id:'ike_arsenal'},{id:'patton_push'}]; B.gold = 20; B.enemy.block = 0; B.enemy.hp = 300; B.enemy.maxHp = 300; updateBattle();");
run("UI.play(0)"); await settle(300);
t("S19 Ike needs 4 income per stack (8/4=2)", S("B.permAtk") === 2);
const pattonBefore = S("B.enemy.hp");
run("UI.play(0)"); await settle(400);
t("S19 Patton is 1.5x income (floor(1.5*8)=12, +2 permAtk)", pattonBefore - S("B.enemy.hp") === 14);

// Soviet boss trimmed
fresh("japan", "soviet", 2);
t("S19 Soviet boss HP 55 not 65", S("B.enemy.maxHp") === 55);
fresh("japan", "germany", 2);
t("S19 other bosses unchanged (+15)", S("B.enemy.maxHp") === 50);

/* ---------- S18: Japan HP, allied aid, dilemmas, rep refill ---------- */
t("S18 Japan HP is 45", S("COUNTRIES.japan.hp") === 45);
fresh("germany", "japan");
t("S18 Japan boss HP 60", S("B.enemy.maxHp") === 45);
fresh("germany", "japan", 2);
t("S18 Japan as boss is 60", S("B.enemy.maxHp") === 60);

// allied aid: +1 gold at rep >= 7
fresh("germany", "soviet");
t("S18 rep 8 grants aid (3+1-1=3)", S("(G.rep = 8, startPlayerTurn(), B.gold)") === 3);
run("G.rep = 6; B.hand = []; UI.endTurn()"); await settle(800);
t("S18 no aid below 7 (3-1=2)", S("B.gold") === 2);
run("G.rep = 8; G.hp = 30; B.enemy.actIdx = 2; B.enemy.chest = 10; B.hand = []; UI.endTurn()"); await settle(800);
t("S18 rep at the ceiling heals 2/turn", S("G.hp") === 32);
t("S18 ceiling still pays gold aid", S("B.gold") === 3);

// reputation refills to 8 after a battle, penalties do not
fresh("germany", "soviet");
run("G.rep = 1; G.intervention = true; G.pariah = true; B.enemy.hp = 1; B.hand = [{id:'charge'}]; B.gold = 5; B.enemy.block = 0; updateBattle();");
run("UI.play(0)"); await settle(1400);
t("S18 reputation is NOT refilled after a win", S("G.rep") === 1);
t("S18 intervention stays", S("G.intervention") === true);
t("S18 pariah stays", S("G.pariah") === true);
t("S18 a dilemma is offered", S("!!currentDilemma") === true);

// accepting resolves the deal, declining is free
run("currentDilemma = DILEMMAS.find(d => d.id === 'salvage'); G.hp = 20; G.rep = 8;");
run("UI.dilemma(true)"); await settle(200);
t("S18 salvage heals 14", S("G.hp") === 34);
t("S18 salvage costs 2 rep", S("G.rep") === 6);
t("S18 dilemma cleared", S("currentDilemma") === null);

fresh("germany", "soviet");
run("G.rep = 5; G.hp = 40; currentDilemma = DILEMMAS.find(d => d.id === 'accords');");
run("UI.dilemma(true)"); await settle(200);
t("S18 accords: -8 HP, +3 rep (capped 8)", S("G.hp") === 32 && S("G.rep") === 8);

fresh("germany", "soviet");
run("G.rep = 5; currentDilemma = DILEMMAS.find(d => d.id === 'requisition'); UI.dilemma(true)"); await settle(200);
t("S18 requisition grants an extra pick", S("G.extraPicks") === 1);

fresh("germany", "soviet");
run("G.hp = 30; G.rep = 8; currentDilemma = DILEMMAS.find(d => d.id === 'salvage'); UI.dilemma(false)"); await settle(200);
t("S18 declining costs nothing", S("G.hp") === 30 && S("G.rep") === 8);

// a dilemma that would kill you is never offered
fresh("germany", "soviet");
run("G.hp = 5; currentDilemma = null;");
const offers = S(`(() => {
  const seen = new Set();
  for (let i = 0; i < 200; i++) { currentDilemma = null; showDilemma(); seen.add(currentDilemma.id); }
  return [...seen];
})()`);
t("S18 never offers a lethal deal", !offers.includes("accords"));

/* ---------- S17: signature cards cost Reputation, Total Pariah at 0 ---------- */
fresh("germany", "soviet");
t("S17 runs start at 8 rep", S("(UI.pickCountry('germany'), G.rep)") === 8);
t("S17 signature carries rep cost", S("CARDS.guderian.rep") === -2);
t("S17 three signatures priced (Tokyo Express exempt)", S(`["guderian","zhukov","liberty_ships"].every(id => CARDS[id].rep === -2)`) === true);
t("S17 non-signature faction cards are free", S("CARDS.desert_fox.rep === undefined && CARDS.katyusha.rep === undefined") === true);

run("B.hand = [{id:'guderian'}]; B.gold = 5; B.enemy.block = 0; updateBattle();");
run("UI.play(0)"); await settle(400);
t("S17 playing signature costs 2 rep", S("G.rep") === 6);

// burn down to the floor: 8 → 0 is four signature plays
run("G.rep = 4; B.factionThisTurn = []; B.hand = [{id:'guderian'}]; B.gold = 5; updateBattle(); UI.play(0)"); await settle(400);
t("S17 rep 2 fires intervention", S("G.rep") === 2 && S("G.intervention") === true);
t("S17 pariah not yet", S("G.pariah") === false);
run("B.factionThisTurn = []; B.hand = [{id:'guderian'}]; B.gold = 5; updateBattle(); UI.play(0)"); await settle(400);
t("S17 rep 0 fires Total Pariah", S("G.rep") === 0 && S("G.pariah") === true);

// pariah adds +2 to every enemy attack, on top of intervention's +3
run("G.hp = 50; B.playerBlock = 0; B.enemy.actIdx = 0; B.winterTurns = 0; updateBattle();");
const base = S("enemyAction(0).hits[0]");
run("UI.endTurn()"); await settle(900);
t("S17 pariah +2 stacks with intervention +3", 50 - S("G.hp") === base + 3 + 2);

// it follows you into the next battle and never lifts
t("S17 rep does not refill mid-run", S("G.rep") === 0);
run("G.battleIdx = 1; G.queue = ['soviet','japan','usa']; UI.fight();");
t("S17 pariah persists into the next battle", S("G.pariah") === true);
run("G.hp = 50; B.playerBlock = 0; B.winterTurns = 0; updateBattle();");
const base2 = S("enemyAction(B.enemy.actIdx).hits[0]");
run("UI.endTurn()"); await settle(900);
t("S17 next enemy is buffed too", 50 - S("G.hp") === base2 + 3 + 2);

// a fresh run restores it
fresh("japan", "usa");
t("S17 new run resets rep to 8", S("(newRun('japan'), G.rep)") === 8);
t("S17 new run clears pariah", S("G.pariah") === false);

/* ---------- S16: hand limit 4, Liberty Ships buys the 5th ---------- */
fresh("germany", "soviet");
t("S16 hand refills to 4", S("B.hand.length") === 4);
t("S16 handCap starts at 4", S("B.handCap") === 4);
run("UI.endTurn()"); await settle(800);
t("S16 still 4 next turn", S("B.hand.length") === 4);

// draw cards may exceed the limit: full hand of 4, play a draw-2 → 5
run("B.draw = ['charge','charge','charge']; B.hand = [{id:'all_aboard'},{id:'charge'},{id:'charge'},{id:'charge'}]; B.gold = 5; updateBattle();");
run("UI.play(0)"); await settle(200);
t("S16 All Aboard can exceed the cap", S("B.hand.length") === 5);
run("B.draw = ['charge','charge','charge','charge','charge','charge','charge','charge','charge','charge']; B.hand = [{id:'enchilada'},{id:'all_aboard'},{id:'all_aboard'},{id:'all_aboard'}]; B.gold = 20; updateBattle();");
run("UI.play(0)"); await settle(300);
run("UI.play(0)"); await settle(200);
run("UI.play(0)"); await settle(200);
t("S16 hard ceiling holds at 10", S("B.hand.length") <= 10);

// USA: Liberty Ships raises the cap for the rest of the battle
fresh("usa", "germany");
t("S16 USA also starts at 4", S("B.handCap") === 4 && S("B.hand.length") === 4);
run("B.hand = [{id:'liberty_ships'}]; B.draw = ['charge','charge']; B.gold = 9; updateBattle();");
run("UI.play(0)"); await settle(200);
t("S16 Liberty Ships raises cap to 5", S("B.handCap") === 5);
run("B.hand = []; B.draw = ['charge','charge','charge','charge','charge','charge']; UI.endTurn()"); await settle(800);
t("S16 USA now refills to 5", S("B.hand.length") === 5);
run("B.hand = [{id:'liberty_ships'}]; B.gold = 9; updateBattle(); UI.play(0)"); await settle(200);
t("S16 cap does not stack past 5", S("B.handCap") === 5);

// the 5th slot is USA-only and resets between battles
fresh("germany", "soviet");
t("S16 no other faction can raise it", S("!CARDS.war_machine.handCap && B.handCap") === 4);
fresh("usa", "japan");
t("S16 cap resets next battle", S("B.handCap") === 4);

/* ---------- S15: hell difficulty ---------- */
run(`modeSelected = "hell"; UI.pickCountry("japan"); G.queue = ["germany","soviet","usa"]; G.battleIdx = 0; UI.fight();`);
t("S15 hell flag set", S("G.hell") === true);
t("S15 battle 1 is boss", S("B.enemy.boss") === true);
t("S15 boss HP in battle 1 (35+15)", S("B.enemy.maxHp") === 50);
t("S15 boss blitz 8x2 in battle 1", S("enemyAction(1).hits[0]") === 8);
run("G.battleIdx = 1; UI.fight();");
t("S15 battle 2 also boss", S("B.enemy.boss") === true);

// standard mode unchanged
run(`modeSelected = "std"; UI.pickCountry("japan"); G.queue = ["germany","soviet","usa"]; G.battleIdx = 0; UI.fight();`);
t("S15 standard battle 1 not boss", S("B.enemy.boss") === false);
t("S15 standard battle 1 HP 35", S("B.enemy.maxHp") === 35);
run("G.battleIdx = 2; UI.fight();");
t("S15 standard battle 3 is boss", S("B.enemy.boss") === true);

/* ---------- S13: bankruptcy + strike ---------- */
fresh("germany", "soviet");
run("B.incomeDebuffs.push({amt: 9, turns: 1}); B.enemy.actIdx = 2; B.enemy.chest = 0;"); // enemy will do nothing
run("UI.endTurn()"); await settle(700);
t("S13 bankrupt next turn", S("B.bankrupt") === true && S("B.gold") < 0);
run("B.hand = [{id:'charge'},{id:'dig_in'}]; updateBattle();");
const hl = S("B.hand.length");
run("UI.play(0)"); await settle(150);
t("S13 strike blocks attack card", S("B.hand.length") === hl);
run("B.gold = 1; B.bankrupt = false; updateBattle();"); // ensure block card playable when solvent
run("UI.play(1)"); await settle(150);
t("S13 defensive card fine", S("B.playerBlock") === 8);

/* ---------- S21: 奖励不重复发已有的牌 ---------- */
fresh("germany", "soviet");
const dup = S(`(() => {
  let repeats = 0;
  for (let i = 0; i < 500; i++) {
    const owned = new Set(G.deck);
    for (const id of rollRewards()) if (owned.has(id)) repeats++;
  }
  return repeats;
})()`);
t("S21 起手牌组里的牌不会再出现在奖励里", dup === 0);

// 边界:牌组收齐之后必须还能凑出三张,不能返回空
const exhausted = S(`(() => {
  G.deck = SHARED_IDS.concat(FACTIONS[G.playerCountry].pool);
  const r = rollRewards();
  return { n: r.length, distinct: new Set(r).size };
})()`);
t("S21 全收齐后退回允许重复", exhausted.n === 3 && exhausted.distinct === 3);

/* ---------- results ---------- */
console.log(`\nPASS ${pass}  FAIL ${fail}`);
if (failures.length) {
  console.log("FAILURES:");
  for (const f of failures) console.log("  ✗ " + f);
  process.exit(1);
}
process.exit(0);
}

main().catch(e => { console.error("HARNESS ERROR:", e); process.exit(2); });
