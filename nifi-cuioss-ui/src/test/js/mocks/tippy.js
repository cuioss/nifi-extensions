// mocks/tippy.js
const mockTippy = jest.fn().mockImplementation((targets, options) => {
    // Handle both array and single element
    const elements = Array.isArray(targets) ? targets : [targets];

    // Record tooltip initialization on elements
    elements.forEach(element => {
        element._tippyOptions = options;
        element.setAttribute('data-tippy-initialized', 'true');
    });

    // Return mock instance API
    return {
        setProps: jest.fn(),
        destroy: jest.fn(),
        setContent: jest.fn(),
        show: jest.fn(),
        hide: jest.fn()
    };
});

// For the test that checks if tooltip functionality is available
mockTippy.isSupported = true;

module.exports = mockTippy;
