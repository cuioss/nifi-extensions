/**
 * @file Navigation Utilities
 * @description Common navigation utilities for test setup
 */

import { AuthService } from './auth-service.js';
import { ProcessorService } from './processor.js';
import { ProcessorApiManager } from './processor-api-manager.js';

/**
 * Navigate to JWT Authenticator configuration UI
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {import('@playwright/test').TestInfo} testInfo - Test info object
 * @returns {Promise<import('@playwright/test').Frame>} Custom UI frame
 */
export async function navigateToJWTAuthenticatorUI(page, testInfo) {
    // Ensure NiFi is available
    const authService = new AuthService(page);
    const isNiFiAvailable = await authService.checkNiFiAccessibility();
    if (!isNiFiAvailable) {
        throw new Error(
            "🚨 CRITICAL FAILURE: NiFi service is not available at https://localhost:9095/nifi\n\n" +
            "Accessibility tests require a running NiFi instance for WCAG compliance validation.\n" +
            "This is a hard requirement that cannot be bypassed.\n\n" +
            "To resolve:\n" +
            "1. Start NiFi service: ./integration-testing/src/main/docker/run-and-deploy.sh\n" +
            "2. Verify NiFi is accessible at https://localhost:9095/nifi\n" +
            "3. Ensure authentication is working\n" +
            "4. Re-run the accessibility tests"
        );
    }

    await authService.ensureReady();

    // Navigate into the JWT Auth Pipeline process group so the processor is visible on canvas
    const apiManager = new ProcessorApiManager(page);
    const jwtGroupId = await apiManager.getJwtPipelineProcessGroupId();
    if (jwtGroupId) {
        await apiManager.navigateToProcessGroup(jwtGroupId);
    }

    const processorService = new ProcessorService(page, testInfo);

    // Find the JWT processor
    const processor = await processorService.findMultiIssuerJwtAuthenticator({
        failIfNotFound: false,
    });

    if (!processor) {
        throw new Error(
            "🚨 CRITICAL FAILURE: MultiIssuerJWTTokenAuthenticator processor not found on canvas!\n\n" +
            "Accessibility tests require the JWT processor to be configured for WCAG compliance validation.\n" +
            "This is a mandatory prerequisite that cannot be bypassed.\n\n" +
            "To resolve:\n" +
            "1. Navigate to NiFi UI at https://localhost:9095/nifi\n" +
            "2. Drag a 'Processor' component onto the canvas\n" +
            "3. Search for and select 'MultiIssuerJWTTokenAuthenticator'\n" +
            "4. Click 'Add' to place it on the canvas\n" +
            "5. Re-run the accessibility tests\n\n" +
            "This processor must be present for accessibility testing as it provides the UI components\n" +
            "that need to be validated for WCAG 2.1 Level AA compliance."
        );
    }

    // Open Advanced UI
    const advancedOpened = await processorService.openAdvancedUI(processor);
    if (!advancedOpened) {
        throw new Error(
            "🚨 CRITICAL FAILURE: Failed to open Advanced UI for accessibility testing\n\n" +
            "The JWT processor's Advanced UI could not be opened, which is required for\n" +
            "WCAG compliance validation of the custom UI components.\n\n" +
            "This may indicate:\n" +
            "1. Processor configuration issues\n" +
            "2. UI loading problems\n" +
            "3. Browser or network connectivity issues\n\n" +
            "Accessibility tests cannot proceed without access to the UI components."
        );
    }

    // Get the custom UI frame
    const customUIFrame = await processorService.getAdvancedUIFrame();
    if (!customUIFrame) {
        throw new Error(
            "🚨 CRITICAL FAILURE: Failed to get custom UI frame for accessibility testing\n\n" +
            "The JWT processor's custom UI frame could not be accessed, which is required for\n" +
            "WCAG 2.1 Level AA compliance validation.\n\n" +
            "This indicates a critical issue with:\n" +
            "1. UI frame loading or initialization\n" +
            "2. Browser security policies preventing frame access\n" +
            "3. Custom UI component failures\n\n" +
            "Accessibility validation cannot proceed without frame access to the UI components."
        );
    }

    return customUIFrame;
}