export default (api) => {
    const isTest = api.env('test'); // Automatically true when NODE_ENV=test (which Jest sets)
    const plugins = [];

    // If additional plugins are needed for test environment, add them here

    return {
        presets: [
            ['@babel/preset-env', {
                modules: isTest ? 'auto' : false // 'auto' typically means CommonJS for Jest
            }]
        ],
        plugins: plugins
    };
};
