'use strict';

/**
 * Custom UI component for configuring IssuerConfig properties.
 *
 * This component provides a user-friendly interface for creating and managing
 * issuer configurations for the MultiIssuerJWTTokenAuthenticator processor.
 * It handles the complete lifecycle of issuer configurations including creation,
 * validation, editing, and deletion.
 *
 * @fileoverview Issuer configuration editor component for JWT validation
 * @module components/issuerConfigEditor
 * @requires cash-dom
 * @requires nf.Common
 * @requires services/apiClient
 */
// Removed cash-dom dependency - using vanilla JS
import { getI18n } from 'nf.Common';
import * as apiClient from '../services/apiClient.js';
import { displayUiError, displayUiSuccess } from '../utils/uiErrorDisplay.js';
import { confirmRemoveIssuer } from '../utils/confirmationDialog.js';
import { API, COMPONENTS } from '../utils/constants.js';
import { validateIssuerConfig, validateProcessorIdFromUrl } from '../utils/validation.js';
import { FormFieldBuilder } from '../utils/formBuilder.js';
import { ComponentLifecycle } from '../utils/componentCleanup.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('IssuerConfigEditor');

// Get i18n resources from NiFi Common
const i18n = getI18n() || {};

// Component lifecycle manager for cleanup
let componentLifecycle = null;

// Counter for generating unique IDs
let issuerFormCounter = 0;

/**
 * Returns a predefined sample issuer configuration object.
 * This is used for demonstration or as a default when loading fails.
 * @returns {{name: string, properties: object}}
 */
const _getSampleIssuerConfig = () => {
    return {
        name: COMPONENTS.ISSUER_CONFIG_EDITOR.DEFAULT_ISSUER_NAME,
        properties: {
            'issuer': COMPONENTS.ISSUER_CONFIG_EDITOR.SAMPLE_ISSUER_URL,
            'jwks-url': COMPONENTS.ISSUER_CONFIG_EDITOR.SAMPLE_JWKS_URL,
            'audience': COMPONENTS.ISSUER_CONFIG_EDITOR.SAMPLE_AUDIENCE,
            'client-id': COMPONENTS.ISSUER_CONFIG_EDITOR.SAMPLE_CLIENT_ID
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

    return `${_createSuccessMessage(okText)} ${validJwksText} ` +
        `(${keyCount} ${keysFoundText})${simulatedText}`;
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

    const issuerEntries = Object.entries(properties)
        .filter(([key]) => key.startsWith('issuer.'));

    for (const [key, value] of issuerEntries) {
        const parts = key.slice(7).split('.'); // Use slice instead of substring
        if (parts.length === 2) {
            const [issuerName, propertyName] = parts; // Destructuring

            if (!issuerProperties[issuerName]) {
                issuerProperties[issuerName] = {};
            }

            issuerProperties[issuerName][propertyName] = value;
        }
    }

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
    return elementArray?.[0]?.value?.trim() || '';
};

/**
 * Extracts form field values from a form element using direct DOM queries.
 * Simplified from domCache approach for better performance and maintainability.
 *
 * @param {HTMLElement} form - The form element
 * @returns {object} Object containing all form field values
 */
const _extractFormFields = (form) => {
    // Helper function to safely extract field value
    const _extractSingleFieldValue = (selector) => {
        const field = form.querySelector(selector);
        return field ? field.value.trim() : '';
    };

    return {
        issuerName: _extractSingleFieldValue('.issuer-name'),
        issuer: _extractSingleFieldValue('.field-issuer'),
        'jwks-type': _extractSingleFieldValue('.field-jwks-type'),
        'jwks-url': _extractSingleFieldValue('.field-jwks-url'),
        'jwks-file': _extractSingleFieldValue('.field-jwks-file'),
        'jwks-content': _extractSingleFieldValue('.field-jwks-content'),
        audience: _extractSingleFieldValue('.field-audience'),
        'client-id': _extractSingleFieldValue('.field-client-id')
    };
};

/**
 * Finds the global error container for displaying removal errors.
 * Simplified from domCache approach for better performance and maintainability.
 * @returns {HTMLElement|null} The global error container or null if not found
 */
const _findGlobalErrorContainer = () => {
    return document.querySelector('.global-error-messages');
};

/**
 * Creates the basic DOM structure for the issuer config editor.
 * @param {HTMLElement} parentElement The parent element to append the editor to.
 * @returns {{container: HTMLElement, issuersContainer: HTMLElement, globalErrorContainer: HTMLElement}} DOM elements.
 */
const _createEditorStructure = (parentElement) => {
    const container = document.createElement('div');
    container.className = 'issuer-config-editor';
    parentElement.appendChild(container);

    const titleText = i18n['Jwt.Validation.Issuer.Configuration'] || 'Issuer Configurations';
    const title = document.createElement('h2');
    title.textContent = titleText;
    container.appendChild(title);

    const descriptionText = i18n['issuer.config.description'] || 'Configure JWT issuers for token validation. Each issuer requires a name and properties like jwks-url and issuer URI.';
    const description = document.createElement('p');
    description.textContent = descriptionText;
    container.appendChild(description);

    // Add a global error display area
    const globalErrorContainer = document.createElement('div');
    globalErrorContainer.className = 'global-error-messages issuer-form-error-messages';
    globalErrorContainer.style.display = 'none';
    container.appendChild(globalErrorContainer);

    const issuersContainer = document.createElement('div');
    issuersContainer.className = 'issuers-container';
    container.appendChild(issuersContainer);

    return { container, issuersContainer, globalErrorContainer };
};

/**
 * Sets up the "Add Issuer" button and its event listener.
 * @param {HTMLElement} container The main container element for the editor.
 * @param {HTMLElement} issuersContainer The container where issuer forms will be added.
 * @param {string} [processorId] The processor ID for server mode operations.
 */
const _setupAddIssuerButton = (container, issuersContainer, processorId = null) => {
    const addButton = document.createElement('button');
    addButton.className = 'add-issuer-button';
    addButton.textContent = 'Add Issuer';
    container.appendChild(addButton);

    const addButtonHandler = () => {
        const sampleConfig = _getSampleIssuerConfig();
        addIssuerForm(issuersContainer, sampleConfig.name + '-' + Date.now(), sampleConfig.properties, processorId);
    };

    addButton.addEventListener('click', addButtonHandler);
};

/**
 * Initializes editor data, including loading existing issuers for the given processor.
 * @param {string} effectiveUrl The URL used to determine the processor ID.
 * @param {HTMLElement} issuersContainer The container where issuer forms are managed.
 */
const _initializeEditorData = async (effectiveUrl, issuersContainer) => {
    const processorId = getProcessorIdFromUrl(effectiveUrl);
    await loadExistingIssuers(issuersContainer, processorId);

    // HOTFIX: Ensure JWKS dropdowns are added to any existing forms
    // This addresses the issue where dropdowns aren't being created during normal form population
    setTimeout(() => {
        const forms = document.querySelectorAll('.issuer-form');
        let index = 0;
        for (const form of forms) {
            const formFields = form.querySelector('.form-fields');
            const existingDropdown = form.querySelector('.field-jwks-type');

            if (formFields && !existingDropdown) {
                // Create JWKS type dropdown
                const fieldContainer = document.createElement('div');
                fieldContainer.className = 'form-field field-container-jwks-type';

                const labelElement = document.createElement('label');
                labelElement.setAttribute('for', `field-jwks-type-${index}`);
                labelElement.textContent = 'JWKS Source Type:';
                fieldContainer.appendChild(labelElement);

                const selectElement = document.createElement('select');
                selectElement.id = `field-jwks-type-${index}`;
                selectElement.name = 'jwks-type';
                selectElement.setAttribute('aria-label', 'JWKS Type');
                selectElement.className = 'field-jwks-type form-input issuer-config-field';
                selectElement.title = 'Select how JWKS keys should be retrieved for this issuer';

                const options = [
                    { value: 'url', label: 'URL (Remote JWKS endpoint)' },
                    { value: 'file', label: 'File (Local JWKS file)' },
                    { value: 'memory', label: 'Memory (Inline JWKS content)' }
                ];

                for (const option of options) {
                    const optionElement = document.createElement('option');
                    optionElement.value = option.value;
                    optionElement.textContent = option.label;
                    if (option.value === 'url') {
                        optionElement.selected = true;
                    }
                    selectElement.appendChild(optionElement);
                }

                fieldContainer.appendChild(selectElement);

                // Add change handler
                selectElement.addEventListener('change', (e) => {
                    const selectedType = e.target.value;
                    const currentForm = form;

                    // Hide all type-specific fields
                    for (const field of currentForm.querySelectorAll('.jwks-type-url, .jwks-type-file, .jwks-type-memory')) {
                        field.style.display = 'none';
                    }

                    // Show fields for selected type
                    for (const field of currentForm.querySelectorAll(`.jwks-type-${selectedType}`)) {
                        field.style.display = '';
                    }
                });

                // Insert at the beginning of form fields (after issuer name but before other fields)
                const firstFormField = formFields.querySelector('.form-field');
                if (firstFormField) {
                    firstFormField.before(fieldContainer);
                } else {
                    formFields.appendChild(fieldContainer);
                }
            }
            index++;
        }
    }, 100);
};

/**
     * Initializes the component.
     *
     * @param {HTMLElement} element - The DOM element to initialize in
     * @param {string} effectiveUrl - The URL to derive processorId from
     */
const initComponent = async (element, effectiveUrl) => {
    const processorId = getProcessorIdFromUrl(effectiveUrl);
    const { container, issuersContainer } = _createEditorStructure(element);
    _setupAddIssuerButton(container, issuersContainer, processorId);
    await _initializeEditorData(effectiveUrl, issuersContainer);
};

/**
     * Gets the processor ID from the URL using enhanced validation.
     *
     * @param {string} urlToParse - The URL to extract processor ID from
     * @return {string} The processor ID, or empty string if invalid
     */
const getProcessorIdFromUrl = (urlToParse) => {
    const validationResult = validateProcessorIdFromUrl(urlToParse);
    return validationResult.isValid ? validationResult.sanitizedValue : '';
};

/**
     * Loads existing issuer configurations.
     *
     * @param {HTMLElement} container - The container element
     * @param {string} processorId - The processor ID to load configurations for
     */
const loadExistingIssuers = async (container, processorId) => {
    if (!processorId) {
        const sampleConfig = _getSampleIssuerConfig();
        addIssuerForm(container, sampleConfig.name, sampleConfig.properties, processorId);
        return;
    }

    try {
        // Get processor properties using async/await
        const response = await apiClient.getProcessorProperties(processorId);

        // Extract and parse issuer properties using utility function
        const properties = response.properties || {};
        const issuerProperties = _parseIssuerProperties(properties);

        // Create issuer forms for each issuer
        for (const issuerName of Object.keys(issuerProperties)) {
            addIssuerForm(container, issuerName, issuerProperties[issuerName], processorId);
        }
    } catch (error) {
        // eslint-disable-next-line no-console
        console.debug(error);
        const sampleConfig = _getSampleIssuerConfig();
        addIssuerForm(container, sampleConfig.name, sampleConfig.properties, processorId);
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
 * @param {number} index - The index of this issuer form.
 * @returns {HTMLElement} The header element.
 */
const _createFormHeader = (issuerName, onRemove, index = 0) => {
    const formHeader = document.createElement('div');
    formHeader.className = 'form-header';

    const nameLabel = document.createElement('label');
    nameLabel.textContent = 'Issuer Name:';
    const inputId = `issuer-name-${index}`;
    nameLabel.setAttribute('for', inputId);
    formHeader.appendChild(nameLabel);

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.id = inputId;
    nameInput.className = 'issuer-name';
    nameInput.placeholder = 'e.g., keycloak';
    nameInput.title = 'Unique identifier for this issuer configuration. Use alphanumeric characters and hyphens only.';
    nameInput.setAttribute('aria-label', 'Issuer Name');
    formHeader.appendChild(nameInput);

    if (issuerName) {
        nameInput.value = issuerName;
    }

    const removeButton = document.createElement('button');
    removeButton.className = 'remove-issuer-button';
    removeButton.title = 'Delete this issuer configuration';
    removeButton.textContent = 'Remove';
    formHeader.appendChild(removeButton);

    const removeButtonHandler = async () => {
        const issuerNameValue = nameInput.value || 'Unnamed Issuer';

        // Show confirmation dialog
        await confirmRemoveIssuer(issuerNameValue, () => {
            // This callback is called when the user confirms
            onRemove(issuerNameValue);
        });

        // If the user clicked confirm in the dialog, the onConfirm callback
        // has already been executed. No additional action needed here.
    };

    removeButton.addEventListener('click', removeButtonHandler);

    return formHeader;
};

/**
 * Creates the button wrapper and result container for JWKS validation.
 * @returns {{testButtonWrapper: HTMLElement, testButton: HTMLElement, resultContainer: HTMLElement}}
 */
const _createJwksButtonElements = () => {
    const testButtonWrapper = document.createElement('div');
    testButtonWrapper.className = 'jwks-button-wrapper';

    const testButton = document.createElement('button');
    testButton.type = 'button';
    testButton.className = 'verify-jwks-button';
    testButton.title = 'Test connectivity to the JWKS endpoint and verify it returns valid keys';
    testButton.textContent = 'Test Connection';

    const initialResultText = `<em>${i18n['jwksValidator.initialInstructions'] || 'Click the button to validate JWKS'}</em>`;
    const resultContainer = document.createElement('div');
    resultContainer.className = 'verification-result';
    resultContainer.innerHTML = initialResultText;

    testButtonWrapper.appendChild(testButton);
    testButtonWrapper.appendChild(resultContainer);

    return { testButtonWrapper, testButton, resultContainer };
};

/**
 * Positions the JWKS test button relative to the JWKS URL field.
 * @param {HTMLElement} formFieldsContainer - The form fields container
 * @param {HTMLElement} testButtonWrapper - The button wrapper element
 */
const _positionJwksTestButton = (formFieldsContainer, testButtonWrapper) => {
    const jwksUrlField = formFieldsContainer.querySelector('.field-jwks-url');
    const jwksUrlFieldContainer = jwksUrlField ? jwksUrlField.closest('.form-field') : null;

    if (jwksUrlFieldContainer) {
        jwksUrlFieldContainer.after(testButtonWrapper);
    } else {
        // Fallback: append to container if specific field not found
        formFieldsContainer.appendChild(testButtonWrapper);
    }
};

/**
 * Handles JWKS validation response based on environment and response data.
 * @param {HTMLElement} resultContainer - The result display container
 * @param {object} responseData - The AJAX response data
 */
const _handleJwksValidationResponse = (resultContainer, responseData) => {
    if (responseData.valid) {
        resultContainer.innerHTML = _createJwksSuccessMessage(responseData.keyCount);
    } else {
        displayUiError(resultContainer, { responseJSON: responseData }, i18n, 'processor.jwt.invalidJwks');
    }
};

/**
 * Handles JWKS validation errors based on environment.
 * @param {HTMLElement} resultContainer - The result display container
 * @param {object} error - The error object
 * @param {boolean} isAjaxError - Whether this is an AJAX error vs synchronous error
 */
const _handleJwksValidationError = (resultContainer, error, _isAjaxError) => {
    // Always display the actual error (no localhost simulation)
    displayUiError(resultContainer, error, i18n, 'processor.jwt.validationError');
};

/**
 * Performs the JWKS URL validation via fetch API.
 * @param {string} jwksValue - The JWKS URL to validate
 * @param {HTMLElement} resultContainer - The result display container
 */
const _performJwksValidation = (jwksValue, resultContainer) => {
    try {
        // Use fetch API instead of $.ajax
        return fetch(API.ENDPOINTS.JWKS_VALIDATE_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ jwksValue: jwksValue }),
            credentials: 'same-origin'
        })
            .then(response => {
                if (!response.ok) {
                    return response.text().then(text => {
                        const error = new Error(`HTTP ${response.status}: ${response.statusText}`);
                        error.status = response.status;
                        error.statusText = response.statusText;
                        error.responseText = text;
                        try {
                            error.responseJSON = JSON.parse(text);
                        } catch (e) {
                            // Not JSON, that's ok
                        }
                        throw error;
                    });
                }
                return response.json();
            })
            .then(responseData => _handleJwksValidationResponse(resultContainer, responseData))
            .catch(error => _handleJwksValidationError(resultContainer, error, true));
    } catch (e) {
        _handleJwksValidationError(resultContainer, e, false);
        return Promise.reject(e);
    }
};

/**
 * Creates and configures the "Test Connection" button for JWKS URL validation.
 * @param {HTMLElement} formFieldsContainer - The container for form fields where the button will be appended or inserted after.
 * @param {function} getJwksUrlValue - A function that returns the current value of the JWKS URL input field.
 */
const _createJwksTestConnectionButton = (formFieldsContainer, getJwksUrlValue) => {
    const { testButtonWrapper, testButton, resultContainer } = _createJwksButtonElements();

    _positionJwksTestButton(formFieldsContainer, testButtonWrapper);

    const testButtonHandler = () => {
        resultContainer.innerHTML = i18n['processor.jwt.testing'] || 'Testing...';
        const jwksValue = getJwksUrlValue();
        _performJwksValidation(jwksValue, resultContainer);
    };

    testButton.addEventListener('click', testButtonHandler);
};

/**
 * Creates the save button for an issuer form.
 * @param {HTMLElement} issuerForm - The issuer form element.
 * @param {string} [processorId] - The processor ID for server mode saves
 */
const _createSaveButton = (issuerForm, processorId = null) => {
    const tooltipText = processorId
        ? 'Save this issuer configuration to the NiFi processor'
        : 'Validate and save this issuer configuration (standalone mode)';

    const saveButton = document.createElement('button');
    saveButton.className = 'save-issuer-button';
    saveButton.title = tooltipText;
    saveButton.textContent = 'Save Issuer';

    const formErrorContainer = document.createElement('div');
    formErrorContainer.className = 'issuer-form-error-messages';

    const saveButtonHandler = () => {
        formErrorContainer.innerHTML = '';
        saveIssuer(issuerForm, formErrorContainer, processorId);
    };

    saveButton.addEventListener('click', saveButtonHandler);

    issuerForm.appendChild(formErrorContainer);
    return saveButton;
};

/**
 * Creates and populates the form fields for an issuer form.
 * @param {HTMLElement} formFields - The form fields container
 * @param {object} [properties] - The issuer properties for pre-population
 */
const _populateIssuerFormFields = (formFields, properties) => {
    // Add JWKS Type selection field - using direct DOM creation for reliability
    try {
        const fieldContainer = document.createElement('div');
        fieldContainer.className = 'form-field field-container-jwks-type';

        const labelElement = document.createElement('label');
        labelElement.setAttribute('for', 'field-jwks-type');
        labelElement.textContent = 'JWKS Source Type:';
        fieldContainer.appendChild(labelElement);

        const selectElement = document.createElement('select');
        selectElement.id = 'field-jwks-type';
        selectElement.name = 'jwks-type';
        selectElement.className = 'field-jwks-type form-input issuer-config-field';
        selectElement.title = 'Select how JWKS keys should be retrieved for this issuer';
        selectElement.setAttribute('aria-label', 'JWKS Source Type');

        const options = [
            { value: 'url', label: 'URL (Remote JWKS endpoint)' },
            { value: 'file', label: 'File (Local JWKS file)' },
            { value: 'memory', label: 'Memory (Inline JWKS content)' }
        ];

        const selectedValue = properties ? properties['jwks-type'] : 'url';
        for (const option of options) {
            const optionElement = document.createElement('option');
            optionElement.value = option.value;
            optionElement.textContent = option.label;
            if (selectedValue === option.value) {
                optionElement.selected = true;
            }
            selectElement.appendChild(optionElement);
        }

        fieldContainer.appendChild(selectElement);

        // Add change handler to toggle field visibility
        selectElement.addEventListener('change', (e) => {
            const selectedType = e.target.value;
            const form = formFields.closest('.issuer-form') || formFields;

            // Hide all type-specific fields
            for (const field of form.querySelectorAll('.jwks-type-url, .jwks-type-file, .jwks-type-memory')) {
                field.style.display = 'none';
            }

            // Show fields for selected type
            for (const field of form.querySelectorAll(`.jwks-type-${selectedType}`)) {
                field.style.display = '';
            }
        });

        formFields.appendChild(fieldContainer);
    } catch (error) {
        // Error creating JWKS dropdown - silently continue
        logger.debug('JWKS dropdown creation error:', error);
    }

    // Add standard form fields with enhanced tooltips
    addFormField(formFields, 'issuer', 'Issuer URI', 'The URI of the token issuer (must match the iss claim)', properties ? properties.issuer : '', 'This value must exactly match the "iss" claim in JWT tokens. Example: https://auth.example.com/auth/realms/myrealm');

    // Add JWKS URL field (shown for URL type)
    const jwksUrlField = addFormField(formFields, 'jwks-url', 'JWKS URL', 'The URL of the JWKS endpoint', properties ? properties['jwks-url'] : '', 'URL providing public keys for JWT signature verification. Usually ends with /.well-known/jwks.json');
    jwksUrlField.classList.add('jwks-type-url');

    // Add JWKS File field (shown for file type)
    const jwksFileField = addFormField(formFields, 'jwks-file', 'JWKS File Path', 'Path to local JWKS JSON file', properties ? properties['jwks-file'] : '', 'Absolute or relative path to a JSON file containing JWKS keys');
    jwksFileField.classList.add('jwks-type-file');
    jwksFileField.style.display = properties && properties['jwks-type'] === 'file' ? '' : 'none';

    // Add JWKS Content field (shown for memory type)
    const jwksContentField = addTextAreaField(formFields, 'jwks-content', 'JWKS Content', 'Inline JWKS JSON content', properties ? properties['jwks-content'] : '', 'Paste the full JWKS JSON content here', 5);
    jwksContentField.classList.add('jwks-type-memory');
    jwksContentField.style.display = properties && properties['jwks-type'] === 'memory' ? '' : 'none';

    // Add JWKS Test Connection button
    _createJwksTestConnectionButton(formFields, () => {
        const jwksTypeSelect = formFields.querySelector('.field-jwks-type');
        const jwksType = jwksTypeSelect ? jwksTypeSelect.value : 'url';

        switch (jwksType) {
            case 'url': {
                const jwksInput = formFields.querySelector('.field-jwks-url');
                return jwksInput ? jwksInput.value : '';
            }
            case 'file': {
                const jwksFileInput = formFields.querySelector('.field-jwks-file');
                return jwksFileInput ? jwksFileInput.value : '';
            }
            case 'memory': {
                const jwksContentInput = formFields.querySelector('.field-jwks-content');
                return jwksContentInput ? jwksContentInput.value : '';
            }
            default:
                return '';
        }
    });

    addFormField(formFields, 'audience', 'Audience', 'The expected audience claim value', properties ? properties.audience : '', 'Optional: Expected "aud" claim value in JWT tokens. Leave blank to accept any audience.');
    addFormField(formFields, 'client-id', 'Client ID', 'The client ID for token validation', properties ? properties['client-id'] : '', 'Optional: Expected "azp" or "client_id" claim value. Used for additional token validation.');
};

/**
 * Creates the complete issuer form structure with header, fields, and save button.
 * @param {string} [issuerName] - The issuer name for pre-population
 * @param {object} [properties] - The issuer properties for pre-population
 * @param {string} [processorId] - The processor ID for server mode operations
 * @returns {HTMLElement} The constructed issuer form element
 */
const _createCompleteIssuerForm = (issuerName, properties, processorId = null) => {
    const issuerForm = document.createElement('div');
    issuerForm.className = 'issuer-form';

    // Get a unique index for this form
    const formIndex = issuerFormCounter++;

    // Create and append form header
    const formHeader = _createFormHeader(issuerName, (clickedIssuerNameVal) => {
        removeIssuer(issuerForm, clickedIssuerNameVal);
    }, formIndex);
    issuerForm.appendChild(formHeader);

    // Create form fields container
    const formFields = document.createElement('div');
    formFields.className = 'form-fields';
    issuerForm.appendChild(formFields);

    // Populate form fields
    _populateIssuerFormFields(formFields, properties);

    // Create and append save button
    const saveButton = _createSaveButton(issuerForm, processorId);
    issuerForm.appendChild(saveButton);

    return issuerForm;
};

/**
     * Adds a new issuer form.
     *
     * @param {HTMLElement} container - The container element
     * @param {string} [issuerName] - The issuer name (for existing issuers)
     * @param {object} [properties] - The issuer properties (for existing issuers)
     * @param {string} [processorId] - The processor ID for server mode operations
     */
const addIssuerForm = (container, issuerName, properties, processorId = null) => {
    const issuerForm = _createCompleteIssuerForm(issuerName, properties, processorId);
    container.appendChild(issuerForm);
};

/**
     * Adds a form field using the new factory pattern with enhanced validation and styling.
     *
     * @param {HTMLElement} container - The container element
     * @param {string} name - The field name
     * @param {string} label - The field label
     * @param {string} description - The field description
     * @param {string} [value] - The field value
     * @param {string} [helpText] - Tooltip help text for advanced configuration guidance
     */
const addFormField = (container, name, label, description, value, helpText) => {
    const fieldConfig = {
        name,
        label,
        description,
        value: value || '',
        placeholder: description,
        type: 'text',
        required: false,
        cssClass: 'issuer-config-field',
        helpText: helpText || null,
        validation: name === 'jwks-url' || name === 'issuer' ?
            (val) => val?.trim() ? { isValid: true } : { isValid: false, error: 'This field is required' } :
            null
    };

    const fieldElement = FormFieldBuilder.createField(fieldConfig);
    container.appendChild(fieldElement);
    return fieldElement;
};


/**
 * Adds a textarea field to the form.
 *
 * @param {HTMLElement} container - The container element
 * @param {string} name - The field name
 * @param {string} label - The field label
 * @param {string} description - The field description
 * @param {string} [value] - The field value
 * @param {string} [helpText] - Tooltip help text
 * @param {number} [rows=3] - Number of textarea rows
 */
const addTextAreaField = (container, name, label, description, value, helpText, rows = 3) => {
    const fieldConfig = {
        name,
        label,
        description,
        value: value || '',
        placeholder: description,
        type: 'textarea',
        required: false,
        cssClass: 'issuer-config-field',
        helpText: helpText || null,
        attributes: { rows: rows.toString() }
    };

    const fieldElement = FormFieldBuilder.createField(fieldConfig);
    container.appendChild(fieldElement);
    return fieldElement;
};

/**
 * Validates issuer form data with enhanced validation while maintaining backward compatibility.
 * @param {object} formFields - The extracted form field values
 * @returns {{isValid: boolean, error?: Error}} Validation result
 */
const _validateIssuerFormData = (formFields) => {
    const issuerName = formFields.issuerName;

    // Validate issuer name (enhanced)
    if (!issuerName) {
        return {
            isValid: false,
            error: new Error(i18n['issuerConfigEditor.error.issuerNameRequired'] || 'Issuer name is required.')
        };
    }

    // Validate issuer URI is always required
    if (!formFields.issuer) {
        return {
            isValid: false,
            error: new Error(i18n['issuerConfigEditor.error.issuerRequired'] || 'Issuer URI is required.')
        };
    }

    // Validate based on JWKS type
    const jwksType = formFields['jwks-type'] || 'url';
    switch (jwksType) {
        case 'url':
            if (!formFields['jwks-url']) {
                return {
                    isValid: false,
                    error: new Error(i18n['issuerConfigEditor.error.jwksUrlRequired'] || 'JWKS URL is required when using URL source type.')
                };
            }
            break;
        case 'file':
            if (!formFields['jwks-file']) {
                return {
                    isValid: false,
                    error: new Error(i18n['issuerConfigEditor.error.jwksFileRequired'] || 'JWKS file path is required when using file source type.')
                };
            }
            break;
        case 'memory':
            if (!formFields['jwks-content']) {
                return {
                    isValid: false,
                    error: new Error(i18n['issuerConfigEditor.error.jwksContentRequired'] || 'JWKS content is required when using memory source type.')
                };
            }
            break;
    }

    // Optional: Add enhanced validation for URL formats (but don't fail for now)
    // This provides the validation infrastructure while maintaining compatibility
    const enhancedValidation = validateIssuerConfig(formFields);
    if (!enhancedValidation.isValid) {
        // Log enhanced validation errors for debugging, but don't fail the form yet
        // eslint-disable-next-line no-console
        console.debug('Enhanced validation warnings:', enhancedValidation.error);
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
        'jwks-type': formFields['jwks-type'] || 'url',
        issuer: formFields.issuer,
        'jwks-url': formFields['jwks-url'],
        'jwks-file': formFields['jwks-file'],
        'jwks-content': formFields['jwks-content'],
        audience: formFields.audience,
        'client-id': formFields['client-id']
    };

    const updates = {};
    const jwksType = properties['jwks-type'];

    // Always include jwks-type and issuer
    updates[`issuer.${issuerName}.jwks-type`] = jwksType;
    if (properties.issuer) {
        updates[`issuer.${issuerName}.issuer`] = properties.issuer;
    }

    // Include only the relevant JWKS source based on type
    switch (jwksType) {
        case 'url':
            if (properties['jwks-url']) {
                updates[`issuer.${issuerName}.jwks-url`] = properties['jwks-url'];
            }
            break;
        case 'file':
            if (properties['jwks-file']) {
                updates[`issuer.${issuerName}.jwks-file`] = properties['jwks-file'];
            }
            break;
        case 'memory':
            if (properties['jwks-content']) {
                updates[`issuer.${issuerName}.jwks-content`] = properties['jwks-content'];
            }
            break;
    }

    // Include optional properties if present
    if (properties.audience) {
        updates[`issuer.${issuerName}.audience`] = properties.audience;
    }
    if (properties['client-id']) {
        updates[`issuer.${issuerName}.client-id`] = properties['client-id'];
    }

    return updates;
};

/**
 * Handles the server-side save operation for issuer configuration.
 * @param {string} processorId - The processor ID to save to
 * @param {string} issuerName - The issuer name
 * @param {object} updates - The property updates
 * @param {HTMLElement} errorContainer - The error display container
 */
const _saveIssuerToServer = async (processorId, issuerName, updates, errorContainer) => {
    try {
        await apiClient.updateProcessorProperties(processorId, updates);
        displayUiSuccess(errorContainer, i18n['issuerConfigEditor.success.saved'] || 'Issuer configuration saved successfully.');
    } catch (error) {
        displayUiError(errorContainer, error, i18n, 'issuerConfigEditor.error.saveFailedTitle');
    }
};

/**
 * Handles the standalone mode save operation for issuer configuration.
 * @param {HTMLElement} errorContainer - The error display container
 */
const _saveIssuerStandalone = (errorContainer) => {
    displayUiSuccess(errorContainer, i18n['issuerConfigEditor.success.savedStandalone'] || 'Issuer configuration saved successfully (standalone mode).');
};

/**
     * Saves an issuer configuration.
     *
     * @param {HTMLElement} form - The issuer form
     * @param {HTMLElement} errorContainer - The error display container
     * @param {string} [processorId] - The processor ID (optional, for server mode)
     */
const saveIssuer = async (form, errorContainer, processorId = null) => {
    errorContainer.innerHTML = '';

    // Extract and validate form data
    const formFields = _extractFormFields(form);
    const validation = _validateIssuerFormData(formFields);

    if (!validation.isValid) {
        displayUiError(errorContainer, validation.error, i18n, 'issuerConfigEditor.error.title');
        return;
    }

    const issuerName = formFields.issuerName;
    const updates = _createPropertyUpdates(issuerName, formFields);

    // Save based on mode (server vs standalone)
    if (processorId) {
        await _saveIssuerToServer(processorId, issuerName, updates, errorContainer);
    } else {
        _saveIssuerStandalone(errorContainer);
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
    for (const key of Object.keys(properties)) {
        if (key.startsWith(`issuer.${issuerName}.`)) {
            updates[key] = null;
        }
    }
    return updates;
};

/**
 * Displays removal success message in the global error container.
 * @param {HTMLElement} globalErrorContainer - The global error display container
 * @param {string} issuerName - The name of the removed issuer
 * @param {boolean} isStandalone - Whether this is standalone mode
 */
const _displayRemovalSuccess = (globalErrorContainer, issuerName, isStandalone = false) => {
    if (!globalErrorContainer) return;

    const message = isStandalone
        ? `Issuer "${issuerName}" removed (standalone mode).`
        : `Issuer "${issuerName}" removed successfully.`;

    displayUiSuccess(globalErrorContainer, message);
    globalErrorContainer.style.display = 'block';
};

/**
 * Displays removal error message in the global error container.
 * @param {HTMLElement} globalErrorContainer - The global error display container
 * @param {Error|string} error - The error to display
 */
const _displayRemovalError = (globalErrorContainer, error) => {
    if (globalErrorContainer) {
        const errorObj = typeof error === 'string' ? new Error(error) : error;
        displayUiError(globalErrorContainer, errorObj, i18n, 'issuerConfigEditor.error.removeFailedTitle');
        globalErrorContainer.style.display = 'block';
    } else {
        const message = typeof error === 'string' ? error : error.message;
        // eslint-disable-next-line no-console
        console.error('Failed to remove issuer:', message);
    }
};

/**
 * Removes issuer properties from the server.
 * @param {string} processorId - The processor ID
 * @param {string} issuerName - The issuer name to remove
 * @param {HTMLElement} globalErrorContainer - The global error display container
 */
const _removeIssuerFromServer = async (processorId, issuerName, globalErrorContainer) => {
    try {
        const response = await apiClient.getProcessorProperties(processorId);
        const properties = response.properties || {};
        const updates = _createRemovalUpdates(properties, issuerName);

        if (Object.keys(updates).length === 0 && issuerName !== 'sample-issuer') {
            // eslint-disable-next-line no-console
            console.info(`No properties found to remove for issuer: ${issuerName}`);
            return;
        }

        await apiClient.updateProcessorProperties(processorId, updates);
        _displayRemovalSuccess(globalErrorContainer, issuerName, false);
    } catch (error) {
        _displayRemovalError(globalErrorContainer, error);
    }
};

/**
     * Removes an issuer configuration.
     *
     * @param {HTMLElement} form - The issuer form element.
     * @param {string} issuerNameFromClick - The issuer name obtained from the input field at click time.
     */
const removeIssuer = async (form, issuerNameFromClick) => {
    form.remove();

    const processorId = getProcessorIdFromUrl(globalThis.location.href);
    const issuerName = issuerNameFromClick;
    const globalErrorContainer = _findGlobalErrorContainer();

    if (issuerName && processorId) {
        // Server mode: remove from processor properties
        await _removeIssuerFromServer(processorId, issuerName, globalErrorContainer);
    } else if (issuerName && !processorId) {
        // Standalone mode: just show success message
        _displayRemovalSuccess(globalErrorContainer, issuerName, true);
    } else {
        // Handle missing issuer name or processor ID
        const errorMessage = !issuerName
            ? 'Issuer name missing for removal'
            : 'Cannot remove issuer: no processor context found';
        _displayRemovalError(globalErrorContainer, errorMessage);
    }
};

/**
 * Initializes the component.
 *
/**
 * Validates initialization parameters and handles early returns.
 * @param {HTMLElement} element - The DOM element to initialize in
 * @param {Function} callback - The callback function
 * @returns {boolean} True if validation passed, false if early return needed
 */
const _validateInitializationParams = (element, callback) => {
    if (!element) {
        if (typeof callback === 'function') {
            callback();
        }
        return false;
    }
    return true;
};

/**
 * Determines the effective URL for initialization.
 * @returns {string} The effective URL to use for initialization
 */
const _getEffectiveInitUrl = () => {
    return globalThis.location.href;
};

/**
 * Sets up component lifecycle manager for cleanup tracking.
 * @param {string} effectiveUrl - The URL to derive processor ID from
 */
const _setupLifecycleManager = (effectiveUrl) => {
    const processorId = getProcessorIdFromUrl(effectiveUrl);
    const componentId = `issuer-config-editor-${processorId || 'standalone'}`;

    // Initialize lifecycle manager in the background for cleanup tracking
    setTimeout(() => {
        componentLifecycle = new ComponentLifecycle(componentId);
        componentLifecycle.initialize(async () => {
            // Lifecycle manager is ready for tracking cleanup resources
        });
    }, 0);
};

/**
 * Handles callback execution with error safety.
 * @param {Function} callback - The callback function to execute
 */
const _executeCallback = (callback) => {
    if (typeof callback === 'function') {
        callback();
    }
};

/**
 * Initializes the component.
 * @param {HTMLElement} element - The DOM element to initialize in
 * @param {Function} callback - The callback function
 * @param {string} [url] - The URL to derive processor ID from (optional)
 */
export const init = async (element, callback, url = null) => {
    // Validate parameters and handle early returns
    if (!_validateInitializationParams(element, callback)) {
        return;
    }

    try {
        // Determine initialization URL (use provided URL or fallback to window location)
        const effectiveUrlForInit = url || _getEffectiveInitUrl();

        // Setup lifecycle manager for cleanup tracking
        _setupLifecycleManager(effectiveUrlForInit);

        // Initialize component normally - maintain backward compatibility
        await initComponent(element, effectiveUrlForInit);

        // Execute callback on success
        _executeCallback(callback);
    } catch (e) {
        // eslint-disable-next-line no-console
        console.debug(e);
        // Execute callback on error to maintain contract
        _executeCallback(callback);
    }
};

/**
 * Cleanup function to be called when component is being destroyed.
 * This can be called manually or will be called automatically on page unload.
 */
export const cleanup = () => {
    if (componentLifecycle) {
        componentLifecycle.destroy();
        componentLifecycle = null;
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
