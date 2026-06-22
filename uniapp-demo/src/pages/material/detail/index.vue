<template>
  <view :class="['page', { 'page--video': isVideo }]">
    <video
      v-if="isVideo"
      class="preview"
      :src="asset.videoUrl"
      :poster="asset.previewUrl"
      controls
      object-fit="contain"
    />
    <image v-else class="preview" :src="asset.previewUrl || asset.imageUrl" mode="aspectFit" />

    <view class="info-panel">
      <text class="info-panel__title">{{ asset.tags || defaultTitle }}</text>
      <text class="info-panel__author">作者：{{ asset.user || '素材来源' }}</text>
      <text v-if="isVideo && asset.duration" class="info-panel__duration">时长：{{ asset.duration }} 秒</text>

      <view class="stats">
        <view class="stats__item">
          <text class="stats__value">{{ asset.views || 0 }}</text>
          <text class="stats__label">浏览</text>
        </view>
        <view class="stats__item">
          <text class="stats__value">{{ asset.downloads || 0 }}</text>
          <text class="stats__label">下载</text>
        </view>
        <view class="stats__item">
          <text class="stats__value">{{ asset.likes || 0 }}</text>
          <text class="stats__label">喜欢</text>
        </view>
      </view>
    </view>

    <view class="action-bar">
      <button class="save-button" @tap="saveMedia">保存到相册</button>
    </view>
  </view>
</template>

<script>
import { decodeQueryObject } from '@/utils/query'
import { saveNetworkImageToAlbum, saveNetworkVideoToAlbum } from '@/utils/image-save'
import { createPageShareOptions, createPageTimelineOptions } from '@/utils/page-share'

export default {
  data() {
    return {
      asset: {}
    }
  },
  computed: {
    isVideo() {
      return this.asset.mediaType === 'video'
    },
    defaultTitle() {
      return this.isVideo ? '视频素材' : '素材'
    }
  },
  onShareAppMessage() {
    return createPageShareOptions({
      title: this.defaultTitle
    })
  },
  onShareTimeline() {
    return createPageTimelineOptions({
      title: this.defaultTitle
    })
  },
  onLoad(options) {
    this.asset = decodeQueryObject(options.media || options.image)
  },
  methods: {
    saveMedia() {
      if (this.isVideo) {
        const videoUrl = this.asset.videoUrl
        saveNetworkVideoToAlbum(videoUrl).catch(() => {})
        return
      }

      const imageUrl = this.asset.imageUrl || this.asset.previewUrl
      saveNetworkImageToAlbum(imageUrl).catch(() => {})
    }
  }
}
</script>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  box-sizing: border-box;
  padding: 28rpx 28rpx 148rpx;
  background: #101828;
}

.page--video {
  padding-bottom: 40rpx;
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

.info-panel__author {
  display: block;
  margin-top: 12rpx;
  color: #667085;
  font-size: 24rpx;
}

.info-panel__duration {
  display: block;
  margin-top: 8rpx;
  color: #667085;
  font-size: 24rpx;
}

.stats {
  display: flex;
  margin-top: 28rpx;
}

.stats__item {
  flex: 1;
}

.stats__value {
  display: block;
  color: #111827;
  font-size: 28rpx;
  font-weight: 800;
}

.stats__label {
  display: block;
  margin-top: 6rpx;
  color: #98a2b3;
  font-size: 22rpx;
}

.action-bar {
  position: fixed;
  right: 0;
  bottom: 0;
  left: 0;
  box-sizing: border-box;
  padding: 18rpx 28rpx calc(18rpx + env(safe-area-inset-bottom));
  background: rgba(16, 24, 40, 0.94);
}

.save-button {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 88rpx;
  margin: 0;
  padding: 0;
  border-radius: 8rpx;
  background: #ffffff;
  color: #101828;
  font-size: 30rpx;
  font-weight: 800;
}

.save-button::after {
  border: 0;
}
</style>
