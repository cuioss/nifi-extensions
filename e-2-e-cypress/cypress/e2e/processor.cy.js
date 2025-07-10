/**
 * @file Processor Tests
 * Tests for processor operations in NiFi
 * Includes standard login and navigation to the main canvas
 */

import { PAGE_TYPES } from '../support/constants';

describe('Processor Tests', () => {
  beforeEach(() => {
    // Ensure NiFi is ready for testing using auth helper
    // Note: ensureNiFiReady() ensures we're logged in and have access to the canvas,
    // but it doesn't explicitly verify the page type or session context.
    // It's focused on ensuring prerequisites for testing are met.
    cy.ensureNiFiReady();
  });

  it('Should login and navigate to the main canvas', () => {

    cy.verifyPageType(PAGE_TYPES.MAIN_CANVAS, { waitForReady: true });
    cy.log('✅ Canvas is ready for operations');
  });
})
