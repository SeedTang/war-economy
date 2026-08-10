/* Completeness audit: every language pack must mirror en's key structure. */
import { readFileSync, readdirSync } from "node:fs";
import vm from "node:vm";

const ROOT = "/Users/zgy/war-economy";
const sandbox = { console };
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(`
  const LANGS = []; const REGISTRY = {};
  function registerLang(meta, data) { LANGS.push(meta); REGISTRY[meta.code] = data; }
  globalThis.LANGS = LANGS; globalThis.REGISTRY = REGISTRY; globalThis.registerLang = registerLang;
`, sandbox);

const files = ["en.js", ...readdirSync(`${ROOT}/lang`).filter(f => f.endsWith(".js") && f !== "en.js")];
for (const f of files) vm.runInContext(readFileSync(`${ROOT}/lang/${f}`, "utf8"), sandbox, { filename: f });

const { REGISTRY, LANGS } = sandbox;
const en = REGISTRY.en;
let problems = 0;

for (const { code } of LANGS) {
  const p = REGISTRY[code];
  const missing = [];
  for (const section of ["cards", "countries", "deaths", "ach", "strings"]) {
    const ref = en[section], got = p[section] || {};
    for (const k of Object.keys(ref)) {
      if (got[k] === undefined) missing.push(`${section}.${k}`);
      else {
        // sub-fields for cards/ach/countries
        if (typeof ref[k] === "object" && typeof ref[k] !== "function") {
          for (const sub of Object.keys(ref[k])) {
            if (got[k][sub] === undefined) missing.push(`${section}.${k}.${sub}`);
          }
        }
        // function arity match for parameterized strings
        if (typeof ref[k] === "function" && typeof got[k] !== "function")
          missing.push(`${section}.${k} (should be function)`);
      }
    }
    // extra keys that en doesn't have (typo detector)
    for (const k of Object.keys(got)) {
      if (ref[k] === undefined) missing.push(`${section}.${k} (EXTRA)`);
    }
  }
  if (missing.length) {
    problems++;
    console.log(`${code}: ${missing.length} issues`);
    for (const m of missing.slice(0, 20)) console.log(`   - ${m}`);
  } else {
    console.log(`${code}: complete ✓`);
  }
}
console.log(problems ? `\n${problems} language(s) with issues` : `\nAll ${LANGS.length} languages complete.`);
process.exit(problems ? 1 : 0);
