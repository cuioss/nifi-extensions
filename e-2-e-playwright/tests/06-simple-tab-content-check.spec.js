/* eslint-disable no-console */
import { test } from "@playwright/test";

const BASE_URL = "http://localhost:9095/nifi-cuioss-ui/";

test("check all tab content", async ({ page }) => {
    console.log("Navigating to base URL");
    await page.goto(BASE_URL, { waitUntil: "networkidle" });

    console.log("Waiting for tabs to be visible");
    await page.waitForSelector(".tab", { state: "visible", timeout: 10000 });
    await page.waitForTimeout(2000);

    // Check each tab
    const tabs = [
        {
            selector: '[data-tab="#issuer-config"]',
            pane: "#issuer-config",
            name: "Configuration",
        },
        {
            selector: '[data-tab="#token-verification"]',
            pane: "#token-verification",
            name: "Token Verification",
        },
        {
            selector: '[data-tab="#metrics"]',
            pane: "#metrics",
            name: "Metrics",
        },
        { selector: '[data-tab="#help"]', pane: "#help", name: "Help" },
    ];

    for (const tab of tabs) {
        console.log(`\n=== Checking ${tab.name} tab ===`);

        // Click the tab
        await page.click(tab.selector);
        await page.waitForTimeout(1000);

        // Get content
        const content = await page.locator(tab.pane).textContent();
        const html = await page.locator(tab.pane).innerHTML();

        console.log(`${tab.name} content length: ${content.length} chars`);
        console.log(`${tab.name} HTML length: ${html.length} chars`);

        if (content.length < 50) {
            console.log(`${tab.name} appears empty! Content: "${content}"`);
            console.log(`${tab.name} HTML preview: ${html.substring(0, 200)}`);
        } else {
            console.log(
                `${tab.name} has content: ${content.substring(0, 100)}...`,
            );
        }

        // Take screenshot
        await page.screenshot({
            path: `target/test-results/simple-tab-${tab.name.toLowerCase().replace(" ", "-")}.png`,
            fullPage: true,
        });
    }
});
