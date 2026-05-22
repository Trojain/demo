<template>
  <view class="page">
    <image class="preview" :src="wallpaper.imageUrl || wallpaper.previewUrl" mode="aspectFit" @tap="previewImage" />

    <view class="info-panel">
      <text class="info-panel__title">{{ wallpaper.title || '高清壁纸' }}</text>
      <text v-if="wallpaper.categoryName" class="info-panel__meta">分类：{{ wallpaper.categoryName }}</text>
      <text v-if="wallpaper.utag" class="info-panel__meta">壁纸tags：{{ wallpaper.utag }}</text>
      <text v-if="wallpaper.resolution" class="info-panel__meta">分辨率：{{ wallpaper.resolution }}</text>
      <text v-if="wallpaper.createTime" class="info-panel__meta">时间：{{ wallpaper.createTime }}</text>
    </view>

    <view class="action-bar">
      <button class="secondary-button" @tap="previewImage">预览原图</button>
      <button class="primary-button" @tap="saveWallpaper">保存到相册</button>
    </view>
  </view>
</template>

<script>
import { decodeQueryObject } from '@/utils/query'
import { saveNetworkImageToAlbum } from '@/utils/image-save'

export default {
  data() {
    return {
      wallpaper: {},
    }
  },
  onLoad(options) {
    this.wallpaper = decodeQueryObject(options.wallpaper)
  },
  methods: {
    previewImage() {
      const imageUrl = this.wallpaper.imageUrl || this.wallpaper.previewUrl

      if (!imageUrl) {
        return
      }

      uni.previewImage({
        current: imageUrl,
        urls: [imageUrl],
      })
    },
    saveWallpaper() {
      const imageUrl = this.wallpaper.imageUrl || this.wallpaper.previewUrl
      saveNetworkImageToAlbum(imageUrl).catch(() => {})
    },
  },
}
</script>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  box-sizing: border-box;
  padding: 28rpx 28rpx 168rpx;
  background: #101828;
}

.preview {
  display: block;
  width: 100%;
  height: 820rpx;
  border-radius: 8rpx;
  background: #1d2939;
}

.info-panel {
  margin-top: 24rpx;
  padding: 28rpx;
  border-radius: 8rpx;
  background: #ffffff;
}

.info-panel__title {
  display: block;
  color: #101828;
  font-size: 30rpx;
  font-weight: 800;
  line-height: 1.45;
}

.info-panel__meta {
  display: block;
  margin-top: 10rpx;
  color: #667085;
  font-size: 24rpx;
}

.action-bar {
  position: fixed;
  right: 0;
  bottom: 0;
  left: 0;
  display: flex;
  box-sizing: border-box;
  padding: 18rpx 28rpx calc(18rpx + env(safe-area-inset-bottom));
  background: rgba(16, 24, 40, 0.94);
}

.primary-button,
.secondary-button {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  height: 88rpx;
  margin: 0;
  padding: 0;
  border-radius: 8rpx;
  font-size: 28rpx;
  font-weight: 800;
}

.primary-button {
  background: #ffffff;
  color: #101828;
}

.secondary-button {
  background: rgba(255, 255, 255, 0.12);
  color: #ffffff;
  margin-right: 16rpx;
}

.primary-button::after,
.secondary-button::after {
  border: 0;
}
</style>
