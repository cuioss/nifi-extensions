/**
 * Simple tests for ComponentManager - targeting core functionality for coverage
 */
import { COMPONENT_STATES, ComponentManager } from '../../../main/webapp/js/utils/componentManager.js';

// Mock componentCleanup with simple implementation
jest.mock('../../../main/webapp/js/utils/componentCleanup.js', () => ({
    managedSetTimeout: jest.fn((key, callback) => {
        // Execute immediately for tests
        setTimeout(callback, 0);
        return 123;
    })
}));

describe('ComponentManager - Simple Coverage Tests', () => {
    let componentManager;

    beforeEach(() => {
        componentManager = new ComponentManager();
        process.env.NODE_ENV = 'test';
    });

    afterEach(() => {
        componentManager.cleanup();
    });

    it('should register component successfully', async () => {
        const mockComponent = { init: jest.fn().mockResolvedValue(true) };
        const result = await componentManager.registerComponent('test', mockComponent);
        expect(result).toBe(true);
    });

    it('should get component state', async () => {
        const mockComponent = { init: jest.fn().mockResolvedValue(true) };
        await componentManager.registerComponent('test', mockComponent);
        expect(componentManager.getComponentState('test')).toBe(COMPONENT_STATES.REGISTERED);
    });

    it('should return null for non-existent component', () => {
        expect(componentManager.getComponentState('nonexistent')).toBeNull();
        expect(componentManager.getComponentInfo('nonexistent')).toBeNull();
    });

    it('should check if component is ready', async () => {
        const mockComponent = { init: jest.fn().mockResolvedValue(true) };
        await componentManager.registerComponent('test', mockComponent);
        expect(componentManager.isComponentReady('test')).toBe(true);
        expect(componentManager.isComponentReady('nonexistent')).toBe(false);
    });

    it('should get all components', async () => {
        const mockComponent1 = { init: jest.fn().mockResolvedValue(true) };
        const mockComponent2 = { init: jest.fn().mockResolvedValue(true) };

        await componentManager.registerComponent('test1', mockComponent1);
        await componentManager.registerComponent('test2', mockComponent2);

        const components = componentManager.getAllComponents();
        expect(components).toHaveLength(2);
    });

    it('should handle component info correctly', async () => {
        const mockComponent = { init: jest.fn().mockResolvedValue(true) };
        await componentManager.registerComponent('test', mockComponent);

        const info = componentManager.getComponentInfo('test');
        expect(info.id).toBe('test');
        expect(info.state).toBe(COMPONENT_STATES.REGISTERED);
        expect(info.registrationTime).toBeTruthy();
    });

    it('should add and remove error handlers', () => {
        const handler = jest.fn();
        componentManager.addErrorHandler(handler);
        expect(componentManager.errorHandlers).toContain(handler);

        componentManager.removeErrorHandler(handler);
        expect(componentManager.errorHandlers).not.toContain(handler);
    });

    it('should unregister component', async () => {
        const mockComponent = {
            init: jest.fn().mockResolvedValue(true),
            cleanup: jest.fn()
        };

        await componentManager.registerComponent('test', mockComponent);
        const result = componentManager.unregisterComponent('test');

        expect(result).toBe(true);
        expect(componentManager.getComponentInfo('test')).toBeNull();
    });

    it('should return false when unregistering non-existent component', () => {
        const result = componentManager.unregisterComponent('nonexistent');
        expect(result).toBe(false);
    });

    it('should cleanup all components', async () => {
        const mockComponent = {
            init: jest.fn().mockResolvedValue(true),
            cleanup: jest.fn()
        };

        await componentManager.registerComponent('test', mockComponent);
        componentManager.cleanup();

        expect(componentManager.getAllComponents()).toHaveLength(0);
        expect(componentManager.errorHandlers).toHaveLength(0);
    });

    it('should handle component without cleanup method', async () => {
        const mockComponent = { init: jest.fn().mockResolvedValue(true) };

        await componentManager.registerComponent('test', mockComponent);
        const result = componentManager.unregisterComponent('test');

        expect(result).toBe(true);
    });

    it('should handle component registration failure', async () => {
        const failingComponent = {
            init: jest.fn().mockRejectedValue(new Error('Init failed'))
        };

        const result = await componentManager.registerComponent('failing', failingComponent, { retryCount: 0 });
        expect(result).toBe(false);
        expect(componentManager.getComponentState('failing')).toBe(COMPONENT_STATES.ERROR);
    });

    it('should not register same component twice', async () => {
        const mockComponent = { init: jest.fn().mockResolvedValue(true) };

        await componentManager.registerComponent('test', mockComponent);
        mockComponent.init.mockClear();

        const result = await componentManager.registerComponent('test', mockComponent);
        expect(result).toBe(true);
        expect(mockComponent.init).not.toHaveBeenCalled();
    });

    it('should wait for all components to be ready', async () => {
        const mockComponent1 = { init: jest.fn().mockResolvedValue(true) };
        const mockComponent2 = { init: jest.fn().mockResolvedValue(true) };

        await componentManager.registerComponent('test1', mockComponent1);
        await componentManager.registerComponent('test2', mockComponent2);

        const allReady = await componentManager.waitForAllComponents(100);
        expect(allReady).toBe(true);
    });
});
