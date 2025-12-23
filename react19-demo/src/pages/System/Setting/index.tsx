import { useState } from 'react'
import { Button, Card, Form, Input, List, Switch, Tabs, Upload } from 'antd'
import { UploadOutlined } from '@ant-design/icons'

const BasicSettings = () => {
  return (
    <div style={{ display: 'flex', gap: 24, maxWidth: 800 }}>
      <Form
        layout="vertical"
        initialValues={{ email: 'admin@example.com', name: 'Admin', profile: 'Super Administrator' }}
        style={{ flex: 1 }}
      >
        <Form.Item label="邮箱" name="email">
          <Input disabled />
        </Form.Item>
        <Form.Item label="昵称" name="name">
          <Input />
        </Form.Item>
        <Form.Item label="个人简介" name="profile">
          <Input.TextArea rows={4} />
        </Form.Item>
        <Form.Item>
          <Button type="primary">更新基本信息</Button>
        </Form.Item>
      </Form>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, width: 140 }}>
        <div
          style={{
            width: 100,
            height: 100,
            borderRadius: '50%',
            background: '#f0f0f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <img
            src="https://api.dicebear.com/7.x/avataaars/svg?seed=Admin"
            alt="avatar"
            style={{ width: '100%', borderRadius: '50%' }}
          />
        </div>
        <Upload showUploadList={false}>
          <Button icon={<UploadOutlined />}>更换头像</Button>
        </Upload>
      </div>
    </div>
  )
}

const SecuritySettings = () => {
  const data = [
    {
      title: '账户密码',
      description: '当前密码强度：强',
      action: <a key="Modify">修改</a>,
    },
    {
      title: '密保手机',
      description: '已绑定手机：138****8888',
      action: <a key="Modify">修改</a>,
    },
    {
      title: '备用邮箱',
      description: '已绑定邮箱：ant***@example.com',
      action: <a key="Modify">修改</a>,
    },
  ]

  return (
    <List
      itemLayout="horizontal"
      dataSource={data}
      renderItem={(item) => (
        <List.Item actions={[item.action]}>
          <List.Item.Meta title={item.title} description={item.description} />
        </List.Item>
      )}
    />
  )
}

const NotificationSettings = () => {
  const data = [
    {
      title: '账户密码',
      description: '其他用户的消息将以站内信的形式通知',
      action: <Switch defaultChecked />,
    },
    {
      title: '系统消息',
      description: '系统消息将以站内信的形式通知',
      action: <Switch defaultChecked />,
    },
    {
      title: '待办任务',
      description: '待办任务将以站内信的形式通知',
      action: <Switch defaultChecked />,
    },
  ]

  return (
    <List
      itemLayout="horizontal"
      dataSource={data}
      renderItem={(item) => (
        <List.Item actions={[item.action]}>
          <List.Item.Meta title={item.title} description={item.description} />
        </List.Item>
      )}
    />
  )
}

export default function AccountSettings() {
  const [activeTab, setActiveTab] = useState('basic')

  const items = [
    {
      key: 'basic',
      label: '基本设置',
      children: <BasicSettings />,
    },
    {
      key: 'security',
      label: '安全设置',
      children: <SecuritySettings />,
    },
    {
      key: 'notification',
      label: '新消息通知',
      children: <NotificationSettings />,
    },
  ]

  return (
    <Card title="账号设置">
      <Tabs activeKey={activeTab} onChange={setActiveTab} items={items} tabPosition="left" />
    </Card>
  )
}
