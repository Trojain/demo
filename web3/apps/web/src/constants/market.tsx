import type { ExchangeCode } from '../types';

function InlineIconLabel({ icon, text }: { icon: string; text: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <img src={icon} alt={text} style={{ width: 18, height: 18, borderRadius: '50%' }} />
      <span>{text}</span>
    </span>
  );
}

function CoinOptionLabel({ symbol }: { symbol: string }) {
  const coin = getCoinSymbol(symbol);
  const meta = getCoinMeta(symbol);

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      {meta.icon ? <img src={meta.icon} alt={coin} style={{ width: 18, height: 18, borderRadius: '50%' }} /> : null}
      <span>{coin}</span>
    </span>
  );
}

// 交易所下拉复用本地币种图标，OKX 暂用 OKB，Binance 暂用 BNB。
export const EXCHANGE_META: Record<ExchangeCode, { name: string; icon: string }> = {
  okx: { name: 'OKX', icon: '/coin-icons/OKB.png' },
  binance: { name: 'Binance', icon: '/coin-icons/BNB.png' },
};

export const MARKET_EXCHANGE_OPTIONS = (Object.keys(EXCHANGE_META) as ExchangeCode[]).map(exchange => {
  const meta = EXCHANGE_META[exchange];

  return {
    label: <InlineIconLabel icon={meta.icon} text={meta.name} />,
    value: exchange,
  };
});

export const SUPPORTED_MARKET_SYMBOLS_BY_EXCHANGE: Record<ExchangeCode, readonly string[]> = {
  okx: ['BTC-USDT', 'ETH-USDT', 'SOL-USDT', 'DOGE-USDT', 'OKB-USDT', 'BNB-USDT'],
  binance: ['BTC-USDT', 'ETH-USDT', 'SOL-USDT', 'DOGE-USDT', 'BNB-USDT'],
};

export const SUPPORTED_MARKET_SYMBOLS = SUPPORTED_MARKET_SYMBOLS_BY_EXCHANGE.okx;

export type SupportedMarketSymbol = (typeof SUPPORTED_MARKET_SYMBOLS)[number];

export const DEFAULT_MARKET_SYMBOL: SupportedMarketSymbol = 'BTC-USDT';

export const COIN_META: Record<string, { name: string; icon: string }> = {
  BTC: { name: 'Bitcoin', icon: '/coin-icons/BTC.png' },
  ETH: { name: 'Ethereum', icon: '/coin-icons/ETH.png' },
  SOL: { name: 'Solana', icon: '/coin-icons/SOL.png' },
  DOGE: { name: 'Dogecoin', icon: '/coin-icons/DOGE.png' },
  OKB: { name: 'OKB', icon: '/coin-icons/OKB.png' },
  BNB: { name: 'Build and Build', icon: '/coin-icons/BNB.png' },
};

export const MARKET_SYMBOL_OPTIONS = SUPPORTED_MARKET_SYMBOLS.map((symbol) => ({
  label: <CoinOptionLabel symbol={symbol} />,
  value: symbol
}));

export function getMarketSymbolOptions(exchange: ExchangeCode) {
  return SUPPORTED_MARKET_SYMBOLS_BY_EXCHANGE[exchange].map((symbol) => ({
    label: <CoinOptionLabel symbol={symbol} />,
    value: symbol
  }));
}

export function getCoinSymbol(marketSymbol: string) {
  return marketSymbol.replace('-USDT', '');
}

export function getCoinMeta(marketSymbol: string) {
  const coin = getCoinSymbol(marketSymbol);
  return COIN_META[coin] ?? { name: coin, icon: '' };
}
