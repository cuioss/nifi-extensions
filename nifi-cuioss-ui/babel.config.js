module.exports = (api) => {
    const isTest = api.env('test'); // Automatically true when NODE_ENV=test (which Jest sets)
    const plugins = [];

    if (isTest) {
        // This plugin transforms AMD to CommonJS, which Jest can understand.
        // It's useful if you have AMD modules that need to be tested.
        // plugins.push('babel-plugin-transform-amd-to-commonjs'); // Removed
    }

    return {
        presets: [
            ['@babel/preset-env', {
                modules: isTest ? 'auto' : false // 'auto' typically means CommonJS for Jest
            }]
        ],
        plugins: plugins
    };
};
