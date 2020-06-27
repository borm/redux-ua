'use strict';
import path from 'path';
import TerserPlugin from 'terser-webpack-plugin';

const env = process.env.NODE_ENV || 'development';
const isDev = env === 'development';

const source = path.join(__dirname, 'src');
const output = path.join(__dirname);

export default {
  devtool: isDev ? 'source-map' : false,
  mode: env,
  context: source,
  resolve: {
    modules: ['node_modules', source],
    extensions: ['.js'],
  },
  entry: './index.ts',
  output: {
    path: output,
    filename: `dist/redux-ua${isDev ? '.js' : '.min.js'}`,
    library: 'ReduxUA',
    libraryTarget: 'umd',
    umdNamedDefine: true,
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
      {
        test: /(\.js)$/,
        loader: 'babel-loader',
        exclude: /(node_modules)/,
      },
    ],
  },
  optimization: {
    minimizer: [
      new TerserPlugin({
        terserOptions: {
          compress: {
            // Drop console statements
            drop_console: true,
            // remove debugger; statements
            drop_debugger: true,
          },
        },
      }),
    ],
  },
};
