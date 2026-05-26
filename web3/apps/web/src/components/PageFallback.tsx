import { Flex, Spin, Typography } from 'antd';
import styles from './PageFallback.module.scss';

export function PageFallback() {
  return (
    <div className={styles.wrapper}>
      <Flex vertical align="center" gap={12}>
        <Spin />
        <Typography.Text type="secondary">页面加载中</Typography.Text>
      </Flex>
    </div>
  );
}
