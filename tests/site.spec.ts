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
test("service nodes and finder lead to a prefilled contact form", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "03 Automation" }).click();
  await expect(page.locator(".scene-insight")).toContainText(
    "Make room for better work.",
  );
  await page.getByRole("button", { name: /Automate repetitive work/ }).click();
  await page.getByRole("link", { name: /Discuss this project/ }).click();
  await expect(page).toHaveURL(/contact\?service=automation/);
  await expect(page.getByLabel("Subject")).toHaveValue(
    "Automation project inquiry",
  );
});
test("filters, empty state, reset, and expandable case study", async ({
  page,
}) => {
  await page.goto("/portfolio");
  await page.getByLabel("Service area").selectOption("Data Engineering");
  await page.getByLabel("Technology", { exact: true }).selectOption("Python");
  const first = page.locator("article").first();
  await expect(first).toBeVisible();
  await first.getByText("Explore case study", { exact: true }).click();
  await expect(
    first.getByText("Verified outcomes", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Search projects").fill("no-such-project-837194");
  await expect(
    page.getByRole("heading", { name: "No matching projects" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Show all projects" }).click();
  await expect(page.locator("article").first()).toBeVisible();
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
test("contact validates input and preserves values after a server error", async ({
  page,
}) => {
  await page.goto("/contact");
  await page.getByRole("button", { name: "Send Message" }).click();
  await expect(page.getByLabel("Name", { exact: false })).toBeFocused();
  await page.getByLabel("Name", { exact: false }).fill("Website test");
  await page
    .getByRole("textbox", { name: "Email *", exact: true })
    .fill("website-test@example.invalid");
  await page
    .getByLabel("Message", { exact: false })
    .fill("Local verification of recoverable contact errors.");
  await page.route("**/api/contact", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        error: "Your message could not be saved. Please try again.",
      }),
    }),
  );
  await page.getByRole("button", { name: "Send Message" }).click();
  await expect(page.locator("form").getByRole("alert")).toContainText(
    "could not be saved",
  );
  await expect(page.getByLabel("Name", { exact: false })).toHaveValue(
    "Website test",
  );
});
