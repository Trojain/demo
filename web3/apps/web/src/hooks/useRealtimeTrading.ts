import { useEffect } from 'react';
import { App as AntApp } from 'antd';
import { createRealtimeConnection } from '../api/realtime';
import { useTradingStore } from '../stores/tradingStore';

export function useRealtimeTrading() {
  const { message } = AntApp.useApp();
  const setTicker = useTradingStore((state) => state.setTicker);
  const prependTrigger = useTradingStore((state) => state.prependTrigger);

  useEffect(() => {
    return createRealtimeConnection({
      onMessage: (data) => {
        if (data.type === 'ticker.updated') {
          setTicker(data.payload);
        }
        if (data.type === 'trigger.created') {
          prependTrigger(data.payload);
          message.warning(`触发 ${data.payload.symbol} 目标价，请确认是否模拟下单`);
        }
      },
      onConnectionLost: () => {
        message.error('行情推送连接异常，请检查后端服务是否启动');
      }
    });
  }, [message, prependTrigger, setTicker]);
}
