import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

for (const path of [
  "/",
  "/about",
  "/services",
  "/portfolio",
  "/contact",
  "/blog",
  "/experience",
  "/skills",
]) {
  test(`${path}: render, metadata, accessibility, and no browser errors`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const response = await page.goto(path);
    expect(response?.status()).toBe(200);
    // Reveal effects fade content in; measuring contrast mid-fade reports the
    // partially transparent colour. Wait for every finite animation/transition
    // (infinite ones such as marquees never finish and do not affect contrast).
    await page.waitForFunction(() =>
      document
        .getAnimations()
        .every(
          (a) =>
            a.playState !== "running" ||
            a.effect?.getTiming().iterations === Infinity,
        ),
    );
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      new RegExp(path === "/" ? "^https?://[^/]+/?$" : `${path}$`),
    );
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
      "content",
      /.+/,
    );
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      "content",
      /.{40,}/,
    );
    await expect(page.locator('meta[name="twitter:title"]')).toHaveAttribute(
      "content",
      /.+/,
    );
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(
      results.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => n.target),
      })),
    ).toEqual([]);
    expect(errors).toEqual([]);
  });
}
test("service finder leads to a prefilled contact brief", async ({ page }) => {
  await page.goto("/");
  await page
    .getByRole("group", { name: "Your project goal" })
    .getByRole("button", { name: /Automate repetitive work/ })
    .click();
  await expect(page.locator(".hm-finder-result h3")).toHaveText(
    "Make room for better work.",
  );
  await page.getByRole("link", { name: /Discuss this project/ }).click();
  await expect(page).toHaveURL(/contact\?service=automation/);
  await expect(
    page.getByRole("button", { name: "Automation", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: /Continue/ })).toBeEnabled();
});
test("filters, empty state, reset, and case study link", async ({ page }) => {
  await page.goto("/portfolio");
  const tab = page.getByRole("tab", { name: /Data Engineering/ });
  await tab.click();
  await expect(tab).toHaveAttribute("aria-selected", "true");
  await expect(page.locator(".pj-count")).toContainText(" of ");
  await expect(page.locator(".pj-cell").first()).toBeVisible();
  const search = page.getByRole("searchbox", { name: "Search projects" });
  await search.fill("no-such-project-837194");
  await expect(
    page.getByRole("heading", { name: "No matching projects" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Show all projects" }).click();
  await expect(search).toHaveValue("");
  await expect(page.getByRole("tab", { name: /^All/ })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  const first = page.locator('.pj-cell a[href^="/portfolio/"]').first();
  const href = await first.getAttribute("href");
  await first.click();
  await expect(page).toHaveURL(new RegExp(`${href}$`));
  await expect(page.locator("h1")).toHaveCount(1);
});
test("mobile navigation, fallback, WhatsApp placement, and responsive pages", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  const base = process.env.TEST_BASE_URL || "http://localhost:3000";
  await page.goto(base);
  await expect(page.locator("canvas")).toHaveCount(0);
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page
    .getByRole("navigation", { name: "More navigation" })
    .getByRole("link", { name: "Services" })
    .click();
  await expect(page).toHaveURL(/services$/);
  for (const path of ["/", "/about", "/services", "/portfolio", "/contact"]) {
    await page.goto(`${base}${path}`);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  const whatsapp = page.getByRole("link", {
    name: /Chat with Pankaj on WhatsApp/,
  });
  await expect(whatsapp).toHaveAttribute("href", "https://wa.me/8801716121009");
  const button = await whatsapp.boundingBox();
  expect(button!.x + button!.width).toBeLessThanOrEqual(390);
  expect(button!.y + button!.height).toBeLessThanOrEqual(844);
  await page.screenshot({ path: "reports/contact-mobile.png", fullPage: true });
  await context.close();
});
test("reduced motion retains all content without WebGL", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.locator("canvas")).toHaveCount(0);
  await page.getByRole("button", { name: "01 Data" }).click();
  await expect(page.locator(".scene-insight")).toContainText(
    "Give your data direction.",
  );
});
test("protected deep links, robots, sitemap, and route aliases", async ({
  page,
  request,
}) => {
  await page.goto("/admin/projects/new");
  await expect(page).toHaveURL(/\/admin\/login/);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    /noindex/,
  );
  expect((await request.get("/robots.txt")).status()).toBe(200);
  const sitemap = await (await request.get("/sitemap.xml")).text();
  expect(sitemap).toContain("/portfolio/");
  expect(sitemap).not.toContain("/admin");
  expect((await request.get("/projects", { maxRedirects: 0 })).status()).toBe(
    308,
  );
  expect((await request.get("/dashboard", { maxRedirects: 0 })).status()).toBe(
    308,
  );
});
test("contact brief validates each step and preserves values after a server error", async ({
  page,
}) => {
  await page.goto("/contact");
  const next = page.getByRole("button", { name: /Continue/ });
  await expect(next).toBeDisabled();
  await page.getByRole("button", { name: "Automation", exact: true }).click();
  await next.click();
  const goal = page.getByRole("textbox", {
    name: "Describe the goal and what’s in the way",
  });
  await goal.fill("short");
  await expect(next).toBeDisabled();
  await goal.fill("Local verification of recoverable contact errors.");
  await next.click();
  await page.getByRole("button", { name: "Still exploring" }).click();
  await next.click();
  await page.getByRole("button", { name: "Not sure yet" }).click();
  await next.click();
  await page.getByRole("textbox", { name: "Your name *" }).fill("Website test");
  await page
    .getByRole("textbox", { name: "Email *", exact: true })
    .fill("website-test@example.invalid");
  await page.route("**/api/contact", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        error: "Your message could not be saved. Please try again.",
      }),
    }),
  );
  await page.getByRole("button", { name: /Send brief/ }).click();
  await expect(page.locator("form").getByRole("alert")).toContainText(
    "could not be saved",
  );
  await expect(
    page.getByRole("textbox", { name: "Your name *" }),
  ).toHaveValue("Website test");
});
