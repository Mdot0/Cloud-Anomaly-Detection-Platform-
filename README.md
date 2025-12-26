# CloudGuard – Cloud Log Upload & Anomaly Detection Platform

CloudGuard is a cloud-native log ingestion and analysis platform built to demonstrate secure cloud architecture, observability, and scalable backend design using Microsoft Azure.

The system allows users to upload log files (CSV), store them durably in cloud storage, run analysis on those logs, and retrieve scored results through a clean API and web interface.

---

## High-Level Architecture

**Frontend**
- React + Vite
- Deployed to Azure Static Web Apps
- Calls backend APIs directly via environment-injected base URL

**Backend**
- Azure Functions (Python, HTTP-triggered)
- Stateless API design
- Handles uploads, processing, and results retrieval

**Storage**
- Azure Blob Storage
- Used as a data lake for raw logs and processed results

**Observability**
- Azure Application Insights
- Azure Monitor (logs, metrics, dashboards, alerts)

---

## End-to-End Flow

1. User uploads a CSV log file from the web UI
2. Frontend sends the file to the backend API
3. Backend stores the raw file in Blob Storage (`logs` container)
4. User triggers analysis for a specific upload
5. Backend processes the file and writes:
   - scored CSV output
   - JSON summary
6. Frontend fetches and displays results

---

## API Endpoints

All backend endpoints are exposed via Azure Functions and are currently **anonymous** (authentication will be added later).

| Method | Route | Description |
|------|------|------------|
| GET | `/api/ping` | Health check |
| POST | `/api/upload-logs` | Upload a CSV log file |
| GET | `/api/uploads?limit=` | List uploaded files |
| POST | `/api/analyze?upload_id=` | Run analysis on an upload |
| GET | `/api/results?upload_id=&limit=` | Fetch scored results |

---

## Storage Layout

Azure Blob Storage is used as immutable, durable storage.

logs/
└── <upload_id>.csv # raw uploaded logs

results/
├── scored/<upload_id>.csv # processed output
└── summary/<upload_id>.json # analysis metadata



This separation keeps raw data and derived results isolated and auditable.

---

## Frontend Design

The frontend is a static React app with:

- Drag-and-drop CSV upload interface
- Explicit environment-based API routing
- A centralized API client (`api.ts`) that:
  - Requires `VITE_API_BASE` at build time
  - Prevents accidental calls to the Static Web App `/api` path
  - Handles errors and response parsing consistently

All Azure-specific logic is isolated from UI components.

---

## Backend Design

The backend uses the Azure Functions Python v2 programming model.

Key characteristics:
- Stateless HTTP endpoints
- No storage credentials exposed to the client
- Storage access handled server-side only
- Designed so analysis logic can be swapped without changing the API

The current analysis step uses placeholder scoring logic and is structured to support ML model inference in future versions.

---

## Observability & Monitoring

CloudGuard includes **first-class observability** using Azure-native tooling.

### Structured Logging
All major pipeline steps emit structured JSON logs, including:
- upload received
- upload stored
- analysis started
- analysis completed
- failure cases

Each log includes contextual fields such as:
- `upload_id` (correlation ID)
- endpoint name
- file size
- processing duration
- error messages (if any)

This enables precise filtering and end-to-end tracing in Application Insights.

---

### Custom Metrics
The backend emits custom metrics for operational visibility, including:

- `cloudguard.uploads.count`  
- `cloudguard.uploads.size_bytes`  
- `cloudguard.analysis.duration_ms`  
- `cloudguard.analysis.failures`  

These metrics allow dashboards and alerts for:
- traffic spikes
- performance regressions
- failure rates
- cost and capacity planning

---

### Built-In Telemetry
Azure Application Insights automatically captures:
- request counts
- latency
- error rates
- dependency calls
- cold starts

Together with custom signals, this provides full observability across the system.

---

## Deployment & CI/CD

### Frontend CI/CD
- GitHub Actions builds the React app on every push to `main`
- `VITE_API_BASE` is injected at build time
- The prebuilt `dist/` folder is deployed to Azure Static Web Apps

### Backend Deployment
- Azure Functions deployed separately
- Default `/api` route prefix is used
- CORS explicitly allows the Static Web App origin
- Observability is enabled via Application Insights

---

## Why Blob Storage (Not a Database)

Blob Storage is used for:
- Large, immutable files (logs, CSVs, artifacts)
- Low-cost, durable storage
- Simple access patterns

A database (e.g., Azure Cosmos DB) would only be introduced later for:
- Job state tracking
- Metadata querying
- Analytics dashboards

This separation avoids misusing a database for file storage.

---

## Event-Driven Architecture (Future Work)

The current pipeline is request-driven and synchronous for simplicity.

The architecture is intentionally designed to evolve into an event-driven system:

- Upload emits an event
- Queue-triggered Function processes logs asynchronously
- Failed jobs route to a dead-letter queue (DLQ)

This enables horizontal scaling and long-running analysis without frontend blocking.

---

## Security Considerations

- No storage credentials exposed to clients
- Backend APIs act as the trust boundary
- Explicit CORS configuration
- Clear separation between static hosting and compute

Authentication and authorization will be added in a later phase.

---

## Project Status

**Current**
- Fully functional upload → analyze → results pipeline
- Structured logging and custom metrics implemented
- CI/CD in place
- Cloud observability enabled

**Planned**
- Replace dummy scoring with ML model inference
- Add asynchronous processing via queues
- Introduce authentication and RBAC
- Add alerting and dashboards
- Expand log format support

---

## Author

Matthew Lee & Poorva Vakharia 
CloudGuard – Cloud Anomaly Detection Platform


