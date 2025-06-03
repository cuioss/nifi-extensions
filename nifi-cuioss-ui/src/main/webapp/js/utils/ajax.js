// utils/ajax.js
export const ajax = ({ url, method = 'GET', data, contentType, headers = {}, ...options }) => {
    const fetchOptions = {
        method,
        headers: {
            'Content-Type': contentType || 'application/json',
            ...headers
        },
        ...options
    };

    if (data) {
        fetchOptions.body = contentType === 'application/json'
            ? JSON.stringify(data)
            : data;
    }

    return fetch(url, fetchOptions)
        .then(response => {
            if (!response.ok) {
                const error = new Error(response.statusText);
                error.response = response;
                throw error;
            }
            return response.json();
        })
        .then(data => ({
            data,
            status: 200,
            statusText: 'OK'
        }))
        .catch(error => {
            console.error('Fetch error:', error);
            throw error;
        });
};

