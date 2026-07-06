# CloudGuard — Insider-Threat & Offboarding Investigation Triage

CloudGuard helps a security or HR analyst answer one question fast: **was this person's access
behavior unusual?** When someone resigns, is terminated, or gets flagged for suspicious activity,
an analyst exports that person's (or their team's) logon history and needs a first-pass read on
whether anything stands out — before deciding whether a deeper investigation is warranted. This
is the exact problem the CERT insider-threat research dataset this project trains on was built to
study.

Rather than making an analyst scan thousands of raw log rows, CloudGuard uploads the export,
scores every event against a historical behavioral baseline, and returns a **per-subject risk
summary** — who looks unusual, why, and which specific moments to look at first — with the raw
scored rows available underneath as supporting detail.

The project also demonstrates secure cloud architecture, event-driven backend design, and
practical machine-learning inference in production — but those are how it's built, not why it
exists.

---

## What This Project Does (High Level)

1. An analyst exports a flagged employee's (or team's) logon history and uploads it (CSV)
2. The file is stored durably in cloud storage and scoring runs automatically in the background
3. Each event is scored against a historical baseline of real access patterns (isolation forest,
   trained on real logon data — not just "rare in this file")
4. Per-user risk is aggregated into an investigative summary: unusual machines accessed, off-hours
   activity, and the specific flagged events worth reviewing first
5. The frontend surfaces that summary as the primary view — not a flat table of scores

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
- File is stored as `logs/<upload_id>.csv`
- The upload automatically enqueues a message onto a Service Bus queue (`analyze-job`) — no
  separate "analyze" call from the frontend, ever

### 2. Analyze (automatic, background)
The queue message triggers `analyze_worker` (Service Bus trigger) — this is the *only* scoring
path in the system:
- Parses the queue message
- Downloads the CSV from `logs/<upload_id>.csv`
- Calls the AI scoring contract: `score_csv_bytes(raw_csv, upload_id)`
- Writes outputs to `results/scored/<upload_id>.csv` and `results/summary/<upload_id>.json`

Because this runs off an HTTP request entirely, it can take as long as it needs to without
timing out a user's request, and failures are retried automatically by Azure Functions.

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

**Rarity is measured against a historical baseline, not within the uploaded file itself.** The
frequency counts above are computed once from a full historical dataset at training time and
frozen into the model artifact — so a user/PC that's genuinely common historically won't get
flagged just because it only appears once in a small investigative export, and a machine that's
never appeared in the baseline at all is correctly treated as maximally unusual. This matters
specifically for the offboarding use case: the file being analyzed is often a small, targeted
export for one person, not a representative sample on its own.

### Model
- **Isolation Forest**
- Trained without labels (unsupervised)
- Learns what "normal" activity looks like
- Produces a continuous anomaly score per row

### Scoring Output
Each row in the scored CSV includes:
- `anomaly_score` (float, higher = more suspicious)
- `is_anomaly` (0/1 based on percentile threshold)
- `model_version` (e.g., `iforest-v1`)
- `scored_at` (UTC timestamp)

### Subject Risk Summary (the primary output)
Row-level scores answer "which events are weird." The question an investigator actually needs
answered is "was **this person's** behavior weird" — so scoring also aggregates per user:
- **Risk score** — the single most anomalous event for that person (one bad moment should drive
  attention, not get averaged away by mostly-normal activity)
- **New machines** — PCs this person has never used before, historically — a classic
  lateral-movement/unusual-access signal
- **Off-hours rate** — what fraction of their activity in this export falls outside normal
  working hours
- **Top flagged events** — the specific moments worth reviewing first

The dashboard shows this per-subject summary first, with the raw scored rows available
underneath as supporting detail — not the other way around.

---

## Repository Structure

<img width="330" height="403" alt="image" src="https://github.com/user-attachments/assets/c350d611-cc8b-4067-88a3-06cbc3bd72a0" />


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
- Uses environment variable: `VITE_API_BASE=https://<backend>/api`

### Backend
- Python Azure Functions runtime
- Automatically redeployed when backend code changes
- Observability enabled via Application Insights

---

## Why This Project Matters

It's built around a real, named security workflow (insider-threat/offboarding investigation
triage), not a generic "upload a file, get a score" demo — and demonstrates:
- A real problem statement with a concrete before/after (manually scanning thousands of log rows
  vs. a ranked per-subject risk summary)
- Baseline-relative anomaly detection against real historical data, not just within-batch rarity
- Secure cloud-native, event-driven backend architecture (Azure Functions + Service Bus)
- Clean separation of concerns (UI / API / ML) and practical ML inference in production

---

## Future Improvements
- Support additional log types (HTTP, device, auth)
- Store models in Blob Storage instead of repo
- Case-management workflow: investigator notes, dismiss/confirm state on flagged subjects,
  linking multiple uploads into one ongoing investigation
- A quantified accuracy evaluation against labeled ground-truth data, if obtainable for this
  dataset (right now there's no way to know precision/recall, only that scores look plausible)
- Model versioning and drift detection as the baseline ages
- Visualization dashboards for anomaly trends over time

---
