"use strict";
/* ============================================================
   WAR ECONOMY — localization engine
   Mechanics live in game.js. Every player-facing string lives in
   lang/<code>.js and registers itself here.

   To add a language: copy lang/en.js, translate, add a <script>
   tag in index.html. Nothing else needs to change.

   Localize, don't translate: this game's voice is slang and dark
   jokes. A literal rendering kills it. Rewrite the joke so it
   lands in the target language.
   ============================================================ */

const LANGS = [];      // ordered [{code, name, flag, rtl}] for the picker
const REGISTRY = {};   // code -> { cards, countries, deaths, strings }

function registerLang(meta, data) {
  LANGS.push(meta);
  REGISTRY[meta.code] = data;
}
function langMeta(code) {
  return LANGS.find(l => l.code === code) || LANGS.find(l => l.code === "en");
}

let LANG = "en";

/** Saved choice → English.
 *  English is the default for everyone: the game is written in English first
 *  and the other 17 packs are transcreations of it, so a first-time player
 *  should meet the original voice and switch deliberately via the 🌐 picker. */
function detectLang() {
  try {
    const saved = localStorage.getItem("we_lang");
    if (saved && REGISTRY[saved]) return saved;
  } catch (e) { /* file:// has no storage; fall through */ }
  return "en";
}

function setLang(code) {
  if (!REGISTRY[code]) code = "en";
  LANG = code;
  try { localStorage.setItem("we_lang", code); } catch (e) { /* ignore */ }
  const meta = langMeta(code);
  document.documentElement.lang = code;
  document.documentElement.dir = meta.rtl ? "rtl" : "ltr";
}

/* ---- lookups, all falling back to English ---- */
function pack(code) { return REGISTRY[code] || REGISTRY.en; }

/** T("key") or T("key", ...args) for parameterized strings. */
function T(key, ...args) {
  let s = pack(LANG).strings[key];
  if (s === undefined) s = REGISTRY.en.strings[key];
  if (s === undefined) return key;
  return typeof s === "function" ? s(...args) : s;
}

function cardField(id, field) {
  const c = pack(LANG).cards[id] || REGISTRY.en.cards[id];
  return (c && c[field] !== undefined) ? c[field] : REGISTRY.en.cards[id][field];
}
const cardName   = id => cardField(id, "name");
const cardText   = id => cardField(id, "text");
const cardFlavor = id => cardField(id, "flavor");

function coField(id, field) {
  const c = pack(LANG).countries[id] || REGISTRY.en.countries[id];
  return (c && c[field] !== undefined) ? c[field] : REGISTRY.en.countries[id][field];
}
const coName    = id => coField(id, "name");
const coIntro   = id => coField(id, "intro");
const coGimmick = id => coField(id, "gimmick");

function deathText(cause) {
  return pack(LANG).deaths[cause] || REGISTRY.en.deaths[cause];
}

/* ---- achievements ----
   Each pack may carry `ach: { id: { name, text, hint } }`.
   Matchup hints are derived from one parameterized string. */
function achField(id, field) {
  const p = pack(LANG).ach || {};
  const a = p[id] || (REGISTRY.en.ach || {})[id] || {};
  if (a[field] !== undefined) return a[field];
  const en = (REGISTRY.en.ach || {})[id] || {};
  return en[field] !== undefined ? en[field] : id;
}
const achName = id => achField(id, "name");
const achText = id => achField(id, "text");
function achHint(id) {
  if (id.startsWith("m_")) {
    const [, p, e] = id.split("_");
    return T("ach_matchup_hint", coName(p), coName(e));
  }
  return achField(id, "hint");
}

/** Locale for sorting the deck list — pinyin for Chinese, native elsewhere. */
function sortLocale() {
  if (LANG === "zh-Hans" || LANG === "zh-Hant") return "zh-Hans-u-co-pinyin";
  return LANG;
}
