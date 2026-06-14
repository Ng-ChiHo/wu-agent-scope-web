import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src')
    }
  },
  server: {
    host: '0.0.0.0',
    port: 7133,
    allowedHosts: [
      '.xpeak.top'  // 允许所有 trycloudflare.com 子域名
    ]
  }
})
