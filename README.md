# Yuka Send

免费 P2P 点对点文件传输工具。前端纯 HTML + WebRTC，信令服务器 Node.js + ws。

## 特性

- P2P 直传（文件数据不经过服务器）
- 无需登录，打开即用
- 6 位房间码配对
- 桌面端理论无文件大小限制
- 蜂蜜橙主题，和 Yuka QR 统一风格
- 纯前端无编译步骤

## 快速开始（本地开发）

### 1. 启动信令服务器

```bash
cd server
npm install
npm start
# 监听 ws://localhost:3000
```

### 2. 启动前端

```bash
cd public
python -m http.server 8200
# 浏览器打开 http://localhost:8200
```

### 3. 测试

打开两个浏览器标签页，一个选文件生成房间码，另一个输入房间码连接，P2P 直传文件。

## 项目结构

```
yuka-send/
├── server/
│   ├── index.js        # 信令服务器（Node.js + ws）
│   └── package.json
├── public/
│   ├── index.html      # 主页面
│   ├── about.html
│   ├── privacy.html
│   └── contact.html
└── test/
    └── e2e.mjs         # Puppeteer 端到端测试脚本
```

## 技术栈

- **前端**: HTML + TailwindCSS (CDN) + 原生 JavaScript + WebRTC
- **信令**: Node.js 20 + ws
- **STUN**: Google stun:stun.l.google.com:19302
- **部署**: Vercel（前端）+ 阿里云轻量服务器（信令）+ Cloudflare（DNS/CDN）

## 部署

详见 [DEPLOY.md](DEPLOY.md)

## 测试

```bash
cd yuka-send
node test/e2e.mjs
```

## 许可证

MIT
