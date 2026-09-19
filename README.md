# API Cortex — API Health & Schema Drift Monitoring Platform

**API Cortex** is an enterprise-grade API Health Monitoring Platform built without Docker. It continuously monitors target APIs, validates response structures against expected JSON Schemas, detects real-time schema drift, records time-series metrics for Prometheus & Grafana, logs relational issues in PostgreSQL, and leverages **Google Gemini AI** (`gemini-3.6-flash`) to analyze failures and generate actionable remediation recommendations.

---

## Key Features

- ⚡ **Asynchronous Monitoring Engine**: High-throughput periodic polling powered by `httpx` and `APScheduler`.
- 🔍 **Real-Time Schema Drift Detection**: Structural payload validation detecting missing fields, unexpected extra fields, and data type mismatches.
- 🤖 **Google Gemini AI Diagnosis**: Automatic Root Cause Analysis (RCA), severity classification, downstream business impact analysis, and code remediation generation.
- 📊 **Prometheus & Grafana Time-Series Exporter**: Direct `/metrics` scraping exporting counters, gauges, and histograms for latency and health percentiles.
- 💎 **Modern Glassmorphism UI**: React (Vite) dashboard built with HSL dark-mode design system, live visual diff inspector, and Recharts latency trends.
- 🔐 **Multi-Tenant Isolation & JWT Auth**: User registration, password hashing (`bcrypt`), and project level resource isolation.

---

## Tech Stack & Architecture

```
                  ┌────────────────────────────────────────────────────────┐
                  │                React Dashboard (Vite)                  │
                  │   - API Config Form    - Schema & Drift Inspector    │
                  │   - Health Cards       - AI Diagnosis & Remediation    │
                  └──────────────────────────┬─────────────────────────────┘
                                             │ REST API Calls
                                             ▼
┌───────────────────────────────────────────────────────────────────────────────────────────┐
│                                   FastAPI Backend App                                     │
│                                                                                           │
│  ┌───────────────────────┐   ┌────────────────────────┐   ┌───────────────────────────┐  │
│  │ API Config Router     │   │ Monitoring Engine      │   │ Schema & Drift Validator  │  │
│  │ CRUD for Target APIs  │   │ (HTTPX Async Engine +  │   │ - Structural comparison   │  │
│  │ & Expected Schemas    │   │  APScheduler Tasks)    │   │ - Type & field drift      │  │
│  └──────────┬────────────┘   └───────────┬────────────┘   └─────────────┬─────────────┘  │
│             │                            │                              │                │
│             ▼                            ▼                              ▼                │
│  ┌───────────────────────┐   ┌────────────────────────┐   ┌───────────────────────────┐  │
│  │  PostgreSQL (Relational)│  │ Target External APIs   │   │  Gemini AI Diagnosis      │  │
│  │  - api_configs        │   │  (HTTP / HTTPS)        │   │  - Root Cause Analysis    │  │
│  │  - monitoring_logs    │   └────────────────────────┘   │  - Severity & Impact      │  │
│  │  - issues             │                                │  - Recommended Fixes      │  │
│  │  - ai_diagnoses       │   ┌────────────────────────┐   └─────────────┬─────────────┘  │
│  └───────────────────────┘   │ Prometheus Metrics     │                 │                │
│                              │ /metrics Endpoint      │◄────────────────┘                │
│                              └───────────┬────────────┘  Exposes Counter / Gauge /       │
│                                          │               Histogram Metrics               │
└──────────────────────────────────────────┼───────────────────────────────────────────────┘
                                           │ Scraping
                                           ▼
                            ┌──────────────────────────────┐
                            │      Prometheus Server       │
                            └──────────────┬───────────────┘
                                           │ Time-series Queries
                                           ▼
                            ┌──────────────────────────────┐
                            │      Grafana Dashboard       │
                            └──────────────────────────────┘
```

---

## Quick Start (Zero-Docker Setup)

### Prerequisites
- **Python**: 3.10+ installed
- **Node.js**: 18+ installed
- **PostgreSQL**: Local server running on port `5432`
- **Gemini API Key**: Obtain a key from [Google AI Studio](https://aistudio.google.com/)

---

### Step 1: Backend Setup

1. Configure environment variables in `.env`:
   ```bash
   cp .env.example .env
   ```
   Update `DATABASE_URL` with your PostgreSQL credentials:
   ```env
   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/apicortex
   GEMINI_API_KEY=your_actual_gemini_api_key_here
   GEMINI_MODEL=gemini-3.6-flash
   SECRET_KEY=your_random_jwt_secret_key
   ```

2. Install Python dependencies:
   ```bash
   pip install -r backend/requirements.txt
   ```

3. Run the Backend Server:
   ```bash
   python -m uvicorn app.main:app --app-dir backend --reload --port 8000
   ```
   - Swagger API Docs: `http://localhost:8000/docs`
   - Prometheus Metrics Endpoint: `http://localhost:8000/metrics`

---

### Step 2: Frontend Setup

1. Install Node.js packages:
   ```bash
   cd frontend
   npm install
   ```

2. Start Frontend Dev Server:
   ```bash
   npm run dev
   ```
   - Dashboard UI: `http://localhost:3000`

---

### Step 3: Monitoring & Metrics (Prometheus & Grafana)

1. **Prometheus**:
   - Download standalone Prometheus binary.
   - Run with provided configuration:
     ```bash
     prometheus --config.file=prometheus.yml
     ```
   - Prometheus UI: `http://localhost:9090`

2. **Grafana**:
   - Launch Grafana server (`http://localhost:3000` or `http://localhost:3001`).
   - Add Prometheus data source targeting `http://localhost:9090`.
   - Import `grafana_dashboard.json` to view real-time latency trends and error gauges.

---

## Running the Automated Test Suite

API Cortex includes comprehensive unit and integration coverage (30/30 tests passing):

```bash
python -m pytest backend/tests -v
```

---

## License

MIT License. Designed & Built for Enterprise API Reliability.
