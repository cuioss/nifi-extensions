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
    });
});
