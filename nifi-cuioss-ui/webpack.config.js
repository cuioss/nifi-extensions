const path = require('path');

module.exports = {
    entry: './src/main/webapp/js/main.js',
    output: {
        path: path.resolve(__dirname, 'src/main/webapp/js'),
        filename: 'bundle.webpack.js',
        library: 'nifiCuiossUI',
        libraryTarget: 'umd'
    },
    mode: process.env.NODE_ENV === 'production' ? 'production' : 'development',
    devtool: process.env.NODE_ENV === 'production' ? 'source-map' : 'eval-source-map',
    module: {
        rules: [
            {
                test: /\.js$/,
                exclude: /node_modules/,
                use: {
                    loader: 'babel-loader',
                    options: {
                        presets: ['@babel/preset-env']
                    }
                }
            }
        ]
    },
    resolve: {
        extensions: ['.js'],
        alias: {
            'nf.Common': process.env.NODE_ENV === 'production'
                ? path.resolve(__dirname, 'src/main/webapp/js/nf-common.js')
                : path.resolve(__dirname, 'src/test/js/mocks/nf-common.js')
        }
    },
    // These dependencies are loaded from WebJars in the HTML
    // and are not bundled with webpack
    externals: {
        'cash-dom': 'cash',
        'jquery': 'jQuery',
        'tippy.js': 'tippy',
        '@popperjs/core': 'Popper'
    },
    optimization: {
        minimize: process.env.NODE_ENV === 'production'
    }
};
