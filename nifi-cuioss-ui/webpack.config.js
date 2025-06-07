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
            'nf.Common': path.resolve(__dirname, 'src/test/js/mocks/nf-common.js')
        }
    },
    externals: {
        'cash-dom': 'cash',
        'jquery': 'jQuery',
        'tippy.js': 'tippy'
    },
    optimization: {
        minimize: process.env.NODE_ENV === 'production'
    }
};