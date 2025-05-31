module.exports = {
    presets: [
        ['@babel/preset-env', { modules: false }] // Important: modules: false
    ],
    plugins: [
        // 'babel-plugin-transform-amd-to-commonjs' // Removed this plugin
    ]
};
