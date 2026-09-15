import { chromium } from "@playwright/test";
const b = await chromium.launch({ args: ["--autoplay-policy=user-gesture-required"] });
const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
await p.addInitScript(() => {
  window.__ctx = []; const O = window.AudioContext;
  window.AudioContext = class extends O { constructor(...a){ super(...a); window.__ctx.push(this); } };
  const op = HTMLMediaElement.prototype.play;
  window.__media = [];
  HTMLMediaElement.prototype.play = function(){ window.__media.push(this); return op.call(this).catch(e => { window.__playErr = String(e); throw e; }); };
});
await p.goto(process.argv[2], { waitUntil: "networkidle", timeout: 90000 });
await p.evaluate(() => document.querySelectorAll("nextjs-portal").forEach(n => n.remove()));
await p.getByRole("button", { name: "Play background music" }).first().click();
await p.waitForTimeout(4000);
console.log(JSON.stringify(await p.evaluate(() => ({
  media: window.__media.map(m => ({ paused: m.paused, t: m.currentTime, muted: m.muted, vol: m.volume, err: m.error?.code, rs: m.readyState })),
  ctx: window.__ctx.map(c => c.state), playErr: window.__playErr,
  pressed: document.querySelector('[aria-label$="background music"]')?.getAttribute("aria-label"),
}))));
await b.close();
