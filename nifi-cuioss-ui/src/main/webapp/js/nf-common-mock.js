/**
 * Mock implementation of nf.Common for standalone testing.
 * This provides the minimum functionality needed by the JWT Validator UI components.
 */
define([], function() {
    'use strict';

    console.log('[DEBUG_LOG] nf.Common mock loaded');

    // Return the mock implementation
    return {
        /**
         * Registers a custom UI component.
         * 
         * @param {string} id - The ID of the component
         * @param {object} component - The component object
         * @param {object} options - Options for the component
         */
        registerCustomUiComponent: function(id, component, options) {
            console.log('[DEBUG_LOG] Registered custom UI component:', id, options);

            // Try to initialize the component if it has an init method
            if (component && typeof component.init === 'function') {
                try {
                    console.log('[DEBUG_LOG] Attempting to initialize component:', id);
                    var container = document.createElement('div');
                    container.id = 'component-' + id.replace(/\./g, '-');
                    container.className = 'custom-component';
                    document.getElementById('jwt-validator-container').appendChild(container);
                    component.init(container, null, options && options.jwks_type, function() {
                        console.log('[DEBUG_LOG] Component initialized:', id);
                    });
                } catch (e) {
                    console.error('[DEBUG_LOG] Error initializing component:', id, e);
                }
            }
        },

        /**
         * Registers a custom UI tab.
         * 
         * @param {string} id - The ID of the tab
         * @param {object} component - The tab component
         */
        registerCustomUiTab: function(id, component) {
            console.log('[DEBUG_LOG] Registered custom UI tab:', id);

            // Create a tab container
            var tabContainer = document.getElementById('jwt-validator-tabs');
            if (!tabContainer) {
                tabContainer = document.createElement('div');
                tabContainer.id = 'jwt-validator-tabs';
                tabContainer.className = 'custom-tabs';
                document.getElementById('jwt-validator-container').appendChild(tabContainer);

                // Create tab navigation container
                var tabNavigation = document.createElement('div');
                tabNavigation.className = 'custom-tabs-navigation';
                tabNavigation.id = 'custom-tabs-navigation';
                tabContainer.appendChild(tabNavigation);
            }

            // Get tab navigation container
            var tabNavigation = document.getElementById('custom-tabs-navigation');

            // Create tab navigation item
            var tabNavItem = document.createElement('div');
            tabNavItem.className = 'tab-nav-item';
            tabNavItem.setAttribute('data-tab-target', id.replace(/\./g, '-'));
            tabNavItem.textContent = id.split('.').pop().replace(/-/g, ' ');
            tabNavigation.appendChild(tabNavItem);

            // Create the tab
            var tab = document.createElement('div');
            tab.id = 'tab-' + id.replace(/\./g, '-');
            tab.className = 'custom-tab';
            tab.setAttribute('data-tab-id', id);

            // Create tab header (hidden but kept for compatibility)
            var tabHeader = document.createElement('div');
            tabHeader.className = 'tab-header';
            tabHeader.textContent = id.split('.').pop().replace(/-/g, ' ');
            tab.appendChild(tabHeader);

            // Create tab content
            var tabContent = document.createElement('div');
            tabContent.className = 'tab-content';
            tab.appendChild(tabContent);

            // Add the tab to the container
            tabContainer.appendChild(tab);

            // Try to initialize the tab if it has an init method
            if (component && typeof component.init === 'function') {
                try {
                    console.log('[DEBUG_LOG] Attempting to initialize tab:', id);
                    component.init(tabContent, {}, function() {
                        console.log('[DEBUG_LOG] Tab initialized:', id);
                    });
                } catch (e) {
                    console.error('[DEBUG_LOG] Error initializing tab:', id, e);
                }
            }

            // Add click handler for tab navigation
            tabNavItem.addEventListener('click', function() {
                // Remove active class from all tabs and nav items
                var allTabs = document.querySelectorAll('.custom-tab');
                var allNavItems = document.querySelectorAll('.tab-nav-item');

                allTabs.forEach(function(t) {
                    t.classList.remove('active');
                });

                allNavItems.forEach(function(ni) {
                    ni.classList.remove('active');
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
        },

        /**
         * Gets the i18n resources.
         * 
         * @return {object} The i18n resources
         */
        getI18n: function() {
            return {
                // Property help texts
                'property.token.location.help': 'Defines where to extract the token from.',
                'property.token.header.help': 'The header name containing the token when using AUTHORIZATION_HEADER.',
                'property.custom.header.name.help': 'The custom header name when using CUSTOM_HEADER.',
                'property.bearer.token.prefix.help': 'The prefix to strip from the token (e.g., "Bearer ").',
                'property.require.valid.token.help': 'Whether to require a valid token for processing.',
                'property.jwks.refresh.interval.help': 'Interval in seconds for refreshing JWKS keys.',
                'property.maximum.token.size.help': 'Maximum token size in bytes.',
                'property.allowed.algorithms.help': 'Comma-separated list of allowed JWT signing algorithms.',
                'property.require.https.jwks.help': 'Whether to require HTTPS for JWKS URLs.',

                // Button labels and UI text
                'processor.jwt.testConnection': 'Test Connection',
                'processor.jwt.verifyToken': 'Verify Token',
                'processor.jwt.tokenInput': 'JWT Token',
                'processor.jwt.tokenInputPlaceholder': 'Enter JWT token to verify',
                'processor.jwt.verificationResults': 'Verification Results',
                'processor.jwt.noTokenProvided': 'No token provided',
                'processor.jwt.verifying': 'Verifying token...',
                'processor.jwt.testing': 'Testing...',
                'processor.jwt.invalidType': 'Invalid JWKS type',
                'processor.jwt.validJwks': 'Valid JWKS',
                'processor.jwt.invalidJwks': 'Invalid JWKS',
                'processor.jwt.keysFound': 'keys found',
                'processor.jwt.validationError': 'Validation error',
                'processor.jwt.verificationError': 'Verification error'
            };
        },

        /**
         * Escapes HTML special characters.
         * 
         * @param {string} text - The text to escape
         * @return {string} The escaped text
         */
        escapeHtml: function(text) {
            return text
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
        },

        /**
         * Formats a date.
         * 
         * @param {Date} date - The date to format
         * @return {string} The formatted date
         */
        formatDateTime: function(date) {
            if (!date) {
                return '';
            }
            return date.toLocaleString();
        }
    };
});
