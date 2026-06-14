import axios from 'axios'
import { getToken, clearAuth } from './auth'

const instance = axios.create({
  baseURL: 'https://agentapi.xpeak.top/api',
  timeout: 300000,
  headers: {
    'Content-Type': 'application/json'
  }
})

instance.interceptors.request.use(
  (config) => {
    const token = getToken()
    if (token) {
      config.params = { ...config.params, token }
    }
    return config
  },
  (error) => Promise.reject(error)
)

instance.interceptors.response.use(
  (response) => {
    const data = response.data
    if (data.code === 40012) {
      clearAuth()
      window.location.href = '/login'
      return Promise.reject(new Error(data.message))
    }
    return data
  },
  (error) => {
    if (error.response?.status === 401) {
      clearAuth()
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default instance
