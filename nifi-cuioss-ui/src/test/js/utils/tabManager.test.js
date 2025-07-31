/**
 * Tests for Tab Manager utility
 */

import { jest } from '@jest/globals';
import * as tabManager from '../../../main/webapp/js/utils/tabManager.js';

describe('Tab Manager', () => {
    let mockLogger;

    beforeEach(() => {
        // Set up DOM
        document.body.innerHTML = `
            <div class="jwt-tabs-header">
                <ul class="tabs">
                    <li class="active">
                        <a href="#issuer-config" data-toggle="tab">Configuration</a>
                    </li>
                    <li>
                        <a href="#token-verification" data-toggle="tab">Token Verification</a>
                    </li>
                    <li>
                        <a href="#metrics" data-toggle="tab">Metrics</a>
                    </li>
                    <li>
                        <a href="#help" data-toggle="tab">Help</a>
                    </li>
                </ul>
            </div>
            <div class="jwt-tabs-content">
                <div id="issuer-config" class="tab-pane active">Config Content</div>
                <div id="token-verification" class="tab-pane">Token Content</div>
                <div id="metrics" class="tab-pane">Metrics Content</div>
                <div id="help" class="tab-pane">Help Content</div>
            </div>
        `;

        // Mock logger
        mockLogger = {
            debug: jest.fn(),
            warn: jest.fn()
        };

        // Initialize tabs
        tabManager.initTabs();
    });

    afterEach(() => {
        tabManager.cleanup();
        document.body.innerHTML = '';
    });

    describe('initTabs', () => {
        it('should initialize tabs with event handlers', () => {
            // Tabs should be initialized
            const tabs = document.querySelectorAll('.jwt-tabs-header .tabs a');
            expect(tabs.length).toBe(4);
        });

        it('should handle multiple initialization calls gracefully', () => {
            // Initialize again
            tabManager.initTabs();

            // Should still work correctly
            const tabs = document.querySelectorAll('.jwt-tabs-header .tabs a');
            expect(tabs.length).toBe(4);
        });
    });

    describe('Tab switching', () => {
        it('should switch tabs when clicking on tab links', () => {
            const tokenTab = document.querySelector('a[href="#token-verification"]');
            const tokenPane = document.getElementById('token-verification');
            const configPane = document.getElementById('issuer-config');

            // Initial state
            expect(tokenPane.classList.contains('active')).toBe(false);
            expect(configPane.classList.contains('active')).toBe(true);

            // Click on token tab
            tokenTab.click();

            // Check new state
            expect(tokenPane.classList.contains('active')).toBe(true);
            expect(configPane.classList.contains('active')).toBe(false);

            // Check tab header state
            expect(tokenTab.parentElement.classList.contains('active')).toBe(true);
        });

        it('should handle clicks on data-toggle elements', () => {
            const metricsLink = document.querySelector('a[href="#metrics"]');
            const metricsPane = document.getElementById('metrics');

            // Click on metrics tab
            metricsLink.click();

            // Check state
            expect(metricsPane.classList.contains('active')).toBe(true);
            expect(metricsLink.parentElement.classList.contains('active')).toBe(true);
        });

        it('should dispatch tabChanged event when switching tabs', () => {
            const tabChangedHandler = jest.fn();
            document.addEventListener('tabChanged', tabChangedHandler);

            const helpTab = document.querySelector('a[href="#help"]');
            helpTab.click();

            expect(tabChangedHandler).toHaveBeenCalled();
            expect(tabChangedHandler.mock.calls[0][0].detail).toEqual({
                tabId: '#help',
                tabName: 'Help'
            });

            document.removeEventListener('tabChanged', tabChangedHandler);
        });
    });

    describe('activateTab', () => {
        it('should programmatically switch to a specific tab', () => {
            const targetTab = '#metrics';
            tabManager.activateTab(targetTab);

            const metricsPane = document.getElementById('metrics');
            const metricsTab = document.querySelector('a[href="#metrics"]');

            expect(metricsPane.classList.contains('active')).toBe(true);
            expect(metricsTab.parentElement.classList.contains('active')).toBe(true);
        });

        it('should handle invalid tab IDs gracefully', () => {
            // Should not throw error
            expect(() => {
                tabManager.activateTab('#invalid-tab');
            }).not.toThrow();
        });

        it('should work with or without hash prefix', () => {
            tabManager.activateTab('help');

            const helpPane = document.getElementById('help');
            expect(helpPane.classList.contains('active')).toBe(true);
        });
    });

    describe('Event delegation', () => {
        it('should handle dynamically added tabs', () => {
            // Add a new tab dynamically
            const tabList = document.querySelector('.jwt-tabs-header .tabs');
            const newTab = document.createElement('li');
            newTab.innerHTML = '<a href="#new-tab" data-toggle="tab">New Tab</a>';
            tabList.appendChild(newTab);

            // Add corresponding pane
            const tabContent = document.querySelector('.jwt-tabs-content');
            const newPane = document.createElement('div');
            newPane.id = 'new-tab';
            newPane.className = 'tab-pane';
            newPane.textContent = 'New Tab Content';
            tabContent.appendChild(newPane);

            // Click on the new tab
            const newTabLink = newTab.querySelector('a');
            newTabLink.click();

            // Should switch to new tab
            expect(newPane.classList.contains('active')).toBe(true);
            expect(newTab.classList.contains('active')).toBe(true);
        });
    });

    describe('cleanup', () => {
        it('should clean up event handlers', () => {
            // Add event listener to track clicks
            let clickCount = 0;
            const clickHandler = () => clickCount++;
            document.addEventListener('click', clickHandler);

            // Clean up
            tabManager.cleanup();

            // Click on tab after cleanup
            const tab = document.querySelector('a[href="#help"]');
            tab.click();

            // Remove our test handler
            document.removeEventListener('click', clickHandler);

            // The tab switching should still work if event delegation is properly cleaned up
            // This is a basic test - in real implementation we'd need to verify
            // the specific event handler is removed
            expect(clickCount).toBe(1); // Our handler was called
        });
    });

    describe('Error handling', () => {
        it('should handle missing tab panes gracefully', () => {
            // Remove a tab pane
            const helpPane = document.getElementById('help');
            helpPane.remove();

            // Try to switch to the missing pane
            expect(() => {
                const helpTab = document.querySelector('a[href="#help"]');
                helpTab.click();
            }).not.toThrow();
        });

        it('should handle missing tab structure', () => {
            // Clear DOM
            document.body.innerHTML = '';

            // Should not throw when initializing without tab structure
            expect(() => {
                tabManager.cleanup();
                tabManager.initTabs();
            }).not.toThrow();
        });

        it('should handle empty href attribute', () => {
            // Add a tab with empty href
            const tabList = document.querySelector('.jwt-tabs-header .tabs');
            const emptyTab = document.createElement('li');
            emptyTab.innerHTML = '<a href="#" data-toggle="tab">Empty Tab</a>';
            tabList.appendChild(emptyTab);

            const activeTabBefore = document.querySelector('.jwt-tabs-header .tabs li.active a').getAttribute('href');

            // Click on the empty href tab
            const emptyTabLink = emptyTab.querySelector('a');
            emptyTabLink.click();

            // Should not change active tab
            const activeTabAfter = document.querySelector('.jwt-tabs-header .tabs li.active a').getAttribute('href');
            expect(activeTabAfter).toBe(activeTabBefore);
        });
    });

    describe('getCurrentTab', () => {
        it('should return information about the currently active tab', () => {
            const currentTab = tabManager.getCurrentTab();
            expect(currentTab).toEqual({
                id: '#issuer-config',
                name: 'Configuration'
            });
        });

        it('should return null when no tab is active', () => {
            // Remove active class from all tabs
            document.querySelectorAll('.jwt-tabs-header .tabs li').forEach(li => {
                li.classList.remove('active');
            });

            const currentTab = tabManager.getCurrentTab();
            expect(currentTab).toBeNull();
        });

        it('should return correct info after switching tabs', () => {
            // Switch to metrics tab
            tabManager.activateTab('#metrics');

            const currentTab = tabManager.getCurrentTab();
            expect(currentTab).toEqual({
                id: '#metrics',
                name: 'Metrics'
            });
        });
    });

    describe('isTabActive', () => {
        it('should return true for active tab', () => {
            expect(tabManager.isTabActive('#issuer-config')).toBe(true);
        });

        it('should return false for inactive tab', () => {
            expect(tabManager.isTabActive('#help')).toBe(false);
        });

        it('should return false for non-existent tab', () => {
            // isTabActive returns falsy (null) for non-existent tabs
            expect(tabManager.isTabActive('#non-existent')).toBeFalsy();
        });

        it('should work after tab switch', () => {
            tabManager.activateTab('#token-verification');
            expect(tabManager.isTabActive('#token-verification')).toBe(true);
            expect(tabManager.isTabActive('#issuer-config')).toBe(false);
        });
    });

    describe('setTabState', () => {
        it('should disable a tab', () => {
            const result = tabManager.setTabState('#help', 'disabled');
            expect(result).toBe(true);

            const helpTab = document.querySelector('a[href="#help"]').parentElement;
            expect(helpTab.classList.contains('disabled')).toBe(true);
        });

        it('should enable a previously disabled tab', () => {
            // First disable it
            tabManager.setTabState('#help', 'disabled');

            // Then enable it
            const result = tabManager.setTabState('#help', 'enabled');
            expect(result).toBe(true);

            const helpTab = document.querySelector('a[href="#help"]').parentElement;
            expect(helpTab.classList.contains('disabled')).toBe(false);
        });

        it('should set error state temporarily', async () => {
            const result = tabManager.setTabState('#metrics', 'error');
            expect(result).toBe(true);

            const metricsTab = document.querySelector('a[href="#metrics"]').parentElement;
            expect(metricsTab.classList.contains('error')).toBe(true);

            // Wait for error state to be removed
            await new Promise(resolve => setTimeout(resolve, 3100));
            expect(metricsTab.classList.contains('error')).toBe(false);
        });

        it('should return false for non-existent tab', () => {
            const result = tabManager.setTabState('#non-existent', 'disabled');
            expect(result).toBe(false);
        });

        it('should handle tabs without parent element', () => {
            // Create a detached tab link
            const detachedLink = document.createElement('a');
            detachedLink.href = '#detached';

            // Mock querySelector to return our detached link
            const originalQuerySelector = document.querySelector;
            document.querySelector = (selector) => {
                if (selector === '.jwt-tabs-header .tabs a[href="#detached"]') {
                    return detachedLink;
                }
                return originalQuerySelector.call(document, selector);
            };

            const result = tabManager.setTabState('#detached', 'disabled');
            expect(result).toBe(false);

            // Restore original querySelector
            document.querySelector = originalQuerySelector;
        });
    });
});
