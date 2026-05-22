<template>
  <view class="page">
    <view class="hero">
      <image class="hero__background" :src="detail.backgroundUrl || detail.imageUrl" mode="aspectFill" />
      <view class="hero__overlay"></view>
      <view class="hero__content">
        <image class="hero__poster" :src="detail.posterUrl" mode="aspectFill" />
        <view class="hero__info">
          <text class="hero__badge">{{ detail.type || '剧集' }}</text>
          <text class="hero__title">{{ detail.name || '剧集详情' }}</text>
          <text class="hero__meta">评分 {{ detail.rating ? detail.rating.toFixed(1) : '暂无' }} · {{ detail.status || '状态待补充' }}</text>
          <text class="hero__meta">{{ detail.networkName || detail.webChannelName || '播出平台待补充' }}</text>
        </view>
      </view>
    </view>

    <view v-if="errorMessage" class="notice-card">
      <text class="notice-card__title">剧集详情暂时不可用</text>
      <text class="notice-card__desc">{{ errorMessage }}</text>
      <view class="notice-card__action" @tap="fetchShowDetailData(currentShowId)">重新加载</view>
    </view>

    <view class="info-panel">
      <view class="meta-strip">
        <view class="meta-strip__item">
          <text class="meta-strip__label">首播</text>
          <text class="meta-strip__value">{{ detail.premiered || '待补充' }}</text>
        </view>
        <view class="meta-strip__item">
          <text class="meta-strip__label">语言</text>
          <text class="meta-strip__value">{{ detail.language || '待补充' }}</text>
        </view>
        <view class="meta-strip__item">
          <text class="meta-strip__label">时长</text>
          <text class="meta-strip__value">{{ detail.averageRuntime ? `${detail.averageRuntime} 分钟` : '待补充' }}</text>
        </view>
      </view>

      <view class="content-block">
        <text class="content-block__title">剧情简介</text>
        <text class="content-block__text">{{ detail.summary || '暂无简介。' }}</text>
      </view>

      <view class="content-block">
        <text class="content-block__title">播出信息</text>
        <view class="detail-grid">
          <view class="detail-item">
            <text class="detail-item__label">播出时间</text>
            <text class="detail-item__value">{{ detail.scheduleDays.join(' / ') || '待补充' }} {{ detail.scheduleTime || '' }}</text>
          </view>
          <view class="detail-item">
            <text class="detail-item__label">电视网 / 平台</text>
            <text class="detail-item__value">{{ detail.networkName || detail.webChannelName || '待补充' }}</text>
          </view>
          <view class="detail-item">
            <text class="detail-item__label">类型</text>
            <text class="detail-item__value">{{ detail.genres.join(' / ') || '待补充' }}</text>
          </view>
          <view class="detail-item">
            <text class="detail-item__label">官网</text>
            <text class="detail-item__value">{{ detail.officialSite || '暂无官网' }}</text>
          </view>
        </view>
      </view>
    </view>

    <view class="section-card">
      <view class="section-card__header">
        <text class="section-card__title">演员阵容</text>
        <text class="section-card__meta">{{ cast.length }} 位</text>
      </view>
      <scroll-view scroll-x class="scroll-row" :show-scrollbar="false">
        <view class="cast-row">
          <view v-for="item in cast" :key="item.id" class="cast-card" @tap="goPersonDetail(item.id)">
            <image class="cast-card__image" :src="item.imageUrl" mode="aspectFill" />
            <text class="cast-card__title">{{ item.name }}</text>
            <text class="cast-card__desc">{{ item.characterName || '角色待补充' }}</text>
          </view>
        </view>
      </scroll-view>
    </view>

    <view class="section-card">
      <view class="section-card__header">
        <text class="section-card__title">季列表</text>
        <text class="section-card__meta">{{ seasons.length }} 季</text>
      </view>
      <view class="season-list">
        <view v-for="item in seasons" :key="item.id" class="season-card" @tap="goSeasonPage(item.id)">
          <view class="season-card__main">
            <text class="season-card__title">{{ item.title }}</text>
            <text class="season-card__desc">{{ item.premiereDate || '待定日期' }} · {{ item.episodeOrder || 0 }} 集</text>
          </view>
          <text class="season-card__arrow">›</text>
        </view>
      </view>
    </view>

    <view v-if="images.length > 0" class="section-card">
      <view class="section-card__header">
        <text class="section-card__title">剧照图库</text>
        <text class="section-card__meta">{{ images.length }} 张</text>
      </view>
      <scroll-view scroll-x class="scroll-row" :show-scrollbar="false">
        <view class="gallery-row">
          <image v-for="item in images" :key="item.id" class="gallery-image" :src="item.imageUrl" mode="aspectFill" />
        </view>
      </scroll-view>
    </view>

    <view v-if="akas.length > 0" class="section-card">
      <view class="section-card__header">
        <text class="section-card__title">别名</text>
      </view>
      <view class="aka-list">
        <view v-for="item in akas" :key="item.id" class="aka-chip">
          <text>{{ item.name }}{{ item.countryName ? ` · ${item.countryName}` : '' }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import { fetchTvShowDetail, getTvErrorMessage } from '@/services/tv-api'
import { decodeQueryObject, encodeQueryObject } from '@/utils/query'

export default {
  data() {
    return {
      currentShowId: '',
      errorMessage: '',
      detail: {
        name: '',
        summary: '',
        imageUrl: '',
        posterUrl: '',
        backgroundUrl: '',
        rating: 0,
        type: '',
        status: '',
        networkName: '',
        webChannelName: '',
        scheduleDays: [],
        scheduleTime: '',
        genres: [],
        officialSite: '',
        premiered: '',
        language: '',
        averageRuntime: 0
      },
      cast: [],
      seasons: [],
      images: [],
      akas: []
    }
  },
  onLoad(options) {
    const query = decodeQueryObject(options.query)
    this.fetchShowDetailData(query.showId)
  },
  methods: {
    fetchShowDetailData(showId) {
      if (!showId) {
        uni.showToast({
          title: '缺少剧集编号',
          icon: 'none'
        })
        return
      }

      this.currentShowId = showId
      this.errorMessage = ''
      fetchTvShowDetail(showId)
        .then((data) => {
          this.detail = data.detail
          this.cast = data.cast
          this.seasons = data.seasons
          this.images = data.images
          this.akas = data.akas
        })
        .catch((error) => {
          this.errorMessage = getTvErrorMessage(error)
          uni.showToast({
            title: this.errorMessage,
            icon: 'none'
          })
        })
    },
    goSeasonPage(seasonId) {
      uni.navigateTo({
        url: `/pages/tv/season/index?query=${encodeQueryObject({
          showId: this.currentShowId,
          seasonId
        })}`
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
  background: #0f172a;
}

.hero {
  position: relative;
  min-height: 520rpx;
}

.hero__background,
.hero__overlay {
  position: absolute;
  inset: 0;
}

.hero__background {
  width: 100%;
  height: 100%;
}

.hero__overlay {
  background: linear-gradient(180deg, rgba(15, 23, 42, 0.16), rgba(15, 23, 42, 0.94));
}

.hero__content {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: flex-end;
  padding: 240rpx 28rpx 40rpx;
}

.hero__poster {
  flex-shrink: 0;
  width: 208rpx;
  height: 292rpx;
  border-radius: 8rpx;
  background: rgba(255, 255, 255, 0.12);
}

.hero__info {
  flex: 1;
  margin-left: 20rpx;
}

.hero__badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 40rpx;
  padding: 0 12rpx;
  border-radius: 8rpx;
  background: rgba(255, 255, 255, 0.14);
  color: #ffffff;
  font-size: 20rpx;
}

.hero__title {
  display: block;
  margin-top: 12rpx;
  color: #ffffff;
  font-size: 36rpx;
  font-weight: 800;
  line-height: 1.35;
}

.hero__meta {
  display: block;
  margin-top: 12rpx;
  color: rgba(255, 255, 255, 0.82);
  font-size: 24rpx;
  line-height: 1.45;
}

.notice-card,
.info-panel,
.section-card {
  margin: 24rpx 28rpx 0;
  border-radius: 8rpx;
}

.notice-card {
  padding: 24rpx;
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

.info-panel,
.section-card {
  padding: 28rpx;
  background: #ffffff;
}

.meta-strip {
  display: flex;
  justify-content: space-between;
  padding: 20rpx;
  border-radius: 8rpx;
  background: #f7f8fb;
}

.meta-strip__item {
  width: 31%;
}

.meta-strip__label {
  display: block;
  color: #98a2b3;
  font-size: 20rpx;
}

.meta-strip__value {
  display: block;
  margin-top: 8rpx;
  color: #111827;
  font-size: 24rpx;
  font-weight: 700;
}

.content-block {
  margin-top: 22rpx;
}

.content-block__title {
  display: block;
  color: #111827;
  font-size: 28rpx;
  font-weight: 800;
}

.content-block__text {
  display: block;
  margin-top: 14rpx;
  color: #172033;
  font-size: 26rpx;
  line-height: 1.7;
}

.detail-grid {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  margin-top: 16rpx;
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

.section-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.section-card__title {
  color: #101828;
  font-size: 30rpx;
  font-weight: 800;
}

.section-card__meta {
  color: #98a2b3;
  font-size: 22rpx;
}

.scroll-row {
  margin-top: 18rpx;
  white-space: nowrap;
}

.cast-row,
.gallery-row {
  display: inline-flex;
  padding-right: 12rpx;
}

.cast-card {
  width: 172rpx;
  margin-right: 16rpx;
}

.cast-card__image {
  display: block;
  width: 172rpx;
  height: 220rpx;
  border-radius: 8rpx;
  background: #d0d5dd;
}

.cast-card__title,
.cast-card__desc {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cast-card__title {
  margin-top: 12rpx;
  color: #172033;
  font-size: 24rpx;
  font-weight: 700;
}

.cast-card__desc {
  margin-top: 8rpx;
  color: #98a2b3;
  font-size: 22rpx;
}

.season-list {
  margin-top: 18rpx;
}

.season-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16rpx;
  padding: 20rpx;
  border-radius: 8rpx;
  background: #f7f8fb;
}

.season-card__main {
  flex: 1;
}

.season-card__title {
  display: block;
  color: #172033;
  font-size: 26rpx;
  font-weight: 800;
}

.season-card__desc {
  display: block;
  margin-top: 10rpx;
  color: #98a2b3;
  font-size: 22rpx;
}

.season-card__arrow {
  margin-left: 16rpx;
  color: #98a2b3;
  font-size: 42rpx;
}

.gallery-image {
  width: 240rpx;
  height: 168rpx;
  margin-right: 16rpx;
  border-radius: 8rpx;
  background: #d0d5dd;
}

.aka-list {
  display: flex;
  flex-wrap: wrap;
  margin-top: 18rpx;
}

.aka-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 54rpx;
  margin-right: 12rpx;
  margin-bottom: 12rpx;
  padding: 0 18rpx;
  border-radius: 8rpx;
  background: #eef1f5;
  color: #475467;
  font-size: 22rpx;
}
</style>
