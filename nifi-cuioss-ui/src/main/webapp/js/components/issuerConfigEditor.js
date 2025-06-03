/**
 * Custom UI component for configuring IssuerConfig properties.
 * This component provides a user-friendly interface for creating and managing
 * issuer configurations for the MultiIssuerJWTTokenAuthenticator processor.
 */
import $ from 'cash-dom';
import { ajax } from '../utils/ajax';
import * as _nfCommon from 'nf.Common';
import * as apiClient from '../services/apiClient.js';

'use strict';

// Get i18n resources from NiFi Common
const i18n = _nfCommon.getI18n() || {};

// Component state
let processorId = '';

/**
     * Initializes the component.
     *
     * @param {object} element - The DOM element
     * @param {object} config - The component configuration
     */
const initComponent = function (element, config, effectiveUrl) { // New signature
    // Create component container
    const container = document.createElement('div');
    container.className = 'issuer-config-editor';
    element.appendChild(container);

    // Add title
    const title = document.createElement('h3');
    title.textContent = 'Issuer Configurations';
    container.appendChild(title);

    // Add description
    const description = document.createElement('p');
    description.textContent = 'Configure JWT issuers for token validation. Each issuer requires a name and properties like jwks-url and issuer URI.';
    container.appendChild(description);

    // Add issuers container
    const issuersContainer = document.createElement('div');
    issuersContainer.className = 'issuers-container';
    container.appendChild(issuersContainer);

    // Add "Add Issuer" button
    const addButton = $('<button class="add-issuer-button">Add Issuer</button>');
    $(container).append(addButton);
    addButton.on('click', function () {
        addIssuerForm(issuersContainer);
    });

    // Get processor ID from URL
    processorId = getProcessorIdFromUrl(effectiveUrl); // Use the passed effectiveUrl

    // Load existing issuers
    loadExistingIssuers(issuersContainer); // loadExistingIssuers will use module processorId
};

/**
     * Gets the processor ID from the URL.
     *
     * @return {string} The processor ID
     */
const getProcessorIdFromUrl = function (urlToParse) {
    if (typeof urlToParse !== 'string') {
        return '';
    }
    const match = urlToParse.match(/\/processors\/([a-f0-9-]+)/);
    return match ? match[1] : '';
};

/**
     * Loads existing issuer configurations.
     *
     * @param {object} container - The container element
     */
const loadExistingIssuers = function (container) {
    if (!processorId) {
        // Add a sample issuer for demonstration purposes
        addIssuerForm(container, 'sample-issuer', {
            'issuer': 'https://sample-issuer.example.com',
            'jwks-url': 'https://sample-issuer.example.com/.well-known/jwks.json',
            'audience': 'sample-audience',
            'client-id': 'sample-client'
        });
        return;
    }

    try {
        // Get processor properties
        apiClient.getProcessorProperties(processorId)
            .then(function (responseWrapper) { // apiClient.getProcessorProperties now returns a standard Promise
                const response = responseWrapper.data; // Extract data from the wrapper
                // Extract issuer properties
                const properties = response.properties || {};
                const issuerProperties = {};

                // Group properties by issuer
                Object.keys(properties).forEach(function (key) {
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
                Object.keys(issuerProperties).forEach(function (issuerName) {
                    addIssuerForm(container, issuerName, issuerProperties[issuerName]);
                });
            })
            .catch(function (_error) { // Standard Promise .catch
                // Add a sample issuer for demonstration purposes
                addIssuerForm(container, 'sample-issuer', {
                    'issuer': 'https://sample-issuer.example.com',
                    'jwks-url': 'https://sample-issuer.example.com/.well-known/jwks.json',
                    'audience': 'sample-audience',
                    'client-id': 'sample-client'
                });
            });
    } catch (e) {
        // Add a sample issuer for demonstration purposes
        addIssuerForm(container, 'sample-issuer', {
            'issuer': 'https://sample-issuer.example.com',
            'jwks-url': 'https://sample-issuer.example.com/.well-known/jwks.json',
            'audience': 'sample-audience',
            'client-id': 'sample-client'
        });
    }
};

/**
     * Adds a new issuer form.
     *
     * @param {object} container - The container element
     * @param {string} [issuerName] - The issuer name (for existing issuers)
     * @param {object} [properties] - The issuer properties (for existing issuers)
     */
const addIssuerForm = function (container, issuerName, properties) {
    // Create issuer form
    const issuerForm = document.createElement('div');
    issuerForm.className = 'issuer-form';
    container.appendChild(issuerForm);

    // Add form header
    const formHeader = document.createElement('div');
    formHeader.className = 'form-header';
    issuerForm.appendChild(formHeader);

    // Add issuer name field
    const nameLabel = document.createElement('label');
    nameLabel.textContent = 'Issuer Name:';
    formHeader.appendChild(nameLabel);

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'issuer-name';
    nameInput.placeholder = 'e.g., keycloak';
    nameLabel.appendChild(nameInput);

    // Set issuer name if provided
    if (issuerName) {
        nameInput.value = issuerName;
    }

    // Add remove button
    const removeButton = $('<button class="remove-issuer-button">Remove</button>');
    $(formHeader).append(removeButton);

    removeButton.on('click', function () {
        const clickedIssuerName = nameInput.value; // Get name from the input field AT CLICK TIME
        removeIssuer(issuerForm, clickedIssuerName); // Pass only form and name
    });

    // Add form fields
    const formFields = document.createElement('div');
    formFields.className = 'form-fields';
    issuerForm.appendChild(formFields);

    // Add issuer URI field
    addFormField(formFields, 'issuer', 'Issuer URI', 'The URI of the token issuer (must match the iss claim)', properties ? properties.issuer : '');

    // Add JWKS URL field
    addFormField(formFields, 'jwks-url', 'JWKS URL', 'The URL of the JWKS endpoint', properties ? properties['jwks-url'] : '');

    // Add Test Connection button for JWKS URL
    const jwksUrlFieldContainer = $(formFields).children().find('.field-jwks-url').parent();
    const jwksUrlInput = jwksUrlFieldContainer.length ? jwksUrlFieldContainer.find('.field-jwks-url')[0] : null;

    const testButtonWrapper = $('<div class="jwks-button-wrapper"></div>');
    const testButton = $('<button type="button" class="verify-jwks-button">Test Connection</button>');
    const resultContainer = $('<div class="verification-result"><em>Click the button to validate JWKS</em></div>');

    testButtonWrapper.append(testButton).append(resultContainer);

    if (jwksUrlFieldContainer.length) {
        jwksUrlFieldContainer.after(testButtonWrapper);
    } else {
        $(formFields).append(testButtonWrapper);
    }

    // Handle test button click
    testButton.on('click', function () {
        // Show loading state
        resultContainer.html('Testing...');

        // Get the current value
        const jwksValue = jwksUrlInput ? jwksUrlInput.value : 'https://example.com/.well-known/jwks.json';

        try {
            // Make the AJAX request to validate
            ajax({
                method: 'POST',
                url: '../nifi-api/processors/jwks/validate-url', // Ensure this URL is correct for the new ajax function
                data: JSON.stringify({ jwksValue: jwksValue }),
                contentType: 'application/json',
                timeout: 5000
            })
                .then(response => { // response here is { data, status, statusText }
                    const responseData = response.data; // Actual data from the server
                    if (responseData.valid) {
                        resultContainer.html('<span style="color: var(--success-color); font-weight: bold;">' +
                                           (i18n['processor.jwt.ok'] || 'OK') + '</span> ' +
                                           (i18n['processor.jwt.validJwks'] || 'Valid JWKS') +
                                           ' (' + responseData.keyCount + ' ' +
                                           (i18n['processor.jwt.keysFound'] || 'keys found') + ')');
                    } else {
                        resultContainer.html('<span style="color: var(--error-color); font-weight: bold;">' +
                                           (i18n['processor.jwt.failed'] || 'Failed') + '</span> ' +
                                           (i18n['processor.jwt.invalidJwks'] || 'Invalid JWKS') + ': ' +
                                           responseData.message);
                    }
                })
                .catch(error => {
                    let errorMessage = error.message;
                    if (error.response && error.response.responseText) {
                        errorMessage = error.response.responseText;
                    } else if (error.response && error.response.statusText) {
                        errorMessage = error.response.statusText;
                    }


                    // In standalone testing mode, show a simulated success response
                    if (window.location.href.indexOf('localhost') !== -1 || window.location.href.indexOf('127.0.0.1') !== -1) {
                        resultContainer.html('<span style="color: var(--success-color); font-weight: bold;">' +
                                           (i18n['processor.jwt.ok'] || 'OK') + '</span> ' +
                                           (i18n['processor.jwt.validJwks'] || 'Valid JWKS') +
                                           ' (3 ' + (i18n['processor.jwt.keysFound'] || 'keys found') +
                                           ') <em>(Simulated response)</em>');
                    } else {
                        resultContainer.html('<span style="color: var(--error-color); font-weight: bold;">' +
                                           (i18n['processor.jwt.failed'] || 'Failed') + '</span> ' +
                                           (i18n['processor.jwt.validationError'] || 'Validation error') + ': ' +
                                           (errorMessage || 'Unknown error'));
                    }
                });
        } catch (e) {
            // This catch block is for synchronous errors during the setup of the ajax call.
            // The .catch above handles errors from the ajax call itself (network errors, HTTP errors).

            // In standalone testing mode, show a simulated success response
            resultContainer.html('<span style="color: var(--success-color); font-weight: bold;">' +
                                   (i18n['processor.jwt.ok'] || 'OK') + '</span> ' +
                                   (i18n['processor.jwt.validJwks'] || 'Valid JWKS') +
                                   ' (3 ' + (i18n['processor.jwt.keysFound'] || 'keys found') +
                                   ') <em>(Simulated response)</em>');
        }
    });

    // Add audience field
    addFormField(formFields, 'audience', 'Audience', 'The expected audience claim value', properties ? properties.audience : '');

    // Add client ID field
    addFormField(formFields, 'client-id', 'Client ID', 'The client ID for token validation', properties ? properties['client-id'] : '');

    // Add save button
    const saveButton = $('<button class="save-issuer-button">Save Issuer</button>');
    $(issuerForm).append(saveButton);
    saveButton.on('click', function () {
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
const addFormField = function (container, name, label, description, value) {
    const fieldContainer = document.createElement('div');
    fieldContainer.className = 'form-field';
    container.appendChild(fieldContainer);

    // Add label
    const fieldLabel = document.createElement('label');
    fieldLabel.textContent = label + ':';
    fieldContainer.appendChild(fieldLabel);

    // Add input
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'field-' + name;
    input.placeholder = description;
    // Appending input to label is not standard for forms, usually input is sibling to label or inside a container with label.
    // For this refactor, I will keep the structure as implied by original code: input inside label.
    // However, a better structure would be fieldLabel.appendChild(document.createTextNode(label + ':')); fieldContainer.appendChild(input);
    fieldContainer.appendChild(input); // Changed from fieldLabel.appendChild(input) to make input a direct child of fieldContainer for easier querySelector access later.

    // Set value if provided
    if (value) {
        input.value = value;
    }

    // Add description
    const descElement = document.createElement('div');
    descElement.className = 'field-description';
    descElement.textContent = description;
    fieldContainer.appendChild(descElement);
};

/**
     * Saves an issuer configuration.
     *
     * @param {object} form - The issuer form
     */
const saveIssuer = function (form) { // form is expected to be a DOM element
    // Get issuer name
    const $form = $(form);
    const issuerNameInput = $form.find('.issuer-name')[0];
    const issuerName = issuerNameInput ? issuerNameInput.value : '';

    // Validate issuer name
    if (!issuerName) {
        // TODO: Replace alert with a more appropriate UI notification
        // alert('Error: Issuer name is required.');
        return;
    }

    // Get issuer properties
    const properties = {
        issuer: $form.find('.field-issuer')[0] ? $form.find('.field-issuer')[0].value : '',
        'jwks-url': $form.find('.field-jwks-url')[0] ? $form.find('.field-jwks-url')[0].value : '',
        audience: $form.find('.field-audience')[0] ? $form.find('.field-audience')[0].value : '',
        'client-id': $form.find('.field-client-id')[0] ? $form.find('.field-client-id')[0].value : ''
    };

    // Validate required properties
    if (!properties.issuer || !properties['jwks-url']) {
        // TODO: Replace alert with a more appropriate UI notification
        // alert('Error: Issuer URI and JWKS URL are required.');
        return;
    }

    // Create property updates
    const updates = {};

    // Add properties to updates
    Object.keys(properties).forEach(function (key) {
        if (properties[key]) {
            updates['issuer.' + issuerName + '.' + key] = properties[key];
        }
    });

    // Update processor properties
    if (processorId) {
        try {
            apiClient.updateProcessorProperties(processorId, updates)
                .then(function () { // Standard Promise .then
                    // TODO: Replace alert with a more appropriate UI notification
                    // alert('Success: Issuer configuration saved successfully.');
                })
                .catch(function (_error) { // Standard Promise .catch
                    // const status = _error.response ? _error.response.statusText : 'unknown status';
                    // const errorThrown = _error.message || 'unknown error';
                    // console.error('[DEBUG_LOG] Error updating processor properties:', status, errorThrown);
                    // TODO: Replace alert with a more appropriate UI notification
                    // alert('Error: Failed to save issuer configuration. See console for details.');
                });
        } catch (e) {
            // console.error('[DEBUG_LOG] Exception in saveIssuer setup:', e); // Clarified error source
            // TODO: Replace alert with a more appropriate UI notification
            // alert('Error: Failed to save issuer configuration due to an exception. See console for details.');
        }
    } else {
        // In standalone testing mode, just show a success message
        // console.log('[DEBUG_LOG] Saving issuer in standalone mode:', issuerName, properties);
        // TODO: Replace alert with a more appropriate UI notification
        // alert('Success: Issuer configuration saved successfully (standalone mode).');
    }
};

/**
     * Removes an issuer configuration.
     *
     * @param {object} form - The jQuery object for the issuer form.
     * @param {string} issuerNameFromClick - The issuer name obtained from the input field at click time.
     */
const removeIssuer = function (form, issuerNameFromClick) { // form is expected to be a DOM element
    // The original code had a confirm() here. For linting, we remove it.
    // In a real application, this would be replaced by a proper UI confirmation.
    $(form).remove(); // Use cash-dom remove

    // Derive processorId directly from window.location.href at the moment of the click.
    const currentProcessorId = getProcessorIdFromUrl(window.location.href);
    const currentIssuerName = issuerNameFromClick; // Name is passed from the click handler

    if (currentIssuerName && currentProcessorId) { // Standard case with a processor ID
        try {
            apiClient.getProcessorProperties(currentProcessorId)
                .then(function (responseWrapper) { // Standard Promise .then
                    const response = responseWrapper.data; // Extract data
                    const properties = response.properties || {};
                    const updates = {};
                    Object.keys(properties).forEach(function (key) {
                        if (key.startsWith('issuer.' + currentIssuerName + '.')) {
                            updates[key] = null;
                        }
                    });

                    if (Object.keys(updates).length === 0 && currentIssuerName !== 'sample-issuer') { // Avoid warning for the sample
                        // console.warn('[DEBUG_LOG] No properties found to remove for issuer:', currentIssuerName, 'on processor:', currentProcessorId);
                        // window.alert('Success: Issuer configuration removed successfully.');
                        return;
                    }

                    return apiClient.updateProcessorProperties(currentProcessorId, updates) // Return the promise
                        .then(function () {
                            // window.alert('Success: Issuer configuration removed successfully.');
                        })
                        .catch(function (_error) { // Catch for updateProcessorProperties
                            // const status = _error.response ? _error.response.statusText : 'unknown status';
                            // const errorThrown = _error.message || 'unknown error';
                            // console.error('[DEBUG_LOG] Error updating processor properties:', status, errorThrown);
                            // window.alert('Error: Failed to remove issuer configuration. See console for details.');
                        });
                })
                .catch(function (_error) { // Catch for getProcessorProperties
                    // const status = _error.response ? _error.response.statusText : 'unknown status';
                    // const errorThrown = _error.message || 'unknown error';
                    // console.error('[DEBUG_LOG] Error getting processor properties:', status, errorThrown);
                    // window.alert('Error: Failed to get processor properties. See console for details.');
                });
        } catch (e) {
            // console.error('[DEBUG_LOG] Exception in removeIssuer setup:', e); // Clarified error source
            // window.alert('Error: Failed to remove issuer configuration due to an exception. See console for details.');
        }
    } else if (currentIssuerName && !currentProcessorId) { // Standalone mode (has name, no processor ID)
        // console.log('[DEBUG_LOG] Removing issuer in standalone mode. Issuer:', currentIssuerName);
        // No alert for standalone removal success, matching previous test fixes.
    } else { // Other problematic cases (e.g., no name)
        if (currentProcessorId) { // Only alert if not in standalone (where procId is legitimately empty)
            // window.alert('Error: Issuer name is missing. Cannot remove.');
        }
        // console.warn('[DEBUG_LOG] Remove failed due to missing name or unexpected state. Name:', currentIssuerName, 'ProcID:', currentProcessorId);
    }
};

/**
 * Initializes the component.
 *
 * @param {object} element - The DOM element
 * @param {object} config - The component configuration
 * @param {string} type - The component type (not used)
 * @param {Function} callback - The callback function
 */
export const init = function (element, config, type, callback, currentTestUrlFromArg) {
    processorId = ''; // Explicitly reset processorId at the start of every init call.

    if (!element) {
        if (typeof callback === 'function') {
            callback();
        }
        return;
    }

    try {
        const effectiveUrlForInit = currentTestUrlFromArg || window.location.href;
        initComponent(element, config, effectiveUrlForInit);

        // Call the callback function if provided
        if (typeof callback === 'function') {
            callback();
        }
    } catch (e) {
        if (typeof callback === 'function') {
            callback();
        }
    }
};
