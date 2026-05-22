<template>
  <view class="page">
    <view class="profile-card">
      <text class="profile-card__title">我的</text>
      <text class="profile-card__desc">下载的素材和壁纸会保存到系统相册，本页后续可扩展下载记录和收藏。</text>
    </view>

    <!-- <view class="notice-card">
      <text class="notice-card__title">使用前配置</text>
      <text class="notice-card__item">1. 在 src/config/material.js、src/config/movie.js、src/config/tv.js 中维护素材、影视和追剧模块的接口配置。</text>
      <text class="notice-card__item">2. 在小程序后台配置 pixabay.com、cdn.pixabay.com、cdn.apc.360.cn、wallpaper.apc.360.cn、api.themoviedb.org、image.tmdb.org、api.tvmaze.com、static.tvmaze.com 及各模块实际返回的资源域名。</text>
      <text class="notice-card__item">3. 保存素材和壁纸时按平台提示授权相册权限。</text>
    </view> -->

  </view>
</template>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  box-sizing: border-box;
  padding: 32rpx 28rpx 40rpx;
  background: #f7f8fb;
}

.profile-card,
.notice-card {
  padding: 32rpx 28rpx;
  border-radius: 8rpx;
  background: #ffffff;
}

.profile-card__title,
.notice-card__title {
  display: block;
  color: #101828;
  font-size: 34rpx;
  font-weight: 800;
}

.profile-card__desc {
  display: block;
  margin-top: 16rpx;
  color: #667085;
  font-size: 26rpx;
  line-height: 1.6;
}

.notice-card {
  margin-top: 24rpx;
}

.notice-card__item {
  display: block;
  margin-top: 18rpx;
  color: #475467;
  font-size: 26rpx;
  line-height: 1.55;
}

</style>
