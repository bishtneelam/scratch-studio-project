// Tailwind 2 uses NODE_ENV to enable production purging.
process.env.NODE_ENV = 'production';
const path = require('path');
const { merge } = require('webpack-merge');
const common = require('./webpack.common');
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = merge(common, {
  mode: 'production',
  devtool: false,
  output: { path: path.resolve(__dirname, 'build'), clean: true },
  optimization: {
    minimize: true,
    minimizer: ['...', new CssMinimizerPlugin()],
  },
  plugins: [new CopyWebpackPlugin({ patterns: [{
    from: path.resolve(__dirname, 'public'),
    to: '.',
    globOptions: { ignore: ['**/app.js', '**/app.css', '**/*.LICENSE.txt', '**/icons/**'] },
  }] })],
});
