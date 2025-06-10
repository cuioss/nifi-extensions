import $ from 'cash-dom'; // Use cash-dom as the base

// Mock jQuery UI methods
$.fn.tooltip = jest.fn().mockImplementation(function (options) {
    this.each(function () {
        this._tooltipOptions = options;
        this.setAttribute('data-tooltip-initialized', 'true');
    });
    return this; // Return jQuery object for chaining
});

// Mock AJAX
// jest-jquery-mock provided a complex deferred object.
// For now, let's start with a simpler mock for $.ajax
// that can be expanded if needed.
$.ajax = jest.fn((options) => {
    const deferred = {
        then: jest.fn(() => {
            // If a success callback is provided in options, simulate its execution
            if (options.success && typeof options.success === 'function') {
                // Simulate async behavior with proper promise error handling
                Promise.resolve()
                    .then(() => options.success({}))
                    .catch(e => {
                        // If error callback is provided, call it
                        if (options.error && typeof options.error === 'function') {
                            options.error(e);
                        }
                    });
            }
            // Allow further chaining if then's callback returns a promise or value
            return deferred;
        }),
        catch: jest.fn(() => deferred), // Basic catch, can be expanded
        always: jest.fn(() => deferred), // Basic always, can be expanded
        done: jest.fn(function (callback) { // Mock for .done()
            if (options.success) {
                Promise.resolve().then(() => callback({}));
            }
            return this;
        }),
        fail: jest.fn(function (callback) { // Mock for .fail()
            if (options.error) {
                Promise.resolve().then(() => callback({}));
            }
            return this;
        }),
        promise: jest.fn(() => deferred)
    };

    // Simulate immediate success for basic cases if success callback is attached via .done()
    // This part might need adjustment based on actual usage patterns in the codebase.
    // For a more robust mock, you might need to manage the deferred state more explicitly.

    return deferred;
});


// It's important to export $ from the original 'jquery' module,
// but since we've augmented it, we don't need to re-export.
// Jest will use this version of $ due to the setup file.
// However, the original idea had 'export default $;'
// Let's stick to the original plan for now.
export default $;
