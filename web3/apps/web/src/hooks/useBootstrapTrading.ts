import { useEffect } from 'react';
import { useTradingStore } from '../stores/tradingStore';

export function useBootstrapTrading() {
  const refreshSummary = useTradingStore((state) => state.refreshSummary);

  useEffect(() => {
    void refreshSummary();
  }, [refreshSummary]);
}
