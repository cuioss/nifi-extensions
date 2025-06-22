/**
 * Fail-fast commands test - verifies our custom fail-fast commands work
 */
describe('Fail-Fast Commands', () => {
  beforeEach(() => {
    // Use our fail-fast setup
    cy.startTestTimer();
  });

  afterEach(() => {
    // Clean up
    cy.endTestTimer();
  });

  it('should handle test timer commands', () => {
    // Test that our timer commands work
    cy.startTestTimer('test-timer-example');

    // Short operation
    cy.wait(100);

    // Check timer (should not fail)
    cy.checkTestTimer('test-timer-example');

    // Clean up
    cy.endTestTimer('test-timer-example');

    cy.log('Timer commands working correctly');
  });

  it('should handle enhanced wait commands', () => {
    // Test our enhanced wait command
    cy.waitWithTimeout(200, { timeout: 1000 });

    cy.log('Enhanced wait command working');
  });

  it('should handle enhanced get commands with simple elements', () => {
    // Visit a simple page first
    cy.visit('about:blank');

    // Test getting document element (should always exist)
    cy.getWithTimeout('html', { timeout: 2000 });

    cy.log('Enhanced get command working');
  });

  it('should handle waitUntil with timeout', () => {
    // Test conditional wait with a simpler approach
    const startTime = Date.now();

    cy.waitUntilWithTimeout(
      () => {
        const elapsed = Date.now() - startTime;
        return elapsed > 200; // Should succeed after 200ms
      },
      5000,
      100
    );

    cy.then(() => {
      const elapsed = Date.now() - startTime;
      expect(elapsed).to.be.gte(200);
      cy.log('waitUntilWithTimeout working correctly');
    });
  });

  it('should complete within reasonable time', () => {
    const startTime = Date.now();

    // Simple operations that should complete quickly
    cy.wrap('test').should('equal', 'test');
    cy.wait(50);

    cy.then(() => {
      const duration = Date.now() - startTime;
      expect(duration).to.be.lessThan(2000); // 2 seconds max
      cy.log(`Test completed in ${duration}ms`);
    });
  });
});
