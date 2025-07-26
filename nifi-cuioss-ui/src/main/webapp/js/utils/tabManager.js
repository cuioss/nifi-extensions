'use strict';

/**
 * Tab Manager Utility
 * Handles tab switching and state management for the JWT Authenticator UI
 *
 * @module utils/tabManager
 */

import $ from 'cash-dom';
import { createLogger } from './logger.js';

const logger = createLogger('TabManager');

/**
 * Initializes tab switching functionality
 */
export const initTabs = () => {
    logger.debug('Initializing tab manager');

    // Handle tab clicks
    $(document).on('click', '.jwt-tabs-header .tabs a', function (e) {
        e.preventDefault();

        const $link = $(this);
        const targetId = $link.attr('href');

        if (!targetId || targetId === '#') {
            return;
        }

        // Update active tab
        $('.jwt-tabs-header .tabs li').removeClass('active');
        $link.parent().addClass('active');

        // Update active content
        $('.tab-pane').removeClass('active');
        $(targetId).addClass('active');

        logger.debug('Switched to tab:', targetId);

        // Trigger custom event for tab change
        $(document).trigger('tabChanged', {
            tabId: targetId,
            tabName: $link.text().trim()
        });
    });

    // Handle data-toggle="tab" clicks (Bootstrap-style)
    $(document).on('click', '[data-toggle="tab"]', function (e) {
        e.preventDefault();
        // Don't trigger click again if we're already handling a tab click
        if (!$(this).data('clicking')) {
            $(this).data('clicking', true);
            const $link = $(this);
            const targetId = $link.attr('href');

            if (targetId && targetId !== '#') {
                // Update active tab
                $('.jwt-tabs-header .tabs li').removeClass('active');
                $link.parent().addClass('active');

                // Update active content
                $('.tab-pane').removeClass('active');
                $(targetId).addClass('active');

                logger.debug('Switched to tab via data-toggle:', targetId);

                // Trigger custom event for tab change
                $(document).trigger('tabChanged', {
                    tabId: targetId,
                    tabName: $link.text().trim()
                });
            }

            setTimeout(() => {
                $(this).removeData('clicking');
            }, 0);
        }
    });
};

/**
 * Programmatically switches to a specific tab
 * @param {string} tabId - The ID of the tab to switch to (e.g., '#metrics')
 */
export const switchToTab = (tabId) => {
    const $tabLink = $(`.jwt-tabs-header .tabs a[href="${tabId}"]`);

    if ($tabLink.length) {
        $tabLink.trigger('click');
        logger.debug('Programmatically switched to tab:', tabId);
    } else {
        logger.warn('Tab not found:', tabId);
    }
};

/**
 * Gets the currently active tab
 * @returns {Object} Object containing tabId and tabName
 */
export const getActiveTab = () => {
    const $activeLink = $('.jwt-tabs-header .tabs li.active a');

    return {
        tabId: $activeLink.attr('href'),
        tabName: $activeLink.text().trim()
    };
};

/**
 * Enables or disables a specific tab
 * @param {string} tabId - The ID of the tab
 * @param {boolean} enabled - Whether to enable or disable the tab
 */
export const setTabEnabled = (tabId, enabled) => {
    const $tabLink = $(`.jwt-tabs-header .tabs a[href="${tabId}"]`);
    const $tabLi = $tabLink.parent();

    if (enabled) {
        $tabLi.removeClass('disabled');
        $tabLink.removeAttr('disabled');
    } else {
        $tabLi.addClass('disabled');
        $tabLink.attr('disabled', 'disabled');
    }

    logger.debug(`Tab ${tabId} ${enabled ? 'enabled' : 'disabled'}`);
};

/**
 * Shows or hides a specific tab
 * @param {string} tabId - The ID of the tab
 * @param {boolean} visible - Whether to show or hide the tab
 */
export const setTabVisible = (tabId, visible) => {
    const $tabLi = $(`.jwt-tabs-header .tabs a[href="${tabId}"]`).parent();

    if (visible) {
        $tabLi.show();
    } else {
        $tabLi.hide();

        // If hiding the active tab, switch to the first visible tab
        if ($tabLi.hasClass('active')) {
            const $allTabs = $('.jwt-tabs-header .tabs li');
            $allTabs.each(function () {
                const $li = $(this);
                if ($li.css('display') !== 'none' && !$li.is($tabLi)) {
                    $li.find('a').trigger('click');
                    return false; // break
                }
            });
        }
    }

    logger.debug(`Tab ${tabId} ${visible ? 'shown' : 'hidden'}`);
};

/**
 * Cleans up tab manager event handlers
 */
export const cleanup = () => {
    logger.debug('Cleaning up tab manager');
    $(document).off('click', '.jwt-tabs-header .tabs a');
    $(document).off('click', '[data-toggle="tab"]');
};
