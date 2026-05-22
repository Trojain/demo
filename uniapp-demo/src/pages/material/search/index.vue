<template>
  <view class="page">
    <view class="search-header">
      <view class="search-input">
        <text class="search-input__icon">⌕</text>
        <input v-model="filters.q" class="search-input__field" confirm-type="search" placeholder="搜索素材" @confirm="handleSearch" />
      </view>
      <button class="search-button" @tap="handleSearch">搜索</button>
    </view>

    <scroll-view scroll-x class="active-scroll" :show-scrollbar="false">
      <view class="active-filter-list">
        <view v-for="item in activeFilterLabels" :key="item.key" class="active-filter">
          <text>{{ item.label }}</text>
        </view>
      </view>
    </scroll-view>

    <view class="media-switch">
      <view
        v-for="item in mediaTypeOptions"
        :key="item.value"
        :class="['media-switch__item', { 'media-switch__item--active': filters.media_type === item.value }]"
        @tap="setMediaType(item.value)"
      >
        <text>{{ item.label }}</text>
      </view>
    </view>

    <scroll-view scroll-x class="compact-filter-scroll" :show-scrollbar="false">
      <view class="compact-filter-bar">
        <view :class="['compact-filter', { 'compact-filter--active': filters.editors_choice }]" @tap="toggleEditorsChoice">
          <text>精选</text>
        </view>
        <view
          v-for="group in dropdownFilterGroups"
          :key="group.key"
          :class="['compact-filter', { 'compact-filter--active': isDropdownFilterActive(group.key) }]"
          @tap="openFilterSheet(group)"
        >
          <text>{{ getFilterLabel(group) }}</text>
          <text class="compact-filter__arrow">⌄</text>
        </view>
      </view>
    </scroll-view>

    <view v-if="isLoading && assets.length === 0" class="state-card">
      <text>素材加载中...</text>
    </view>

    <view v-else-if="!isLoading && assets.length === 0" class="state-card">
      <text>暂无素材，换个关键词或筛选条件试试</text>
    </view>

    <view v-else class="image-grid">
      <view v-for="item in assets" :key="item.id" class="image-card" @tap="goDetail(item)">
        <view class="image-card__cover">
          <image class="image-card__img" :src="item.previewURL || item.webformatURL" mode="aspectFill" lazy-load />
          <view v-if="item.mediaType === 'video'" class="image-card__video-badge">
            <text>视频</text>
          </view>
        </view>
        <view class="image-card__meta">
          <text class="image-card__tags">{{ item.tags || '素材' }}</text>
          <text class="image-card__author">{{ item.user }}</text>
        </view>
      </view>
    </view>

    <view v-if="assets.length > 0" class="load-more" @tap="loadMore">
      <text>{{ loadMoreText }}</text>
    </view>
  </view>
</template>

<script>
import { MATERIAL_ERROR_CODES, searchMaterialAssets } from '@/services/material-api'
import { MATERIAL_CATEGORIES, MATERIAL_FILTER_GROUPS, DEFAULT_MATERIAL_FILTERS, MATERIAL_MEDIA_OPTIONS } from '@/config/material-options'
import { decodeQueryObject, encodeQueryObject } from '@/utils/query'

export default {
  data() {
    return {
      filters: { ...DEFAULT_MATERIAL_FILTERS },
      quickFilterGroups: MATERIAL_FILTER_GROUPS,
      mediaTypeOptions: MATERIAL_MEDIA_OPTIONS,
      assets: [],
      page: 1,
      totalHits: 0,
      isLoading: false,
      isFinished: false
    }
  },
  computed: {
    dropdownFilterGroups() {
      return this.quickFilterGroups.filter(group => {
        if (group.key === 'editors_choice') {
          return false
        }

        // 视频接口不支持 orientation，切换视频时隐藏方向筛选。
        if (this.filters.media_type === 'video' && group.key === 'orientation') {
          return false
        }

        return true
      })
    },
    activeFilterLabels() {
      const labels = []
      const category = MATERIAL_CATEGORIES.find(item => item.value === this.filters.category)

      if (this.filters.q) {
        labels.push({ key: 'q', label: `关键词：${this.filters.q}` })
      }

      if (category) {
        labels.push({ key: 'category', label: `分类：${category.label}` })
      }

      this.quickFilterGroups.forEach(group => {
        const option = group.options.find(item => item.value === this.filters[group.key])
        const isDefaultValue =
          (group.key === 'editors_choice' && this.filters[group.key] === false) ||
          (group.key === 'order' && this.filters[group.key] === DEFAULT_MATERIAL_FILTERS.order) ||
          (group.key === 'image_type' && this.filters[group.key] === DEFAULT_MATERIAL_FILTERS.image_type) ||
          (group.key === 'orientation' && this.filters[group.key] === DEFAULT_MATERIAL_FILTERS.orientation)

        if (option && !isDefaultValue) {
          labels.push({ key: group.key, label: option.label })
        }
      })

      return labels
    },
    loadMoreText() {
      if (this.isLoading) {
        return '加载中...'
      }

      return this.isFinished ? '没有更多了' : '加载更多'
    }
  },
  onLoad(options) {
    const routeFilters = decodeQueryObject(options.filters)
    this.filters = {
      ...DEFAULT_MATERIAL_FILTERS,
      ...routeFilters
    }

    this.fetchAssets(true)
  },
  onReachBottom() {
    this.loadMore()
  },
  methods: {
    setMediaType(value) {
      if (this.filters.media_type === value) {
        return
      }

      this.filters.media_type = value
      this.filters.orientation = DEFAULT_MATERIAL_FILTERS.orientation
      this.filters.image_type = DEFAULT_MATERIAL_FILTERS.image_type
      this.filters.video_type = DEFAULT_MATERIAL_FILTERS.video_type
      this.fetchAssets(true)
    },
    getFilterLabel(group) {
      const option = group.options.find(item => item.value === this.filters[group.key])
      return option ? option.label : ''
    },
    isDropdownFilterActive(key) {
      // 排序默认展示“热门”，视觉上也保持已选中态，避免和当前值不一致。
      if (key === 'order') {
        return true
      }

      return this.filters[key] !== DEFAULT_MATERIAL_FILTERS[key]
    },
    toggleEditorsChoice() {
      this.filters.editors_choice = !this.filters.editors_choice
      this.fetchAssets(true)
    },
    openFilterSheet(group) {
      const itemList = group.options.map(item => item.label)

      uni.showActionSheet({
        itemList,
        success: (res) => {
          const selectedOption = group.options[res.tapIndex]

          if (!selectedOption) {
            return
          }

          this.setFilter(group.key, selectedOption.value)
        },
        fail: () => {}
      })
    },
    setFilter(key, value) {
      // 精选只有一个快捷项，再次点击时取消该条件。
      this.filters[key] = key === 'editors_choice' && this.filters[key] === value ? false : value
      this.fetchAssets(true)
    },
    handleSearch() {
      this.fetchAssets(true)
    },
    fetchAssets(reset) {
      if (this.isLoading) {
        return
      }

      if (reset) {
        this.page = 1
        this.assets = []
        this.isFinished = false
      }

      this.isLoading = true

      searchMaterialAssets({
        ...this.filters,
        page: this.page
      })
        .then((res) => {
          const nextList = reset ? res.list : this.assets.concat(res.list)
          this.assets = nextList
          this.totalHits = res.totalHits
          this.isFinished = res.list.length === 0 || nextList.length >= res.totalHits
        })
        .catch((error) => {
          uni.showToast({
            title: error.code === MATERIAL_ERROR_CODES.RATE_LIMIT ? '请求频繁，稍后再试' : '素材查询失败',
            icon: 'none'
          })
        })
        .then(() => {
          this.isLoading = false
        })
    },
    loadMore() {
      if (this.isLoading || this.isFinished) {
        return
      }

      this.page += 1
      this.fetchAssets(false)
    },
    goDetail(item) {
      const payload = {
        mediaType: item.mediaType,
        id: item.id,
        imageUrl: item.largeImageURL,
        previewUrl: item.webformatURL,
        videoUrl: item.videoURL,
        duration: item.duration,
        tags: item.tags,
        user: item.user,
        views: item.views,
        downloads: item.downloads,
        likes: item.likes,
        pageURL: item.pageURL
      }

      uni.navigateTo({
        url: `/pages/material/detail/index?media=${encodeQueryObject(payload)}`
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

.search-header {
  display: flex;
  align-items: center;
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

.active-scroll {
  margin-top: 22rpx;
  white-space: nowrap;
}

.active-filter-list {
  display: inline-flex;
}

.active-filter {
  display: inline-flex;
  align-items: center;
  height: 52rpx;
  margin-right: 12rpx;
  padding: 0 18rpx;
  border-radius: 8rpx;
  background: #ffffff;
  color: #475467;
  font-size: 24rpx;
}

.media-switch {
  display: flex;
  align-items: center;
  width: 232rpx;
  height: 58rpx;
  margin-top: 18rpx;
  padding: 4rpx;
  border-radius: 8rpx;
  background: #eef1f5;
}

.media-switch__item {
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

.media-switch__item--active {
  background: #111827;
  color: #ffffff;
}

.compact-filter-scroll {
  margin-top: 18rpx;
  white-space: nowrap;
}

.compact-filter-bar {
  display: inline-flex;
  align-items: center;
  padding-right: 8rpx;
}

.compact-filter {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  height: 56rpx;
  margin-right: 12rpx;
  padding: 0 20rpx;
  border-radius: 8rpx;
  background: #eef1f5;
  color: #475467;
  font-size: 24rpx;
  font-weight: 700;
}

.compact-filter--active {
  background: #111827;
  color: #ffffff;
}

.compact-filter__arrow {
  margin-left: 6rpx;
  font-size: 22rpx;
}

.state-card {
  margin-top: 28rpx;
  padding: 36rpx 28rpx;
  border-radius: 8rpx;
  background: #ffffff;
  color: #667085;
  font-size: 26rpx;
  line-height: 1.6;
}

.image-grid {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  margin-top: 28rpx;
}

.image-card {
  overflow: hidden;
  width: 48.7%;
  margin-bottom: 18rpx;
  border-radius: 8rpx;
  background: #ffffff;
}

.image-card__cover {
  position: relative;
}

.image-card__img {
  display: block;
  width: 100%;
  height: 248rpx;
  background: #e4e7ec;
}

.image-card__video-badge {
  position: absolute;
  right: 12rpx;
  bottom: 12rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 40rpx;
  padding: 0 14rpx;
  border-radius: 8rpx;
  background: rgba(16, 24, 40, 0.82);
  color: #ffffff;
  font-size: 22rpx;
  font-weight: 700;
}

.image-card__meta {
  padding: 16rpx;
}

.image-card__tags,
.image-card__author {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.image-card__tags {
  color: #172033;
  font-size: 24rpx;
  font-weight: 700;
}

.image-card__author {
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
