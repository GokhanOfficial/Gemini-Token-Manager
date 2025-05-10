# Gemini Token Manager

<div align="center">

<img src="logo.svg" alt="Gemini Token Manager Logo" width="180" height="180" />

![Version](https://img.shields.io/badge/version-1.1.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Docker](https://img.shields.io/badge/docker-支持-brightgreen)
![NodeJS](https://img.shields.io/badge/nodejs-16%2B-orange)

**一个用于管理 Gemini API 令牌的负载均衡服务，支持 Docker 部署和数据持久化**  
**本项目基于[Siliconflow-API-Management](https://github.com/Dr-Ai-0018/Siliconflow-API-Management)的 UI 进行二次开发**  
[English](./README_EN.md) | 简体中文

</div>

## 📋 目录

-   [功能特点](#-功能特点)
-   [系统要求](#-系统要求)
-   [快速开始](#-快速开始)
-   [项目结构](#-项目结构)
-   [配置选项](#-配置选项)
-   [常用命令](#-常用命令)
-   [开发指南](#-开发指南)
-   [故障排除](#-故障排除)
-   [贡献指南](#-贡献指南)
-   [许可证](#-许可证)
-   [联系方式](#-联系方式)

## ✨ 功能特点

-   🔄 自动初始化数据文件
-   💾 数据持久化存储
-   🐳 Docker 容器化部署
-   🔌 RESTful API 接口
-   ⚙️ 支持环境变量配置
-   🚀 增强的代理功能（新增）
    - 支持 Google GenAI API 代理
    - 支持 OpenAI API 代理
    - 支持流式响应 (SSE) 处理
    - 详细请求和响应日志记录
-   🔍 环境代理测试工具（新增）
    - 自动测试代理服务连接性
    - 支持 Google GenAI 和 OpenAI API 调用测试
    - 提供详细错误诊断
-   🔑 批量密钥管理功能
    - 支持批量添加、删除、检测密钥
    - 支持导出选中密钥
    - 智能检测无效密钥
-   📊 增强的管理界面
    - 优化的密钥管理页面
    - 分页控制功能
    - 直观的批量操作工具栏
-   🔍 完善的日志系统
    - 详细的代理服务日志
    - 增强的错误处理机制
-   📝 丰富的示例代码
    - Python 调用示例
    - 支持 Google GenAI 和 OpenAI API 的代码示例
    - 一键复制功能

## 📌 系统要求

-   Docker
-   Docker Compose
-   Node.js 16+ (仅开发环境需要)

## 🚀 快速开始

### 使用 Docker Compose（推荐）

1. 克隆项目

```bash
git clone https://github.com/zqq-nuli/Gemini-Token-Manager.git
cd gemini-token-manager
```

2. 启动服务

```bash
docker compose up -d
```

服务将在 http://localhost:7001 启动

<details>
<summary>不使用Docker的安装方法</summary>

1. 克隆项目并安装依赖

```bash
git clone https://github.com/zqq-nuli/Gemini-Token-Manager.git
cd gemini-token-manager
npm install
```

2. 启动开发服务器

```bash
npm run dev
```

</details>

## 📂 项目结构

```
.
├── Dockerfile          # Docker构建文件
├── docker-compose.yml  # Docker Compose配置文件
├── package.json        # 项目依赖配置
├── init.js             # 初始化脚本
├── data/               # 数据存储目录（自动创建）
└── src/                # 源代码目录
```

## ⚙️ 配置选项

### PM2 配置

项目使用 PM2 进行进程管理，配置文件位于 `ecosystem.config.js`。主要配置项包括：

| 配置项 | 描述 | 默认值 |
|--------|------|--------|
| `instances` | 实例数量 | `max`（生产环境）/ `2`（Docker环境） |
| `exec_mode` | 执行模式 | `cluster` |
| `max_memory_restart` | 内存限制 | `300M`（生产环境）/ `150M`（Docker环境） |

### 数据持久化

数据文件默认存储在项目根目录的 `data` 文件夹中。该目录会被自动映射到 Docker 容器内的 `/app/data` 目录。

### 环境变量

可以通过修改 `docker-compose.yml` 文件来配置以下环境变量：

| 变量名       | 描述                   | 默认值       |
| ------------ | ---------------------- | ------------ |
| `NODE_ENV`   | 运行环境               | `production` |
| `FORCE_INIT` | 是否强制重新初始化数据 | `false`      |

## 🛠 常用命令

### PM2 进程管理

```bash
# 使用 PM2 启动服务
npm run pm2

# Docker 环境中使用 PM2 启动服务
npm run pm2:docker

# 停止服务
npm run pm2:stop

# 重启服务
npm run pm2:restart

# 重新加载服务
npm run pm2:reload

# 删除服务
npm run pm2:delete

# 查看日志
npm run pm2:logs
```

### 服务管理

```bash
# 启动服务
docker compose up -d

# 查看日志
docker compose logs -f

# 停止服务
docker compose down

# 重启服务
docker compose restart

# 重新构建并启动
docker compose up -d --build
```

### 数据管理

```bash
# 强制重新初始化数据
# 方法1：删除初始化标记文件
rm ./data/.initialized
docker compose restart

# 方法2：使用环境变量
FORCE_INIT=true docker compose up -d
```

## 💻 开发指南

### 本地开发

1. 安装依赖

```bash
npm install
```

2. 选择以下任一方式运行服务：

```bash
# 开发模式
npm run dev

# 使用 PM2 运行（生产环境）
npm run pm2

# Docker 环境中使用 PM2
npm run pm2:docker
```

### 构建生产版本

```bash
npm run build
```

## ❓ 故障排除

<details>
<summary>常见问题及解决方案</summary>

1. 如果容器无法启动，检查：

    - 端口 7001 是否被占用
    - data 目录权限是否正确
    - Docker 服务是否正常运行

2. 如果数据初始化失败：
    - 检查日志 `docker compose logs -f` 或 `npm run pm2:logs`
    - 确保 data 目录可写
    - 尝试使用 `FORCE_INIT=true` 重新初始化

3. PM2 相关问题：
    - 检查 PM2 日志：`npm run pm2:logs`
    - 内存超限重启：检查 `max_memory_restart` 配置
    - 集群模式问题：确认 `instances` 配置是否合适
4. 默认账号与密码
    - 默认账号密码在项目目录 `/data/config.json` 中
</details>

## 🤝 贡献指南

欢迎任何形式的贡献！

1. Fork 项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建 Pull Request

查看 [贡献指南](./CONTRIBUTING.md) 获取更多详细信息。

## 📜 许可证

该项目采用 [MIT 许可证](./LICENSE) 进行授权。

## 📮 联系方式

项目维护者: [Benjamin](niuma@chatbot.cab)

GitHub: [@Benjamin](https://github.com/zqq-nuli)

---

<div align="center">

**如果您觉得这个项目有用，请给它一个 ⭐️**

</div>
