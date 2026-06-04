import { Decimal } from 'decimal.js'
import type { TradePosition, TradePositionView } from '../types'
import { createMarketPriceSnapshot, tickerKey, type MarketPriceSnapshot } from './marketPrice'

/**
 * 根据持仓估值结果构建初始行情快照。
 * 这里统一保留后端返回的 `marketEventTime`，避免页面各自拼接当前时间造成旧价看起来像新价。
 */
export function buildPositionMarketPriceSnapshots(positionViews: TradePositionView[] = []) {
  return positionViews.map(position =>
    createMarketPriceSnapshot(
      {
        exchange: position.exchange,
        symbol: position.symbol,
        price: position.marketPrice,
        eventTime: position.marketEventTime ?? '',
      },
      'valuation',
    ),
  )
}

/**
 * 用统一行情快照回写持仓视图，保证总览页和旧持仓页都遵循同一套时序合并规则。
 */
export function calculatePositionViewsWithLatestPrices(
  positions: TradePosition[],
  latestPriceByKey: Record<string, MarketPriceSnapshot>,
): TradePositionView[] {
  return positions.map(position => {
    const latestSnapshot = latestPriceByKey[tickerKey(position)]
    const marketPrice = latestSnapshot?.price ?? '0'
    const marketValue = new Decimal(position.quantity).mul(marketPrice)
    const unrealizedPnl = marketValue.minus(position.costAmount)
    const costAmount = new Decimal(position.costAmount)
    const unrealizedPnlPercent = costAmount.isZero() ? new Decimal(0) : unrealizedPnl.div(costAmount).mul(100)

    return {
      ...position,
      marketPrice,
      marketEventTime: latestSnapshot?.eventTime,
      marketValue: marketValue.toFixed(),
      unrealizedPnl: unrealizedPnl.toFixed(),
      unrealizedPnlPercent: unrealizedPnlPercent.toFixed(2),
    }
  })
}
