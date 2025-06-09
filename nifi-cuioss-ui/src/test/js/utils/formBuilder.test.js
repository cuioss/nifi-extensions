/**
 * Tests for FormFieldFactory - focused on functionality that can be tested
 * without complex DOM mocking.
 */
import {
    FormFieldFactory,
    FormFieldBuilder,
    createFormField,
    createFormButton,
    createFormSection
} from '../../../main/webapp/js/utils/formBuilder.js';
import { CSS } from '../../../main/webapp/js/utils/constants.js';

describe('FormFieldFactory', () => {
    let factory;
    
    beforeEach(() => {
        factory = new FormFieldFactory();
    });

    describe('constructor', () => {
        it('should create factory with default options', () => {
            const factory = new FormFieldFactory();
            expect(factory.defaultOptions).toBeDefined();
            expect(factory.defaultOptions.validationEnabled).toBe(true);
            expect(factory.defaultOptions.containerClass).toBe('form-field');
            expect(factory.defaultOptions.labelSuffix).toBe(':');
            expect(factory.defaultOptions.showDescriptions).toBe(true);
        });

        it('should create factory with custom options', () => {
            const customI18n = { test: 'value' };
            const customCssClasses = { custom: 'class' };
            const factory = new FormFieldFactory({
                i18n: customI18n,
                cssClasses: customCssClasses,
                validationEnabled: false,
                showDescriptions: false
            });
            
            expect(factory.defaultOptions.i18n).toBe(customI18n);
            expect(factory.defaultOptions.cssClasses).toBe(customCssClasses);
            expect(factory.defaultOptions.validationEnabled).toBe(false);
            expect(factory.defaultOptions.containerClass).toBe('form-field');
            expect(factory.defaultOptions.labelSuffix).toBe(':');
            expect(factory.defaultOptions.showDescriptions).toBe(false);
        });

        it('should use default CSS when not provided', () => {
            const factory = new FormFieldFactory();
            expect(factory.defaultOptions.cssClasses).toBe(CSS);
        });

        it('should handle null/undefined options', () => {
            const factory = new FormFieldFactory({
                i18n: null,
                cssClasses: undefined,
                validationEnabled: null,
                showDescriptions: undefined
            });
            
            expect(factory.defaultOptions.i18n).toEqual({});
            expect(factory.defaultOptions.cssClasses).toBe(CSS);
            expect(factory.defaultOptions.validationEnabled).toBe(true);
            expect(factory.defaultOptions.showDescriptions).toBe(true);
        });

        it('should handle boolean conversion for validationEnabled option', () => {
            const factory1 = new FormFieldFactory({ validationEnabled: false });
            expect(factory1.defaultOptions.validationEnabled).toBe(false);
            
            const factory2 = new FormFieldFactory({ validationEnabled: 0 });
            expect(factory2.defaultOptions.validationEnabled).toBe(true); // 0 !== false
            
            const factory3 = new FormFieldFactory({ validationEnabled: 'false' });
            expect(factory3.defaultOptions.validationEnabled).toBe(true);
            
            const factory4 = new FormFieldFactory({ validationEnabled: null });
            expect(factory4.defaultOptions.validationEnabled).toBe(true); // null !== false
        });

        it('should handle boolean conversion for showDescriptions option', () => {
            const factory1 = new FormFieldFactory({ showDescriptions: false });
            expect(factory1.defaultOptions.showDescriptions).toBe(false);
            
            const factory2 = new FormFieldFactory({ showDescriptions: 0 });
            expect(factory2.defaultOptions.showDescriptions).toBe(true); // 0 !== false
            
            const factory3 = new FormFieldFactory({ showDescriptions: 'false' });
            expect(factory3.defaultOptions.showDescriptions).toBe(true);
        });
    });

    describe('validateContainer', () => {
        it('should validate all fields in container', () => {
            const container = document.createElement('div');
            
            // Create inputs with validation functions
            const input1 = document.createElement('input');
            input1.name = 'input1';
            input1._validate = jest.fn(() => ({ isValid: true }));
            
            const input2 = document.createElement('input');
            input2.name = 'input2';
            input2._validate = jest.fn(() => ({ isValid: false, error: 'Invalid input' }));
            
            const input3 = document.createElement('textarea');
            input3.name = 'input3';
            input3._validate = jest.fn(() => ({ isValid: true }));
            
            container.appendChild(input1);
            container.appendChild(input2);
            container.appendChild(input3);
            
            const result = factory.validateContainer(container);
            
            expect(result.isValid).toBe(false);
            expect(result.errors).toHaveLength(1);
            expect(result.errors[0]).toEqual({
                field: 'input2',
                error: 'Invalid input'
            });
            
            expect(input1._validate).toHaveBeenCalled();
            expect(input2._validate).toHaveBeenCalled();
            expect(input3._validate).toHaveBeenCalled();
        });

        it('should return valid when all fields are valid', () => {
            const container = document.createElement('div');
            
            const input1 = document.createElement('input');
            input1.name = 'input1';
            input1._validate = jest.fn(() => ({ isValid: true }));
            
            const input2 = document.createElement('select');
            input2.name = 'input2';
            input2._validate = jest.fn(() => ({ isValid: true }));
            
            container.appendChild(input1);
            container.appendChild(input2);
            
            const result = factory.validateContainer(container);
            
            expect(result.isValid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('should handle inputs without validation', () => {
            const container = document.createElement('div');
            
            const input1 = document.createElement('input');
            input1.name = 'input1';
            // No _validate function
            
            const input2 = document.createElement('input');
            input2.name = 'input2';
            input2._validate = jest.fn(() => ({ isValid: true }));
            
            container.appendChild(input1);
            container.appendChild(input2);
            
            const result = factory.validateContainer(container);
            
            expect(result.isValid).toBe(true);
            expect(result.errors).toHaveLength(0);
            expect(input2._validate).toHaveBeenCalled();
        });

        it('should handle empty container', () => {
            const container = document.createElement('div');
            const result = factory.validateContainer(container);
            
            expect(result.isValid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });
    });

    describe('resetContainer', () => {
        it('should reset all inputs in container', () => {
            const container = document.createElement('div');
            
            const input1 = document.createElement('input');
            input1.value = 'some value';
            input1.classList.add('valid', 'invalid');
            
            const input2 = document.createElement('textarea');
            input2.value = 'some content';
            input2.classList.add('valid');
            
            const select = document.createElement('select');
            select.value = 'option1';
            select.classList.add('invalid');
            
            // Create error containers
            const errorContainer1 = document.createElement('div');
            errorContainer1.className = 'field-error';
            errorContainer1.textContent = 'Error message';
            errorContainer1.classList.remove('hidden');
            
            const fieldContainer1 = document.createElement('div');
            fieldContainer1.appendChild(input1);
            fieldContainer1.appendChild(errorContainer1);
            
            const errorContainer2 = document.createElement('div');
            errorContainer2.className = 'field-error';
            errorContainer2.textContent = 'Another error';
            
            const fieldContainer2 = document.createElement('div');
            fieldContainer2.appendChild(input2);
            fieldContainer2.appendChild(errorContainer2);
            
            container.appendChild(fieldContainer1);
            container.appendChild(fieldContainer2);
            container.appendChild(select);
            
            factory.resetContainer(container);
            
            expect(input1.value).toBe('');
            expect(input1.classList.contains('valid')).toBe(false);
            expect(input1.classList.contains('invalid')).toBe(false);
            
            expect(input2.value).toBe('');
            expect(input2.classList.contains('valid')).toBe(false);
            
            expect(select.value).toBe('');
            expect(select.classList.contains('invalid')).toBe(false);
            
            expect(errorContainer1.classList.contains('hidden')).toBe(true);
            expect(errorContainer1.textContent).toBe('');
            
            expect(errorContainer2.classList.contains('hidden')).toBe(true);
            expect(errorContainer2.textContent).toBe('');
        });

        it('should handle inputs without error containers', () => {
            const container = document.createElement('div');
            
            const input = document.createElement('input');
            input.value = 'test value';
            input.classList.add('valid');
            
            container.appendChild(input);
            
            expect(() => factory.resetContainer(container)).not.toThrow();
            expect(input.value).toBe('');
            expect(input.classList.contains('valid')).toBe(false);
        });

        it('should handle empty container', () => {
            const container = document.createElement('div');
            expect(() => factory.resetContainer(container)).not.toThrow();
        });
    });

    describe('private methods', () => {
        it('should have _attachEventHandlers method', () => {
            expect(typeof factory._attachEventHandlers).toBe('function');
            
            // Test with a real element
            const element = document.createElement('input');
            const handler1 = jest.fn();
            const handler2 = jest.fn();
            
            factory._attachEventHandlers(element, {
                click: handler1,
                blur: handler2,
                invalid: 'not a function', // should be ignored
                focus: null // should be ignored
            });
            
            // Trigger events to verify handlers were attached
            element.click();
            element.dispatchEvent(new Event('blur'));
            
            expect(handler1).toHaveBeenCalled();
            expect(handler2).toHaveBeenCalled();
        });

        it('should have _toggleSection method', () => {
            expect(typeof factory._toggleSection).toBe('function');
            
            // Create a mock section structure
            const section = document.createElement('div');
            const content = document.createElement('div');
            content.className = 'form-section-content';
            const icon = document.createElement('i');
            icon.className = 'fa fa-chevron-down';
            
            section.appendChild(content);
            section.appendChild(icon);
            
            // Test toggle functionality
            factory._toggleSection(section);
            
            expect(content.classList.contains('hidden')).toBe(true);
            expect(icon.classList.contains('fa-chevron-down')).toBe(false);
            expect(icon.classList.contains('fa-chevron-right')).toBe(true);
            
            // Toggle back
            factory._toggleSection(section);
            
            expect(content.classList.contains('hidden')).toBe(false);
            expect(icon.classList.contains('fa-chevron-down')).toBe(true);
            expect(icon.classList.contains('fa-chevron-right')).toBe(false);
        });

        it('should handle validation with function validator', () => {
            const input = document.createElement('input');
            const parent = document.createElement('div');
            const errorContainer = document.createElement('div');
            errorContainer.className = 'field-error';
            parent.appendChild(input);
            parent.appendChild(errorContainer);
            
            const validationFn = jest.fn((value) => {
                return value.length > 0 ? { isValid: true } : { isValid: false, error: 'Required' };
            });
            
            factory._addValidation(input, validationFn);
            
            // Test valid input
            input.value = 'valid value';
            const validResult = input._validate();
            expect(validResult.isValid).toBe(true);
            expect(input.classList.contains('valid')).toBe(true);
            expect(input.classList.contains('invalid')).toBe(false);
            expect(errorContainer.classList.contains('hidden')).toBe(true);
            
            // Test invalid input
            input.value = '';
            const invalidResult = input._validate();
            expect(invalidResult.isValid).toBe(false);
            expect(input.classList.contains('valid')).toBe(false);
            expect(input.classList.contains('invalid')).toBe(true);
            expect(errorContainer.classList.contains('hidden')).toBe(false);
            expect(errorContainer.textContent).toBe('Required');
        });

        it('should handle validation with object validator', () => {
            const input = document.createElement('input');
            const parent = document.createElement('div');
            const errorContainer = document.createElement('div');
            errorContainer.className = 'field-error';
            parent.appendChild(input);
            parent.appendChild(errorContainer);
            
            const validationObj = {
                validate: jest.fn((value) => {
                    return value === 'correct' ? { isValid: true } : { isValid: false, error: 'Wrong value' };
                })
            };
            
            factory._addValidation(input, validationObj);
            
            input.value = 'wrong';
            const result = input._validate();
            
            expect(validationObj.validate).toHaveBeenCalledWith('wrong');
            expect(result.isValid).toBe(false);
            expect(result.error).toBe('Wrong value');
        });

        it('should clear error on input event', () => {
            const input = document.createElement('input');
            const parent = document.createElement('div');
            const errorContainer = document.createElement('div');
            errorContainer.className = 'field-error';
            parent.appendChild(input);
            parent.appendChild(errorContainer);
            
            factory._addValidation(input, () => ({ isValid: false, error: 'Error message' }));
            
            // Make field invalid
            input.value = 'test';
            input._validate();
            expect(input.classList.contains('invalid')).toBe(true);
            expect(errorContainer.classList.contains('hidden')).toBe(false);
            
            // Trigger input event to clear error
            input.dispatchEvent(new Event('input'));
            expect(input.classList.contains('invalid')).toBe(false);
            expect(errorContainer.classList.contains('hidden')).toBe(true);
        });

        it('should handle validation without error message', () => {
            const input = document.createElement('input');
            const parent = document.createElement('div');
            const errorContainer = document.createElement('div');
            errorContainer.className = 'field-error';
            parent.appendChild(input);
            parent.appendChild(errorContainer);
            
            factory._addValidation(input, () => ({ isValid: false }));
            
            input.value = 'test';
            input._validate();
            
            expect(errorContainer.textContent).toBe('Invalid input');
        });

        it('should handle _createFieldContainer method', () => {
            expect(typeof factory._createFieldContainer).toBe('function');
        });

        it('should handle _createLabel method', () => {
            expect(typeof factory._createLabel).toBe('function');
        });

        it('should handle _createInput method', () => {
            expect(typeof factory._createInput).toBe('function');
        });

        it('should handle _createDescription method', () => {
            expect(typeof factory._createDescription).toBe('function');
        });

        it('should handle _createHelpText method', () => {
            expect(typeof factory._createHelpText).toBe('function');
        });

        it('should handle _createErrorContainer method', () => {
            expect(typeof factory._createErrorContainer).toBe('function');
        });
    });

    describe('public methods', () => {
        it('should have createField method', () => {
            expect(typeof factory.createField).toBe('function');
        });

        it('should have createButton method', () => {
            expect(typeof factory.createButton).toBe('function');
        });

        it('should have createSection method', () => {
            expect(typeof factory.createSection).toBe('function');
        });
    });
});

describe('Factory Functions', () => {
    it('should export createFormField function', () => {
        expect(typeof createFormField).toBe('function');
    });

    it('should export createFormButton function', () => {
        expect(typeof createFormButton).toBe('function');
    });

    it('should export createFormSection function', () => {
        expect(typeof createFormSection).toBe('function');
    });
});

describe('FormFieldBuilder Static Methods', () => {
    it('should have createField static method', () => {
        expect(typeof FormFieldBuilder.createField).toBe('function');
    });

    it('should have createButton static method', () => {
        expect(typeof FormFieldBuilder.createButton).toBe('function');
    });

    it('should have createSection static method', () => {
        expect(typeof FormFieldBuilder.createSection).toBe('function');
    });

    it('should create factory instance with custom options', () => {
        const customOptions = { validationEnabled: false };
        const factory = FormFieldBuilder.createFactory(customOptions);
        
        expect(factory).toBeInstanceOf(FormFieldFactory);
        expect(factory.defaultOptions.validationEnabled).toBe(false);
    });
});

describe('Edge Cases and Error Handling', () => {
    it('should handle empty event objects', () => {
        const factory = new FormFieldFactory();
        const element = document.createElement('input');
        
        expect(() => {
            factory._attachEventHandlers(element, {});
        }).not.toThrow();
        
        expect(() => {
            factory._attachEventHandlers(element, null);
        }).toThrow();
    });

    it('should handle toggle section with missing elements', () => {
        const factory = new FormFieldFactory();
        const section = document.createElement('div');
        
        // No content or icon elements
        expect(() => {
            factory._toggleSection(section);
        }).not.toThrow();
    });

    it('should handle blur validation event', () => {
        const factory = new FormFieldFactory();
        const input = document.createElement('input');
        const parent = document.createElement('div');
        const errorContainer = document.createElement('div');
        errorContainer.className = 'field-error';
        parent.appendChild(input);
        parent.appendChild(errorContainer);
        
        const validationFn = jest.fn(() => ({ isValid: true }));
        factory._addValidation(input, validationFn);
        
        // Trigger blur event
        input.dispatchEvent(new Event('blur'));
        expect(validationFn).toHaveBeenCalled();
    });
});