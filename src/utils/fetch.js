import { getToken, clearAuth } from './auth'

const BASE_URL = 'https://agentapi.xpeak.top/api'

export async function fetchWithToken(url, options = {}) {
  const token = getToken()
  const separator = url.includes('?') ? '&' : '?'
  const fullUrl = `${BASE_URL}${url}${separator}token=${encodeURIComponent(token)}`

  const response = await fetch(fullUrl, {
    method: options.method || 'GET',
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    }
  })

  const data = await response.json()
  if (data.code === 40012) {
    clearAuth()
    window.location.href = '/login'
    throw new Error(data.message)
  }
  return data
}

export function createSseConnection(url, extraParams = {}) {
  const token = getToken()
  const separator = url.includes('?') ? '&' : '?'
  let fullUrl = `${BASE_URL}${url}${separator}token=${encodeURIComponent(token)}`
  for (const [key, value] of Object.entries(extraParams)) {
    if (value != null && value !== '') {
      fullUrl += `&${encodeURIComponent(key)}=${encodeURIComponent(value)}`
    }
  }
  return new EventSource(fullUrl)
}

/**
 * POST 方式 SSE 流式请求（支持多模态：文本 + 图片）
 *
 * @param {string} url - API 路径（不含 BASE_URL）
 * @param {object} body - 请求体（message, chatId, modelId, imageUrls, images）
 * @param {function} onMessage - 收到文本增量时的回调 (data: string) => void
 * @param {function} onClose - 流结束时的回调 () => void
 * @param {function} onError - 错误回调 (err: Error) => void
 * @returns {{ abort: () => void }} 控制器，可调用 abort() 中断请求
 */
export function fetchSsePost(url, body, onMessage, onClose, onError) {
  const token = getToken()
  const fullUrl = `${BASE_URL}${url}`
  const controller = new AbortController()

  fetch(fullUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, token }),
    signal: controller.signal
  })
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || '' // 保留未完成的行

        for (const line of lines) {
          const trimmed = line.trim()
          if (trimmed.startsWith('data:')) {
            const data = trimmed.substring(5).trim()
            if (data) {
              onMessage(data)
            }
          }
        }
      }

      // 处理 buffer 中剩余数据
      if (buffer.trim().startsWith('data:')) {
        const data = buffer.trim().substring(5).trim()
        if (data) onMessage(data)
      }

      onClose()
    })
    .catch((err) => {
      if (err.name === 'AbortError') return
      onError(err)
    })

  return { abort: () => controller.abort() }
}
