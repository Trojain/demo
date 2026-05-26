export const SUPPORTED_MARKET_SYMBOLS = ['BTC-USDT', 'ETH-USDT', 'SOL-USDT', 'DOGE-USDT', 'OKB-USDT', 'BNB-USDT'] as const;

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
  label: symbol.replace('-USDT', ''),
  value: symbol
}));

export function getCoinSymbol(marketSymbol: string) {
  return marketSymbol.replace('-USDT', '');
}

export function getCoinMeta(marketSymbol: string) {
  const coin = getCoinSymbol(marketSymbol);
  return COIN_META[coin] ?? { name: coin, icon: '' };
}
