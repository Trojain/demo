const { name } = require('./package.json');

module.exports = {
    webpack: config => {
        config.output.library = name;
        config.output.libraryTarget = 'umd';
        // webpack 5 需要把 jsonpFunction 替换成 chunkLoadingGlobal
        config.output.chunkLoadingGlobal = `webpackJsonp_${name}`;
        config.output.globalObject = 'window';

        return config;
    },

    devServer: _ => {
        const config = _;
        config.headers = {
            'Access-Control-Allow-Origin': '*'
        };
        config.historyApiFallback = true;
        config.hot = false; // 关闭热更新
        config.watchContentBase = false;
        config.liveReload = false;

        return config;
    }
};
