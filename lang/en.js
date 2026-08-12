"use strict";
/* English — reference locale. Every other lang/*.js mirrors these keys. */
registerLang({ code: "en", name: "English", flag: "🇬🇧" }, {
cards: {
  charge:        { name: "Charge!", text: "Deal 6 damage.", flavor: "First one over the top gets a medal. Probably posthumous." },
  double_tap:    { name: "Double Tap", text: "Attack twice for 5 each.", flavor: "If it's worth shooting once..." },
  big_boom:      { name: "Big Boom Energy", text: "Deal 14 damage.", flavor: "Diplomacy, but louder." },
  dig_in:        { name: "Dig In", text: "Gain 8 Block.", flavor: "Home sweet foxhole." },
  little_friend: { name: "Say Hello to My Little Friend", text: "Gain 6 Block. If it fully blocks an attack, deal 8 back.", flavor: "They knocked. We answered." },
  burn_it_all:   { name: "Burn It All", text: "Deal 18 damage. Next turn: income -2.", flavor: "Can't loot what ain't there." },
  death_above:   { name: "Death From Above", text: "Deal 8 damage. Ignores Block.", flavor: "Knock knock. It's the ceiling." },
  lets_have_it:  { name: "Let 'Em Have It", text: "All attacks this turn deal +4 damage.", flavor: "Safety's off, boys." },
  war_machine:   { name: "War Machine", text: "Income permanently +1 (this battle). Once per battle.", flavor: "Freedom isn't free. It's about $1 per turn." },
  all_aboard:    { name: "All Aboard", text: "Draw 2 cards.", flavor: "The 8:15 to Victory is now departing." },
  patch_up:      { name: "Patch 'Em Up", text: "Heal 6 HP.", flavor: "Walk it off, soldier." },
  bigger_guns:   { name: "Bigger Guns", text: "All attacks permanently +2 (this battle).", flavor: "The answer is always more dakka." },
  buy_now:       { name: "Buy Now, Cry Later", text: "Gain 3 gold now. Income -1 for the next 3 turns.", flavor: "Uncle Sam wants YOU... to check the fine print." },
  nope_zone:     { name: "Nope Zone", text: "For 3 turns, take 3 less damage from each hit.", flavor: "Trespassers will be yeeted." },
  all_hands:     { name: "All Hands on Deck", text: "This turn, all cards in hand cost 1 less (min 0).", flavor: "Coffee's free. Sleep is not." },
  enchilada:     { name: "The Whole Enchilada", text: "Draw 3 cards, heal 3 HP, income +1.", flavor: "Why choose?" },
  scorched_sky:  { name: "Scorched Sky", text: "Deal 20 damage. Reputation -1.", flavor: "History is written by the— you know what, don't write this down." },
  sucker_punch:  { name: "Sucker Punch", text: "This turn: attacks ignore Block and deal +50%. Reputation -1.", flavor: "Rules are for people who lose." },
  fake_news:     { name: "Fake News", text: "Draw 2 cards, heal 5 HP. Reputation -1.", flavor: "Technically, we're winning. Technically." },
  eye_sky:       { name: "Eye in the Sky", text: "See the enemy's next 2 moves for the rest of this battle.", flavor: "Smile for the camera." },
  talk_out:      { name: "Talk It Out", text: "The enemy's next attack is halved.", flavor: "Strongly worded letter, freshly loaded." },
  art_deal:      { name: "The Art of the Deal", text: "Reputation -1 for 4 gold, OR pay 3 gold for Reputation +1.", flavor: "Everything's for sale. Everything." },
  good_guy:      { name: "Good Guy Arc", text: "Reputation +2.", flavor: "We were the heroes all along. Pinky promise." },
  time_out:      { name: "Time Out", text: "The enemy skips its next turn. You can't play attacks this turn. Exhaust.", flavor: "Everybody just... chill." },

  /* --- Germany: Tempo --- */
  guderian:      { name: "Guderian's Gambit", text: "Deal 4 damage twice. If this is your first card this turn, both hits +2. Reputation -1.", flavor: "Achtung! Panzer! Etc.!" },
  desert_fox:    { name: "Desert Fox", text: "Deal 9 damage. Ignores Block if the enemy telegraphed an attack.", flavor: "He read your mail. All of it." },
  wolfpack:      { name: "Wolfpack", text: "Steal 3 gold from the enemy War Chest (arrives with your next income). Deal 4 damage.", flavor: "The convoy never saw it coming." },
  schwerpunkt:   { name: "Schwerpunkt", text: "Your next attack this turn deals double damage. Exhaust.", flavor: "Everything. One spot. Now." },
  autobahn:      { name: "Autobahn Logistics", text: "Draw 2. Cards drawn this way cost 1 less this turn.", flavor: "No speed limit on victory." },

  /* --- USSR: Attrition --- */
  zhukov:        { name: "Zhukov's Vise", text: "Deal 5 damage twice. Heal 2 for each hit that lands on HP (not Block). Reputation -1.", flavor: "Surrounded? No. They're just... everywhere we look." },
  katyusha:      { name: "Katyusha Barrage", text: "Deal 4 damage four times.", flavor: "Stalin's organ plays one song. It's a banger." },
  general_winter:{ name: "General Winter", text: "Enemy attacks -2 for 3 turns.", flavor: "Undefeated since 1812." },
  deep_battle:   { name: "Deep Battle", text: "Lose 3 HP. Deal 10 damage.", flavor: "Tukhachevsky did the math. The math is brutal." },
  ural:          { name: "Ural Relocation", text: "Income +1. Heal 4 HP.", flavor: "We moved the factory. The whole factory. East." },

  /* --- Japan: Piracy --- */
  tokyo_express: { name: "Tokyo Express", text: "Steal 2 gold from the enemy War Chest. It arrives with your next income. Reputation -1.", flavor: "Fastest delivery service in the Pacific. One-way." },
  zero_rush:     { name: "Zero Rush", text: "Deal 5 damage. If stolen gold arrived with your income this turn, deal 8 instead.", flavor: "Light, fast, and rude about it." },
  yamamoto:      { name: "Yamamoto's Wager", text: "Steal 5 gold (arrives with your next income). The enemy's next Funded move is disabled.", flavor: "He gave it six months. He wasn't wrong." },
  night_raid:    { name: "Night Raid", text: "Deal 7 damage. Ignores Block. Costs 0 if the enemy War Chest is empty.", flavor: "They trained for this. In the dark. On purpose." },
  shadow_economy:{ name: "Shadow Economy", text: "Whenever you steal, the haul is 1 gold bigger. Permanent this battle.", flavor: "Off the books. Way off." },

  /* --- USA: Snowball --- */
  liberty_ships: { name: "Liberty Ships", text: "Income +1. Draw 1 card. Hand limit 5 → 6 for the rest of this battle. Reputation -1.", flavor: "Built faster than they could be sunk. Barely." },
  rosie:         { name: "Rosie's Shift", text: "This turn, Building cards cost 1 less (min 0).", flavor: "We Can Do It. We ARE Doing It." },
  ike_arsenal:   { name: "Ike's Arsenal", text: "All attacks permanently +1 for every 4 income you have.", flavor: "Logistics wins wars. Ike wins logistics." },
  patton_push:   { name: "Patton's Push", text: "Deal damage equal to 1.5× your income.", flavor: "He's not waiting for orders. He's not waiting for anything." },
  arsenal_democracy: { name: "Arsenal of Democracy", text: "Income permanently +2. Reputation +1.", flavor: "Turns out the moral high ground has a factory on it." },
  /* --- China: Protracted War --- */
  taierzhuang:   { name: "Taierzhuang", text: "Deal 4 damage, +1 for every turn already elapsed this battle (max 14). Reputation -1.", flavor: "They expected a rout. They got a bill." },
  flying_tigers: { name: "Flying Tigers", text: "Deal 8 damage. Ignores Block.", flavor: "Volunteers. Technically." },
  the_hump:      { name: "The Hump", text: "Income +1. Draw 1 card.", flavor: "Fly the mountain or lose the war. They flew the mountain." },
  guerrilla:     { name: "Guerrilla Raids", text: "Enemy attacks -3 for 3 turns.", flavor: "No front line means no front line to break." },
  changsha:      { name: "Changsha Defence", text: "Gain 10 Block. If it fully blocks an attack, deal 10 back.", flavor: "Three times. They tried three times." },

  /* --- United Kingdom: Intelligence --- */
  bletchley:     { name: "Bletchley Park", text: "See the enemy's next 2 moves for the rest of this battle. Draw 1 card. Reputation -1.", flavor: "The war's best-kept secret was a filing problem." },
  chain_home:    { name: "Chain Home", text: "Take 4 less damage from every hit this turn.", flavor: "They saw them coming. That was the whole trick." },
  desert_rats:   { name: "Desert Rats", text: "Deal 9 damage; deal 13 instead if you can see the enemy's intent.", flavor: "Sand in everything. Including the enemy's plans." },
  convoy_blockade:{ name: "Convoy Blockade", text: "Steal 3 gold (arrives with your next income). The enemy War Chest stops growing for 3 turns.", flavor: "Nothing in, nothing out." },
  lancaster:     { name: "Lancaster Raid", text: "Deal 16 damage.", flavor: "Heavy, slow, and unmistakably on its way." },

  /* --- France: Resistance --- */
  free_france:   { name: "Free France", text: "Deal 6 damage; deal 12 instead if you are below half HP. Reputation -1.", flavor: "A government in a radio studio. It counted." },
  maginot:       { name: "Maginot Line", text: "Gain 12 Block.", flavor: "Superb engineering. Wrong question." },
  resistance_net:{ name: "Resistance Network", text: "Steal 2 gold (arrives with your next income). Draw 1 card.", flavor: "Everyone's a postman now." },
  leclerc:       { name: "Leclerc's Column", text: "Deal 5 damage twice; +3 per hit if you are below half HP.", flavor: "He promised them Paris. He was not exaggerating." },
  liberation:    { name: "Liberation", text: "Heal 10 HP. Reputation +1.", flavor: "The bells worked. Somebody had hidden the clappers." },
},
countries: {
  germany: { name: "Germany",
    intro: "Hits hard, hits fast, runs out of gas. Survive the opening and you've survived Germany.",
    gimmick: "Opens brutal, telegraphs a 2-hit <b>Blitzkrieg</b> (💰3 from its chest). From its 4th cycle every attack drops by 2 — it's running on fumes." },
  soviet: { name: "Soviet Union",
    intro: "The longer you fight, the angrier it gets. Do the math before you start a land war.",
    gimmick: "<b>Not One Step Back:</b> every 25% HP it loses, its attacks gain +3 permanently. Kill it fast or don't scratch it." },
  japan: { name: "Japan",
    intro: "Steals your lunch money, then sets itself on fire. Guard your wallet.",
    gimmick: "Skims gold off your economy every other turn — straight into its own chest. Below half HP it unlocks <b>Divine Wind</b> (💰4): 5 self-damage, 12 to your face." },
  usa: { name: "United States",
    intro: "Slow start, unstoppable finish. You have eight turns. Spend them wisely.",
    gimmick: "Attacks start at 4 and grow +2 every turn (💰2 per ramp — stall it by robbing the chest). <b>The Manhattan Clock</b> hits zero in 8 turns: 40 damage, no appeal." },
  china: { name: "China",
    intro: "It will not collapse and it will not hurry. Every turn you spend is a turn it banks.",
    gimmick: "<b>Protracted War:</b> every 3 turns that pass, its attacks gain +2 permanently. It also blocks for 8 (💰2). The clock is on its side, not yours." },
  uk: { name: "United Kingdom",
    intro: "It reads your mail and starves your ports. Bring your own economy.",
    gimmick: "Every other turn it <b>blockades</b>: your next income -2, and its own chest +3. From its 4th action it unlocks <b>Heavy Bombers</b> (💰4) for 14 damage." },
  france: { name: "France",
    intro: "Folds fast, fights hardest at the end. Don't leave it standing.",
    gimmick: "<b>Resistance:</b> below half HP every attack gains +5. The cheapest enemy to open against, the most expensive to leave half-dead." },
},
deaths: {
  KILLED_IN_ACTION: "Killed in Action",
  BLITZED: "Blitzed. Should've dug in.",
  OUTLASTED: "They just kept coming.",
  BANKRUPTED: "Broke AND dead. Impressive.",
  NUKED: "Tick. Tock. Boom.",
  PARIAH: "War Criminal Speedrun: Complete.",
},
ach: {
  baptism:        { name: "Baptism by Fire", text: "Everyone remembers their first.", hint: "Win your first battle." },
  mission_accomplished: { name: "Mission Accomplished", text: "Banner's already printed.", hint: "Win a full run." },
  geneva:         { name: "Geneva Approved", text: "The rare moral victory. Literally.", hint: "Win a run without playing a single dirty card." },
  war_criminal:   { name: "War Criminal Speedrun", text: "You won. The Hague has questions.", hint: "Win a run after your Reputation hits 0." },
  textbook:       { name: "The Textbook Combo", text: "27 damage. As foretold in the patch notes.", hint: "Play Let 'Em Have It + Double Tap + Sucker Punch in one turn." },
  economist:      { name: "Economist of the Year", text: "Guns AND butter. Mostly guns.", hint: "Reach 8 income per turn." },
  pickpocket:     { name: "Pickpocket General", text: "Their war, your budget.", hint: "Steal 15 gold from one enemy's War Chest in a single battle." },
  no_scratch:     { name: "Not a Scratch", text: "They shot. You dodged. Repeatedly.", hint: "Win a battle without losing any HP." },
  photo_finish:   { name: "Photo Finish", text: "Victory, held together with tape.", hint: "Win a run with 5 HP or less." },
  polyglot:       { name: "Polyglot at War", text: "Losing is universal. So is winning.", hint: "Win battles in 3 different languages." },

  m_germany_soviet: { name: "This Time, Pack Coats", text: "History said no. You said 'watch me.'" },
  m_germany_usa:    { name: "Amerika Bomber, Delivered", text: "The blueprint that never flew. Until now." },
  m_germany_japan:  { name: "Pact, Schmact", text: "Allies? In THIS economy?" },
  m_soviet_germany: { name: "Road to Berlin", text: "Long walk. Worth it." },
  m_soviet_usa:     { name: "Red Dawn, For Real", text: "The movie was fiction. This is canon." },
  m_soviet_japan:   { name: "August Storm", text: "Eleven days. Look it up." },
  m_japan_usa:      { name: "Tora! Tora! Tora!", text: "Surprise works. Twice, even." },
  m_japan_soviet:   { name: "Khalkhin Gol Rematch", text: "1939 was just the warm-up, apparently." },
  m_japan_germany:  { name: "Alliance Dissolved", text: "It was never really about friendship." },
  m_usa_germany:    { name: "D-Day, Every Day", text: "The beach was just the beginning." },
  m_usa_japan:      { name: "Island Hopping Champion", text: "Skipped the boring islands. Efficient." },
  m_usa_soviet:     { name: "Cold War Speedrun", text: "Skipped 45 years of tension. Any%." },

  spotless: { name: "Spotless", text: "Not one line item they could subpoena.", hint: "Win a run without ever dropping below 7 Reputation." },

  rockbottom: { name: "Rock Bottom", text: "Everyone hates you. You won anyway.", hint: "Win a run while Total Pariah is active." },

  slippery: { name: "Slippery Slope", text: "It started with one small favour.", hint: "Fall from 8 to 0 Reputation inside a single battle." },
  endless5:   { name: "Long War", text: "Five and still standing.", hint: "Survive 5 waves in Endless mode." },
  endless10:  { name: "No Armistice", text: "Somebody should have signed something by now.", hint: "Survive 10 waves in Endless mode." },
  world_tour: { name: "Everyone's Problem", text: "You have now personally annoyed the entire planet.", hint: "Defeat all six other nations in a single Endless run." },

  maginot:        { name: "Maginot Mindset", text: "The defense was perfect. The war moved.", hint: "Die to Blitzkrieg while holding 2+ Block cards." },
  winter_regards: { name: "General Winter Sends Regards", text: "You are not the first. You will not be the last.", hint: "Die to the USSR at its highest attack tier." },
  broke_dead:     { name: "Broke AND Dead", text: "Bankruptcy: the other unconditional surrender.", hint: "Die to Japan while bankrupt." },
  read_clock:     { name: "Should've Read the Clock", text: "Eight turns. You had eight turns.", hint: "Die to the Manhattan Clock." },
  own_goal:       { name: "Own Goal", text: "Technically, you did this.", hint: "Die on a turn you damaged yourself." },
  hague:          { name: "The Hague Ending", text: "Actions, meet consequences.", hint: "Die within 3 turns of International Intervention." },
},
strings: {
  logo_sub: "",
  tagline: "A ten-minute war. Winning is easy. Affording it isn't.",
  howto1: "⚔️ Beat three rival powers back to back. No healing in between.",
  howto2: "💰 Every coin spent on guns is a coin not spent on anything else. Unspent gold vanishes. Troops bill you 1/turn.",
  howto3: "🌍 Dirty cards hit harder. The world keeps receipts.",
  start: "Let's Go to War",
  pick_language: "Language",
  language: "Language",

  help: "How to Play",

  help_rules_title: "The Basics",

  help_factions_title: "The Seven Powers",

  help_r1: "Each turn you collect income, pay 1 gold upkeep, then spend what's left. Unspent gold vanishes — use it or lose it.",

  help_r2: "Cards come in three flavors: Military (damage), Buildings (economy, healing, draw) and Politics (tricks, reputation).",

  help_r3: "Block absorbs damage but disappears at the end of the turn. Play it on the turns the enemy actually swings.",

  help_r4: "The enemy always shows its next move above its head. Read it, then answer it.",

  help_r5: "Moves marked 💰 are paid for out of the enemy's War Chest. Steal that gold and their big attacks fizzle.",

  help_r6: "Dirty cards hit harder but cost Reputation. Drop to 2 and the world intervenes — permanently.",

  diff_normal: "Standard",

  diff_normal_sub: "Boss only in the last fight",

  diff_hell: "Hell",

  diff_hell_sub: "Every fight is a boss",

  hell_badge: n => `🔥 HELL — BATTLE ${n}/3`,

  hell_tag: "HELL",

  pro_germany: "Fastest openings; hits twice before anyone reacts.",

  con_germany: "Runs out of steam if the fight drags on.",

  pro_soviet: "Heals off its own attacks and shrugs off big hits.",

  con_soviet: "Weakest economy — slow to get going.",

  pro_japan: "Robs the enemy's gold and shuts down their big moves.",

  con_japan: "Low damage until the stolen money arrives.",

  pro_usa: "Strongest late game; income snowballs into huge attacks.",

  con_usa: "Expensive cards, slowest start of all four.",

  arch_china: "PROTRACTED — time is your ammunition",
  arch_uk: "INTELLIGENCE — know it before it happens",
  arch_france: "RESISTANCE — strongest when losing",
  pro_china: "Hits harder the longer the fight runs.",
  con_china: "Slow damage early; needs the fight to last.",
  pro_uk: "Sees the enemy's plan and starves its treasury.",
  con_uk: "Thin HP; punished hard by a fast opener.",
  pro_france: "Doubles down once you drop below half HP.",
  con_france: "Weak while healthy — the kit only pays when you're losing.",
  diff_endless: "Endless",
  diff_endless_sub: n => n ? `Best streak: ${n}` : "Fight until you fall",
  endless_badge: n => `♾️ ENDLESS — WAVE ${n}`,
  endless_tag: "WAVE BOSS",
  wave_no: n => `♾️ Wave ${n}`,
  best_streak: n => `Best Endless streak: ${n}`,
  endless_result: (n, best) => `Survived ${n} wave${n === 1 ? "" : "s"}. Best: ${best}.`,
  warn_bomber: "✈️ Heavy bombers inbound.",
  log_guerrilla: "No front line to break: enemy attacks -3 for 3 turns.",
  log_chain_home: "Radar chain lit: -4 damage from every hit this turn.",
  log_blockade: "Ports closed. Their chest stops growing for 3 turns.",
  chip_chain_home: "📡 -4 dmg per hit (turn)",
  chip_chest_frozen: n => `⚓ chest frozen (${n}t)`,
  chip_protracted: n => `⏳ Protracted: +${n} atk`,
  chip_cornered: "🔥 Cornered: +5 atk",
  pick_side: "Pick Your Side",
  pick_side_sub: "Your nation sets your signature card and your reward pool. Pick a doctrine, not a flag.",
  arch_germany: "TEMPO — strike first, strike twice",
  arch_soviet: "ATTRITION — HP is a resource",
  arch_japan: "PIRACY — their budget is your budget",
  arch_usa: "SNOWBALL — build now, erase later",

  opener: n => `The ${n} war machine rolls out. First up:`,
  battle_badge: n => `BATTLE ${n}/3`,
  boss_badge: "☠ FINAL BOSS — BATTLE 3/3",
  intel: "INTEL:",
  intel_chest: "💰 <b>War Chest:</b> moves tagged 💰 run on enemy gold. Steal it and watch them fizzle.",
  boss_buff: "☠ <b>BOSS BUFF:</b> +15 HP, signature move +30%. Good luck.",
  ministats: (hp, max, rep, title, deck) =>
    `You: ❤️ ${hp}/${max} &nbsp;•&nbsp; 🌍 Rep ${rep}/8 (${title}) &nbsp;•&nbsp; 🃏 ${deck} cards`,
  fight: "Fight",
  finish_it: "Finish It",

  next_label: "Next",

  intent_unknown: "? ? ?",

  log_once_turn: "One of those per turn. The staff needs to sleep.",
  send_it: "Send It 🫡",
  view_deck: "View deck",
  sound: "Sound",
  final_boss_tag: "FINAL BOSS",
  rep_short: "REP",
  war_chest: "War Chest",
  piles: (d, x, g) => `Draw ${d} · Discard ${x}${g ? ` · Gone ${g}` : ""}`,
  payday: n => `next payday: ${n >= 0 ? "+" : ""}${n} (income − 1 upkeep)`,
  skipping: "😴 Skipping",
  boom: "☢ BOOM",
  blocked_pop: "Blocked",
  rep_pop: n => `${n > 0 ? "+" : ""}${n} REP`,

  chip_soviet: n => `😡 Not One Step Back: +${n} atk`,
  chip_divine: "🔥 Divine Wind unlocked",
  chip_fumes: "⛽ Running on fumes (attacks -2)",
  chip_intervention: "🌍 Intervention: attacks +3",
  chip_funded_off: "🚫 next 💰 move disabled",
  chip_winter: t => `❄️ attacks -2 (${t}t)`,

  chip_strike: "💸 TROOPS ON STRIKE — no attacks",
  chip_timeout: "✋ Timeout — no attacks",
  chip_permatk: n => `⚔️ +${n} attacks (battle)`,
  chip_turnatk: n => `🔫 +${n} attacks (turn)`,
  chip_schwerpunkt: "🎯 next attack ×2",
  chip_sucker: "🥊 pierce & +50% (turn)",
  chip_income: n => `🏭 +${n} income`,
  chip_shadow: n => `🕶 +${n} gold per steal`,
  chip_nope: (n, t) => `🚧 -${n} dmg/hit (${t}t)`,
  chip_talk: "✉️ next enemy attack halved",
  chip_thorns: n => `🌵 full block → ${n} back`,
  chip_allhands: "☕ cards -1 cost (turn)",
  chip_rosie: "🔧 Buildings -1 cost (turn)",
  chip_loot: n => `🏴‍☠️ +${n} gold next payday`,
  chip_loot_in: "🏴‍☠️ loot arrived this turn",
  chip_recon: "👁 recon: 2 moves visible",
  chip_debuff: (a, t) => `📉 -${a} income (${t}t)`,
  chip_steal: n => `🕵️ ${n} gold stolen next turn`,

  warn_blitz: "⚡ Blitzkrieg incoming!",
  warn_blitz_early: "⚡ Blitzkrieg telegraphed for next turn. Block up — or bankrupt them.",
  warn_divine: "🔥 Divine Wind — they're not planning to land.",
  warn_nuke: "☢ Tick. Tock. Physics doesn't negotiate.",

  log_safety: "Safety's off. Attacks +4 this turn.",
  log_income: "Income +1 per turn.",
  log_handcap: "The yards are open: you now hold 6 cards a turn.",
  chip_handcap: n => `🃏 hand limit ${n}`,
  log_once_spent: "The factory's already running. One War Machine per battle.",
  chip_wm_spent: "🏭 War Machine spent",
  log_bigger: "Attacks permanently +2 this battle.",
  log_nope: "Nope Zone up: -3 damage per hit for 3 turns.",
  log_allhands: "Overtime approved: everything costs 1 less this turn.",
  log_sucker: "Gloves off: attacks pierce and hit +50% this turn.",
  log_recon: "Recon online: two moves visible.",
  log_talk: "Letter sent. Their next attack is halved.",
  log_timeout: "Timeout called. Nobody swings until tomorrow.",
  log_soviet: n => `They just keep coming. (attacks +${n})`,
  log_divine: "They're not planning to land.",
  log_thorns: n => `They knocked. We answered: ${n} back.`,
  log_world: "The world is watching. The world is not impressed.",
  log_pariah: "Nobody's neutral anymore. They're all coming for you.",
  banner_pariah: "Total Pariah",
  banner_pariah_sub: "Every nation left in this war turns on you.<br>All enemy attacks +2. Permanently.",
  chip_pariah: "☠ Pariah: attacks +2",
  ach_how: "How:",
  log_bankrupt: "Payroll bounced. Troops on strike — no attack cards this turn.",
  log_nogold: "Not enough gold. Guns aren't free.",
  log_strike: "Troops on strike. Nobody attacks while payroll's negative.",
  log_notimeout: "You called the timeout. No attacks today.",
  log_chill: "The enemy just... chills. Everyone breathes.",
  log_letter: "The strongly worded letter lands. Attack halved.",
  log_steal: n => `They skim ${n} gold off next turn's budget — straight into their chest.`,
  log_tick: "Tick. Tock. Physics doesn't negotiate.",
  log_fumes: "Running on fumes.",
  log_sold: "Sold. Don't ask what.",
  log_respect: "Respect: purchased. Invoice: pending.",

  log_stole: n => `Heist: +${n} gold arrives with your next income.`,
  log_steal_dry: "Their war chest is empty. Nothing to steal.",
  log_shadow: "Shadow economy online: +1 gold per heist.",
  log_yamamoto: "Their funding is frozen. The next 💰 move is canceled.",
  log_schwerpunkt: "Everything. One spot. Next attack doubled.",
  log_winter: "General Winter deploys: enemy attacks -2 for 3 turns.",
  log_rosie: "Shift's on: Buildings cost 1 less this turn.",
  log_ike: n => n > 0 ? `Logistics online: attacks +${n} permanently.` : "Not enough income yet. (+1 per 3 income)",
  log_supply_cut: "Supply lines cut. No block this turn.",
  log_blitz_broke: "Blitzkrieg defunded. A single column limps forward.",
  log_divine_broke: "No fuel for the Divine Wind. A regular sortie instead.",
  log_ramp_broke: "Production stalls. No escalation this turn.",

  banner_intervention: "Intervention",
  banner_intervention_sub: "The international community steps in.<br>Enemy +15 HP. All enemy attacks +3. Permanently.",
  banner_win: "GG EZ",
  banner_win_sub: n => `${n} folds.`,

  dilemma_badge: "BETWEEN THE WARS",

  dil_accept: "Take the deal",

  dil_decline: "Walk away",

  dil_salvage_name: "Salvage Rights",

  dil_salvage_flavor: "The wrecks are still warm.",

  dil_salvage_desc: "<b>Reputation -2</b> → heal <b>14 HP</b>. Strip the hulls in the harbour before anyone files a claim.",

  dil_requisition_name: "Requisition the Yards",

  dil_requisition_flavor: "They were neutral this morning.",

  dil_requisition_desc: "<b>Reputation -2</b> → <b>pick an extra card</b>. A neutral's shipyards work just as well under new management.",

  dil_accords_name: "Sign the Accords",

  dil_accords_flavor: "Ink is cheaper than steel. Usually.",

  dil_accords_desc: "<b>Lose 8 HP</b> → <b>Reputation +3</b>. Demobilise a corps for the cameras and let the observers in.",

  dil_amnesty_name: "Amnesty Program",

  dil_amnesty_flavor: "Everyone goes home. Almost everyone.",

  dil_amnesty_desc: "<b>Skip this battle's card</b> → <b>Reputation +3</b>. Repatriate the prisoners instead of putting them to work.",

  chip_aid: "🤝 Allied aid: +1 gold",

  chip_aid_max: "🏥 Allied hospitals: +2 HP",

  pick_poison: "Pick Your Poison",
  pick_poison_sub: "One card joins your deck. Your nation's specialties show up more often.",
  reward_stats: (hp, max) => `❤️ ${hp}/${max} — no healing between battles. Choose like it matters.`,

  war_over: "THE WAR IS OVER",
  victory_title: "Mission<br>Accomplished",
  victory_tag: "All three powers folded. Somebody hang a banner on an aircraft carrier.",
  k_hp: "HP remaining",
  k_rep: "Reputation",
  k_turns: "Turns taken",
  k_turns_survived: "Turns survived",
  k_deck: "Deck size",
  v_deck: n => `🃏 ${n} cards`,
  verdict: (t, s) => `History will judge you. Current verdict: <b>${t}</b>${s ? " (the sanctions stay, by the way)" : ""}.`,
  run_it_back: "Run It Back",

  death_title: "Well, That Happened",
  defeated_by: (n, i) => `Defeated by ${n} in battle ${i} of 3.`,

  deck_title: n => `Your Deck (${n})`,
  close: "Close",
  deal_title: "The Art of the Deal",
  deal_flavor: "“Everything's for sale. Everything.”",
  deal_sell: "😈 Sell your soul — Rep -1, gain 4 gold",
  deal_buy: "😇 Buy respect — pay 3 gold, Rep +1",
  never_mind: "Never mind",

  rep_good: "Good Guy Arc",
  rep_mid: "Morally Flexible",
  rep_bad: "War Criminal Speedrun",

  achievements: "Achievements",
  new_ach: "🏆 NEW ACHIEVEMENTS",
  ach_locked_name: "???",
  ach_matchup_hint: (p, e) => `As ${p}, defeat ${e}.`,
  ach_sec_general: "Service Record",
  ach_sec_matchup: "Matchups",
  ach_sec_death: "Ways to Die",
  badge_war_over: "WAR IS OVER",
  badge_war_over_sub: "If you want it. Or if you 100% it.",
},
});
