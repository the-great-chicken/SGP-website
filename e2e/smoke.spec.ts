import { expect, test, type APIRequestContext, type BrowserContext, type Page } from "@playwright/test";
import {
  e2eBaseUrl,
  e2eBridgeSecret,
  e2eMockServerUrl,
  e2ePlayerUuid,
  e2eSessionToken,
} from "./fixture-values";

async function resetCosmetics(request: APIRequestContext) {
  const response = await request.post(`${e2eMockServerUrl}/__test/reset`, {
    headers: { Authorization: `Bearer ${e2eBridgeSecret}` },
  });
  expect(response.ok()).toBeTruthy();
}

const fallbackSkinPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAAmElEQVR4nO3QMREAIBDAsJeIHOTgFGRkoEP2XufsdX82OkBrgA7QGqADtAboAK0BOkBrgA7QGqADtAboAK0BOkBrgA7QGqADtAboAK0BOkBrgA7QGqADtAboAK0BOkBrgA7QGqADtAboAK0BOkBrgA7QGqADtAboAK0BOkBrgA7QGqADtAboAK0BOkBrgA7QGqADtAboAO0B9hJyOzo89pEAAAAASUVORK5CYII=",
  "base64",
);

async function stubFallbackSkin(page: Page) {
  await page.route("**/generated/kit-models/steve.png", (route) =>
    route.fulfill({
      status: 200,
      contentType: "image/png",
      body: fallbackSkinPng,
    }),
  );
}

async function authenticate(context: BrowserContext) {
  // Supplying `url` makes Playwright derive `secure` from the URL scheme. Use
  // a host-only domain/path pair so the production __Host- cookie keeps its
  // Secure attribute while Chromium treats localhost as a trustworthy host.
  await context.addCookies([
    {
      name: "__Host-sgp_session",
      value: e2eSessionToken,
      domain: new URL(e2eBaseUrl).hostname,
      path: "/",
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
    },
  ]);
}

test.describe("high-value browser smoke journeys", () => {
  test("home → kits → kit detail", async ({ page }) => {
    await stubFallbackSkin(page);
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1, name: /Soirée du/ })).toBeVisible();

    await page.getByRole("link", { name: "Tous les kits" }).click();
    await expect(page).toHaveURL(/\/kits$/);
    await expect(page.getByRole("heading", { level: 1, name: "Kits" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Voir le kit Mage" })).toBeVisible();

    await page.getByRole("link", { name: "Voir le kit Mage" }).click();
    await expect(page).toHaveURL(/\/kits\/mage$/);
    await expect(page.getByRole("heading", { level: 1, name: "Mage" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Boule de feu" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Équipement", exact: true })).toBeVisible();
  });

  test("leaderboard filtering and navigation", async ({ page }) => {
    await page.goto("/leaderboards");
    await expect(page.getByRole("heading", { level: 1, name: "Classements" })).toBeVisible();

    await page.getByLabel("Édition").selectOption("all");
    await expect(page).toHaveURL(/edition=all/);

    await page.getByRole("searchbox", { name: "Joueur" }).fill("Bravo");
    await expect(page.getByRole("status")).toHaveText("1 joueur");
    const table = page.getByRole("table");
    await expect(table.getByRole("link", { name: /Bravo/ })).toBeVisible();
    await expect(table.getByRole("link", { name: /AlphaPrime/ })).toHaveCount(0);

    await table.getByRole("link", { name: /Bravo/ }).click();
    await expect(page).toHaveURL(/\/players\/22222222-2222-4222-8222-222222222222$/);
    await expect(page.getByRole("heading", { level: 1, name: "Bravo" })).toBeVisible();
  });

  test("player search finds a historical alias and opens the profile", async ({ page }) => {
    await page.goto("/players");
    await page.getByLabel("Rechercher un joueur").fill("OldAlpha");
    await page.getByRole("button", { name: "Rechercher" }).click();

    await expect(page).toHaveURL(/\/players\?q=OldAlpha$/);
    await expect(page.getByText("1 résultat", { exact: true })).toBeVisible();
    const playerCard = page.getByRole("link", { name: /AlphaPrime/ });
    await expect(playerCard).toContainText("Aussi connu comme OldAlpha");

    await playerCard.click();
    await expect(page).toHaveURL(new RegExp(`/players/${e2ePlayerUuid}$`));
    await expect(page.getByRole("heading", { level: 1, name: "AlphaPrime" })).toBeVisible();
    await expect(page.getByText("OldAlpha", { exact: true })).toBeVisible();
  });

  test("anonymous /me redirects to login and an authenticated session reaches /me", async ({ page, context }) => {
    await page.goto("/me");
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { level: 1, name: "Connexion" })).toBeVisible();
    const discordLogin = page.getByRole("link", { name: /Continuer avec Discord/ });
    await expect(discordLogin).toBeVisible();
    await expect(discordLogin).toHaveAttribute("href", "/api/auth/discord");

    await authenticate(context);
    await page.goto("/login");
    await expect(page).toHaveURL(/\/me$/);
    await expect(page.getByRole("heading", { level: 1, name: "Mon profil" })).toBeVisible();
    await expect(page.getByText("AlphaPrime", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Identités du compte")).toContainText("Alpha Discord");
  });

  test("cosmetics can be changed and a failed mutation surfaces a recoverable error", async ({ page, context, request }) => {
    await resetCosmetics(request);
    await authenticate(context);
    await page.goto("/me#cosmetiques");

    await expect(page.getByText("Équipement vérifié dans Minecraft", { exact: true })).toBeVisible();
    const particleTrails = page.getByRole("region", { name: "Traînées de particules" });
    const equipSpark = particleTrails.getByRole("button", { name: /^Équiper Étincelle/ });
    await expect(equipSpark).toBeEnabled();
    await equipSpark.click();
    await expect(page.getByRole("status").filter({ hasText: "Équipement confirmé dans Minecraft." })).toBeVisible();
    await expect(particleTrails.getByRole("button", { name: "Étincelle équipé" })).toBeDisabled();

    const failNext = await request.post(`${e2eMockServerUrl}/__test/fail-next`, {
      headers: { Authorization: `Bearer ${e2eBridgeSecret}` },
    });
    expect(failNext.ok()).toBeTruthy();

    const equipCloud = particleTrails.getByRole("button", { name: /^Équiper Nuage/ });
    await equipCloud.click();
    await expect(page.locator("#cosmetiques").getByRole("alert")).toContainText("La modification n’a pas pu être confirmée");
    await expect(particleTrails.getByRole("button", { name: "Étincelle équipé" })).toBeDisabled();
    await expect(equipCloud).toBeEnabled();
  });
});
