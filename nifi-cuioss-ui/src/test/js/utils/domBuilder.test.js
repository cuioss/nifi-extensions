/**
 * Simple tests for domBuilder utilities - targeting basic functions only
 */
import {
    createElement,
    createFragment
} from '../../../main/webapp/js/utils/domBuilder.js';

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
});