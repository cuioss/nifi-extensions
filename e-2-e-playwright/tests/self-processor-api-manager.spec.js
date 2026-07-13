/**
 * @file Self-test for ProcessorApiManager utility
 * Tests the API-based processor management functionality
 * Consolidated to cover deployment verification, ensure-on-canvas,
 * and the full lifecycle (add/start/stop/remove).
 * @version 1.1.0
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

// Full lifecycle integration test
test.describe("ProcessorApiManager Integration Test", () => {
    test.beforeEach(async ({ page }, testInfo) => {
        await takeStartScreenshot(page, testInfo);
    });

    test("should exercise add/start/stop/remove on an isolated throwaway processor", async ({
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

        // Check deployment
        const isDeployed =
            await processorManager.verifyMultiIssuerJWTTokenAuthenticatorIsDeployed();

        if (!isDeployed) {
            throw new Error(
                "INTEGRATION TEST FAILED: MultiIssuerJWTTokenAuthenticator is not deployed. " +
                    "The processor NAR must be installed in NiFi for this test to run.",
            );
        }

        // Capture the provisioned pipeline processor so we can assert the
        // self-test leaves it — and its configuration — untouched. This test is
        // NON-DESTRUCTIVE: it never removes the provisioned processor or its
        // connections; the entire lifecycle runs against an isolated throwaway
        // instance (M21).
        await processorManager.ensureProcessorOnCanvas();
        const provisionedBefore =
            await processorManager.verifyMultiIssuerJWTTokenAuthenticatorIsOnCanvas();
        expect(provisionedBefore.exists).toBe(true);
        const provisionedId = provisionedBefore.processor.id;
        const provisionedDetailsBefore =
            await processorManager.getProcessorDetails(provisionedId);
        const provisionedPropsBefore = JSON.stringify(
            provisionedDetailsBefore?.component?.config?.properties || {},
        );

        const throwawayName = "E2E-Throwaway-Lifecycle";

        // Remove any leftover from a previously interrupted run (idempotency —
        // a run must leave no residual throwaway state).
        const stale = await processorManager.findProcessorByName(throwawayName);
        if (stale) {
            await processorManager.removeProcessorById(stale.id);
        }

        // Add the throwaway instance
        const created = await processorManager.addThrowawayProcessor(
            throwawayName,
            { x: 100, y: 100 },
        );
        expect(created).toBeTruthy();
        const throwawayId = created.id;

        // Verify it exists
        const throwawayDetails =
            await processorManager.getProcessorDetails(throwawayId);
        expect(throwawayDetails).toBeTruthy();
        expect(throwawayDetails).toHaveProperty("id", throwawayId);

        // Start — may return false if the freshly-added instance has no issuer
        // configuration (validation errors prevent start); either way is a boolean
        const started = await processorManager.setProcessorRunStatusById(
            throwawayId,
            "RUNNING",
        );
        expect(typeof started).toBe("boolean");

        if (started) {
            const stopped = await processorManager.setProcessorRunStatusById(
                throwawayId,
                "STOPPED",
            );
            expect(stopped).toBe(true);
        }

        // Remove the throwaway
        const removed =
            await processorManager.removeProcessorById(throwawayId);
        expect(removed).toBe(true);

        // Verify the throwaway is gone
        const gone = await processorManager.getProcessorDetails(throwawayId);
        expect(gone).toBeNull();

        // The provisioned pipeline processor must remain on canvas with its
        // configuration (properties, issuer service refs) intact.
        const provisionedAfter =
            await processorManager.verifyMultiIssuerJWTTokenAuthenticatorIsOnCanvas();
        expect(provisionedAfter.exists).toBe(true);
        expect(provisionedAfter.processor.id).toBe(provisionedId);
        const provisionedDetailsAfter =
            await processorManager.getProcessorDetails(provisionedId);
        const provisionedPropsAfter = JSON.stringify(
            provisionedDetailsAfter?.component?.config?.properties || {},
        );
        expect(provisionedPropsAfter).toBe(provisionedPropsBefore);
    });
});
