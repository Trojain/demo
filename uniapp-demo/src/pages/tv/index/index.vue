<template>
  <view class="page">
    <view class="hero-card">
      <text class="hero-card__title">今日追剧</text>
      <text class="hero-card__desc">看看今天更新了什么，也能提前知道明天有什么可追。</text>

      <view class="hero-actions">
        <view class="hero-search" @tap="goSearch()">
          <text class="hero-search__icon">⌕</text>
          <text class="hero-search__text">搜索剧名 / 演员</text>
        </view>

        <view class="hero-link" @tap="goSearchByGenre()">
          <text>按类型看</text>
        </view>
      </view>
    </view>

    <view class="region-switch">
      <view
        v-for="item in regionOptions"
        :key="item.value"
        :class="['region-switch__item', { 'region-switch__item--active': currentRegion === item.value }]"
        @tap="switchRegion(item.value)"
      >
        <text>{{ item.label }}</text>
      </view>
    </view>

    <view v-if="errorMessage" class="notice-card">
      <text class="notice-card__title">剧集接口当前不可用</text>
      <text class="notice-card__desc">{{ errorMessage }}</text>
      <view class="notice-card__action" @tap="fetchHomeData">重新加载</view>
    </view>

    <view v-if="isLoading" class="state-card">
      <text>剧集数据加载中...</text>
    </view>

    <template v-else>
      <view class="section">
        <view class="section__header">
          <text class="section__title">类型入口</text>
          <text class="section__meta">{{ genres.length }} 个常用类型</text>
        </view>
        <view class="genre-list">
          <view v-for="item in genres" :key="item.value" class="genre-chip" @tap="goSearchByGenre(item)">
            <text>{{ item.label }}</text>
          </view>
        </view>
      </view>

      <view class="section">
        <view class="section__header">
          <text class="section__title">今日更新</text>
          <text class="section__meta">{{ today }}</text>
        </view>
        <scroll-view scroll-x class="poster-scroll" :show-scrollbar="false">
          <view class="poster-row">
            <view v-for="item in todayEpisodes" :key="item.id" class="poster-card" @tap="goShowDetail(item.showId)">
              <image class="poster-card__image" :src="item.posterUrl" mode="aspectFill" />
              <view class="poster-card__meta">
                <text class="poster-card__title">{{ item.showName }}</text>
                <text class="poster-card__desc">S{{ item.seasonNumber }} · E{{ item.episodeNumber }}</text>
                <text class="poster-card__desc">{{ item.airtime || '待定时间' }}</text>
              </view>
            </view>
          </view>
        </scroll-view>
      </view>

      <view class="section">
        <view class="section__header">
          <text class="section__title">流媒体更新</text>
          <text class="section__meta">{{ currentRegionLabel }}</text>
        </view>
        <view class="timeline-list">
          <view v-for="item in webEpisodes" :key="item.id" class="timeline-card" @tap="goShowDetail(item.showId)">
            <image class="timeline-card__image" :src="item.posterUrl" mode="aspectFill" />
            <view class="timeline-card__content">
              <text class="timeline-card__title">{{ item.showName }}</text>
              <text class="timeline-card__meta">{{ item.networkName || '平台待补充' }} · {{ item.airtime || '待定时间' }}</text>
              <text class="timeline-card__desc">{{ item.title || '单集标题待补充' }}</text>
            </view>
          </view>
        </view>
      </view>

      <view class="section">
        <view class="section__header">
          <text class="section__title">明日预告</text>
          <text class="section__meta">{{ tomorrow }}</text>
        </view>
        <view class="forecast-list">
          <view v-for="item in tomorrowEpisodes" :key="item.id" class="forecast-card" @tap="goShowDetail(item.showId)">
            <image v-if="item.posterUrl" class="forecast-card__image" :src="item.posterUrl" mode="aspectFill" />
            <view v-else class="forecast-card__image forecast-card__image--placeholder"></view>
            <view class="forecast-card__content">
              <text class="forecast-card__clock">{{ item.airtime || '待定' }}</text>
              <text class="forecast-card__title">{{ item.showName }}</text>
              <text class="forecast-card__meta">S{{ item.seasonNumber }} · E{{ item.episodeNumber }}</text>
              <text class="forecast-card__desc">{{ item.title || '单集标题待补充' }}</text>
            </view>
          </view>
        </view>
      </view>

      <view class="section">
        <view class="section__header">
          <text class="section__title">高评分推荐</text>
          <text class="section__more" @tap="goSearchByGenre()">更多剧集</text>
        </view>
        <view class="feature-grid">
          <view v-for="item in featuredShows" :key="item.id" class="feature-card" @tap="goShowDetail(item.id)">
            <image class="feature-card__image" :src="item.imageUrl" mode="aspectFill" />
            <view class="feature-card__overlay"></view>
            <view class="feature-card__content">
              <text class="feature-card__score">评分 {{ item.rating.toFixed(1) }}</text>
              <text class="feature-card__title">{{ item.name }}</text>
              <text class="feature-card__desc">{{ item.genres.join(' / ') || '类型待补充' }}</text>
            </view>
          </view>
        </view>
      </view>
    </template>
  </view>
</template>

<script>
import { fetchTvHomeData, getTvErrorMessage, getTvRegionOptions } from '@/services/tv-api'
import { encodeQueryObject } from '@/utils/query'

export default {
  data() {
    return {
      isLoading: false,
      errorMessage: '',
      regionOptions: getTvRegionOptions(),
      currentRegion: 'CN',
      today: '',
      tomorrow: '',
      todayEpisodes: [],
      webEpisodes: [],
      tomorrowEpisodes: [],
      featuredShows: [],
      genres: []
    }
  },
  computed: {
    currentRegionLabel() {
      const matched = this.regionOptions.find(item => item.value === this.currentRegion)
      return matched ? matched.label : '国内'
    }
  },
  onLoad() {
    this.fetchHomeData()
  },
  methods: {
    switchRegion(region) {
      if (this.currentRegion === region) {
        return
      }

      this.currentRegion = region
      this.fetchHomeData()
    },
    fetchHomeData() {
      if (this.isLoading) {
        return
      }

      this.isLoading = true
      this.errorMessage = ''
      fetchTvHomeData(this.currentRegion)
        .then((data) => {
          this.today = data.today
          this.tomorrow = data.tomorrow
          this.todayEpisodes = data.todayEpisodes
          this.webEpisodes = data.webEpisodes
          this.tomorrowEpisodes = data.tomorrowEpisodes
          this.featuredShows = data.featuredShows
          this.genres = data.genres
        })
        .catch((error) => {
          this.errorMessage = getTvErrorMessage(error)
          uni.showToast({
            title: this.errorMessage,
            icon: 'none'
          })
        })
        .then(() => {
          this.isLoading = false
        })
    },
    goSearch() {
      uni.navigateTo({
        url: `/pages/tv/search/index?query=${encodeQueryObject({ region: this.currentRegion })}`
      })
    },
    goSearchByGenre(genre) {
      const query = genre
        ? {
            genre: genre.value,
            genreLabel: genre.label,
            mode: 'show',
            region: this.currentRegion
          }
        : {
            region: this.currentRegion
          }

      uni.navigateTo({
        url: `/pages/tv/search/index?query=${encodeQueryObject(query)}`
      })
    },
    goShowDetail(showId) {
      if (!showId) {
        return
      }

      uni.navigateTo({
        url: `/pages/tv/show-detail/index?query=${encodeQueryObject({ showId })}`
      })
    }
  }
}
</script>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  box-sizing: border-box;
  padding: 32rpx 28rpx 40rpx;
  background: #f7f8fb;
}

.hero-card {
  padding: 32rpx 28rpx;
  border-radius: 8rpx;
  background: linear-gradient(135deg, #0f172a, #14532d);
}

.hero-card__title {
  display: block;
  color: #ffffff;
  font-size: 40rpx;
  font-weight: 800;
}

.hero-card__desc {
  display: block;
  margin-top: 14rpx;
  color: rgba(255, 255, 255, 0.82);
  font-size: 24rpx;
  line-height: 1.55;
}

.hero-actions {
  display: flex;
  align-items: center;
  margin-top: 24rpx;
}

.hero-search {
  display: flex;
  flex: 1;
  align-items: center;
  height: 72rpx;
  padding: 0 22rpx;
  border-radius: 8rpx;
  background: rgba(255, 255, 255, 0.14);
  color: #ffffff;
}

.hero-search__icon {
  font-size: 42rpx;
}

.hero-search__text {
  margin-left: 12rpx;
  font-size: 26rpx;
  font-weight: 600;
}

.hero-link {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 168rpx;
  height: 72rpx;
  margin-left: 16rpx;
  border-radius: 8rpx;
  background: #ffffff;
  color: #0f172a;
  font-size: 26rpx;
  font-weight: 800;
}

.notice-card {
  margin-top: 20rpx;
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
  height: 56rpx;
  margin-top: 18rpx;
  padding: 0 18rpx;
  border-radius: 8rpx;
  background: #111827;
  color: #ffffff;
  font-size: 24rpx;
  font-weight: 700;
}

.region-switch {
  display: flex;
  align-items: center;
  width: 220rpx;
  height: 58rpx;
  margin-top: 20rpx;
  padding: 4rpx;
  border-radius: 8rpx;
  background: #eef1f5;
}

.region-switch__item {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  height: 50rpx;
  border-radius: 8rpx;
  color: #667085;
  font-size: 24rpx;
  font-weight: 700;
}

.region-switch__item--active {
  background: #111827;
  color: #ffffff;
}

.state-card {
  margin-top: 24rpx;
  padding: 36rpx 28rpx;
  border-radius: 8rpx;
  background: #ffffff;
  color: #667085;
  font-size: 26rpx;
}

.section {
  margin-top: 32rpx;
}

.section__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 18rpx;
}

.section__title {
  color: #101828;
  font-size: 32rpx;
  font-weight: 800;
}

.section__meta {
  color: #98a2b3;
  font-size: 22rpx;
}

.section__more {
  color: #166534;
  font-size: 24rpx;
}

.genre-list {
  display: flex;
  flex-wrap: wrap;
}

.genre-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 54rpx;
  margin-right: 12rpx;
  margin-bottom: 12rpx;
  padding: 0 18rpx;
  border-radius: 8rpx;
  background: #ffffff;
  color: #475467;
  font-size: 24rpx;
  font-weight: 700;
}

.poster-scroll {
  white-space: nowrap;
}

.poster-row {
  display: inline-flex;
  padding-right: 12rpx;
}

.poster-card {
  overflow: hidden;
  width: 212rpx;
  margin-right: 16rpx;
  border-radius: 8rpx;
  background: #ffffff;
}

.poster-card__image {
  display: block;
  width: 100%;
  height: 296rpx;
  background: #d0d5dd;
}

.poster-card__meta {
  padding: 14rpx;
}

.poster-card__title,
.poster-card__desc {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.poster-card__title {
  color: #172033;
  font-size: 24rpx;
  font-weight: 700;
}

.poster-card__desc {
  margin-top: 8rpx;
  color: #98a2b3;
  font-size: 22rpx;
}

.timeline-list {
  display: flex;
  flex-direction: column;
}

.timeline-card {
  display: flex;
  margin-bottom: 16rpx;
  padding: 18rpx;
  border-radius: 8rpx;
  background: #ffffff;
}

.timeline-card__image {
  flex-shrink: 0;
  width: 112rpx;
  height: 148rpx;
  border-radius: 8rpx;
  background: #d0d5dd;
}

.timeline-card__content {
  flex: 1;
  margin-left: 18rpx;
}

.timeline-card__title {
  display: block;
  color: #172033;
  font-size: 26rpx;
  font-weight: 800;
}

.timeline-card__meta,
.timeline-card__desc {
  display: block;
  margin-top: 10rpx;
  color: #667085;
  font-size: 22rpx;
  line-height: 1.45;
}

.forecast-list {
  display: flex;
  flex-direction: column;
}

.forecast-card {
  display: flex;
  margin-bottom: 18rpx;
  padding: 18rpx;
  border-radius: 8rpx;
  background: #ffffff;
}

.forecast-card__clock {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 88rpx;
  height: 44rpx;
  border-radius: 8rpx;
  background: #eef1f5;
  color: #344054;
  font-size: 22rpx;
  font-weight: 700;
}

.forecast-card__image {
  flex-shrink: 0;
  width: 112rpx;
  height: 148rpx;
  border-radius: 8rpx;
  background: #d0d5dd;
}

.forecast-card__image--placeholder {
  background: #d0d5dd;
}

.forecast-card__content {
  flex: 1;
  margin-left: 18rpx;
}

.forecast-card__title {
  display: block;
  margin-top: 10rpx;
  color: #172033;
  font-size: 26rpx;
  font-weight: 800;
  line-height: 1.45;
}

.forecast-card__meta,
.forecast-card__desc {
  display: block;
  margin-top: 10rpx;
  color: #667085;
  font-size: 22rpx;
  line-height: 1.45;
}

.feature-grid {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
}

.feature-card {
  position: relative;
  overflow: hidden;
  width: 48.7%;
  height: 228rpx;
  margin-bottom: 18rpx;
  border-radius: 8rpx;
  background: #0f172a;
}

.feature-card__image,
.feature-card__overlay {
  position: absolute;
  inset: 0;
}

.feature-card__image {
  width: 100%;
  height: 100%;
}

.feature-card__overlay {
  background: linear-gradient(180deg, rgba(15, 23, 42, 0.06), rgba(15, 23, 42, 0.82));
}

.feature-card__content {
  position: absolute;
  right: 18rpx;
  bottom: 18rpx;
  left: 18rpx;
}

.feature-card__score {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 38rpx;
  padding: 0 10rpx;
  border-radius: 8rpx;
  background: rgba(255, 255, 255, 0.16);
  color: #ffffff;
  font-size: 20rpx;
}

.feature-card__title,
.feature-card__desc {
  display: block;
  color: #ffffff;
}

.feature-card__title {
  margin-top: 10rpx;
  font-size: 26rpx;
  font-weight: 800;
  line-height: 1.4;
}

.feature-card__desc {
  margin-top: 8rpx;
  font-size: 22rpx;
  color: rgba(255, 255, 255, 0.84);
}
</style>
