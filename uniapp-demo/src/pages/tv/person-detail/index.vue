<template>
  <view class="page">
    <view class="hero-card">
      <image class="hero-card__image" :src="person.imageUrl" mode="aspectFill" />
      <view class="hero-card__content">
        <text class="hero-card__title">{{ person.name || '演员详情' }}</text>
        <text class="hero-card__meta">{{ person.country || '国家待补充' }} · {{ person.gender || '性别待补充' }}</text>
        <text class="hero-card__meta">{{ person.birthday || '生日待补充' }}</text>
      </view>
    </view>

    <view v-if="errorMessage" class="notice-card">
      <text class="notice-card__title">演员资料暂时不可用</text>
      <text class="notice-card__desc">{{ errorMessage }}</text>
      <view class="notice-card__action" @tap="fetchPersonData(currentPersonId)">重新加载</view>
    </view>

    <view class="type-switch">
      <view
        v-for="item in tabs"
        :key="item.value"
        :class="['type-switch__item', { 'type-switch__item--active': activeTab === item.value }]"
        @tap="activeTab = item.value"
      >
        <text>{{ item.label }}</text>
      </view>
    </view>

    <view v-if="activeTab === 'base'" class="panel-card">
      <text class="panel-card__title">基础资料</text>
      <view class="detail-grid">
        <view class="detail-item">
          <text class="detail-item__label">姓名</text>
          <text class="detail-item__value">{{ person.name || '待补充' }}</text>
        </view>
        <view class="detail-item">
          <text class="detail-item__label">国家</text>
          <text class="detail-item__value">{{ person.country || '待补充' }}</text>
        </view>
        <view class="detail-item">
          <text class="detail-item__label">生日</text>
          <text class="detail-item__value">{{ person.birthday || '待补充' }}</text>
        </view>
        <view class="detail-item">
          <text class="detail-item__label">性别</text>
          <text class="detail-item__value">{{ person.gender || '待补充' }}</text>
        </view>
      </view>
    </view>

    <view v-if="activeTab === 'cast'" class="panel-card">
      <view class="panel-card__header">
        <text class="panel-card__title">参演作品</text>
        <text class="panel-card__meta">{{ castCredits.length }} 部</text>
      </view>
      <view v-if="castCredits.length === 0" class="panel-card__empty">暂无参演作品</view>
      <view v-else class="credit-list">
        <view v-for="item in castCredits" :key="item.id" class="credit-card" @tap="goShowDetail(item.showId)">
          <image class="credit-card__image" :src="item.imageUrl" mode="aspectFill" />
          <view class="credit-card__content">
            <text class="credit-card__title">{{ item.title }}</text>
            <text class="credit-card__desc">{{ item.subtitle || '类型待补充' }}</text>
          </view>
        </view>
      </view>
    </view>

    <view v-if="activeTab === 'crew'" class="panel-card">
      <view class="panel-card__header">
        <text class="panel-card__title">幕后作品</text>
        <text class="panel-card__meta">{{ crewCredits.length }} 部</text>
      </view>
      <view v-if="crewCredits.length === 0" class="panel-card__empty">暂无幕后作品</view>
      <view v-else class="credit-list">
        <view v-for="item in crewCredits" :key="item.id" class="credit-card" @tap="goShowDetail(item.showId)">
          <image class="credit-card__image" :src="item.imageUrl" mode="aspectFill" />
          <view class="credit-card__content">
            <text class="credit-card__title">{{ item.title }}</text>
            <text class="credit-card__desc">{{ item.subtitle || '类型待补充' }}</text>
          </view>
        </view>
      </view>
    </view>

    <view v-if="activeTab === 'guest'" class="panel-card">
      <view class="panel-card__header">
        <text class="panel-card__title">客串记录</text>
        <text class="panel-card__meta">{{ guestCredits.length }} 条</text>
      </view>
      <view v-if="guestCredits.length === 0" class="panel-card__empty">暂无客串记录</view>
      <view v-else class="guest-list">
        <view v-for="item in guestCredits" :key="item.id" class="guest-card">
          <text class="guest-card__title">{{ item.title }}</text>
          <text class="guest-card__desc">{{ item.subtitle || '集信息待补充' }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import { fetchTvPersonDetail, getTvErrorMessage } from '@/services/tv-api'
import { decodeQueryObject, encodeQueryObject } from '@/utils/query'
import { createPageShareOptions, createPageTimelineOptions } from '@/utils/page-share'

export default {
  data() {
    return {
      currentPersonId: '',
      errorMessage: '',
      activeTab: 'base',
      tabs: [
        { label: '资料', value: 'base' },
        { label: '参演', value: 'cast' },
        { label: '幕后', value: 'crew' },
        { label: '客串', value: 'guest' }
      ],
      person: {
        name: '',
        country: '',
        birthday: '',
        gender: '',
        imageUrl: ''
      },
      castCredits: [],
      crewCredits: [],
      guestCredits: []
    }
  },
  onShareAppMessage() {
    return createPageShareOptions({
      title: this.person.name || '演员详情'
    })
  },
  onShareTimeline() {
    return createPageTimelineOptions({
      title: this.person.name || '演员详情'
    })
  },
  onLoad(options) {
    const query = decodeQueryObject(options.query)
    this.fetchPersonData(query.personId)
  },
  methods: {
    fetchPersonData(personId) {
      if (!personId) {
        uni.showToast({
          title: '缺少演员编号',
          icon: 'none'
        })
        return
      }

      this.currentPersonId = personId
      this.errorMessage = ''
      fetchTvPersonDetail(personId)
        .then((data) => {
          this.person = data.person
          this.castCredits = data.castCredits
          this.crewCredits = data.crewCredits
          this.guestCredits = data.guestCredits
        })
        .catch((error) => {
          this.errorMessage = getTvErrorMessage(error)
          uni.showToast({
            title: this.errorMessage,
            icon: 'none'
          })
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
  padding: 28rpx 28rpx 40rpx;
  background: #f7f8fb;
}

.hero-card,
.panel-card {
  padding: 28rpx;
  border-radius: 8rpx;
  background: #ffffff;
}

.hero-card {
  display: flex;
}

.hero-card__image {
  flex-shrink: 0;
  width: 176rpx;
  height: 224rpx;
  border-radius: 8rpx;
  background: #d0d5dd;
}

.hero-card__content {
  flex: 1;
  margin-left: 20rpx;
}

.hero-card__title {
  display: block;
  color: #101828;
  font-size: 34rpx;
  font-weight: 800;
}

.hero-card__meta {
  display: block;
  margin-top: 12rpx;
  color: #667085;
  font-size: 24rpx;
  line-height: 1.5;
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

.type-switch {
  display: flex;
  align-items: center;
  width: 440rpx;
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
  font-size: 22rpx;
  font-weight: 700;
}

.type-switch__item--active {
  background: #111827;
  color: #ffffff;
}

.panel-card {
  margin-top: 20rpx;
}

.panel-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.panel-card__title {
  color: #101828;
  font-size: 30rpx;
  font-weight: 800;
}

.panel-card__meta {
  color: #98a2b3;
  font-size: 22rpx;
}

.panel-card__empty {
  margin-top: 18rpx;
  color: #98a2b3;
  font-size: 22rpx;
}

.detail-grid {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  margin-top: 18rpx;
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
  line-height: 1.45;
}

.credit-list {
  margin-top: 18rpx;
}

.credit-card {
  display: flex;
  margin-bottom: 16rpx;
  padding: 18rpx;
  border-radius: 8rpx;
  background: #f7f8fb;
}

.credit-card__image {
  flex-shrink: 0;
  width: 112rpx;
  height: 148rpx;
  border-radius: 8rpx;
  background: #d0d5dd;
}

.credit-card__content {
  flex: 1;
  margin-left: 18rpx;
}

.credit-card__title {
  display: block;
  color: #172033;
  font-size: 26rpx;
  font-weight: 800;
}

.credit-card__desc {
  display: block;
  margin-top: 10rpx;
  color: #667085;
  font-size: 22rpx;
}

.guest-list {
  margin-top: 18rpx;
}

.guest-card {
  margin-bottom: 16rpx;
  padding: 18rpx;
  border-radius: 8rpx;
  background: #f7f8fb;
}

.guest-card__title {
  display: block;
  color: #172033;
  font-size: 24rpx;
  font-weight: 800;
}

.guest-card__desc {
  display: block;
  margin-top: 10rpx;
  color: #667085;
  font-size: 22rpx;
}
</style>
