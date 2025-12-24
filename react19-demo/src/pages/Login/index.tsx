import { useLocation, useNavigate } from 'react-router-dom'
import { message } from 'antd'
import { GlobalOutlined, LockOutlined, SafetyOutlined, UserOutlined } from '@ant-design/icons'
import { ProForm, ProFormText } from '@ant-design/pro-components'
import { login } from '@/services'
import { useUserStore } from '@/store/user'

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/'
  const setUserInfo = useUserStore((state) => state.setUserInfo)

  const onFinish = async (values: any) => {
    try {
      const response = await login(values)

      // 存入 Zustand
      setUserInfo(response)

      message.success('登录成功')
      navigate(from, { replace: true })
    } catch (error) {
      console.error(error)
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      }}
    >
      <div
        style={{
          width: 450,
          padding: '40px 50px',
          background: 'white',
          borderRadius: 8,
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        }}
      >
        <h1 style={{ textAlign: 'center', marginBottom: 32, fontSize: 24 }}>SaaS Admin</h1>

        <ProForm
          onFinish={onFinish}
          submitter={{
            searchConfig: { submitText: '登录' },
            render: (_, dom) => dom.pop(),
            submitButtonProps: { size: 'large', style: { width: '100%' } },
          }}
          initialValues={{ username: 'admin', password: 'AA2877333sd@!', code: '1' }}
        >
          <ProFormText
            name="username"
            fieldProps={{ size: 'large', prefix: <UserOutlined /> }}
            placeholder="请输入用户名"
            rules={[{ required: true, message: '请输入用户名' }]}
          />
          <ProFormText.Password
            name="password"
            fieldProps={{ size: 'large', prefix: <LockOutlined /> }}
            placeholder="请输入密码"
            rules={[{ required: true, message: '请输入密码' }]}
          />
          <ProFormText
            name="code"
            fieldProps={{ size: 'large', prefix: <SafetyOutlined /> }}
            placeholder="请输入google验证码"
            rules={[{ required: true, message: '请输入google验证码' }]}
          />
          <ProFormText
            name="siteCode"
            fieldProps={{ size: 'large', prefix: <GlobalOutlined /> }}
            placeholder="请输入站点code（选填）"
          />
        </ProForm>
      </div>
    </div>
  )
}
