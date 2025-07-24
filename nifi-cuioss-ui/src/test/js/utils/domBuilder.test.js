/**
 * Simple tests for domBuilder utilities - targeting basic functions only
 */
import { createElement, createFragment } from '../../../main/webapp/js/utils/domBuilder.js';

describe('DOM Builder - Simple Coverage Tests', () => {
    it('should create basic element', () => {
        const element = createElement('div');
        expect(element.tagName).toBe('DIV');
    });

    it('should create element with attributes', () => {
        const element = createElement('input', {
            attributes: {
                type: 'text',
                name: 'test'
            }
        });
        expect(element.type).toBe('text');
        expect(element.name).toBe('test');
    });

    it('should create element with CSS class', () => {
        const element = createElement('div', {
            css: 'test-class'
        });
        expect(element.className).toBe('test-class');
    });

    it('should create element with CSS classes array', () => {
        const element = createElement('div', {
            css: ['class1', 'class2']
        });
        expect(element.classList.contains('class1')).toBe(true);
        expect(element.classList.contains('class2')).toBe(true);
    });

    it('should create element with text content', () => {
        const element = createElement('span', {
            text: 'Hello World'
        });
        expect(element.textContent).toBe('Hello World');
    });

    it('should create document fragment', () => {
        const fragment = createFragment();
        expect(fragment).toBeInstanceOf(DocumentFragment);
    });

    it('should handle empty options', () => {
        const element = createElement('div', {});
        expect(element.tagName).toBe('DIV');
    });

    it('should handle no options', () => {
        const element = createElement('div');
        expect(element.tagName).toBe('DIV');
    });

    it('should handle sanitized HTML content', () => {
        const element = createElement('div', {
            html: '<span>Safe HTML</span>',
            sanitized: true
        });
        expect(element.innerHTML).toBe('<span>Safe HTML</span>');
    });

    it('should handle unsanitized HTML content as text', () => {
        const element = createElement('div', {
            html: '<script>alert("bad")</script>',
            sanitized: false
        });
        expect(element.textContent).toBe('<script>alert("bad")</script>');
        expect(element.innerHTML).toBe('&lt;script&gt;alert("bad")&lt;/script&gt;');
    });

    it('should handle HTML content without sanitized flag (defaults to unsafe)', () => {
        const element = createElement('div', {
            html: '<span>Unsafe HTML</span>'
        });
        expect(element.textContent).toBe('<span>Unsafe HTML</span>');
    });

    it('should handle className option', () => {
        const element = createElement('div', {
            className: 'custom-class'
        });
        expect(element.className).toBe('custom-class');
    });

    it('should prioritize className over css when both are provided', () => {
        const element = createElement('div', {
            css: 'css-class',
            className: 'classname-class'
        });
        expect(element.className).toBe('classname-class');
    });

    it('should handle complex CSS array with multiple classes', () => {
        const element = createElement('div', {
            css: ['class1', 'class2', 'class3', 'class4']
        });
        expect(element.classList.contains('class1')).toBe(true);
        expect(element.classList.contains('class2')).toBe(true);
        expect(element.classList.contains('class3')).toBe(true);
        expect(element.classList.contains('class4')).toBe(true);
    });

    it('should handle empty CSS array', () => {
        const element = createElement('div', {
            css: []
        });
        expect(element.className).toBe('');
    });

    it('should handle multiple attributes with various types', () => {
        const element = createElement('input', {
            attributes: {
                'data-test': 'value',
                'aria-label': 'Test input',
                placeholder: 'Enter text',
                required: '',
                disabled: 'disabled'
            }
        });
        expect(element.getAttribute('data-test')).toBe('value');
        expect(element.getAttribute('aria-label')).toBe('Test input');
        expect(element.placeholder).toBe('Enter text');
        expect(element.hasAttribute('required')).toBe(true);
        expect(element.getAttribute('disabled')).toBe('disabled');
    });
});
