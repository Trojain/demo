module.exports = {
  webpack: {
    configure: config => {
      config.output.library = 'react-app';
      config.output.libraryTarget = 'umd';
      config.output.chunkLoadingGlobal = 'webpackJsonp_reactApp';
      config.output.globalObject = 'window';
      return config;
    }
  }
};
