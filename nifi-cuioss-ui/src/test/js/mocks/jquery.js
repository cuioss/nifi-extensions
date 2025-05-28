/**
 * Mock implementation of jQuery for testing.
 * Provides simplified versions of jQuery functions used in the code.
 */

// Create a simple jQuery-like function
const $ = function (selector) {
    // If selector is a string that looks like HTML (starts with <), create elements
    if (typeof selector === 'string' && selector.trim().startsWith('<')) {
    // Create a temporary div to hold the HTML
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = selector.trim();

        // Get all child nodes
        const elements = [];
        for (const child of tempDiv.children) {
            elements.push(child);
        }

        return createJQueryObject(elements);
    }

    // If selector is a string, query the DOM
    if (typeof selector === 'string') {
        try {
            const elements = document.querySelectorAll(selector);
            return createJQueryObject(Array.from(elements));
        } catch (e) {
            // Log the error and return empty jQuery object for invalid selectors
            console.warn(`Invalid selector: ${selector}`, e);
            return createJQueryObject([]);
        }
    }

    // If selector is already a DOM element or array of elements
    if (selector instanceof Element || selector instanceof Document) {
        return createJQueryObject([selector]);
    }

    // If selector is a jQuery object, return it
    if (selector?.jquery) {
        return selector;
    }

    // Default to empty jQuery object
    return createJQueryObject([]);
};

// Add the jQuery version
$.fn = $.prototype = {
    jquery: '3.6.0',

    // Basic jQuery methods
    each: function (callback) {
        this.elements.forEach((element, index) => {
            callback.call(element, index, element);
        });
        return this;
    },

    append: function (content) {
        if (typeof content === 'string') {
            this.elements.forEach(element => {
                element.innerHTML += content;
            });
        } else if (content.jquery) {
            this.elements.forEach(element => {
                content.elements.forEach(contentElement => {
                    element.appendChild(contentElement.cloneNode(true));
                });
            });
        } else if (content instanceof Element) {
            this.elements.forEach(element => {
                element.appendChild(content.cloneNode(true));
            });
        }
        return this;
    },

    text: function (text) {
        if (text === undefined) {
            return this.elements.length > 0 ? this.elements[0].textContent : '';
        }
        this.elements.forEach(element => {
            element.textContent = text;
        });
        return this;
    },

    html: function (html) {
        if (html === undefined) {
            return this.elements.length > 0 ? this.elements[0].innerHTML : '';
        }
        this.elements.forEach(element => {
            element.innerHTML = html;
        });
        return this;
    },

    val: function (value) {
        if (value === undefined) {
            return this.elements.length > 0 ? this.elements[0].value : '';
        }
        this.elements.forEach(element => {
            element.value = value;
        });
        return this;
    },

    attr: function (name, value) {
        if (value === undefined) {
            return this.elements.length > 0 ? this.elements[0].getAttribute(name) : null;
        }
        this.elements.forEach(element => {
            element.setAttribute(name, value);
        });
        return this;
    },

    on: function (event, handler) {
        this.elements.forEach(element => {
            element.addEventListener(event, handler);
        });
        return this;
    },

    off: function (event, handler) {
        this.elements.forEach(element => {
            element.removeEventListener(event, handler);
        });
        return this;
    },

    addClass: function (className) {
        this.elements.forEach(element => {
            element.classList.add(className);
        });
        return this;
    },

    removeClass: function (className) {
        this.elements.forEach(element => {
            element.classList.remove(className);
        });
        return this;
    },

    toggle: function (state) {
        this.elements.forEach(element => {
            element.style.display = state ? '' : 'none';
        });
        return this;
    },

    tooltip: function (options) {
    // Mock implementation - just record that tooltip was called
        this.elements.forEach(element => {
            element._tooltipOptions = options;
        });
        return this;
    },

    find: function (selector) {
        const foundElements = [];
        this.elements.forEach(element => {
            const found = element.querySelectorAll(selector);
            foundElements.push(...Array.from(found));
        });
        return createJQueryObject(foundElements);
    },

    trigger: function (eventType) {
        this.elements.forEach(element => {
            const event = new Event(eventType);
            element.dispatchEvent(event);
        });
        return this;
    }
};

// Helper function to create a jQuery-like object
function createJQueryObject(elements) {
    const obj = Object.create($.fn);
    obj.elements = elements;
    obj.length = elements.length;

    // Add array-like indexing
    elements.forEach((element, index) => {
        obj[index] = element;
    });

    return obj;
}

// Mock AJAX functionality
$.ajax = jest.fn().mockImplementation(options => {
    const mockPromise = {
        done: function (callback) {
            this.doneCallback = callback;
            return this;
        },
        fail: function (callback) {
            this.failCallback = callback;
            return this;
        }
    };

    // Store the options for later inspection in tests
    mockPromise.options = options;

    // Return the mock promise
    return mockPromise;
});

// Add ready function
$.ready = jest.fn();
$(document).ready = function (callback) {
    $.ready(callback);
    return this;
};

// Export jQuery
module.exports = $;
