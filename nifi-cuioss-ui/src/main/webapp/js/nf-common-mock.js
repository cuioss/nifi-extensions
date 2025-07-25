'use strict';

// Mock implementation of nf.Common for standalone testing
(function () {
    // Simple mock logger for standalone usage
    const logger = {
        debug: function (msg) { console.debug('[nf-common-mock]', msg); },
        info: function (msg) { console.info('[nf-common-mock]', msg); },
        warn: function (msg) { console.warn('[nf-common-mock]', msg); },
        error: function (msg) { console.error('[nf-common-mock]', msg); }
    };

    /**
     * Registers a custom UI component.
     *
     * @param {string} id - The ID of the component
     * @param {object} component - The component object
     * @param {object} options - Options for the component
     */
    const registerCustomUiComponent = function (id, component, options) {
        // Try to initialize the component if it has an init method
        if (component && typeof component.init === 'function') {
            try {
                const container = document.createElement('div');
                container.id = 'component-' + id.replace(/\./g, '-');
                container.className = 'custom-component';
                document.getElementById('jwt-validator-container').appendChild(container);
                component.init(container, null, options && options.jwks_type, function () {
                    // Component initialized callback
                });
            } catch (e) {
                console.error('Failed to initialize component', id, e);
            }
        }
    };

    /**
     * Registers a custom UI tab.
     *
     * @param {string} id - The ID of the tab
     * @param {object} component - The component object
     */
    const registerCustomUiTab = function (id, component) {
        try {
            // Create tab structure
            const jwtValidatorContainer = document.getElementById('jwt-validator-container');
            let tabContainer = document.getElementById('jwt-validator-tabs');

            if (!tabContainer) {
                // Hide loading indicator first
                const loadingIndicator = document.getElementById('loading-indicator');
                if (loadingIndicator) {
                    loadingIndicator.style.display = 'none';
                }

                // Create tabs container
                tabContainer = document.createElement('div');
                tabContainer.id = 'jwt-validator-tabs';
                tabContainer.className = 'jwt-validator-tabs';
                jwtValidatorContainer.appendChild(tabContainer);

                // Create tab navigation
                const tabNavigation = document.createElement('div');
                tabNavigation.className = 'tab-navigation';
                tabContainer.appendChild(tabNavigation);

                // Create tab content container
                const tabContent = document.createElement('div');
                tabContent.className = 'tab-content';
                tabContainer.appendChild(tabContent);
            }

            const tabNavigation = tabContainer.querySelector('.tab-navigation');
            const tabContent = tabContainer.querySelector('.tab-content');

            // Create tab navigation item
            const tabNavItem = document.createElement('div');
            tabNavItem.className = 'tab-nav-item';
            // Use i18n key if available, otherwise format the ID
            const i18n = getI18n();
            const tabLabel = i18n.getProperty(id) || id.charAt(0).toUpperCase() + id.slice(1).replace(/([A-Z])/g, ' $1');
            tabNavItem.textContent = tabLabel;
            tabNavItem.setAttribute('data-tab', id);
            tabNavigation.appendChild(tabNavItem);

            // Create tab content
            const tab = document.createElement('div');
            tab.className = 'tab-pane';
            tab.id = 'tab-' + id;
            tab.setAttribute('data-tab', id);
            tabContent.appendChild(tab);

            // Initialize component in tab
            if (component && typeof component.init === 'function') {
                component.init(tab, null, null, function () {
                    // Component initialized callback
                });
            }

            // Add click handler for tab navigation
            tabNavItem.addEventListener('click', function () {
                // Remove active class from all nav items and tabs
                const allNavItems = tabNavigation.querySelectorAll('.tab-nav-item');
                const allTabs = tabContent.querySelectorAll('.tab-pane');

                allNavItems.forEach(function (ni) {
                    ni.classList.remove('active');
                });
                allTabs.forEach(function (t) {
                    t.classList.remove('active');
                });

                // Add active class to clicked tab and its content
                tabNavItem.classList.add('active');
                tab.classList.add('active');
            });

            // If this is the first tab, activate it
            if (tabNavigation.children.length === 1) {
                tabNavItem.classList.add('active');
                tab.classList.add('active');
            }
        } catch (error) {
            console.error('Failed to register tab', id, error);
        }
    };

    /**
     * Gets the i18n resources.
     *
     * @return {object} The i18n resources
     */
    const getI18n = function () {
        return {
            getProperty: function (key) {
                const translations = {
                    // JWT Validator
                    'jwt.validator.title': 'JWT Token Validator',
                    'jwt.validator.loading': 'Loading JWT Validator UI...',
                    // Tab names
                    'jwt.validation.issuer.configuration': 'Issuer Configuration',
                    'jwt.validation.token.verification': 'Token Verification',
                    'Jwt.Validation.Issuer.Configuration': 'Issuer Configuration',
                    'Jwt.Validation.Token.Verification': 'Token Verification',

                    // Property help texts
                    'property.token.location.help': 'Defines where to extract the token from.',
                    'property.token.header.help': 'The header name containing the token when using AUTHORIZATION_HEADER.',
                    'property.custom.header.name.help': 'The custom header name when using CUSTOM_HEADER.',
                    'property.bearer.token.prefix.help': 'The prefix to strip from the token (e.g., "Bearer ").',
                    'property.require.valid.token.help': 'Whether to require a valid token for processing.',
                    'property.jwks.refresh.interval.help': 'Interval in seconds for refreshing JWKS keys.',
                    'property.maximum.token.size.help': 'Maximum size in bytes for JWT tokens.',
                    'property.allowed.algorithms.help': 'Comma-separated list of allowed JWT signature algorithms.',
                    'property.require.https.jwks.help': 'Whether to require HTTPS for JWKS endpoint URLs.',

                    // Token Verification
                    'token.verification.title': 'Token Verification',
                    'token.verification.input.label': 'Enter JWT Token',
                    'token.verification.button': 'Verify Token',
                    'token.verification.valid': 'Token is valid',
                    'token.verification.invalid': 'Token is invalid',
                    'token.verification.error': 'Error verifying token',
                    'token.verification.loading': 'Verifying token...',
                    'token.verification.details': 'Token Details',
                    'token.verification.claims': 'Claims',
                    'token.verification.raw': 'Raw Token',


                    // Common
                    'common.loading': 'Loading...',
                    'common.error': 'Error',
                    'common.success': 'Success',
                    'common.save': 'Save',
                    'common.cancel': 'Cancel',
                    'common.add': 'Add',
                    'common.remove': 'Remove',
                    'common.edit': 'Edit',
                    'common.verify': 'Verify',
                    'common.details': 'Details',
                    'common.name': 'Name',
                    'common.value': 'Value',
                    'common.yes': 'Yes',
                    'common.no': 'No',
                    // Issuer Configuration
                    'issuer.config.description': 'Configure JWT issuers for token validation. Each issuer requires a name and properties like jwks-url and issuer URI.',
                    'issuer.config.issuer.name': 'Issuer Name',
                    'issuer.config.issuer.url': 'Issuer URI',
                    'issuer.config.issuer.url.description': 'The URI of the token issuer (must match the iss claim)',
                    'issuer.config.issuer.url.help': 'This value must exactly match the "iss" claim in JWT tokens. Example: https://auth.example.com/auth/realms/myrealm',
                    'issuer.config.jwks.url': 'JWKS URL',
                    'issuer.config.jwks.url.description': 'The URL of the JWKS endpoint',
                    'issuer.config.jwks.url.help': 'URL providing public keys for JWT signature verification. Usually ends with /.well-known/jwks.json',
                    'issuer.config.audience': 'Audience',
                    'issuer.config.audience.description': 'The expected audience claim value',
                    'issuer.config.audience.help': 'Optional: Expected "aud" claim value in JWT tokens. Leave blank to accept any audience.',
                    'issuer.config.client.id': 'Client ID',
                    'issuer.config.client.id.description': 'The client ID for token validation',
                    'issuer.config.client.id.help': 'Optional: Expected "azp" or "client_id" claim value. Used for additional token validation.',
                    'issuer.config.add': 'Add Issuer',
                    'issuer.config.save.issuer': 'Save Issuer',
                    'issuer.config.test.connection': 'Test Connection',
                    'issuer.config.test.connection.tooltip': 'Test connectivity to the JWKS endpoint and verify it returns valid keys',
                    'issuer.config.remove.tooltip': 'Delete this issuer configuration'
                };
                return translations[key] || key;
            }
        };
    };

    /**
     * Logs an error message.
     *
     * @param {string} message - The error message
     */
    const logError = function (message) {
        console.error('[NiFi Error]', message);
    };

    /**
     * Escapes HTML characters in text.
     *
     * @param {string} text - The text to escape
     * @return {string} The escaped text
     */
    const escapeHtml = function (text) {
        if (!text) {
            return '';
        }
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    };

    /**
     * Formats a date.
     *
     * @param {Date} date - The date to format
     * @return {string} The formatted date
     */
    const formatDateTime = function (date) {
        if (!date) {
            return '';
        }
        return date.toLocaleString();
    };

    // Create the global nfCommon object
    window.nfCommon = {
        registerCustomUiComponent: registerCustomUiComponent,
        registerCustomUiTab: registerCustomUiTab,
        getI18n: getI18n,
        logError: logError,
        escapeHtml: escapeHtml,
        formatDateTime: formatDateTime
    };

    logger.info('nf.Common mock initialized and available as window.nfCommon');
})();
