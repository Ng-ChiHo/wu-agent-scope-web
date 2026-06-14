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

export function createSseConnection(url) {
  const token = getToken()
  const separator = url.includes('?') ? '&' : '?'
  const fullUrl = `${BASE_URL}${url}${separator}token=${encodeURIComponent(token)}`
  return new EventSource(fullUrl)
}
