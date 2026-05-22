<template>
  <view class="page">
    <view class="header-card">
      <text class="header-card__title">搜索影视</text>
      <text class="header-card__desc">支持电影、剧集和综合搜索，结果统一按中文文案返回。</text>

      <view class="search-row">
        <view class="search-input">
          <text class="search-input__icon">⌕</text>
          <input v-model="keyword" class="search-input__field" confirm-type="search" placeholder="搜索电影、剧集、人物相关作品" @confirm="handleSearch" />
        </view>
        <button class="search-button" @tap="handleSearch">搜索</button>
      </view>
    </view>

    <view class="type-switch">
      <view
        v-for="item in typeOptions"
        :key="item.value"
        :class="['type-switch__item', { 'type-switch__item--active': searchType === item.value }]"
        @tap="switchType(item.value)"
      >
        <text>{{ item.label }}</text>
      </view>
    </view>

    <view class="keyword-card">
      <text class="keyword-card__title">快捷搜索</text>
      <view class="keyword-list">
        <view v-for="item in quickKeywords" :key="item.keyword" class="keyword-chip" @tap="applyKeyword(item.keyword)">
          <text>{{ item.label }}</text>
        </view>
      </view>
    </view>

    <view v-if="errorMessage" class="notice-card">
      <text class="notice-card__title">搜索服务暂时不可用</text>
      <text class="notice-card__desc">{{ errorMessage }}</text>
      <view class="notice-card__action" @tap="handleSearch">重新搜索</view>
    </view>

    <view v-if="(isBootstrapping || isLoading) && results.length === 0" class="state-card">
      <text>搜索结果加载中...</text>
    </view>

    <view v-else-if="!isLoading && results.length === 0 && !hasSearched" class="state-card">
      <text class="state-card__title">输入关键词开始搜索</text>
      <text class="state-card__desc">可直接点上面的快捷搜索词，也可以切换电影、剧集、综合搜索模式。</text>
    </view>

    <view v-else-if="!isLoading && results.length === 0 && hasSearched" class="state-card">
      <text class="state-card__title">没有找到相关内容</text>
      <text class="state-card__desc">建议缩短关键词，或切换到综合搜索再试一次。</text>
    </view>

    <view v-else class="result-grid">
      <view v-for="item in results" :key="`${item.mediaType}-${item.id}`" class="result-card" @tap="goDetail(item)">
        <image class="result-card__image" :src="item.posterUrl || item.backdropUrl" mode="aspectFill" />
        <view class="result-card__meta">
          <text class="result-card__badge">{{ item.mediaType === 'tv' ? '剧集' : '电影' }}</text>
          <text class="result-card__title">{{ item.title }}</text>
          <text class="result-card__desc">{{ item.releaseDate || '待定档期' }}</text>
        </view>
      </view>
    </view>

    <view v-if="results.length > 0" class="load-more" @tap="loadMore">
      <text>{{ loadMoreText }}</text>
    </view>
  </view>
</template>

<script>
import { MOVIE_QUICK_KEYWORDS, MOVIE_SEARCH_TYPE_OPTIONS } from '@/config/movie'
import { getMovieErrorMessage, searchMovieMedia } from '@/services/movie-api'
import { decodeQueryObject, encodeQueryObject } from '@/utils/query'

export default {
  data() {
    return {
      typeOptions: MOVIE_SEARCH_TYPE_OPTIONS,
      quickKeywords: MOVIE_QUICK_KEYWORDS,
      keyword: '',
      searchType: MOVIE_SEARCH_TYPE_OPTIONS[0].value,
      results: [],
      page: 1,
      totalPages: 0,
      isBootstrapping: false,
      isLoading: false,
      isFinished: false,
      hasSearched: false,
      errorMessage: ''
    }
  },
  computed: {
    loadMoreText() {
      if (this.isLoading) {
        return '加载中...'
      }

      return this.isFinished ? '没有更多了' : '加载更多'
    }
  },
  onLoad(options) {
    const query = decodeQueryObject(options.query)
    this.searchType = query.searchType || this.searchType

    if (query.keyword) {
      this.keyword = query.keyword
      this.handleSearch()
    }
  },
  onReachBottom() {
    this.loadMore()
  },
  methods: {
    switchType(value) {
      if (this.searchType === value) {
        return
      }

      this.searchType = value

      if (this.keyword.trim()) {
        this.handleSearch()
      }
    },
    applyKeyword(keyword) {
      this.keyword = keyword
      this.handleSearch()
    },
    handleSearch() {
      if (!this.keyword.trim()) {
        uni.showToast({
          title: '请输入关键词',
          icon: 'none'
        })
        return
      }

      this.fetchResults(true)
    },
    fetchResults(reset) {
      if (this.isLoading) {
        return
      }

      if (reset) {
        this.page = 1
        this.results = []
        this.isFinished = false
        this.isBootstrapping = true
      }

      this.isLoading = true
      this.hasSearched = true
      this.errorMessage = ''
      searchMovieMedia({
        keyword: this.keyword.trim(),
        searchType: this.searchType,
        page: this.page
      })
        .then((data) => {
          const nextList = reset ? data.list : this.results.concat(data.list)
          this.results = nextList
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
      this.fetchResults(false)
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

.header-card,
.keyword-card {
  padding: 28rpx;
  border-radius: 8rpx;
  background: #ffffff;
}

.header-card__title,
.keyword-card__title {
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
  line-height: 1.6;
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
  margin: 0 0 0 16rpx;
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

.type-switch {
  display: flex;
  align-items: center;
  width: 340rpx;
  height: 58rpx;
  margin-top: 20rpx;
  padding: 4rpx;
  border-radius: 8rpx;
  background: #eef1f5;
}

.type-switch__item {
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

.type-switch__item--active {
  background: #111827;
  color: #ffffff;
}

.keyword-card {
  margin-top: 20rpx;
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
  height: 54rpx;
  margin-top: 16rpx;
  padding: 0 16rpx;
  border-radius: 8rpx;
  background: #111827;
  color: #ffffff;
  font-size: 22rpx;
  font-weight: 700;
}

.keyword-list {
  display: flex;
  flex-wrap: wrap;
  margin-top: 16rpx;
}

.keyword-chip {
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

.state-card {
  margin-top: 28rpx;
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

.result-grid {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  margin-top: 28rpx;
}

.result-card {
  overflow: hidden;
  width: 48.7%;
  margin-bottom: 18rpx;
  border-radius: 8rpx;
  background: #ffffff;
}

.result-card__image {
  display: block;
  width: 100%;
  height: 288rpx;
  background: #d0d5dd;
}

.result-card__meta {
  padding: 16rpx;
}

.result-card__badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 38rpx;
  padding: 0 10rpx;
  border-radius: 8rpx;
  background: #eef1f5;
  color: #475467;
  font-size: 20rpx;
}

.result-card__title,
.result-card__desc {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.result-card__title {
  margin-top: 10rpx;
  color: #172033;
  font-size: 24rpx;
  font-weight: 700;
}

.result-card__desc {
  margin-top: 8rpx;
  color: #98a2b3;
  font-size: 22rpx;
}

.load-more {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 80rpx;
  margin-top: 22rpx;
  color: #667085;
  font-size: 24rpx;
}
</style>
