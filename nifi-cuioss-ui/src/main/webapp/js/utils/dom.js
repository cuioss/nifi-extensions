// utils/dom.js
export const $ = (selector, context = document) => {
  if (!selector) return [];
  
  // Handle HTML strings
  if (typeof selector === 'string' && selector.trim().startsWith('<')) {
    return [createElement(selector)];
  }
  
  // Handle DOM elements or document
  if (selector.nodeType || selector === document) {
    return [selector];
  }
  
  // Handle selectors
  return Array.from(
    typeof selector === 'string'
      ? context.querySelectorAll(selector)
      : selector
  );
};

export const createElement = (html) => {
  const template = document.createElement('template');
  template.innerHTML = html.trim();
  return template.content.firstChild;
};

// DOM manipulation utilities
export const dom = {
  find: (selector, element) => $(selector, element),
  
  addClass: (element, className) => {
    if (!element) return;
    element.classList.add(...className.split(' '));
    return element;
  },
  
  removeClass: (element, className) => {
    if (!element) return;
    element.classList.remove(...className.split(' '));
    return element;
  },
  
  toggleClass: (element, className, force) => {
    if (!element) return;
    element.classList.toggle(className, force);
    return element;
  },
  
  attr: (element, name, value) => {
    if (!element) return;
    if (value === undefined) {
      return element.getAttribute(name);
    }
    element.setAttribute(name, value);
    return element;
  },
  
  removeAttr: (element, name) => {
    if (!element) return;
    element.removeAttribute(name);
    return element;
  },
  
  html: (element, content) => {
    if (!element) return;
    if (content === undefined) {
      return element.innerHTML;
    }
    element.innerHTML = content;
    return element;
  },
  
  text: (element, content) => {
    if (!element) return;
    if (content === undefined) {
      return element.textContent;
    }
    element.textContent = content;
    return element;
  }
};
