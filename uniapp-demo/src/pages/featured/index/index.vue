<template>
  <view class="page">
    <view class="header">
      <text class="header__title">热门精选</text>
      <text class="header__desc">选择需要浏览的内容模块</text>
    </view>

    <view class="entry-list">
      <view class="entry-card entry-card--material" @tap="goMaterial">
        <view class="entry-card__content">
          <text class="entry-card__title entry-card__title--light">精选素材</text>
          <text class="entry-card__desc entry-card__desc--light">图片和视频素材查询，支持分类、筛选和下载</text>
        </view>
        <text class="entry-card__arrow entry-card__arrow--light">›</text>
      </view>

      <view class="entry-card entry-card--movie" @tap="goMovie">
        <view class="entry-card__content">
          <text class="entry-card__title entry-card__title--light">热门影视</text>
          <text class="entry-card__desc entry-card__desc--light">热门电影、剧集、趋势推荐、分类浏览、关键词搜索和详情推荐</text>
        </view>
        <text class="entry-card__arrow entry-card__arrow--light">›</text>
      </view>

      <view class="entry-card entry-card--tv" @tap="goTv">
        <view class="entry-card__content">
          <text class="entry-card__title entry-card__title--light">今日追剧</text>
          <text class="entry-card__desc entry-card__desc--light">今日更新、流媒体播出、高评分推荐、剧名搜索和季集浏览</text>
        </view>
        <text class="entry-card__arrow entry-card__arrow--light">›</text>
      </view>

      <!-- <view class="entry-card entry-card--dark" @tap="goWallpaper">
        <view class="entry-card__content">
          <text class="entry-card__title entry-card__title--light">高清壁纸</text>
          <text class="entry-card__desc entry-card__desc--light">高清壁纸分类浏览，支持预览原图和保存到相册</text>
        </view>
        <text class="entry-card__arrow entry-card__arrow--light">›</text>
      </view> -->
    </view>
  </view>
</template>

<script>
import { createPageShareOptions, createPageTimelineOptions } from '@/utils/page-share'

export default {
  onShareAppMessage() {
    return createPageShareOptions({
      title: '热门精选'
    })
  },
  onShareTimeline() {
    return createPageTimelineOptions({
      title: '热门精选'
    })
  },
  methods: {
    goMaterial() {
      uni.navigateTo({
        url: '/pages/material/index/index'
      })
    },
    goMovie() {
      uni.navigateTo({
        url: '/pages/movie/index/index'
      })
    },
    goTv() {
      uni.navigateTo({
        url: '/pages/tv/index/index'
      })
    },
    goWallpaper() {
      uni.navigateTo({
        url: '/pages/wallpaper/index/index'
      })
    }
  }
}
</script>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  box-sizing: border-box;
  padding: 40rpx 28rpx;
  background: #f7f8fb;
}

.header {
  padding: 12rpx 0 24rpx;
}

.header__title {
  display: block;
  color: #101828;
  font-size: 40rpx;
  font-weight: 800;
}

.header__desc {
  display: block;
  margin-top: 12rpx;
  color: #667085;
  font-size: 26rpx;
}

.entry-list {
  margin-top: 28rpx;
}

.entry-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 156rpx;
  margin-bottom: 18rpx;
  padding: 28rpx;
  border-radius: 8rpx;
  background: #ffffff;
  box-shadow: 0 10rpx 28rpx rgba(16, 24, 40, 0.06);
}

.entry-card--dark {
  background: linear-gradient(135deg, #111827, #374151);
  box-shadow: none;
}

.entry-card--material {
  background: linear-gradient(135deg, #0f766e, #164e63);
  box-shadow: none;
}

.entry-card--movie {
  background: linear-gradient(135deg, #1d4ed8, #0f172a);
  box-shadow: none;
}

.entry-card--tv {
  background: linear-gradient(135deg, #166534, #0f172a);
  box-shadow: none;
}

.entry-card__content {
  flex: 1;
}

.entry-card__title {
  display: block;
  color: #101828;
  font-size: 34rpx;
  font-weight: 800;
}

.entry-card__title--light {
  color: #ffffff;
}

.entry-card__desc {
  display: block;
  margin-top: 12rpx;
  color: #667085;
  font-size: 26rpx;
}

.entry-card__desc--light {
  color: rgba(255, 255, 255, 0.82);
}

.entry-card__arrow {
  margin-left: 24rpx;
  color: #98a2b3;
  font-size: 52rpx;
  line-height: 1;
}

.entry-card__arrow--light {
  color: rgba(255, 255, 255, 0.72);
}
</style>
