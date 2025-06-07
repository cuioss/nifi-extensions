/**
 * Utility for displaying standardized error messages in the UI.
 */

const extractErrorMessage = (error, i18n) => {
    let message;

    // Prefer responseJSON if it exists (more structured error from an API)
    if (error && error.responseJSON && error.responseJSON.message) {
        message = error.responseJSON.message;
    } else if (error && error.responseJSON && Array.isArray(error.responseJSON.errors) &&
               error.responseJSON.errors.length > 0) { // Removed trailing space here
        // Handle cases where errors might be an array of messages
        message = error.responseJSON.errors
            .map(err => (typeof err === 'string' ? err : err.msg || 'Error detail missing'))
            .join(', ');
    }

    // Fallback to responseText if responseJSON didn't yield a message
    if (!message && error && error.responseText) {
        try {
            const errorJson = JSON.parse(error.responseText);
            // Check if message property exists (even if it's an empty string), otherwise check for errors array
            if (errorJson && typeof errorJson.message === 'string') {
                message = errorJson.message;
            } else if (errorJson && Array.isArray(errorJson.errors) &&
                       errorJson.errors.length > 0) {
                message = errorJson.errors
                    .map(err => (typeof err === 'string' ? err : err.msg || 'Error detail missing'))
                    .join(', '); // This line might also be long depending on err.msg
            } else {
                message = error.responseText; // Raw responseText if not structured
            }
        } catch (e) {
            // responseText was not JSON, use as is or fallback further
            message = error.responseText;
        }
    }

    // Fallback to statusText for jqXHR objects if still no message
    if (!message && error && error.statusText) {
        message = error.statusText;
    }

    // Fallback for standard Error objects
    if (!message && error && error.message) {
        message = error.message;
    }

    // Final check for problematic messages (null, undefined, empty, "null", "undefined")
    const isNullOrUndefined = message == null;
    const trimmedMsg = isNullOrUndefined ? '' : String(message).trim();
    const lowerCaseMsg = isNullOrUndefined ? '' : String(message).toLowerCase();

    if (isNullOrUndefined || trimmedMsg === '' || lowerCaseMsg === 'null' || lowerCaseMsg === 'undefined') {
        return i18n['processor.jwt.unknownError'] || 'Unknown error'; // Default unknown error
    }
    return message;
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
