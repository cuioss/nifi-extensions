import $ from 'cash-dom';
import { displayUiError } from 'utils/uiErrorDisplay'; // Assuming this path will be resolved by Jest setup

const mockI18n = {
    'processor.jwt.unknownError': 'Test Unknown Error',
    'processor.jwt.failed': 'Test Failed',
    'processor.jwt.validationError': 'Test Validation Error Type',
    'custom.error.type': 'Test Custom Error Type'
};

describe('displayUiError', () => {
    let $targetElement;

    beforeEach(() => {
        // Create a div and append it to the body to serve as the target
        $targetElement = $('<div id="error-target"></div>');
        $(document.body).append($targetElement);
    });

    afterEach(() => {
        // Clean up the target element
        $targetElement.remove();
    });

    // Helper to get the text content, excluding the "Failed" prefix for easier message checking
    const getErrorMessageText = () => {
        const fullHtml = $targetElement.html();
        const prefixToRemove = `<span style="color: var(--error-color); font-weight: bold;">${mockI18n['processor.jwt.failed']}</span> `;
        const typeAndMessage = fullHtml.replace(prefixToRemove, '');
        // Further remove the type prefix to isolate the core message
        const validationErrorType = `${mockI18n['processor.jwt.validationError']}: `;
        const customErrorType = `${mockI18n['custom.error.type']}: `; // If testing custom types

        if (typeAndMessage.startsWith(validationErrorType)) {
            return typeAndMessage.replace(validationErrorType, '');
        }
        if (typeAndMessage.startsWith(customErrorType)) {
            return typeAndMessage.replace(customErrorType, '');
        }
        // Fallback if prefixes are not as expected (should not happen in these tests)
        return typeAndMessage;
    };


    it('should display error with default error type key', () => {
        const error = { message: 'Test error message' };
        displayUiError($targetElement, error, mockI18n);
        expect($targetElement.html()).toContain(`<span style="color: var(--error-color); font-weight: bold;">${mockI18n['processor.jwt.failed']}</span>`);
        expect($targetElement.html()).toContain(`${mockI18n['processor.jwt.validationError']}: Test error message`);
    });

    it('should display error with custom error type key', () => {
        const error = { message: 'Test error message for custom type' };
        displayUiError($targetElement, error, mockI18n, 'custom.error.type');
        expect($targetElement.html()).toContain(`<span style="color: var(--error-color); font-weight: bold;">${mockI18n['processor.jwt.failed']}</span>`);
        expect($targetElement.html()).toContain(`${mockI18n['custom.error.type']}: Test error message for custom type`);
    });

    it('should use default "Error" if custom errorTypeKey is not in i18n', () => {
        const error = { message: 'Test message' };
        displayUiError($targetElement, error, mockI18n, 'nonexistent.key');
        expect($targetElement.html()).toContain('Error: Test message'); // Default 'Error'
    });


    // Tests for extractErrorMessage logic via displayUiError

    it('P0: should extract message from error.responseJSON.message', () => {
        const error = { responseJSON: { message: 'Error from responseJSON.message' } };
        displayUiError($targetElement, error, mockI18n);
        expect(getErrorMessageText()).toBe('Error from responseJSON.message');
    });

    it('P1a: should extract message from error.responseJSON.errors (array of strings)', () => {
        const error = { responseJSON: { errors: ['First error string', 'Second error string'] } };
        displayUiError($targetElement, error, mockI18n);
        expect(getErrorMessageText()).toBe('First error string, Second error string');
    });

    it('P1b: should extract from error.responseJSON.errors (array of objects, mixed with/without msg)', () => {
        const error = {
            responseJSON: {
                errors: [
                    { msg: 'Error from object msg' },
                    'Error as string in array',
                    { otherProp: 'value' } // No msg property
                ]
            }
        };
        displayUiError($targetElement, error, mockI18n);
        expect(getErrorMessageText()).toBe('Error from object msg, Error as string in array, Error detail missing');
    });

    it('should handle empty error.responseJSON.errors array', () => {
        const error = { responseJSON: { errors: [] }, statusText: 'Fallback status' }; // ensure fallback if errors is empty
        displayUiError($targetElement, error, mockI18n);
        expect(getErrorMessageText()).toBe('Fallback status'); // Should fallback
    });

    it('P2: should use raw responseText if responseJSON has no .message or .errors field (valid JSON)', () => {
        const responseTextPayload = JSON.stringify({ detail: 'Some other JSON structure' });
        const error = { responseText: responseTextPayload };
        displayUiError($targetElement, error, mockI18n);
        expect(getErrorMessageText()).toBe(responseTextPayload);
    });

    it('P2a: (Variation for line 23-24) should extract from error.responseText (JSON with errors array)', () => {
        const error = {
            responseText: JSON.stringify({
                errors: [
                    { msg: 'Error from responseText.errors.msg' },
                    'String in responseText.errors',
                    {} // object without msg
                ]
            })
        };
        displayUiError($targetElement, error, mockI18n);
        expect(getErrorMessageText()).toBe('Error from responseText.errors.msg, String in responseText.errors, Error detail missing');
    });


    it('P3: should use raw responseText if responseText is not valid JSON', () => {
        const error = { responseText: 'This is not JSON, just plain text.' };
        displayUiError($targetElement, error, mockI18n);
        expect(getErrorMessageText()).toBe('This is not JSON, just plain text.');
    });

    it('P4: should use statusText if other fields are missing', () => {
        const error = { statusText: 'Error from statusText' };
        displayUiError($targetElement, error, mockI18n);
        expect(getErrorMessageText()).toBe('Error from statusText');
    });

    it('P5: should use error.message for standard Error objects', () => {
        const error = new Error('Error from standard Error.message');
        displayUiError($targetElement, error, mockI18n);
        expect(getErrorMessageText()).toBe('Error from standard Error.message');
    });

    // P6: Test cases for problematic messages becoming "Unknown error"
    const problematicMessages = [null, undefined, '', 'null', 'undefined'];
    problematicMessages.forEach((msgContent) => {
        it(`P6: should display "Unknown error" if extracted message is "${msgContent}"`, () => {
            // Test with error.message as the source of the problematic content
            const error = { message: msgContent };
            displayUiError($targetElement, error, mockI18n);
            expect(getErrorMessageText()).toBe(mockI18n['processor.jwt.unknownError']);
        });

        it(`P6: should display "Unknown error" if responseText (not JSON) is "${msgContent}"`, () => {
            const error = { responseText: msgContent };
            displayUiError($targetElement, error, mockI18n);
            expect(getErrorMessageText()).toBe(mockI18n['processor.jwt.unknownError']);
        });
    });

    it('P6: should display "Unknown error" if responseJSON.message is empty string', () => {
        const error = { responseJSON: { message: '' } };
        displayUiError($targetElement, error, mockI18n);
        expect(getErrorMessageText()).toBe(mockI18n['processor.jwt.unknownError']);
    });

    it('P6: should display "Unknown error" if responseText (valid JSON, message is empty) ', () => {
        const error = { responseText: JSON.stringify({ message: '' }) };
        displayUiError($targetElement, error, mockI18n);
        expect(getErrorMessageText()).toBe(mockI18n['processor.jwt.unknownError']);
    });
});

describe('extractErrorMessage (direct test for edge cases not easily triggered via displayUiError inputs)', () => {
    // Note: extractErrorMessage is not exported, so this is more of a conceptual test.
    // If it were exported, tests would go here.
    // For now, all paths are expected to be hit via displayUiError.
    // Example: if i18n itself is missing a key like 'processor.jwt.unknownError'
    // This is harder to test without direct access or more complex setup for displayUiError's i18n param.
});
