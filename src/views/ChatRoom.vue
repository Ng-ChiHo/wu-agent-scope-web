<script setup>
import { ref, reactive, onMounted, onBeforeUnmount, nextTick, watch, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { getUser, apiLogout } from '@/utils/auth'
import { fetchWithToken, createSseConnection, fetchSsePost } from '@/utils/fetch'
import { renderMarkdown } from '@/utils/markdown'
import EChart from '@/components/EChart.vue'

const URL_REGEX = /(https?:\/\/[^\s<>"')\]]+[^\s<>"')\],.!?:;])/g
function parseUserText(text) {
  if (!text) return ''
  return text.replace(URL_REGEX, (url) => {
    return `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`
  })
}

const router = useRouter()
const route = useRoute()

// User
const user = ref(getUser())

// Sidebar
const sidebarWidth = ref(280)
const isDragging = ref(false)
const conversations = ref([])
const activeConversationId = ref(null)

// Chat
const messages = ref([])
const inputText = ref('')
const isLoading = ref(false)
const isLoadingMessages = ref(false) // 会话消息加载中
let currentEventSource = null
let currentSseRequest = null

// Models
const availableModels = ref([])
const selectedModelId = ref('')

// Images
const attachedImages = ref([]) // { base64, mimeType, previewUrl }
const fileInputRef = ref(null)

// 判断当前模型是否支持 vision
const isVisionModel = computed(() => {
  const model = availableModels.value.find(m => m.id === selectedModelId.value)
  return model?.capabilities?.includes('vision') || false
})

// Dashboard
const showDashboard = ref(false)
const dashboardUrl = ref('')

// Editing
const editingId = ref(null)
const editingName = ref('')

// Delete modal
const showDeleteModal = ref(false)
const deleteTargetId = ref(null)

// Chat messages container ref
const chatMessagesRef = ref(null)
const inputRef = ref(null)

// Focus input helper
function focusInput() {
  nextTick(() => {
    if (inputRef.value) {
      inputRef.value.focus()
    }
  })
}

// Computed
const activeConversation = computed(() =>
  conversations.value.find(c => c.conversationId === activeConversationId.value)
)

// Generate unique chat ID
function generateChatId() {
  return 'chat_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9)
}

// Time formatting
function formatTime(timestamp) {
  if (!timestamp) return ''
  const date = new Date(timestamp.replace(' ', 'T'))
  const now = new Date()
  const diffMs = now - date
  const diffMin = Math.floor(diffMs / 60000)
  const diffHour = Math.floor(diffMs / 3600000)
  const diffDay = Math.floor(diffMs / 86400000)

  if (diffMin < 1) return '刚刚'
  if (diffMin < 60) return `${diffMin}分钟前`
  if (diffHour < 24) return `${diffHour}小时前`
  if (diffDay < 7) return `${diffDay}天前`
  return date.toLocaleDateString('zh-CN')
}

function formatMessageTime(timestamp) {
  if (!timestamp) return ''
  const date = new Date(timestamp.replace(' ', 'T'))
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

// Scroll to bottom
function scrollToBottom() {
  nextTick(() => {
    if (chatMessagesRef.value) {
      chatMessagesRef.value.scrollTop = chatMessagesRef.value.scrollHeight
    }
  })
}

// Load conversations
async function loadConversations() {
  try {
    const res = await fetchWithToken('/chat/conversations')
    if (res.code === 0) {
      conversations.value = res.data || []
    }
  } catch (e) {
    console.error('加载会话列表失败:', e)
  }
}

// Load available models
async function loadModels() {
  try {
    const res = await fetchWithToken('/ai/models')
    if (res.code === 0 && res.data) {
      availableModels.value = res.data
      // If no model selected yet, use default
      if (!selectedModelId.value && res.data.length > 0) {
        const defaultModel = res.data.find(m => m.id === 'qwen2.5:14b') || res.data[0]
        selectedModelId.value = defaultModel.id
      }
    }
  } catch (e) {
    console.error('加载模型列表失败:', e)
  }
}

// 解析图表数据：兼容后端返回的 {chartType, title, echartsOption} 格式
function parseChartData(chartDataStr) {
  try {
    const data = typeof chartDataStr === 'string' ? JSON.parse(chartDataStr) : chartDataStr
    const option = data.echartsOption || data
    if (!option || !option.series || option.series.length === 0) return null
    if (option.title && typeof option.title === 'string') {
      option.title = { text: option.title }
    }
    return option
  } catch {
    return null
  }
}

// 从 content 中提取可展示的文本
function extractTextContent(content) {
  // 字符串类型（USER 消息常见）
  if (typeof content === 'string') return content
  // 数组类型（ASSISTANT 消息：混合 text / tool_use）
  if (Array.isArray(content)) {
    return content
      .filter(item => item.type === 'text' && item.text)
      .map(item => item.text)
      .join('\n')
  }
  return ''
}

// Load messages for a conversation
async function loadMessages(conversationId) {
  try {
    const res = await fetchWithToken(`/chat/conversation/messages?conversationId=${conversationId}`)
    if (res.code === 0) {
      messages.value = (res.data || [])
        .filter(m => {
          const role = (m.role || '').toLowerCase()
          if (role !== 'user' && role !== 'assistant') return false
          // 过滤掉只有 tool_use、没有 text 的 assistant 消息
          const text = extractTextContent(m.content)
          return text.trim() !== ''
        })
        .map(m => ({
          role: m.role.toLowerCase(),
          content: extractTextContent(m.content),
          timestamp: m.timestamp,
          images: m.imageUrls || undefined,
          chartData: m.chartData || undefined
        }))
      scrollToBottom()
      focusInput()
    }
  } catch (e) {
    console.error('加载消息失败:', e)
  }
}

// New conversation
function newConversation() {
  activeConversationId.value = null
  messages.value = []
  showDashboard.value = false
  router.push('/chat')
  focusInput()
}

// Dashboard
async function openDashboard() {
  if (dashboardUrl.value) {
    showDashboard.value = true
    return
  }
  try {
    const res = await fetchWithToken('/dashboard/embed')
    if (res.code === 0) {
      dashboardUrl.value = res.data
      showDashboard.value = true
    }
  } catch (e) {
    console.error('获取 Dashboard URL 失败:', e)
  }
}

// Select conversation
async function selectConversation(conv) {
  showDashboard.value = false
  activeConversationId.value = conv.conversationId
  router.push(`/chat/${conv.conversationId}`)
  isLoadingMessages.value = true
  // Restore last used model for this conversation
  if (conv.lastModelId) {
    selectedModelId.value = conv.lastModelId
  }
  await loadMessages(conv.conversationId)
  isLoadingMessages.value = false
  await nextTick()
  scrollToBottom()
}

// ==================== 图片处理 ====================

function triggerFileInput() {
  fileInputRef.value?.click()
}

function handleImageUpload(event) {
  const files = event.target.files
  if (!files) return

  for (const file of files) {
    if (!file.type.startsWith('image/')) continue
    if (file.size > 20 * 1024 * 1024) { // 20MB limit
      console.warn('图片过大，跳过:', file.name)
      continue
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      const dataUrl = e.target.result
      // 提取 base64 部分（去掉 data:image/xxx;base64, 前缀）
      const base64 = dataUrl.split(',')[1]
      attachedImages.value.push({
        base64,
        mimeType: file.type,
        previewUrl: dataUrl
      })
    }
    reader.readAsDataURL(file)
  }

  // 清空 input 以允许重复选择同一文件
  event.target.value = ''
}

function removeImage(index) {
  attachedImages.value.splice(index, 1)
}

// 剪贴板粘贴图片
function handlePaste(event) {
  const items = event.clipboardData?.items
  if (!items) return

  for (const item of items) {
    if (item.type.startsWith('image/')) {
      event.preventDefault()
      const file = item.getAsFile()
      if (file) {
        const reader = new FileReader()
        reader.onload = (e) => {
          const dataUrl = e.target.result
          const base64 = dataUrl.split(',')[1]
          attachedImages.value.push({
            base64,
            mimeType: file.type,
            previewUrl: dataUrl
          })
        }
        reader.readAsDataURL(file)
      }
      break
    }
  }
}

// 生成本地时间字符串（与后端返回格式一致：YYYY-MM-DD HH:mm:ss）
function localTimestamp() {
  const d = new Date()
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

// Send message via SSE
function sendMessage() {
  const text = inputText.value.trim()
  if ((!text && attachedImages.value.length === 0) || isLoading.value) return

  const chatId = activeConversationId.value || generateChatId()
  if (!activeConversationId.value) {
    activeConversationId.value = chatId
    router.push(`/chat/${chatId}`)
  }

  // Save images before clearing
  const imagesToSend = [...attachedImages.value]
  const hasImages = imagesToSend.length > 0

  // Add user message (with image previews)
  messages.value.push({
    role: 'user',
    content: text,
    images: hasImages ? imagesToSend.map(img => img.previewUrl) : undefined,
    timestamp: localTimestamp()
  })
  inputText.value = ''
  attachedImages.value = []
  resetTextareaHeight()
  scrollToBottom()

  // Add AI placeholder
  const aiMsgIndex = messages.value.length
  messages.value.push({
    role: 'assistant',
    content: '',
    timestamp: localTimestamp()
  })

  isLoading.value = true
  let fullResponse = ''

  if (hasImages) {
    // POST SSE: 有图片时使用 POST 方式
    const body = {
      message: text,
      chatId: chatId,
      modelId: selectedModelId.value,
      images: imagesToSend.map(img => ({
        base64: img.base64,
        mimeType: img.mimeType
      }))
    }

    currentSseRequest = fetchSsePost('/ai/chat/common/sse', body,
      (data) => {
        fullResponse += data
        messages.value[aiMsgIndex].content = fullResponse
        scrollToBottom()
      },
      () => {
        currentSseRequest = null
        isLoading.value = false
        loadConversations()
        // POST SSE 不保留换行，重新加载消息以获取正确 markdown 格式
        if (activeConversationId.value) {
          loadMessages(activeConversationId.value)
        }
        scrollToBottom()
        focusInput()
      },
      (err) => {
        currentSseRequest = null
        isLoading.value = false
        if (!fullResponse) {
          messages.value[aiMsgIndex].content = '⚠ 连接中断，请重试'
        }
        loadConversations()
        focusInput()
      }
    )
  } else {
    // GET SSE: 纯文本时使用原有 EventSource 方式
    const encodedMsg = encodeURIComponent(text)
    const url = `/ai/chat/common/sse?message=${encodedMsg}&chatId=${encodeURIComponent(chatId)}`

    currentEventSource = createSseConnection(url, { modelId: selectedModelId.value })

    currentEventSource.onmessage = (event) => {
      fullResponse += event.data
      messages.value[aiMsgIndex].content = fullResponse
      scrollToBottom()
    }

    currentEventSource.addEventListener('close', () => {
      currentEventSource.close()
      currentEventSource = null
      isLoading.value = false
      loadConversations()
      // SSE 流结束后重新加载消息，确保 markdown 格式正确
      if (activeConversationId.value) {
        loadMessages(activeConversationId.value)
      }
      scrollToBottom()
      focusInput()
    })

    currentEventSource.onerror = () => {
      if (currentEventSource) {
        currentEventSource.close()
        currentEventSource = null
      }
      isLoading.value = false
      if (!fullResponse) {
        messages.value[aiMsgIndex].content = '⚠ 连接中断，请重试'
      }
      loadConversations()
      focusInput()
    }
  }
}

// Auto-resize textarea
function autoResize(e) {
  const el = e.target
  el.style.height = 'auto'
  el.style.height = Math.min(el.scrollHeight, 150) + 'px'
}

function resetTextareaHeight() {
  nextTick(() => {
    const textarea = document.querySelector('.chat-input')
    if (textarea) textarea.style.height = 'auto'
  })
}

function handleKeydown(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    sendMessage()
  }
}

// Rename conversation
function startRename(conv) {
  editingId.value = conv.conversationId
  editingName.value = conv.conversationName
}

async function confirmRename() {
  if (!editingName.value.trim()) return
  try {
    await fetchWithToken(`/chat/conversation/name?conversationId=${editingId.value}&newName=${encodeURIComponent(editingName.value.trim())}`, { method: 'PUT' })
    await loadConversations()
  } catch (e) {
    console.error('重命名失败:', e)
  }
  editingId.value = null
  editingName.value = ''
}

// Delete conversation
function confirmDelete(conv) {
  deleteTargetId.value = conv.conversationId
  showDeleteModal.value = true
}

async function doDelete() {
  try {
    await fetchWithToken(`/chat/conversation?conversationId=${deleteTargetId.value}`, { method: 'DELETE' })
    if (activeConversationId.value === deleteTargetId.value) {
      newConversation()
    }
    await loadConversations()
  } catch (e) {
    console.error('删除失败:', e)
  }
  showDeleteModal.value = false
  deleteTargetId.value = null
}

// Logout
async function handleLogout() {
  try {
    await apiLogout()
  } finally {
    router.push('/login')
  }
}

// Sidebar drag
function startDrag(e) {
  isDragging.value = true
  const startX = e.clientX
  const startWidth = sidebarWidth.value

  function onMove(e) {
    const delta = e.clientX - startX
    sidebarWidth.value = Math.min(Math.max(startWidth + delta, 200), 500)
  }

  function onUp() {
    isDragging.value = false
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onUp)
  }

  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onUp)
}

onMounted(async () => {
  await Promise.all([loadConversations(), loadModels()])
  const chatId = route.params.chatId
  if (chatId) {
    activeConversationId.value = chatId
    const conv = conversations.value.find(c => c.conversationId === chatId)
    if (conv?.lastModelId) {
      selectedModelId.value = conv.lastModelId
    }
    isLoadingMessages.value = true
    await loadMessages(chatId)
    isLoadingMessages.value = false
    await nextTick()
    scrollToBottom()
  }
})

onBeforeUnmount(() => {
  if (currentEventSource) {
    currentEventSource.close()
    currentEventSource = null
  }
  if (currentSseRequest) {
    currentSseRequest.abort()
    currentSseRequest = null
  }
})
</script>

<template>
  <div class="chat-container">
    <!-- Left Sidebar -->
    <aside class="sidebar" :style="{ width: sidebarWidth + 'px' }">
      <div class="sidebar-header">
        <button class="new-chat-btn" @click="newConversation">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          新对话
        </button>
        <a href="https://jaeger.xpeak.top" target="_blank" rel="noopener noreferrer" class="jaeger-link">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="14" height="14">
            <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
          </svg>
          系统应用链路追踪
        </a>
        <a href="#" @click.prevent="openDashboard" class="jaeger-link">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="14" height="14">
            <rect x="3" y="12" width="4" height="9" rx="1" />
            <rect x="10" y="7" width="4" height="14" rx="1" />
            <rect x="17" y="3" width="4" height="18" rx="1" />
          </svg>
          模型用量数据看板
        </a>
      </div>

      <div class="conversation-list">
        <div class="conv-section-header" v-if="conversations.length > 0">
          <span class="conv-section-title">历史会话</span>
          <span class="conv-section-count">{{ conversations.length }}</span>
        </div>
        <div
          v-for="conv in conversations"
          :key="conv.conversationId"
          :class="['conversation-item', { active: conv.conversationId === activeConversationId }]"
          @click="selectConversation(conv)"
        >
          <svg class="conv-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="16" height="16">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>

          <div class="conv-info" v-if="editingId !== conv.conversationId">
            <span class="conv-name">{{ conv.conversationName || '新对话' }}</span>
            <span class="conv-time">{{ formatTime(conv.createTime) }}</span>
          </div>

          <div class="conv-edit" v-else @click.stop>
            <input
              v-model="editingName"
              class="edit-input"
              @keyup.enter="confirmRename"
              @keyup.escape="editingId = null"
              @blur="confirmRename"
              autofocus
            />
          </div>

          <div class="conv-actions" v-if="editingId !== conv.conversationId">
            <button class="action-btn" @click.stop="startRename(conv)" title="重命名">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>
            <button class="action-btn delete" @click.stop="confirmDelete(conv)" title="删除">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
            </button>
          </div>
        </div>

        <div v-if="conversations.length === 0" class="empty-convs">
          <p>暂无对话</p>
          <p class="hint">点击「新对话」开始</p>
        </div>
      </div>

      <div class="sidebar-footer">
        <div class="user-info">
          <div class="user-avatar">{{ (user?.nickname || user?.username || 'U')[0] }}</div>
          <span class="user-name">{{ user?.nickname || user?.username || '用户' }}</span>
        </div>
        <button class="logout-btn" @click="handleLogout" title="登出">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
        </button>
      </div>
    </aside>

    <!-- Drag splitter -->
    <div class="splitter" @mousedown.prevent="startDrag" :class="{ dragging: isDragging }"></div>

    <!-- Chat Area -->
    <main class="chat-area">
      <!-- Dashboard iframe -->
      <div v-if="showDashboard" class="dashboard-container">
        <div class="dashboard-header">
          <button class="back-btn" @click="showDashboard = false">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            返回对话
          </button>
          <span class="dashboard-title">WU·AGENT 2.0数据看板</span>
        </div>
        <iframe
          :src="dashboardUrl"
          frameborder="0"
          class="dashboard-iframe"
          allow="clipboard-write"
        ></iframe>
      </div>

      <!-- Chat content -->
      <template v-else>
      <header class="chat-header">
        <div class="header-left">
          <h2 class="chat-title">WU·AGENT 2.0</h2>
          <span class="chat-id" v-if="activeConversationId">{{ activeConversationId }}</span>
        </div>
        <div class="header-right">
          <span class="status-dot"></span>
          <span class="status-text">在线</span>
        </div>
      </header>

      <!-- Conversation loading state -->
      <div v-if="isLoadingMessages" class="loading-container">
        <div class="loading-content">
          <div class="loading-spinner-ring">
            <div class="ring-segment" v-for="i in 8" :key="i" :style="{ transform: `rotate(${i * 45}deg)` }"></div>
          </div>
          <span class="loading-text">LOADING MESSAGES</span>
          <div class="loading-bar">
            <div class="loading-bar-fill"></div>
          </div>
        </div>
      </div>

      <div v-else class="chat-messages" ref="chatMessagesRef">
        <!-- Welcome state -->
        <div v-if="messages.length === 0" class="welcome-state">
          <div class="welcome-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="48" height="48">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <h3>欢迎使用 Wu Agent</h3>
          <p>输入你的问题，开始与 AI 对话</p>
        </div>

        <!-- Messages -->
        <div
          v-for="(msg, index) in messages"
          :key="index"
          :class="['message', msg.role]"
        >
          <div class="message-avatar">
            <svg v-if="msg.role === 'user'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <div class="message-body">
            <div class="message-bubble md-body" v-html="msg.role === 'assistant' ? renderMarkdown(msg.content) : parseUserText(msg.content)"></div>
            <div v-if="msg.chartData && parseChartData(msg.chartData)" class="message-chart">
              <EChart :option="parseChartData(msg.chartData)" height="350px" />
            </div>
            <div v-if="msg.images && msg.images.length > 0" class="message-images">
              <img v-for="(imgUrl, imgIdx) in msg.images" :key="imgIdx" :src="imgUrl" class="message-image-thumb" />
            </div>
            <span class="message-time">{{ formatMessageTime(msg.timestamp) }}</span>
          </div>
        </div>

        <!-- Loading indicator -->
        <div v-if="isLoading && messages[messages.length - 1]?.content === ''" class="message assistant">
          <div class="message-avatar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <div class="message-body">
            <div class="typing-indicator">
              <span></span><span></span><span></span>
            </div>
          </div>
        </div>
      </div>

      <!-- Input Area -->
      <div class="chat-input-area">
        <!-- Image preview bar -->
        <div v-if="attachedImages.length > 0" class="image-preview-bar">
          <div v-for="(img, index) in attachedImages" :key="index" class="image-preview-item">
            <img :src="img.previewUrl" class="image-preview-thumb" />
            <button class="image-remove-btn" @click="removeImage(index)" title="移除">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>
        <div class="model-selector-wrapper">
          <select
            v-model="selectedModelId"
            class="model-select"
            :disabled="isLoading"
            title="选择模型"
          >
            <option
              v-for="m in availableModels"
              :key="m.id"
              :value="m.id"
            >{{ m.displayName || m.id }}</option>
          </select>
          <span v-if="isVisionModel" class="vision-badge" title="支持图片输入">👁</span>
        </div>
        <!-- Hidden file input -->
        <input
          ref="fileInputRef"
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          multiple
          style="display: none"
          @change="handleImageUpload"
        />
        <!-- Image upload button -->
        <button
          v-if="isVisionModel"
          class="image-upload-btn"
          @click="triggerFileInput"
          :disabled="isLoading"
          title="上传图片"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
        </button>
        <textarea
          ref="inputRef"
          v-model="inputText"
          class="chat-input"
          :placeholder="isVisionModel ? '输入文字或粘贴图片... (Enter 发送)' : '请输入你的聊天内容... (Enter 发送, Shift+Enter 换行)'"
          @input="autoResize"
          @keydown="handleKeydown"
          @paste="isVisionModel ? handlePaste($event) : null"
          :disabled="isLoading"
          rows="1"
        ></textarea>
        <button
          class="send-btn"
          @click="sendMessage"
          :disabled="(!inputText.trim() && attachedImages.length === 0) || isLoading"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </div>
      </template>
    </main>

    <!-- Delete confirmation modal -->
    <Teleport to="body">
      <div v-if="showDeleteModal" class="modal-overlay" @click.self="showDeleteModal = false">
        <div class="modal-card">
          <h3>确认删除</h3>
          <p>此对话的所有消息将被永久删除，无法恢复。</p>
          <div class="modal-actions">
            <button class="modal-btn cancel" @click="showDeleteModal = false">取消</button>
            <button class="modal-btn confirm" @click="doDelete">删除</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.chat-container {
  display: flex;
  height: 100vh;
  background: linear-gradient(135deg, #060a16 0%, #0a1020 50%, #0d1a2d 100%);
  overflow: hidden;
}

/* Scanline overlay */
.chat-container::after {
  content: '';
  position: fixed;
  inset: 0;
  background: repeating-linear-gradient(
    0deg,
    transparent,
    transparent 2px,
    rgba(57, 255, 20, 0.006) 2px,
    rgba(57, 255, 20, 0.006) 4px
  );
  pointer-events: none;
  z-index: 999;
}

/* Sidebar */
.sidebar {
  display: flex;
  flex-direction: column;
  background: rgba(6, 10, 22, 0.97);
  border-right: 1px solid rgba(57, 255, 20, 0.08);
  flex-shrink: 0;
  position: relative;
  z-index: 10;
}

.sidebar-header {
  padding: 16px;
  border-bottom: 1px solid rgba(57, 255, 20, 0.08);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.jaeger-link {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px 12px;
  background: rgba(57, 255, 20, 0.04);
  border: 1px solid rgba(57, 255, 20, 0.1);
  border-radius: 2px;
  color: rgba(57, 255, 20, 0.5);
  font-size: 0.8rem;
  font-family: 'Courier New', monospace;
  text-decoration: none;
  transition: all 0.3s;
}

.jaeger-link:hover {
  background: rgba(57, 255, 20, 0.08);
  border-color: rgba(57, 255, 20, 0.25);
  color: #39ff14;
  box-shadow: 0 0 12px rgba(57, 255, 20, 0.06);
}

.new-chat-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px;
  background: rgba(57, 255, 20, 0.06);
  border: 1px dashed rgba(57, 255, 20, 0.2);
  border-radius: 2px;
  color: #39ff14;
  font-size: 0.9rem;
  font-family: 'Courier New', monospace;
  cursor: pointer;
  transition: all 0.3s;
}

.new-chat-btn:hover {
  background: rgba(57, 255, 20, 0.12);
  border-color: rgba(57, 255, 20, 0.4);
  box-shadow: 0 0 20px rgba(57, 255, 20, 0.08);
}

.conversation-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.conv-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px 6px;
  margin-bottom: 4px;
}

.conv-section-title {
  font-size: 0.7rem;
  color: rgba(57, 255, 20, 0.35);
  font-family: 'Courier New', monospace;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.conv-section-count {
  font-size: 0.65rem;
  color: rgba(57, 255, 20, 0.3);
  font-family: 'Courier New', monospace;
  background: rgba(57, 255, 20, 0.06);
  padding: 1px 6px;
  border-radius: 8px;
  border: 1px solid rgba(57, 255, 20, 0.08);
}

.conversation-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px;
  border-radius: 2px;
  cursor: pointer;
  transition: all 0.2s;
  margin-bottom: 4px;
  position: relative;
}

.conversation-item:hover {
  background: rgba(57, 255, 20, 0.04);
}

.conversation-item.active {
  background: rgba(57, 255, 20, 0.08);
  border-left: 2px solid #39ff14;
}

.conv-icon {
  color: rgba(57, 255, 20, 0.25);
  flex-shrink: 0;
}

.conversation-item.active .conv-icon {
  color: #39ff14;
}

.conv-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.conv-name {
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.8);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.conv-time {
  font-size: 0.7rem;
  color: rgba(255, 255, 255, 0.3);
}

.conv-actions {
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.2s;
}

.conversation-item:hover .conv-actions {
  opacity: 1;
}

.action-btn {
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.4);
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition: all 0.2s;
  display: flex;
  align-items: center;
}

.action-btn:hover {
  color: #39ff14;
  background: rgba(57, 255, 20, 0.1);
}

.action-btn.delete:hover {
  color: #ff5050;
  background: rgba(255, 80, 80, 0.1);
}

.edit-input {
  width: 100%;
  padding: 4px 8px;
  background: rgba(57, 255, 20, 0.04);
  border: 1px solid rgba(57, 255, 20, 0.25);
  border-radius: 2px;
  color: #e0ffe0;
  font-size: 0.85rem;
  font-family: 'Courier New', monospace;
  outline: none;
}

.empty-convs {
  text-align: center;
  padding: 40px 16px;
  color: rgba(255, 255, 255, 0.25);
  font-size: 0.85rem;
}

.empty-convs .hint {
  margin-top: 8px;
  font-size: 0.75rem;
}

.sidebar-footer {
  padding: 16px;
  border-top: 1px solid rgba(57, 255, 20, 0.08);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 10px;
}

.user-avatar {
  width: 32px;
  height: 32px;
  border-radius: 2px;
  background: rgba(57, 255, 20, 0.1);
  border: 1px solid rgba(57, 255, 20, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.85rem;
  font-weight: 700;
  color: #39ff14;
  font-family: 'Orbitron', sans-serif;
}

.user-name {
  font-size: 0.85rem;
  color: rgba(57, 255, 20, 0.7);
  font-family: 'Courier New', monospace;
}

.logout-btn {
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.4);
  cursor: pointer;
  padding: 6px;
  border-radius: 6px;
  transition: all 0.2s;
  display: flex;
  align-items: center;
}

.logout-btn:hover {
  color: #ff5050;
  background: rgba(255, 80, 80, 0.1);
}

/* Splitter */
.splitter {
  width: 3px;
  cursor: col-resize;
  background: rgba(57, 255, 20, 0.06);
  transition: background 0.2s;
  flex-shrink: 0;
  position: relative;
  z-index: 10;
}

.splitter:hover,
.splitter.dragging {
  background: rgba(57, 255, 20, 0.3);
  box-shadow: 0 0 10px rgba(57, 255, 20, 0.1);
}

/* Chat Area */
.chat-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  position: relative;
}

.chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  border-bottom: 1px solid rgba(57, 255, 20, 0.08);
  background: rgba(6, 10, 22, 0.8);
  backdrop-filter: blur(10px);
  flex-shrink: 0;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.chat-title {
  font-family: 'Orbitron', sans-serif;
  font-size: 1.1rem;
  font-weight: 700;
  color: #39ff14;
  text-shadow: 0 0 10px rgba(57, 255, 20, 0.4);
  letter-spacing: 3px;
}

.chat-id {
  font-family: 'Courier New', monospace;
  font-size: 0.7rem;
  color: rgba(57, 255, 20, 0.3);
  padding: 2px 8px;
  background: rgba(57, 255, 20, 0.04);
  border: 1px solid rgba(57, 255, 20, 0.1);
  border-radius: 2px;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #39ff14;
  box-shadow: 0 0 10px rgba(57, 255, 20, 0.5);
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.status-text {
  font-size: 0.8rem;
  color: rgba(57, 255, 20, 0.5);
  font-family: 'Courier New', monospace;
}

/* Conversation loading */
.loading-container {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #060a16 0%, #0a1020 50%, #0d1a2d 100%);
}

.loading-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
}

.loading-spinner-ring {
  position: relative;
  width: 48px;
  height: 48px;
}

.ring-segment {
  position: absolute;
  top: 0;
  left: 50%;
  width: 3px;
  height: 12px;
  margin-left: -1.5px;
  background: rgba(57, 255, 20, 0.15);
  transform-origin: center 24px;
  border-radius: 1px;
  animation: ringPulse 1.2s ease-in-out infinite;
}

.ring-segment:nth-child(1) { animation-delay: 0s; }
.ring-segment:nth-child(2) { animation-delay: 0.15s; }
.ring-segment:nth-child(3) { animation-delay: 0.3s; }
.ring-segment:nth-child(4) { animation-delay: 0.45s; }
.ring-segment:nth-child(5) { animation-delay: 0.6s; }
.ring-segment:nth-child(6) { animation-delay: 0.75s; }
.ring-segment:nth-child(7) { animation-delay: 0.9s; }
.ring-segment:nth-child(8) { animation-delay: 1.05s; }

@keyframes ringPulse {
  0%, 100% { background: rgba(57, 255, 20, 0.15); height: 12px; }
  50% { background: #39ff14; height: 18px; box-shadow: 0 0 8px rgba(57, 255, 20, 0.4); }
}

.loading-text {
  font-family: 'Orbitron', sans-serif;
  font-size: 0.7rem;
  color: rgba(57, 255, 20, 0.4);
  letter-spacing: 4px;
  animation: textFlicker 2s ease-in-out infinite;
}

@keyframes textFlicker {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 0.8; }
}

.loading-bar {
  width: 200px;
  height: 2px;
  background: rgba(57, 255, 20, 0.08);
  border-radius: 1px;
  overflow: hidden;
}

.loading-bar-fill {
  width: 40%;
  height: 100%;
  background: linear-gradient(90deg, transparent, #39ff14, transparent);
  border-radius: 1px;
  animation: barSweep 1.5s ease-in-out infinite;
}

@keyframes barSweep {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(350%); }
}

/* Messages */
.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.welcome-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: rgba(57, 255, 20, 0.25);
  gap: 16px;
}

.welcome-icon {
  color: rgba(57, 255, 20, 0.15);
}

.welcome-state h3 {
  font-family: 'Orbitron', sans-serif;
  font-size: 1.2rem;
  color: rgba(57, 255, 20, 0.5);
  letter-spacing: 4px;
}

.welcome-state p {
  font-size: 0.9rem;
  font-family: 'Courier New', monospace;
}

.message {
  display: flex;
  gap: 12px;
  max-width: 80%;
  animation: msgIn 0.3s ease-out;
}

@keyframes msgIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

.message.user {
  align-self: flex-end;
  flex-direction: row-reverse;
}

.message.assistant {
  align-self: flex-start;
}

.message-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.message.user .message-avatar {
  background: rgba(57, 255, 20, 0.12);
  border: 1px solid rgba(57, 255, 20, 0.3);
  color: #39ff14;
}

.message.assistant .message-avatar {
  background: rgba(255, 165, 0, 0.08);
  border: 1px solid rgba(255, 165, 0, 0.2);
  color: #ffa500;
}

.message-body {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.message.user .message-body {
  align-items: flex-end;
}

.message.assistant .message-body {
  align-items: flex-start;
}

.message-bubble {
  padding: 12px 16px;
  border-radius: 4px;
  font-size: 0.9rem;
  line-height: 1.6;
  word-break: break-word;
  white-space: pre-wrap;
  font-family: 'Courier New', monospace;
}

.message.user .message-bubble {
  background: rgba(57, 255, 20, 0.06);
  border: 1px solid rgba(57, 255, 20, 0.1);
  border-left: 3px solid rgba(57, 255, 20, 0.35);
  color: #c0e8c0;
}

.message.assistant .message-bubble {
  background: rgba(255, 165, 0, 0.04);
  border: 1px solid rgba(255, 165, 0, 0.08);
  border-left: 3px solid rgba(255, 165, 0, 0.3);
  color: rgba(255, 255, 255, 0.85);
}

.message-time {
  font-size: 0.65rem;
  padding: 0 4px;
  font-family: 'Courier New', monospace;
}

.message.user .message-time {
  color: rgba(57, 255, 20, 0.35);
}

.message.assistant .message-time {
  color: rgba(255, 165, 0, 0.35);
}

/* Markdown body styles */
.md-body {
  white-space: normal;
  word-break: break-word;
  line-height: 1.7;
}

.md-body :deep(h1),
.md-body :deep(h2),
.md-body :deep(h3),
.md-body :deep(h4),
.md-body :deep(h5),
.md-body :deep(h6) {
  color: #2aad10;
  font-family: 'Orbitron', sans-serif;
  margin: 16px 0 8px 0;
  letter-spacing: 1px;
}

.md-body :deep(h1) { font-size: 1.3rem; border-bottom: 1px solid rgba(57, 255, 20, 0.15); padding-bottom: 8px; }
.md-body :deep(h2) { font-size: 1.15rem; border-bottom: 1px solid rgba(57, 255, 20, 0.1); padding-bottom: 6px; }
.md-body :deep(h3) { font-size: 1.05rem; }
.md-body :deep(h4) { font-size: 0.95rem; }

.md-body :deep(p) {
  margin: 8px 0;
}

.md-body :deep(a) {
  color: #2aad10;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.md-body :deep(a:hover) {
  color: #39ff14;
}

.md-body :deep(strong) {
  color: #b8d0b8;
  font-weight: 700;
}

.md-body :deep(em) {
  color: rgba(255, 255, 255, 0.7);
  font-style: italic;
}

.md-body :deep(del) {
  color: rgba(255, 255, 255, 0.4);
  text-decoration: line-through;
}

.md-body :deep(code):not(.hljs) {
  background: rgba(57, 255, 20, 0.06);
  border: 1px solid rgba(57, 255, 20, 0.08);
  border-radius: 2px;
  padding: 1px 6px;
  font-size: 0.85em;
  color: #2aad10;
  font-family: 'Courier New', monospace;
}

.md-body :deep(.code-block) {
  margin: 12px 0;
  border: 1px solid rgba(57, 255, 20, 0.1);
  border-radius: 4px;
  overflow: hidden;
}

.md-body :deep(.code-header) {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 12px;
  background: rgba(57, 255, 20, 0.06);
  border-bottom: 1px solid rgba(57, 255, 20, 0.1);
}

.md-body :deep(.code-lang) {
  font-size: 0.7rem;
  color: rgba(57, 255, 20, 0.4);
  font-family: 'Courier New', monospace;
  text-transform: uppercase;
}

.md-body :deep(.copy-btn) {
  background: rgba(57, 255, 20, 0.06);
  border: 1px solid rgba(57, 255, 20, 0.1);
  border-radius: 2px;
  color: rgba(57, 255, 20, 0.45);
  font-size: 0.65rem;
  padding: 2px 8px;
  cursor: pointer;
  font-family: 'Courier New', monospace;
  transition: all 0.2s;
}

.md-body :deep(.copy-btn:hover) {
  background: rgba(57, 255, 20, 0.12);
  color: #2aad10;
}

.md-body :deep(pre) {
  margin: 0;
  padding: 12px;
  background: rgba(0, 0, 0, 0.3);
  overflow-x: auto;
}

.md-body :deep(pre code.hljs) {
  background: transparent;
  border: none;
  padding: 0;
  font-size: 0.82rem;
  line-height: 1.5;
}

.md-body :deep(blockquote) {
  margin: 10px 0;
  padding: 8px 16px;
  border-left: 3px solid rgba(255, 165, 0, 0.4);
  background: rgba(255, 165, 0, 0.04);
  color: rgba(255, 255, 255, 0.7);
}

.md-body :deep(blockquote p) {
  margin: 4px 0;
}

.md-body :deep(ul),
.md-body :deep(ol) {
  padding-left: 24px;
  margin: 8px 0;
}

.md-body :deep(li) {
  margin: 4px 0;
}

.md-body :deep(li::marker) {
  color: rgba(57, 255, 20, 0.35);
}

.md-body :deep(.table-wrapper) {
  overflow-x: auto;
  margin: 10px 0;
}

.md-body :deep(table) {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.85rem;
}

.md-body :deep(th) {
  background: rgba(57, 255, 20, 0.04);
  color: #2aad10;
  font-weight: 600;
  text-align: left;
  padding: 8px 12px;
  border: 1px solid rgba(57, 255, 20, 0.08);
}

.md-body :deep(td) {
  padding: 8px 12px;
  border: 1px solid rgba(255, 255, 255, 0.06);
}

.md-body :deep(tr:hover td) {
  background: rgba(57, 255, 20, 0.02);
}

.md-body :deep(hr) {
  border: none;
  border-top: 1px solid rgba(57, 255, 20, 0.1);
  margin: 16px 0;
}

.md-body :deep(img) {
  max-width: 100%;
  border-radius: 4px;
  margin: 8px 0;
}

.md-body :deep(input[type="checkbox"]) {
  margin-right: 6px;
  accent-color: #39ff14;
}

/* Typing indicator */
.typing-indicator {
  display: flex;
  gap: 6px;
  padding: 12px 16px;
  background: rgba(255, 165, 0, 0.05);
  border: 1px solid rgba(255, 165, 0, 0.1);
  border-radius: 4px;
  border-left: 3px solid #ffa500;
}

.typing-indicator span {
  width: 6px;
  height: 6px;
  border-radius: 0;
  background: #ffa500;
  animation: bounce 1.4s ease-in-out infinite;
}

.typing-indicator span:nth-child(2) { animation-delay: 0.16s; }
.typing-indicator span:nth-child(3) { animation-delay: 0.32s; }

@keyframes bounce {
  0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
  40% { transform: scale(1); opacity: 1; }
}

/* Input Area */
.chat-input-area {
  padding: 16px 24px 24px;
  display: flex;
  gap: 12px;
  align-items: flex-end;
  background: rgba(6, 10, 22, 0.8);
  backdrop-filter: blur(10px);
  border-top: 1px solid rgba(57, 255, 20, 0.08);
  flex-shrink: 0;
}

/* Model Selector */
.model-selector-wrapper {
  flex-shrink: 0;
}

.model-select {
  height: 44px;
  padding: 0 12px;
  background: rgba(57, 255, 20, 0.04);
  border: 1px solid rgba(57, 255, 20, 0.15);
  border-radius: 2px;
  color: rgba(57, 255, 20, 0.7);
  font-size: 0.8rem;
  font-family: 'Courier New', monospace;
  cursor: pointer;
  outline: none;
  transition: all 0.3s;
  appearance: none;
  -webkit-appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2339ff14' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 10px center;
  padding-right: 30px;
}

.model-select:hover {
  border-color: rgba(57, 255, 20, 0.4);
  background-color: rgba(57, 255, 20, 0.08);
}

.model-select:focus {
  border-color: rgba(57, 255, 20, 0.5);
  box-shadow: 0 0 15px rgba(57, 255, 20, 0.08);
}

.model-select option {
  background: #0a1020;
  color: #e0ffe0;
  padding: 8px;
}

.chat-input {
  flex: 1;
  min-height: 44px;
  max-height: 150px;
  padding: 12px 16px;
  background: rgba(57, 255, 20, 0.03);
  border: 1px solid rgba(57, 255, 20, 0.1);
  border-radius: 2px;
  color: #e0ffe0;
  font-size: 0.9rem;
  line-height: 1.5;
  resize: none;
  outline: none;
  transition: all 0.3s;
  font-family: 'Courier New', monospace;
}

.chat-input::placeholder {
  color: rgba(57, 255, 20, 0.2);
}

.chat-input:focus {
  border-color: rgba(57, 255, 20, 0.4);
  box-shadow: 0 0 20px rgba(57, 255, 20, 0.06);
}

.send-btn {
  width: 44px;
  height: 44px;
  border-radius: 2px;
  border: 1px solid rgba(57, 255, 20, 0.3);
  background: rgba(57, 255, 20, 0.08);
  color: #39ff14;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s;
  flex-shrink: 0;
}

.send-btn:hover:not(:disabled) {
  box-shadow: 0 0 25px rgba(57, 255, 20, 0.15);
  background: rgba(57, 255, 20, 0.15);
  border-color: rgba(57, 255, 20, 0.5);
}

.send-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

/* Vision badge */
.vision-badge {
  font-size: 0.75rem;
  margin-left: 4px;
  cursor: help;
}

/* Image upload button */
.image-upload-btn {
  width: 36px;
  height: 36px;
  border-radius: 2px;
  border: 1px solid rgba(57, 255, 20, 0.15);
  background: transparent;
  color: rgba(57, 255, 20, 0.5);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s;
  flex-shrink: 0;
}

.image-upload-btn:hover:not(:disabled) {
  color: #39ff14;
  border-color: rgba(57, 255, 20, 0.4);
  background: rgba(57, 255, 20, 0.08);
}

.image-upload-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

/* Image preview bar */
.image-preview-bar {
  display: flex;
  gap: 8px;
  padding: 8px 12px;
  overflow-x: auto;
  border-bottom: 1px solid rgba(57, 255, 20, 0.08);
}

.image-preview-item {
  position: relative;
  flex-shrink: 0;
}

.image-preview-thumb {
  width: 64px;
  height: 64px;
  object-fit: cover;
  border-radius: 4px;
  border: 1px solid rgba(57, 255, 20, 0.15);
}

.image-remove-btn {
  position: absolute;
  top: -4px;
  right: -4px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: none;
  background: rgba(255, 60, 60, 0.8);
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.image-remove-btn:hover {
  background: rgba(255, 60, 60, 1);
}

/* Message chart */
.message-chart {
  width: 100%;
  max-width: 700px;
  margin-top: 8px;
  border-radius: 12px;
  overflow: hidden;
  background: #1e1e2e;
  padding: 12px;
}

/* Message images */
.message-images {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-top: 8px;
}

.message-image-thumb {
  max-width: 200px;
  max-height: 200px;
  object-fit: contain;
  border-radius: 4px;
  border: 1px solid rgba(57, 255, 20, 0.1);
  cursor: pointer;
  transition: transform 0.2s;
}

.message-image-thumb:hover {
  transform: scale(1.02);
}

/* Delete Modal */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  backdrop-filter: blur(4px);
}

.modal-card {
  background: #0a1020;
  border: 1px solid rgba(57, 255, 20, 0.15);
  border-radius: 4px;
  padding: 28px;
  width: 360px;
  box-shadow: 0 0 60px rgba(57, 255, 20, 0.05);
}

.modal-card h3 {
  font-size: 1.1rem;
  margin-bottom: 12px;
  color: #39ff14;
  font-family: 'Orbitron', sans-serif;
  letter-spacing: 2px;
}

.modal-card p {
  font-size: 0.9rem;
  color: rgba(255, 255, 255, 0.5);
  margin-bottom: 24px;
  line-height: 1.5;
  font-family: 'Courier New', monospace;
}

.modal-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}

.modal-btn {
  padding: 10px 20px;
  border-radius: 2px;
  font-size: 0.85rem;
  cursor: pointer;
  border: none;
  transition: all 0.2s;
  font-family: 'Courier New', monospace;
}

.modal-btn.cancel {
  background: rgba(255, 255, 255, 0.04);
  color: rgba(255, 255, 255, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.modal-btn.cancel:hover {
  background: rgba(255, 255, 255, 0.08);
}

.modal-btn.confirm {
  background: rgba(255, 80, 80, 0.1);
  color: #ff5050;
  border: 1px solid rgba(255, 80, 80, 0.2);
}

.modal-btn.confirm:hover {
  background: rgba(255, 80, 80, 0.2);
  box-shadow: 0 0 15px rgba(255, 80, 80, 0.1);
}

/* Dashboard */
.dashboard-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
}

.dashboard-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid rgba(57, 255, 20, 0.08);
  background: rgba(0, 0, 0, 0.3);
}

.back-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  background: rgba(57, 255, 20, 0.06);
  border: 1px solid rgba(57, 255, 20, 0.15);
  border-radius: 2px;
  color: rgba(57, 255, 20, 0.7);
  font-size: 0.8rem;
  font-family: 'Courier New', monospace;
  cursor: pointer;
  transition: all 0.3s;
}

.back-btn:hover {
  background: rgba(57, 255, 20, 0.12);
  color: #39ff14;
}

.dashboard-title {
  color: rgba(57, 255, 20, 0.6);
  font-size: 0.85rem;
  font-family: 'Courier New', monospace;
}

.dashboard-iframe {
  flex: 1;
  width: 100%;
  border: none;
  background: #f1f5ddc5;
}
</style>
