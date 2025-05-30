module.exports = {
  presets: [
    ['@babel/preset-env', { modules: false }] // Ensure preset-env doesn't interfere with module handling
  ],
  plugins: [
    'babel-plugin-transform-amd-to-commonjs'
  ]
};
