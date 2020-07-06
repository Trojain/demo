wx.login({
    success: res => {
        if (res.code) {
            app.globalData.code = res.code; // 获得code 存入全局
        } else {
            console.log('登录失败！' + res.errMsg);
            that.onLogin(); // 重新登录
        }
    },
});

function getSessionKey(code, appid, appSecret) {
    wx.request({
        url: 'https://api.weixin.qq.com/sns/jscode2session',
        data: {
            appid: appid,
            secret: appSecret,
            js_code: code,
            grant_type: 'authorization_code',
        },
        method: 'GET',
        success: function (res) {
            var obj = {
                openid: res.data.openid, // 用户唯一标识
                session_key: res.data.session_key, // 会话密钥
                unionid: res.data.unionid, // 用户在开放平台的唯一标识符
            };
            wx.setStorageSync('user', obj);
        },
    });
}

const crypto = require('crypto');
function encryptSha1(data) {
    return crypto.createHash('sha1').update(data, 'utf8').digest('hex');
}
const skey = encryptSha1(session_key);

let loginFlag = wx.getStorageSync('skey');
if (loginFlag) {
    wx.checkSession({
        // 检查 session_key 是否过期
        success: function () {
            // session_key 有效(未过期)
            // 业务逻辑处理
        },
        // session_key 过期
        fail: function () {
            // session_key过期，重新登录
            that.onLogin();
        },
    });
} else {
    // 无skey，作为首次登录
    that.onLogin();
}


