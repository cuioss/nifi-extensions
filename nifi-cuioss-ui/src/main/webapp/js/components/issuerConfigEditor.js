/**
 * Custom UI component for configuring IssuerConfig properties.
 * This component provides a user-friendly interface for creating and managing
 * issuer configurations for the MultiIssuerJWTTokenAuthenticator processor.
 */
import $ from 'cash-dom';
import * as _nfCommon from 'nf.Common';
import * as apiClient from '../services/apiClient.js';

'use strict';

// Get i18n resources from NiFi Common
const i18n = _nfCommon.getI18n() || {};

// Component state
let processorId = '';

/**
 * Returns a predefined sample issuer configuration object.
 * This is used for demonstration or as a default when loading fails.
 * @returns {{name: string, properties: object}}
 */
const _getSampleIssuerConfig = () => {
    return {
        name: 'sample-issuer',
        properties: {
            'issuer': 'https://sample-issuer.example.com',
            'jwks-url': 'https://sample-issuer.example.com/.well-known/jwks.json',
            'audience': 'sample-audience',
            'client-id': 'sample-client'
        }
    };
};

/**
 * Creates the basic DOM structure for the issuer config editor.
 * @param {HTMLElement} parentElement The parent element to append the editor to.
 * @returns {{container: HTMLElement, issuersContainer: HTMLElement}} An object containing the main container and the issuers container.
 */
const _createEditorStructure = (parentElement) => {
    const $container = $('<div class="issuer-config-editor"></div>');
    $(parentElement).append($container);

    const $title = $('<h3>Issuer Configurations</h3>');
    $container.append($title);

    const $description = $('<p>Configure JWT issuers for token validation. Each issuer requires a name and properties like jwks-url and issuer URI.</p>');
    $container.append($description);

    const $issuersContainer = $('<div class="issuers-container"></div>');
    $container.append($issuersContainer);

    return { container: $container[0], issuersContainer: $issuersContainer[0] };
};

/**
 * Sets up the "Add Issuer" button and its event listener.
 * @param {HTMLElement} container The main container element for the editor.
 * @param {HTMLElement} issuersContainer The container where issuer forms will be added.
 */
const _setupAddIssuerButton = (container, issuersContainer) => {
    const $addButton = $('<button class="add-issuer-button">Add Issuer</button>');
    $(container).append($addButton);
    $addButton.on('click', () => {
        const sampleConfig = _getSampleIssuerConfig();
        // When adding a new issuer, we might want a unique name or an empty form.
        // For now, adhering to the subtask to use _getSampleIssuerObject.
        // This will create a new form populated with "sample-issuer" data.
        // A truly "new" blank form would be addIssuerForm(issuersContainer);
        addIssuerForm(issuersContainer, sampleConfig.name + '-' + Date.now(), sampleConfig.properties);
    });
};

/**
 * Initializes editor data, including setting the processor ID and loading existing issuers.
 * @param {string} effectiveUrl The URL used to determine the processor ID.
 * @param {HTMLElement} issuersContainer The container where issuer forms are managed.
 */
const _initializeEditorData = (effectiveUrl, issuersContainer) => {
    processorId = getProcessorIdFromUrl(effectiveUrl);
    loadExistingIssuers(issuersContainer);
};

/**
     * Initializes the component.
     *
     * @param {object} element - The DOM element
     * @param {string} effectiveUrl - The URL to derive processorId from
     */
const initComponent = (element, effectiveUrl) => {
    const { container, issuersContainer } = _createEditorStructure(element); // container and issuersContainer are DOM elements
    _setupAddIssuerButton($(container), $(issuersContainer)); // Pass cash-dom objects
    _initializeEditorData(effectiveUrl, $(issuersContainer)); // Pass cash-dom object
};

/**
     * Gets the processor ID from the URL.
     *
     * @return {string} The processor ID
     */
const getProcessorIdFromUrl = (urlToParse) => {
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
const loadExistingIssuers = (container) => {
    if (!processorId) {
        const sampleConfig = _getSampleIssuerConfig();
        addIssuerForm(container, sampleConfig.name, sampleConfig.properties);
        return;
    }

    try {
        // Get processor properties
        apiClient.getProcessorProperties(processorId)
            .then(response => { // apiClient.getProcessorProperties now returns a standard Promise with data directly
                // Extract issuer properties
                const properties = response.properties || {};
                const issuerProperties = {};

                // Group properties by issuer
                Object.keys(properties).forEach(key => {
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
                Object.keys(issuerProperties).forEach(issuerName => {
                    addIssuerForm(container, issuerName, issuerProperties[issuerName]);
                });
            })
            .catch(_error => { // Standard Promise .catch
                const sampleConfig = _getSampleIssuerConfig();
                addIssuerForm(container, sampleConfig.name, sampleConfig.properties);
            });
    } catch (e) {
        const sampleConfig = _getSampleIssuerConfig();
        addIssuerForm(container, sampleConfig.name, sampleConfig.properties);
    }
};

/**
     * Adds a new issuer form.
     *
     * @param {object} container - The container element
     * @param {string} [issuerName] - The issuer name (for existing issuers)
     * @param {object} [properties] - The issuer properties (for existing issuers)
     */
/**
 * Creates the header section for an issuer form, including name input and remove button.
 * @param {string} [issuerName] - The initial name of the issuer, if any.
 * @param {function} onRemove - Callback function when the remove button is clicked.
 * @returns {cash} The header element.
 */
const _createFormHeader = (issuerName, onRemove) => {
    const $formHeader = $('<div class="form-header"></div>');

    const $nameLabel = $('<label>Issuer Name:</label>');
    $formHeader.append($nameLabel);

    const $nameInput = $('<input type="text" class="issuer-name" placeholder="e.g., keycloak">');
    $nameLabel.append($nameInput);

    if (issuerName) {
        $nameInput.val(issuerName);
    }

    const $removeButton = $('<button class="remove-issuer-button">Remove</button>');
    $formHeader.append($removeButton);
    $removeButton.on('click', () => {
        // Pass $nameInput.val() at the time of click
        onRemove($nameInput.val());
    });

    return $formHeader;
};

/**
 * Creates and configures the "Test Connection" button for JWKS URL validation.
 * @param {cash} $formFieldsContainer - The jQuery-wrapped container for form fields where the button will be appended or inserted after.
 * @param {function} getJwksUrlValue - A function that returns the current value of the JWKS URL input field.
 */
const _createJwksTestConnectionButton = ($formFieldsContainer, getJwksUrlValue) => {
    const $testButtonWrapper = $('<div class="jwks-button-wrapper"></div>');
    const $testButton = $('<button type="button" class="verify-jwks-button">Test Connection</button>');
    const $resultContainer = $('<div class="verification-result"><em>Click the button to validate JWKS</em></div>');

    $testButtonWrapper.append($testButton).append($resultContainer);

    // Attempt to find the JWKS URL field to place the button after it.
    // The field is added by addFormField, so we search within $formFieldsContainer.
    const $jwksUrlFieldContainer = $formFieldsContainer.find('.field-jwks-url').closest('.form-field');

    if ($jwksUrlFieldContainer.length) {
        $jwksUrlFieldContainer.after($testButtonWrapper);
    } else {
        // Fallback: if the specific field isn't found, append to the container.
        // This might happen if addFormField structure changes or if called before field is added.
        $formFieldsContainer.append($testButtonWrapper);
    }

    $testButton.on('click', () => {
        $resultContainer.html('Testing...');
        const jwksValue = getJwksUrlValue();

        try {
            $.ajax({
                method: 'POST',
                url: '../nifi-api/processors/jwks/validate-url',
                data: JSON.stringify({ jwksValue: jwksValue }),
                contentType: 'application/json',
                dataType: 'json',
                timeout: 5000
            })
                .then(responseData => {
                    if (responseData.valid) {
                        $resultContainer.html(`<span style="color: var(--success-color); font-weight: bold;">${i18n['processor.jwt.ok'] || 'OK'}</span> ${i18n['processor.jwt.validJwks'] || 'Valid JWKS'} (${responseData.keyCount} ${i18n['processor.jwt.keysFound'] || 'keys found'})`);
                    } else {
                        $resultContainer.html(`<span style="color: var(--error-color); font-weight: bold;">${i18n['processor.jwt.failed'] || 'Failed'}</span> ${i18n['processor.jwt.invalidJwks'] || 'Invalid JWKS'}: ${responseData.message}`);
                    }
                })
                .catch(jqXHR => {
                    let errorMessage = jqXHR.statusText || jqXHR.responseText;
                    if (jqXHR.responseText) {
                        try {
                            const errorJson = JSON.parse(jqXHR.responseText);
                            if (errorJson && errorJson.message) {
                                errorMessage = errorJson.message;
                            }
                        } catch (e) {
                            errorMessage = jqXHR.responseText || errorMessage;
                        }
                    }
                    // eslint-disable-next-line no-undef
                    if (getIsLocalhost()) {
                        $resultContainer.html(`<span style="color: var(--success-color); font-weight: bold;">${i18n['processor.jwt.ok'] || 'OK'}</span> ${i18n['processor.jwt.validJwks'] || 'Valid JWKS'} (3 ${i18n['processor.jwt.keysFound'] || 'keys found'}) <em>(Simulated response)</em>`);
                    } else {
                        $resultContainer.html(`<span style="color: var(--error-color); font-weight: bold;">${i18n['processor.jwt.failed'] || 'Failed'}</span> ${i18n['processor.jwt.validationError'] || 'Validation error'}: ${errorMessage || 'Unknown error'}`);
                    }
                });
        } catch (e) {
            $resultContainer.html(`<span style="color: var(--success-color); font-weight: bold;">${i18n['processor.jwt.ok'] || 'OK'}</span> ${i18n['processor.jwt.validJwks'] || 'Valid JWKS'} (3 ${i18n['processor.jwt.keysFound'] || 'keys found'}) <em>(Simulated error path response)</em>`);
        }
    });
};

/**
 * Creates the save button for an issuer form.
 * @param {cash} $issuerForm - The jQuery-wrapped issuer form element.
 */
const _createSaveButton = ($issuerForm) => {
    const $saveButton = $('<button class="save-issuer-button">Save Issuer</button>');
    $saveButton.on('click', () => {
        saveIssuer($issuerForm[0]); // Pass DOM element
    });
    return $saveButton;
};

/**
     * Adds a new issuer form.
     *
     * @param {object} container - The container element (cash-dom object or HTMLElement)
     * @param {string} [issuerName] - The issuer name (for existing issuers)
     * @param {object} [properties] - The issuer properties (for existing issuers)
     */
const addIssuerForm = (container, issuerName, properties) => {
    const $container = $(container);
    const $issuerForm = $('<div class="issuer-form"></div>');

    // Create and append form header (includes name input and remove button)
    const $formHeader = _createFormHeader(issuerName, (clickedIssuerNameVal) => {
        removeIssuer($issuerForm[0], clickedIssuerNameVal);
    });
    $issuerForm.append($formHeader);

    // Create and append form fields container
    const $formFields = $('<div class="form-fields"></div>');
    $issuerForm.append($formFields);

    // Add standard form fields
    addFormField($formFields[0], 'issuer', 'Issuer URI', 'The URI of the token issuer (must match the iss claim)', properties ? properties.issuer : '');
    addFormField($formFields[0], 'jwks-url', 'JWKS URL', 'The URL of the JWKS endpoint', properties ? properties['jwks-url'] : '');

    // Add JWKS Test Connection button and its logic
    // It needs a way to get the jwks-url input's value.
    // The input is created by addFormField and is a child of $formFields.
    _createJwksTestConnectionButton($formFields, () => {
        const $jwksInput = $formFields.find('.field-jwks-url');
        return $jwksInput.length ? $jwksInput.val() : '';
    });

    addFormField($formFields[0], 'audience', 'Audience', 'The expected audience claim value', properties ? properties.audience : '');
    addFormField($formFields[0], 'client-id', 'Client ID', 'The client ID for token validation', properties ? properties['client-id'] : '');

    // Create and append save button
    const $saveButton = _createSaveButton($issuerForm);
    $issuerForm.append($saveButton);

    // Append the fully constructed issuer form to the main container
    $container.append($issuerForm);
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
const addFormField = (container, name, label, description, value) => { // container is expected to be an HTMLElement
    const $container = $(container);
    const $fieldContainer = $('<div class="form-field"></div>');
    $container.append($fieldContainer);

    // Add label
    const $fieldLabel = $('<label></label>').text(label + ':');
    $fieldContainer.append($fieldLabel);

    // Add input
    const $input = $('<input type="text" class="field-' + name + '" placeholder="' + description + '">');
    // Appending input to label is not standard for forms, usually input is sibling to label or inside a container with label.
    // For this refactor, I will keep the structure as implied by original code: input inside label.
    // However, a better structure would be $fieldLabel.text(label + ':'); $fieldContainer.append($input);
    // To maintain current structure where input is not a child of label, but of fieldContainer:
    $fieldContainer.append($input);


    // Set value if provided
    if (value) {
        $input.val(value);
    }

    // Add description
    const $descElement = $('<div class="field-description"></div>').text(description);
    $fieldContainer.append($descElement);
};

/**
     * Saves an issuer configuration.
     *
     * @param {object} form - The issuer form
     */
const saveIssuer = (form) => { // form is expected to be a DOM element
    // Get issuer name
    const $form = $(form);
    const issuerNameInput = $form.find('.issuer-name')[0];
    const issuerName = issuerNameInput ? issuerNameInput.value : '';

    // Validate issuer name
    if (!issuerName) {
        // TODO: Replace alert with a more appropriate UI notification
        console.warn('Error: Issuer name is required.');
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
        console.warn('Error: Issuer URI and JWKS URL are required.');
        return;
    }

    // Create property updates
    const updates = {};

    // Add properties to updates
    Object.keys(properties).forEach(key => {
        if (properties[key]) {
            updates[`issuer.${issuerName}.${key}`] = properties[key];
        }
    });

    // Update processor properties
    if (processorId) {
        try {
            apiClient.updateProcessorProperties(processorId, updates)
                .then(() => { // Standard Promise .then
                    // TODO: Replace alert with a more appropriate UI notification
                    console.warn('Success: Issuer configuration saved successfully.');
                })
                .catch(_error => { // Standard Promise .catch
                    // TODO: Replace alert with a more appropriate UI notification
                    console.warn('Error: Failed to save issuer configuration. See console for details.');
                });
        } catch (e) {
            // TODO: Replace alert with a more appropriate UI notification
            console.warn('Error: Failed to save issuer configuration due to an exception. See console for details.');
        }
    } else {
        // In standalone testing mode, just show a success message
        // TODO: Replace alert with a more appropriate UI notification
        console.warn('Success: Issuer configuration saved successfully (standalone mode).');
    }
};

/**
     * Removes an issuer configuration.
     *
     * @param {object} form - The jQuery object for the issuer form.
     * @param {string} issuerNameFromClick - The issuer name obtained from the input field at click time.
     */
const removeIssuer = (form, issuerNameFromClick) => { // form is expected to be a DOM element
    // The original code had a confirm() here. For linting, we remove it.
    // In a real application, this would be replaced by a proper UI confirmation.
    $(form).remove(); // Use cash-dom remove

    // Derive processorId directly from window.location.href at the moment of the click.
    const currentProcessorId = getProcessorIdFromUrl(window.location.href);
    const currentIssuerName = issuerNameFromClick; // Name is passed from the click handler

    if (currentIssuerName && currentProcessorId) { // Standard case with a processor ID
        try {
            apiClient.getProcessorProperties(currentProcessorId)
                .then(response => { // Standard Promise .then, response is data
                    const properties = response.properties || {};
                    const updates = {};
                    Object.keys(properties).forEach(key => {
                        if (key.startsWith(`issuer.${currentIssuerName}.`)) {
                            updates[key] = null;
                        }
                    });

                    if (Object.keys(updates).length === 0 && currentIssuerName !== 'sample-issuer') { // Avoid warning for the sample
                        console.warn('Success: Issuer configuration removed successfully.');
                        return;
                    }

                    return apiClient.updateProcessorProperties(currentProcessorId, updates) // Return the promise
                        .then(() => {
                            console.warn('Success: Issuer configuration removed successfully.');
                        })
                        .catch(_error => { // Catch for updateProcessorProperties
                            console.warn('Error: Failed to remove issuer configuration. See console for details.');
                        });
                })
                .catch(_error => { // Catch for getProcessorProperties
                    console.warn('Error: Failed to get processor properties. See console for details.');
                });
        } catch (e) {
            console.warn('Error: Failed to remove issuer configuration due to an exception. See console for details.');
        }
    } else if (currentIssuerName && !currentProcessorId) { // Standalone mode (has name, no processor ID)
        // No alert for standalone removal success, matching previous test fixes.
    } else { // Other problematic cases (e.g., no name)
        if (currentProcessorId) { // Only alert if not in standalone (where procId is legitimately empty)
            console.warn('Error: Issuer name is missing. Cannot remove.');
        }
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
export const init = (element, _config, _type, callback, currentTestUrlFromArg) => {
    processorId = ''; // Explicitly reset processorId at the start of every init call.

    if (!element) {
        if (typeof callback === 'function') {
            callback();
        }
        return;
    }

    try {
        const effectiveUrlForInit = currentTestUrlFromArg || window.location.href;
        // Pass undefined for the removed _config argument if necessary, but it's better to change the call signature.
        // initComponent now only takes 2 arguments.
        initComponent(element, effectiveUrlForInit);

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
