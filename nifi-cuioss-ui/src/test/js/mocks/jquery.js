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

    eq: function (index) {
        if (index < 0) {
            index = this.elements.length + index; // Handle negative indices
        }
        if (index >= 0 && index < this.elements.length) {
            return createJQueryObject([this.elements[index]]);
        }
        return createJQueryObject([]); // Return empty jQuery object if index is out of bounds
    },

    empty: function () {
        this.elements.forEach(element => {
            while (element.firstChild) {
                element.removeChild(element.firstChild);
            }
        });
        return this;
    },

    first: function () {
        if (this.elements.length === 0) {
            return createJQueryObject([]);
        }
        return createJQueryObject([this.elements[0]]);
    },

    last: function () {
        if (this.elements.length === 0) {
            return createJQueryObject([]);
        }
        return createJQueryObject([this.elements[this.elements.length - 1]]);
    },

    after: function (content) {
        this.elements.forEach(element => {
            if (element.parentNode) {
                // Create a temporary container for the new content
                const tempContainer = document.createElement('div');
                if (typeof content === 'string') {
                    // Create elements from HTML string and insert them
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = content;
                    // Insert each new node after the current element, in order
                    Array.from(tempDiv.childNodes).reverse().forEach(newNode => {
                        element.parentNode.insertBefore(newNode, element.nextSibling);
                    });
                } else if (content.jquery) { // content is a jQuery object
                    // Insert elements in reverse order to maintain overall order when using insertBefore with nextSibling
                    content.elements.slice().reverse().forEach(contentEl => {
                        element.parentNode.insertBefore(contentEl, element.nextSibling); // Insert actual element
                    });
                } else if (content instanceof Element) { // content is a raw DOM element
                    element.parentNode.insertBefore(content, element.nextSibling); // Insert actual element
                }
            }
        });
        return this;
    },

    append: function (content) {
        // Logic for append is already corrected to not clone DOM elements/jQuery objects.
        if (typeof content === 'string') {
            this.elements.forEach(element => {
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = content;
                Array.from(tempDiv.childNodes).forEach(childNode => { // Renamed to avoid confusion
                    element.appendChild(childNode);
                });
            });
        } else if (content.jquery) {
            this.elements.forEach(parentElement => {
                content.elements.forEach(contentElement => {
                    parentElement.appendChild(contentElement);
                });
            });
        } else if (content instanceof Element) {
            this.elements.forEach(parentElement => {
                parentElement.appendChild(content);
            });
        }
        return this;
    },

    appendTo: function (target) {
        const targetElements = $(target); // Use the same $ function to get target elements
        targetElements.append(this); // 'this' is the jQuery object being appended
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
            // For input elements, prefer property .value, otherwise fall back to attribute
            if (this.elements.length > 0 && (this.elements[0].nodeName === 'INPUT' || this.elements[0].nodeName === 'TEXTAREA' || this.elements[0].nodeName === 'SELECT')) {
                return this.elements[0].value;
            }
            return this.elements.length > 0 ? this.elements[0].getAttribute('value') : '';
        }
        this.elements.forEach(element => {
            // For input elements, prefer property .value
            if (element.nodeName === 'INPUT' || element.nodeName === 'TEXTAREA' || element.nodeName === 'SELECT') {
                element.value = value;
            }
            element.setAttribute('value', value); // Also set the attribute for querySelectorAll
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
            if (!element._eventHandlers) {
                element._eventHandlers = {};
            }
            if (!element._eventHandlers[event]) {
                element._eventHandlers[event] = [];
            }
            element._eventHandlers[event].push(handler);
        });
        return this;
    },

    off: function (event, handler) {
        this.elements.forEach(element => {
            if (element._eventHandlers && element._eventHandlers[event]) {
                if (handler) {
                    element._eventHandlers[event] = element._eventHandlers[event].filter(h => h !== handler);
                } else {
                    delete element._eventHandlers[event]; // Remove all handlers for this event if no specific handler given
                }
            }
        });
        return this;
    },

    hasClass: function (className) {
        if (!this.elements.length) {
            return false;
        }
        // Check the first element, similar to jQuery's behavior
        return this.elements[0].classList.contains(className);
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

    closest: function (selector) {
        const closestElements = new Set(); // Use a Set to avoid duplicates
        this.elements.forEach(element => {
            let current = element;
            while (current && current !== document) {
                if (current.matches && current.matches(selector)) {
                    closestElements.add(current);
                    break; // Found the closest for this element
                }
                current = current.parentNode;
            }
        });
        return createJQueryObject(Array.from(closestElements));
    },

    next: function () {
        const nextElements = new Set();
        this.elements.forEach(element => {
            if (element.nextElementSibling) {
                nextElements.add(element.nextElementSibling);
            }
        });
        return createJQueryObject(Array.from(nextElements));
    },

    remove: function () {
        this.elements.forEach(element => {
            if (element.parentNode) {
                element.parentNode.removeChild(element);
            }
        });
        return this; // Return empty set or this? jQuery typically returns the removed elements.
        // For mock simplicity, returning 'this' (which is now empty) is okay.
        // Or createJQueryObject([])
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
            if (element._eventHandlers && element._eventHandlers[eventType]) {
                // Create a basic mock event object (jQuery event objects are more complex)
                const mockEvent = {
                    type: eventType,
                    target: element,
                    currentTarget: element,
                    preventDefault: jest.fn(),
                    stopPropagation: jest.fn()
                };
                element._eventHandlers[eventType].forEach(handler => {
                    // In jQuery, 'this' inside the handler is the element
                    handler.call(element); // Simplified: removed mockEvent for now
                });
            }
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

// Add Deferred functionality
$.Deferred = function () {
    const _doneCallbacks = [];
    const _failCallbacks = [];
    let _isResolved = false;
    let _isRejected = false;
    let _resolvedArgs;
    let _rejectedArgs;

    const deferred = {
        resolve: function (...args) {
            if (!_isResolved && !_isRejected) {
                _isResolved = true;
                _resolvedArgs = args;
                _doneCallbacks.forEach(cb => cb(...args));
            }
            return this;
        },
        reject: function (...args) {
            if (!_isResolved && !_isRejected) {
                _isRejected = true;
                _rejectedArgs = args;
                _failCallbacks.forEach(cb => cb(...args));
            }
            return this;
        },
        promise: function () {
            const promiseObj = {
                done: function (cb) {
                    if (_isResolved) {
                        // Execute immediately if already resolved
                        cb(..._resolvedArgs);
                    } else if (!_isRejected) {
                        _doneCallbacks.push(cb);
                    }
                    return promiseObj; // Return the promise itself for chaining
                },
                fail: function (cb) {
                    if (_isRejected) {
                        // Execute immediately if already rejected
                        cb(..._rejectedArgs);
                    } else if (!_isResolved) {
                        _failCallbacks.push(cb);
                    }
                    return promiseObj; // Return the promise itself for chaining
                },
                then: function (doneCb, failCb) { // Basic then
                    if (doneCb) this.done(doneCb);
                    if (failCb) this.fail(failCb);
                    return promiseObj; // Return the promise itself for chaining
                },
                always: function (cb) {
                    this.done(cb);
                    this.fail(cb);
                    return promiseObj; // Return the promise itself for chaining
                }
            };
            return promiseObj;
        }
    };
    return deferred;
};

// Mock AJAX functionality
// This default implementation can be simple, as tests will override behavior
// using mockReturnValue or mockImplementationOnce.
// It should return a basic promise-like structure if not overridden.
$.ajax = jest.fn().mockImplementation(options => {
    const dfd = $.Deferred();
    // In a real test environment, you might want to simulate async behavior
    // or allow tests to explicitly resolve/reject this default promise.
    // For now, returning a pending promise is fine as tests should mock specific responses.
    return dfd.promise();
});


// Add ready function
$.ready = jest.fn();
$(document).ready = jest.fn(function (callback) { // Make this a jest.fn for tracking
    if (typeof callback === 'function') {
        callback(); // Simple immediate execution for tests
    }
    return $(document); // Return a jQuery object wrapping document
});

// Ensure $.fn.ready is also available for chaining on jQuery objects if needed,
// though $(document).ready is the most common pattern.
$.fn.ready = function (callback) {
    if (typeof callback === 'function') {
        callback();
    }
    return this;
};

// Export jQuery
module.exports = $;
