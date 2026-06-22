<template>
  <view class="page">
    <view class="hero">
      <image class="hero__backdrop" :src="detail.backdropUrl || detail.posterUrl" mode="aspectFill" />
      <view class="hero__overlay"></view>
      <view class="hero__content">
        <image class="hero__poster" :src="detail.posterUrl || detail.backdropUrl" mode="aspectFill" />
        <view class="hero__info">
          <text class="hero__type">{{ detail.mediaType === 'tv' ? '剧集' : '电影' }}</text>
          <text class="hero__title">{{ detail.title || '影视详情' }}</text>
          <text v-if="detail.originalTitle && detail.originalTitle !== detail.title" class="hero__subtitle">{{ detail.originalTitle }}</text>
          <text class="hero__meta">评分 {{ detail.voteAverage.toFixed(1) }} · {{ detail.releaseDate || '待定档期' }}</text>
        </view>
      </view>
    </view>

    <view v-if="errorMessage" class="notice-card">
      <text class="notice-card__title">详情内容暂时不可用</text>
      <text class="notice-card__desc">{{ errorMessage }}</text>
      <view class="notice-card__action" @tap="fetchDetailData(currentId, currentMediaType)">重新加载</view>
    </view>

    <view class="info-panel">
      <view class="genre-list">
        <view v-for="item in detail.genres" :key="item.id" class="genre-chip">
          <text>{{ item.label }}</text>
        </view>
      </view>

      <text v-if="detail.tagline" class="info-panel__tagline">{{ detail.tagline }}</text>
      <view class="meta-strip">
        <view class="meta-strip__item">
          <text class="meta-strip__label">评分</text>
          <text class="meta-strip__value">{{ detail.voteAverage.toFixed(1) }}</text>
        </view>
        <view class="meta-strip__item">
          <text class="meta-strip__label">日期</text>
          <text class="meta-strip__value">{{ detail.releaseDate || '待定' }}</text>
        </view>
        <view class="meta-strip__item">
          <text class="meta-strip__label">语言</text>
          <text class="meta-strip__value">{{ detail.originalLanguage || '未知' }}</text>
        </view>
      </view>

      <view class="content-block">
        <text class="content-block__title">内容简介</text>
        <text class="info-panel__overview">{{ detail.overview || '暂无简介。' }}</text>
      </view>

      <view class="detail-grid">
        <view class="detail-item">
          <text class="detail-item__label">状态</text>
          <text class="detail-item__value">{{ detail.status || '未知' }}</text>
        </view>
        <view class="detail-item">
          <text class="detail-item__label">票数</text>
          <text class="detail-item__value">{{ detail.voteCount || '未知' }}</text>
        </view>
        <view class="detail-item">
          <text class="detail-item__label">{{ detail.mediaType === 'tv' ? '季数' : '时长' }}</text>
          <text class="detail-item__value">{{ runtimeLabel }}</text>
        </view>
        <view class="detail-item">
          <text class="detail-item__label">{{ detail.mediaType === 'tv' ? '集数' : '地区' }}</text>
          <text class="detail-item__value">{{ secondaryMetaLabel }}</text>
        </view>
      </view>
    </view>

    <view v-if="recommendations.length > 0" class="recommend-section">
      <view class="recommend-section__header">
        <text class="recommend-section__title">相关推荐</text>
      </view>

      <scroll-view scroll-x class="recommend-scroll" :show-scrollbar="false">
        <view class="recommend-row">
          <view v-for="item in recommendations" :key="`${item.mediaType}-${item.id}`" class="recommend-card" @tap="goDetail(item)">
            <image class="recommend-card__image" :src="item.posterUrl || item.backdropUrl" mode="aspectFill" />
            <view class="recommend-card__meta">
              <text class="recommend-card__badge">{{ item.mediaType === 'tv' ? '剧集' : '电影' }}</text>
              <text class="recommend-card__title">{{ item.title }}</text>
              <text class="recommend-card__desc">{{ item.releaseDate || '待定档期' }}</text>
            </view>
          </view>
        </view>
      </scroll-view>
    </view>
  </view>
</template>

<script>
import { fetchMovieDetail, fetchMovieRecommendations, getMovieErrorMessage } from '@/services/movie-api'
import { decodeQueryObject, encodeQueryObject } from '@/utils/query'
import { createPageShareOptions, createPageTimelineOptions } from '@/utils/page-share'

export default {
  data() {
    return {
      detail: {
        mediaType: 'movie',
        title: '',
        originalTitle: '',
        tagline: '',
        overview: '',
        backdropUrl: '',
        posterUrl: '',
        voteAverage: 0,
        releaseDate: '',
        status: '',
        originalLanguage: '',
        genres: [],
        runtime: 0,
        numberOfSeasons: 0,
        numberOfEpisodes: 0,
        episodeRunTime: [],
        productionCountries: ''
      },
      recommendations: [],
      currentId: '',
      currentMediaType: 'movie',
      errorMessage: ''
    }
  },
  computed: {
    runtimeLabel() {
      if (this.detail.mediaType === 'tv') {
        return this.detail.numberOfSeasons ? `${this.detail.numberOfSeasons} 季` : '未知'
      }

      return this.detail.runtime ? `${this.detail.runtime} 分钟` : '未知'
    },
    secondaryMetaLabel() {
      if (this.detail.mediaType === 'tv') {
        return this.detail.numberOfEpisodes ? `${this.detail.numberOfEpisodes} 集` : '未知'
      }

      return this.detail.productionCountries || '未知'
    }
  },
  onShareAppMessage() {
    return createPageShareOptions({
      title: this.detail.title || '影视详情'
    })
  },
  onShareTimeline() {
    return createPageTimelineOptions({
      title: this.detail.title || '影视详情'
    })
  },
  onLoad(options) {
    const query = decodeQueryObject(options.query)
    this.currentId = query.id || ''
    this.currentMediaType = query.mediaType || 'movie'
    this.fetchDetailData(query.id, query.mediaType)
  },
  methods: {
    fetchDetailData(id, mediaType) {
      if (!id) {
        uni.showToast({
          title: '缺少影视编号',
          icon: 'none'
        })
        return
      }

      this.currentId = id
      this.currentMediaType = mediaType === 'tv' ? 'tv' : 'movie'
      this.errorMessage = ''
      Promise.all([
        fetchMovieDetail({ id, mediaType }),
        fetchMovieRecommendations({ id, mediaType })
      ])
        .then(([detail, recommendations]) => {
          this.detail = detail
          this.recommendations = recommendations
        })
        .catch((error) => {
          this.errorMessage = getMovieErrorMessage(error)
          uni.showToast({
            title: this.errorMessage,
            icon: 'none'
          })
        })
    },
    goDetail(item) {
      uni.navigateTo({
        url: `/pages/movie/detail/index?query=${encodeQueryObject({
          id: item.id,
          mediaType: item.mediaType
        })}`
      })
    }
  }
}
</script>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  background: #0f172a;
}

.notice-card {
  margin: 24rpx 28rpx 0;
  padding: 24rpx;
  border-radius: 8rpx;
  background: #fff4ed;
}

.notice-card__title {
  display: block;
  color: #9a3412;
  font-size: 28rpx;
  font-weight: 800;
}

.notice-card__desc {
  display: block;
  margin-top: 10rpx;
  color: #c2410c;
  font-size: 24rpx;
  line-height: 1.55;
}

.notice-card__action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 144rpx;
  height: 54rpx;
  margin-top: 16rpx;
  padding: 0 16rpx;
  border-radius: 8rpx;
  background: #111827;
  color: #ffffff;
  font-size: 22rpx;
  font-weight: 700;
}

.hero {
  position: relative;
  min-height: 520rpx;
}

.hero__backdrop,
.hero__overlay {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
}

.hero__backdrop {
  width: 100%;
  height: 100%;
}

.hero__overlay {
  background: linear-gradient(180deg, rgba(15, 23, 42, 0.16), rgba(15, 23, 42, 0.94));
}

.hero__content {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: flex-end;
  padding: 240rpx 28rpx 40rpx;
}

.hero__poster {
  flex-shrink: 0;
  width: 208rpx;
  height: 292rpx;
  border-radius: 8rpx;
  background: rgba(255, 255, 255, 0.12);
}

.hero__info {
  flex: 1;
  margin-left: 20rpx;
}

.hero__type {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 40rpx;
  padding: 0 12rpx;
  border-radius: 8rpx;
  background: rgba(255, 255, 255, 0.14);
  color: #ffffff;
  font-size: 20rpx;
}

.hero__title {
  display: block;
  margin-top: 12rpx;
  color: #ffffff;
  font-size: 36rpx;
  font-weight: 800;
  line-height: 1.35;
}

.hero__subtitle {
  display: block;
  margin-top: 10rpx;
  color: rgba(255, 255, 255, 0.76);
  font-size: 24rpx;
}

.hero__meta {
  display: block;
  margin-top: 12rpx;
  color: rgba(255, 255, 255, 0.82);
  font-size: 24rpx;
}

.info-panel,
.recommend-section {
  margin: 24rpx 28rpx 0;
  padding: 28rpx;
  border-radius: 8rpx;
  background: #ffffff;
}

.genre-list {
  display: flex;
  flex-wrap: wrap;
}

.genre-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 52rpx;
  margin-right: 12rpx;
  margin-bottom: 12rpx;
  padding: 0 18rpx;
  border-radius: 8rpx;
  background: #eef1f5;
  color: #475467;
  font-size: 22rpx;
  font-weight: 700;
}

.info-panel__tagline {
  display: block;
  margin-top: 12rpx;
  color: #475467;
  font-size: 24rpx;
}

.meta-strip {
  display: flex;
  justify-content: space-between;
  margin-top: 20rpx;
  padding: 20rpx;
  border-radius: 8rpx;
  background: #f7f8fb;
}

.meta-strip__item {
  width: 31%;
}

.meta-strip__label {
  display: block;
  color: #98a2b3;
  font-size: 20rpx;
}

.meta-strip__value {
  display: block;
  margin-top: 8rpx;
  color: #111827;
  font-size: 24rpx;
  font-weight: 700;
}

.content-block {
  margin-top: 20rpx;
}

.content-block__title {
  display: block;
  color: #111827;
  font-size: 28rpx;
  font-weight: 800;
}

.info-panel__overview {
  display: block;
  margin-top: 14rpx;
  color: #172033;
  font-size: 26rpx;
  line-height: 1.75;
}

.detail-grid {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  margin-top: 24rpx;
}

.detail-item {
  width: 48.5%;
  margin-bottom: 16rpx;
  padding: 20rpx;
  border-radius: 8rpx;
  background: #f7f8fb;
}

.detail-item__label {
  display: block;
  color: #98a2b3;
  font-size: 22rpx;
}

.detail-item__value {
  display: block;
  margin-top: 10rpx;
  color: #111827;
  font-size: 24rpx;
  font-weight: 700;
}

.recommend-section__title {
  display: block;
  color: #101828;
  font-size: 30rpx;
  font-weight: 800;
}

.recommend-scroll {
  margin-top: 18rpx;
  white-space: nowrap;
}

.recommend-row {
  display: inline-flex;
  padding-right: 12rpx;
}

.recommend-card {
  overflow: hidden;
  width: 212rpx;
  margin-right: 16rpx;
  border-radius: 8rpx;
  background: #f7f8fb;
}

.recommend-card__image {
  display: block;
  width: 100%;
  height: 296rpx;
  background: #d0d5dd;
}

.recommend-card__meta {
  padding: 14rpx;
}

.recommend-card__badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 36rpx;
  padding: 0 10rpx;
  border-radius: 8rpx;
  background: #eef1f5;
  color: #475467;
  font-size: 20rpx;
}

.recommend-card__title,
.recommend-card__desc {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.recommend-card__title {
  margin-top: 10rpx;
  color: #172033;
  font-size: 24rpx;
  font-weight: 700;
}

.recommend-card__desc {
  margin-top: 8rpx;
  color: #98a2b3;
  font-size: 22rpx;
}
</style>
