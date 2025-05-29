const webpack = require('webpack');
const { addBeforeLoader, loaderByName } = require('@craco/craco');

module.exports = {
  webpack: {
    configure: (webpackConfig) => {
      // Add support for .mjs files
      const mjsRule = {
        test: /\.mjs$/,
        include: /node_modules/,
        type: "javascript/auto",
        resolve: {
          fullySpecified: false
        }
      };
      
      // Add the rule before the babel-loader
      addBeforeLoader(webpackConfig, loaderByName('babel-loader'), mjsRule);

      // Add polyfills
      webpackConfig.resolve.fallback = {
        ...(webpackConfig.resolve.fallback || {}),
        "process": require.resolve("process/browser"),
        "stream": require.resolve("stream-browserify"),
        "util": require.resolve("util/"),
        "buffer": require.resolve("buffer/")
      };

      // Add plugins
      webpackConfig.plugins.push(
        new webpack.ProvidePlugin({
          process: 'process/browser',
          Buffer: ['buffer', 'Buffer'],
        })
      );

      return webpackConfig;
    }
  }
};