// Generates public/app/js/stats-dashboard.js from the in-app dashboard source
// (public/app/stats-dashboard.src.html). The in-app Stats tab renders that markup + CSS inside a
// Shadow DOM (see public/app/js/stats.js).
//
// Run with:  node scripts/gen-stats-dashboard.mjs
//
// The in-app dashboard is intentionally a calmer "Overview" and is decoupled from the dense
// standalone viewer (public/stats-viewer/index.html) — edit stats-dashboard.src.html for the
// in-app layout. Do not hand-edit public/app/js/stats-dashboard.js.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(ROOT, "public/app/stats-dashboard.src.html");
const OUT = path.join(ROOT, "public/app/js/stats-dashboard.js");

const content = fs.readFileSync(SRC, "utf8");

// ---- 1. Extract and adapt the <style> block for Shadow DOM ----
const styleMatch = content.match(/<style>([\s\S]*?)<\/style>/);
if (!styleMatch) throw new Error("Could not find <style> block in " + SRC);
let css = styleMatch[1];

// :root and body restyle the host element (the shadow host is a contained panel, not the page).
css = css.replace(/:root\s*\{/g, ":host{");
css = css.replace(/\bbody\s*\{/g, ":host{");
css = css.replace(/min-height:\s*100vh;?/g, "");
css = css.replace(/overflow-x:\s*hidden;?/g, "");

css += `
/* ===== In-app embedding overrides ===== */
:host{ display:block; box-sizing:border-box; border-radius:18px; }
.shell{ padding:22px 18px 40px; }
.svHeader{
  display:flex;
  align-items:flex-start;
  justify-content:space-between;
  gap:14px;
  margin-bottom:2px;
}
.svTitle{
  margin:0 0 10px;
  font-size:clamp(1.5rem, 3vw, 2.1rem);
  line-height:1;
  letter-spacing:-.02em;
}
.svSub{
  margin:0 0 14px;
  color:var(--muted);
  font-size:.95rem;
  max-width:680px;
}
@media (max-width: 720px){
  .shell{ padding:16px 12px 30px; }
}
`;

// ---- 2. Extract markup: the analytics tab nav + the four tab panels ----
const navIdx = content.indexOf('<nav class="tabBar"');
if (navIdx === -1) throw new Error("Could not find tabBar nav");
const scriptIdx = content.indexOf("<script>\nwindow.__SUPABASE_URL__");
if (scriptIdx === -1) throw new Error("Could not find trailing script marker");

let markup = content.slice(navIdx, scriptIdx);
// Drop the trailing .stack and .shell closing </div>s (re-wrapped below); the hero + access/login
// panel are intentionally left out (the app provides its own header and auth).
markup = markup.replace(/\s*<\/div>\s*<\/div>\s*$/, "");

const html = `<div class="shell">
  <div class="stack">
    <section class="svHeader">
      <div>
        <h1 class="svTitle">Room &amp; Cleaning Analytics</h1>
        <p class="svSub">Volume, utilization, room time, turnover, provider workload, and session cleanup for your clinic.</p>
        <div class="status" id="statusLine">Loading…</div>
      </div>
    </section>
${markup}
  </div>
</div>`;

const out = `// AUTO-GENERATED from public/stats-viewer/index.html by scripts/gen-stats-dashboard.mjs — do not edit by hand.
// Markup + scoped CSS for the in-app Stats dashboard (rendered into a Shadow DOM by js/stats.js).
window.__STATS_DASHBOARD__ = {
  css: ${JSON.stringify(css)},
  html: ${JSON.stringify(html)}
};
`;

fs.writeFileSync(OUT, out, "utf8");
console.log("Wrote", path.relative(ROOT, OUT), "(css " + css.length + " chars, html " + html.length + " chars)");
