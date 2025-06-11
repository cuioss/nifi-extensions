/**
 * Mock implementation of formatters for testing.
 */

module.exports = {
    formatDate: jest.fn().mockImplementation(dateString => {
        if (!dateString) return '';
        try {
            const date = new Date(dateString);
            // Check if the date is valid
            if (isNaN(date.getTime())) {
                // Invalid date, return the original string without logging an error
                return dateString;
            }
            return date.toLocaleString();
        } catch (e) {
            console.error('Error formatting date:', e);
            return dateString;
        }
    }),

    formatDuration: jest.fn().mockImplementation(seconds => {
        if (seconds === undefined || seconds === null) return '';

        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        const remainingSeconds = seconds % 60;
        const remainingMinutes = minutes % 60;
        const remainingHours = hours % 24;

        const parts = [];

        if (days > 0) {
            parts.push(days + (days === 1 ? ' day' : ' days'));
        }

        if (remainingHours > 0) {
            parts.push(remainingHours + (remainingHours === 1 ? ' hour' : ' hours'));
        }

        if (remainingMinutes > 0) {
            parts.push(remainingMinutes + (remainingMinutes === 1 ? ' minute' : ' minutes'));
        }

        if (remainingSeconds > 0 || parts.length === 0) {
            parts.push(remainingSeconds + (remainingSeconds === 1 ? ' second' : ' seconds'));
        }

        return parts.join(', ');
    }),

    formatJwtToken: jest.fn().mockImplementation(token => {
        if (!token) {
            return { header: '', payload: '', signature: '' };
        }

        try {
            const parts = token.split('.');
            let header = parts[0] || '';
            let payload = parts[1] || '';
            const signature = parts[2] || '';

            // Try to decode and format header and payload
            try {
                if (header) {
                    const decodedHeader = JSON.parse(atob(header));
                    header = JSON.stringify(decodedHeader, null, 2);
                }

                if (payload) {
                    const decodedPayload = JSON.parse(atob(payload));
                    payload = JSON.stringify(decodedPayload, null, 2);
                }
            } catch (e) {
                console.error('Error decoding JWT token parts:', e);
            }

            return { header, payload, signature };
        } catch (e) {
            console.error('Error processing JWT token:', e);
            return { header: '', payload: '', signature: '' };
        }
    }),

    formatNumber: jest.fn().mockImplementation(number => {
        if (number === undefined || number === null) return '';
        // Use Intl.NumberFormat instead of regex for better performance and security
        return new Intl.NumberFormat('en-US').format(number);
    }),

    sanitizeHtml: jest.fn().mockImplementation(html => {
        if (!html) return '';
        return html.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    })
};
