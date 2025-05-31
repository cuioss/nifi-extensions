const $ = jest.requireActual('jquery');

// Store the original ajax function if needed, though for mocks usually not
// const originalAjax = $.ajax;

// Create a deferred object to be returned by the mock
let mockAjaxDeferred;

$.ajax = jest.fn(() => {
    mockAjaxDeferred = $.Deferred();
    return mockAjaxDeferred.promise();
});

// Helper function to resolve the mock AJAX request
$.ajax.resolve = (response) => {
    if (mockAjaxDeferred) {
        mockAjaxDeferred.resolve(response);
    }
};

// Helper function to reject the mock AJAX request
$.ajax.reject = (error) => {
    if (mockAjaxDeferred) {
        mockAjaxDeferred.reject(error);
    }
};

module.exports = $;
