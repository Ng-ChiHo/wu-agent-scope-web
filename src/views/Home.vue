<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { isLoggedIn } from '@/utils/auth'

const router = useRouter()

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
  {
    id: 'SOON',
    title: '即将推出',
    subtitle: 'COMING SOON',
    desc: 'RAG 知识库检索增强 · Long-Term Memory 长期记忆 · 多 Agent 协作 · TTS 语音识别模型 —— 下一代智能体能力正在路上...',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" /></svg>`,
    coming: true,
  },
]

// Scroll state
const scrolled = ref(false)
const heroVisible = ref(true)

function handleScroll() {
  scrolled.value = window.scrollY > 50
  heroVisible.value = window.scrollY < window.innerHeight * 0.6
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

  // Boot sequence
  bootLines.forEach((line) => {
    setTimeout(() => {
      visibleLines.value.push(line)
    }, line.delay)
  })
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', handleScroll)
  if (bootTimer) clearTimeout(bootTimer)
})
</script>

<template>
  <div class="home-container">
    <!-- Fixed nav bar -->
    <nav :class="['nav', { scrolled }]">
      <div class="nav-inner">
        <span class="nav-logo">WU·<span class="nav-logo-accent">AGENT</span></span>
        <button class="nav-cta" @click="enterSystem">进入系统</button>
      </div>
    </nav>

    <!-- Hero Section -->
    <section class="hero">
      <!-- Background decoration -->
      <div class="hero-bg">
        <div class="mesh-blob mesh-1"></div>
        <div class="mesh-blob mesh-2"></div>
        <div class="mesh-blob mesh-3"></div>
        <div class="dot-grid"></div>
      </div>

      <div class="hero-layout">
        <div class="hero-left">
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
        </div>

        <div class="hero-right">
          <div class="hero-tag">
            <span class="tag-dot"></span>
            AI AGENT PLATFORM v2.0
          </div>

          <h1 class="hero-title">WU·<span class="title-accent">AGENT</span></h1>

          <p class="hero-subtitle">
            多模型 AI 智能体客户端
          </p>
          <p class="hero-desc">
            支持模型切换 · 视觉理解 · 工具调用 · 数据可视化 · 日志追踪
          </p>

          <div class="hero-actions">
            <button class="hero-cta primary" @click="enterSystem">
              进入 WU·AGENT
            </button>
            <a href="#features" class="hero-cta secondary">
              了解更多 ↓
            </a>
          </div>

          <div class="hero-stats">
            <div class="stat">
              <span class="stat-value">5+</span>
              <span class="stat-label">AI 模型</span>
            </div>
            <div class="stat-divider"></div>
            <div class="stat">
              <span class="stat-value">Router</span>
              <span class="stat-label">Agent 智能路由</span>
            </div>
            <div class="stat-divider"></div>
            <div class="stat">
              <span class="stat-value">Harness</span>
              <span class="stat-label">预置 Harness 扩展</span>
            </div>
          </div>
        </div>
      </div>

      <div class="scroll-hint">
        <span class="scroll-line"></span>
        <span class="scroll-text">SCROLL</span>
      </div>
    </section>

    <!-- Features Section -->
    <section id="features" class="features">
      <div class="section-header">
        <span class="section-tag">CAPABILITIES</span>
        <h2 class="section-title">核心能力</h2>
        <div class="section-line"></div>
      </div>

      <div class="feature-grid">
        <div v-for="f in features" :key="f.id" :class="['feature-pane', { 'coming-soon': f.coming }]">
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
          <span class="arch-detail">Vue 3</span>
        </div>
        <div class="arch-arrow">
          <span class="arrow-line"></span>
          <span class="arrow-label">SSE / REST</span>
        </div>
        <div class="arch-node arch-api">
          <span class="arch-label">API GATEWAY</span>
          <span class="arch-detail">JDK 21 / Spring Boot / Agent Scope</span>
          <span class="arch-detail">(Agent Router - Tools - Skills...)</span>
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
        <h2 class="cta-title">准备好接入 WU·AGENT 了吗？</h2>
        <p class="cta-desc">使用体验账号 demo / 654321 快速体验，或注册你自己的账号。</p>
        <button class="hero-cta" @click="enterSystem">
          立即体验
        </button>
      </div>
    </section>

    <footer class="footer">
      &copy; 2026 WU·AGENT · AI Agent Platform v2.0
    </footer>
  </div>
</template>

<style scoped>
.home-container {
  position: relative;
  min-height: 100vh;
  background: #f8f9fc;
  color: #1e1b4b;
  font-family: 'Inter', sans-serif;
  overflow-x: hidden;
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
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid #e5e7eb;
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
  font-family: 'Space Grotesk', sans-serif;
  font-size: 1rem;
  font-weight: 700;
  color: #1e1b4b;
  letter-spacing: 3px;
}

.nav-logo-accent {
  color: #4338ca;
}

.nav-cta {
  padding: 8px 24px;
  background: #4338ca;
  border: none;
  border-radius: 8px;
  color: #ffffff;
  font-family: 'Inter', sans-serif;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.nav-cta:hover {
  background: #3730a3;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(67, 56, 202, 0.3);
}

/* Hero */
.hero {
  position: relative;
  z-index: 2;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 120px 32px 80px;
  overflow: hidden;
}

/* Hero background decorations */
.hero-bg {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  overflow: hidden;
}

.mesh-blob {
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
  opacity: 0.5;
}

.mesh-1 {
  width: 600px;
  height: 600px;
  background: radial-gradient(circle, rgba(67, 56, 202, 0.15) 0%, transparent 70%);
  top: -200px;
  right: -100px;
}

.mesh-2 {
  width: 500px;
  height: 500px;
  background: radial-gradient(circle, rgba(124, 58, 237, 0.1) 0%, transparent 70%);
  bottom: -150px;
  left: -100px;
}

.mesh-3 {
  width: 400px;
  height: 400px;
  background: radial-gradient(circle, rgba(16, 185, 129, 0.08) 0%, transparent 70%);
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}

.dot-grid {
  position: absolute;
  inset: 0;
  background-image: radial-gradient(circle, #d1d5db 1px, transparent 1px);
  background-size: 32px 32px;
  opacity: 0.4;
}

.hero-layout {
  position: relative;
  z-index: 1;
  max-width: 1200px;
  width: 100%;
  display: flex;
  align-items: center;
  gap: 64px;
}

.hero-left {
  flex: 1;
  min-width: 0;
}

.hero-right {
  flex: 1;
  min-width: 0;
}

.hero-tag {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 16px;
  border: 1px solid #e5e7eb;
  border-radius: 100px;
  font-size: 0.7rem;
  color: #6b7280;
  letter-spacing: 3px;
  margin-bottom: 24px;
  font-family: 'Space Grotesk', sans-serif;
  background: rgba(255, 255, 255, 0.8);
}

.tag-dot {
  width: 6px;
  height: 6px;
  background: #10b981;
  border-radius: 50%;
  animation: pulse-dot 2s infinite;
}

@keyframes pulse-dot {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.hero-title {
  font-family: 'Space Grotesk', sans-serif;
  font-size: clamp(2.5rem, 5vw, 4rem);
  font-weight: 700;
  color: #1e1b4b;
  letter-spacing: 4px;
  margin-bottom: 16px;
  line-height: 1.1;
}

.title-accent {
  color: #4338ca;
}

.hero-subtitle {
  font-size: 1.25rem;
  color: #374151;
  line-height: 1.6;
  margin-bottom: 8px;
  font-weight: 500;
}

.hero-desc {
  font-size: 0.95rem;
  color: #6b7280;
  line-height: 1.7;
  margin-bottom: 32px;
}

.hero-actions {
  display: flex;
  gap: 16px;
  margin-bottom: 48px;
}

.hero-cta {
  padding: 14px 32px;
  border: none;
  border-radius: 10px;
  font-size: 0.95rem;
  font-weight: 600;
  font-family: 'Inter', sans-serif;
  cursor: pointer;
  transition: all 0.2s;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
}

.hero-cta.primary {
  background: #4338ca;
  color: #ffffff;
}

.hero-cta.primary:hover {
  background: #3730a3;
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(67, 56, 202, 0.3);
}

.hero-cta.secondary {
  background: #ffffff;
  color: #4338ca;
  border: 1px solid #e5e7eb;
}

.hero-cta.secondary:hover {
  border-color: #4338ca;
  background: #f5f3ff;
}

.hero-stats {
  display: flex;
  align-items: center;
  gap: 24px;
}

.stat {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.stat-value {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 1.2rem;
  font-weight: 700;
  color: #1e1b4b;
}

.stat-label {
  font-size: 0.75rem;
  color: #9ca3af;
}

.stat-divider {
  width: 1px;
  height: 32px;
  background: #e5e7eb;
}

/* Terminal Window */
.terminal-window {
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  text-align: left;
  overflow: hidden;
  box-shadow:
    0 4px 24px rgba(0, 0, 0, 0.06),
    0 20px 60px rgba(67, 56, 202, 0.08);
  transform: perspective(1000px) rotateY(3deg) rotateX(2deg);
  transition: transform 0.4s;
}

.terminal-window:hover {
  transform: perspective(1000px) rotateY(0deg) rotateX(0deg);
}

.terminal-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: #f9fafb;
  border-bottom: 1px solid #e5e7eb;
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

.dot-red { background: #ef4444; }
.dot-yellow { background: #f59e0b; }
.dot-green { background: #10b981; }

.terminal-title {
  font-size: 0.7rem;
  color: #9ca3af;
  letter-spacing: 1px;
  font-family: 'JetBrains Mono', monospace;
}

.terminal-body {
  padding: 20px 24px;
  min-height: 320px;
  font-size: 0.82rem;
  line-height: 1.8;
  font-family: 'JetBrains Mono', monospace;
  background: #f9fafb;
}

.boot-line {
  animation: line-appear 0.3s ease-out;
}

@keyframes line-appear {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}

.color-green { color: #059669; }
.color-amber { color: #b45309; }
.color-dim { color: #9ca3af; }

.cursor {
  color: #059669;
  font-size: 0.85rem;
}

.cursor.blink {
  animation: blink 1s step-end infinite;
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}

/* Scroll hint */
.scroll-hint {
  position: absolute;
  bottom: 40px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  z-index: 1;
}

.scroll-line {
  width: 1px;
  height: 40px;
  background: linear-gradient(to bottom, #d1d5db, transparent);
  animation: scroll-pulse 2s infinite;
}

@keyframes scroll-pulse {
  0%, 100% { opacity: 1; transform: scaleY(1); }
  50% { opacity: 0.3; transform: scaleY(0.6); }
}

.scroll-text {
  font-size: 0.6rem;
  color: #9ca3af;
  letter-spacing: 4px;
  font-family: 'Space Grotesk', sans-serif;
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
  border: 1px solid #e5e7eb;
  border-radius: 100px;
  font-size: 0.65rem;
  color: #6b7280;
  letter-spacing: 3px;
  font-family: 'Space Grotesk', sans-serif;
  margin-bottom: 16px;
  background: #ffffff;
}

.section-title {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 1.8rem;
  font-weight: 700;
  color: #1e1b4b;
  letter-spacing: 2px;
  margin-bottom: 16px;
}

.section-line {
  width: 60px;
  height: 2px;
  background: linear-gradient(90deg, transparent, #4338ca, transparent);
  margin: 0 auto;
  border-radius: 1px;
}

.feature-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 24px;
}

.feature-pane {
  position: relative;
  padding: 32px;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  transition: all 0.3s;
}

.feature-pane:hover {
  border-color: #4338ca;
  box-shadow: 0 8px 32px rgba(67, 56, 202, 0.08);
  transform: translateY(-4px);
}

/* Coming Soon card */
.feature-pane.coming-soon {
  background: linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%);
  border: 1px dashed #c4b5fd;
  position: relative;
  overflow: hidden;
}

.feature-pane.coming-soon::before {
  content: 'COMING SOON';
  position: absolute;
  top: 16px;
  right: -32px;
  padding: 4px 40px;
  background: #7c3aed;
  color: #ffffff;
  font-family: 'Space Grotesk', sans-serif;
  font-size: 0.6rem;
  font-weight: 700;
  letter-spacing: 2px;
  transform: rotate(45deg);
  z-index: 1;
}

.feature-pane.coming-soon .pane-id {
  background: #ede9fe;
  border-color: #c4b5fd;
  color: #7c3aed;
}

.feature-pane.coming-soon .pane-icon {
  color: #7c3aed;
  opacity: 0.6;
}

.feature-pane.coming-soon:hover {
  border-color: #7c3aed;
  box-shadow: 0 8px 32px rgba(124, 58, 237, 0.1);
}

.pane-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
}

.pane-id {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 0.7rem;
  color: #7c3aed;
  padding: 2px 8px;
  border: 1px solid #e9d5ff;
  border-radius: 6px;
  background: #f5f3ff;
  letter-spacing: 1px;
}

.pane-subtitle {
  font-size: 0.6rem;
  color: #9ca3af;
  letter-spacing: 2px;
  font-family: 'Space Grotesk', sans-serif;
}

.pane-icon {
  width: 40px;
  height: 40px;
  color: #4338ca;
  margin-bottom: 16px;
  opacity: 0.8;
}

.pane-icon :deep(svg) {
  width: 100%;
  height: 100%;
}

.pane-title {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 1.1rem;
  font-weight: 600;
  color: #1e1b4b;
  margin-bottom: 12px;
}

.pane-desc {
  font-size: 0.85rem;
  color: #6b7280;
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
  border: 1px solid #e5e7eb;
  background: #ffffff;
  border-radius: 12px;
  min-width: 140px;
  text-align: center;
  transition: all 0.3s;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.arch-node:hover {
  border-color: #4338ca;
  box-shadow: 0 4px 16px rgba(67, 56, 202, 0.1);
}

.arch-label {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 0.7rem;
  color: #4338ca;
  letter-spacing: 2px;
  font-weight: 600;
}

.arch-detail {
  font-size: 0.7rem;
  color: #6b7280;
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
  background: linear-gradient(90deg, #e5e7eb, #4338ca, #e5e7eb);
  position: relative;
}

.arrow-line::after {
  content: '▸';
  position: absolute;
  right: -6px;
  top: -8px;
  color: #4338ca;
  font-size: 0.8rem;
}

.arrow-label {
  font-size: 0.55rem;
  color: #9ca3af;
  letter-spacing: 1px;
  white-space: nowrap;
  font-family: 'Space Grotesk', sans-serif;
}

/* CTA Section */
.cta-section {
  position: relative;
  z-index: 2;
  padding: 100px 32px;
  text-align: center;
  border-top: 1px solid #e5e7eb;
  background: #ffffff;
}

.cta-content {
  max-width: 600px;
  margin: 0 auto;
}

.cta-label {
  font-size: 0.65rem;
  color: #9ca3af;
  letter-spacing: 2px;
  margin-bottom: 16px;
  font-family: 'JetBrains Mono', monospace;
}

.cta-title {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 1.5rem;
  font-weight: 700;
  color: #1e1b4b;
  letter-spacing: 1px;
  margin-bottom: 16px;
}

.cta-desc {
  font-size: 0.9rem;
  color: #6b7280;
  margin-bottom: 40px;
  line-height: 1.6;
}

/* Footer */
.footer {
  position: relative;
  z-index: 2;
  padding: 24px;
  text-align: center;
  font-size: 0.75rem;
  color: #9ca3af;
  letter-spacing: 1px;
  border-top: 1px solid #e5e7eb;
}

/* Responsive */
@media (max-width: 1024px) {
  .feature-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .hero-layout {
    flex-direction: column;
    gap: 48px;
  }

  .hero-right {
    width: 100%;
  }

  .terminal-window {
    transform: none;
  }

  .terminal-window:hover {
    transform: none;
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
    background: linear-gradient(to bottom, #e5e7eb, #4338ca, #e5e7eb);
  }

  .arrow-line::after {
    content: '▾';
    right: -5px;
    top: auto;
    bottom: -8px;
  }

  .hero {
    padding: 100px 20px 80px;
  }

  .hero-title {
    letter-spacing: 2px;
  }

  .hero-actions {
    flex-direction: column;
  }

  .hero-cta {
    justify-content: center;
  }

  .hero-stats {
    flex-wrap: wrap;
    gap: 16px;
  }

  .stat-divider {
    display: none;
  }

  .feature-pane {
    padding: 24px;
  }

  .mesh-1 {
    width: 300px;
    height: 300px;
  }

  .mesh-2 {
    width: 250px;
    height: 250px;
  }
}
</style>
