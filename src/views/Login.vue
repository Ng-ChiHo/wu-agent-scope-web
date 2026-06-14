<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
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

let canvas, ctx, animFrameId
let spotlightEl

// Matrix background
const chars = '01アイウエオカキクケコ∞∑∏√∫≈≠≤≥'.split('')
const fontSize = 14
let columns = []
let drops = []

function initMatrix() {
  canvas = document.getElementById('matrix-canvas')
  if (!canvas) return
  ctx = canvas.getContext('2d')
  resizeCanvas()
  window.addEventListener('resize', resizeCanvas)
  animate()
}

function resizeCanvas() {
  if (!canvas) return
  canvas.width = window.innerWidth
  canvas.height = window.innerHeight
  const colCount = Math.floor(canvas.width / fontSize)
  columns = []
  drops = []
  for (let i = 0; i < colCount; i++) {
    columns.push(Math.random() * canvas.width)
    drops.push(Math.random() * canvas.height / fontSize)
  }
}

function animate() {
  if (!ctx || !canvas) return
  ctx.fillStyle = 'rgba(5, 5, 8, 0.06)'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.font = `${fontSize}px 'Courier New', monospace`

  const colors = ['#00aaaa', '#00cc88', '#6644aa', '#44cc66', '#555588']

  for (let i = 0; i < drops.length; i++) {
    const char = chars[Math.floor(Math.random() * chars.length)]
    const color = colors[Math.floor(Math.random() * colors.length)]
    ctx.fillStyle = color
    ctx.globalAlpha = 0.3 + Math.random() * 0.3
    ctx.fillText(char, columns[i], drops[i] * fontSize)
    ctx.globalAlpha = 1

    if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) {
      drops[i] = 0
    }
    drops[i] += 0.5 + Math.random() * 0.5
  }
  animFrameId = requestAnimationFrame(animate)
}

function handleMouseMove(e) {
  if (spotlightEl) {
    spotlightEl.style.left = e.clientX + 'px'
    spotlightEl.style.top = e.clientY + 'px'
    spotlightEl.style.opacity = '1'
  }
}

function handleMouseLeave() {
  if (spotlightEl) {
    spotlightEl.style.opacity = '0'
  }
}

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
  spotlightEl = document.querySelector('.spotlight')
  document.addEventListener('mousemove', handleMouseMove)
  document.addEventListener('mouseleave', handleMouseLeave)
  initMatrix()
})

onBeforeUnmount(() => {
  document.removeEventListener('mousemove', handleMouseMove)
  document.removeEventListener('mouseleave', handleMouseLeave)
  if (animFrameId) cancelAnimationFrame(animFrameId)
  window.removeEventListener('resize', resizeCanvas)
})
</script>

<template>
  <div class="login-container">
    <canvas id="matrix-canvas"></canvas>
    <div class="spotlight"></div>

    <div class="login-card">
      <div class="glitch-wrapper">
        <h1 class="glitch-title" data-text="AGENT SCOPE">AGENT SCOPE</h1>
      </div>
      <p class="subtitle">AI CHAT PLATFORM</p>

      <div class="tab-switch">
        <button :class="['tab-btn', { active: isLoginMode }]" @click="isLoginMode = true">登录</button>
        <button :class="['tab-btn', { active: !isLoginMode }]" @click="isLoginMode = false">注册</button>
      </div>

      <form @submit.prevent="handleSubmit" class="login-form">
        <div class="input-group">
          <svg class="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
          <input v-model="username" type="text" placeholder="用户名" autocomplete="username" />
        </div>

        <div class="input-group">
          <svg class="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <input v-model="password" type="password" placeholder="密码" autocomplete="current-password" />
        </div>

        <div v-if="!isLoginMode" class="input-group">
          <svg class="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 2a3 3 0 0 0-3 3v1a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
            <path d="M19 21v-1a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v1" />
          </svg>
          <input v-model="nickname" type="text" placeholder="昵称（可选）" />
        </div>

        <button type="submit" class="submit-btn" :disabled="loading">
          <span v-if="loading" class="spinner"></span>
          <span v-else>{{ isLoginMode ? 'LOGIN' : 'REGISTER' }}</span>
        </button>
      </form>

      <div v-if="statusMsg" :class="['status-msg', statusType]">
        {{ statusMsg }}
      </div>

      <div class="demo-info">
        <span class="demo-label">DEMO体验账号：</span>
        <span>demo / 654321</span>
      </div>
    </div>

    <footer class="footer">© 2026 DEMO BY: 吴志浩</footer>
  </div>
</template>

<style scoped>
.login-container {
  position: relative;
  width: 100vw;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: #050508;
}

#matrix-canvas {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 0;
  pointer-events: none;
}

.spotlight {
  position: fixed;
  width: 340px;
  height: 340px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(0, 255, 255, 0.08) 0%, transparent 70%);
  transform: translate(-50%, -50%);
  pointer-events: none;
  z-index: 1;
  opacity: 0;
  transition: opacity 0.3s;
}

.login-card {
  position: relative;
  z-index: 2;
  width: 400px;
  padding: 40px;
  background: rgba(10, 10, 20, 0.85);
  border: 1px solid rgba(0, 255, 255, 0.15);
  border-radius: 16px;
  backdrop-filter: blur(20px);
  box-shadow:
    0 0 40px rgba(0, 255, 255, 0.05),
    inset 0 0 60px rgba(0, 0, 0, 0.3);
}

.glitch-wrapper {
  text-align: center;
  margin-bottom: 8px;
}

.glitch-title {
  font-family: 'Orbitron', sans-serif;
  font-size: 2.2rem;
  font-weight: 900;
  color: #00ffff;
  text-shadow:
    0 0 10px rgba(0, 255, 255, 0.5),
    0 0 20px rgba(0, 255, 255, 0.3),
    0 0 40px rgba(0, 255, 255, 0.15);
  position: relative;
  letter-spacing: 4px;
}

.glitch-title::before,
.glitch-title::after {
  content: attr(data-text);
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

.glitch-title::before {
  color: #ff00ff;
  z-index: -1;
  animation: glitch1 3s infinite;
}

.glitch-title::after {
  color: #ffff00;
  z-index: -2;
  animation: glitch2 3s infinite;
}

@keyframes glitch1 {
  0%, 90%, 100% { clip-path: inset(0 0 0 0); transform: translate(0); }
  92% { clip-path: inset(20% 0 40% 0); transform: translate(-3px, 1px); }
  94% { clip-path: inset(60% 0 10% 0); transform: translate(3px, -1px); }
  96% { clip-path: inset(30% 0 50% 0); transform: translate(-2px, 2px); }
}

@keyframes glitch2 {
  0%, 90%, 100% { clip-path: inset(0 0 0 0); transform: translate(0); }
  91% { clip-path: inset(50% 0 20% 0); transform: translate(2px, -2px); }
  93% { clip-path: inset(10% 0 70% 0); transform: translate(-3px, 1px); }
  95% { clip-path: inset(40% 0 30% 0); transform: translate(2px, 1px); }
}

.subtitle {
  text-align: center;
  font-family: 'Orbitron', sans-serif;
  font-size: 0.7rem;
  color: rgba(255, 255, 255, 0.4);
  letter-spacing: 6px;
  margin-bottom: 32px;
}

.tab-switch {
  display: flex;
  background: rgba(255, 255, 255, 0.04);
  border-radius: 8px;
  padding: 4px;
  margin-bottom: 28px;
  border: 1px solid rgba(255, 255, 255, 0.06);
}

.tab-btn {
  flex: 1;
  padding: 10px;
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.5);
  font-size: 0.9rem;
  cursor: pointer;
  border-radius: 6px;
  transition: all 0.3s;
  font-weight: 600;
}

.tab-btn.active {
  background: rgba(0, 255, 255, 0.12);
  color: #00ffff;
  box-shadow: 0 0 12px rgba(0, 255, 255, 0.15);
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.input-group {
  position: relative;
  display: flex;
  align-items: center;
}

.input-icon {
  position: absolute;
  left: 14px;
  width: 18px;
  height: 18px;
  color: rgba(255, 255, 255, 0.3);
  pointer-events: none;
  z-index: 1;
}

.input-group input {
  width: 100%;
  padding: 14px 14px 14px 44px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  color: #fff;
  font-size: 0.95rem;
  outline: none;
  transition: all 0.3s;
}

.input-group input::placeholder {
  color: rgba(255, 255, 255, 0.25);
}

.input-group input:focus {
  border-color: rgba(0, 255, 255, 0.5);
  box-shadow: 0 0 15px rgba(0, 255, 255, 0.1);
  background: rgba(0, 255, 255, 0.03);
}

.submit-btn {
  width: 100%;
  padding: 14px;
  border: none;
  border-radius: 10px;
  background: linear-gradient(135deg, #00cccc, #00aaff);
  color: #000;
  font-size: 1rem;
  font-weight: 700;
  font-family: 'Orbitron', sans-serif;
  letter-spacing: 3px;
  cursor: pointer;
  transition: all 0.3s;
  margin-top: 8px;
  position: relative;
  overflow: hidden;
}

.submit-btn:hover:not(:disabled) {
  box-shadow: 0 0 25px rgba(0, 255, 255, 0.3);
  transform: translateY(-1px);
}

.submit-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.spinner {
  display: inline-block;
  width: 20px;
  height: 20px;
  border: 2px solid rgba(0, 0, 0, 0.3);
  border-top-color: #000;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.status-msg {
  margin-top: 16px;
  padding: 10px 16px;
  border-radius: 8px;
  font-size: 0.85rem;
  text-align: center;
  animation: fadeIn 0.3s;
}

.status-msg.success {
  background: rgba(0, 255, 100, 0.08);
  color: #00ff64;
  border: 1px solid rgba(0, 255, 100, 0.15);
}

.status-msg.error {
  background: rgba(255, 100, 100, 0.08);
  color: #ff6b6b;
  border: 1px solid rgba(255, 100, 100, 0.15);
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-5px); }
  to { opacity: 1; transform: translateY(0); }
}

.demo-info {
  margin-top: 20px;
  text-align: center;
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.35);
}

.demo-label {
  display: inline-block;
  padding: 2px 8px;
  background: rgba(0, 255, 100, 0.1);
  color: #00ff64;
  border-radius: 4px;
  font-size: 0.7rem;
  font-weight: 700;
  margin-right: 8px;
  letter-spacing: 1px;
}

.footer {
  position: fixed;
  bottom: 16px;
  left: 0;
  width: 100%;
  text-align: center;
  font-size: 0.7rem;
  color: rgba(255, 255, 255, 0.15);
  letter-spacing: 2px;
  z-index: 2;
}
</style>
