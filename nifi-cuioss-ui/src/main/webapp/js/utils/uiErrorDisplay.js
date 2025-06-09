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
 */
export const displayUiError = ($targetElement, error, i18n, errorTypeKey = 'processor.jwt.validationError') => {
    const messageToDisplay = extractErrorMessage(error, i18n);
    const failPrefix = i18n['processor.jwt.failed'] || 'Failed';
    const errorTypePrefix = i18n[errorTypeKey] || 'Error'; // Default to "Error" if key not found

    const errorHtml =
        `<span style="color: var(--error-color); font-weight: bold;">${failPrefix}</span> ` +
        `${errorTypePrefix}: ${messageToDisplay}`;

    $targetElement.html(errorHtml);
};
