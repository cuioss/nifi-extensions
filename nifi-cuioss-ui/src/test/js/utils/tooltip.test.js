/**
 * Tests for the tooltip utility functions.
 */

import { initTooltips } from '../../../main/webapp/js/utils/tooltip';
import tippy from 'tippy.js';

// Mock dependencies
jest.mock('tippy.js', () => {
    const mockTippy = jest.fn().mockImplementation((elements, options) => {
        if (!elements || elements.length === 0) {
            return null;
        }
        return elements.map(() => ({
            destroy: jest.fn(),
            setContent: jest.fn(),
            setProps: jest.fn()
        }));
    });
    return mockTippy;
});

jest.mock('nf.Common', () => ({
    logError: jest.fn()
}));

describe('tooltip utility', () => {
    let container;

    beforeEach(() => {
    // Reset mocks
        jest.clearAllMocks();

        // Set up DOM elements for testing
        container = document.createElement('div');
        document.body.appendChild(container);

        // Add some elements with data-tooltip attributes
        const button1 = document.createElement('button');
        button1.setAttribute('data-tooltip', 'Tooltip 1');
        button1.textContent = 'Button 1';
        container.appendChild(button1);

        const button2 = document.createElement('button');
        button2.setAttribute('data-tooltip', 'Tooltip 2');
        button2.textContent = 'Button 2';
        container.appendChild(button2);
    });

    afterEach(() => {
    // Clean up
        if (container && container.parentNode) {
            container.parentNode.removeChild(container);
        }
    });

    describe('initTooltips', () => {
        it('should initialize tooltips with default options', () => {
            // Reset mock to track new calls
            tippy.mockClear();

            // Mock implementation for this test to return a non-null value
            tippy.mockImplementationOnce((elements, options) => {
                return [{
                    destroy: jest.fn(),
                    setContent: jest.fn(),
                    setProps: jest.fn()
                }];
            });

            const result = initTooltips('[data-tooltip]', {}, container);

            expect(tippy).toHaveBeenCalled();
            expect(tippy.mock.calls[0][1]).toMatchObject({
                placement: 'bottom-start',
                arrow: true,
                theme: 'light-border',
                appendTo: 'parent'
            });
            expect(result).toBeTruthy();
        });

        it('should merge custom options with defaults', () => {
            // Reset mock to track new calls
            tippy.mockClear();

            // Mock implementation for this test
            tippy.mockImplementationOnce((elements, options) => {
                return [{
                    destroy: jest.fn(),
                    setContent: jest.fn(),
                    setProps: jest.fn()
                }];
            });

            const customOptions = {
                placement: 'top',
                arrow: false,
                theme: 'custom-theme'
            };

            initTooltips('[data-tooltip]', customOptions, container);

            expect(tippy).toHaveBeenCalled();
            expect(tippy.mock.calls[0][1]).toMatchObject({
                placement: 'top',
                arrow: false,
                theme: 'custom-theme',
                appendTo: 'parent'
            });
        });

        it('should accept an array of elements', () => {
            // Reset mock to track new calls
            tippy.mockClear();

            // Mock implementation for this test
            tippy.mockImplementationOnce((elements, options) => {
                return [{
                    destroy: jest.fn(),
                    setContent: jest.fn(),
                    setProps: jest.fn()
                }];
            });

            const elements = Array.from(container.querySelectorAll('[data-tooltip]'));
            const result = initTooltips(elements);

            expect(tippy).toHaveBeenCalled();
            expect(tippy.mock.calls[0][0]).toEqual(elements);
            expect(result).toBeTruthy();
        });

        it('should accept a single element', () => {
            // Reset mock to track new calls
            tippy.mockClear();

            // Mock implementation for this test
            tippy.mockImplementationOnce((elements, options) => {
                return [{
                    destroy: jest.fn(),
                    setContent: jest.fn(),
                    setProps: jest.fn()
                }];
            });

            const element = container.querySelector('[data-tooltip]');
            const result = initTooltips(element);

            expect(tippy).toHaveBeenCalled();
            expect(tippy.mock.calls[0][0]).toEqual([element]);
            expect(result).toBeTruthy();
        });

        it('should return null if no elements match the selector', () => {
            // Reset mock to track new calls
            tippy.mockClear();

            const result = initTooltips('.non-existent-selector', {}, container);

            expect(result).toBeNull();
            expect(tippy).not.toHaveBeenCalled();
        });

        it('should handle errors during initialization', () => {
            // Reset mocks
            tippy.mockClear();
            const nfCommon = require('nf.Common');
            jest.clearAllMocks();

            // Make tippy throw an error
            tippy.mockImplementationOnce(() => {
                throw new Error('Tippy initialization failed');
            });

            const result = initTooltips('[data-tooltip]', {}, container);

            expect(result).toBeNull();
            expect(nfCommon.logError).toHaveBeenCalledWith(
                expect.stringContaining('Error initializing tooltip')
            );
        });

        it('should handle missing nfCommon gracefully', () => {
            // Reset mocks
            tippy.mockClear();

            // Temporarily mock nfCommon to be undefined
            jest.doMock('nf.Common', () => undefined, { virtual: true });

            // Make tippy throw an error
            tippy.mockImplementationOnce(() => {
                throw new Error('Tippy initialization failed');
            });

            // Should not throw even if nfCommon is undefined
            expect(() => {
                initTooltips('[data-tooltip]', {}, container);
            }).not.toThrow();
        });

        it('should handle null and undefined selectors', () => {
            expect(initTooltips(null)).toBeNull();
            expect(initTooltips(undefined)).toBeNull();
            expect(tippy).not.toHaveBeenCalled();
        });

        it('should handle empty array input', () => {
            tippy.mockClear();
            const result = initTooltips([]);
            expect(result).toBeNull();
            expect(tippy).not.toHaveBeenCalled();
        });
    });
});
