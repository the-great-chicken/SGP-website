import { expect, test } from "@playwright/test";
import { renderMapUnavailablePage } from "../src/lib/bluemap-shell";
import { e2ePlayerUuid, e2eSessionToken } from "./fixture-values";

test.use({ isMobile: true, hasTouch: true });

for (const width of [320, 390, 600, 820]) {
  test(`public layouts fit a ${width}px screen`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    for (const path of ["/", "/kits", "/kits/warrior", "/leaderboards", "/players", `/players/${e2ePlayerUuid}`, "/wiki", "/wiki/editions/4", "/wiki/personnages", "/wiki/personnages/corbeautaniste", "/wiki/changelogs/4", "/wiki/carte", "/about", "/login"]) {
      await page.goto(path);
      await expect(page.locator("h1")).toBeVisible();
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth), { message: `${path} overflows at ${width}px` }).toBeLessThanOrEqual(width);
      const clippedHeadings = await page.locator("h1, h2, h3").evaluateAll((headings) => headings.filter((heading) => heading.scrollWidth > heading.clientWidth + 1).map((heading) => heading.textContent));
      expect(clippedHeadings, `${path} clips its headings`).toEqual([]);
    }
  });
}

test("landscape navigation stays scrollable and closes after navigation", async ({ page }) => {
  await page.setViewportSize({ width: 740, height: 320 });
  await page.goto("/kits");
  const menu = page.locator("#mobile-navigation");
  await expect(menu).toHaveAttribute("inert", "");
  await page.getByRole("button", { name: "Ouvrir le menu" }).tap();
  await expect(menu).not.toHaveAttribute("inert");
  await expect.poll(async () => (await menu.boundingBox())!.height).toBeGreaterThan(200);
  expect((await menu.boundingBox())!.y + (await menu.boundingBox())!.height).toBeLessThanOrEqual(321);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Ouvrir le menu" })).toBeFocused();
  await page.getByRole("button", { name: "Ouvrir le menu" }).tap();
  await menu.getByRole("link", { name: "Mon profil" }).tap();
  await expect(page).toHaveURL(/\/login$/);
  await expect(menu).toHaveAttribute("inert", "");
});

test("inventory details open on tap, fit near the screen edge and dismiss", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto("/kits/warrior");
  const slot = page.locator(".hotbar-slots button").first();
  await slot.evaluate((element) => window.scrollTo({ top: window.scrollY + element.getBoundingClientRect().top - 90, behavior: "instant" }));
  await slot.tap();
  const tooltip = page.getByRole("tooltip");
  await expect(tooltip).toBeVisible();
  const bounds = (await tooltip.boundingBox())!;
  expect(bounds.x).toBeGreaterThanOrEqual(10);
  expect(bounds.y).toBeGreaterThanOrEqual(10);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(310);
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(630);
  await slot.tap();
  await expect(tooltip).toHaveCount(0);
  await slot.tap();
  await expect(tooltip).toBeVisible();
  await page.locator(".loadout-panel-heading h2").tap();
  await expect(tooltip).toHaveCount(0);
  await slot.tap();
  await page.keyboard.press("Escape");
  await expect(tooltip).toHaveCount(0);
  await slot.tap();
  await page.evaluate(() => window.scrollBy({ top: 50, behavior: "instant" }));
  await expect(tooltip).toHaveCount(0);
});

test("phone search, table scrolling and profile controls remain usable", async ({ page, context }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto("/kits");
  await page.getByRole("searchbox").fill("absent-kit");
  await expect(page.getByText("Aucun kit ne correspond.")).toBeVisible();
  await page.getByRole("searchbox").fill("Mage");
  await expect(page.getByRole("link", { name: "Voir le kit Mage" })).toBeVisible();
  await page.goto("/leaderboards");
  await page.getByRole("searchbox", { name: "Joueur" }).fill("Bravo");
  await expect(page.getByRole("status")).toHaveText("1 joueur");
  await page.getByRole("button", { name: "Temps de jeu" }).tap();
  await expect(page.locator("th.metric-playtime")).toHaveAttribute("aria-sort", "descending");
  expect(await page.locator(".stats-table-scroll").evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
  await page.goto(`/players/${e2ePlayerUuid}`);
  await page.locator(".kit-history-summary").first().tap();
  await expect(page.locator("details[open] .kit-history-list").first()).toBeVisible();
  await context.addCookies([{ name: "__Host-sgp_session", value: e2eSessionToken, domain: "localhost", path: "/", secure: true, httpOnly: true, sameSite: "Lax" }]);
  await page.goto("/me");
  await expect(page.getByRole("heading", { name: "Mon profil", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Actualiser" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
});

test("map navigation works before BlueMap is available, including in landscape", async ({ page }) => {
  await page.route("**/mobile-map-fixture", (route) => route.fulfill({ contentType: "text/html", body: renderMapUnavailablePage() }));
  await page.setViewportSize({ width: 740, height: 320 });
  await page.goto("/mobile-map-fixture");
  await page.getByRole("button", { name: "Ouvrir le menu" }).tap();
  const navigation = page.getByRole("navigation", { name: "Navigation mobile" });
  await expect(navigation).toBeVisible();
  await navigation.getByRole("link", { name: "Kits", exact: true }).tap();
  await expect(page).toHaveURL(/\/kits$/);
  await page.setViewportSize({ width: 320, height: 480 });
  await page.goto("/mobile-map-fixture");
  const retry = page.getByRole("link", { name: "Réessayer" });
  await retry.scrollIntoViewIfNeeded();
  await expect(retry).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
});
