<template>
  <view class="page">
    <view class="hero">
      <text class="hero__title">免费去水印</text>
      <text class="hero__desc">免费去短视频水印可预览并保存到相册</text>
    </view>

    <view class="parser-panel">
      <view class="parser-panel__top">
        <text class="parser-panel__label">粘贴链接</text>
        <button class="paste-button" @tap="pasteClipboard">粘贴</button>
      </view>

      <textarea
        class="parser-panel__input"
        v-model="sourceText"
        maxlength="800"
        auto-height
        placeholder="粘贴短视频分享链接或分享文案"
        placeholder-class="parser-panel__placeholder"
      />

      <view class="parser-panel__meta">
        <text class="parser-panel__platform">识别平台：{{ platformLabel }}</text>
        <text class="parser-panel__count">{{ sourceText.length }}/800</text>
      </view>

      <view class="parser-panel__actions">
        <button class="action-button action-button--ghost" @tap="clearInput">清空</button>
        <button class="action-button action-button--primary" :disabled="loading" @tap="parseVideo">
          {{ loading ? '解析中' : '开始解析' }}
        </button>
      </view>
    </view>

    <view class="disclaimer">
      <text class="disclaimer__text"
        >免责声明：版权归平台及作者所有，本程序不存储任何内容；内容使用及侵权责任由使用人承担，服务按现状提供，不承担第三方内容责任。</text
      >
    </view>

    <view v-if="errorMessage" class="state-card state-card--error">
      <text class="state-card__title">解析失败</text>
      <text class="state-card__desc">{{ errorMessage }}</text>
    </view>

    <view v-if="video.videoUrl" class="result-panel">
      <video class="result-panel__video" :src="video.videoUrl" :poster="video.coverUrl" controls object-fit="contain" />

      <view class="result-panel__body">
        <view class="result-panel__header">
          <text class="result-panel__title">{{ video.title }}</text>
          <text class="result-panel__badge">{{ video.platformLabel }}</text>
        </view>

        <view class="info-list">
          <view class="info-list__item">
            <text class="info-list__label">作者</text>
            <text class="info-list__value">{{ video.author }}</text>
          </view>
          <view v-if="video.duration" class="info-list__item">
            <text class="info-list__label">时长</text>
            <text class="info-list__value">{{ video.duration }} 秒</text>
          </view>
          <view v-if="video.videoId" class="info-list__item">
            <text class="info-list__label">作品ID</text>
            <text class="info-list__value">{{ video.videoId }}</text>
          </view>
        </view>
      </view>

      <button class="save-button" @tap="saveVideo">保存到相册</button>
    </view>

    <view v-if="!video.videoUrl && !errorMessage" class="state-card">
      <text class="state-card__title">等待解析</text>
      <text class="state-card__desc">支持单条短视频链接。解析成功后会在这里展示短视频信息。</text>
    </view>
  </view>
</template>

<script>
import { detectVideoPlatform, parseShortVideo, VIDEO_ERROR_CODES } from '@/services/video-api'
import { saveNetworkVideoToAlbum } from '@/utils/image-save'
import { createPageShareOptions, createPageTimelineOptions } from '@/utils/page-share'

export default {
  data() {
    return {
      sourceText: '',
      loading: false,
      errorMessage: '',
      video: {},
    }
  },
  computed: {
    platformLabel() {
      const platform = detectVideoPlatform(this.sourceText)

      if (platform === 'douyin') {
        return '抖音'
      }

      if (platform === 'kuaishou') {
        return '快手'
      }

      if (platform === 'tiktok') {
        return 'TikTok'
      }

      return '待识别'
    },
  },
  onShareAppMessage() {
    return createPageShareOptions({
      title: '免费去水印',
    })
  },
  onShareTimeline() {
    return createPageTimelineOptions({
      title: '免费去水印',
    })
  },
  methods: {
    clearInput() {
      this.sourceText = ''
      this.errorMessage = ''
      this.video = {}
    },
    pasteClipboard() {
      uni.getClipboardData({
        success: res => {
          const text = String(res.data || '').trim()

          if (!text) {
            uni.showToast({
              title: '剪贴板为空',
              icon: 'none',
            })
            return
          }

          this.sourceText = text
          this.errorMessage = ''
          this.video = {}
        },
        fail: () => {
          uni.showToast({
            title: '读取剪贴板失败',
            icon: 'none',
          })
        },
      })
    },
    getErrorMessage(error) {
      if (error.code === VIDEO_ERROR_CODES.TOKEN_MISSING) {
        return '请先在 src/config/video.js 中配置 TikHub Token'
      }

      if (error.code === VIDEO_ERROR_CODES.RATE_LIMIT) {
        return '请求频繁，稍后再试'
      }

      if (error.code === VIDEO_ERROR_CODES.AUTH_FAILED) {
        return 'Token 无效或暂无接口权限'
      }

      if (error.code === VIDEO_ERROR_CODES.QUOTA_EMPTY) {
        return 'TikHub 额度不足，请检查账号额度'
      }

      return error.message || '短视频解析失败'
    },
    parseVideo() {
      if (this.loading) {
        return
      }

      this.loading = true
      this.errorMessage = ''
      this.video = {}

      parseShortVideo(this.sourceText)
        .then(video => {
          this.video = video
          uni.showToast({
            title: '解析成功',
            icon: 'success',
          })
        })
        .catch(error => {
          this.errorMessage = this.getErrorMessage(error)
          uni.showToast({
            title: this.errorMessage,
            icon: 'none',
          })
        })
        .finally(() => {
          this.loading = false
        })
    },
    saveVideo() {
      saveNetworkVideoToAlbum(this.video.videoUrl).catch(() => {})
    },
  },
}
</script>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  box-sizing: border-box;
  padding: 32rpx 28rpx 48rpx;
  background: #f7f8fb;
}

.hero {
  padding: 12rpx 0 28rpx;
}

.hero__title {
  display: block;
  color: #101828;
  font-size: 42rpx;
  font-weight: 800;
}

.hero__desc {
  display: block;
  margin-top: 12rpx;
  color: #667085;
  font-size: 26rpx;
  line-height: 1.55;
}

.parser-panel,
.result-panel,
.state-card {
  border-radius: 8rpx;
  background: #ffffff;
  box-shadow: 0 10rpx 28rpx rgba(16, 24, 40, 0.06);
}

.parser-panel {
  padding: 28rpx;
}

.parser-panel__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 18rpx;
}

.parser-panel__label {
  color: #101828;
  font-size: 28rpx;
  font-weight: 800;
}

.paste-button {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 56rpx;
  min-width: 104rpx;
  margin: 0;
  padding: 0 22rpx;
  border-radius: 8rpx;
  background: #e6f4f1;
  color: #0f766e;
  font-size: 24rpx;
  font-weight: 800;
}

.paste-button::after {
  border: 0;
}

.parser-panel__input {
  width: 100%;
  min-height: 176rpx;
  color: #101828;
  font-size: 28rpx;
  line-height: 1.55;
}

.parser-panel__placeholder {
  color: #98a2b3;
}

.parser-panel__meta {
  display: flex;
  justify-content: space-between;
  margin-top: 20rpx;
}

.parser-panel__platform,
.parser-panel__count {
  color: #667085;
  font-size: 24rpx;
}

.parser-panel__actions {
  display: flex;
  gap: 16rpx;
  margin-top: 28rpx;
}

.disclaimer {
  margin-top: 18rpx;
  padding: 18rpx 22rpx;
  border-radius: 8rpx;
  background: #fff7ed;
}

.disclaimer__text {
  display: block;
  color: #9a3412;
  font-size: 23rpx;
  line-height: 1.55;
}

.action-button,
.save-button {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 84rpx;
  margin: 0;
  padding: 0;
  border-radius: 8rpx;
  font-size: 28rpx;
  font-weight: 800;
}

.action-button::after,
.save-button::after {
  border: 0;
}

.action-button {
  flex: 1;
}

.action-button--ghost {
  background: #eef0f4;
  color: #475467;
}

.action-button--primary,
.save-button {
  background: #0f766e;
  color: #ffffff;
}

.action-button--primary[disabled] {
  background: #9fbfba;
  color: rgba(255, 255, 255, 0.86);
}

.state-card {
  margin-top: 24rpx;
  padding: 28rpx;
}

.state-card--error {
  background: #fff4f3;
}

.state-card__title {
  display: block;
  color: #101828;
  font-size: 30rpx;
  font-weight: 800;
}

.state-card__desc {
  display: block;
  margin-top: 12rpx;
  color: #667085;
  font-size: 25rpx;
  line-height: 1.55;
}

.result-panel {
  overflow: hidden;
  margin-top: 24rpx;
}

.result-panel__video {
  display: block;
  width: 100%;
  height: 720rpx;
  background: #101828;
}

.result-panel__body {
  padding: 28rpx;
}

.result-panel__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}

.result-panel__title {
  flex: 1;
  color: #101828;
  font-size: 30rpx;
  font-weight: 800;
  line-height: 1.45;
}

.result-panel__badge {
  flex-shrink: 0;
  margin-left: 18rpx;
  padding: 8rpx 14rpx;
  border-radius: 8rpx;
  background: #e6f4f1;
  color: #0f766e;
  font-size: 22rpx;
  font-weight: 800;
}

.info-list {
  margin-top: 22rpx;
}

.info-list__item {
  display: flex;
  justify-content: space-between;
  padding: 12rpx 0;
}

.info-list__label {
  flex-shrink: 0;
  color: #98a2b3;
  font-size: 24rpx;
}

.info-list__value {
  margin-left: 24rpx;
  color: #475467;
  font-size: 24rpx;
  text-align: right;
  word-break: break-all;
}

.save-button {
  margin: 0 28rpx 28rpx;
}
</style>
