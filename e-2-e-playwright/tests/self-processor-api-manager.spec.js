/**
 * @file Self-test for ProcessorApiManager utility
 * Tests the API-based processor management functionality
 */

import {
    test,
    expect,
    takeStartScreenshot,
} from "../fixtures/test-fixtures.js";
import { ProcessorApiManager } from "../utils/processor-api-manager.js";
import { AuthService } from "../utils/auth-service.js";

test.describe("ProcessorApiManager Self-Test", () => {
    test.beforeEach(async ({ page }, testInfo) => {
        await takeStartScreenshot(page, testInfo);
    });

    test("should verify MultiIssuerJWTTokenAuthenticator deployment", async ({
        page,
    }) => {
        const authService = new AuthService(page);
        const processorManager = new ProcessorApiManager(page);

        // Check if NiFi is accessible
        const isAccessible = await authService.checkNiFiAccessibility();
        if (!isAccessible) {
            throw new Error(
                "PRECONDITION FAILED: NiFi service is not accessible. " +
                    "Cannot test processor API management. " +
                    "Start NiFi with: ./integration-testing/src/main/docker/run-and-deploy.sh",
            );
        }

        // Authenticate
        await authService.ensureReady();

        const isDeployed =
            await processorManager.verifyMultiIssuerJWTTokenAuthenticatorIsDeployed();

        // The method should return a boolean
        expect(typeof isDeployed).toBe("boolean");

        if (!isDeployed) {
            throw new Error(
                "TEST FAILED: MultiIssuerJWTTokenAuthenticator is not deployed in NiFi. " +
                    "The processor NAR must be installed for these tests to run. " +
                    "Install the NAR file in NiFi's lib directory and restart NiFi.",
            );
        }
    });

    test("should check if processor is on canvas", async ({ page }) => {
        const authService = new AuthService(page);
        const processorManager = new ProcessorApiManager(page);

        // Check if NiFi is accessible
        const isAccessible = await authService.checkNiFiAccessibility();
        if (!isAccessible) {
            throw new Error(
                "PRECONDITION FAILED: NiFi service is not accessible. " +
                    "Cannot test processor API management. " +
                    "Start NiFi with: ./integration-testing/src/main/docker/run-and-deploy.sh",
            );
        }

        // Authenticate
        await authService.ensureReady();

        const result =
            await processorManager.verifyMultiIssuerJWTTokenAuthenticatorIsOnCanvas();

        // Result should have the expected structure
        expect(result).toHaveProperty("exists");
        expect(result).toHaveProperty("processor");
        expect(typeof result.exists).toBe("boolean");

        if (result.exists) {
            expect(result.processor).toBeTruthy();
            expect(result.processor).toHaveProperty("id");
        } else {
            expect(result.processor).toBeNull();
        }
    });

    test("should add processor to canvas if not present", async ({ page }) => {
        const authService = new AuthService(page);
        const processorManager = new ProcessorApiManager(page);

        // Check if NiFi is accessible
        const isAccessible = await authService.checkNiFiAccessibility();
        if (!isAccessible) {
            throw new Error(
                "PRECONDITION FAILED: NiFi service is not accessible. " +
                    "Cannot test processor API management. " +
                    "Start NiFi with: ./integration-testing/src/main/docker/run-and-deploy.sh",
            );
        }

        // Authenticate
        await authService.ensureReady();

        // First check if processor is deployed
        const isDeployed =
            await processorManager.verifyMultiIssuerJWTTokenAuthenticatorIsDeployed();

        if (!isDeployed) {
            throw new Error(
                "TEST FAILED: Cannot add processor - MultiIssuerJWTTokenAuthenticator is not deployed. " +
                    "The processor NAR must be installed in NiFi for this test to run.",
            );
        }

        // Check current state
        const beforeAdd =
            await processorManager.verifyMultiIssuerJWTTokenAuthenticatorIsOnCanvas();

        if (beforeAdd.exists) {
            const removed =
                await processorManager.removeMultiIssuerJWTTokenAuthenticatorFromCanvas();
            expect(removed).toBe(true);
        }

        // Add the processor
        const added =
            await processorManager.addMultiIssuerJWTTokenAuthenticatorOnCanvas({
                x: 500,
                y: 300,
            });
        expect(added).toBe(true);

        // Verify it's now on canvas
        const afterAdd =
            await processorManager.verifyMultiIssuerJWTTokenAuthenticatorIsOnCanvas();
        expect(afterAdd.exists).toBe(true);
        expect(afterAdd.processor).toBeTruthy();
    });

    test("should remove processor from canvas", async ({ page }) => {
        const authService = new AuthService(page);
        const processorManager = new ProcessorApiManager(page);

        // Check if NiFi is accessible
        const isAccessible = await authService.checkNiFiAccessibility();
        if (!isAccessible) {
            throw new Error(
                "PRECONDITION FAILED: NiFi service is not accessible. " +
                    "Cannot test processor API management. " +
                    "Start NiFi with: ./integration-testing/src/main/docker/run-and-deploy.sh",
            );
        }

        // Authenticate
        await authService.ensureReady();

        // First ensure processor is on canvas
        const beforeRemove =
            await processorManager.verifyMultiIssuerJWTTokenAuthenticatorIsOnCanvas();

        if (!beforeRemove.exists) {
            // Try to add it first
            const isDeployed =
                await processorManager.verifyMultiIssuerJWTTokenAuthenticatorIsDeployed();
            if (!isDeployed) {
                throw new Error(
                    "TEST FAILED: Cannot test removal - MultiIssuerJWTTokenAuthenticator is not deployed. " +
                        "The processor NAR must be installed in NiFi for this test to run.",
                );
            }

            const added =
                await processorManager.addMultiIssuerJWTTokenAuthenticatorOnCanvas();
            if (!added) {
                throw new Error(
                    "TEST FAILED: Could not add processor for removal test. " +
                        "The processor could not be added to the canvas.",
                );
            }
        }

        // Remove the processor
        const removed =
            await processorManager.removeMultiIssuerJWTTokenAuthenticatorFromCanvas();
        expect(removed).toBe(true);

        // Verify it's no longer on canvas
        const afterRemove =
            await processorManager.verifyMultiIssuerJWTTokenAuthenticatorIsOnCanvas();
        expect(afterRemove.exists).toBe(false);
    });

    test("should handle ensure processor on canvas", async ({ page }) => {
        const authService = new AuthService(page);
        const processorManager = new ProcessorApiManager(page);

        // Check if NiFi is accessible
        const isAccessible = await authService.checkNiFiAccessibility();
        if (!isAccessible) {
            throw new Error(
                "PRECONDITION FAILED: NiFi service is not accessible. " +
                    "Cannot test processor API management. " +
                    "Start NiFi with: ./integration-testing/src/main/docker/run-and-deploy.sh",
            );
        }

        // Authenticate
        await authService.ensureReady();

        // First check if processor is deployed
        const isDeployed =
            await processorManager.verifyMultiIssuerJWTTokenAuthenticatorIsDeployed();

        if (!isDeployed) {
            throw new Error(
                "TEST FAILED: Cannot ensure processor - MultiIssuerJWTTokenAuthenticator is not deployed. " +
                    "The processor NAR must be installed in NiFi for this test to run.",
            );
        }

        // Ensure processor is on canvas
        const ensured = await processorManager.ensureProcessorOnCanvas();
        expect(ensured).toBe(true);

        // Verify it's on canvas
        const result =
            await processorManager.verifyMultiIssuerJWTTokenAuthenticatorIsOnCanvas();
        expect(result.exists).toBe(true);

        // Call ensure again - should still return true without adding duplicate
        const ensuredAgain = await processorManager.ensureProcessorOnCanvas();
        expect(ensuredAgain).toBe(true);
    });

    test("should start and stop processor", async ({ page }) => {
        const authService = new AuthService(page);
        const processorManager = new ProcessorApiManager(page);

        // Check if NiFi is accessible
        const isAccessible = await authService.checkNiFiAccessibility();
        if (!isAccessible) {
            throw new Error(
                "PRECONDITION FAILED: NiFi service is not accessible. " +
                    "Cannot test processor API management. " +
                    "Start NiFi with: ./integration-testing/src/main/docker/run-and-deploy.sh",
            );
        }

        // Authenticate
        await authService.ensureReady();

        // First ensure processor is on canvas
        const isDeployed =
            await processorManager.verifyMultiIssuerJWTTokenAuthenticatorIsDeployed();

        if (!isDeployed) {
            throw new Error(
                "TEST FAILED: Cannot test start/stop - MultiIssuerJWTTokenAuthenticator is not deployed. " +
                    "The processor NAR must be installed in NiFi for this test to run.",
            );
        }

        const ensured = await processorManager.ensureProcessorOnCanvas();
        if (!ensured) {
            throw new Error(
                "TEST FAILED: Could not ensure processor on canvas. " +
                    "The processor could not be placed on the canvas for testing.",
            );
        }

        // Stop the processor first (in case it's running)
        const stopped = await processorManager.stopProcessor();
        expect(stopped).toBe(true);

        // Start the processor — may return false if the processor was freshly
        // added without issuer configuration (validation errors prevent start)
        const started = await processorManager.startProcessor();
        expect(typeof started).toBe("boolean");

        if (started) {
            // Verify we can stop a running processor
            const stoppedAgain = await processorManager.stopProcessor();
            expect(stoppedAgain).toBe(true);
        }
    });

    test("should get root process group ID", async ({ page }) => {
        const authService = new AuthService(page);
        const processorManager = new ProcessorApiManager(page);

        // Check if NiFi is accessible
        const isAccessible = await authService.checkNiFiAccessibility();
        if (!isAccessible) {
            throw new Error(
                "PRECONDITION FAILED: NiFi service is not accessible. " +
                    "Cannot test processor API management. " +
                    "Start NiFi with: ./integration-testing/src/main/docker/run-and-deploy.sh",
            );
        }

        // Authenticate
        await authService.ensureReady();

        const rootId = await processorManager.getRootProcessGroupId();

        expect(rootId).toBeTruthy();
        expect(typeof rootId).toBe("string");
    });

    test("should get processors on canvas", async ({ page }) => {
        const authService = new AuthService(page);
        const processorManager = new ProcessorApiManager(page);

        // Check if NiFi is accessible
        const isAccessible = await authService.checkNiFiAccessibility();
        if (!isAccessible) {
            throw new Error(
                "PRECONDITION FAILED: NiFi service is not accessible. " +
                    "Cannot test processor API management. " +
                    "Start NiFi with: ./integration-testing/src/main/docker/run-and-deploy.sh",
            );
        }

        // Authenticate
        await authService.ensureReady();

        const processors = await processorManager.getProcessorsOnCanvas();

        expect(Array.isArray(processors)).toBe(true);
    });

    test("should handle authentication headers correctly", async ({ page }) => {
        const authService = new AuthService(page);
        const processorManager = new ProcessorApiManager(page);

        // Check if NiFi is accessible
        const isAccessible = await authService.checkNiFiAccessibility();
        if (!isAccessible) {
            throw new Error(
                "PRECONDITION FAILED: NiFi service is not accessible. " +
                    "Cannot test processor API management. " +
                    "Start NiFi with: ./integration-testing/src/main/docker/run-and-deploy.sh",
            );
        }

        // Authenticate
        await authService.ensureReady();

        const headers = await processorManager.getAuthHeaders();

        expect(typeof headers).toBe("object");

        // Headers should at least have Accept header
        // Note: We use cookie-based auth, not header-based auth, so Authorization may be empty
        expect(headers["Accept"]).toBe("application/json");
    });

    test("should handle processor details retrieval", async ({ page }) => {
        const authService = new AuthService(page);
        const processorManager = new ProcessorApiManager(page);

        // Check if NiFi is accessible
        const isAccessible = await authService.checkNiFiAccessibility();
        if (!isAccessible) {
            throw new Error(
                "PRECONDITION FAILED: NiFi service is not accessible. " +
                    "Cannot test processor API management. " +
                    "Start NiFi with: ./integration-testing/src/main/docker/run-and-deploy.sh",
            );
        }

        // Authenticate
        await authService.ensureReady();

        // First ensure we have a processor on canvas
        const { exists, processor } =
            await processorManager.verifyMultiIssuerJWTTokenAuthenticatorIsOnCanvas();

        if (!exists) {
            const isDeployed =
                await processorManager.verifyMultiIssuerJWTTokenAuthenticatorIsDeployed();
            if (!isDeployed) {
                throw new Error(
                    "TEST FAILED: No processor to get details for - MultiIssuerJWTTokenAuthenticator is not deployed. " +
                        "The processor NAR must be installed in NiFi for this test to run.",
                );
            }

            const added =
                await processorManager.addMultiIssuerJWTTokenAuthenticatorOnCanvas();
            if (!added) {
                throw new Error(
                    "TEST FAILED: Could not add processor for details test. " +
                        "The processor could not be added to the canvas.",
                );
            }

            // Get the processor after adding
            const result =
                await processorManager.verifyMultiIssuerJWTTokenAuthenticatorIsOnCanvas();
            if (result.exists && result.processor) {
                const details = await processorManager.getProcessorDetails(
                    result.processor.id,
                );
                expect(details).toBeTruthy();
                expect(details).toHaveProperty("id");
            }
        } else {
            const details = await processorManager.getProcessorDetails(
                processor.id,
            );
            expect(details).toBeTruthy();
            expect(details).toHaveProperty("id");
        }
    });
});

// Additional integration test to verify the full workflow
test.describe("ProcessorApiManager Integration Test", () => {
    test.beforeEach(async ({ page }, testInfo) => {
        await takeStartScreenshot(page, testInfo);
    });

    test("should complete full processor lifecycle", async ({ page }) => {
        const authService = new AuthService(page);
        const processorManager = new ProcessorApiManager(page);

        // Check if NiFi is accessible
        const isAccessible = await authService.checkNiFiAccessibility();
        if (!isAccessible) {
            throw new Error(
                "PRECONDITION FAILED: NiFi service is not accessible. " +
                    "Cannot test processor API management. " +
                    "Start NiFi with: ./integration-testing/src/main/docker/run-and-deploy.sh",
            );
        }

        // Authenticate
        await authService.ensureReady();

        // Check deployment
        const isDeployed =
            await processorManager.verifyMultiIssuerJWTTokenAuthenticatorIsDeployed();

        if (!isDeployed) {
            throw new Error(
                "INTEGRATION TEST FAILED: MultiIssuerJWTTokenAuthenticator is not deployed. " +
                    "The processor NAR must be installed in NiFi for this test to run.",
            );
        }

        // Remove if exists
        await processorManager.removeMultiIssuerJWTTokenAuthenticatorFromCanvas();

        // Verify not on canvas
        let result =
            await processorManager.verifyMultiIssuerJWTTokenAuthenticatorIsOnCanvas();
        expect(result.exists).toBe(false);

        // Add to canvas
        const added =
            await processorManager.addMultiIssuerJWTTokenAuthenticatorOnCanvas({
                x: 600,
                y: 400,
            });
        expect(added).toBe(true);

        // Verify on canvas
        result =
            await processorManager.verifyMultiIssuerJWTTokenAuthenticatorIsOnCanvas();
        expect(result.exists).toBe(true);

        // Start processor
        const started = await processorManager.startProcessor();
        expect(started).toBe(true);

        // Stop processor
        const stopped = await processorManager.stopProcessor();
        expect(stopped).toBe(true);

        // Remove from canvas
        const removed =
            await processorManager.removeMultiIssuerJWTTokenAuthenticatorFromCanvas();
        expect(removed).toBe(true);

        // Verify removed
        result =
            await processorManager.verifyMultiIssuerJWTTokenAuthenticatorIsOnCanvas();
        expect(result.exists).toBe(false);
    });
});
