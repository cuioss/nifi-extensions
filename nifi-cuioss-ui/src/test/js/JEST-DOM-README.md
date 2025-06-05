# Using @testing-library/jest-dom for Improved DOM Testing

This document explains how to use the `@testing-library/jest-dom` library to improve DOM testing in the nifi-cuioss-ui project.

## Overview

`@testing-library/jest-dom` provides custom Jest matchers that make it easier to test DOM elements. These matchers are more readable and expressive than traditional Jest assertions, making your tests easier to write and understand.

## Setup

The library has been added as a devDependency in `package.json` and is configured in the Jest setup files via `setup.js`. This means the custom matchers are automatically available in all test files.

## Example Usage

See the `example-jest-dom.test.js` file for examples of how to use the custom matchers. Here are some of the most useful matchers:

### Element State

```javascript
// Check if an element is disabled
expect(element).toBeDisabled();
expect(element).not.toBeDisabled();

// Check if an element is visible
expect(element).toBeVisible();
expect(element).not.toBeVisible();

// Check if an element is in the document
expect(element).toBeInTheDocument();
expect(element).not.toBeInTheDocument();
```

### Element Properties

```javascript
// Check if an element has a specific value
expect(inputElement).toHaveValue('expected value');

// Check if an element has a specific class
expect(element).toHaveClass('expected-class');

// Check if an element has a specific attribute
expect(element).toHaveAttribute('data-testid', 'expected-value');

// Check if an element has specific text content
expect(element).toHaveTextContent('expected text');
expect(element).toHaveTextContent(/regular expression/);
```

## Benefits with jQuery/cash-dom Testing

When testing components that use jQuery or cash-dom, these matchers can be particularly helpful:

1. **More Readable Tests**: The custom matchers make your assertions more readable and expressive.
2. **Better Error Messages**: When tests fail, the error messages are more descriptive and helpful.
3. **Simplified DOM Testing**: The matchers handle many common DOM testing scenarios, reducing the need for complex assertions.

## Integration with Existing Tests

You can gradually adopt these matchers in your existing tests. They work alongside traditional Jest assertions, so you can mix and match as needed.

For example, instead of:

```javascript
expect($element[0].classList.contains('active')).toBe(true);
```

You can write:

```javascript
expect($element[0]).toHaveClass('active');
```

## Recommended Usage

While the current jQuery mocking approach using cash-dom is working well, adding these custom matchers can further improve the testing experience. Consider using them for new tests and gradually refactoring existing tests to use them where appropriate.