/**
 * @file Debug JWT Custom UI
 * Debug test to understand why tab content is not visible
 * @version 1.0.0
 */

import { test } from "@playwright/test";
import { AuthService } from "../utils/auth-service.js";
import { processorLogger } from "../utils/shared-logger.js";
import { saveTestBrowserLogs } from "../utils/console-logger.js";

test.describe("Debug JWT Custom UI", () => {
    test.beforeEach(async ({ page }, testInfo) => {
        // Enable console logging
        page.on("console", (msg) => {
            processorLogger.info(
                `Browser console [${msg.type()}]: ${msg.text()}`,
            );
        });

        page.on("pageerror", (error) => {
            processorLogger.error(`Browser error: ${error.message}`);
        });

        // Login first
        const authService = new AuthService(page);
        await authService.ensureReady();
    });

    test.afterEach(async ({ page: _ }, testInfo) => {
        await saveTestBrowserLogs(testInfo);
    });

    test("debug tab content visibility", async ({ page }, testInfo) => {
        processorLogger.info("Debugging JWT Custom UI tab content");

        // Navigate directly to the custom UI
        await page.goto("https://localhost:9095/nifi-cuioss-ui-1.0-SNAPSHOT/", {
            waitUntil: "networkidle",
            timeout: 15000,
        });

        // Wait for initialization
        await page.waitForTimeout(3000);

        // Check what's on the page
        const pageContent = await page.evaluate(() => {
            const info = {
                title: document.title,
                jwtContainerVisible: !!document.querySelector(
                    "#jwt-validator-container",
                ),
                tabsVisible: !!document.querySelector("#jwt-validator-tabs"),
                tabPanes: [],
                windowVars: {
                    jwtUISetupComplete: window.jwtUISetupComplete,
                    jwtComponentsRegistered: window.jwtComponentsRegistered,
                    nifiCuiossUI: !!window.nifiCuiossUI,
                },
            };

            // Check each tab pane
            const panes = document.querySelectorAll(".tab-pane");
            panes.forEach((pane) => {
                info.tabPanes.push({
                    id: pane.id,
                    hasContent: pane.innerHTML.trim().length > 0,
                    isActive: pane.classList.contains("active"),
                    contentLength: pane.innerHTML.length,
                    firstChars: pane.innerHTML.substring(0, 100),
                });
            });

            return info;
        });

        processorLogger.info(
            "Page info:",
            JSON.stringify(pageContent, null, 2),
        );

        // Try to manually initialize the help tab
        await page.evaluate(() => {
            if (window.nifiCuiossUI && window.nifiCuiossUI.helpTab) {
                console.log("Manually calling helpTab.init()");
                window.nifiCuiossUI.helpTab.init();
            }
        });

        await page.waitForTimeout(1000);

        // Check help tab content after manual init
        const helpTabContent = await page.evaluate(() => {
            const helpPane = document.querySelector("#help");
            return {
                exists: !!helpPane,
                hasContent: helpPane ? helpPane.innerHTML.length > 0 : false,
                contentLength: helpPane ? helpPane.innerHTML.length : 0,
                content: helpPane
                    ? helpPane.innerHTML.substring(0, 200)
                    : "Not found",
            };
        });

        processorLogger.info(
            "Help tab after manual init:",
            JSON.stringify(helpTabContent, null, 2),
        );

        // Try to trigger tab initialization through main module
        await page.evaluate(() => {
            console.log(
                "Trying to initialize tabs through initializeTabContent...",
            );
            // Check if initializeTabContent is available
            const scripts = document.querySelectorAll("script");
            scripts.forEach((script) => {
                if (script.src && script.src.includes("bundle.vite")) {
                    console.log("Found vite bundle script:", script.src);
                }
            });
        });

        // Check what happens when we click on the help tab
        await page.click('[href="#help"]');
        await page.waitForTimeout(1000);

        // Check help tab content after clicking
        const helpTabAfterClick = await page.evaluate(() => {
            const helpPane = document.querySelector("#help");
            const helpContent = document.querySelector("#jwt-help-content");
            return {
                paneExists: !!helpPane,
                paneHasContent: helpPane
                    ? helpPane.innerHTML.length > 0
                    : false,
                paneContent: helpPane
                    ? helpPane.innerHTML.substring(0, 500)
                    : "Not found",
                helpContentExists: !!helpContent,
                helpContentParent: helpContent
                    ? helpContent.parentElement.id
                    : "No parent",
            };
        });

        processorLogger.info(
            "Help tab after clicking:",
            JSON.stringify(helpTabAfterClick, null, 2),
        );

        // Take screenshot
        await page.screenshot({
            path: `target/test-results/jwt-debug-${Date.now()}.png`,
            fullPage: true,
        });

        // Check if the bundle exposes the tabs
        const bundleInfo = await page.evaluate(() => {
            const info = {
                nifiCuiossUI: !!window.nifiCuiossUI,
                availableMethods: [],
            };

            if (window.nifiCuiossUI) {
                for (const key in window.nifiCuiossUI) {
                    info.availableMethods.push(key);
                }
            }

            return info;
        });

        processorLogger.info(
            "Bundle info:",
            JSON.stringify(bundleInfo, null, 2),
        );
    });
});
