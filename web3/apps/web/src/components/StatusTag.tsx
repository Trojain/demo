import { Tag } from 'antd';
import type { RuleRuntimeStatus, TriggerStatus } from '../types';

export function TriggerStatusTag({ status }: { status: TriggerStatus }) {
  const colorMap: Record<TriggerStatus, string> = {
    pending: 'warning',
    confirmed: 'success',
    ignored: 'default',
    failed: 'error',
  };

  const textMap: Record<TriggerStatus, string> = {
    pending: '待处理',
    confirmed: '已执行',
    ignored: '已忽略',
    failed: '执行失败',
  };

  return <Tag color={colorMap[status]}>{textMap[status]}</Tag>;
}

export function BooleanTag({ value }: { value: boolean }) {
  return <Tag color={value ? 'success' : 'default'}>{value ? '启用' : '停用'}</Tag>;
}

export function RuleRuntimeStatusTag({ status }: { status: RuleRuntimeStatus }) {
  const colorMap: Record<RuleRuntimeStatus, string> = {
    idle: 'default',
    running: 'processing',
    paused: 'default',
    limit_reached: 'warning',
    error: 'error'
  };

  const textMap: Record<RuleRuntimeStatus, string> = {
    idle: '待运行',
    running: '运行中',
    paused: '已暂停',
    limit_reached: '已达上限',
    error: '异常'
  };

  return <Tag color={colorMap[status]}>{textMap[status]}</Tag>;
}
