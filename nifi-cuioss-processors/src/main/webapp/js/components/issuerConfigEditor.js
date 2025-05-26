/**
 * Custom UI component for configuring IssuerConfig properties.
 * This component provides a user-friendly interface for creating and managing
 * issuer configurations for the MultiIssuerJWTTokenAuthenticator processor.
 */
define([
    'jquery',
    'nf.Common',
    'services/apiClient',
    'utils/formatters'
], function ($, nfCommon, apiClient, formatters) {
    'use strict';

    // Component state
    let issuers = [];
    let componentConfig = {};
    let processorId = '';

    /**
     * Initializes the component.
     * 
     * @param {object} element - The DOM element
     * @param {object} config - The component configuration
     */
    const initComponent = function (element, config) {
        // Store configuration
        componentConfig = config || {};

        // Create component container
        const container = $('<div class="issuer-config-editor"></div>').appendTo(element);

        // Add title
        $('<h3>Issuer Configurations</h3>').appendTo(container);

        // Add description
        $('<p>Configure JWT issuers for token validation. Each issuer requires a name and properties like jwks-url and issuer URI.</p>').appendTo(container);

        // Add issuers container
        const issuersContainer = $('<div class="issuers-container"></div>').appendTo(container);

        // Add "Add Issuer" button
        const addButton = $('<button class="add-issuer-button">Add Issuer</button>').appendTo(container);
        addButton.on('click', function() {
            addIssuerForm(issuersContainer);
        });

        // Get processor ID from URL
        processorId = getProcessorIdFromUrl();

        // Load existing issuers
        loadExistingIssuers(issuersContainer);
    };

    /**
     * Gets the processor ID from the URL.
     * 
     * @return {string} The processor ID
     */
    const getProcessorIdFromUrl = function() {
        // Extract processor ID from URL
        const url = window.location.href;
        const match = url.match(/\/processors\/([a-f0-9-]+)/);
        return match ? match[1] : '';
    };

    /**
     * Loads existing issuer configurations.
     * 
     * @param {object} container - The container element
     */
    const loadExistingIssuers = function(container) {
        if (!processorId) {
            return;
        }

        // Get processor properties
        apiClient.getProcessorProperties(processorId)
            .done(function(response) {
                // Extract issuer properties
                const properties = response.properties || {};
                const issuerProperties = {};

                // Group properties by issuer
                Object.keys(properties).forEach(function(key) {
                    if (key.startsWith('issuer.')) {
                        const parts = key.substring(7).split('.');
                        if (parts.length === 2) {
                            const issuerName = parts[0];
                            const propertyName = parts[1];

                            if (!issuerProperties[issuerName]) {
                                issuerProperties[issuerName] = {};
                            }

                            issuerProperties[issuerName][propertyName] = properties[key];
                        }
                    }
                });

                // Create issuer forms for each issuer
                Object.keys(issuerProperties).forEach(function(issuerName) {
                    addIssuerForm(container, issuerName, issuerProperties[issuerName]);
                });
            })
            .fail(function(xhr, status, error) {
                nfCommon.handleAjaxError(xhr, status, error);
            });
    };

    /**
     * Adds a new issuer form.
     * 
     * @param {object} container - The container element
     * @param {string} [issuerName] - The issuer name (for existing issuers)
     * @param {object} [properties] - The issuer properties (for existing issuers)
     */
    const addIssuerForm = function(container, issuerName, properties) {
        // Create issuer form
        const issuerForm = $('<div class="issuer-form"></div>').appendTo(container);

        // Add form header
        const formHeader = $('<div class="form-header"></div>').appendTo(issuerForm);

        // Add issuer name field
        const nameLabel = $('<label>Issuer Name:</label>').appendTo(formHeader);
        const nameInput = $('<input type="text" class="issuer-name" placeholder="e.g., keycloak">').appendTo(nameLabel);

        // Set issuer name if provided
        if (issuerName) {
            nameInput.val(issuerName);
        }

        // Add remove button
        const removeButton = $('<button class="remove-issuer-button">Remove</button>').appendTo(formHeader);
        removeButton.on('click', function() {
            removeIssuer(issuerForm, issuerName);
        });

        // Add form fields
        const formFields = $('<div class="form-fields"></div>').appendTo(issuerForm);

        // Add issuer URI field
        addFormField(formFields, 'issuer', 'Issuer URI', 'The URI of the token issuer (must match the iss claim)', properties ? properties.issuer : '');

        // Add JWKS URL field
        addFormField(formFields, 'jwks-url', 'JWKS URL', 'The URL of the JWKS endpoint', properties ? properties['jwks-url'] : '');

        // Add audience field
        addFormField(formFields, 'audience', 'Audience', 'The expected audience claim value', properties ? properties.audience : '');

        // Add client ID field
        addFormField(formFields, 'client-id', 'Client ID', 'The client ID for token validation', properties ? properties['client-id'] : '');

        // Add save button
        const saveButton = $('<button class="save-issuer-button">Save Issuer</button>').appendTo(issuerForm);
        saveButton.on('click', function() {
            saveIssuer(issuerForm);
        });
    };

    /**
     * Adds a form field.
     * 
     * @param {object} container - The container element
     * @param {string} name - The field name
     * @param {string} label - The field label
     * @param {string} description - The field description
     * @param {string} [value] - The field value
     */
    const addFormField = function(container, name, label, description, value) {
        const fieldContainer = $('<div class="form-field"></div>').appendTo(container);

        // Add label
        const fieldLabel = $('<label></label>').appendTo(fieldContainer);
        fieldLabel.text(label + ':');

        // Add input
        const input = $('<input type="text" class="field-' + name + '" placeholder="' + description + '">').appendTo(fieldContainer);

        // Set value if provided
        if (value) {
            input.val(value);
        }

        // Add description
        $('<div class="field-description">' + description + '</div>').appendTo(fieldContainer);
    };

    /**
     * Saves an issuer configuration.
     * 
     * @param {object} form - The issuer form
     */
    const saveIssuer = function(form) {
        // Get issuer name
        const issuerName = form.find('.issuer-name').val();

        // Validate issuer name
        if (!issuerName) {
            nfCommon.showMessage('Error', 'Issuer name is required.');
            return;
        }

        // Get issuer properties
        const properties = {
            issuer: form.find('.field-issuer').val(),
            'jwks-url': form.find('.field-jwks-url').val(),
            audience: form.find('.field-audience').val(),
            'client-id': form.find('.field-client-id').val()
        };

        // Validate required properties
        if (!properties.issuer || !properties['jwks-url']) {
            nfCommon.showMessage('Error', 'Issuer URI and JWKS URL are required.');
            return;
        }

        // Create property updates
        const updates = {};

        // Add properties to updates
        Object.keys(properties).forEach(function(key) {
            if (properties[key]) {
                updates['issuer.' + issuerName + '.' + key] = properties[key];
            }
        });

        // Update processor properties
        if (processorId) {
            apiClient.updateProcessorProperties(processorId, updates)
                .done(function() {
                    nfCommon.showMessage('Success', 'Issuer configuration saved successfully.');
                })
                .fail(function(xhr, status, error) {
                    nfCommon.handleAjaxError(xhr, status, error);
                });
        }
    };

    /**
     * Removes an issuer configuration.
     * 
     * @param {object} form - The issuer form
     * @param {string} issuerName - The issuer name
     */
    const removeIssuer = function(form, issuerName) {
        // Confirm removal
        if (confirm('Are you sure you want to remove this issuer configuration?')) {
            // Remove form
            form.remove();

            // Remove properties from processor if issuer name is provided
            if (issuerName && processorId) {
                // Get processor properties
                apiClient.getProcessorProperties(processorId)
                    .done(function(response) {
                        // Extract issuer properties
                        const properties = response.properties || {};
                        const updates = {};

                        // Find properties to remove
                        Object.keys(properties).forEach(function(key) {
                            if (key.startsWith('issuer.' + issuerName + '.')) {
                                updates[key] = null; // Set to null to remove
                            }
                        });

                        // Update processor properties
                        apiClient.updateProcessorProperties(processorId, updates)
                            .done(function() {
                                nfCommon.showMessage('Success', 'Issuer configuration removed successfully.');
                            })
                            .fail(function(xhr, status, error) {
                                nfCommon.handleAjaxError(xhr, status, error);
                            });
                    })
                    .fail(function(xhr, status, error) {
                        nfCommon.handleAjaxError(xhr, status, error);
                    });
            }
        }
    };

    // Return the component
    return {
        /**
         * Initializes the component.
         * 
         * @param {object} element - The DOM element
         * @param {object} config - The component configuration
         */
        init: function (element, config) {
            console.log('[DEBUG_LOG] issuerConfigEditor.init called with element:', element);
            console.log('[DEBUG_LOG] issuerConfigEditor config:', config);

            if (!element) {
                console.error('[DEBUG_LOG] Error: No element provided to issuerConfigEditor.init');
                return;
            }

            try {
                initComponent(element, config);
                console.log('[DEBUG_LOG] issuerConfigEditor initialized successfully');
            } catch (e) {
                console.error('[DEBUG_LOG] Error initializing issuerConfigEditor:', e);
            }
        }
    };
});
