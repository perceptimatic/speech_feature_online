const path = require('path');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
    entry: './src/index.tsx',
    module: {
        rules: [
            /* for fonts */
            {
                test: /\.css$/i,
                use: ['style-loader', 'css-loader'],
            },
            {
                test: /\.tsx?$/,
                use: 'ts-loader',
                exclude: /node_modules/,
            },
        ],
    },
    mode: 'development',
    devtool: 'inline-source-map',
    resolve: {
        extensions: ['.tsx', '.ts', '.js'],
        /*https://github.com/facebook/create-react-app/issues/11756*/
        fallback: {
            util: require.resolve('util/'),
        },
    },
    output: {
        filename: 'bundle.js',
        path: path.resolve(__dirname, 'dist'),
    },
    devServer: {
        historyApiFallback: true,
        static: {
            directory: path.join(__dirname, 'public'),
        },
        proxy: {
            '/api': `http://${process.env.API_HOST_PORT}`,
            '/static': `http://${process.env.API_HOST_PORT}`,
        },
        compress: true,
        port: process.env.REACT_PORT,
    },
    plugins: [
        new HtmlWebpackPlugin({
            template: './index.ejs',
            favicon: './public/favicon.ico',
        }),
        new webpack.DefinePlugin({
            'process.env.AWS_DEFAULT_REGION': JSON.stringify(
                process.env.AWS_DEFAULT_REGION
            ),
            'process.env.BUCKET_NAME': JSON.stringify(process.env.BUCKET_NAME),
            'process.env.REACT_UPLOAD_ENDPOINT': JSON.stringify(
                process.env.REACT_UPLOAD_ENDPOINT
            ),
            'process.env.STORAGE_DRIVER': JSON.stringify(
                process.env.STORAGE_DRIVER
            ),
        }),
    ],
};
