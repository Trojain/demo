const { defineConfig } = require('@vue/cli-service');
const { name } = require('./package.json');

module.exports = defineConfig({
    transpileDependencies: true,
    devServer: {
        open: false,
        port: 3001,
        headers: {
            'Access-Control-Allow-Origin': '*'
        }
    },
    configureWebpack: {
        output: {
            library: name,
            libraryTarget: 'umd',
            chunkLoadingGlobal: `webpackJsonp_${name}`
        }
    }
});
