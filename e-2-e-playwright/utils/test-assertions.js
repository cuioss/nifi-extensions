/**
 * @file Shared Test Assertions
 * Reusable assertion helpers for E2E tests
 */

/**
 * Assert that a validation/verification result does not indicate an infrastructure or auth error.
 * Throws with the actual text for easy debugging.
 * @param {string} resultText - The text content of a verification result element
 */
export const assertNoAuthError = (resultText) => {
    const authIndicators = [
        "401",
        "403",
        "Unauthorized",
        "Forbidden",
        "API key",
        "Server error",
        "Service not available",
    ];
    for (const indicator of authIndicators) {
        if (resultText.includes(indicator)) {
            throw new Error(
                `Auth/CSRF infrastructure error detected (${indicator}): ${resultText.substring(0, 200)}`,
            );
        }
    }
};
