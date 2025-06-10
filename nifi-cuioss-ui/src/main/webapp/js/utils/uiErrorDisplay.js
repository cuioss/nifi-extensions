/**
 * Utility for displaying standardized error messages in the UI.
 */

/**
 * Extracts error messages from an errors array and joins them.
 * @param {Array} errors - Array of error objects or strings
 * @returns {string} Joined error messages
 */
const extractErrorsArray = (errors) => {
    return errors
        .map(err => (typeof err === 'string' ? err : err.msg || 'Error detail missing'))
        .join(', ');
};

/**
 * Attempts to extract message from responseJSON structure.
 * @param {Object} responseJSON - The response JSON object
 * @returns {string|null} Extracted message or null if not found
 */
const extractFromResponseJSON = (responseJSON) => {
    if (!responseJSON) return null;

    // Check if message property exists (even if it's an empty string)
    if (typeof responseJSON.message === 'string') {
        return responseJSON.message;
    }

    if (Array.isArray(responseJSON.errors) && responseJSON.errors.length > 0) {
        return extractErrorsArray(responseJSON.errors);
    }

    return null;
};

/**
 * Attempts to parse responseText as JSON and extract error message.
 * @param {string} responseText - The response text to parse
 * @returns {string|null} Extracted message or responseText if parsing fails
 */
const extractFromResponseText = (responseText) => {
    if (!responseText) return null;

    try {
        const errorJson = JSON.parse(responseText);
        const extractedMessage = extractFromResponseJSON(errorJson);

        // If we extracted a message from JSON, return it (could be null)
        // If no message was extracted, fall back to raw responseText
        return extractedMessage !== null ? extractedMessage : responseText;
    } catch (e) {
        console.debug('Failed to parse responseText as JSON:', e);
        return responseText;
    }
};

/**
 * Validates and cleans the extracted message, returning fallback if invalid.
 * @param {any} message - The message to validate
 * @param {Object} i18n - Internationalization object for fallback
 * @returns {string} Valid message or fallback
 */
const validateAndCleanMessage = (message, i18n) => {
    if (message == null) {
        return i18n['processor.jwt.unknownError'] || 'Unknown error';
    }

    const stringMessage = String(message);
    const trimmedMsg = stringMessage.trim();
    const lowerCaseMsg = stringMessage.toLowerCase();

    if (trimmedMsg === '' || lowerCaseMsg === 'null' || lowerCaseMsg === 'undefined') {
        return i18n['processor.jwt.unknownError'] || 'Unknown error';
    }

    return message;
};

const extractErrorMessage = (error, i18n) => {
    if (!error) {
        return i18n['processor.jwt.unknownError'] || 'Unknown error';
    }

    // Try extracting from responseJSON first
    const responseJSONMessage = extractFromResponseJSON(error.responseJSON);
    if (responseJSONMessage) {
        return validateAndCleanMessage(responseJSONMessage, i18n);
    }

    // Try extracting from responseText
    const responseTextMessage = extractFromResponseText(error.responseText);
    if (responseTextMessage) {
        return validateAndCleanMessage(responseTextMessage, i18n);
    }

    // Fallback to other error properties
    const fallbackMessage = error.statusText || error.message;
    return validateAndCleanMessage(fallbackMessage, i18n);
};

/**
 * Displays a standardized error message in the target DOM element.
 * This function is intended for scenarios where an actual error needs to be shown to the user
 * (i.e., not for localhost simulations that show success for errors).
 *
 * @param {object} $targetElement - A cash-dom wrapped element where the error HTML should be set.
 * @param {object|Error} error - The error object (e.g., jqXHR from an AJAX failure, or a standard Error object).
 * @param {object} i18n - The i18n map for localized strings.
 * @param {string} [errorTypeKey='processor.jwt.validationError'] - Optional i18n key for the "error type" prefix.
 * @param options
 */
export const displayUiError = ($targetElement, error, i18n, errorTypeKey = 'processor.jwt.validationError', options = {}) => {
    const { type = 'error', closable = false, autoHide = false } = options;

    const messageToDisplay = extractErrorMessage(error, i18n);
    const errorTypePrefix = i18n[errorTypeKey] || 'Error';

    // Determine error type class
    const errorTypeClass = getErrorTypeClass(type);
    const closableClass = closable ? 'closable' : '';

    // Create close button if needed
    const closeButton = closable ? '<button class="close-error" aria-label="Close error">&times;</button>' : '';

    const errorHtml = `
        <div class="error-message ${errorTypeClass} ${closableClass}">
            <div class="error-content">
                <strong>${errorTypePrefix}:</strong> ${messageToDisplay}
            </div>
            ${closeButton}
        </div>
    `;

    $targetElement.html(errorHtml);

    // Add close button functionality
    if (closable) {
        $targetElement.find('.close-error').on('click', () => {
            $targetElement.find('.error-message').fadeOut(300, function () {
                // Use the element directly instead of $(this)
                this.remove();
            });
        });
    }

    // Auto-hide functionality
    if (autoHide) {
        setTimeout(() => {
            $targetElement.find('.error-message').fadeOut(300, function () {
                // Use the element directly instead of $(this)
                this.remove();
            });
        }, 5000);
    }
};

/**
 * Displays a success message in the UI.
 * @param {object} $targetElement - A cash-dom wrapped element where the success HTML should be set.
 * @param {string} message - The success message to display.
 * @param {Object} [options={}] - Additional options
 * @param {boolean} [options.autoHide=true] - Whether to auto-hide after 5 seconds
 */
export const displayUiSuccess = ($targetElement, message, options = {}) => {
    const { autoHide = true } = options;
    const autoHideClass = autoHide ? 'auto-dismiss' : '';

    const successHtml = `
        <div class="success-message ${autoHideClass}">
            <div class="success-content">${message}</div>
        </div>
    `;

    $targetElement.html(successHtml);

    // Auto-hide functionality
    if (autoHide) {
        setTimeout(() => {
            $targetElement.find('.success-message').remove();
        }, 5000);
    }
};

/**
 * Displays an info message in the UI.
 * @param {object} $targetElement - A cash-dom wrapped element where the info HTML should be set.
 * @param {string} message - The info message to display.
 * @param {Object} [options={}] - Additional options
 * @param {boolean} [options.autoHide=false] - Whether to auto-hide after 5 seconds
 */
export const displayUiInfo = ($targetElement, message, options = {}) => {
    const { autoHide = false } = options;

    const infoHtml = `
        <div class="info-message">
            <div class="info-content">${message}</div>
        </div>
    `;

    $targetElement.html(infoHtml);

    if (autoHide) {
        setTimeout(() => {
            $targetElement.find('.info-message').fadeOut(300, function () {
                // Use the element directly instead of $(this)
                this.remove();
            });
        }, 5000);
    }
};

/**
 * Displays a warning message in the UI.
 * @param {object} $targetElement - A cash-dom wrapped element where the warning HTML should be set.
 * @param {string} message - The warning message to display.
 * @param {Object} [options={}] - Additional options
 * @param {boolean} [options.autoHide=false] - Whether to auto-hide after 5 seconds
 */
export const displayUiWarning = ($targetElement, message, options = {}) => {
    const { autoHide = false } = options;

    const warningHtml = `
        <div class="warning-message">
            <div class="warning-content">${message}</div>
        </div>
    `;

    $targetElement.html(warningHtml);

    if (autoHide) {
        setTimeout(() => {
            $targetElement.find('.warning-message').fadeOut(300, function () {
                // Use the element directly instead of $(this)
                this.remove();
            });
        }, 5000);
    }
};

/**
 * Gets the appropriate CSS class for the error type.
 * @param {string} type - The error type
 * @returns {string} The CSS class name
 */
const getErrorTypeClass = (type) => {
    switch (type) {
        case 'validation':
            return 'validation-error';
        case 'network':
            return 'network-error';
        case 'server':
            return 'server-error';
        default:
            return '';
    }
};
