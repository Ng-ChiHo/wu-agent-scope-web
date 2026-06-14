import axios from './axios'

const TOKEN_KEY = 'token'
const USER_KEY = 'user'

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function getUser() {
  const raw = localStorage.getItem(USER_KEY)
  return raw ? JSON.parse(raw) : null
}

export function isLoggedIn() {
  return !!(getToken() && getUser())
}

export function setAuth(loginResponse) {
  localStorage.setItem(TOKEN_KEY, loginResponse.token)
  localStorage.setItem(USER_KEY, JSON.stringify({
    userId: loginResponse.userId,
    username: loginResponse.username,
    nickname: loginResponse.nickname
  }))
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

export async function apiLogin(username, password) {
  const res = await axios.post('/user/login', { username, password })
  if (res.code === 0) {
    setAuth(res.data)
  }
  return res
}

export async function apiRegister(username, password, nickname) {
  const res = await axios.post('/user/register', null, {
    params: { username, password, nickname }
  })
  return res
}

export async function apiLogout() {
  const token = getToken()
  try {
    await axios.post('/user/logout', null, { params: { token } })
  } finally {
    clearAuth()
  }
}
