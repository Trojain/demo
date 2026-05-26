import { useEffect } from 'react';
import { useTradingStore } from '../stores/tradingStore';

export function useBootstrapTrading() {
  const refreshAll = useTradingStore((state) => state.refreshAll);

  useEffect(() => {
    void refreshAll();
  }, [refreshAll]);
}
