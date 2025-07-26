/**
 * Tests for Tab Manager utility
 */

import $ from 'cash-dom';
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
        $(document).off('tabChanged');
        document.body.innerHTML = '';
    });

    describe('initTabs', () => {
        it('should handle tab clicks', () => {
            const metricsTab = document.querySelector('a[href="#metrics"]');
            const event = new Event('click', { bubbles: true, cancelable: true });

            metricsTab.dispatchEvent(event);

            // Check active states
            expect(metricsTab.parentElement.classList.contains('active')).toBe(true);
            expect(document.querySelector('#metrics').classList.contains('active')).toBe(true);
            expect(document.querySelector('#issuer-config').classList.contains('active')).toBe(false);
        });

        it('should handle invalid href', () => {
            document.body.innerHTML += '<li><a href="#" data-toggle="tab">Invalid</a></li>';
            const invalidTab = document.querySelector('a[href="#"]');
            const event = new Event('click', { bubbles: true, cancelable: true });

            invalidTab.dispatchEvent(event);

            // Active tab should not change
            expect(document.querySelector('a[href="#issuer-config"]').parentElement.classList.contains('active')).toBe(true);
        });

        it('should trigger tabChanged event', async () => {
            const tabChangedPromise = new Promise((resolve) => {
                $(document).on('tabChanged', (e, data) => {
                    resolve(data);
                });
            });

            const tokenTab = document.querySelector('a[href="#token-verification"]');
            const event = new Event('click', { bubbles: true, cancelable: true });
            tokenTab.dispatchEvent(event);

            const data = await tabChangedPromise;
            expect(data.tabId).toBe('#token-verification');
            expect(data.tabName).toBe('Token Verification');
        });
    });

    describe('switchToTab', () => {
        it('should programmatically switch tabs', () => {
            tabManager.switchToTab('#help');

            expect(document.querySelector('a[href="#help"]').parentElement.classList.contains('active')).toBe(true);
            expect(document.querySelector('#help').classList.contains('active')).toBe(true);
        });

        it('should handle non-existent tab', () => {
            tabManager.switchToTab('#nonexistent');

            // Active tab should not change
            expect(document.querySelector('a[href="#issuer-config"]').parentElement.classList.contains('active')).toBe(true);
        });
    });

    describe('getActiveTab', () => {
        it('should return active tab info', () => {
            const activeTab = tabManager.getActiveTab();

            expect(activeTab.tabId).toBe('#issuer-config');
            expect(activeTab.tabName).toBe('Configuration');
        });

        it('should return updated active tab after switch', () => {
            // Clean up any previous state
            $('.jwt-tabs-header .tabs li').removeClass('active');
            $('a[href="#metrics"]').parent().addClass('active');

            const activeTab = tabManager.getActiveTab();

            expect(activeTab.tabId).toBe('#metrics');
            expect(activeTab.tabName).toBe('Metrics');
        });
    });

    describe('setTabEnabled', () => {
        it('should disable a tab', () => {
            tabManager.setTabEnabled('#metrics', false);

            const metricsTab = document.querySelector('a[href="#metrics"]');
            expect(metricsTab.parentElement.classList.contains('disabled')).toBe(true);
            expect(metricsTab.hasAttribute('disabled')).toBe(true);
        });

        it('should enable a disabled tab', () => {
            // First disable
            tabManager.setTabEnabled('#metrics', false);
            // Then enable
            tabManager.setTabEnabled('#metrics', true);

            const metricsTab = document.querySelector('a[href="#metrics"]');
            expect(metricsTab.parentElement.classList.contains('disabled')).toBe(false);
            expect(metricsTab.hasAttribute('disabled')).toBe(false);
        });
    });

    describe('setTabVisible', () => {
        it('should hide a tab', () => {
            tabManager.setTabVisible('#help', false);

            const helpTab = document.querySelector('a[href="#help"]').parentElement;
            expect(helpTab.style.display).toBe('none');
        });

        it('should show a hidden tab', () => {
            // First hide
            tabManager.setTabVisible('#help', false);
            // Then show
            tabManager.setTabVisible('#help', true);

            const helpTab = document.querySelector('a[href="#help"]').parentElement;
            expect(helpTab.style.display).not.toBe('none');
        });

        it('should switch to first visible tab when hiding active tab', () => {
            // Make issuer-config active and hide it
            tabManager.setTabVisible('#issuer-config', false);

            // Should switch to token-verification (first visible)
            expect(document.querySelector('a[href="#token-verification"]').parentElement.classList.contains('active')).toBe(true);
        });
    });
});
