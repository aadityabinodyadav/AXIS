# 🚀 Axis

> **Axis is a personal control plane for your development environment.**
> It connects your laptop, cloud, and mobile interface to observe, execute, and manage your system from anywhere.

---

## ✨ What is Axis?

Axis turns your development setup into a **distributed system you control**.

Instead of being tied to your laptop, you get:

* 📡 **Remote execution** — run commands from your phone
* 📊 **Observability** — monitor processes, logs, system state
* 🧠 **Context-aware intelligence** — memory + AI-assisted workflows
* 🌐 **Anywhere access** — works across networks via a cloud coordinator

---

## 🧠 Core Idea

Axis is built around a simple but powerful model:

```
[Laptop Agent] ←→ [Cloud Coordinator] ←→ [Mobile App]
```

* Your **laptop** does the work
* Your **VPS** coordinates everything
* Your **phone** becomes the control interface

---

## 🏗️ Architecture Overview

Axis is designed as a **distributed system with clear boundaries**:

* Microservices-based
* Domain-driven design (DDD)
* Event-driven communication
* Context-aware consistency

### System View

```
Internet
   │
   ▼
[ Gateway (TLS, Auth, Routing) ]
   │
   ├── Coordinator (agent lifecycle, commands)
   ├── Brain (AI + memory)
   ├── Scout (external signals, jobs)
   ├── Identity (auth, tokens)
   └── Observer (metrics, alerts)

   │
[ SQLite (per service) ]

   │
WireGuard Tunnel
   │
[ Laptop Agent ]
```

---

## 🧩 Bounded Contexts (DDD)

Axis is split into **six domains**, each owning its logic and data:

| Domain           | Responsibility                        |
| ---------------- | ------------------------------------- |
| **Control**      | Commands, execution, processes, logs  |
| **Intelligence** | Memory, AI context, conversations     |
| **Scout**        | External data, scraping, job signals  |
| **Gateway**      | API routing, WebSocket, rate limiting |
| **Identity**     | Auth, JWT, secrets                    |
| **Observation**  | Metrics, health, alerts               |

---

## 🔄 Communication Model

Axis uses **three distinct patterns**:

### 1. Command (Strong Consistency)

```
App → Gateway → Coordinator → Agent → Response
```

* Used for execution (shell, kill, restart)
* Requires acknowledgment

---

### 2. Event Stream (Eventual)

```
Agent → Coordinator → Gateway → App
```

* Logs, crashes, heartbeats
* Best-effort delivery

---

### 3. Query (Pull)

```
App → Gateway → Service → Response
```

* Fetch state, history, digest
* Returns last known snapshot

---

## ⚖️ Consistency Model

Axis applies **consistency based on context**, not globally:

| Operation             | Model       |
| --------------------- | ----------- |
| Command execution     | Strong      |
| Process control       | Strong      |
| System state          | Eventual    |
| Logs streaming        | Best effort |
| AI memory             | Eventual    |
| External data (Scout) | Eventual    |

---

## ⚠️ Failure Handling (SRE Mindset)

Axis is designed to **fail gracefully**:

* 🔌 Agent offline → commands queued
* 🔁 VPS restart → auto reconnect + buffer replay
* 🧠 AI unavailable → system still usable (no hard dependency)
* 📡 Network drop → last known state + recovery

Failures are:

* visible
* logged
* recoverable

---

## 📊 Observability Built-in

Axis includes all three pillars:

### Logs

* Structured JSON logs (Pino)
* Traceable across services

### Metrics

* Command success rate
* API latency (p50/p95/p99)
* System health

### Tracing

* `trace_id` across all services
* End-to-end request tracking

---

## 🔐 Security Model (Zero Trust)

* 🔑 JWT-based authentication
* 🔒 TLS everywhere
* 🧱 Gateway as single public entry
* 🚫 Command allowlist on agent
* 📜 Full audit logging

Agent can only execute:

```
exec_shell, kill_process, restart_service,
read_log, list_processes, get_git_status, read_file
```

---

## 💾 Data Architecture

Each service owns its own database:

```
/data/
  coordinator.db
  brain.db
  scout.db
  identity.db
  observer.db
```

Why SQLite?

* Zero setup
* Self-contained
* Perfect for single-user systems
* Easy migration to Postgres later

---

## 📡 API Overview

All endpoints are versioned under `/v1/`.

### Core

* `POST /v1/commands`
* `GET /v1/state`
* `GET /v1/processes`
* `GET /v1/logs/:process`

### Intelligence

* `POST /v1/chat`
* `GET /v1/memory/core`

### Scout

* `GET /v1/digest/latest`
* `GET /v1/jobs`

### System

* `GET /v1/health`
* `GET /v1/metrics`

---

## 📦 Monorepo Structure

```
axis/
├── services/       # microservices
├── packages/       # shared modules
├── apps/mobile/    # React Native app
├── infra/          # deployment configs
├── docs/           # architecture + ADRs
```

---

## ⚙️ Deployment (Self-Hostable)

Axis is designed to be **fully reproducible**:

One script:

* installs dependencies
* sets up WireGuard
* initializes databases
* configures environment
* starts all services (PM2)
* enables TLS

---

## 🧭 Design Principles

* **DDD first** — clear boundaries, no leakage
* **SRE mindset** — design for failure
* **Right consistency** — not over-engineered
* **Zero trust** — secure by default
* **Self-hostable** — no vendor lock-in

---

## 🚧 Status

> Early-stage system under active development.

---

## 🔮 Vision

Axis is not just a tool — it’s a step toward:

> **a personal control plane for computation**

Where your devices, code, and workflows become a **coordinated, observable system** instead of isolated tools.

---

## 🤝 Contributing

Coming soon.

---

## ⭐ Why this matters

Most developers:

* can’t observe their system remotely
* can’t control their environment outside their laptop
* don’t treat their setup as a system

Axis changes that.
 it*.
