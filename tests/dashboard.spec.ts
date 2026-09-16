import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
try {
  process.loadEnvFile();
} catch {
  /* CI uses injected configuration. */
}
const enabled = process.env.TEST_ENABLE_DB === "true";
const prisma = new PrismaClient();
const id = randomUUID().slice(0, 8);
const email = `website-test-${id}@example.invalid`;
const password = randomUUID();
const slug = `website-test-${id}`;
test.describe("authenticated local dashboard", () => {
  test.skip(
    !enabled,
    "Set TEST_ENABLE_DB=true with a local test database and mail delivery disabled.",
  );
  test.beforeAll(async () => {
    if (
      !["localhost", "127.0.0.1", "::1"].includes(
        new URL(process.env.DATABASE_URL!).hostname,
      )
    )
      throw new Error("Dashboard tests require a local database.");
    await prisma.user.create({
      data: {
        email,
        name: "Temporary browser test",
        passwordHash: await bcrypt.hash(password, 10),
        role: "ADMIN",
      },
    });
  });
  test.afterAll(async () => {
    if (!enabled) return;
    await prisma.project.deleteMany({
      where: { slug: { in: [slug, `${slug}-updated`] } },
    });
    await prisma.contactMessage.deleteMany({ where: { email } });
    await prisma.user.deleteMany({ where: { email } });
    await prisma.$disconnect();
  });
  test("sign-in, deep-link return, project create/edit, refresh, and mobile sign-out", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/admin/projects/new");
    await expect(page).toHaveURL(/\/admin\/login/);
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/admin\/projects\/new$/);
    await page
      .getByRole("textbox", { name: "Title *", exact: true })
      .fill(`Website verification ${id}`);
    await page.getByLabel("Slug", { exact: false }).fill(slug);
    await page
      .getByRole("textbox", { name: /^Cover image URL/ })
      .fill("/uploads/2026/06/1762445201199.jpg");
    await page
      .getByLabel("Problem / scope")
      .fill("Confirm dashboard persistence without changing existing content.");
    await page
      .getByLabel("Approach", { exact: true })
      .fill("Create and edit a temporary draft through the browser.");
    await page
      .getByLabel("Verified outcome", { exact: true })
      .fill("Temporary test outcome");
    await page.getByLabel("Status", { exact: true }).selectOption("DRAFT");
    await page.getByRole("button", { name: /Create project/i }).click();
    await expect(page.locator("form").getByRole("alert")).toContainText(
      "supporting evidence URL",
    );
    await expect(
      page.getByRole("textbox", { name: "Title *", exact: true }),
    ).toHaveValue(`Website verification ${id}`);
    // Do not publish fictional outcomes. Check the requirement, then remove the claim.
    await page.getByLabel("Verified outcome", { exact: true }).fill("");
    await page.getByRole("button", { name: /Create project/i }).click();
    await expect(page).toHaveURL(/\/admin\/projects$/);
    const project = await prisma.project.findUniqueOrThrow({ where: { slug } });
    expect(project.coverImage).toBe("/uploads/2026/06/1762445201199.jpg");
    expect(project.problem).toContain("Confirm dashboard persistence");
    expect((await page.request.get(`/portfolio/${slug}`)).status()).toBe(404);
    await page.goto(`/admin/projects/${project.id}/edit`);
    await page.reload();
    await expect(
      page.getByRole("textbox", { name: /^Cover image URL/ }),
    ).toHaveValue(project.coverImage!);
    await page.getByLabel("Slug", { exact: false }).fill(`${slug}-updated`);
    await page.getByRole("button", { name: /Update Project/i }).click();
    await expect(page).toHaveURL(/\/admin\/projects$/);
    expect(
      (await prisma.project.findUniqueOrThrow({ where: { id: project.id } }))
        .slug,
    ).toBe(`${slug}-updated`);
    for (const path of [
      "/admin",
      "/admin/posts",
      "/admin/projects",
      "/admin/experience",
      "/admin/certifications",
      "/admin/skills",
      "/admin/pages",
      "/admin/messages",
    ]) {
      expect((await page.goto(path))?.status()).toBe(200);
      await expect(page.locator("h1")).toHaveCount(1);
    }
    await page.goto("/admin");
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations.map((v) => v.id),
    ).toEqual([]);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/admin/projects");
    await expect(
      page.getByRole("heading", { name: "Projects", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.getByText("Workspace navigation", { exact: true }).click();
    await expect(
      page.getByRole("navigation", { name: "Dashboard navigation" }).last(),
    ).toBeVisible();
    await page.screenshot({
      path: "reports/dashboard-mobile.png",
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Sign out", exact: true })
      .last()
      .click();
    await expect(page).toHaveURL(/\/admin\/login$/);
    await page.goto(`/admin/projects/${project.id}/edit`);
    await expect(page).toHaveURL(/\/admin\/login/);
    expect(errors).toEqual([]);
  });
  test("contact API validates and stores the brief with email disabled", async ({
    request,
  }) => {
    const invalid = await request.post("/api/contact", {
      data: { name: "x", email: "invalid", message: "short" },
    });
    expect(invalid.status()).toBe(400);
    const result = await request.post("/api/contact", {
      data: {
        name: "Temporary browser test",
        email,
        subject: `Local browser verification ${id}`,
        message:
          "Verify that the contact brief is stored in the local database.",
        startedAt: Date.now() - 10000,
        website: "",
      },
    });
    expect(result.status()).toBe(200);
    expect(await result.json()).toEqual({ ok: true });
    const saved = await prisma.contactMessage.findFirstOrThrow({
      where: { email },
    });
    expect(saved.subject).toBe(`Local browser verification ${id}`);
  });
});
