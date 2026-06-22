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

// Digital rain background
const chars = '01アイウエオカキクケコ∞∑∏√∫≈≠≤≥{}[]<>/\\|'.split('')
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
  ctx.fillStyle = 'rgba(6, 10, 22, 0.3)'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.font = `${fontSize}px 'Courier New', monospace`

  const colors = ['#1a5c1a', '#2d8c2d', '#39ff14', '#0d3d0d', '#4dcc4d']

  for (let i = 0; i < drops.length; i++) {
    const char = chars[Math.floor(Math.random() * chars.length)]
    const color = colors[Math.floor(Math.random() * colors.length)]
    ctx.fillStyle = color
    ctx.globalAlpha = 0.2 + Math.random() * 0.3
    ctx.fillText(char, columns[i], drops[i] * fontSize)
    ctx.globalAlpha = 1

    if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) {
      drops[i] = 0
    }
    drops[i] += 0.4 + Math.random() * 0.6
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
    <div class="scanline"></div>

    <div class="login-card">
      <div class="card-border"></div>
      <div class="glitch-wrapper">
        <h1 class="glitch-title" data-text="WU·AGENT">WU·AGENT</h1>
      </div>
      <p class="subtitle">NEURAL CHAT INTERFACE</p>

      <div class="tab-switch">
        <button :class="['tab-btn', { active: isLoginMode }]" @click="isLoginMode = true">
          <span class="btn-bracket">[</span> 登录 <span class="btn-bracket">]</span>
        </button>
        <button :class="['tab-btn', { active: !isLoginMode }]" @click="isLoginMode = false">
          <span class="btn-bracket">[</span> 注册 <span class="btn-bracket">]</span>
        </button>
      </div>

      <form @submit.prevent="handleSubmit" class="login-form">
        <div class="input-group">
          <svg class="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
          <input v-model="username" type="text" placeholder="用户名" autocomplete="username" />
          <span class="input-line"></span>
        </div>

        <div class="input-group">
          <svg class="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <input v-model="password" type="password" placeholder="密码" autocomplete="current-password" />
          <span class="input-line"></span>
        </div>

        <div v-if="!isLoginMode" class="input-group">
          <svg class="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 2a3 3 0 0 0-3 3v1a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
            <path d="M19 21v-1a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v1" />
          </svg>
          <input v-model="nickname" type="text" placeholder="昵称（可选）" />
          <span class="input-line"></span>
        </div>

        <button type="submit" class="submit-btn" :disabled="loading">
          <span v-if="loading" class="spinner"></span>
          <span v-else class="btn-text">
            <span class="btn-bracket">&gt;</span>
            {{ isLoginMode ? 'AUTHENTICATE' : 'REGISTER' }}
            <span class="btn-bracket">&lt;</span>
          </span>
        </button>
      </form>

      <div v-if="statusMsg" :class="['status-msg', statusType]">
        <span class="status-icon">{{ statusType === 'success' ? '&#9670;' : '&#9670;' }}</span>
        {{ statusMsg }}
      </div>

      <div class="demo-info">
        <span class="demo-label">DEMO体验账号或自行注册</span>
        <span class="demo-creds">demo/654321</span>
      </div>
    </div>

    <footer class="footer">&copy; 2026 AGENT SCOPE // NEURAL INTERFACE v2.0</footer>
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
  background: #060a16;
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

.scanline {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: repeating-linear-gradient(
    0deg,
    transparent,
    transparent 2px,
    rgba(57, 255, 20, 0.008) 2px,
    rgba(57, 255, 20, 0.008) 4px
  );
  pointer-events: none;
  z-index: 1;
}

.spotlight {
  position: fixed;
  width: 400px;
  height: 400px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(57, 255, 20, 0.06) 0%, transparent 70%);
  transform: translate(-50%, -50%);
  pointer-events: none;
  z-index: 1;
  opacity: 0;
  transition: opacity 0.3s;
}

.login-card {
  position: relative;
  z-index: 2;
  width: 420px;
  padding: 44px;
  background: rgba(8, 14, 28, 0.9);
  border: 1px solid rgba(57, 255, 20, 0.12);
  border-radius: 4px;
  backdrop-filter: blur(20px);
  box-shadow:
    0 0 60px rgba(57, 255, 20, 0.04),
    inset 0 0 80px rgba(0, 0, 0, 0.4);
}

.card-border {
  position: absolute;
  inset: -1px;
  border-radius: 4px;
  background: linear-gradient(135deg, rgba(57, 255, 20, 0.2), transparent 40%, transparent 60%, rgba(255, 165, 0, 0.15));
  z-index: -1;
  mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  mask-composite: exclude;
  -webkit-mask-composite: xor;
  padding: 1px;
}

.glitch-wrapper {
  text-align: center;
  margin-bottom: 8px;
}

.glitch-title {
  font-family: 'Orbitron', sans-serif;
  font-size: 2rem;
  font-weight: 900;
  color: #39ff14;
  text-shadow:
    0 0 10px rgba(57, 255, 20, 0.6),
    0 0 30px rgba(57, 255, 20, 0.3),
    0 0 60px rgba(57, 255, 20, 0.1);
  position: relative;
  letter-spacing: 6px;
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
  color: #ffa500;
  z-index: -1;
  animation: glitch1 4s infinite;
}

.glitch-title::after {
  color: #00ff88;
  z-index: -2;
  animation: glitch2 4s infinite;
}

@keyframes glitch1 {
  0%, 88%, 100% { clip-path: inset(0 0 0 0); transform: translate(0); }
  90% { clip-path: inset(15% 0 45% 0); transform: translate(-4px, 2px); }
  92% { clip-path: inset(55% 0 15% 0); transform: translate(4px, -1px); }
  94% { clip-path: inset(25% 0 55% 0); transform: translate(-2px, 3px); }
}

@keyframes glitch2 {
  0%, 88%, 100% { clip-path: inset(0 0 0 0); transform: translate(0); }
  89% { clip-path: inset(45% 0 25% 0); transform: translate(3px, -3px); }
  91% { clip-path: inset(10% 0 65% 0); transform: translate(-4px, 2px); }
  93% { clip-path: inset(35% 0 35% 0); transform: translate(3px, 1px); }
}

.subtitle {
  text-align: center;
  font-family: 'Orbitron', sans-serif;
  font-size: 0.65rem;
  color: rgba(57, 255, 20, 0.35);
  letter-spacing: 8px;
  margin-bottom: 36px;
}

.tab-switch {
  display: flex;
  background: rgba(57, 255, 20, 0.03);
  border-radius: 2px;
  padding: 4px;
  margin-bottom: 28px;
  border: 1px solid rgba(57, 255, 20, 0.08);
}

.tab-btn {
  flex: 1;
  padding: 10px;
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.4);
  font-size: 0.85rem;
  cursor: pointer;
  border-radius: 2px;
  transition: all 0.3s;
  font-weight: 600;
  font-family: 'Courier New', monospace;
}

.tab-btn .btn-bracket {
  color: rgba(57, 255, 20, 0.3);
}

.tab-btn.active {
  background: rgba(57, 255, 20, 0.08);
  color: #39ff14;
  box-shadow: 0 0 15px rgba(57, 255, 20, 0.1);
}

.tab-btn.active .btn-bracket {
  color: #39ff14;
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 18px;
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
  color: rgba(57, 255, 20, 0.3);
  pointer-events: none;
  z-index: 1;
}

.input-group input {
  width: 100%;
  padding: 14px 14px 14px 44px;
  background: rgba(57, 255, 20, 0.02);
  border: 1px solid rgba(57, 255, 20, 0.1);
  border-radius: 2px;
  color: #e0ffe0;
  font-size: 0.95rem;
  outline: none;
  transition: all 0.3s;
  font-family: 'Courier New', monospace;
}

.input-group input::placeholder {
  color: rgba(57, 255, 20, 0.2);
}

.input-group input:focus {
  border-color: rgba(57, 255, 20, 0.5);
  box-shadow: 0 0 20px rgba(57, 255, 20, 0.08);
  background: rgba(57, 255, 20, 0.04);
}

.input-line {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 0;
  height: 1px;
  background: #39ff14;
  transition: width 0.3s;
}

.input-group input:focus ~ .input-line {
  width: 100%;
}

.submit-btn {
  width: 100%;
  padding: 14px;
  border: 1px solid rgba(57, 255, 20, 0.3);
  border-radius: 2px;
  background: rgba(57, 255, 20, 0.08);
  color: #39ff14;
  font-size: 0.95rem;
  font-weight: 700;
  font-family: 'Orbitron', sans-serif;
  letter-spacing: 4px;
  cursor: pointer;
  transition: all 0.3s;
  margin-top: 8px;
  position: relative;
  overflow: hidden;
}

.submit-btn::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(57, 255, 20, 0.1), transparent);
  transition: left 0.5s;
}

.submit-btn:hover:not(:disabled)::before {
  left: 100%;
}

.submit-btn:hover:not(:disabled) {
  box-shadow: 0 0 30px rgba(57, 255, 20, 0.2);
  border-color: rgba(57, 255, 20, 0.6);
  transform: translateY(-1px);
}

.submit-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-text {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.btn-bracket {
  color: rgba(57, 255, 20, 0.5);
  font-weight: 400;
}

.spinner {
  display: inline-block;
  width: 20px;
  height: 20px;
  border: 2px solid rgba(57, 255, 20, 0.2);
  border-top-color: #39ff14;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.status-msg {
  margin-top: 16px;
  padding: 10px 16px;
  border-radius: 2px;
  font-size: 0.85rem;
  text-align: center;
  animation: fadeIn 0.3s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.status-msg.success {
  background: rgba(57, 255, 20, 0.06);
  color: #39ff14;
  border: 1px solid rgba(57, 255, 20, 0.15);
}

.status-msg.error {
  background: rgba(255, 80, 80, 0.06);
  color: #ff5050;
  border: 1px solid rgba(255, 80, 80, 0.15);
}

.status-icon {
  font-size: 0.7rem;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-5px); }
  to { opacity: 1; transform: translateY(0); }
}

.demo-info {
  margin-top: 24px;
  text-align: center;
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.25);
  font-family: 'Courier New', monospace;
}

.demo-label {
  display: inline-block;
  padding: 2px 10px;
  background: rgba(255, 165, 0, 0.1);
  color: #ffa500;
  border: 1px solid rgba(255, 165, 0, 0.2);
  border-radius: 2px;
  font-size: 0.65rem;
  font-weight: 700;
  margin-right: 10px;
  letter-spacing: 2px;
}

.demo-creds {
  color: rgba(255, 255, 255, 0.4);
}

.footer {
  position: fixed;
  bottom: 16px;
  left: 0;
  width: 100%;
  text-align: center;
  font-size: 0.65rem;
  color: rgba(57, 255, 20, 0.15);
  letter-spacing: 3px;
  z-index: 2;
  font-family: 'Courier New', monospace;
}
</style>
