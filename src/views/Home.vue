<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { isLoggedIn } from '@/utils/auth'

const router = useRouter()

// Digital rain
const chars = '01アイウエオカキクケコ∞∑∏√∫≈≠≤≥{}[]<>/\\|'.split('')
const fontSize = 14
let canvas, ctx, animFrameId
let columns = []
let drops = []

// Terminal boot log
const bootLines = [
  { text: '> INITIALIZING WU·AGENT INTERFACE v2.0...', delay: 0, color: 'green' },
  { text: '> Loading model: qwen3:14b [OK]', delay: 600, color: 'green' },
  { text: '> Loading model: deepseek-r1:14b [OK]', delay: 1200, color: 'green' },
  { text: '> Vision module: ACTIVE', delay: 1800, color: 'amber' },
  { text: '> SSE stream connected: wss://agent.xpeak.top', delay: 2400, color: 'green' },
  { text: '> Tool execution engine: READY', delay: 3000, color: 'green' },
  { text: '> Markdown renderer: HIGHLIGHT.JS + DOMPURIFY', delay: 3600, color: 'dim' },
  { text: '> ECharts visualization: LOADED', delay: 4200, color: 'dim' },
  { text: '> ─────────────────────────────────────', delay: 4800, color: 'dim' },
  { text: '> SYSTEM READY. AWAITING INPUT.', delay: 5400, color: 'amber' },
]
const visibleLines = ref([])
let bootTimer = null

// Features
const features = [
  {
    id: '01',
    title: '多模型协同',
    subtitle: 'MULTI-MODEL ORCHESTRATION',
    desc: '自由切换 Qwen、DeepSeek 等多种大语言模型。每个模型各有所长 —— 推理、视觉、代码、分析，按需调度，精准匹配任务场景。',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9.75 3.104v5.714a2.25 2.25 0 0 1-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 0 1 4.5 0m0 0v5.714a2.25 2.25 0 0 0 .659 1.591L19 14.5m-4.75-11.396c.251.023.501.05.75.082M12 21a8.966 8.966 0 0 0 5.982-2.275M12 21a8.966 8.966 0 0 1-5.982-2.275M15.75 3.104a24.297 24.297 0 0 1 3.248.18M8.25 3.104a24.297 24.297 0 0 0-3.248.18" /></svg>`,
  },
  {
    id: '02',
    title: '视觉理解',
    subtitle: 'VISION PERCEPTION',
    desc: '支持图片上传与粘贴，模型可直接解析视觉内容。截图分析、图表解读、设计评审 —— 对话不再局限于纯文本。',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" /><path d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /></svg>`,
  },
  {
    id: '03',
    title: '实时流式输出',
    subtitle: 'REAL-TIME SSE STREAMING',
    desc: '基于 Server-Sent Events 的流式架构，逐字输出 AI 响应。支持 GET/POST 双模式 SSE，多模态消息实时传输，延迟降低。',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z" /></svg>`,
  },
  {
    id: '04',
    title: '工具调用链',
    subtitle: 'TOOL USE CHAIN',
    desc: '模型可自主调用外部工具，渐进式加载多种 Skills 并执行多步推理。从数据查询到图表可视化，AI 不再只是对话 —— 它是能行动的智能体。',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M11.42 15.17 17.25 21A2.652 2.652 0 0 0 21 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 1 1-3.586-3.586l5.653-4.655m5.914-3.09A6.717 6.717 0 0 1 18 9c.338 0 .672.017 1 .05M5.12 9.35A6.717 6.717 0 0 0 6 9c.338 0 .672.017 1 .05" /></svg>`,
  },
  {
    id: '05',
    title: '调用日志追踪',
    subtitle: 'DISTRIBUTED TRACING',
    desc: '集成 Jaeger 分布式追踪框架，完整记录每次模型调用链路。从请求发起到工具执行再到最终响应，全链路 Span 可视化，帮助定位性能瓶颈与异常节点。',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M7.5 14.25v2.25m3-4.5v4.5m3-6.75v6.75m3-9v9M6 20.25h12A2.25 2.25 0 0 0 20.25 18V6A2.25 2.25 0 0 0 18 3.75H6A2.25 2.25 0 0 0 3.75 6v12A2.25 2.25 0 0 0 6 20.25Z" /></svg>`,
  },
  {
    id: '06',
    title: '模型可观测性',
    subtitle: 'MODEL OBSERVABILITY',
    desc: '基于 Metabase 构建多维度数据看板，实时统计模型调用量、响应延迟、Token 消耗与工具调用分布。按模型、用户、时段等多维交叉分析，让每一次推理都有据可查。',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0 1 18 16.5h-2.25m-7.5 0h7.5m-7.5 0-1 3m8.5-3 1 3m0 0 .5 1.5m-.5-1.5h-9.5m0 0-.5 1.5m.75-9 3-3 2.148 2.148A12.061 12.061 0 0 1 16.5 7.605" /></svg>`,
  },
]

// Scroll state
const scrolled = ref(false)
const heroVisible = ref(true)

function handleScroll() {
  scrolled.value = window.scrollY > 50
  heroVisible.value = window.scrollY < window.innerHeight * 0.6
}

// Matrix rain
function initMatrix() {
  canvas = document.getElementById('matrix-canvas-home')
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
  ctx.fillStyle = 'rgba(6, 10, 22, 0.07)'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.font = `${fontSize}px 'Courier New', monospace`
  const colors = ['#1a5c1a', '#2d8c2d', '#39ff14', '#0d3d0d', '#4dcc4d']
  for (let i = 0; i < drops.length; i++) {
    const char = chars[Math.floor(Math.random() * chars.length)]
    const color = colors[Math.floor(Math.random() * colors.length)]
    ctx.fillStyle = color
    ctx.globalAlpha = 0.15 + Math.random() * 0.2
    ctx.fillText(char, columns[i], drops[i] * fontSize)
    ctx.globalAlpha = 1
    if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) {
      drops[i] = 0
    }
    drops[i] += 0.4 + Math.random() * 0.6
  }
  animFrameId = requestAnimationFrame(animate)
}

function enterSystem() {
  if (isLoggedIn()) {
    router.push('/chat')
  } else {
    router.push('/login')
  }
}

onMounted(() => {
  window.addEventListener('scroll', handleScroll)
  initMatrix()

  // Boot sequence
  bootLines.forEach((line, i) => {
    setTimeout(() => {
      visibleLines.value.push(line)
    }, line.delay)
  })
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', handleScroll)
  if (animFrameId) cancelAnimationFrame(animFrameId)
  window.removeEventListener('resize', resizeCanvas)
  if (bootTimer) clearTimeout(bootTimer)
})
</script>

<template>
  <div class="home-container">
    <canvas id="matrix-canvas-home"></canvas>
    <div class="scanline"></div>

    <!-- Fixed nav bar -->
    <nav :class="['nav', { scrolled }]">
      <div class="nav-inner">
        <span class="nav-logo">WU·<span class="nav-logo-dot">AGENT</span></span>
        <button class="nav-cta" @click="enterSystem">
          <span class="btn-bracket">[</span> 进入系统 <span class="btn-bracket">]</span>
        </button>
      </div>
    </nav>

    <!-- Hero Section -->
    <section class="hero">
      <div class="hero-content">
        <div class="hero-tag">
          <span class="tag-dot"></span>
          NEURAL INTERFACE v2.0
        </div>

        <h1 class="glitch-title" data-text="WU·AGENT">WU·AGENT</h1>

        <p class="hero-subtitle">
          多模型 AI 智能体客户端<br>
          <span class="hero-subtitle-dim">支持模型切换 · 视觉理解 · 工具调用 · 实时流式输出 · 数据可视化</span>
        </p>

        <!-- Terminal boot window -->
        <div class="terminal-window">
          <div class="terminal-header">
            <div class="terminal-dots">
              <span class="dot dot-red"></span>
              <span class="dot dot-yellow"></span>
              <span class="dot dot-green"></span>
            </div>
            <span class="terminal-title">system.boot</span>
          </div>
          <div class="terminal-body">
            <div
              v-for="(line, i) in visibleLines"
              :key="i"
              :class="['boot-line', `color-${line.color}`]"
            >
              {{ line.text }}
            </div>
            <span class="cursor" v-if="visibleLines.length < bootLines.length">█</span>
            <span class="cursor blink" v-else>█</span>
          </div>
        </div>

        <button class="hero-cta" @click="enterSystem">
          <span class="cta-bracket">&gt;</span>
          进入 WU·AGENT
          <span class="cta-bracket">&lt;</span>
        </button>
      </div>

      <div class="scroll-hint">
        <span class="scroll-line"></span>
        <span class="scroll-text">SCROLL</span>
      </div>
    </section>

    <!-- Features Section -->
    <section class="features">
      <div class="section-header">
        <span class="section-tag">CAPABILITIES</span>
        <h2 class="section-title">核心能力</h2>
        <div class="section-line"></div>
      </div>

      <div class="feature-grid">
        <div v-for="f in features" :key="f.id" class="feature-pane">
          <div class="pane-border"></div>
          <div class="pane-header">
            <span class="pane-id">{{ f.id }}</span>
            <span class="pane-subtitle">{{ f.subtitle }}</span>
          </div>
          <div class="pane-icon" v-html="f.icon"></div>
          <h3 class="pane-title">{{ f.title }}</h3>
          <p class="pane-desc">{{ f.desc }}</p>
        </div>
      </div>
    </section>

    <!-- Architecture Section -->
    <section class="architecture">
      <div class="section-header">
        <span class="section-tag">ARCHITECTURE</span>
        <h2 class="section-title">系统架构</h2>
        <div class="section-line"></div>
      </div>

      <div class="arch-diagram">
        <div class="arch-node arch-client">
          <span class="arch-label">CLIENT</span>
          <span class="arch-detail">Vue 3 SPA</span>
        </div>
        <div class="arch-arrow">
          <span class="arrow-line"></span>
          <span class="arrow-label">SSE / REST</span>
        </div>
        <div class="arch-node arch-api">
          <span class="arch-label">API GATEWAY</span>
          <span class="arch-detail">Spring Boot</span>
        </div>
        <div class="arch-arrow">
          <span class="arrow-line"></span>
          <span class="arrow-label">MODEL CALL</span>
        </div>
        <div class="arch-node arch-model">
          <span class="arch-label">AI MODELS</span>
          <span class="arch-detail">Qwen · DeepSeek · 更多</span>
        </div>
      </div>
    </section>

    <!-- CTA Section -->
    <section class="cta-section">
      <div class="cta-content">
        <p class="cta-label">// SYSTEM ACCESS</p>
        <h2 class="cta-title">准备好接入WU·AGENT了吗？</h2>
        <p class="cta-desc">使用体验账号 demo / 654321 快速体验，或注册你自己的账号。</p>
        <button class="hero-cta" @click="enterSystem">
          <span class="cta-bracket">&gt;</span>
          AUTHENTICATE
          <span class="cta-bracket">&lt;</span>
        </button>
      </div>
    </section>

    <footer class="footer">
      &copy; 2026 WU·AGENT // NEURAL INTERFACE v2.0
    </footer>
  </div>
</template>

<style scoped>
.home-container {
  position: relative;
  min-height: 100vh;
  background: #060a16;
  color: #e0ffe0;
  font-family: 'Courier New', monospace;
  overflow-x: hidden;
}

/* Canvas & Scanline */
#matrix-canvas-home {
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

/* Nav */
.nav {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  z-index: 100;
  padding: 16px 0;
  transition: all 0.3s;
  border-bottom: 1px solid transparent;
}

.nav.scrolled {
  background: rgba(6, 10, 22, 0.9);
  backdrop-filter: blur(20px);
  border-bottom: 1px solid rgba(57, 255, 20, 0.08);
}

.nav-inner {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 32px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.nav-logo {
  font-family: 'Orbitron', sans-serif;
  font-size: 1rem;
  font-weight: 700;
  color: #39ff14;
  letter-spacing: 4px;
  text-shadow: 0 0 10px rgba(57, 255, 20, 0.4);
}

.nav-logo-dot {
  color: rgba(57, 255, 20, 0.5);
}

.nav-cta {
  padding: 8px 20px;
  background: transparent;
  border: 1px solid rgba(57, 255, 20, 0.2);
  color: #39ff14;
  font-family: 'Courier New', monospace;
  font-size: 0.8rem;
  cursor: pointer;
  transition: all 0.3s;
  letter-spacing: 2px;
}

.nav-cta:hover {
  background: rgba(57, 255, 20, 0.08);
  border-color: rgba(57, 255, 20, 0.5);
  box-shadow: 0 0 20px rgba(57, 255, 20, 0.1);
}

.btn-bracket {
  color: rgba(57, 255, 20, 0.4);
}

/* Hero */
.hero {
  position: relative;
  z-index: 2;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 120px 32px 80px;
}

.hero-content {
  text-align: center;
  max-width: 720px;
}

.hero-tag {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 16px;
  border: 1px solid rgba(57, 255, 20, 0.15);
  font-size: 0.65rem;
  color: rgba(57, 255, 20, 0.5);
  letter-spacing: 4px;
  margin-bottom: 32px;
  font-family: 'Orbitron', sans-serif;
}

.tag-dot {
  width: 6px;
  height: 6px;
  background: #39ff14;
  border-radius: 50%;
  animation: pulse-dot 2s infinite;
}

@keyframes pulse-dot {
  0%, 100% { opacity: 1; box-shadow: 0 0 4px #39ff14; }
  50% { opacity: 0.4; box-shadow: 0 0 0px #39ff14; }
}

.glitch-title {
  font-family: 'Orbitron', sans-serif;
  font-size: clamp(2.5rem, 8vw, 5rem);
  font-weight: 900;
  color: #39ff14;
  text-shadow:
    0 0 20px rgba(57, 255, 20, 0.6),
    0 0 60px rgba(57, 255, 20, 0.3),
    0 0 100px rgba(57, 255, 20, 0.1);
  letter-spacing: 12px;
  margin-bottom: 24px;
  position: relative;
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

.hero-subtitle {
  font-size: 1.1rem;
  color: rgba(224, 255, 224, 0.7);
  line-height: 1.8;
  margin-bottom: 48px;
}

.hero-subtitle-dim {
  font-size: 0.85rem;
  color: rgba(57, 255, 20, 0.35);
  letter-spacing: 2px;
}

/* Terminal Window */
.terminal-window {
  background: rgba(8, 14, 28, 0.95);
  border: 1px solid rgba(57, 255, 20, 0.12);
  border-radius: 4px;
  text-align: left;
  margin-bottom: 48px;
  overflow: hidden;
  box-shadow:
    0 0 40px rgba(57, 255, 20, 0.03),
    inset 0 0 60px rgba(0, 0, 0, 0.3);
}

.terminal-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  background: rgba(57, 255, 20, 0.03);
  border-bottom: 1px solid rgba(57, 255, 20, 0.08);
}

.terminal-dots {
  display: flex;
  gap: 6px;
}

.dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.dot-red { background: #ff5f56; }
.dot-yellow { background: #ffbd2e; }
.dot-green { background: #27c93f; }

.terminal-title {
  font-size: 0.7rem;
  color: rgba(57, 255, 20, 0.3);
  letter-spacing: 2px;
}

.terminal-body {
  padding: 20px 24px;
  min-height: 240px;
  font-size: 0.82rem;
  line-height: 1.8;
}

.boot-line {
  animation: line-appear 0.3s ease-out;
}

@keyframes line-appear {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}

.color-green { color: #39ff14; }
.color-amber { color: #ffa500; }
.color-dim { color: rgba(57, 255, 20, 0.35); }

.cursor {
  color: #39ff14;
  font-size: 0.85rem;
}

.cursor.blink {
  animation: blink 1s step-end infinite;
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}

/* CTA Button */
.hero-cta {
  padding: 16px 48px;
  border: 1px solid rgba(255, 165, 0, 0.3);
  border-radius: 2px;
  background: rgba(255, 165, 0, 0.06);
  color: #ffa500;
  font-size: 1rem;
  font-weight: 700;
  font-family: 'Orbitron', sans-serif;
  letter-spacing: 4px;
  cursor: pointer;
  transition: all 0.3s;
  position: relative;
  overflow: hidden;
}

.hero-cta::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 165, 0, 0.1), transparent);
  transition: left 0.5s;
}

.hero-cta:hover {
  box-shadow: 0 0 40px rgba(255, 165, 0, 0.2);
  border-color: rgba(255, 165, 0, 0.6);
  transform: translateY(-2px);
}

.hero-cta:hover::before {
  left: 100%;
}

.cta-bracket {
  color: rgba(255, 165, 0, 0.5);
  font-weight: 400;
}

/* Scroll hint */
.scroll-hint {
  position: absolute;
  bottom: 40px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.scroll-line {
  width: 1px;
  height: 40px;
  background: linear-gradient(to bottom, rgba(57, 255, 20, 0.3), transparent);
  animation: scroll-pulse 2s infinite;
}

@keyframes scroll-pulse {
  0%, 100% { opacity: 1; transform: scaleY(1); }
  50% { opacity: 0.3; transform: scaleY(0.6); }
}

.scroll-text {
  font-size: 0.6rem;
  color: rgba(57, 255, 20, 0.2);
  letter-spacing: 4px;
}

/* Features Section */
.features {
  position: relative;
  z-index: 2;
  padding: 120px 32px;
  max-width: 1200px;
  margin: 0 auto;
}

.section-header {
  text-align: center;
  margin-bottom: 64px;
}

.section-tag {
  display: inline-block;
  padding: 4px 14px;
  border: 1px solid rgba(57, 255, 20, 0.12);
  font-size: 0.6rem;
  color: rgba(57, 255, 20, 0.4);
  letter-spacing: 4px;
  font-family: 'Orbitron', sans-serif;
  margin-bottom: 16px;
}

.section-title {
  font-family: 'Orbitron', sans-serif;
  font-size: 1.8rem;
  font-weight: 700;
  color: #39ff14;
  letter-spacing: 6px;
  text-shadow: 0 0 20px rgba(57, 255, 20, 0.3);
  margin-bottom: 16px;
}

.section-line {
  width: 60px;
  height: 1px;
  background: linear-gradient(90deg, transparent, #39ff14, transparent);
  margin: 0 auto;
}

.feature-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 24px;
}

.feature-pane {
  position: relative;
  padding: 36px;
  background: rgba(8, 14, 28, 0.7);
  border: 1px solid rgba(57, 255, 20, 0.08);
  border-radius: 2px;
  transition: all 0.4s;
  backdrop-filter: blur(10px);
}

.feature-pane:hover {
  border-color: rgba(57, 255, 20, 0.25);
  box-shadow: 0 0 40px rgba(57, 255, 20, 0.05);
  transform: translateY(-4px);
}

.pane-border {
  position: absolute;
  inset: -1px;
  border-radius: 2px;
  background: linear-gradient(135deg, rgba(57, 255, 20, 0.15), transparent 50%, transparent 80%, rgba(255, 165, 0, 0.08));
  z-index: -1;
  mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  mask-composite: exclude;
  -webkit-mask-composite: xor;
  padding: 1px;
  opacity: 0;
  transition: opacity 0.4s;
}

.feature-pane:hover .pane-border {
  opacity: 1;
}

.pane-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
}

.pane-id {
  font-family: 'Orbitron', sans-serif;
  font-size: 0.7rem;
  color: #ffa500;
  padding: 2px 8px;
  border: 1px solid rgba(255, 165, 0, 0.2);
  letter-spacing: 2px;
}

.pane-subtitle {
  font-size: 0.6rem;
  color: rgba(57, 255, 20, 0.25);
  letter-spacing: 3px;
}

.pane-icon {
  width: 40px;
  height: 40px;
  color: #39ff14;
  margin-bottom: 16px;
  opacity: 0.7;
}

.pane-icon :deep(svg) {
  width: 100%;
  height: 100%;
}

.pane-title {
  font-family: 'Orbitron', sans-serif;
  font-size: 1.1rem;
  font-weight: 700;
  color: #e0ffe0;
  letter-spacing: 2px;
  margin-bottom: 12px;
}

.pane-desc {
  font-size: 0.85rem;
  color: rgba(224, 255, 224, 0.5);
  line-height: 1.7;
}

/* Architecture Section */
.architecture {
  position: relative;
  z-index: 2;
  padding: 80px 32px 120px;
  max-width: 900px;
  margin: 0 auto;
}

.arch-diagram {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0;
  padding: 48px 0;
}

.arch-node {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 24px 32px;
  border: 1px solid rgba(57, 255, 20, 0.12);
  background: rgba(8, 14, 28, 0.8);
  border-radius: 2px;
  min-width: 140px;
  text-align: center;
  transition: all 0.3s;
}

.arch-node:hover {
  border-color: rgba(57, 255, 20, 0.3);
  box-shadow: 0 0 30px rgba(57, 255, 20, 0.06);
}

.arch-label {
  font-family: 'Orbitron', sans-serif;
  font-size: 0.7rem;
  color: #39ff14;
  letter-spacing: 3px;
}

.arch-detail {
  font-size: 0.7rem;
  color: rgba(57, 255, 20, 0.35);
}

.arch-arrow {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 0 16px;
}

.arrow-line {
  width: 60px;
  height: 1px;
  background: linear-gradient(90deg, rgba(57, 255, 20, 0.1), rgba(57, 255, 20, 0.3), rgba(57, 255, 20, 0.1));
  position: relative;
}

.arrow-line::after {
  content: '▸';
  position: absolute;
  right: -6px;
  top: -8px;
  color: rgba(57, 255, 20, 0.3);
  font-size: 0.8rem;
}

.arrow-label {
  font-size: 0.55rem;
  color: rgba(57, 255, 20, 0.2);
  letter-spacing: 2px;
  white-space: nowrap;
}

/* CTA Section */
.cta-section {
  position: relative;
  z-index: 2;
  padding: 100px 32px;
  text-align: center;
  border-top: 1px solid rgba(57, 255, 20, 0.06);
}

.cta-content {
  max-width: 600px;
  margin: 0 auto;
}

.cta-label {
  font-size: 0.65rem;
  color: rgba(57, 255, 20, 0.25);
  letter-spacing: 3px;
  margin-bottom: 16px;
}

.cta-title {
  font-family: 'Orbitron', sans-serif;
  font-size: 1.5rem;
  font-weight: 700;
  color: #e0ffe0;
  letter-spacing: 4px;
  margin-bottom: 16px;
}

.cta-desc {
  font-size: 0.85rem;
  color: rgba(224, 255, 224, 0.4);
  margin-bottom: 40px;
  line-height: 1.6;
}

/* Footer */
.footer {
  position: relative;
  z-index: 2;
  padding: 24px;
  text-align: center;
  font-size: 0.65rem;
  color: rgba(57, 255, 20, 0.12);
  letter-spacing: 3px;
  border-top: 1px solid rgba(57, 255, 20, 0.04);
}

/* Responsive */
@media (max-width: 1024px) {
  .feature-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 768px) {
  .feature-grid {
    grid-template-columns: 1fr;
  }

  .arch-diagram {
    flex-direction: column;
    gap: 8px;
  }

  .arrow-line {
    width: 1px;
    height: 40px;
    background: linear-gradient(to bottom, rgba(57, 255, 20, 0.1), rgba(57, 255, 20, 0.3), rgba(57, 255, 20, 0.1));
  }

  .arrow-line::after {
    content: '▾';
    right: -5px;
    top: auto;
    bottom: -8px;
  }

  .hero-subtitle {
    font-size: 0.95rem;
  }

  .glitch-title {
    letter-spacing: 6px;
  }

  .feature-pane {
    padding: 24px;
  }
}
</style>
