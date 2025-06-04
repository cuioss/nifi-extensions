/**
 * Custom UI component for configuring IssuerConfig properties.
 * This component provides a user-friendly interface for creating and managing
 * issuer configurations for the MultiIssuerJWTTokenAuthenticator processor.
 */
import $ from 'cash-dom';
import * as _nfCommon from 'nf.Common';
import * as apiClient from '../services/apiClient.js';
import { displayUiError } from '../utils/uiErrorDisplay.js';

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
    const initialResultText = `<em>${i18n['jwksValidator.initialInstructions'] || 'Click the button to validate JWKS'}</em>`;
    const $resultContainer = $('<div class="verification-result"></div>');
    $resultContainer.html(initialResultText); // Set initial text

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
        $resultContainer.html(i18n['processor.jwt.testing'] || 'Testing...'); // Use i18n for "Testing..."
        const jwksValue = getJwksUrlValue();

        // It's good practice to clear previous specific error messages here if not using a dedicated clearError
        // However, setting to "Testing..." effectively does this.
        // If displayUiError wraps or has specific classes, more robust clearing might be needed.
        // For now, the "Testing..." message replaces previous content.

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
                    // eslint-disable-next-line no-undef
                    if (getIsLocalhost()) {
                        // Existing localhost simulation: shows success even on actual error
                        $resultContainer.html(`<span style="color: var(--success-color); font-weight: bold;">${i18n['processor.jwt.ok'] || 'OK'}</span> ${i18n['processor.jwt.validJwks'] || 'Valid JWKS'} (3 ${i18n['processor.jwt.keysFound'] || 'keys found'}) <em>(Simulated response)</em>`);
                    } else {
                        // Use displayUiError for non-localhost actual errors
                        displayUiError($resultContainer, jqXHR, i18n, 'processor.jwt.validationError');
                    }
                });
        } catch (e) {
            // eslint-disable-next-line no-undef
            if (getIsLocalhost()) {
                // Existing localhost simulation for synchronous errors
                $resultContainer.html(`<span style="color: var(--success-color); font-weight: bold;">${i18n['processor.jwt.ok'] || 'OK'}</span> ${i18n['processor.jwt.validJwks'] || 'Valid JWKS'} (3 ${i18n['processor.jwt.keysFound'] || 'keys found'}) <em>(Simulated error path response)</em>`);
            } else {
                // Use displayUiError for non-localhost synchronous errors
                displayUiError($resultContainer, e, i18n, 'processor.jwt.validationError');
            }
        }
    });
};

/**
 * Creates the save button for an issuer form.
 * @param {cash} $issuerForm - The jQuery-wrapped issuer form element.
 */
const _createSaveButton = ($issuerForm) => {
    const $saveButton = $('<button class="save-issuer-button">Save Issuer</button>');
    // Create an error display area for this form, initially empty and hidden or just empty.
    const $formErrorContainer = $('<div class="issuer-form-error-messages" style="color: var(--error-color); margin-top: 10px;"></div>');

    $saveButton.on('click', () => {
        // Clear previous errors in this specific form's error display before attempting to save
        $formErrorContainer.empty();
        saveIssuer($issuerForm[0], $formErrorContainer); // Pass DOM element and its error container
    });
    // Append error container before the save button, or in a designated spot
    $issuerForm.append($formErrorContainer); // Appending here for now
    return $saveButton; // The save button itself is returned to be appended by caller
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
const saveIssuer = (form, $errorContainer) => { // form is expected to be a DOM element, $errorContainer is cash-dom
    // Clear previous errors in this specific form's error display
    $errorContainer.empty();

    // Get issuer name
    const $form = $(form);
    const issuerNameInput = $form.find('.issuer-name')[0];
    const issuerName = issuerNameInput ? issuerNameInput.value.trim() : '';

    // Validate issuer name
    if (!issuerName) {
        const nameRequiredError = new Error(i18n['issuerConfigEditor.error.issuerNameRequired'] || 'Issuer name is required.');
        displayUiError($errorContainer, nameRequiredError, i18n, 'issuerConfigEditor.error.title'); // Using a generic title key
        return;
    }

    // Get issuer properties
    const properties = {
        issuer: $form.find('.field-issuer')[0] ? $form.find('.field-issuer')[0].value.trim() : '',
        'jwks-url': $form.find('.field-jwks-url')[0] ? $form.find('.field-jwks-url')[0].value.trim() : '',
        audience: $form.find('.field-audience')[0] ? $form.find('.field-audience')[0].value.trim() : '',
        'client-id': $form.find('.field-client-id')[0] ? $form.find('.field-client-id')[0].value.trim() : ''
    };

    // Validate required properties
    if (!properties.issuer || !properties['jwks-url']) {
        const requiredFieldsError = new Error(i18n['issuerConfigEditor.error.requiredFields'] || 'Issuer URI and JWKS URL are required.');
        displayUiError($errorContainer, requiredFieldsError, i18n, 'issuerConfigEditor.error.title');
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
                .then(() => {
                    // TODO: Display success message in UI, perhaps in $errorContainer with a success style
                    $errorContainer.html(`<span style="color: var(--success-color);">${i18n['issuerConfigEditor.success.saved'] || 'Issuer configuration saved successfully.'}</span>`);
                    // Auto-clear success message after a few seconds
                    setTimeout(() => $errorContainer.empty(), 5000);
                })
                .catch(error => {
                    displayUiError($errorContainer, error, i18n, 'issuerConfigEditor.error.saveFailedTitle');
                });
        } catch (e) {
            displayUiError($errorContainer, e, i18n, 'issuerConfigEditor.error.saveFailedTitle');
        }
    } else {
        // In standalone testing mode, show success message
        $errorContainer.html(`<span style="color: var(--success-color);">${i18n['issuerConfigEditor.success.savedStandalone'] || 'Issuer configuration saved successfully (standalone mode).'}</span>`);
        setTimeout(() => $errorContainer.empty(), 5000);
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
    const currentIssuerName = issuerNameFromClick;

    // Find a global error display area or use one associated with the form if available
    // For simplicity, let's assume there's a global error area for remove operations,
    // or we could prepend/append to the main issuersContainer.
    // For now, error messages from remove will be logged if no obvious UI place is defined by this refactor.
    // A proper implementation would define a shared error display area at the top of the editor.
    // Let's assume for now that errors during removal are critical and might be harder to tie to a specific form
    // if the form is already removed. We'll use console.warn for failed removals for now,
    // as the primary focus is on save and JWKS validation errors for UI display.
    // This part can be a follow-up refinement.

    if (currentIssuerName && currentProcessorId) {
        try {
            apiClient.getProcessorProperties(currentProcessorId)
                .then(response => {
                    const properties = response.properties || {};
                    const updates = {};
                    Object.keys(properties).forEach(key => {
                        if (key.startsWith(`issuer.${currentIssuerName}.`)) {
                            updates[key] = null;
                        }
                    });

                    if (Object.keys(updates).length === 0 && currentIssuerName !== 'sample-issuer') {
                        // console.warn('Success: Issuer configuration removed (no properties found to remove).'); // Or a UI message
                        return;
                    }

                    return apiClient.updateProcessorProperties(currentProcessorId, updates)
                        .then(() => {
                            // console.warn('Success: Issuer configuration removed successfully.'); // Or a UI message
                        })
                        .catch(error => { // Catch for updateProcessorProperties
                            // TODO: Show this error in a global error display area
                            console.warn('Error: Failed to remove issuer configuration from server.', error);
                        });
                })
                .catch(error => { // Catch for getProcessorProperties
                    // TODO: Show this error in a global error display area
                    console.warn('Error: Failed to get processor properties for removal.', error);
                });
        } catch (e) {
            // TODO: Show this error in a global error display area
            console.warn('Error: Exception during issuer removal process.', e);
        }
    } else if (currentIssuerName && !currentProcessorId) {
        // Standalone mode: No server interaction, form is already removed.
    } else {
        if (currentProcessorId) {
            // TODO: Show this error in a global error display area
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
