<template>
  <view class="page">
    <view class="header-card">
      <text class="header-card__title">{{ selectedGenreLabel || '电影分类' }}</text>
      <text class="header-card__desc">通过类型、排序和年份筛选浏览电影内容。</text>
      <text class="header-card__meta">当前排序：{{ currentSortLabel }}{{ selectedYear ? ` · ${selectedYear}` : '' }}</text>
    </view>

    <view class="filter-section">
      <view class="filter-group">
        <text class="filter-group__label">分类</text>
        <scroll-view scroll-x class="filter-scroll" :show-scrollbar="false">
          <view class="filter-row">
            <view
              v-for="item in genres"
              :key="item.id"
              :class="['filter-chip', { 'filter-chip--active': selectedGenreId === item.id }]"
              @tap="selectGenre(item)"
            >
              <text>{{ item.label }}</text>
            </view>
          </view>
        </scroll-view>
      </view>

      <view class="filter-group">
        <text class="filter-group__label">排序</text>
        <scroll-view scroll-x class="filter-scroll" :show-scrollbar="false">
          <view class="filter-row">
            <view
              v-for="item in sortOptions"
              :key="item.value"
              :class="['filter-chip', { 'filter-chip--active': selectedSortBy === item.value }]"
              @tap="selectSort(item)"
            >
              <text>{{ item.label }}</text>
            </view>
          </view>
        </scroll-view>
      </view>

      <view class="filter-group">
        <text class="filter-group__label">年份</text>
        <scroll-view scroll-x class="filter-scroll" :show-scrollbar="false">
          <view class="filter-row">
            <view
              v-for="item in yearOptions"
              :key="item.value || 'all'"
              :class="['filter-chip', { 'filter-chip--active': selectedYear === item.value }]"
              @tap="selectYear(item)"
            >
              <text>{{ item.label }}</text>
            </view>
          </view>
        </scroll-view>
      </view>
    </view>

    <view v-if="errorMessage" class="notice-card">
      <text class="notice-card__title">分类结果暂时不可用</text>
      <text class="notice-card__desc">{{ errorMessage }}</text>
      <view class="notice-card__action" @tap="fetchMovies(true)">重新加载</view>
    </view>

    <view class="result-summary">
      <text class="result-summary__text">{{ summaryText }}</text>
    </view>

    <view v-if="(isBootstrapping || isLoading) && movies.length === 0" class="state-card">
      <text>分类内容加载中...</text>
    </view>

    <view v-else-if="!isLoading && movies.length === 0" class="state-card">
      <text>暂无结果，换个分类或筛选试试</text>
    </view>

    <view v-else class="movie-grid">
      <view v-for="item in movies" :key="item.id" class="movie-card" @tap="goDetail(item)">
        <image class="movie-card__image" :src="item.posterUrl || item.backdropUrl" mode="aspectFill" />
        <view class="movie-card__meta">
          <text class="movie-card__title">{{ item.title }}</text>
          <text class="movie-card__desc">{{ item.releaseDate || '待定档期' }}</text>
          <text class="movie-card__score">评分 {{ item.voteAverage.toFixed(1) }}</text>
        </view>
      </view>
    </view>

    <view v-if="movies.length > 0" class="load-more" @tap="loadMore">
      <text>{{ loadMoreText }}</text>
    </view>
  </view>
</template>

<script>
import { MOVIE_DISCOVER_SORT_OPTIONS } from '@/config/movie'
import { createMovieYearOptions, discoverMovies, fetchMovieGenres, getMovieErrorMessage } from '@/services/movie-api'
import { decodeQueryObject, encodeQueryObject } from '@/utils/query'

export default {
  data() {
    return {
      sortOptions: MOVIE_DISCOVER_SORT_OPTIONS,
      yearOptions: createMovieYearOptions(),
      genres: [],
      selectedGenreId: '',
      selectedGenreLabel: '',
      selectedSortBy: MOVIE_DISCOVER_SORT_OPTIONS[0].value,
      selectedYear: '',
      movies: [],
      page: 1,
      totalPages: 0,
      isBootstrapping: true,
      isLoading: false,
      isFinished: false,
      errorMessage: ''
    }
  },
  computed: {
    currentSortLabel() {
      const matched = this.sortOptions.find(item => item.value === this.selectedSortBy)
      return matched ? matched.label : '热门'
    },
    summaryText() {
      if (this.movies.length === 0 && !this.isLoading) {
        return '当前暂无可展示内容'
      }

      return `已加载 ${this.movies.length} 条内容`
    },
    loadMoreText() {
      if (this.isLoading) {
        return '加载中...'
      }

      return this.isFinished ? '没有更多了' : '加载更多'
    }
  },
  onLoad(options) {
    const query = decodeQueryObject(options.query)
    this.selectedGenreId = query.genreId || ''
    this.selectedGenreLabel = query.genreLabel || ''
    this.fetchGenres()
  },
  onReachBottom() {
    this.loadMore()
  },
  methods: {
    fetchGenres() {
      fetchMovieGenres()
        .then((list) => {
          this.errorMessage = ''
          this.genres = list

          if (!this.selectedGenreId && list.length > 0) {
            this.selectedGenreId = list[0].id
            this.selectedGenreLabel = list[0].label
          } else {
            const matchedGenre = list.find(item => item.id === this.selectedGenreId)
            if (matchedGenre) {
              this.selectedGenreLabel = matchedGenre.label
            }
          }

          this.fetchMovies(true)
        })
        .catch((error) => {
          this.isBootstrapping = false
          this.errorMessage = getMovieErrorMessage(error)
          uni.showToast({
            title: this.errorMessage,
            icon: 'none'
          })
        })
    },
    selectGenre(item) {
      if (this.selectedGenreId === item.id) {
        return
      }

      this.selectedGenreId = item.id
      this.selectedGenreLabel = item.label
      this.fetchMovies(true)
    },
    selectSort(item) {
      if (this.selectedSortBy === item.value) {
        return
      }

      this.selectedSortBy = item.value
      this.fetchMovies(true)
    },
    selectYear(item) {
      if (this.selectedYear === item.value) {
        return
      }

      this.selectedYear = item.value
      this.fetchMovies(true)
    },
    fetchMovies(reset) {
      if (this.isLoading || !this.selectedGenreId) {
        this.isBootstrapping = false
        return
      }

      if (reset) {
        this.page = 1
        this.movies = []
        this.isFinished = false
      }

      this.isLoading = true
      this.errorMessage = ''
      discoverMovies({
        genreId: this.selectedGenreId,
        sortBy: this.selectedSortBy,
        year: this.selectedYear,
        page: this.page
      })
        .then((data) => {
          const nextList = reset ? data.list : this.movies.concat(data.list)
          this.movies = nextList
          this.totalPages = data.totalPages
          this.isFinished = data.page >= data.totalPages || data.list.length === 0
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
          this.isBootstrapping = false
        })
    },
    loadMore() {
      if (this.isLoading || this.isFinished) {
        return
      }

      this.page += 1
      this.fetchMovies(false)
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
  padding: 28rpx 28rpx 40rpx;
  background: #f7f8fb;
}

.header-card {
  padding: 28rpx;
  border-radius: 8rpx;
  background: #ffffff;
}

.header-card__title {
  display: block;
  color: #101828;
  font-size: 34rpx;
  font-weight: 800;
}

.header-card__desc {
  display: block;
  margin-top: 12rpx;
  color: #667085;
  font-size: 24rpx;
  line-height: 1.5;
}

.header-card__meta {
  display: block;
  margin-top: 12rpx;
  color: #98a2b3;
  font-size: 22rpx;
}

.filter-section {
  margin-top: 18rpx;
  padding: 20rpx 22rpx;
  border-radius: 8rpx;
  background: #ffffff;
}

.filter-group + .filter-group {
  margin-top: 16rpx;
}

.filter-group__label {
  display: block;
  color: #344054;
  font-size: 22rpx;
  font-weight: 700;
}

.filter-scroll {
  margin-top: 10rpx;
  white-space: nowrap;
}

.filter-row {
  display: inline-flex;
  padding-right: 8rpx;
}

.filter-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 52rpx;
  margin-right: 12rpx;
  padding: 0 18rpx;
  border-radius: 8rpx;
  background: #eef1f5;
  color: #475467;
  font-size: 22rpx;
  font-weight: 700;
}

.filter-chip--active {
  background: #111827;
  color: #ffffff;
}

.notice-card,
.result-summary {
  margin-top: 18rpx;
  padding: 22rpx;
  border-radius: 8rpx;
}

.notice-card {
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
  line-height: 1.5;
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

.result-summary {
  background: #ffffff;
}

.result-summary__text {
  color: #667085;
  font-size: 23rpx;
}

.state-card {
  margin-top: 28rpx;
  padding: 36rpx 28rpx;
  border-radius: 8rpx;
  background: #ffffff;
  color: #667085;
  font-size: 26rpx;
}

.movie-grid {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  margin-top: 20rpx;
}

.movie-card {
  overflow: hidden;
  width: 48.7%;
  margin-bottom: 18rpx;
  border-radius: 8rpx;
  background: #ffffff;
}

.movie-card__image {
  display: block;
  width: 100%;
  height: 288rpx;
  background: #d0d5dd;
}

.movie-card__meta {
  padding: 16rpx;
}

.movie-card__title,
.movie-card__desc,
.movie-card__score {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.movie-card__title {
  color: #172033;
  font-size: 24rpx;
  font-weight: 700;
}

.movie-card__desc,
.movie-card__score {
  margin-top: 8rpx;
  color: #98a2b3;
  font-size: 22rpx;
}

.load-more {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 80rpx;
  margin-top: 18rpx;
  color: #667085;
  font-size: 24rpx;
}
</style>
