# Implementation Plan - API Cortex (API Health Monitoring Platform)

**API Cortex** is an end-to-end API Health Monitoring Platform built without Docker. It continuously monitors external/target APIs, validates response structures against expected JSON Schemas, detects schema drift, records time-series metrics for Prometheus/Grafana, logs relational issues to PostgreSQL, and uses Google Gemini AI to analyze failures and generate actionable remediation recommendations.

---

## 1. Final Project Architecture

The architecture consists of a decoupled Python FastAPI backend and a React (Vite) frontend, communicating via REST APIs. Time-series metrics are scraped directly by Prometheus from FastAPI's `/metrics` endpoint, while relational application data is stored in PostgreSQL.

```
                  ┌────────────────────────────────────────────────────────┐
                  │                      USER / BROWSER                    │
                  └──────────────────────────┬─────────────────────────────┘
                                             │ HTTP Requests
                                             ▼
                  ┌────────────────────────────────────────────────────────┐
                  │                React Dashboard (Vite)                  │
                  │   - API Config Form    - Schema & Drift Inspector    │
                  │   - Health Cards       - AI Diagnosis & Remediation    │
                  │   - Real-time Results  - Analytical Charts             │
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
│             │                            │ Periodic Poll                │ Issue Trigger  │
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
                            │  (Visualizes Latency, Errors,│
                            │   Health Status, Uptime)     │
                            └──────────────────────────────┘
```

---

## 2. Folder Structure

```
API-Cortex/
├── .env.example
├── README.md
├── prometheus.yml
├── grafana_dashboard.json
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                    # FastAPI entrypoint, CORS, startup/shutdown hooks
│   │   ├── config.py                  # Pydantic BaseSettings loading from .env
│   │   ├── database.py                # SQLAlchemy engine, session maker, Base
│   │   ├── models/                    # SQLAlchemy ORM models
│   │   │   ├── __init__.py
│   │   │   ├── api_config.py
│   │   │   ├── monitoring_log.py
│   │   │   ├── issue.py
│   │   │   └── ai_diagnosis.py
│   │   ├── schemas/                   # Pydantic schemas (Request/Response validation)
│   │   │   ├── __init__.py
│   │   │   ├── api_config.py
│   │   │   ├── monitoring_log.py
│   │   │   ├── issue.py
│   │   │   └── ai_diagnosis.py
│   │   ├── services/                  # Business logic & core modules
│   │   │   ├── __init__.py
│   │   │   ├── api_config_service.py
│   │   │   ├── scheduler_service.py   # APScheduler background periodic polling
│   │   │   ├── monitoring_service.py  # HTTPX client execution & timing
│   │   │   ├── schema_validator.py    # Structural schema drift detection engine
│   │   │   ├── issue_service.py       # Issue logging & issue tracking
│   │   │   ├── prometheus_metrics.py  # Prometheus Counter, Gauge, Histogram instances
│   │   │   └── gemini_service.py      # Google Gemini API integration for diagnosis
│   │   └── api/                       # REST API route handlers
│   │       ├── __init__.py
│   │       ├── router.py
│   │       └── endpoints/
│   │           ├── api_configs.py
│   │           ├── monitoring.py
│   │           ├── issues.py
│   │           ├── ai_diagnosis.py
│   │           └── dashboard.py
│   ├── tests/                         # Pytest test suite
│   │   ├── test_schema_validator.py
│   │   ├── test_api_configs.py
│   │   ├── test_monitoring.py
│   │   └── test_gemini_service.py
│   ├── requirements.txt
│   └── pytest.ini
└── frontend/                          # Vite + React application
    ├── index.html
    ├── package.json
    ├── vite.config.js
    └── src/
        ├── main.jsx
        ├── App.jsx
        ├── index.css                  # Custom styling (Glassmorphism, Dark Mode)
        ├── api/
        │   └── client.js              # Axios/Fetch API wrapper
        ├── components/
        │   ├── Navbar.jsx
        │   ├── HealthStatusCard.jsx
        │   ├── ApiConfigModal.jsx
        │   ├── ApiList.jsx
        │   ├── MonitoringHistoryTable.jsx
        │   ├── IssueList.jsx
        │   ├── SchemaDriftViewer.jsx
        │   ├── AiDiagnosisModal.jsx
        │   └── MetricsCharts.jsx      # Recharts visual trends
        └── pages/
            └── Dashboard.jsx
```

---

## 3. Database Schema (PostgreSQL)

```sql
-- 1. API Configurations
CREATE TABLE api_configs (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    url TEXT NOT NULL,
    method VARCHAR(10) NOT NULL DEFAULT 'GET',
    headers JSONB DEFAULT '{}',
    body JSONB DEFAULT NULL,
    expected_status_code INT DEFAULT 200,
    expected_schema JSONB DEFAULT NULL,
    polling_interval_seconds INT DEFAULT 60,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Monitoring Logs (Relational history)
CREATE TABLE monitoring_logs (
    id SERIAL PRIMARY KEY,
    api_config_id INT REFERENCES api_configs(id) ON DELETE CASCADE,
    status_code INT,
    response_time_ms FLOAT,
    is_healthy BOOLEAN NOT NULL,
    response_headers JSONB,
    response_body JSONB,
    error_message TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Issues & Schema Drift Records
CREATE TABLE issues (
    id SERIAL PRIMARY KEY,
    api_config_id INT REFERENCES api_configs(id) ON DELETE CASCADE,
    monitoring_log_id INT REFERENCES monitoring_logs(id) ON DELETE CASCADE,
    issue_type VARCHAR(50) NOT NULL, -- 'HTTP_ERROR', 'TIMEOUT', 'SCHEMA_DRIFT', 'MISSING_FIELD', 'TYPE_MISMATCH'
    status_code INT,
    error_details TEXT NOT NULL,
    schema_validation_results JSONB, -- missing_fields, unexpected_fields, type_mismatches
    status VARCHAR(20) DEFAULT 'OPEN', -- 'OPEN', 'DIAGNOSED', 'RESOLVED'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Gemini AI Diagnoses & Recommendations
CREATE TABLE ai_diagnoses (
    id SERIAL PRIMARY KEY,
    issue_id INT UNIQUE REFERENCES issues(id) ON DELETE CASCADE,
    root_cause TEXT NOT NULL,
    explanation TEXT NOT NULL,
    severity VARCHAR(20) NOT NULL, -- 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'
    possible_impact TEXT NOT NULL,
    recommended_action TEXT NOT NULL,
    raw_ai_response JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

---

## 4. API Endpoint List

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/health` | System health check (PostgreSQL DB ping) |
| `GET` | `/metrics` | Prometheus time-series metrics exporter |
| `POST` | `/api/v1/apis/` | Register a new target API configuration |
| `GET` | `/api/v1/apis/` | List all configured APIs |
| `GET` | `/api/v1/apis/{id}` | Get specific API configuration details |
| `PUT` | `/api/v1/apis/{id}` | Update API configuration or expected schema |
| `DELETE` | `/api/v1/apis/{id}` | Delete API configuration |
| `POST` | `/api/v1/apis/{id}/trigger` | Trigger immediate manual check of an API |
| `GET` | `/api/v1/monitoring/logs` | Fetch relational monitoring history |
| `GET` | `/api/v1/issues/` | List detected API issues and schema drift logs |
| `GET` | `/api/v1/issues/{id}` | Get detailed issue view with validation results |
| `POST` | `/api/v1/issues/{id}/diagnose` | Request Gemini AI diagnosis for a specific issue |
| `GET` | `/api/v1/issues/{id}/diagnosis` | Retrieve existing Gemini diagnosis & recommendations |
| `GET` | `/api/v1/dashboard/summary` | Consolidated dashboard overview metrics |

---

## 5. Data Flow

1. **API Configuration**:
   - User submits API details (URL, HTTP Method, Headers, Expected JSON Schema, Interval) via React Dashboard.
   - FastAPI validates inputs & persists to `api_configs` table in PostgreSQL.

2. **Monitoring & Metric Collection**:
   - Background `APScheduler` worker invokes `monitoring_service.py` at configured intervals.
   - `HTTPX` asynchronously calls target API, recording HTTP status, response time (ms), headers, and payload.
   - Time-series counters and histograms (`api_requests_total`, `api_response_time_seconds`, `api_errors_total`, `api_health_status`) are updated in `prometheus_metrics.py`.
   - Raw results are stored in `monitoring_logs` table in PostgreSQL.

3. **Schema Validation & Drift Detection**:
   - `schema_validator.py` compares actual JSON payload with `expected_schema`.
   - Engine identifies:
     - **Missing Fields**: Fields expected in schema but absent in response.
     - **Unexpected Fields**: New fields present in response not present in schema.
     - **Type Mismatches**: e.g., expected `integer`, got `string`.
     - **Structural Drift**: Nested structure changes.
   - If issues/drift or HTTP failure occurs $\rightarrow$ record entry in `issues` table.
   - If clean $\rightarrow$ mark monitoring check as healthy.

4. **AI Diagnosis (Gemini AI)**:
   - When an issue is detected or on user request, `gemini_service.py` constructs a structured diagnostic prompt containing:
     - Target API URL & method
     - Expected vs actual schema / response payload
     - Specific drift breakdown & error messages
   - Gemini API generates structured output: Root Cause, Explanation, Severity, Impact, and Actionable Code/Config Recommendations.
   - Result is saved to `ai_diagnoses` table and linked to the issue.

5. **Visualization**:
   - React Dashboard polls or fetches `/dashboard/summary`, `/apis`, `/issues`, and `/monitoring/logs` to display status cards, health badges, issue tables, and AI insights.
   - Prometheus scrapes FastAPI `/metrics` every 15s.
   - Grafana queries Prometheus to render real-time time-series charts (Latency percentiles, error rate, request rate per target API).

---

## 6. Implementation Status & Roadmap

1. **Phase 1: Environment & Project Setup** — `[COMPLETED]`
   - Directory structure created for backend and frontend.
   - Python dependencies installed (`fastapi`, `uvicorn`, `sqlalchemy`, `psycopg2-binary`, `httpx`, `prometheus-client`, `google-genai`, `jsonschema`, `apscheduler`, `pydantic-settings`, `bcrypt`, `python-jose`).
   - `.env` and `.env.example` configured.

2. **Phase 2: Database Layer & Core Configuration** — `[COMPLETED]`
   - SQLAlchemy ORM models configured: `User`, `Project`, `ApiConfig`, `MonitoringLog`, `Issue`, `SchemaValidationIssue`, `AiDiagnosis`.
   - Pydantic schemas implemented for models and requests.
   - Database connection and session management configured (`database.py`).
   - Unit tests verified in `test_database_layer.py` (2/2 passed).

3. **Phase 3: Schema Validation & Monitoring Engine** — `[COMPLETED]`
   - Structural schema validator and drift detection built in `schema_validator.py`.
   - Asynchronous HTTPX client execution engine in `monitoring_service.py`.
   - Prometheus time-series metrics exporter at `/metrics` via `prometheus_metrics.py`.
   - Periodic background polling engine in `scheduler_service.py`.
   - Unit tests verified in `test_phase3_monitoring.py` (4/4 passed).

4. **Phase 4: Gemini AI Integration** — `[COMPLETED & VERIFIED]`
   - Gemini service implemented in `gemini_service.py` using `google-genai` SDK.
   - Active model configured: `gemini-3.6-flash`.
   - Structured JSON response enforced via `GeminiDiagnosisResponse` (root cause, explanation, severity, possible impact, recommended action).
   - Strict Prometheus exclusion: No Prometheus metrics sent to Gemini.
   - Automatic secret sanitization (`sanitize_text`) prevents API key leaks.
   - Live Gemini connection tested and verified.
   - Unit tests verified in `test_gemini_service.py` (11/11 passed).

5. **Phase 5: FastAPI REST API Endpoints** — `[COMPLETED & VERIFIED]`
   - Auth endpoints implemented: `POST /api/v1/auth/register`, `POST /api/v1/auth/login`, `GET /api/v1/auth/me`.
   - Security utilities in `core/security.py` using native `bcrypt` and `python-jose` JWT tokens.
   - Access control dependencies in `api/deps.py` enforcing user/project/API authorization (401/403/404).
   - Issue endpoints in `api/endpoints/issues.py`:
     - `GET /api/v1/issues/` (filtered by user/project, enriched with API & project metadata).
     - `GET /api/v1/issues/{issue_id}` (detailed view with schema drift details and diagnosis).
     - `POST /api/v1/issues/{issue_id}/diagnose` (AI diagnosis trigger saving to PostgreSQL).
   - Dashboard summary endpoint in `api/endpoints/dashboard.py`:
     - `GET /api/v1/dashboard/summary` (consolidated counts, health status, availability %, latency, and recent issues).
   - Global `SQLAlchemyError` exception handler in `main.py` prevents stack trace / credential leaks.
   - Verified in Swagger UI at `/docs` (16 endpoints registered).
   - Integration tests verified in `test_phase5_endpoints.py` (13/13 passed).
   - Full test suite: **30 of 30 tests passing**.

6. **Phase 6: Frontend Development (React + Vite)** — `[UPCOMING NEXT]`
   - Initialize Vite + React dashboard in `frontend/`.
   - Modern Glassmorphism aesthetic with custom dark mode CSS.
   - Components to build:
     - Navbar with active status & project selector.
     - Health Status Summary Cards (Total APIs, Availability %, Errors, Open Issues).
     - Target API Registration & Configuration Modal.
     - API Status & Contract List (with real-time manual check triggers).
     - Schema Drift & Contract Inspector (visualizing expected vs actual schema).
     - AI Diagnosis & Remediation Modal (displaying Gemini RCA, severity badge, impact, and actionable recommendations).
     - Latency & Availability trend charts (using Recharts).

7. **Phase 7: Prometheus & Grafana Setup Files** — `[UPCOMING]`
   - Write `prometheus.yml` configured to scrape FastAPI `/metrics`.
   - Export `grafana_dashboard.json` with pre-configured dashboard panels.

8. **Phase 8: End-to-End Testing & Documentation** — `[UPCOMING]`
   - Comprehensive `README.md` with zero-Docker startup guide.
   - End-to-end user journey validation.

---

## User Review Required

> [!IMPORTANT]
> **No Docker Requirement**: The application will run natively on Windows/Linux with Python, Node.js, local PostgreSQL, standalone Prometheus binary, and Grafana server. Clear startup commands and configuration files will be provided.

> [!NOTE]
> **Gemini API Key**: Requires a valid `GEMINI_API_KEY` in `.env`. AI diagnosis runs on demand or when an issue is logged, ensuring quota efficiency and avoiding sending raw time-series metrics directly to Gemini.

---

## Open Questions

None at present. The requirements are complete and fully specified.

---

## Verification Plan

### Automated Tests
- `pytest backend/tests/test_schema_validator.py`: Verify schema drift detection (missing fields, unexpected fields, type mismatch).
- `pytest backend/tests/test_api_configs.py`: Test CRUD endpoints for API configurations.
- `pytest backend/tests/test_monitoring.py`: Test execution of target API HTTP calls and metric tracking.

### Manual Verification
- Launch FastAPI backend (`uvicorn app.main:app --reload`) and verify `/metrics` output.
- Launch React frontend (`npm run dev`) and test adding target APIs (e.g. JSONPlaceholder `https://jsonplaceholder.typicode.com/posts/1`), running checks, viewing schema validation, and requesting Gemini AI diagnosis.
- Verify Prometheus scrapes `/metrics` and Grafana displays latency/error metrics.
