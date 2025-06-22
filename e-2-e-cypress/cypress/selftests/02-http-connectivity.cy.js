/**
 * HTTP connectivity test - checks if NiFi server is responding
 * without loading the full UI
 */
describe('NiFi HTTP Connectivity', () => {
  const baseUrl = Cypress.env('CYPRESS_BASE_URL') || 'https://localhost:9095/nifi/';

  it('should be able to make basic HTTP request to NiFi', () => {
    cy.request({
      url: baseUrl,
      timeout: 5000,
      failOnStatusCode: false,
    }).then((response) => {
      // Accept any reasonable HTTP response (200, 302, etc.)
      expect(response.status).to.be.oneOf([200, 302, 401, 403]);
      cy.log(`NiFi responded with status: ${response.status}`);
    });
  });

  it('should handle NiFi API health check', () => {
    const healthUrl = `${baseUrl.replace('/nifi/', '/nifi-api/system-diagnostics')}`;

    cy.request({
      url: healthUrl,
      timeout: 5000,
      failOnStatusCode: false,
    }).then((response) => {
      // Log the response for debugging
      cy.log(`Health check status: ${response.status}`);

      // Accept various responses - NiFi might require auth
      expect(response.status).to.be.oneOf([200, 401, 403, 404]);
    });
  });

  it('should verify server is accessible', () => {
    // Simple connectivity test without full page load
    cy.request({
      method: 'HEAD',
      url: baseUrl,
      timeout: 3000,
      failOnStatusCode: false,
    }).then((response) => {
      cy.log(`HEAD request status: ${response.status}`);
      // Any response means server is up
      expect(response.status).to.be.lessThan(500);
    });
  });
});
