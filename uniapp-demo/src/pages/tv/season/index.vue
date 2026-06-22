<template>
  <view class="page">
    <view class="header-card">
      <text class="header-card__title">{{ show.name || '季 / 集结构' }}</text>
      <text class="header-card__desc">{{ show.summary || '按季查看每一集内容、播出日期和单集摘要。' }}</text>
    </view>

    <view v-if="errorMessage" class="notice-card">
      <text class="notice-card__title">分集信息暂时不可用</text>
      <text class="notice-card__desc">{{ errorMessage }}</text>
      <view class="notice-card__action" @tap="fetchSeasonData(currentShowId, currentSeasonId)">重新加载</view>
    </view>

    <view class="season-panel">
      <text class="season-panel__label">选择季度</text>
      <scroll-view scroll-x class="season-scroll" :show-scrollbar="false">
        <view class="season-row">
          <view
            v-for="item in seasons"
            :key="item.id"
            :class="['season-chip', { 'season-chip--active': currentSeasonId === item.id }]"
            @tap="switchSeason(item.id)"
          >
            <text>{{ item.title }}</text>
          </view>
        </view>
      </scroll-view>
    </view>

    <view v-if="currentSeason.id" class="summary-card">
      <text class="summary-card__title">{{ currentSeason.title }}</text>
      <text class="summary-card__desc">{{ currentSeason.premiereDate || '待定日期' }} · {{ currentSeason.episodeOrder || 0 }} 集</text>
    </view>

    <view v-if="isLoading" class="state-card">
      <text>分集数据加载中...</text>
    </view>

    <view v-else-if="episodes.length === 0" class="state-card">
      <text>当前季度暂无分集数据</text>
    </view>

    <view v-else class="episode-list">
      <view v-for="item in episodes" :key="item.id" class="episode-card">
        <image class="episode-card__image" :src="item.imageUrl || show.imageUrl" mode="aspectFill" />
        <view class="episode-card__content">
          <text class="episode-card__code">{{ item.code || `S${item.season}E${item.number}` }}</text>
          <text class="episode-card__title">{{ item.name }}</text>
          <text class="episode-card__meta">{{ item.airdate || '待定日期' }} {{ item.airtime || '' }}</text>
          <text class="episode-card__meta">{{ item.runtime ? `${item.runtime} 分钟` : '时长待补充' }}</text>
          <text class="episode-card__desc">{{ item.summary || '暂无单集简介。' }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import { fetchTvSeasonPageData, getTvErrorMessage } from '@/services/tv-api'
import { decodeQueryObject } from '@/utils/query'
import { createPageShareOptions, createPageTimelineOptions } from '@/utils/page-share'

export default {
  data() {
    return {
      currentShowId: '',
      currentSeasonId: '',
      errorMessage: '',
      isLoading: false,
      show: {
        name: '',
        summary: '',
        imageUrl: ''
      },
      seasons: [],
      currentSeason: {},
      episodes: []
    }
  },
  onShareAppMessage() {
    return createPageShareOptions({
      title: this.show.name ? `${this.show.name} 季集` : '季 / 集结构'
    })
  },
  onShareTimeline() {
    return createPageTimelineOptions({
      title: this.show.name ? `${this.show.name} 季集` : '季 / 集结构'
    })
  },
  onLoad(options) {
    const query = decodeQueryObject(options.query)
    this.fetchSeasonData(query.showId, query.seasonId)
  },
  methods: {
    fetchSeasonData(showId, seasonId = '') {
      if (!showId) {
        uni.showToast({
          title: '缺少剧集编号',
          icon: 'none'
        })
        return
      }

      this.currentShowId = showId
      this.currentSeasonId = seasonId || this.currentSeasonId
      this.isLoading = true
      this.errorMessage = ''

      fetchTvSeasonPageData(showId, this.currentSeasonId)
        .then((data) => {
          this.show = data.show
          this.seasons = data.seasons
          this.currentSeason = data.currentSeason || {}
          this.currentSeasonId = data.currentSeason?.id || ''
          this.episodes = data.episodes
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
    switchSeason(seasonId) {
      if (this.currentSeasonId === seasonId) {
        return
      }

      this.fetchSeasonData(this.currentShowId, seasonId)
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
.season-panel,
.summary-card,
.state-card {
  padding: 28rpx;
  border-radius: 8rpx;
  background: #ffffff;
}

.header-card__title,
.summary-card__title {
  display: block;
  color: #101828;
  font-size: 34rpx;
  font-weight: 800;
}

.header-card__desc,
.summary-card__desc {
  display: block;
  margin-top: 12rpx;
  color: #667085;
  font-size: 24rpx;
  line-height: 1.55;
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

.season-panel,
.summary-card,
.state-card,
.episode-list {
  margin-top: 20rpx;
}

.season-panel__label {
  display: block;
  color: #344054;
  font-size: 22rpx;
  font-weight: 700;
}

.season-scroll {
  margin-top: 12rpx;
  white-space: nowrap;
}

.season-row {
  display: inline-flex;
  padding-right: 8rpx;
}

.season-chip {
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

.season-chip--active {
  background: #111827;
  color: #ffffff;
}

.state-card {
  color: #667085;
  font-size: 26rpx;
}

.episode-card {
  display: flex;
  margin-bottom: 16rpx;
  padding: 18rpx;
  border-radius: 8rpx;
  background: #ffffff;
}

.episode-card__image {
  flex-shrink: 0;
  width: 132rpx;
  height: 176rpx;
  border-radius: 8rpx;
  background: #d0d5dd;
}

.episode-card__content {
  flex: 1;
  margin-left: 18rpx;
}

.episode-card__code {
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

.episode-card__title {
  display: block;
  margin-top: 10rpx;
  color: #172033;
  font-size: 26rpx;
  font-weight: 800;
  line-height: 1.45;
}

.episode-card__meta,
.episode-card__desc {
  display: block;
  margin-top: 10rpx;
  color: #667085;
  font-size: 22rpx;
  line-height: 1.5;
}
</style>
