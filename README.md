# Wu Agent Scope Web

基于 Vue 3 + Vite 构建的 Agent 聊天应用前端项目。

## 技术栈

- **Vue 3** - 渐进式 JavaScript 框架
- **Vite 5** - 下一代前端构建工具
- **Vue Router 4** - Vue.js 官方路由
- **Axios** - HTTP 请求库

## 环境要求

- Node.js 18.x 或更高版本
- npm 或 yarn

## 快速开始

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run dev
```

访问 http://localhost:7133

### 生产构建

```bash
npm run build
```

### 预览构建结果

```bash
npm run preview
```

## 项目结构

```
src/
├── main.js          # 应用入口
├── App.vue          # 根组件
├── router/          # 路由配置
│   └── index.js
├── utils/           # 工具函数
│   ├── auth.js      # 认证相关
│   ├── axios.js     # Axios 实例配置
│   ├── fetch.js     # Fetch 封装
│   └── linkParser.js
└── views/           # 页面组件
    ├── Login.vue    # 登录页
    └── ChatRoom.vue # 聊天室
```

## API 配置

API 基础地址配置在 `src/utils/axios.js` 和 `src/utils/fetch.js` 中：

```javascript
const BASE_URL = 'https://xxx.xpeak.top/api'
```

## 功能特性

- 用户登录/注册/登出
- Token 认证
- SSE 实时消息推送
- 聊天室界面