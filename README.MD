# 🤖 AutoHeal Agent: Autonomous CI/CD Healing System

**AutoHeal Agent** is a production-ready, multi-agent AI system designed to autonomously detect, analyze, and repair code failures in CI/CD pipelines. By leveraging **LangGraph.js** and **Docker sandboxing**, it provides a "Self-Healing" layer for modern DevOps workflows.

---

## 🏗️ System Architecture

The project employs a specialized **Multi-Agent Orchestration** pattern to ensure separation of concerns and robust error handling.

### 1. The Auditor (Agent One)
* **Role**: Repository discovery and preparation.
* **Workflow**: Clones the target repository using provided GitHub credentials, analyzes the project structure, and creates a unique branch following the mandatory `TEAM_LEADER_AI_Fix` format.
* **Source**: `backend/src/agents/auditor.js`

### 2. The Orchestrator (Agent Two)
* **Role**: Central controller and pipeline monitor.
* **Workflow**: 
    * **Engine Detection**: Dynamically identifies the tech stack (Node, Python, Java, Go, Ruby) using specialized discovery engines.
    * **Healing Loop**: Manages a strict 6-iteration loop to monitor pipeline status.
    * **State Management**: Aggregates test outputs, tracks "Re-opened" issues that persist across iterations, and ensures a final `PASSED` status only when the sandbox returns `ExitCode 0`.
* **Source**: `backend/src/agents/orchestrator.js`

### 3. The Solver (Agent Three)
* **Role**: Targeted code repair specialist.
* **Workflow**: Receives bug context (file, line, type, description) and the raw failing test output. It utilizes **GPT-4-Turbo** to generate surgical code fixes, which are then physically written back to the source files.
* **Source**: `backend/src/agents/solver.js`

---

### High-Level Architecture Diagram

```mermaid
graph TD
    %% Frontend
    subgraph Frontend [React Dashboard - Vite + Tailwind]
        UI[User Interface]
        Store[Zustand State Store]
        Poller[Live Results Poller]
    end

    %% Backend API
    subgraph Backend [Node.js Express API]
        Controller[API Controller]
    end

    %% Multi-Agent System
    subgraph MAS [Multi-Agent System]
        Auditor[Agent 1: The Auditor]
        Orchestrator[Agent 2: The Orchestrator]
        Solver[Agent 3: The Solver]
    end

    %% Execution Sandbox
    subgraph Sandbox [Isolated Execution]
        Docker[(Docker Daemon)]
        Engines[Language Engines: Node, Python, Java, Go, Ruby]
    end

    %% External
    GitHub[(GitHub Repository)]
    LLM((OpenAI GPT-4 Turbo))

    %% Connections
    UI -->|"repoUrl, teamName"| Controller
    Poller -->|"GET /api/results"| Controller
    Controller --> Orchestrator
    
    Orchestrator --> Auditor
    Auditor -->|"Git Clone / Branch"| GitHub
    
    Orchestrator -->|"Detect & Run Tests"| Engines
    Engines -->|"Spawn Container"| Docker
    Docker -->|"Test Logs"| Orchestrator
    
    Orchestrator -->|"Analyze Logs"| LLM
    Orchestrator -->|"Pass OPEN Issues"| Solver
    
    Solver -->|"Generate Fixes"| LLM
    Solver -->|"Overwrite File"| Auditor
    
    Orchestrator -->|"Commit & Push [AI-AGENT]"| GitHub
```

## 🚀 Key Features

* **Polyglot Support**: Native engines for **Node.js, Python, Java, Go, and Ruby**.
* **Sandboxed Execution**: All tests and repairs are executed inside isolated **Docker containers** via `dockerode`, preventing host contamination.
* **Persistence Handling**: Detects recurring errors and automatically re-opens "Fixed" issues for deeper analysis if the tests continue to fail.
* **Compliance-First Commits**: Every repair is committed issue-wise with the mandatory `[AI-AGENT]` prefix.
* **Real-time Dashboard**: A React-based interface showing a live execution timeline, score breakdown, and detailed fixes table.

---

## 🛠️ Tech Stack

* **Frontend**: React (Vite), Tailwind CSS, Zustand
* **Backend**: Node.js, Express, LangGraph.js, Simple-Git
* **AI Engine**: OpenAI GPT-4-Turbo
* **Infrastructure**: Docker (Docker-in-Docker socket mounting)

---

## 📦 Installation & Setup

### 1. Backend Environment Configuration
Create a `.env` file in the `/backend` folder:
```env
PORT=3000
OPENAI_API_KEY=your_key_here
GITHUB_TOKEN=your_token_here
HOST_WORKDIR=/absolute/path/to/AutoHeal_Agent
FRONTEND_URL=https://your-frontend.onrender.com
```

### 2. Frontend Environment Configuration
Create a `.env` file in the `/frontend` folder:
```env
VITE_BACKEND_URL=https://your-backend-api.com   # e.g. http://<EC2-IP>:3000
```
> ⚠️ In Vite, only variables prefixed with `VITE_` are exposed to the browser.

### 3. Deploy Backend with Docker
```bash
docker-compose up --build
```

### 4. Frontend Local Setup
```bash
cd frontend
npm install
npm run dev
```

---

## � Project Structure

```
AutoHeal_Agent/
│
├── docker-compose.yml              # Orchestrates backend container + Docker socket mount
│
├── backend/
│   ├── Dockerfile                  # Backend container image
│   ├── .env                        # Backend environment variables (see below)
│   ├── package.json
│   └── src/
│       ├── server.js               # Express API server (routes: /api/run-agent, /api/results)
│       │
│       ├── agents/
│       │   ├── auditor.js          # Agent 1: Clones repo, creates AI fix branch
│       │   ├── orchestrator.js     # Agent 2: Healing loop, engine detection, final sanity run
│       │   └── solver.js           # Agent 3: GPT-4-Turbo powered code fixer
│       │
│       └── engines/                # Language-specific test runners
│           ├── node.js             # npm test / jest
│           ├── python.js           # pytest with PYTHONPATH fix
│           ├── java.js             # Maven / Gradle
│           ├── go.js               # go test ./...
│           └── ruby.js             # bundle exec rspec
│
└── frontend/
    ├── .env                        # Frontend environment variables (see below)
    ├── package.json
    ├── vite.config.js
    └── src/
        ├── main.jsx                # App entry point
        ├── App.jsx                 # Router (/ → Launchpad, /dashboard → ResultsDashboard)
        ├── index.css               # Global styles + Tailwind
        │
        ├── components/
        │   ├── Launchpad.jsx       # Landing page + agent launch form
        │   ├── ResultsDashboard.jsx # Live dashboard with logs, fixes, score
        │   └── Dashboard.jsx       # Alternate view component
        │
        ├── store/
        │   └── runStore.js         # Zustand global state (status, logs, fixes, etc.)
        │
        └── api/
            └── agentApi.js         # Axios calls to backend
```

## �📊 Evaluation Metrics (PS3 Standards)

* **Base Score**: 100 points
* **Speed Bonus**: +10 points for execution under 5 minutes
* **Efficiency Penalty**: -2 points for every commit exceeding 20

## 👥 Team VicRaptors
* **Vinayak Gawade** (Team Leader)
* **Aditya Patil** 
* **Amit Kumar Singh** 
* **Advait Ithape** 

