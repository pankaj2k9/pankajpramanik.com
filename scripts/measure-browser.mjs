import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
const browser = await chromium.launch({
  channel: process.env.PLAYWRIGHT_CHANNEL || "chrome",
});
const base = process.env.TEST_BASE_URL || "http://localhost:3000";
await mkdir("reports", { recursive: true });
const results = [];
for (const mobile of [false, true]) {
  const page = await browser.newPage({
    viewport: mobile
      ? { width: 390, height: 844 }
      : { width: 1440, height: 1000 },
    isMobile: mobile,
    hasTouch: mobile,
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() => {
    window.measurements = { lcp: 0, cls: 0, interactions: [] };
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) window.measurements.lcp = e.startTime;
    }).observe({ type: "largest-contentful-paint", buffered: true });
    new PerformanceObserver((list) => {
      for (const e of list.getEntries())
        if (!e.hadRecentInput) window.measurements.cls += e.value;
    }).observe({ type: "layout-shift", buffered: true });
    new PerformanceObserver((list) => {
      for (const e of list.getEntries())
        if (e.interactionId) window.measurements.interactions.push(e.duration);
    }).observe({ type: "event", buffered: true, durationThreshold: 16 });
  });
  await page.goto(base);
  await page.waitForTimeout(1800);
  await page.screenshot({
    path: `reports/home-${mobile ? "mobile" : "desktop"}.png`,
    fullPage: true,
  });
  if (!mobile) await page.screenshot({ path: "reports/home-hero.png" });
  await page.getByRole("button", { name: "01 Data" }).click();
  await page.getByRole("button", { name: "03 Automation" }).click();
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("button", { name: "Close navigation" }).click();
  await page.waitForTimeout(100);
  const metrics = await page.evaluate(() => ({
    ...window.measurements,
    overflow: document.documentElement.scrollWidth > innerWidth,
    canvas: document.querySelectorAll("canvas").length,
    resources: performance
      .getEntriesByType("resource")
      .reduce((sum, e) => sum + e.transferSize, 0),
  }));
  results.push({ mobile, errors, ...metrics });
  await page.close();
}
await writeFile(
  "reports/browser-metrics.json",
  JSON.stringify(results, null, 2),
);
console.log(JSON.stringify(results));
await browser.close();
