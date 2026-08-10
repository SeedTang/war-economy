/* Bundle WAR ECONOMY into a single self-contained HTML file.
   No build tooling, no minifier — just inlines the CSS and every script
   in the exact order index.html loads them, so the bundle behaves
   identically to the multi-file version.

     node build.mjs

   Outputs:
     dist/index.html    complete standalone page (drag this to Netlify)
     dist/artifact.html same content without the <html>/<head>/<body>
                        skeleton, for hosts that supply their own
*/
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = dirname(fileURLToPath(import.meta.url));
const read = f => readFileSync(join(ROOT, f), "utf8");

/* Script order is load-bearing: the i18n engine must exist before the
   language packs register into it, English must come first (it is the
   fallback), and sprites must be defined before game.js draws with them. */
const SCRIPTS = [
  "i18n.js",
  "lang/en.js",
  "lang/zh-Hans.js", "lang/zh-Hant.js", "lang/ja.js", "lang/ko.js",
  "lang/es.js", "lang/pt-BR.js", "lang/fr.js", "lang/de.js", "lang/it.js",
  "lang/ru.js", "lang/pl.js", "lang/tr.js", "lang/vi.js", "lang/id.js",
  "lang/th.js", "lang/hi.js", "lang/ar.js",
  "sprites.js",
  "game.js",
];

/* Guard: a literal </script> inside any source would close the tag early. */
function safe(js, name) {
  if (/<\/script/i.test(js)) throw new Error(`${name} contains a literal </script>`);
  return js;
}

const css = read("style.css");
const js = SCRIPTS.map(f => `/* ==== ${f} ==== */\n${safe(read(f), f)}`).join("\n");

const body = `<title>WAR ECONOMY — a roguelike deckbuilder about the price of winning a war</title>
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<style>
${css}
</style>

<div id="app"></div>
<div id="fx-layer"></div>
<div id="modal-root"></div>

<script>
${js}
</script>`;

const standalone = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>WAR ECONOMY</title>
<meta name="description" content="A roguelike deckbuilder about the price of winning a war.">
<link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>💣</text></svg>">
<style>
${css}
</style>
</head>
<body>
<div id="app"></div>
<div id="fx-layer"></div>
<div id="modal-root"></div>
<script>
${js}
</script>
</body>
</html>
`;

mkdirSync(join(ROOT, "dist"), { recursive: true });
writeFileSync(join(ROOT, "dist/index.html"), standalone);
writeFileSync(join(ROOT, "dist/artifact.html"), body);

const kb = n => (n / 1024).toFixed(0) + " KB";
console.log(`dist/index.html     ${kb(standalone.length)}`);
console.log(`dist/artifact.html  ${kb(body.length)}`);
console.log(`bundled ${SCRIPTS.length} scripts + style.css`);
