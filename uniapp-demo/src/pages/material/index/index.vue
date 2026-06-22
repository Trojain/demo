<template>
  <view class="page">
    <view class="hero">
      <view class="search-box" @tap="goSearch">
        <text class="search-box__icon">⌕</text>
        <text class="search-box__placeholder">搜索素材</text>
      </view>
    </view>

    <view class="section section--category">
      <view class="section__header">
        <text class="section__title">分类</text>
        <text class="section__hint">{{ categories.length }} 个官方分类</text>
      </view>

      <view class="category-grid">
        <view v-for="item in categories" :key="item.value" :class="['category-card', `category-card--${item.tone}`]" @tap="goCategory(item)">
          <view class="category-card__shade"></view>
          <text class="category-card__label">{{ item.label }}</text>
          <text class="category-card__value">{{ item.value }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import { MATERIAL_CATEGORIES, DEFAULT_MATERIAL_FILTERS } from '@/config/material-options'
import { encodeQueryObject } from '@/utils/query'
import { createPageShareOptions, createPageTimelineOptions } from '@/utils/page-share'

export default {
  data() {
    return {
      categories: MATERIAL_CATEGORIES
    }
  },
  onShareAppMessage() {
    return createPageShareOptions({
      title: '精选素材'
    })
  },
  onShareTimeline() {
    return createPageTimelineOptions({
      title: '精选素材'
    })
  },
  methods: {
    goSearch() {
      uni.navigateTo({
        url: '/pages/material/search/index'
      })
    },
    goCategory(item) {
      const query = {
        ...DEFAULT_MATERIAL_FILTERS,
        category: item.value
      }

      uni.navigateTo({
        url: `/pages/material/search/index?filters=${encodeQueryObject(query)}`
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

.hero {
  display: flex;
  align-items: center;
  padding-top: 12rpx;
}

.search-box {
  display: flex;
  flex: 1;
  align-items: center;
  height: 72rpx;
  padding: 0 28rpx;
  border-radius: 8rpx;
  background: #eef0f4;
}

.search-box__icon {
  color: #7a8494;
  font-size: 46rpx;
  line-height: 1;
}

.search-box__placeholder {
  margin-left: 14rpx;
  color: #8d96a5;
  font-size: 30rpx;
  font-weight: 600;
}

.section {
  margin-top: 56rpx;
}

.section--category {
  margin-top: 56rpx;
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

.section__hint {
  color: #98a2b3;
  font-size: 24rpx;
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

.category-card__value {
  position: absolute;
  left: 24rpx;
  bottom: 22rpx;
  color: rgba(255, 255, 255, 0.82);
  font-size: 22rpx;
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
