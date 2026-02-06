/**
 * Coverage-focused tests for domBuilder utility functions.
 * These tests target the most used functions to achieve 80% coverage target.
 */
import {
    createElement,
    createFragment,
    DOMBuilder,
    DOMUtils,
    FormFieldBuilder
} from '../../../main/webapp/js/utils/domBuilder.js';

describe('DOMBuilder Coverage Tests', () => {
    describe('createElement', () => {
        it('should create basic element', () => {
            const element = createElement('div');
            expect(element.tagName).toBe('DIV');
        });

        it('should create element with attributes', () => {
            const element = createElement('input', {
                attributes: { type: 'text', id: 'test' }
            });
            expect(element.getAttribute('type')).toBe('text');
            expect(element.getAttribute('id')).toBe('test');
        });

        it('should create element with CSS classes array', () => {
            const element = createElement('div', {
                css: ['class1', 'class2']
            });
            expect(element.classList.contains('class1')).toBe(true);
            expect(element.classList.contains('class2')).toBe(true);
        });

        it('should create element with CSS string', () => {
            const element = createElement('div', {
                css: 'test-class'
            });
            expect(element.className).toBe('test-class');
        });

        it('should create element with text content', () => {
            const element = createElement('span', {
                text: 'Hello World'
            });
            expect(element.textContent).toBe('Hello World');
        });

        it('should create element with HTML content (secure default)', () => {
            const element = createElement('div', {
                html: '<strong>Bold</strong>'
            });
            // Security: HTML is treated as text by default unless explicitly sanitized
            expect(element.innerHTML).toBe('&lt;strong&gt;Bold&lt;/strong&gt;');
        });

        it('should create element with trusted HTML content', () => {
            const element = createElement('div', {
                html: '<strong>Bold</strong>',
                trustedHtml: true
            });
            expect(element.innerHTML).toBe('<strong>Bold</strong>');
        });

        it('should create element with event listeners', () => {
            const clickHandler = jest.fn();
            const element = createElement('button', {
                events: { click: clickHandler }
            });
            element.click();
            expect(clickHandler).toHaveBeenCalled();
        });

        it('should create element with child elements', () => {
            const child1 = createElement('span', { text: 'Child 1' });
            const element = createElement('div', {
                children: [child1, 'Text child']
            });
            expect(element.children.length).toBe(1);
            expect(element.textContent).toContain('Child 1');
            expect(element.textContent).toContain('Text child');
        });
    });

    describe('createFragment', () => {
        it('should create document fragment', () => {
            const fragment = createFragment();
            expect(fragment instanceof DocumentFragment).toBe(true);
        });
    });

    describe('DOMBuilder', () => {
        it('should build elements with method chaining', () => {
            const builder = new DOMBuilder();
            const elements = builder
                .addElement('div', { text: 'Test' })
                .addText('Some text')
                .all();

            expect(elements.length).toBe(1);
            expect(elements[0].textContent).toBe('Test');
        });

        it('should add existing element', () => {
            const builder = new DOMBuilder();
            const existingElement = createElement('span', { text: 'Existing' });

            builder.addExisting(existingElement);
            const fragment = builder.build();

            expect(fragment.childNodes.length).toBe(1);
        });

        it('should append to parent element', () => {
            const parent = createElement('div');
            const builder = new DOMBuilder();

            builder.addElement('span', { text: 'Child' });
            const elements = builder.appendTo(parent);

            expect(parent.children.length).toBe(1);
            expect(elements.length).toBe(1);
        });

        it('should get first and last elements', () => {
            const builder = new DOMBuilder();
            builder
                .addElement('div', { text: 'First' })
                .addElement('span', { text: 'Last' });

            expect(builder.first().textContent).toBe('First');
            expect(builder.last().textContent).toBe('Last');
        });

        it('should handle empty builder', () => {
            const builder = new DOMBuilder();
            expect(builder.first()).toBeNull();
            expect(builder.last()).toBeNull();
        });
    });

    describe('FormFieldBuilder', () => {
        it('should create complete form field', () => {
            const fragment = FormFieldBuilder.createField({
                name: 'test',
                label: 'Test Field',
                description: 'Test description',
                value: 'initial value'
            });

            const container = fragment.firstElementChild;
            expect(container.classList.contains('form-field')).toBe(true);

            const input = container.querySelector('input');
            expect(input.value).toBe('initial value');
            expect(input.classList.contains('field-test')).toBe(true);
        });

        it('should create field with custom type', () => {
            const fragment = FormFieldBuilder.createField({
                name: 'email',
                label: 'Email',
                description: 'Enter email',
                type: 'email'
            });

            const input = fragment.querySelector('input');
            expect(input.type).toBe('email');
        });

        it('should create multiple fields', () => {
            const configs = [
                { name: 'field1', label: 'Field 1', description: 'Desc 1' },
                { name: 'field2', label: 'Field 2', description: 'Desc 2' }
            ];

            const fragment = FormFieldBuilder.createFields(configs);
            expect(fragment.childNodes.length).toBe(2);
        });
    });

    describe('DOMUtils', () => {
        it('should clear children from element', () => {
            const parent = createElement('div');
            parent.appendChild(createElement('span'));
            parent.appendChild(createElement('div'));

            expect(parent.children.length).toBe(2);
            DOMUtils.clearChildren(parent);
            expect(parent.children.length).toBe(0);
        });

        it('should replace content with fragment', () => {
            const parent = createElement('div');
            parent.appendChild(createElement('span', { text: 'Old' }));

            const newFragment = createFragment();
            newFragment.appendChild(createElement('div', { text: 'New' }));

            DOMUtils.replaceContent(parent, newFragment);
            expect(parent.textContent).toBe('New');
        });

        it('should replace content with element', () => {
            const parent = createElement('div');
            const newElement = createElement('span', { text: 'Replaced' });

            DOMUtils.replaceContent(parent, newElement);
            expect(parent.textContent).toBe('Replaced');
        });

        it('should replace content with array', () => {
            const parent = createElement('div');
            const newContent = [
                createElement('span', { text: 'Item 1' }),
                'Text item'
            ];

            DOMUtils.replaceContent(parent, newContent);
            expect(parent.textContent).toContain('Item 1');
            expect(parent.textContent).toContain('Text item');
        });

        it('should append multiple elements', () => {
            const parent = createElement('div');
            const configs = [
                'Simple text',
                { tag: 'span', options: { text: 'Span element' } }
            ];

            const elements = DOMUtils.appendMultiple(parent, configs);
            expect(parent.children.length).toBe(2);
            expect(elements.length).toBe(2);
        });
    });
});
