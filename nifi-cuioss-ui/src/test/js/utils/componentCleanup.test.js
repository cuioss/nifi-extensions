/**
 * Simple tests for componentCleanup - targeting basic functionality for coverage
 */
import {
    registerComponent,
    addCleanupFunction,
    cleanupComponent,
    cleanupAll,
    managedSetTimeout,
    managedSetInterval
} from '../../../main/webapp/js/utils/componentCleanup.js';

describe('Component Cleanup - Simple Coverage Tests', () => {
    beforeEach(() => {
        cleanupAll();
        jest.useFakeTimers();
    });

    afterEach(() => {
        cleanupAll();
        jest.useRealTimers();
    });

    it('should register component and add cleanup function', () => {
        const cleanupFn = jest.fn();

        registerComponent('test-component');
        addCleanupFunction('test-component', cleanupFn);

        cleanupComponent('test-component');
        expect(cleanupFn).toHaveBeenCalled();
    });

    it('should cleanup all components', () => {
        const cleanupFn1 = jest.fn();
        const cleanupFn2 = jest.fn();

        addCleanupFunction('component1', cleanupFn1);
        addCleanupFunction('component2', cleanupFn2);

        cleanupAll();

        expect(cleanupFn1).toHaveBeenCalled();
        expect(cleanupFn2).toHaveBeenCalled();
    });

    it('should create managed timeout', () => {
        const callback = jest.fn();
        const timeoutId = managedSetTimeout('test-component', callback, 1000);

        expect(timeoutId).toBeTruthy();

        jest.advanceTimersByTime(1000);
        expect(callback).toHaveBeenCalled();
    });

    it('should create managed interval', () => {
        const callback = jest.fn();
        const intervalId = managedSetInterval('test-component', callback, 100);

        expect(intervalId).toBeTruthy();

        jest.advanceTimersByTime(300);
        expect(callback).toHaveBeenCalledTimes(3);
    });

    it('should handle cleanup with errors gracefully', () => {
        const faultyCleanup = jest.fn().mockImplementation(() => {
            throw new Error('Cleanup error');
        });

        const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

        addCleanupFunction('test-component', faultyCleanup);

        // Should not throw
        expect(() => cleanupComponent('test-component')).not.toThrow();

        consoleWarnSpy.mockRestore();
    });

    it('should cleanup component that does not exist without error', () => {
        expect(() => cleanupComponent('nonexistent')).not.toThrow();
    });
});
