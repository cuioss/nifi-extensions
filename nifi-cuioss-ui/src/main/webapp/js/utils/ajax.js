// utils/ajax.js
export const ajax = ({url, method = 'GET', data, contentType, headers = {}, ...options}) => {
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

// Compatibility with jQuery's $.ajax API
export const compatAjax = (options) => {
  return ajax(options)
    .then(response => {
      if (options.success) {
        options.success(response.data, response.statusText, { status: response.status });
      }
      return response;
    })
    .catch(error => {
      if (options.error) {
        options.error({ status: error.response?.status || 0 }, error.message);
      }
      throw error;
    })
    .finally(() => {
      if (options.complete) {
        options.complete();
      }
    });
};
