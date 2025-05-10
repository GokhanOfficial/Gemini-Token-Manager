# Gemini Token Manager

<div align="center">

<img src="logo.svg" alt="Gemini Token Manager Logo" width="180" height="180" />

![Version](https://img.shields.io/badge/version-1.1.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Docker](https://img.shields.io/badge/docker-supported-brightgreen)
![NodeJS](https://img.shields.io/badge/nodejs-16%2B-orange)

**A load balancing service for managing Gemini API tokens, supporting Docker deployment and data persistence**  
**This project is based on the UI of [Siliconflow-API-Management](https://github.com/Dr-Ai-0018/Siliconflow-API-Management)**  
English | [简体中文](./README.md)

</div>

## 📋 Table of Contents

-   [Features](#-features)
-   [Requirements](#-requirements)
-   [Quick Start](#-quick-start)
-   [Project Structure](#-project-structure)
-   [Configuration](#-configuration)
-   [Common Commands](#-common-commands)
-   [Development Guide](#-development-guide)
-   [Troubleshooting](#-troubleshooting)
-   [Contributing](#-contributing)
-   [License](#-license)
-   [Contact](#-contact)

## ✨ Features

-   🔄 Automatic data file initialization
-   💾 Data persistence storage
-   🐳 Docker containerized deployment
-   🔌 RESTful API interface
-   ⚙️ Environment variable configuration
-   🚀 Enhanced Proxy Features (New)
    - Support for Google GenAI API proxy
    - Support for OpenAI API proxy
    - Stream response (SSE) handling
    - Detailed request and response logging
-   🔍 Environment Proxy Testing Tool (New)
    - Automatic proxy service connectivity testing
    - Support for Google GenAI and OpenAI API call testing
    - Detailed error diagnostics
-   🔑 Batch Key Management
    - Support batch add, delete, and check keys
    - Support exporting selected keys
    - Smart invalid key detection
-   📊 Enhanced Management Interface
    - Optimized key management page
    - Pagination control
    - Intuitive batch operation toolbar
-   🔍 Comprehensive Logging System
    - Detailed proxy service logs
    - Enhanced error handling
-   📝 Rich Example Code
    - Python usage examples
    - Code examples for both Google GenAI and OpenAI API
    - One-click copy functionality

## 📌 Requirements

-   Docker
-   Docker Compose
-   Node.js 16+ (development environment only)

## 🚀 Quick Start

### Using Docker Compose (Recommended)

1. Clone the project

```bash
git clone https://github.com/zqq-nuli/Gemini-Token-Manager.git
cd gemini-token-manager
```

2. Start the service

```bash
docker compose up -d
```

The service will start at http://localhost:7001

<details>
<summary>Installation without Docker</summary>

1. Clone the project and install dependencies

```bash
git clone https://github.com/zqq-nuli/Gemini-Token-Manager.git
cd gemini-token-manager
npm install
```

2. Start the development server

```bash
npm run dev
```

</details>

## 📂 Project Structure

```
.
├── Dockerfile          # Docker build file
├── docker-compose.yml  # Docker Compose configuration
├── package.json        # Project dependencies
├── init.js            # Initialization script
├── data/              # Data storage directory (auto-created)
└── src/               # Source code directory
```

## ⚙️ Configuration

### PM2 Configuration

The project uses PM2 for process management, configured in `ecosystem.config.js`. Main configuration items include:

| Config Item | Description | Default Value |
|------------|-------------|---------------|
| `instances` | Number of instances | `max` (production) / `2` (Docker) |
| `exec_mode` | Execution mode | `cluster` |
| `max_memory_restart` | Memory limit | `300M` (production) / `150M` (Docker) |

### Data Persistence

Data files are stored by default in the `data` folder in the project root directory. This directory is automatically mapped to `/app/data` in the Docker container.

### Environment Variables

The following environment variables can be configured by modifying the `docker-compose.yml` file:

| Variable Name | Description | Default Value |
|--------------|-------------|---------------|
| `NODE_ENV` | Running environment | `production` |
| `FORCE_INIT` | Force data reinitialization | `false` |

## 🛠 Common Commands

### PM2 Process Management

```bash
# Start service with PM2
npm run pm2

# Start service with PM2 in Docker environment
npm run pm2:docker

# Stop service
npm run pm2:stop

# Restart service
npm run pm2:restart

# Reload service
npm run pm2:reload

# Delete service
npm run pm2:delete

# View logs
npm run pm2:logs
```

### Service Management

```bash
# Start service
docker compose up -d

# View logs
docker compose logs -f

# Stop service
docker compose down

# Restart service
docker compose restart

# Rebuild and start
docker compose up -d --build
```

### Data Management

```bash
# Force data reinitialization
# Method 1: Delete initialization flag file
rm ./data/.initialized
docker compose restart

# Method 2: Use environment variable
FORCE_INIT=true docker compose up -d
```

## 💻 Development Guide

### Local Development

1. Install dependencies

```bash
npm install
```

2. Choose one of the following methods to run the service:

```bash
# Development mode
npm run dev

# Run with PM2 (production environment)
npm run pm2

# Run with PM2 in Docker environment
npm run pm2:docker
```

### Build for Production

```bash
npm run build
```

## ❓ Troubleshooting

<details>
<summary>Common Issues and Solutions</summary>

1. If the container fails to start, check:

    - If port 7001 is already in use
    - If the data directory has correct permissions
    - If the Docker service is running properly

2. If data initialization fails:
    - Check logs with `docker compose logs -f` or `npm run pm2:logs`
    - Make sure the data directory is writable
    - Try using `FORCE_INIT=true` to reinitialize

3. PM2 related issues:
    - Check PM2 logs: `npm run pm2:logs`
    - Memory limit restart: Check the `max_memory_restart` configuration
    - Cluster mode issues: Make sure the `instances` configuration is appropriate
<!-- 4. 默认账号与密码
    - 默认账号密码在项目目录 `/data/config.json` 中 -->
4. Default Account and Password
    - The default account and password are located in the project directory /data/config.json
</details>

## 🤝 Contributing

Contributions of any kind are welcome!

1. Fork the project
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

See the [Contributing Guide](./CONTRIBUTING.md) for more details.

## 📜 License

This project is licensed under the [MIT License](./LICENSE).

## 📮 Contact

If you have any questions or suggestions, please feel free to open an issue. 

Project Maintainer: [Benjamin](niuma@chatbot.cab)

GitHub: [@Benjamin](https://github.com/zqq-nuli)

---

<div align="center">

**If you find this project useful, please give it a ⭐️**

</div> 