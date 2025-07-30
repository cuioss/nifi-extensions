/**
 * Tests for Help Tab Component
 */

describe('HelpTab', () => {
    let helpTab;
    let mockGetI18n;
    let mockGetProperty;

    beforeEach(() => {
        jest.resetModules();
        jest.clearAllMocks();

        // Mock DOM structure
        document.body.innerHTML = `
            <div id="help" class="tab-pane"></div>
            <div id="jwt-validator-container"></div>
        `;

        // Mock nf.Common
        mockGetProperty = jest.fn((key) => {
            const translations = {
                'jwt.help.title': 'JWT Authenticator Help',
                'jwt.validator.help.tab.name': 'Help'
            };
            return translations[key] || key;
        });

        mockGetI18n = jest.fn(() => ({
            getProperty: mockGetProperty
        }));

        jest.mock('nf.Common', () => ({
            getI18n: mockGetI18n
        }), { virtual: true });

        helpTab = require('../../../main/webapp/js/components/helpTab.js');
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    describe('init', () => {
        it('should create help content when it does not exist', () => {
            helpTab.init();

            const helpContent = document.getElementById('jwt-help-content');
            expect(helpContent).toBeTruthy();
            expect(helpContent.classList.contains('help-tab')).toBe(true);
            expect(helpContent.getAttribute('data-testid')).toBe('help-tab-content');
        });

        it('should not recreate help content if it already exists', () => {
            // First init
            helpTab.init();
            const firstContent = document.getElementById('jwt-help-content');
            firstContent.setAttribute('data-test', 'original');

            // Second init
            helpTab.init();
            const secondContent = document.getElementById('jwt-help-content');
            
            expect(secondContent.getAttribute('data-test')).toBe('original');
        });

        it('should create all help sections', () => {
            helpTab.init();

            const sections = document.querySelectorAll('.help-section');
            expect(sections.length).toBeGreaterThan(0);

            // Check for specific sections
            const sectionHeaders = Array.from(document.querySelectorAll('.collapsible-header'))
                .map(h => h.textContent.trim());
            
            expect(sectionHeaders.some(h => h.includes('Getting Started'))).toBe(true);
            expect(sectionHeaders.some(h => h.includes('Issuer Configuration'))).toBe(true);
            expect(sectionHeaders.some(h => h.includes('Authorization Rules'))).toBe(true);
            expect(sectionHeaders.some(h => h.includes('Token Verification'))).toBe(true);
            expect(sectionHeaders.some(h => h.includes('Troubleshooting'))).toBe(true);
            expect(sectionHeaders.some(h => h.includes('Additional Resources'))).toBe(true);
        });

        it('should append to container if help tab pane not found', () => {
            // Remove help tab pane
            document.getElementById('help').remove();

            helpTab.init();

            const container = document.getElementById('jwt-validator-container');
            const helpContent = container.querySelector('#jwt-help-content');
            expect(helpContent).toBeTruthy();
        });

        it('should handle missing help tab pane and container gracefully', () => {
            // Remove both elements
            document.getElementById('help').remove();
            document.getElementById('jwt-validator-container').remove();

            expect(() => helpTab.init()).not.toThrow();
        });
    });

    describe('collapsible sections', () => {
        beforeEach(() => {
            helpTab.init();
        });

        it('should initialize with Getting Started section expanded', () => {
            const gettingStartedHeader = Array.from(document.querySelectorAll('.collapsible-header'))
                .find(h => h.textContent.includes('Getting Started'));
            
            expect(gettingStartedHeader.classList.contains('active')).toBe(true);
            
            const content = gettingStartedHeader.nextElementSibling;
            expect(content.classList.contains('show')).toBe(true);
        });

        it('should toggle sections on header click', () => {
            const header = document.querySelectorAll('.collapsible-header')[1]; // Second section
            const content = header.nextElementSibling;
            const icon = header.querySelector('i.fa');

            // Initially collapsed
            expect(header.classList.contains('active')).toBe(false);
            expect(content.classList.contains('show')).toBe(false);
            expect(icon.classList.contains('fa-chevron-right')).toBe(true);

            // Click to expand
            header.click();
            expect(header.classList.contains('active')).toBe(true);
            expect(content.classList.contains('show')).toBe(true);
            expect(icon.classList.contains('fa-chevron-down')).toBe(true);

            // Click to collapse
            header.click();
            expect(header.classList.contains('active')).toBe(false);
            expect(content.classList.contains('show')).toBe(false);
            expect(icon.classList.contains('fa-chevron-right')).toBe(true);
        });

        it('should handle missing icon gracefully', () => {
            const header = document.querySelectorAll('.collapsible-header')[0];
            const icon = header.querySelector('i.fa');
            icon.remove();

            expect(() => header.click()).not.toThrow();
        });

        it('should handle missing content element gracefully', () => {
            const header = document.querySelectorAll('.collapsible-header')[0];
            const content = header.nextElementSibling;
            content.remove();

            expect(() => header.click()).not.toThrow();
        });
    });

    describe('getDisplayName', () => {
        it('should return translated help tab name', () => {
            const displayName = helpTab.getDisplayName();
            expect(displayName).toBe('Help');
            expect(mockGetProperty).toHaveBeenCalledWith('jwt.validator.help.tab.name');
        });

        it('should return default name when translation not available', () => {
            mockGetProperty.mockReturnValue(null);
            const displayName = helpTab.getDisplayName();
            expect(displayName).toBe('Help');
        });
    });

    describe('cleanup', () => {
        it('should cleanup without errors', () => {
            helpTab.init();
            expect(() => helpTab.cleanup()).not.toThrow();
        });
    });

    describe('content structure', () => {
        beforeEach(() => {
            helpTab.init();
        });

        it('should include example configurations', () => {
            const content = document.getElementById('jwt-help-content');
            expect(content.textContent).toContain('keycloak.jwks.url');
            expect(content.textContent).toContain('auth0.jwks.url');
            expect(content.textContent).toContain('local.jwks.file');
        });

        it('should include authorization rules documentation', () => {
            const content = document.getElementById('jwt-help-content');
            expect(content.textContent).toContain('Required Scopes');
            expect(content.textContent).toContain('Required Roles');
            expect(content.textContent).toContain('jwt.subject');
            expect(content.textContent).toContain('jwt.issuer');
        });

        it('should include troubleshooting information', () => {
            const content = document.getElementById('jwt-help-content');
            expect(content.textContent).toContain('JWKS Loading Issues');
            expect(content.textContent).toContain('Performance Tips');
            expect(content.textContent).toContain('Security Best Practices');
        });

        it('should include resource links', () => {
            const links = document.querySelectorAll('.resource-links a');
            expect(links.length).toBeGreaterThan(0);
            
            const hrefs = Array.from(links).map(l => l.getAttribute('href'));
            expect(hrefs).toContain('https://jwt.io/introduction');
            expect(hrefs).toContain('https://tools.ietf.org/html/rfc7517');
            expect(hrefs).toContain('https://nifi.apache.org/docs.html');
        });

        it('should include version and support information', () => {
            const content = document.getElementById('jwt-help-content');
            expect(content.textContent).toContain('Version:');
            expect(content.textContent).toContain('Support:');
            expect(content.textContent).toContain('support@cuioss.de');
        });
    });
});