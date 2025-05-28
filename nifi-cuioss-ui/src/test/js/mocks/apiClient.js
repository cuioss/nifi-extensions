/**
 * Mock implementation of apiClient for testing.
 */

module.exports = {
    validateJwksUrl: jest.fn().mockImplementation((jwksUrl, successCallback, errorCallback) => {
    // Mock implementation that simulates a successful response
        successCallback({
            valid: true,
            keyCount: 3,
            message: 'JWKS URL validated successfully'
        });
    }),

    validateJwksFile: jest.fn().mockImplementation((filePath, successCallback, errorCallback) => {
    // Mock implementation that simulates a successful response
        successCallback({
            valid: true,
            keyCount: 2,
            message: 'JWKS file validated successfully'
        });
    }),

    validateJwksContent: jest.fn().mockImplementation((jwksContent, successCallback, errorCallback) => {
    // Mock implementation that simulates a successful response
        successCallback({
            valid: true,
            keyCount: 1,
            message: 'JWKS content validated successfully'
        });
    }),

    verifyToken: jest.fn().mockImplementation((token, successCallback, errorCallback) => {
    // Mock implementation that simulates a successful response for a valid token
    // or an error response for an invalid token
        if (token?.includes('.')) {
            successCallback({
                valid: true,
                subject: 'user123',
                issuer: 'https://auth.example.com',
                audience: 'api://my-service',
                expiration: new Date(Date.now() + 3600000).toISOString(),
                roles: ['admin', 'user'],
                scopes: ['read', 'write'],
                claims: {
                    sub: 'user123',
                    iss: 'https://auth.example.com',
                    aud: 'api://my-service',
                    exp: Math.floor(Date.now() / 1000) + 3600,
                    roles: ['admin', 'user'],
                    scope: 'read write'
                }
            });
        } else {
            successCallback({
                valid: false,
                message: 'Invalid token format',
                category: 'MALFORMED_TOKEN'
            });
        }
    }),

    getSecurityMetrics: jest.fn().mockImplementation((successCallback, errorCallback) => {
    // Mock implementation that simulates a successful response
        successCallback({
            totalRequests: 100,
            validTokens: 80,
            invalidTokens: 20,
            errorsByCategory: {
                EXPIRED_TOKEN: 10,
                INVALID_SIGNATURE: 5,
                MALFORMED_TOKEN: 3,
                OTHER: 2
            }
        });
    })
};
