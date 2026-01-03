# CloudGuard — Cloud Log Upload & AI Anomaly Detection Platform

CloudGuard is a cloud-native platform for uploading log files, running AI-based anomaly detection, and reviewing suspicious activity through a web interface.

The project demonstrates secure cloud architecture, event-driven backend design, and practical machine-learning inference in production.

---

## What This Project Does (High Level)

1. Users upload log files (CSV) through a web UI
2. Logs are stored durably in cloud storage
3. An AI model analyzes the logs for anomalous behavior
4. Results are written back to storage
5. The frontend displays anomaly scores and highlights suspicious events

This is an **end-to-end system**, not just a model or a script.

---

## Architecture Overview

### Frontend
- **React + Vite**
- Deployed using **Azure Static Web Apps**
- Handles file upload, analysis triggers, and results visualization
- Communicates with backend via REST API (`/api/*`)

### Backend
- **Azure Functions (Python)**
- Stateless, serverless API
- Responsibilities:
  - Accept uploads
  - Store files in Blob Storage
  - Trigger analysis
  - Return scored results
- Integrated observability via **Azure Monitor / Application Insights**

### Storage
- **Azure Blob Storage**
- Containers:
  - `logs/` → raw uploaded CSV files
  - `results/scored/` → scored CSV outputs
  - `results/summary/` → JSON summaries

### AI / Machine Learning
- **Unsupervised anomaly detection**
- Training and research code lives in `ml/`
- Production inference code lives in `backend/ai/`
- Current model: **Isolation Forest (iforest-v1)**

---

## End-to-End Data Flow

### 1. Upload
Frontend → `POST /api/upload-logs`

- CSV is uploaded via the web UI
- Backend generates an `upload_id`
- File is stored as:
logs/<upload_id>.csv

markdown
Copy code

### 2. Analyze
Frontend → `POST /api/analyze?upload_id=...`

Backend:
- Downloads raw CSV from Blob Storage
- Passes file bytes into the AI scoring function
- Writes outputs to:
results/scored/<upload_id>.csv
results/summary/<upload_id>.json

markdown
Copy code

### 3. View Results
Frontend → `GET /api/results?upload_id=...&limit=N`

- Backend reads scored CSV + summary
- Returns JSON for UI rendering
- Frontend highlights anomalies and allows sorting by score

---

## How Anomaly Detection Works (logon.csv)

This project currently focuses on **logon activity logs**.

### Feature Engineering
Each log row is converted into numeric features, including:
- Time features (hour, day of week, weekend)
- Activity type (logon vs logoff)
- Frequency-based features:
- How often a user appears
- How often a PC appears
- How often a (user, PC) pair appears
- Inverse frequency (rarity)

Rare behavior receives higher anomaly scores.

### Model
- **Isolation Forest**
- Trained without labels (unsupervised)
- Learns what “normal” activity looks like
- Produces a continuous anomaly score per row

### Scoring Output
Each row in the scored CSV includes:
- `anomaly_score` (float, higher = more suspicious)
- `is_anomaly` (0/1 based on percentile threshold)
- `model_version` (e.g., `iforest-v1`)
- `scored_at` (UTC timestamp)

---

## Repository Structure

.
├── frontend/ # React + Vite web UI
│ └── src/
│ └── components/
│ └── ResultsTable.tsx
│
├── backend/ # Azure Functions backend
│ ├── function_app.py # API routes and orchestration
│ ├── ai/
│ │ └── scorer.py # Production inference interface
│ └── models/ # Exported model artifacts
│
├── ml/ # Training & research (NOT deployed)
│ ├── feature_engineering.py
│ ├── anomaly_model.py
│ ├── train_model.py
│ ├── score_logs.py
│ └── notebooks/
│
└── .github/workflows/ # CI/CD (GitHub Actions)

markdown
Copy code

### Key Design Rule
**Training code is never mixed with production backend code.**

- `ml/` → experimentation, heavy libraries, notebooks
- `backend/ai/` → minimal, stable inference logic for Azure

---

## Deployment & CI/CD

### GitHub Actions
- Runs on pushes/merges to `main`
- Builds and deploys:
  - Frontend → Azure Static Web Apps
  - Backend → Azure Functions

### Frontend
- Built with `npm run build`
- Served as static assets
- Uses environment variable:
VITE_API_BASE=https://<backend>/api

yaml
Copy code

### Backend
- Python Azure Functions runtime
- Automatically redeployed when backend code changes
- Observability enabled via Application Insights

---

## Why This Project Matters

This project demonstrates:
- Secure cloud-native architecture
- Event-driven backend design
- Practical ML inference in production
- Clean separation of concerns (UI / API / ML)
- Real-world anomaly detection logic, not toy examples

It is designed to be:
- Extendable (more log types, more models)
- Automatable (Service Bus worker support)
- Resume-ready and interview-explainable

---

## Future Improvements
- Support additional log types (HTTP, device, auth)
- Store models in Blob Storage instead of repo
- Background queue-based analysis (Service Bus worker)
- Model versioning and A/B testing
- Visualization dashboards for anomaly trends

---
