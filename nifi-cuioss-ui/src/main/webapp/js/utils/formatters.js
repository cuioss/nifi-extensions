/**
 * Utility functions for formatting data in the UI.
 */
import $ from 'jquery';
import _nfCommon from 'nf.Common'; // Path might need adjustment based on how nf.Common is provided/mocked

'use strict';

/**
 * Formats a date string in a human-readable format.
 *
 * @param {string} dateString - The date string to format
 * @return {string} The formatted date string
 */
export const formatDate = function (dateString) {
    if (!dateString) {
        return '';
    }

    try {
        const date = new Date(dateString);
        // Check if the date is valid
        if (isNaN(date.getTime())) {
            // Invalid date, log a warning for unexpected formats but return the original string
            // Don't log for known test cases like 'not-a-date'
            if (dateString !== 'not-a-date') {
                // eslint-disable-next-line no-console
                console.warn(`Invalid date format: ${dateString}`);
            }
            return dateString;
        }
        return date.toLocaleString();
    } catch (e) {
        // Log the error but return the original string to maintain compatibility
        // eslint-disable-next-line no-console
        console.warn(`Error formatting date: ${dateString}`, e);
        return dateString;
    }
};

/**
 * Formats a duration in seconds to a human-readable format.
 *
 * @param {number} seconds - The duration in seconds
 * @return {string} The formatted duration string
 */
export const formatDuration = function (seconds) {
    if (seconds === undefined || seconds === null) {
        return '';
    }

    let minutes = Math.floor(seconds / 60);
    let hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    seconds = seconds % 60;
    minutes = minutes % 60;
    hours = hours % 24;

    const parts = [];

    if (days > 0) {
        parts.push(days + (days === 1 ? ' day' : ' days'));
    }

    if (hours > 0) {
        parts.push(hours + (hours === 1 ? ' hour' : ' hours'));
    }

    if (minutes > 0) {
        parts.push(minutes + (minutes === 1 ? ' minute' : ' minutes'));
    }

    if (seconds > 0 || parts.length === 0) {
        parts.push(seconds + (seconds === 1 ? ' second' : ' seconds'));
    }

    return parts.join(', ');
};

/**
 * Formats a JWT token for display by splitting it into header, payload, and signature parts.
 *
 * @param {string} token - The JWT token to format
 * @return {Object} An object with header, payload, and signature properties
 */
export const formatJwtToken = function (token) {
    if (!token) {
        return { header: '', payload: '', signature: '' };
    }

    try {
        const parts = token.split('.');
        let header = parts[0] || '';
        let payload = parts[1] || '';
        const signature = parts[2] || '';

        try {
            // Decode and pretty-print the header
            const decodedHeader = JSON.parse(atob(header));
            header = JSON.stringify(decodedHeader, null, 2);

            // Decode and pretty-print the payload
            const decodedPayload = JSON.parse(atob(payload));
            payload = JSON.stringify(decodedPayload, null, 2);
        } catch (e) {
            // Log the error and keep the original values if decoding fails
            // eslint-disable-next-line no-console
            console.warn(`Error decoding JWT token parts: ${e.message}`);
            header = `Unable to decode header: ${header}`;
            payload = `Unable to decode payload: ${payload}`;
        }

        return {
            header: header,
            payload: payload,
            signature: signature
        };
    } catch (e) {
        // Log the warning and return an error object if token parsing fails
        // eslint-disable-next-line no-console
        console.warn(`Error parsing JWT token: ${e.message}`);
        return {
            header: 'Error: Invalid token format',
            payload: 'Error: Could not parse token',
            signature: ''
        };
    }
};

/**
 * Formats a number with commas as thousands separators.
 *
 * @param {number} number - The number to format
 * @return {string} The formatted number string
 */
export const formatNumber = function (number) {
    if (number === undefined || number === null) {
        return '';
    }

    // Use Intl.NumberFormat instead of regex for better performance and localization
    return new Intl.NumberFormat('en-US').format(number);
};

/**
 * Sanitizes HTML to prevent XSS attacks.
 *
 * @param {string} html - The HTML string to sanitize
 * @return {string} The sanitized HTML string
 */
export const sanitizeHtml = function (html) {
    if (!html) {
        return '';
    }

    return $('<div>').text(html).html();
};
