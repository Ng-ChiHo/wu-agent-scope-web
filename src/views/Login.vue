<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { apiLogin, apiRegister } from '@/utils/auth'

const router = useRouter()
const isLoginMode = ref(true)
const username = ref('')
const password = ref('')
const nickname = ref('')
const loading = ref(false)
const statusMsg = ref('')
const statusType = ref('success')

function showStatus(msg, type = 'success') {
  statusMsg.value = msg
  statusType.value = type
  setTimeout(() => { statusMsg.value = '' }, 3000)
}

async function handleSubmit() {
  if (!username.value || !password.value) {
    showStatus('请输入用户名和密码', 'error')
    return
  }
  loading.value = true
  try {
    if (isLoginMode.value) {
      const res = await apiLogin(username.value, password.value)
      if (res.code === 0) {
        showStatus('登录成功，正在跳转...')
        setTimeout(() => router.push('/chat'), 800)
      } else {
        showStatus(res.message || '登录失败', 'error')
      }
    } else {
      const res = await apiRegister(username.value, password.value, nickname.value || username.value)
      if (res.code === 0) {
        showStatus('注册成功，请登录')
        isLoginMode.value = true
      } else {
        showStatus(res.message || '注册失败', 'error')
      }
    }
  } catch (e) {
    showStatus(e.message || '请求失败', 'error')
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  // no-op
})
</script>

<template>
  <div class="login-container">
    <!-- Left brand panel -->
    <div class="brand-panel">
      <div class="brand-bg">
        <div class="brand-blob blob-1"></div>
        <div class="brand-blob blob-2"></div>
        <div class="brand-grid"></div>
      </div>
      <div class="brand-content">
        <div class="brand-logo">
          <span class="logo-text">WU·<span class="logo-accent">AGENT</span></span>
        </div>
        <h1 class="brand-headline">多模型 AI 智能体<br>对话平台</h1>
        <p class="brand-desc">
          支持多种 LLM 模型切换、视觉理解、工具调用与实时流式输出。
          从对话到行动，让 AI 成为你的智能伙伴。
        </p>
        <div class="brand-features">
          <div class="brand-feature">
            <div class="bf-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="20" height="20">
                <path d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z" />
              </svg>
            </div>
            <div>
              <span class="bf-title">实时流式输出</span>
              <span class="bf-desc">SSE 逐字响应，低延迟体验</span>
            </div>
          </div>
          <div class="brand-feature">
            <div class="bf-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="20" height="20">
                <path d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                <path d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
              </svg>
            </div>
            <div>
              <span class="bf-title">视觉理解</span>
              <span class="bf-desc">图片上传粘贴，多模态交互</span>
            </div>
          </div>
          <div class="brand-feature">
            <div class="bf-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="20" height="20">
                <path d="M11.42 15.17 17.25 21A2.652 2.652 0 0 0 21 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 1 1-3.586-3.586l5.653-4.655" />
              </svg>
            </div>
            <div>
              <span class="bf-title">工具调用</span>
              <span class="bf-desc">自主调用外部工具与 Skills</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Right form panel -->
    <div class="form-panel">
      <div class="form-wrapper">
        <div class="form-header">
          <h1 class="form-title">WU·AGENT</h1>
          <p class="form-subtitle">{{ isLoginMode ? '欢迎回来' : '创建账号' }}</p>
        </div>

        <div class="tab-switch">
          <button :class="['tab-btn', { active: isLoginMode }]" @click="isLoginMode = true">
            登录
          </button>
          <button :class="['tab-btn', { active: !isLoginMode }]" @click="isLoginMode = false">
            注册
          </button>
        </div>

        <form @submit.prevent="handleSubmit" class="login-form">
          <div class="input-group">
            <label class="input-label">用户名</label>
            <div class="input-wrapper">
              <svg class="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              <input v-model="username" type="text" placeholder="请输入用户名" autocomplete="username" />
            </div>
          </div>

          <div class="input-group">
            <label class="input-label">密码</label>
            <div class="input-wrapper">
              <svg class="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <input v-model="password" type="password" placeholder="请输入密码" autocomplete="current-password" />
            </div>
          </div>

          <div v-if="!isLoginMode" class="input-group">
            <label class="input-label">昵称 <span class="optional">可选</span></label>
            <div class="input-wrapper">
              <svg class="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 2a3 3 0 0 0-3 3v1a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
                <path d="M19 21v-1a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v1" />
              </svg>
              <input v-model="nickname" type="text" placeholder="请输入昵称" />
            </div>
          </div>

          <button type="submit" class="submit-btn" :disabled="loading">
            <span v-if="loading" class="spinner"></span>
            <span v-else>{{ isLoginMode ? '登录' : '注册' }}</span>
          </button>
        </form>

        <div v-if="statusMsg" :class="['status-msg', statusType]">
          {{ statusMsg }}
        </div>

        <div class="demo-info">
          <span class="demo-label">DEMO</span>
          <span class="demo-creds">体验账号 demo / 654321</span>
        </div>
      </div>

      <footer class="form-footer">&copy; 2026 WU·AGENT</footer>
    </div>
  </div>
</template>

<style scoped>
.login-container {
  display: flex;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
}

/* Left brand panel */
.brand-panel {
  flex: 1;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 64px;
  overflow: hidden;
  background: linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4338ca 100%);
}

.brand-bg {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.brand-blob {
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
}

.blob-1 {
  width: 400px;
  height: 400px;
  background: rgba(124, 58, 237, 0.3);
  top: -100px;
  right: -100px;
}

.blob-2 {
  width: 300px;
  height: 300px;
  background: rgba(16, 185, 129, 0.15);
  bottom: -50px;
  left: -50px;
}

.brand-grid {
  position: absolute;
  inset: 0;
  background-image: radial-gradient(circle, rgba(255, 255, 255, 0.06) 1px, transparent 1px);
  background-size: 24px 24px;
}

.brand-content {
  position: relative;
  z-index: 1;
  max-width: 480px;
}

.brand-logo {
  margin-bottom: 32px;
}

.logo-text {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 1.2rem;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.9);
  letter-spacing: 4px;
}

.logo-accent {
  color: #a5b4fc;
}

.brand-headline {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 2.2rem;
  font-weight: 700;
  color: #ffffff;
  line-height: 1.3;
  margin-bottom: 16px;
}

.brand-desc {
  font-size: 0.95rem;
  color: rgba(255, 255, 255, 0.6);
  line-height: 1.7;
  margin-bottom: 40px;
}

.brand-features {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.brand-feature {
  display: flex;
  align-items: flex-start;
  gap: 14px;
}

.bf-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.15);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #a5b4fc;
  flex-shrink: 0;
}

.bf-title {
  display: block;
  font-size: 0.9rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
  margin-bottom: 2px;
}

.bf-desc {
  display: block;
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.45);
}

/* Right form panel */
.form-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px;
  background: #f8f9fc;
  position: relative;
}

.form-wrapper {
  width: 100%;
  max-width: 400px;
}

.form-header {
  margin-bottom: 32px;
}

.form-title {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 1.5rem;
  font-weight: 700;
  color: #1e1b4b;
  letter-spacing: 3px;
  margin-bottom: 8px;
}

.form-subtitle {
  font-size: 0.95rem;
  color: #6b7280;
}

.tab-switch {
  display: flex;
  background: #f3f4f6;
  border-radius: 10px;
  padding: 4px;
  margin-bottom: 28px;
}

.tab-btn {
  flex: 1;
  padding: 10px;
  border: none;
  background: transparent;
  color: #6b7280;
  font-size: 0.9rem;
  cursor: pointer;
  border-radius: 8px;
  transition: all 0.2s;
  font-weight: 600;
  font-family: 'Inter', sans-serif;
}

.tab-btn.active {
  background: #ffffff;
  color: #4338ca;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.input-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.input-label {
  font-size: 0.8rem;
  font-weight: 600;
  color: #374151;
  font-family: 'Inter', sans-serif;
}

.input-label .optional {
  font-weight: 400;
  color: #9ca3af;
  font-size: 0.75rem;
}

.input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.input-icon {
  position: absolute;
  left: 14px;
  width: 18px;
  height: 18px;
  color: #9ca3af;
  pointer-events: none;
  z-index: 1;
}

.input-wrapper input {
  width: 100%;
  padding: 12px 14px 12px 44px;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  color: #1e1b4b;
  font-size: 0.95rem;
  outline: none;
  transition: all 0.2s;
  font-family: 'Inter', sans-serif;
}

.input-wrapper input::placeholder {
  color: #9ca3af;
}

.input-wrapper input:focus {
  border-color: #4338ca;
  box-shadow: 0 0 0 3px rgba(67, 56, 202, 0.1);
}

.submit-btn {
  width: 100%;
  padding: 14px;
  border: none;
  border-radius: 10px;
  background: #4338ca;
  color: #ffffff;
  font-size: 0.95rem;
  font-weight: 600;
  font-family: 'Inter', sans-serif;
  cursor: pointer;
  transition: all 0.2s;
  margin-top: 4px;
}

.submit-btn:hover:not(:disabled) {
  background: #3730a3;
  transform: translateY(-1px);
  box-shadow: 0 4px 16px rgba(67, 56, 202, 0.3);
}

.submit-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.spinner {
  display: inline-block;
  width: 20px;
  height: 20px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: #ffffff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.status-msg {
  margin-top: 16px;
  padding: 10px 16px;
  border-radius: 10px;
  font-size: 0.85rem;
  text-align: center;
  animation: fadeIn 0.3s;
}

.status-msg.success {
  background: #ecfdf5;
  color: #059669;
  border: 1px solid #a7f3d0;
}

.status-msg.error {
  background: #fef2f2;
  color: #dc2626;
  border: 1px solid #fecaca;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-5px); }
  to { opacity: 1; transform: translateY(0); }
}

.demo-info {
  margin-top: 24px;
  text-align: center;
  font-size: 0.8rem;
  color: #9ca3af;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
}

.demo-label {
  display: inline-block;
  padding: 2px 10px;
  background: #f5f3ff;
  color: #7c3aed;
  border: 1px solid #e9d5ff;
  border-radius: 6px;
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 1px;
  font-family: 'Space Grotesk', sans-serif;
}

.demo-creds {
  color: #6b7280;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.8rem;
}

.form-footer {
  position: absolute;
  bottom: 24px;
  text-align: center;
  font-size: 0.75rem;
  color: #9ca3af;
  letter-spacing: 1px;
}

/* Mobile responsive */
@media (max-width: 900px) {
  .login-container {
    flex-direction: column;
  }

  .brand-panel {
    flex: none;
    padding: 40px 24px;
    min-height: auto;
  }

  .brand-headline {
    font-size: 1.6rem;
  }

  .brand-desc {
    margin-bottom: 24px;
  }

  .brand-features {
    display: none;
  }

  .form-panel {
    flex: 1;
    padding: 32px 24px;
  }

  .form-footer {
    position: static;
    margin-top: 24px;
  }
}
</style>
