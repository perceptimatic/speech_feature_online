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
                use: [
                    {
                        loader: 'ts-loader',
                        options: {
                            transpileOnly: true,
                        },
                    },
                ],
                exclude: /node_modules/,
                include: path.resolve(__dirname, 'src'),
            },
        ],
    },
    mode: 'production',
    resolve: {
        extensions: ['.tsx', '.ts', '.js'],
        /*https://github.com/facebook/create-react-app/issues/11756*/
        fallback: {
            util: require.resolve('util/'),
        },
    },
    output: {
        filename: '[name].[contenthash].js',
        path: path.resolve(__dirname, 'dist'),
    },
    plugins: [
        new HtmlWebpackPlugin({
            template: './index.ejs',
            publicPath: '/',
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
        }),
    ],
};
