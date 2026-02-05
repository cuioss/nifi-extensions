'use strict';

/**
 * Tab manager for JWT Validator UI tabs.
 * Handles tab switching, state management, and related events.
 */

import { createLogger } from './logger.js';

const logger = createLogger('tabManager');

/**
 * Initialize tab functionality
 */
export const initTabs = () => {
    logger.debug('Initializing tab manager');

    // Use WeakMap for storing clicking state
    const clickingState = new WeakMap();

    // Single event handler for all tab clicks using event delegation
    const handleTabClick = (e) => {
        // Check for regular tab links
        const tabLink = e.target.closest('.jwt-tabs-header .tabs a');
        // Check for data-toggle tabs
        const toggleLink = e.target.closest('[data-toggle="tab"]');

        const link = tabLink || toggleLink;
        if (!link) return;

        e.preventDefault();

        // Prevent double-click handling
        if (toggleLink && clickingState.get(link)) return;

        if (toggleLink) {
            clickingState.set(link, true);
            setTimeout(() => clickingState.delete(link), 100);
        }

        const targetId = link.getAttribute('href') || link.dataset.target;

        if (!targetId || targetId === '#') {
            return;
        }

        // Update active tab
        for (const li of document.querySelectorAll('.jwt-tabs-header .tabs li')) {
            li.classList.remove('active');
        }
        if (link.parentElement) {
            link.parentElement.classList.add('active');
        }

        // Update active content
        for (const pane of document.querySelectorAll('.tab-pane')) {
            pane.classList.remove('active');
        }
        const targetElement = document.querySelector(targetId);
        if (targetElement) {
            targetElement.classList.add('active');
        }

        logger.debug('Switched to tab:', targetId);

        // Trigger custom event for tab change
        document.dispatchEvent(new CustomEvent('tabChanged', {
            detail: {
                tabId: targetId,
                tabName: link.textContent.trim()
            }
        }));
    };

    // Add single event listener at document level
    document.addEventListener('click', handleTabClick);

    // Store handler reference for cleanup
    globalThis.__tabClickHandler = handleTabClick;
};

/**
 * Programmatically activate a specific tab
 * @param {string} tabId - The href/id of the tab to activate
 * @returns {boolean} True if tab was found and activated
 */
export const activateTab = (tabId) => {
    // Ensure tabId starts with #
    const normalizedTabId = tabId.startsWith('#') ? tabId : `#${tabId}`;
    const tabLink = document.querySelector(`.jwt-tabs-header .tabs a[href="${normalizedTabId}"]`);
    if (tabLink) {
        tabLink.click();
        return true;
    }
    return false;
};

/**
 * Get information about the currently active tab
 * @returns {Object|null} Object with id and name of active tab, or null if none
 */
export const getCurrentTab = () => {
    const activeLink = document.querySelector('.jwt-tabs-header .tabs li.active a');
    if (activeLink) {
        return {
            id: activeLink.getAttribute('href'),
            name: activeLink.textContent.trim()
        };
    }
    return null;
};

/**
 * Check if a specific tab is currently active
 * @param {string} tabId - The href/id of the tab to check
 * @returns {boolean} True if the tab is active
 */
export const isTabActive = (tabId) => {
    const tabLink = document.querySelector(`.jwt-tabs-header .tabs a[href="${tabId}"]`);
    return tabLink && tabLink.parentElement && tabLink.parentElement.classList.contains('active');
};

/**
 * Set the state of a tab (enabled, disabled, error)
 * @param {string} tabId - The href/id of the tab
 * @param {string} state - The state to set ('enabled', 'disabled', 'error')
 * @returns {boolean} True if tab was found and state was set
 */
export const setTabState = (tabId, state) => {
    const tabLink = document.querySelector(`.jwt-tabs-header .tabs a[href="${tabId}"]`);
    const tabLi = tabLink ? tabLink.parentElement : null;

    if (tabLi) {
        if (state === 'disabled') {
            tabLi.classList.add('disabled');
        } else if (state === 'enabled') {
            tabLi.classList.remove('disabled');
        } else if (state === 'error') {
            // Flash error state briefly
            tabLi.classList.add('error');
            setTimeout(() => {
                for (const li of document.querySelectorAll('.jwt-tabs-header .tabs li')) {
                    li.classList.remove('error');
                }
            }, 3000);
        }
        return true;
    }
    return false;
};

/**
 * Clean up tab event handlers
 */
export const cleanupTabs = () => {
    if (globalThis.__tabClickHandler) {
        document.removeEventListener('click', globalThis.__tabClickHandler);
        delete globalThis.__tabClickHandler;
    }
    logger.debug('Tab manager cleaned up');
};

// Export cleanup alias for backward compatibility
export const cleanup = cleanupTabs;
