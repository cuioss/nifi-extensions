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

// No global state - processorId is passed as parameter where needed

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
 * Creates a success message span with consistent styling.
 * @param {string} message - The success message text
 * @returns {string} HTML string with success message styling
 */
const _createSuccessMessage = (message) => {
    return `<span class="success-message">${message}</span>`;
};

/**
 * Creates a JWKS validation success message.
 * @param {number} keyCount - Number of keys found
 * @param {boolean} isSimulated - Whether this is a simulated response
 * @returns {string} HTML string for JWKS validation success
 */
const _createJwksSuccessMessage = (keyCount, isSimulated = false) => {
    const okText = i18n['processor.jwt.ok'] || 'OK';
    const validJwksText = i18n['processor.jwt.validJwks'] || 'Valid JWKS';
    const keysFoundText = i18n['processor.jwt.keysFound'] || 'keys found';
    const simulatedText = isSimulated ? ' <em>(Simulated response)</em>' : '';

    return `${_createSuccessMessage(okText)} ${validJwksText} (${keyCount} ${keysFoundText})${simulatedText}`;
};

/**
 * Parses processor properties and groups them by issuer name.
 * Extracts properties that start with 'issuer.' and groups them by issuer name.
 *
 * @param {object} properties - Raw processor properties object
 * @returns {object} Object with issuer names as keys and their properties as values
 */
const _parseIssuerProperties = (properties) => {
    const issuerProperties = {};

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

    return issuerProperties;
};

/**
 * Extracts and trims the value from a DOM element array (cash-dom result).
 * Safely handles cases where the element array is empty or undefined.
 *
 * @param {Array} elementArray - Array-like object from cash-dom find() result
 * @returns {string} Trimmed value or empty string if element not found
 */
const _extractFieldValue = (elementArray) => {
    return elementArray && elementArray[0] && elementArray[0].value ? elementArray[0].value.trim() : '';
};

/**
 * Extracts form field values from a cash-dom form object.
 * Uses consistent field extraction pattern for all issuer configuration fields.
 *
 * @param {object} $form - Cash-dom wrapped form element
 * @returns {object} Object containing all form field values
 */
const _extractFormFields = ($form) => {
    return {
        issuerName: _extractFieldValue($form.find('.issuer-name')),
        issuer: _extractFieldValue($form.find('.field-issuer')),
        'jwks-url': _extractFieldValue($form.find('.field-jwks-url')),
        audience: _extractFieldValue($form.find('.field-audience')),
        'client-id': _extractFieldValue($form.find('.field-client-id'))
    };
};

/**
 * Finds the global error container for displaying removal errors.
 * @returns {cash|null} The global error container or null if not found
 */
const _findGlobalErrorContainer = () => {
    const $globalError = $('.global-error-messages');
    return $globalError.length > 0 ? $globalError : null;
};

/**
 * Creates the basic DOM structure for the issuer config editor.
 * @param {object} $parentElement The cash-dom wrapped parent element to append the editor to.
 * @returns {{$container: object, $issuersContainer: object, $globalErrorContainer: object}} Cash-dom wrapped elements.
 */
const _createEditorStructure = ($parentElement) => {
    const $container = $('<div class="issuer-config-editor"></div>');
    $parentElement.append($container);

    const $title = $('<h3>Issuer Configurations</h3>');
    $container.append($title);

    const $description = $('<p>Configure JWT issuers for token validation. Each issuer requires a name and properties like jwks-url and issuer URI.</p>');
    $container.append($description);

    // Add a global error display area
    const $globalErrorContainer = $('<div class="global-error-messages issuer-form-error-messages" style="display: none;"></div>');
    $container.append($globalErrorContainer);

    const $issuersContainer = $('<div class="issuers-container"></div>');
    $container.append($issuersContainer);

    return { $container, $issuersContainer, $globalErrorContainer };
};

/**
 * Sets up the "Add Issuer" button and its event listener.
 * @param {object} $container The cash-dom wrapped main container element for the editor.
 * @param {object} $issuersContainer The cash-dom wrapped container where issuer forms will be added.
 * @param {string} [processorId] The processor ID for server mode operations.
 */
const _setupAddIssuerButton = ($container, $issuersContainer, processorId = null) => {
    const $addButton = $('<button class="add-issuer-button">Add Issuer</button>');
    $container.append($addButton);
    $addButton.on('click', () => {
        const sampleConfig = _getSampleIssuerConfig();
        addIssuerForm($issuersContainer, sampleConfig.name + '-' + Date.now(), sampleConfig.properties, processorId);
    });
};

/**
 * Initializes editor data, including loading existing issuers for the given processor.
 * @param {string} effectiveUrl The URL used to determine the processor ID.
 * @param {object} $issuersContainer The cash-dom wrapped container where issuer forms are managed.
 */
const _initializeEditorData = async (effectiveUrl, $issuersContainer) => {
    const processorId = getProcessorIdFromUrl(effectiveUrl);
    await loadExistingIssuers($issuersContainer, processorId);
};

/**
     * Initializes the component.
     *
     * @param {object} element - The DOM element to initialize in
     * @param {string} effectiveUrl - The URL to derive processorId from
     */
const initComponent = async (element, effectiveUrl) => {
    const $element = $(element);
    const processorId = getProcessorIdFromUrl(effectiveUrl);
    const { $container, $issuersContainer, $globalErrorContainer } = _createEditorStructure($element);
    _setupAddIssuerButton($container, $issuersContainer, processorId);
    await _initializeEditorData(effectiveUrl, $issuersContainer);
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
     * @param {object} $container - The cash-dom wrapped container element
     * @param {string} processorId - The processor ID to load configurations for
     */
const loadExistingIssuers = async ($container, processorId) => {
    if (!processorId) {
        const sampleConfig = _getSampleIssuerConfig();
        addIssuerForm($container, sampleConfig.name, sampleConfig.properties, processorId);
        return;
    }

    try {
        // Get processor properties using async/await
        const response = await apiClient.getProcessorProperties(processorId);

        // Extract and parse issuer properties using utility function
        const properties = response.properties || {};
        const issuerProperties = _parseIssuerProperties(properties);

        // Create issuer forms for each issuer
        Object.keys(issuerProperties).forEach(issuerName => {
            addIssuerForm($container, issuerName, issuerProperties[issuerName], processorId);
        });
    } catch (error) {
        // Fallback to sample configuration on any error
        const sampleConfig = _getSampleIssuerConfig();
        addIssuerForm($container, sampleConfig.name, sampleConfig.properties, processorId);
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
 * Creates the button wrapper and result container for JWKS validation.
 * @returns {{$testButtonWrapper: object, $testButton: object, $resultContainer: object}}
 */
const _createJwksButtonElements = () => {
    const $testButtonWrapper = $('<div class="jwks-button-wrapper"></div>');
    const $testButton = $('<button type="button" class="verify-jwks-button">Test Connection</button>');
    const initialResultText = `<em>${i18n['jwksValidator.initialInstructions'] || 'Click the button to validate JWKS'}</em>`;
    const $resultContainer = $('<div class="verification-result"></div>');
    $resultContainer.html(initialResultText);

    $testButtonWrapper.append($testButton).append($resultContainer);

    return { $testButtonWrapper, $testButton, $resultContainer };
};

/**
 * Positions the JWKS test button relative to the JWKS URL field.
 * @param {object} $formFieldsContainer - The form fields container
 * @param {object} $testButtonWrapper - The button wrapper element
 */
const _positionJwksTestButton = ($formFieldsContainer, $testButtonWrapper) => {
    const $jwksUrlFieldContainer = $formFieldsContainer.find('.field-jwks-url').closest('.form-field');

    if ($jwksUrlFieldContainer.length) {
        $jwksUrlFieldContainer.after($testButtonWrapper);
    } else {
        // Fallback: append to container if specific field not found
        $formFieldsContainer.append($testButtonWrapper);
    }
};

/**
 * Handles JWKS validation response based on environment and response data.
 * @param {object} $resultContainer - The result display container
 * @param {object} responseData - The AJAX response data
 */
const _handleJwksValidationResponse = ($resultContainer, responseData) => {
    if (responseData.valid) {
        $resultContainer.html(_createJwksSuccessMessage(responseData.keyCount));
    } else {
        displayUiError($resultContainer, { responseJSON: responseData }, i18n, 'processor.jwt.invalidJwks');
    }
};

/**
 * Handles JWKS validation errors based on environment.
 * @param {object} $resultContainer - The result display container
 * @param {object} error - The error object
 * @param {boolean} isAjaxError - Whether this is an AJAX error vs synchronous error
 */
const _handleJwksValidationError = ($resultContainer, error, isAjaxError = true) => {
    // eslint-disable-next-line no-undef
    if (getIsLocalhost()) {
        const simulatedMessage = isAjaxError
            ? _createJwksSuccessMessage(3, true)
            : _createJwksSuccessMessage(3, true) + ' <em>(Simulated error path response)</em>';
        $resultContainer.html(simulatedMessage);
    } else {
        displayUiError($resultContainer, error, i18n, 'processor.jwt.validationError');
    }
};

/**
 * Performs the JWKS URL validation via AJAX.
 * @param {string} jwksValue - The JWKS URL to validate
 * @param {object} $resultContainer - The result display container
 */
const _performJwksValidation = (jwksValue, $resultContainer) => {
    try {
        $.ajax({
            method: 'POST',
            url: '../nifi-api/processors/jwks/validate-url',
            data: JSON.stringify({ jwksValue: jwksValue }),
            contentType: 'application/json',
            dataType: 'json',
            timeout: 5000
        })
            .then(responseData => _handleJwksValidationResponse($resultContainer, responseData))
            .catch(jqXHR => _handleJwksValidationError($resultContainer, jqXHR, true));
    } catch (e) {
        _handleJwksValidationError($resultContainer, e, false);
    }
};

/**
 * Creates and configures the "Test Connection" button for JWKS URL validation.
 * @param {cash} $formFieldsContainer - The jQuery-wrapped container for form fields where the button will be appended or inserted after.
 * @param {function} getJwksUrlValue - A function that returns the current value of the JWKS URL input field.
 */
const _createJwksTestConnectionButton = ($formFieldsContainer, getJwksUrlValue) => {
    const { $testButtonWrapper, $testButton, $resultContainer } = _createJwksButtonElements();

    _positionJwksTestButton($formFieldsContainer, $testButtonWrapper);

    $testButton.on('click', () => {
        $resultContainer.html(i18n['processor.jwt.testing'] || 'Testing...');
        const jwksValue = getJwksUrlValue();
        _performJwksValidation(jwksValue, $resultContainer);
    });
};

/**
 * Creates the save button for an issuer form.
 * @param {object} $issuerForm - The cash-dom wrapped issuer form element.
 * @param {string} [processorId] - The processor ID for server mode saves
 */
const _createSaveButton = ($issuerForm, processorId = null) => {
    const $saveButton = $('<button class="save-issuer-button">Save Issuer</button>');
    const $formErrorContainer = $('<div class="issuer-form-error-messages"></div>');

    $saveButton.on('click', () => {
        $formErrorContainer.empty();
        saveIssuer($issuerForm[0], $formErrorContainer, processorId);
    });
    $issuerForm.append($formErrorContainer);
    return $saveButton;
};

/**
 * Creates and populates the form fields for an issuer form.
 * @param {object} $formFields - The cash-dom wrapped form fields container
 * @param {object} [properties] - The issuer properties for pre-population
 */
const _populateIssuerFormFields = ($formFields, properties) => {
    // Add standard form fields
    addFormField($formFields, 'issuer', 'Issuer URI', 'The URI of the token issuer (must match the iss claim)', properties ? properties.issuer : '');
    addFormField($formFields, 'jwks-url', 'JWKS URL', 'The URL of the JWKS endpoint', properties ? properties['jwks-url'] : '');

    // Add JWKS Test Connection button
    _createJwksTestConnectionButton($formFields, () => {
        const $jwksInput = $formFields.find('.field-jwks-url');
        return $jwksInput.length ? $jwksInput.val() : '';
    });

    addFormField($formFields, 'audience', 'Audience', 'The expected audience claim value', properties ? properties.audience : '');
    addFormField($formFields, 'client-id', 'Client ID', 'The client ID for token validation', properties ? properties['client-id'] : '');
};

/**
 * Creates the complete issuer form structure with header, fields, and save button.
 * @param {string} [issuerName] - The issuer name for pre-population
 * @param {object} [properties] - The issuer properties for pre-population
 * @param {string} [processorId] - The processor ID for server mode operations
 * @returns {object} The constructed cash-dom wrapped issuer form element
 */
const _createCompleteIssuerForm = (issuerName, properties, processorId = null) => {
    const $issuerForm = $('<div class="issuer-form"></div>');

    // Create and append form header
    const $formHeader = _createFormHeader(issuerName, (clickedIssuerNameVal) => {
        removeIssuer($issuerForm[0], clickedIssuerNameVal);
    });
    $issuerForm.append($formHeader);

    // Create form fields container
    const $formFields = $('<div class="form-fields"></div>');
    $issuerForm.append($formFields);

    // Populate form fields
    _populateIssuerFormFields($formFields, properties);

    // Create and append save button
    const $saveButton = _createSaveButton($issuerForm, processorId);
    $issuerForm.append($saveButton);

    return $issuerForm;
};

/**
     * Adds a new issuer form.
     *
     * @param {object} $container - The cash-dom wrapped container element
     * @param {string} [issuerName] - The issuer name (for existing issuers)
     * @param {object} [properties] - The issuer properties (for existing issuers)
     * @param {string} [processorId] - The processor ID for server mode operations
     */
const addIssuerForm = ($container, issuerName, properties, processorId = null) => {
    const $issuerForm = _createCompleteIssuerForm(issuerName, properties, processorId);
    $container.append($issuerForm);
};

/**
     * Adds a form field.
     *
     * @param {object} $container - The cash-dom wrapped container element
     * @param {string} name - The field name
     * @param {string} label - The field label
     * @param {string} description - The field description
     * @param {string} [value] - The field value
     */
const addFormField = ($container, name, label, description, value) => {
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
 * Validates issuer form data and returns validation results.
 * @param {object} formFields - The extracted form field values
 * @returns {{isValid: boolean, error?: Error}} Validation result
 */
const _validateIssuerFormData = (formFields) => {
    const issuerName = formFields.issuerName;

    // Validate issuer name
    if (!issuerName) {
        return {
            isValid: false,
            error: new Error(i18n['issuerConfigEditor.error.issuerNameRequired'] || 'Issuer name is required.')
        };
    }

    const properties = {
        issuer: formFields.issuer,
        'jwks-url': formFields['jwks-url'],
        audience: formFields.audience,
        'client-id': formFields['client-id']
    };

    // Validate required properties
    if (!properties.issuer || !properties['jwks-url']) {
        return {
            isValid: false,
            error: new Error(i18n['issuerConfigEditor.error.requiredFields'] || 'Issuer URI and JWKS URL are required.')
        };
    }

    return { isValid: true };
};

/**
 * Creates processor property updates from issuer form data.
 * @param {string} issuerName - The issuer name
 * @param {object} formFields - The extracted form field values
 * @returns {object} The property updates object
 */
const _createPropertyUpdates = (issuerName, formFields) => {
    const properties = {
        issuer: formFields.issuer,
        'jwks-url': formFields['jwks-url'],
        audience: formFields.audience,
        'client-id': formFields['client-id']
    };

    const updates = {};
    Object.keys(properties).forEach(key => {
        if (properties[key]) {
            updates[`issuer.${issuerName}.${key}`] = properties[key];
        }
    });

    return updates;
};

/**
 * Handles the server-side save operation for issuer configuration.
 * @param {string} processorId - The processor ID to save to
 * @param {string} issuerName - The issuer name
 * @param {object} updates - The property updates
 * @param {object} $errorContainer - The error display container
 */
const _saveIssuerToServer = async (processorId, issuerName, updates, $errorContainer) => {
    try {
        await apiClient.updateProcessorProperties(processorId, updates);
        $errorContainer.html(_createSuccessMessage(i18n['issuerConfigEditor.success.saved'] || 'Issuer configuration saved successfully.'));
        setTimeout(() => $errorContainer.empty(), 5000);
    } catch (error) {
        displayUiError($errorContainer, error, i18n, 'issuerConfigEditor.error.saveFailedTitle');
    }
};

/**
 * Handles the standalone mode save operation for issuer configuration.
 * @param {object} $errorContainer - The error display container
 */
const _saveIssuerStandalone = ($errorContainer) => {
    $errorContainer.html(_createSuccessMessage(i18n['issuerConfigEditor.success.savedStandalone'] || 'Issuer configuration saved successfully (standalone mode).'));
    setTimeout(() => $errorContainer.empty(), 5000);
};

/**
     * Saves an issuer configuration.
     *
     * @param {object} form - The issuer form
     * @param {object} $errorContainer - The error display container
     * @param {string} [processorId] - The processor ID (optional, for server mode)
     */
const saveIssuer = async (form, $errorContainer, processorId = null) => {
    $errorContainer.empty();

    // Extract and validate form data
    const $form = $(form);
    const formFields = _extractFormFields($form);
    const validation = _validateIssuerFormData(formFields);

    if (!validation.isValid) {
        displayUiError($errorContainer, validation.error, i18n, 'issuerConfigEditor.error.title');
        return;
    }

    const issuerName = formFields.issuerName;
    const updates = _createPropertyUpdates(issuerName, formFields);

    // Save based on mode (server vs standalone)
    if (processorId) {
        await _saveIssuerToServer(processorId, issuerName, updates, $errorContainer);
    } else {
        _saveIssuerStandalone($errorContainer);
    }
};

/**
 * Creates property updates to remove all properties for a specific issuer.
 * @param {object} properties - The current processor properties
 * @param {string} issuerName - The issuer name to remove
 * @returns {object} Updates object with null values for issuer properties
 */
const _createRemovalUpdates = (properties, issuerName) => {
    const updates = {};
    Object.keys(properties).forEach(key => {
        if (key.startsWith(`issuer.${issuerName}.`)) {
            updates[key] = null;
        }
    });
    return updates;
};

/**
 * Displays removal success message in the global error container.
 * @param {object} $globalErrorContainer - The global error display container
 * @param {string} issuerName - The name of the removed issuer
 * @param {boolean} isStandalone - Whether this is standalone mode
 */
const _displayRemovalSuccess = ($globalErrorContainer, issuerName, isStandalone = false) => {
    if (!$globalErrorContainer) return;

    const message = isStandalone
        ? `Issuer "${issuerName}" removed (standalone mode).`
        : `Issuer "${issuerName}" removed successfully.`;

    $globalErrorContainer.html(_createSuccessMessage(message));
    $globalErrorContainer.show();
    setTimeout(() => {
        $globalErrorContainer.empty();
        $globalErrorContainer.hide();
    }, 3000);
};

/**
 * Displays removal error message in the global error container.
 * @param {object} $globalErrorContainer - The global error display container
 * @param {Error|string} error - The error to display
 */
const _displayRemovalError = ($globalErrorContainer, error) => {
    if ($globalErrorContainer) {
        const errorObj = typeof error === 'string' ? new Error(error) : error;
        displayUiError($globalErrorContainer, errorObj, i18n, 'issuerConfigEditor.error.removeFailedTitle');
        $globalErrorContainer.show();
    } else {
        const message = typeof error === 'string' ? error : error.message;
        console.error('Failed to remove issuer:', message);
    }
};

/**
 * Removes issuer properties from the server.
 * @param {string} processorId - The processor ID
 * @param {string} issuerName - The issuer name to remove
 * @param {object} $globalErrorContainer - The global error display container
 */
const _removeIssuerFromServer = async (processorId, issuerName, $globalErrorContainer) => {
    try {
        const response = await apiClient.getProcessorProperties(processorId);
        const properties = response.properties || {};
        const updates = _createRemovalUpdates(properties, issuerName);

        if (Object.keys(updates).length === 0 && issuerName !== 'sample-issuer') {
            console.info(`No properties found to remove for issuer: ${issuerName}`);
            return;
        }

        await apiClient.updateProcessorProperties(processorId, updates);
        _displayRemovalSuccess($globalErrorContainer, issuerName, false);
    } catch (error) {
        _displayRemovalError($globalErrorContainer, error);
    }
};

/**
     * Removes an issuer configuration.
     *
     * @param {object} form - The jQuery object for the issuer form.
     * @param {string} issuerNameFromClick - The issuer name obtained from the input field at click time.
     */
const removeIssuer = async (form, issuerNameFromClick) => {
    $(form).remove();

    const currentProcessorId = getProcessorIdFromUrl(window.location.href);
    const currentIssuerName = issuerNameFromClick;
    const $globalErrorContainer = _findGlobalErrorContainer();

    if (currentIssuerName && currentProcessorId) {
        // Server mode: remove from processor properties
        await _removeIssuerFromServer(currentProcessorId, currentIssuerName, $globalErrorContainer);
    } else if (currentIssuerName && !currentProcessorId) {
        // Standalone mode: just show success message
        _displayRemovalSuccess($globalErrorContainer, currentIssuerName, true);
    } else {
        // Handle missing issuer name or processor ID
        const errorMessage = !currentIssuerName
            ? 'Issuer name missing for removal'
            : 'Cannot remove issuer: no processor context found';
        _displayRemovalError($globalErrorContainer, errorMessage);
    }
};

/**
 * Initializes the component.
 *
 * @param {HTMLElement} element - The DOM element to initialize in
 * @param {Function} callback - The callback function
 * @param {string} currentTestUrlFromArg - URL for testing purposes (optional)
 */
export const init = async (element, callback, currentTestUrlFromArg) => {
    if (!element) {
        if (typeof callback === 'function') {
            callback();
        }
        return;
    }

    try {
        const effectiveUrlForInit = currentTestUrlFromArg || window.location.href;
        await initComponent(element, effectiveUrlForInit);

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

// Export functions for testing purposes
/* eslint-disable-next-line camelcase */
export const __test_exports = {
    saveIssuer,
    removeIssuer,
    addIssuerForm,
    addFormField,
    getProcessorIdFromUrl,
    _parseIssuerProperties,
    _extractFieldValue,
    _extractFormFields,
    _validateIssuerFormData,
    _createPropertyUpdates,
    _saveIssuerToServer,
    _saveIssuerStandalone,
    _handleJwksValidationResponse,
    _handleJwksValidationError,
    _performJwksValidation
};
