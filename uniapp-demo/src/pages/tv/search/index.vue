<template>
  <view class="page">
    <view class="header-card">
      <text class="header-card__title">{{ headerTitle }}</text>
      <text class="header-card__desc">{{ headerDesc }}</text>

      <view class="search-row">
        <view class="search-input">
          <text class="search-input__icon">⌕</text>
          <input
            v-model="keyword"
            class="search-input__field"
            confirm-type="search"
            placeholder="搜索剧名、演员名"
            @confirm="handleSearch"
          />
        </view>
        <button class="search-button" @tap="handleSearch">搜索</button>
      </view>
    </view>

    <view class="mode-switch">
      <view
        v-for="item in modeOptions"
        :key="item.value"
        :class="['mode-switch__item', { 'mode-switch__item--active': searchMode === item.value }]"
        @tap="switchMode(item.value)"
      >
        <text>{{ item.label }}</text>
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

    <view class="panel-card">
      <view class="panel-card__header">
        <text class="panel-card__title">搜索历史</text>
        <text class="panel-card__action" @tap="clearHistory">清空</text>
      </view>
      <view class="tag-list">
        <view v-for="item in searchHistory" :key="item" class="tag-chip" @tap="applyKeyword(item)">
          <text>{{ item }}</text>
        </view>
        <text v-if="searchHistory.length === 0" class="panel-card__empty">暂无搜索记录</text>
      </view>
    </view>

    <view class="panel-card">
      <view class="panel-card__header">
        <text class="panel-card__title">热门搜索</text>
      </view>
      <view class="tag-list">
        <view v-for="item in hotKeywords" :key="item" class="tag-chip tag-chip--hot" @tap="applyKeyword(item)">
          <text>{{ item }}</text>
        </view>
      </view>
    </view>

    <view v-if="errorMessage" class="notice-card">
      <text class="notice-card__title">搜索服务暂时不可用</text>
      <text class="notice-card__desc">{{ errorMessage }}</text>
      <view class="notice-card__action" @tap="handleSearch">重新搜索</view>
    </view>

    <view v-if="genreLabel || currentRegionLabel" class="result-summary">
      <text class="result-summary__text">
        当前地区：{{ currentRegionLabel }}{{ genreLabel ? ` · 当前类型：${genreLabel}` : '' }}
      </text>
    </view>

    <view v-if="isLoading" class="state-card">
      <text>搜索结果加载中...</text>
    </view>

    <view v-else-if="!hasSearched && !genreLabel" class="state-card">
      <text class="state-card__title">开始搜索剧集</text>
      <text class="state-card__desc">支持剧名搜索、演员搜索和精确搜索，也可以直接使用上面的热词入口。</text>
    </view>

    <view v-else-if="showResults.length === 0 && peopleResults.length === 0" class="state-card">
      <text class="state-card__title">没有找到相关内容</text>
      <text class="state-card__desc">建议缩短关键词，或切换搜索模式和地区后再次尝试。</text>
    </view>

    <template v-else>
      <view v-if="showResults.length > 0" class="result-section">
        <view class="result-section__header">
          <text class="result-section__title">剧集结果</text>
          <text class="result-section__meta">{{ showResults.length }} 条</text>
        </view>
        <view class="show-grid">
          <view v-for="item in showResults" :key="item.id" class="show-card" @tap="goShowDetail(item.id)">
            <image class="show-card__image" :src="item.imageUrl" mode="aspectFill" />
            <view class="show-card__meta">
              <text class="show-card__title">{{ item.name }}</text>
              <text class="show-card__desc">{{ item.genres.join(' / ') || '类型待补充' }}</text>
              <text class="show-card__desc">{{ item.countryName || '地区待补充' }} · 评分 {{ item.rating ? item.rating.toFixed(1) : '暂无' }}</text>
            </view>
          </view>
        </view>
      </view>

      <view v-if="peopleResults.length > 0" class="result-section">
        <view class="result-section__header">
          <text class="result-section__title">演员结果</text>
          <text class="result-section__meta">{{ peopleResults.length }} 条</text>
        </view>
        <view class="people-list">
          <view v-for="item in peopleResults" :key="item.id" class="people-card" @tap="goPersonDetail(item.id)">
            <image class="people-card__image" :src="item.imageUrl" mode="aspectFill" />
            <view class="people-card__meta">
              <text class="people-card__title">{{ item.name }}</text>
              <text class="people-card__desc">{{ item.country || '国家待补充' }}</text>
              <text class="people-card__desc">{{ item.birthday || '生日待补充' }}</text>
            </view>
          </view>
        </view>
      </view>
    </template>
  </view>
</template>

<script>
import {
  browseShowsByGenre,
  clearTvSearchHistory,
  getTvErrorMessage,
  getTvHotKeywords,
  getTvRegionOptions,
  getTvSearchHistory,
  getTvSearchModes,
  saveTvSearchHistory,
  searchTvPeople,
  searchTvShowExact,
  searchTvShows
} from '@/services/tv-api'
import { decodeQueryObject, encodeQueryObject } from '@/utils/query'

export default {
  data() {
    return {
      modeOptions: getTvSearchModes(),
      regionOptions: getTvRegionOptions(),
      hotKeywords: getTvHotKeywords(),
      searchHistory: [],
      keyword: '',
      searchMode: 'show',
      currentRegion: 'CN',
      genre: '',
      genreLabel: '',
      showResults: [],
      peopleResults: [],
      isLoading: false,
      hasSearched: false,
      errorMessage: ''
    }
  },
  computed: {
    headerTitle() {
      return this.genreLabel ? `${this.genreLabel}剧集` : '搜索剧集'
    },
    headerDesc() {
      if (this.genreLabel) {
        return `当前按 ${this.currentRegionLabel} · ${this.genreLabel} 类型浏览剧集，可继续切换到剧名、演员或精确搜索。`
      }

      return `当前地区：${this.currentRegionLabel}。支持剧名搜索、演员搜索和精确搜索，并保留本地搜索历史。`
    },
    currentRegionLabel() {
      const matched = this.regionOptions.find(item => item.value === this.currentRegion)
      return matched ? matched.label : '国内'
    }
  },
  onLoad(options) {
    const query = decodeQueryObject(options.query)
    this.searchHistory = getTvSearchHistory()
    this.searchMode = query.mode || this.searchMode
    this.currentRegion = query.region || this.currentRegion
    this.genre = query.genre || ''
    this.genreLabel = query.genreLabel || ''
    this.keyword = query.keyword || ''

    if (this.genre) {
      this.fetchGenreShows()
      return
    }

    if (this.keyword) {
      this.handleSearch()
    }
  },
  methods: {
    switchRegion(region) {
      if (this.currentRegion === region) {
        return
      }

      this.currentRegion = region

      if (this.genre) {
        this.fetchGenreShows()
        return
      }

      if (this.keyword.trim()) {
        this.handleSearch()
        return
      }

      this.showResults = []
      this.peopleResults = []
      this.hasSearched = false
    },
    switchMode(mode) {
      if (this.searchMode === mode) {
        return
      }

      this.searchMode = mode
      this.genre = ''
      this.genreLabel = ''

      if (this.keyword.trim()) {
        this.handleSearch()
        return
      }

      this.showResults = []
      this.peopleResults = []
      this.hasSearched = false
    },
    applyKeyword(keyword) {
      this.keyword = keyword
      this.genre = ''
      this.genreLabel = ''
      this.handleSearch()
    },
    clearHistory() {
      clearTvSearchHistory()
      this.searchHistory = []
    },
    handleSearch() {
      const trimmedKeyword = this.keyword.trim()

      if (!trimmedKeyword) {
        uni.showToast({
          title: '请输入关键词',
          icon: 'none'
        })
        return
      }

      this.genre = ''
      this.genreLabel = ''
      this.fetchSearchResults(trimmedKeyword)
    },
    fetchGenreShows() {
      this.isLoading = true
      this.errorMessage = ''
      this.hasSearched = true
      this.showResults = []
      this.peopleResults = []

      browseShowsByGenre(this.genre, this.currentRegion)
        .then((list) => {
          this.showResults = list
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
    fetchSearchResults(keyword) {
      if (this.isLoading) {
        return
      }

      this.isLoading = true
      this.errorMessage = ''
      this.hasSearched = true
      this.showResults = []
      this.peopleResults = []
      this.searchHistory = saveTvSearchHistory(keyword)

      const requestHandler = this.searchMode === 'people'
        ? searchTvPeople(keyword, this.currentRegion)
        : this.searchMode === 'single'
          ? searchTvShowExact(keyword, this.currentRegion)
          : searchTvShows(keyword, this.currentRegion)

      Promise.resolve(requestHandler)
        .then((list) => {
          if (this.searchMode === 'people') {
            this.peopleResults = list
          } else {
            this.showResults = list
          }
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
    goShowDetail(showId) {
      uni.navigateTo({
        url: `/pages/tv/show-detail/index?query=${encodeQueryObject({ showId })}`
      })
    },
    goPersonDetail(personId) {
      uni.navigateTo({
        url: `/pages/tv/person-detail/index?query=${encodeQueryObject({ personId })}`
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

.header-card,
.panel-card,
.result-summary {
  padding: 28rpx;
  border-radius: 8rpx;
  background: #ffffff;
}

.header-card__title,
.panel-card__title {
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
  line-height: 1.55;
}

.search-row {
  display: flex;
  align-items: center;
  margin-top: 20rpx;
}

.search-input {
  display: flex;
  flex: 1;
  align-items: center;
  height: 72rpx;
  padding: 0 24rpx;
  border-radius: 8rpx;
  background: #eef0f4;
}

.search-input__icon {
  color: #7a8494;
  font-size: 42rpx;
}

.search-input__field {
  flex: 1;
  height: 72rpx;
  margin-left: 12rpx;
  color: #172033;
  font-size: 28rpx;
}

.search-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 116rpx;
  height: 72rpx;
  margin-left: 16rpx;
  padding: 0;
  border-radius: 8rpx;
  background: #111827;
  color: #ffffff;
  font-size: 26rpx;
  font-weight: 700;
}

.search-button::after {
  border: 0;
}

.mode-switch {
  display: flex;
  align-items: center;
  width: 340rpx;
  height: 58rpx;
  margin-top: 20rpx;
  padding: 4rpx;
  border-radius: 8rpx;
  background: #eef1f5;
}

.mode-switch__item,
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

.mode-switch__item--active,
.region-switch__item--active {
  background: #111827;
  color: #ffffff;
}

.region-switch {
  display: flex;
  align-items: center;
  width: 220rpx;
  height: 58rpx;
  margin-top: 18rpx;
  padding: 4rpx;
  border-radius: 8rpx;
  background: #eef1f5;
}

.panel-card,
.notice-card,
.result-summary,
.state-card,
.result-section {
  margin-top: 20rpx;
}

.panel-card__header,
.result-section__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.panel-card__action,
.result-section__meta {
  color: #98a2b3;
  font-size: 22rpx;
}

.tag-list {
  display: flex;
  flex-wrap: wrap;
  margin-top: 16rpx;
}

.tag-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 54rpx;
  margin-right: 12rpx;
  margin-bottom: 12rpx;
  padding: 0 18rpx;
  border-radius: 8rpx;
  background: #eef1f5;
  color: #475467;
  font-size: 24rpx;
  font-weight: 700;
}

.tag-chip--hot {
  background: #ecfdf3;
  color: #166534;
}

.panel-card__empty {
  color: #98a2b3;
  font-size: 22rpx;
}

.notice-card {
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

.result-summary__text {
  color: #166534;
  font-size: 24rpx;
  font-weight: 700;
}

.state-card {
  padding: 36rpx 28rpx;
  border-radius: 8rpx;
  background: #ffffff;
}

.state-card__title {
  display: block;
  color: #344054;
  font-size: 28rpx;
  font-weight: 800;
}

.state-card__desc {
  display: block;
  margin-top: 12rpx;
  color: #667085;
  font-size: 24rpx;
  line-height: 1.55;
}

.result-section__title {
  color: #101828;
  font-size: 30rpx;
  font-weight: 800;
}

.show-grid {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  margin-top: 18rpx;
}

.show-card {
  overflow: hidden;
  width: 48.7%;
  margin-bottom: 18rpx;
  border-radius: 8rpx;
  background: #ffffff;
}

.show-card__image {
  display: block;
  width: 100%;
  height: 288rpx;
  background: #d0d5dd;
}

.show-card__meta {
  padding: 16rpx;
}

.show-card__title,
.show-card__desc {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.show-card__title {
  color: #172033;
  font-size: 24rpx;
  font-weight: 700;
}

.show-card__desc {
  margin-top: 8rpx;
  color: #98a2b3;
  font-size: 22rpx;
}

.people-list {
  margin-top: 18rpx;
}

.people-card {
  display: flex;
  margin-bottom: 16rpx;
  padding: 18rpx;
  border-radius: 8rpx;
  background: #ffffff;
}

.people-card__image {
  flex-shrink: 0;
  width: 112rpx;
  height: 148rpx;
  border-radius: 8rpx;
  background: #d0d5dd;
}

.people-card__meta {
  flex: 1;
  margin-left: 18rpx;
}

.people-card__title,
.people-card__desc {
  display: block;
}

.people-card__title {
  color: #172033;
  font-size: 26rpx;
  font-weight: 800;
}

.people-card__desc {
  margin-top: 10rpx;
  color: #667085;
  font-size: 22rpx;
}
</style>
