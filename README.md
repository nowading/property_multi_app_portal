# Property Multi-App Portal

## 项目简介

Property Multi-App Portal 是一个统一的 Next.js 多应用门户，集成了两个独立的房地产微应用：**房产估价器（Property Value Estimator）** 和 **房产市场分析（Property Market Analysis）**。两个应用各自拥有独立的后端服务（FastAPI 与 Spring Boot），均通过 REST API 与共享的 ML 回归模型容器通信，为用户提供单批量价格预测、历史查询、市场仪表盘、假设分析（What-If）与数据导出等完整功能。

## 架构图

```
┌──────────────────────────────────────────────────────────────────┐
│             Next.js Web Portal (:3000)                           │
│        Shared Shell · Navigation · Design System                 │
└──────────────┬───────────────────────────────┬───────────────────┘
               │                               │
    (App 1)    │                               │  (App 2)
               ▼                               ▼
┌─────────────────────────────┐    ┌──────────────────────────────┐
│  FastAPI Estimator API       │    │  Spring Boot Analytics API   │
│  Python 3.12 · Pydantic v2   │    │  Java 21 · Caffeine          │
│  httpx (async) · :8001      │    │  Resilience4j · :8002        │
└──────────────┬──────────────┘    └──────────────┬───────────────┘
               │                                  │
               │         REST (Connect=2s, Read=5s)│
               └──────────────┬───────────────────┘
                              ▼
                 ┌────────────────────────────┐
                 │  ML Model Container        │
                 │  FastAPI · scikit-learn    │
                 │  House Price Regression    │
                 │  (:8000)                   │
                 └────────────────────────────┘
```

## 技术栈

| 服务 | 技术 |
|------|------|
| **Web Portal** | Next.js 16 (App Router) · TypeScript 5 · Tailwind CSS 4 · React 19 · Lucide · Recharts · Jest + RTL |
| **Estimator API** | Python 3.12+ · FastAPI · Pydantic v2 · httpx (async) · pytest + pytest-asyncio |
| **Analytics API** | Java 21 · Spring Boot 3.4.4 · Caffeine · Resilience4j · JUnit 5 + MockMvc |
| **ML Container** | FastAPI · scikit-learn · 线性回归模型 |

## 目录结构

```
property_multi_app_portal/
├── README.md                      # 项目文档
├── PROJECT_PLAN.md                # 分阶段执行计划
├── docker-compose.yml             # 4 服务编排
├── .env.example                   # 环境变量模板
├── scripts/
│   └── smoke.ps1                  # 烟雾测试脚本
├── apps/
│   ├── web/                       # Next.js 统一门户 (:3000)
│   │   ├── src/app/               # App Router 路由
│   │   ├── src/components/        # 共享 UI 组件
│   │   ├── src/lib/               # API 客户端 · 工具库
│   │   └── src/hooks/             # 自定义 React Hooks
│   ├── estimator-api/             # FastAPI 估价器后端 (:8001)
│   │   ├── app/domain/            # 领域模型 · 端口接口
│   │   ├── app/application/       # 用例编排
│   │   ├── app/adapters/          # Web/ML/持久化适配器
│   │   └── tests/                 # pytest 测试
│   └── analytics-api/             # Spring Boot 分析后端 (:8002)
│       ├── src/main/java/.../domain/      # 领域模型 · 端口接口
│       ├── src/main/java/.../application/ # 服务层
│       ├── src/main/java/.../adapters/    # Web/ML/持久化适配器
│       └── src/test/java/.../             # JUnit 5 + MockMvc 测试
└── packages/
    └── shared-types/              # 共享 TS 类型（可选）
```

## 快速开始 — 本地开发模式

### 前置依赖

| 工具 | 版本要求 |
|------|----------|
| Node.js | **22 LTS**（不可用 v25+，Next.js 16 native bindings 与 ABI 141 不兼容） |
| Python | 3.12+ |
| JDK | 21 |
| Maven | 3.9+（Spring Boot 内置 `mvnw` 可替代） |
| Docker | 27+ |
| Docker Compose | 2+ |

> **注意**：ML 容器依赖外部仓库 `house_price_prediction`，需与本项目同级目录。
>
> **Node 版本切换**（Windows PowerShell）：
> ```powershell
> $env:PATH = "D:\DevEnv\node-v22.23.2-win-x64;" + $env:PATH
> node --version  # 应输出 v22.x.x
> ```

### 步骤一：启动 ML 容器

```bash
# 构建并启动 ML 容器（从 house_price_prediction 仓库）
cd ../house_price_prediction
docker build -t house-price-api .
docker run -d --name house-price-ml -p 8000:8000 house-price-api
```

### 步骤二：启动 Estimator API（FastAPI）

```bash
cd apps/estimator-api
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8001
```

### 步骤三：启动 Analytics API（Spring Boot）

```bash
cd apps/analytics-api
./mvnw spring-boot:run        # Linux / macOS
# 或
.\mvnw.cmd spring-boot:run    # Windows
```

### 步骤四：启动 Web Portal（Next.js）

```bash
cd apps/web
npm install
npm run dev
```

访问 [http://localhost:3000](http://localhost:3000) 打开门户页面。

## Docker Compose 部署（推荐）

一键编排全部 4 个服务（ml-container → estimator-api / analytics-api → web），包含健康检查与依赖等待。

### 首次启动（构建镜像 + 启动）

```bash
# 构建所有镜像并后台启动（ml-container 首次构建需训练模型，约 1-2 分钟）
docker compose up -d --build
```

### 日常操作

```bash
# 用已有镜像启动（不重新构建）
docker compose up -d --no-build

# 查看服务状态（等待所有容器变为 healthy）
docker compose ps

# 查看所有服务实时日志
docker compose logs -f

# 查看单个服务日志
docker compose logs -f web
docker compose logs -f estimator-api
docker compose logs -f analytics-api
docker compose logs -f ml-container

# 停止并移除容器（保留镜像）
docker compose down

# 停止并移除容器 + 删除镜像（完全清理）
docker compose down --rmi all
```

### 重建单个服务

当某个服务的代码或 Dockerfile 变更后，只需重建该服务：

```bash
# 重建 web 前端（例如修改了 Next.js 代码或 build args）
docker compose up -d --build web

# 重建 estimator-api（例如修改了 FastAPI 代码）
docker compose up -d --build estimator-api

# 重建 analytics-api（例如修改了 Spring Boot 代码）
docker compose up -d --build analytics-api

# 重建 ml-container（例如修改了 ML 模型代码）
docker compose up -d --build ml-container
```

### 容器内调试

```bash
# 进入容器 shell
docker compose exec web sh
docker compose exec estimator-api bash
docker compose exec analytics-api sh

# 测试容器间网络连通性（Docker 内部网络）
docker compose exec web wget -qO- http://estimator-api:8001/healthz
docker compose exec web wget -qO- http://analytics-api:8002/actuator/health
docker compose exec estimator-api curl -s http://ml-container:8000/health
```

### 启动顺序与健康检查

docker-compose.yml 定义了依赖链与健康检查门槛：

```
ml-container (healthy) ──► estimator-api (healthy) ──► web
                      └──► analytics-api (healthy) ──┘
```

- `ml-container` 启动后需通过 `/health` 检查（start_period: 60s）
- `estimator-api` / `analytics-api` 等待 ML 容器 healthy 后才启动
- `web` 等待两个后端 healthy 后才启动

### 验证服务可用性

启动后执行以下命令一键验证所有端点：

```powershell
# ML 容器健康
curl http://localhost:8000/health
# 期望: {"status":"healthy","model_loaded":true}

# Estimator API 健康（含 ML 下游状态）
curl http://localhost:8001/healthz
# 期望: {"success":true,"data":{"status":"healthy","ml_healthy":true,...}}

# Analytics API 健康（Spring Actuator）
curl http://localhost:8002/actuator/health
# 期望: {"status":"UP","components":{"mlService":{"status":"UP"},...}}

# Web Portal 首页
curl -o /dev/null -s -w "%{http_code}" http://localhost:3000/
# 期望: 200

# Web 代理 → Estimator API
curl http://localhost:3000/api/estimator/healthz
# 期望: {"success":true,"data":{"status":"healthy",...}}

# Web 代理 → Analytics API
curl http://localhost:3000/api/analytics/actuator/health
# 期望: {"status":"UP",...}

# 端到端预测（Estimator → ML）
curl -X POST http://localhost:8001/predict `
  -H "Content-Type: application/json" `
  -d '{"features":{"square_footage":2000,"bedrooms":3,"bathrooms":2,"year_built":2010,"lot_size":5000,"distance_to_city_center":10,"school_rating":8}}'
# 期望: {"success":true,"data":{"predicted_price":258775.97,...}}

# 聚合市场统计（Analytics 内部数据集）
curl http://localhost:8002/api/stats
# 期望: {"success":true,"data":{"kpis":{"count":50,"avg_price":304760.0,...}}}
```

## 环境变量表

将 `.env.example` 复制为 `.env` 并根据环境调整：

| 变量 | 服务 | 用途 | 默认值 |
|------|------|------|--------|
| `NEXT_PUBLIC_ESTIMATOR_API_URL` | Web Portal | 客户端访问 Estimator API 地址 | `http://localhost:8001` |
| `NEXT_PUBLIC_ANALYTICS_API_URL` | Web Portal | 客户端访问 Analytics API 地址 | `http://localhost:8002` |
| `ESTIMATOR_API_URL` | Web Portal | 服务端访问 Estimator API 地址 | `http://localhost:8001` |
| `ANALYTICS_API_URL` | Web Portal | 服务端访问 Analytics API 地址 | `http://localhost:8002` |
| `ML_SERVICE_URL` | Estimator API | ML 容器地址 | `http://localhost:8000` |
| `ESTIMATOR_API_HOST` | Estimator API | 监听地址 | `0.0.0.0` |
| `ESTIMATOR_API_PORT` | Estimator API | 监听端口 | `8001` |
| `LOG_LEVEL` | Estimator / Analytics | 日志级别（DEBUG/INFO/WARNING/ERROR） | `INFO` |
| `ML_SERVICE_URL` | Analytics API | ML 容器地址（Spring Boot） | `http://localhost:8000` |
| `SERVER_PORT` | Analytics API | 服务端口 | `8002` |
| `JAVA_OPTS` | Analytics API | JVM 参数 | `-Xms256m -Xmx512m` |
| `ML_CONTAINER_PORT` | ML Container | ML 容器端口 | `8000` |
| `WEB_PORT` | Web Portal | 门户端口 | `3000` |
| `ESTIMATOR_API_PORT` | Estimator API | API 端口（Docker 映射） | `8001` |
| `ANALYTICS_API_PORT` | Analytics API | API 端口（Docker 映射） | `8002` |

## 端口映射表

| 端口 | 服务 | 说明 |
|------|------|------|
| `3000` | Next.js Web Portal | 统一前端门户 |
| `8001` | FastAPI Estimator API | 房产估价器后端 |
| `8002` | Spring Boot Analytics API | 房产市场分析后端 |
| `8000` | ML Container | 房屋价格回归模型服务 |

## API 端点列表

### Estimator API（FastAPI，端口 8001）

| 方法 | 端点 | 说明 | 缓存 |
|------|------|------|------|
| `GET` | `/healthz` | 健康检查（含 ML 下游状态） | — |
| `POST` | `/predict` | 单条房产价格预测 | `no-store` |
| `POST` | `/predict/batch` | 批量房产价格预测 | `no-store` |
| `GET` | `/model-info` | 获取 ML 模型元数据 | `max-age=60, stale-while-revalidate=300` |
| `GET` | `/history` | 获取预测历史列表 | `no-store` |
| `GET` | `/history/{entry_id}` | 获取单条历史记录 | `no-store` |
| `DELETE` | `/history/{entry_id}` | 删除单条历史记录 | `no-store` |
| `DELETE` | `/history` | 清空所有历史记录 | `no-store` |

### Analytics API（Spring Boot，端口 8002）

| 方法 | 端点 | 说明 | 缓存 |
|------|------|------|------|
| `GET` | `/actuator/health` | Spring Actuator 健康检查 | — |
| `GET` | `/api/stats` | 聚合市场统计（支持筛选参数） | Caffeine · 10min TTL |
| `POST` | `/api/stats` | 聚合市场统计（JSON Body 筛选） | Caffeine · 10min TTL |
| `GET` | `/api/dataset` | 分页数据集查询（`page`, `page_size`） | — |
| `GET` | `/api/model/info` | ML 模型元数据 | Caffeine · 60s TTL |
| `DELETE` | `/api/model/cache` | 清除模型信息缓存 | — |
| `POST` | `/api/what-if` | 假设分析（自定义基准） | Caffeine · 60s TTL |
| `POST` | `/api/what-if/analyze-default` | 假设分析（默认基准） | Caffeine · 60s TTL |
| `GET` | `/api/export/stats/csv` | 市场统计 CSV 导出 | — |

### ML Container（端口 8000）

| 方法 | 端点 | 说明 |
|------|------|------|
| `GET` | `/health` | ML 容器健康检查 |
| `POST` | `/predict` | 单条预测 |
| `POST` | `/predict/batch` | 批量预测 |
| `GET` | `/model-info` | 模型元数据 |

## 烟雾测试

使用 PowerShell 脚本一键验证所有服务端到端可用性：

```powershell
# 确保所有服务已启动后执行
.\scripts\smoke.ps1

# 自定义 BaseUrl 或超时
.\scripts\smoke.ps1 -BaseUrl "http://localhost" -TimeoutSec 15
```

脚本自动测试以下场景：

1. **服务健康检查** — Estimator API / Analytics API / Web Portal
2. **单条预测** — `POST /predict`
3. **历史查询** — `GET /history`
4. **市场统计** — `GET /api/stats`
5. **分页数据集** — `GET /api/dataset?page=1&page_size=10`
6. **假设分析** — `POST /api/what-if`

所有测试通过则退出码为 `0`，否则为 `1`。

## 演示流程

### 准备工作

```bash
# 确保 ML 容器运行
curl http://localhost:8000/health
# 应返回 {"status": "healthy", ...}

# 启动所有服务
docker compose up -d --build
```

### 演示步骤

**Step 1：访问门户首页**
- 打开 [http://localhost:3000](http://localhost:3000)
- 查看门户概览与服务状态卡片

**Step 2：房产估价器 — 单条预测**
- 导航至 `/estimator`
- 填写 7 个特征字段（建筑面积、卧室、浴室、建造年份、地块大小、距市中心距离、学区评分）
- 提交并查看预测价格与特征贡献图表

**Step 3：房产估价器 — 历史与对比**
- 导航至 `/estimator/history` 查看历史记录
- 导航至 `/estimator/compare` 选择 2–4 条记录进行对比

**Step 4：市场分析仪表盘**
- 导航至 `/analytics`
- 查看 KPI 卡片（均价、中位数、最高/最低价）
- 与筛选器交互（卧室数、建造年份、距离、学区评分）
- 查看价格直方图、散点图与箱线图

**Step 5：假设分析**
- 导航至 `/analytics/what-if`
- 拖动滑块调整特征值，实时查看预测价格变化

**Step 6：数据导出**
- 在仪表盘使用「导出」功能，下载 CSV 格式的市场统计报告

**Step 7：运行烟雾测试**
```powershell
.\scripts\smoke.ps1
```

## 故障排除

| 问题 | 解决方案 |
|------|----------|
| ML 容器连接超时（`ML_SERVICE_TIMEOUT`） | 确认 `house_price_prediction` 容器已启动且端口 8000 可达。Docker 环境下检查网络连接：`docker compose exec estimator-api curl http://ml-container:8000/health` |
| Estimator API 返回 `degraded` 状态 | 表示 API 自身正常但 ML 下游不可用，检查 ML 容器健康情况 |
| Spring Boot 启动失败（端口冲突） | 修改 `.env` 中 `ANALYTICS_API_PORT` 或 `SERVER_PORT`，确保端口 8002 未被占用 |
| Next.js 页面空白或 API 调用失败 | 确认 `.env` 中 `NEXT_PUBLIC_*` 变量指向正确端口。开发模式默认 `localhost`，Docker 模式使用容器名 |
| Maven 依赖下载失败 | 检查网络连接，必要时在 `mvnw` 中配置代理或使用本地 Maven 仓库缓存 |
| Docker Compose 健康检查失败 | 首次启动 ML 容器需要较长加载时间，`docker-compose.yml` 已配置 60s `start_period`。可手动检查：`docker compose logs ml-container` |
| `house_price_prediction` 目录不存在 | ML 容器需从同级目录 `../house_price_prediction` 构建，确保该仓库已克隆 |
| Python 版本不兼容 | Estimator API 要求 Python ≥ 3.12，可通过 `python --version` 验证 |
| JDK 版本不兼容 | Analytics API 要求 JDK 21，可通过 `java -version` 验证 |
| Docker Desktop 内存不足 | Spring Boot + JVM 至少需要 1GB，建议分配 2GB+ 内存给 Docker |

---

## License

MIT