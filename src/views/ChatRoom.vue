<script setup>
import { ref, reactive, onMounted, onBeforeUnmount, nextTick, watch, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { getUser, apiLogout } from '@/utils/auth'
import { fetchWithToken, createSseConnection } from '@/utils/fetch'
import { parseLinks } from '@/utils/linkParser'

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
let currentEventSource = null

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

// Load messages for a conversation
async function loadMessages(conversationId) {
  try {
    const res = await fetchWithToken(`/chat/conversation/messages?conversationId=${conversationId}`)
    if (res.code === 0) {
      messages.value = (res.data || []).map(m => ({
        role: m.role,
        content: m.content,
        timestamp: m.timestamp
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
  router.push('/chat')
  focusInput()
}

// Select conversation
function selectConversation(conv) {
  activeConversationId.value = conv.conversationId
  router.push(`/chat/${conv.conversationId}`)
  loadMessages(conv.conversationId)
}

// Send message via SSE
function sendMessage() {
  const text = inputText.value.trim()
  if (!text || isLoading.value) return

  const chatId = activeConversationId.value || generateChatId()
  if (!activeConversationId.value) {
    activeConversationId.value = chatId
    router.push(`/chat/${chatId}`)
  }

  // Add user message
  messages.value.push({
    role: 'user',
    content: text,
    timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19)
  })
  inputText.value = ''
  resetTextareaHeight()
  scrollToBottom()

  // Add AI placeholder
  const aiMsgIndex = messages.value.length
  messages.value.push({
    role: 'assistant',
    content: '',
    timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19)
  })

  isLoading.value = true
  let fullResponse = ''

  const encodedMsg = encodeURIComponent(text)
  const url = `/ai/chat/common/sse?message=${encodedMsg}&chatId=${encodeURIComponent(chatId)}`

  currentEventSource = createSseConnection(url)

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
  await loadConversations()
  const chatId = route.params.chatId
  if (chatId) {
    activeConversationId.value = chatId
    await loadMessages(chatId)
  }
})

onBeforeUnmount(() => {
  if (currentEventSource) {
    currentEventSource.close()
    currentEventSource = null
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
          Jaeger 链路追踪
        </a>
      </div>

      <div class="conversation-list">
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
      <header class="chat-header">
        <div class="header-left">
          <h2 class="chat-title">AGENT SCOPE 2.0</h2>
          <span class="chat-id" v-if="activeConversationId">{{ activeConversationId }}</span>
        </div>
        <div class="header-right">
          <span class="status-dot"></span>
          <span class="status-text">在线</span>
        </div>
      </header>

      <div class="chat-messages" ref="chatMessagesRef">
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
            <div class="message-bubble" v-html="parseLinks(msg.content)"></div>
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
        <textarea
          ref="inputRef"
          v-model="inputText"
          class="chat-input"
          placeholder="请输入你的聊天内容... (Enter 发送, Shift+Enter 换行)"
          @input="autoResize"
          @keydown="handleKeydown"
          :disabled="isLoading"
          rows="1"
        ></textarea>
        <button
          class="send-btn"
          @click="sendMessage"
          :disabled="!inputText.trim() || isLoading"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </div>
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
</style>
