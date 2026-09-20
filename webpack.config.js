const path = require('path');
const fs = require('fs');
const webpack = require('webpack');
require('dotenv').config();

module.exports = {
  mode: process.env.NODE_ENV === 'production' ? 'production' : 'development',
  devtool: process.env.NODE_ENV === 'production' ? false : 'inline-source-map',
  entry: {
    content: './src/content.ts',
    background: './src/background.ts',
    popup: './src/popup.ts'
  },
  module: {
    rules: [
      {
        // Import CSS files as plain strings (injected into the page by the
        // content script — no css-loader/style-loader needed).
        test: /\.css$/,
        type: "asset/source",
      },
      {
        test: /\.tsx?$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: [
              '@babel/preset-env',
              '@babel/preset-typescript'
            ]
          }
        }
      },
    ],
  },
  resolve: {
    extensions: [ '.tsx', '.ts', '.js' ],
  },
  output: {
    filename: '[name].bundle.js',
    path: path.resolve(__dirname, 'dist'),
    clean: true,
    globalObject: 'self',
  },
  plugins: [
    new webpack.DefinePlugin({
      __LOCATION__: JSON.stringify(process.env.LOCATION || ''),
    }),
    {
      apply: (compiler) => {
        compiler.hooks.afterEmit.tap('CopyExtensionFilesPlugin', () => {
          const filesToCopy = ['manifest.json', 'popup.html'];

          filesToCopy.forEach((file) => {
            const srcPath = path.resolve(__dirname, 'src', file);
            const destPath = path.resolve(__dirname, 'dist', file);

            if (fs.existsSync(srcPath)) {
              fs.copyFileSync(srcPath, destPath);
            }
          });
        });
      }
    }
  ]
};