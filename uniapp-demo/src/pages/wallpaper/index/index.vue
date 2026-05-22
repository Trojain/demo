<template>
  <view class="page">
    <view class="hero-card">
      <text class="hero-card__title">高清壁纸</text>
      <text class="hero-card__desc">按分类浏览壁纸，点击卡片可进入原图预览和下载。</text>
    </view>

    <view class="section">
      <view class="section__header">
        <text class="section__title">壁纸分类</text>
      </view>

      <view v-if="isLoading" class="state-card">
        <text>分类加载中...</text>
      </view>

      <view v-else-if="categories.length === 0" class="state-card">
        <text>暂无分类，请稍后再试</text>
      </view>

      <view v-else class="category-grid">
        <view v-for="item in categories" :key="item.id" :class="['category-card', `category-card--${item.tone}`]" @tap="goCategory(item)">
          <view class="category-card__shade"></view>
          <text class="category-card__label">{{ item.label }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import { fetchWallpaperCategories } from '@/services/wallpaper-api'
import { encodeQueryObject } from '@/utils/query'

export default {
  data() {
    return {
      categories: [],
      isLoading: false
    }
  },
  onLoad() {
    this.fetchCategories()
  },
  methods: {
    fetchCategories() {
      if (this.isLoading) {
        return
      }

      this.isLoading = true
      fetchWallpaperCategories()
        .then(list => {
          this.categories = list
        })
        .catch(() => {
          uni.showToast({
            title: '分类加载失败',
            icon: 'none'
          })
        })
        .then(() => {
          this.isLoading = false
        })
    },
    goCategory(item) {
      uni.navigateTo({
        url: `/pages/wallpaper/list/index?query=${encodeQueryObject({
          categoryId: item.id,
          categoryLabel: item.label,
          title: item.label
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
  padding: 30rpx 28rpx;
  border-radius: 8rpx;
  background: linear-gradient(135deg, #111827, #374151);
}

.hero-card__title {
  display: block;
  color: #ffffff;
  font-size: 38rpx;
  font-weight: 800;
}

.hero-card__desc {
  display: block;
  margin-top: 14rpx;
  color: rgba(255, 255, 255, 0.82);
  font-size: 24rpx;
  line-height: 1.6;
}

.section {
  margin-top: 34rpx;
}

.section__header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  margin-bottom: 24rpx;
}

.section__title {
  color: #101828;
  font-size: 34rpx;
  font-weight: 800;
}

.state-card {
  padding: 36rpx 28rpx;
  border-radius: 8rpx;
  background: #ffffff;
  color: #667085;
  font-size: 26rpx;
  line-height: 1.6;
}

.category-grid {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
}

.category-card {
  position: relative;
  overflow: hidden;
  width: 48.7%;
  height: 148rpx;
  margin-bottom: 18rpx;
  border-radius: 8rpx;
  background: #344054;
}

.category-card__shade {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.18), rgba(0, 0, 0, 0.32));
}

.category-card__label {
  position: absolute;
  left: 24rpx;
  top: 40rpx;
  color: #ffffff;
  font-size: 34rpx;
  font-weight: 800;
}

.category-card--blue {
  background: #2563eb;
}

.category-card--rose {
  background: #e11d48;
}

.category-card--green {
  background: #16803c;
}

.category-card--cyan {
  background: #0891b2;
}

.category-card--amber {
  background: #b45309;
}

.category-card--violet {
  background: #7c3aed;
}

.category-card--teal {
  background: #0f766e;
}

.category-card--orange {
  background: #c2410c;
}

.category-card--indigo {
  background: #4f46e5;
}

.category-card--slate {
  background: #475467;
}

.category-card--lime {
  background: #4d7c0f;
}

.category-card--steel {
  background: #334155;
}

.category-card--red {
  background: #b42318;
}
</style>
