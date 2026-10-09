/**
 * @file Self-Test: Processor Lookup Tiers
 * Verifies the candidate precedence of findProcessor on a synthetic DOM, without a NiFi
 * canvas: type-qualified candidates are waited before the structural fallbacks.
 */

import { test, expect } from "@playwright/test";
import { findProcessor } from "../utils/processor.js";

/** A canvas group that is not a processor; it matches the structural g[transform] only. */
const STRUCTURAL_GROUP =
    '<g id="canvas-group" transform="translate(10,10)"><rect width="80" height="40"></rect></g>';

/**
 * Per-candidate wait budget for the lookups of this spec. The synthetic DOM needs no
 * multi-second budget, so the eight type-qualified candidates add up to a 400 ms tier wait
 * instead of the 16 s of the default budget.
 */
const PER_CANDIDATE_TIMEOUT_MS = 50;

/** Delay before the processor is inserted; well below the 400 ms budget of the first tier. */
const PROCESSOR_INSERT_DELAY_MS = 100;

/**
 * Load a page whose only content is an SVG canvas with the given children.
 * @param {import('@playwright/test').Page} page - the page to load the canvas into
 * @param {string} svgChildren - SVG markup placed inside the canvas
 * @returns {Promise<void>}
 */
async function setCanvas(page, svgChildren) {
    await page.setContent(
        `<svg id="canvas" xmlns="http://www.w3.org/2000/svg" width="400" height="300">${svgChildren}</svg>`,
    );
}

test.describe("Self-Test: Processor Lookup Tiers", () => {
    test("should prefer a processor that renders late over a visible structural element", async ({
        page,
    }) => {
        // Arrange
        await setCanvas(page, STRUCTURAL_GROUP);
        await page.evaluate((delay) => {
            setTimeout(() => {
                const svgNamespace = "http://www.w3.org/2000/svg";
                const processor = document.createElementNS(svgNamespace, "g");
                processor.setAttribute("id", "late-processor");
                processor.setAttribute("class", "processor");
                processor.setAttribute("data-type", "demo.processor.Sample");
                const body = document.createElementNS(svgNamespace, "rect");
                body.setAttribute("x", "150");
                body.setAttribute("width", "80");
                body.setAttribute("height", "40");
                processor.appendChild(body);
                document.getElementById("canvas").appendChild(processor);
            }, delay);
        }, PROCESSOR_INSERT_DELAY_MS);

        // Act
        const result = await findProcessor(page, "processor", {
            perCandidateTimeout: PER_CANDIDATE_TIMEOUT_MS,
        });

        // Assert
        expect(result.element).toBe('g.processor[data-type*="processor"]');
        await expect(result.locator).toHaveAttribute("id", "late-processor");
    });

    test("should fall back to a structural element when no type-qualified candidate appears", async ({
        page,
    }) => {
        // Arrange
        await setCanvas(page, STRUCTURAL_GROUP);

        // Act
        const result = await findProcessor(page, "processor", {
            perCandidateTimeout: PER_CANDIDATE_TIMEOUT_MS,
        });

        // Assert
        expect(result.element).toBe("g[transform]");
        await expect(result.locator).toHaveAttribute("id", "canvas-group");
        expect(result.isVisible).toBe(true);
    });

    test("should not use a structural fallback for a specific processor type", async ({
        page,
    }) => {
        // Arrange
        await setCanvas(page, STRUCTURAL_GROUP);

        // Act
        const result = await findProcessor(page, "SampleProcessorType", {
            failIfNotFound: false,
            perCandidateTimeout: PER_CANDIDATE_TIMEOUT_MS,
        });

        // Assert
        expect(result).toBeNull();
    });
});
