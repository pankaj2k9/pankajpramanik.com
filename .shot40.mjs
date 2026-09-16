import { chromium } from "playwright";
const SP = process.argv[2]; const path = process.argv[3]; const name = process.argv[4]; const ids = process.argv[5].split(",");
const b = await chromium.launch();
for (const theme of (process.argv[6] ?? "light").split(",")) {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 } });
  await ctx.addInitScript((t) => localStorage.setItem("theme", t), theme);
  const p = await ctx.newPage();
  const errs = []; p.on("pageerror", (e) => errs.push(e.message)); p.on("console", (m) => m.type() === "error" && errs.push(m.text().slice(0, 200)));
  await p.goto("http://localhost:3000" + path, { waitUntil: "load", timeout: 120000 });
  await p.waitForTimeout(1800);
  await p.screenshot({ path: `${SP}/${name}-${theme}-top.png` });
  const total = await p.evaluate(() => document.body.scrollHeight);
  for (let y = 0; y < total; y += 350) { await p.evaluate((yy) => window.scrollTo(0, yy), y); await p.waitForTimeout(70); }
  for (const id of ids) {
    const ok = await p.evaluate((i) => { const el = document.getElementById(i) || document.querySelector(i); if (!el) return false; window.scrollTo(0, el.getBoundingClientRect().top + scrollY - 20); return true; }, id);
    if (!ok) { console.log("missing", id); continue; }
    await p.waitForTimeout(1100);
    await p.screenshot({ path: `${SP}/${name}-${theme}-${id.replace(/[^a-z0-9]/gi, "")}.png` });
  }
  console.log(name, theme, "errors:", errs.slice(0, 3), "hOverflow:", await p.evaluate(() => document.documentElement.scrollWidth > innerWidth));
  await ctx.close();
}
await b.close();
