/**
 * Tests for Metrics Tab Component
 */

describe('MetricsTab', () => {
    let metricsTab;
    let mockGetI18n;
    let mockGetProperty;
    let mockGetSecurityMetrics;

    beforeEach(() => {
        jest.resetModules();
        jest.clearAllMocks();
        jest.useFakeTimers();

        // Mock DOM structure
        document.body.innerHTML = `
            <div id="metrics" class="tab-pane"></div>
            <div id="jwt-validator-container"></div>
        `;

        // Mock translations
        mockGetProperty = jest.fn((key) => {
            const translations = {
                'jwt.metrics.title': 'JWT Validation Metrics',
                'jwt.validator.metrics.tab.name': 'Metrics'
            };
            return translations[key] || key;
        });

        mockGetI18n = jest.fn(() => ({
            getProperty: mockGetProperty
        }));

        jest.mock('nf.Common', () => ({
            getI18n: mockGetI18n
        }), { virtual: true });

        // Mock formatters
        jest.mock('../../../main/webapp/js/utils/formatters.js', () => ({
            formatNumber: jest.fn((num) => {
                if (num === undefined || num === null) return '';
                return num.toLocaleString('en-US');
            }),
            formatDate: jest.fn((date) => {
                if (!date) return '';
                return new Date(date).toLocaleString();
            })
        }));

        // Mock API client
        mockGetSecurityMetrics = jest.fn().mockResolvedValue({
            totalValidations: 1000,
            successCount: 950,
            failureCount: 50,
            avgResponseTime: 45,
            minResponseTime: 10,
            maxResponseTime: 200,
            p95ResponseTime: 80,
            issuers: [
                {
                    name: 'keycloak',
                    totalRequests: 600,
                    successCount: 580,
                    failureCount: 20,
                    successRate: 96.67,
                    avgResponseTime: 40
                },
                {
                    name: 'auth0', 
                    totalRequests: 400,
                    successCount: 370,
                    failureCount: 30,
                    successRate: 92.5,
                    avgResponseTime: 50
                }
            ],
            recentErrors: [
                {
                    timestamp: new Date().toISOString(),
                    issuer: 'keycloak',
                    message: 'Token expired',
                    subject: 'user123'
                }
            ]
        });

        jest.doMock('../../../main/webapp/js/services/apiClient.js', () => ({
            getSecurityMetrics: mockGetSecurityMetrics
        }));

        metricsTab = require('../../../main/webapp/js/components/metricsTab.js');
    });

    afterEach(() => {
        jest.useRealTimers();
        document.body.innerHTML = '';
    });

    describe('init', () => {
        it('should create metrics content when it does not exist', () => {
            metricsTab.init();

            const metricsContent = document.getElementById('jwt-metrics-content');
            expect(metricsContent).toBeTruthy();
            expect(metricsContent.classList.contains('jwt-tab-content')).toBe(true);
            expect(metricsContent.getAttribute('data-testid')).toBe('metrics-tab-content');
        });

        it('should not recreate metrics content if it already exists', () => {
            // First init
            metricsTab.init();
            const firstContent = document.getElementById('jwt-metrics-content');
            firstContent.setAttribute('data-test', 'original');

            // Clear timers to prevent refresh
            jest.clearAllTimers();

            // Second init
            metricsTab.init();
            const secondContent = document.getElementById('jwt-metrics-content');
            
            expect(secondContent.getAttribute('data-test')).toBe('original');
        });

        it('should create all metrics sections', () => {
            metricsTab.init();

            // Check validation metrics section
            const validationMetrics = document.querySelector('[data-testid="validation-metrics"]');
            expect(validationMetrics).toBeTruthy();
            expect(document.getElementById('total-validations')).toBeTruthy();
            expect(document.getElementById('success-rate')).toBeTruthy();
            expect(document.getElementById('failure-rate')).toBeTruthy();

            // Check performance metrics section
            const performanceMetrics = document.querySelector('[data-testid="performance-metrics"]');
            expect(performanceMetrics).toBeTruthy();

            // Check issuer metrics section
            const issuerMetrics = document.querySelector('[data-testid="issuer-metrics"]');
            expect(issuerMetrics).toBeTruthy();
        });

        it('should start metrics refresh after initialization', async () => {
            metricsTab.init();

            // Advance timers to trigger first refresh
            jest.advanceTimersByTime(100);
            await Promise.resolve();

            expect(mockGetSecurityMetrics).toHaveBeenCalled();
        });

        it('should append to container if metrics tab pane not found', () => {
            // Remove metrics tab pane
            document.getElementById('metrics').remove();

            metricsTab.init();

            const container = document.getElementById('jwt-validator-container');
            const metricsContent = container.querySelector('#jwt-metrics-content');
            expect(metricsContent).toBeTruthy();
        });
    });

    describe('metrics refresh', () => {
        beforeEach(() => {
            metricsTab.init();
        });

        it('should update metrics display with fetched data', async () => {
            // Trigger initial refresh
            jest.advanceTimersByTime(100);
            await Promise.resolve();
            await Promise.resolve(); // Extra resolve for async updates

            expect(document.getElementById('total-validations').textContent).toBe('1,000');
            expect(document.getElementById('success-rate').textContent).toBe('95.0%');
            expect(document.getElementById('failure-rate').textContent).toBe('5.0%');
        });

        it('should handle metrics fetch error gracefully', async () => {
            mockGetSecurityMetrics.mockRejectedValueOnce(new Error('Network error'));

            // Trigger refresh
            jest.advanceTimersByTime(100);
            await Promise.resolve();

            // Should not throw and should keep default values
            expect(document.getElementById('total-validations').textContent).toBe('0');
        });

        it('should update issuer metrics table', async () => {
            jest.advanceTimersByTime(100);
            await Promise.resolve();
            await Promise.resolve();

            const issuerRows = document.querySelectorAll('.issuer-metrics-table tbody tr');
            expect(issuerRows.length).toBe(2); // keycloak and auth0

            // Check first issuer (keycloak)
            const keycloakCells = issuerRows[0].querySelectorAll('td');
            expect(keycloakCells[0].textContent).toBe('keycloak');
            expect(keycloakCells[1].textContent).toBe('600'); // total requests
            expect(keycloakCells[2].textContent).toBe('580'); // success count
            expect(keycloakCells[3].textContent).toBe('20');  // failure count
            expect(keycloakCells[4].textContent).toBe('96.7%'); // success rate
            expect(keycloakCells[5].textContent).toBe('40 ms'); // response time
        });

        it('should update recent errors table', async () => {
            jest.advanceTimersByTime(100);
            await Promise.resolve();
            await Promise.resolve();

            const errorRows = document.querySelectorAll('.recent-errors-table tbody tr');
            expect(errorRows.length).toBeGreaterThan(0);

            const firstErrorCells = errorRows[0].querySelectorAll('td');
            // Check the issuer and message content
            expect(firstErrorCells[1].textContent).toBe('keycloak');
            expect(firstErrorCells[2].textContent).toBe('Token expired');
            expect(firstErrorCells[3].textContent).toBe('user123');
        });

        it('should refresh periodically', async () => {
            // Initial call
            jest.advanceTimersByTime(100);
            await Promise.resolve();
            expect(mockGetSecurityMetrics).toHaveBeenCalledTimes(1);

            // Wait for periodic refresh (30 seconds)
            jest.advanceTimersByTime(30000);
            await Promise.resolve();
            expect(mockGetSecurityMetrics).toHaveBeenCalledTimes(2);
        });
    });

    describe('button actions', () => {
        beforeEach(() => {
            metricsTab.init();
        });

        it('should refresh metrics on refresh button click', async () => {
            const refreshBtn = document.getElementById('refresh-metrics-btn');
            
            // Clear initial calls
            mockGetSecurityMetrics.mockClear();

            refreshBtn.click();
            await Promise.resolve();

            expect(mockGetSecurityMetrics).toHaveBeenCalled();
        });

        it('should export metrics on export button click', async () => {
            // First load metrics
            jest.advanceTimersByTime(100);
            await Promise.resolve();
            await Promise.resolve();

            // Mock download functionality
            const createElementSpy = jest.spyOn(document, 'createElement');
            const clickSpy = jest.fn();
            const mockAnchor = {
                click: clickSpy,
                download: '',
                href: ''
            };
            createElementSpy.mockReturnValueOnce(mockAnchor);

            const exportBtn = document.getElementById('export-metrics-btn');
            exportBtn.click();

            expect(createElementSpy).toHaveBeenCalledWith('a');
            expect(mockAnchor.download).toContain('jwt-metrics-');
            expect(mockAnchor.href).toContain('data:application/json');
            expect(clickSpy).toHaveBeenCalled();
        });

        it('should handle export with no metrics gracefully', () => {
            const exportBtn = document.getElementById('export-metrics-btn');
            
            expect(() => exportBtn.click()).not.toThrow();
        });
    });

    describe('cleanup', () => {
        it('should stop metrics refresh on cleanup', () => {
            metricsTab.init();
            
            // Verify refresh is active
            jest.advanceTimersByTime(30000);
            expect(mockGetSecurityMetrics).toHaveBeenCalled();

            // Clean up
            metricsTab.cleanup();
            mockGetSecurityMetrics.mockClear();

            // Verify refresh stopped
            jest.advanceTimersByTime(30000);
            expect(mockGetSecurityMetrics).not.toHaveBeenCalled();
        });

        it('should handle cleanup when not initialized', () => {
            expect(() => metricsTab.cleanup()).not.toThrow();
        });
    });

    describe('getDisplayName', () => {
        it('should return translated metrics tab name', () => {
            const displayName = metricsTab.getDisplayName();
            expect(displayName).toBe('Metrics');
            expect(mockGetProperty).toHaveBeenCalledWith('jwt.validator.metrics.tab.name');
        });

        it('should return default name when translation not available', () => {
            mockGetProperty.mockReturnValue(null);
            const displayName = metricsTab.getDisplayName();
            expect(displayName).toBe('Metrics');
        });
    });

    describe('edge cases', () => {
        it('should handle missing metrics data gracefully', async () => {
            mockGetSecurityMetrics.mockResolvedValueOnce({});

            metricsTab.init();
            jest.advanceTimersByTime(100);
            await Promise.resolve();

            // Should show default values
            expect(document.getElementById('total-validations').textContent).toBe('0');
            expect(document.getElementById('success-rate').textContent).toBe('0.0%');
        });

        it('should handle division by zero for percentages', async () => {
            mockGetSecurityMetrics.mockResolvedValueOnce({
                totalValidations: 0,
                successfulValidations: 0,
                failedValidations: 0
            });

            metricsTab.init();
            jest.advanceTimersByTime(100);
            await Promise.resolve();
            await Promise.resolve();

            expect(document.getElementById('success-rate').textContent).toBe('0.0%');
            expect(document.getElementById('failure-rate').textContent).toBe('0.0%');
        });

        it('should handle empty issuers array', async () => {
            mockGetSecurityMetrics.mockResolvedValueOnce({
                totalValidations: 100,
                successCount: 90,
                failureCount: 10,
                issuers: []
            });

            metricsTab.init();
            jest.advanceTimersByTime(100);
            await Promise.resolve();
            await Promise.resolve();

            const issuerRows = document.querySelectorAll('.issuer-metrics-table tbody tr');
            expect(issuerRows.length).toBe(0);
        });
    });
});