<template>
  <view class="page">
    <view class="header-card">
      <text class="header-card__title">{{ pageTitle }}</text>
      <text class="header-card__desc">根据当前分类浏览 360 壁纸，点击卡片可进入原图预览和下载。</text>
    </view>

    <scroll-view v-if="categories.length > 0" scroll-x class="category-scroll" :show-scrollbar="false">
      <view class="category-scroll__list">
        <view
          v-for="item in categories"
          :key="item.id"
          :class="['category-chip', { 'category-chip--active': currentCategoryId === item.id }]"
          @tap="selectCategory(item)"
        >
          <text>{{ item.label }}</text>
        </view>
      </view>
    </scroll-view>

    <view v-if="(isBootstrapping || isLoading) && wallpapers.length === 0" class="state-card">
      <text>壁纸加载中...</text>
    </view>

    <view v-else-if="!isLoading && wallpapers.length === 0" class="state-card">
      <text>暂无壁纸，换个分类试试</text>
    </view>

    <view v-else class="image-grid">
      <view v-for="item in wallpapers" :key="item.id" class="image-card" @tap="goDetail(item)">
        <view class="image-card__cover">
          <image class="image-card__img" :src="item.previewUrl || item.imageUrl" mode="aspectFill" lazy-load />
        </view>
        <view class="image-card__meta">
          <text class="image-card__title">{{ item.title }}</text>
          <text class="image-card__desc">{{ item.utag || item.resolution || '高清壁纸' }}</text>
        </view>
      </view>
    </view>

    <view v-if="wallpapers.length > 0" class="load-more" @tap="loadMore">
      <text>{{ loadMoreText }}</text>
    </view>
  </view>
</template>

<script>
import { fetchWallpaperByCategory, fetchWallpaperCategories } from '@/services/wallpaper-api'
import { decodeQueryObject, encodeQueryObject } from '@/utils/query'

export default {
  data() {
    return {
      pageTitle: '高清壁纸',
      categories: [],
      currentCategoryId: '',
      currentCategoryLabel: '',
      wallpapers: [],
      page: 1,
      isBootstrapping: true,
      isLoading: false,
      isFinished: false
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
    this.pageTitle = query.title || this.pageTitle
    this.currentCategoryId = query.categoryId || ''
    this.currentCategoryLabel = query.categoryLabel || ''
    this.fetchCategories()
  },
  onReachBottom() {
    this.loadMore()
  },
  methods: {
    fetchCategories() {
      fetchWallpaperCategories()
        .then((list) => {
          this.categories = list

          const matchedCategory = list.find(item => item.id === this.currentCategoryId)
          const targetCategory = matchedCategory || list[0] || {}
          this.currentCategoryId = targetCategory.id || ''
          this.currentCategoryLabel = targetCategory.label || ''
          this.pageTitle = this.currentCategoryLabel || this.pageTitle

          this.fetchWallpapers(true)
        })
        .catch(() => {
          this.isBootstrapping = false
          uni.showToast({
            title: '分类加载失败',
            icon: 'none'
          })
        })
    },
    selectCategory(item) {
      if (this.currentCategoryId === item.id) {
        return
      }

      this.currentCategoryId = item.id
      this.currentCategoryLabel = item.label
      this.pageTitle = item.label
      this.fetchWallpapers(true)
    },
    fetchWallpapers(reset) {
      if (this.isLoading || !this.currentCategoryId) {
        this.isBootstrapping = false
        return
      }

      if (reset) {
        this.page = 1
        this.wallpapers = []
        this.isFinished = false
      }

      this.isLoading = true

      fetchWallpaperByCategory({
        categoryId: this.currentCategoryId,
        page: this.page
      })
        .then((res) => {
          const nextList = reset ? res.list : this.wallpapers.concat(res.list)
          this.wallpapers = nextList
          this.isFinished = res.isFinished
        })
        .catch(() => {
          uni.showToast({
            title: '壁纸查询失败',
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
      this.fetchWallpapers(false)
    },
    goDetail(item) {
      const payload = {
        ...item,
        categoryName: this.currentCategoryLabel || item.categoryName
      }

      uni.navigateTo({
        url: `/pages/wallpaper/detail/index?wallpaper=${encodeQueryObject(payload)}`
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
  line-height: 1.6;
}

.category-scroll {
  margin-top: 20rpx;
  white-space: nowrap;
}

.category-scroll__list {
  display: inline-flex;
  padding-right: 8rpx;
}

.category-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 56rpx;
  margin-right: 12rpx;
  padding: 0 20rpx;
  border-radius: 8rpx;
  background: #eef1f5;
  color: #475467;
  font-size: 24rpx;
  font-weight: 700;
}

.category-chip--active {
  background: #111827;
  color: #ffffff;
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

.image-card__img {
  display: block;
  width: 100%;
  height: 248rpx;
  background: #e4e7ec;
}

.image-card__meta {
  padding: 16rpx;
}

.image-card__title,
.image-card__desc {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.image-card__title {
  color: #172033;
  font-size: 24rpx;
  font-weight: 700;
}

.image-card__desc {
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
