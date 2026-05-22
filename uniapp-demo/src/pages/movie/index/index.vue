<template>
  <view class="page">
    <view class="hero-card">
      <text class="hero-card__title">热门影视</text>
      <text class="hero-card__desc">热门内容、分类浏览、关键词搜索和详情推荐。</text>

      <view class="hero-actions">
        <view class="hero-search" @tap="goSearch">
          <text class="hero-search__icon">⌕</text>
          <text class="hero-search__text">搜索电影 / 剧集</text>
        </view>

        <view class="hero-discover" @tap="goDiscover()">
          <text>浏览分类</text>
        </view>
      </view>

      <view class="hero-tips">
        <text class="hero-tips__item">电影</text>
        <text class="hero-tips__item">剧集</text>
        <text class="hero-tips__item">趋势</text>
      </view>
    </view>

    <view v-if="errorMessage" class="notice-card">
      <text class="notice-card__title">影视接口当前不可用</text>
      <text class="notice-card__desc">{{ errorMessage }}</text>
      <view class="notice-card__action" @tap="fetchHomeData">重新加载</view>
    </view>

    <view v-if="isLoading" class="state-card">
      <text>影视数据加载中...</text>
    </view>

    <template v-else>
      <view class="section">
        <view class="section__header">
          <text class="section__title">常见分类</text>
          <text class="section__meta">{{ genres.length }} 个分类</text>
        </view>
        <view class="genre-list">
          <view v-for="item in genres" :key="item.id" class="genre-chip" @tap="goDiscover(item)">
            <text>{{ item.label }}</text>
          </view>
        </view>
      </view>

      <view class="section">
        <view class="section__header">
          <text class="section__title">热门电影</text>
          <text class="section__more" @tap="goDiscover()">全部电影</text>
        </view>
        <scroll-view scroll-x class="poster-scroll" :show-scrollbar="false">
          <view class="poster-row">
            <view v-for="item in popularMovies" :key="`${item.mediaType}-${item.id}`" class="poster-card" @tap="goDetail(item)">
              <image class="poster-card__image" :src="item.posterUrl || item.backdropUrl" mode="aspectFill" />
              <view class="poster-card__meta">
                <text class="poster-card__title">{{ item.title }}</text>
                <text class="poster-card__desc">评分 {{ item.voteAverage.toFixed(1) }}</text>
              </view>
            </view>
          </view>
        </scroll-view>
      </view>

      <view class="section">
        <view class="section__header">
          <text class="section__title">热门剧集</text>
          <text class="section__more" @tap="goSearch('tv')">搜索剧集</text>
        </view>
        <scroll-view scroll-x class="poster-scroll" :show-scrollbar="false">
          <view class="poster-row">
            <view v-for="item in popularTvShows" :key="`${item.mediaType}-${item.id}`" class="poster-card" @tap="goDetail(item)">
              <image class="poster-card__image" :src="item.posterUrl || item.backdropUrl" mode="aspectFill" />
              <view class="poster-card__meta">
                <text class="poster-card__title">{{ item.title }}</text>
                <text class="poster-card__desc">{{ item.releaseDate || '待定档期' }}</text>
              </view>
            </view>
          </view>
        </scroll-view>
      </view>

      <view class="section">
        <view class="section__header">
          <text class="section__title">今日趋势</text>
        </view>
        <view class="trend-grid">
          <view v-for="item in trendingItems" :key="`${item.mediaType}-${item.id}`" class="trend-card" @tap="goDetail(item)">
            <image class="trend-card__image" :src="item.backdropUrl || item.posterUrl" mode="aspectFill" />
            <view class="trend-card__overlay"></view>
            <view class="trend-card__content">
              <text class="trend-card__badge">{{ item.mediaType === 'tv' ? '剧集' : '电影' }}</text>
              <text class="trend-card__title">{{ item.title }}</text>
            </view>
          </view>
        </view>
      </view>
    </template>
  </view>
</template>

<script>
import { fetchMovieHomeData, getMovieErrorMessage } from '@/services/movie-api'
import { encodeQueryObject } from '@/utils/query'

export default {
  data() {
    return {
      isLoading: false,
      errorMessage: '',
      popularMovies: [],
      popularTvShows: [],
      trendingItems: [],
      genres: []
    }
  },
  onLoad() {
    this.fetchHomeData()
  },
  methods: {
    fetchHomeData() {
      if (this.isLoading) {
        return
      }

      this.isLoading = true
      this.errorMessage = ''
      fetchMovieHomeData()
        .then((data) => {
          this.popularMovies = data.popularMovies
          this.popularTvShows = data.popularTvShows
          this.trendingItems = data.trendingItems
          this.genres = data.genres
        })
        .catch((error) => {
          this.errorMessage = getMovieErrorMessage(error)
          uni.showToast({
            title: this.errorMessage,
            icon: 'none'
          })
        })
        .then(() => {
          this.isLoading = false
        })
    },
    goSearch(searchType = '') {
      const query = searchType ? { searchType } : {}

      uni.navigateTo({
        url: `/pages/movie/search/index?query=${encodeQueryObject(query)}`
      })
    },
    goDiscover(genre) {
      const query = genre
        ? {
            genreId: genre.id,
            genreLabel: genre.label
          }
        : {}

      uni.navigateTo({
        url: `/pages/movie/discover/index?query=${encodeQueryObject(query)}`
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
  box-sizing: border-box;
  padding: 32rpx 28rpx 40rpx;
  background: #f7f8fb;
}

.hero-card {
  padding: 32rpx 28rpx;
  border-radius: 8rpx;
  background: linear-gradient(135deg, #0f172a, #1d4ed8);
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
  color: rgba(255, 255, 255, 0.84);
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

.hero-discover {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 172rpx;
  height: 72rpx;
  margin-left: 16rpx;
  border-radius: 8rpx;
  background: #ffffff;
  color: #0f172a;
  font-size: 26rpx;
  font-weight: 800;
}

.hero-tips {
  display: flex;
  flex-wrap: wrap;
  margin-top: 18rpx;
}

.hero-tips__item {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 40rpx;
  margin-right: 12rpx;
  margin-top: 8rpx;
  padding: 0 14rpx;
  border-radius: 8rpx;
  background: rgba(255, 255, 255, 0.12);
  color: rgba(255, 255, 255, 0.84);
  font-size: 22rpx;
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
  color: #2563eb;
  font-size: 24rpx;
}

.genre-list {
  display: flex;
  flex-wrap: wrap;
  max-height: 124rpx;
  overflow: hidden;
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

.trend-grid {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
}

.trend-card {
  position: relative;
  overflow: hidden;
  width: 48.7%;
  height: 220rpx;
  margin-bottom: 18rpx;
  border-radius: 8rpx;
  background: #0f172a;
}

.trend-card__image,
.trend-card__overlay {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
}

.trend-card__image {
  width: 100%;
  height: 100%;
}

.trend-card__overlay {
  background: linear-gradient(180deg, rgba(15, 23, 42, 0.04), rgba(15, 23, 42, 0.78));
}

.trend-card__content {
  position: absolute;
  right: 18rpx;
  bottom: 18rpx;
  left: 18rpx;
}

.trend-card__badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 40rpx;
  padding: 0 12rpx;
  border-radius: 8rpx;
  background: rgba(255, 255, 255, 0.14);
  color: #ffffff;
  font-size: 22rpx;
}

.trend-card__title {
  display: block;
  margin-top: 12rpx;
  color: #ffffff;
  font-size: 26rpx;
  font-weight: 800;
  line-height: 1.35;
}
</style>
