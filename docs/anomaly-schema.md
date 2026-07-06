# Anomaly Scoring Output (v1)

The current model (`iforest-v1`, an unsupervised `IsolationForest` — see
`ml/anomaly_model.py` / `backend/ai/scorer.py`) does not classify anomalies into named
categories. It produces one continuous score per row and a threshold-based flag.

Trained via `ml/train_model.py --csv ml/data/logon.csv` against a real CERT-style logon dataset
(not committed — 241MB, gitignored under `ml/data/`); the resulting artifact is exported to
`backend/models/logon_iforest_v1.joblib`, which is what production actually loads.

## Per-row output columns
Appended to every row of `results/scored/<upload_id>.csv` (on top of the original
`id`/`date`/`user`/`pc`/`activity` columns from `docs/log-schema.md`):

| Column | Type | Meaning |
|---|---|---|
| `anomaly_score` | float | Higher = more suspicious. Inverted `IsolationForest.decision_function` output. |
| `is_anomaly` | int (0/1) | 1 if `anomaly_score` is at or above the threshold. |
| `model_version` | string | e.g. `iforest-v1`, or `dummy-v0` if the model/schema fallback kicked in. |
| `scored_at` | string | ISO8601 UTC timestamp of scoring. |

## Threshold
The threshold marks the top 1% of scores as anomalies (`np.quantile(scores, 0.99)`), computed
per upload. Files with fewer than 200 rows skip thresholding entirely (`threshold = None`,
nothing flagged) to avoid marking everything as anomalous on tiny samples.

## What actually drives the score
Feature engineering (`ml/feature_engineering.py` / `backend/ai/features_logon.py`) builds these
inputs per row from the logon schema — the model has no concept of the categories below, it just
learns what combinations of these features are rare:

- Time features: hour, day of week, weekend flag
- Activity type: is_logon / is_logoff
- Frequency features: how often the user appears, how often the PC appears, how often that
  (user, PC) pair appears — and their inverses (rarity)

In practice this tends to surface things like a rare user→PC combination, an unusual login hour,
or a user/PC seen very few times overall — but there is no separate detector or label for any of
those; it's all folded into the single `anomaly_score`.

**Rarity is baseline-relative, not within-batch.** The frequency counts above are computed once
from the full training set (`ml/feature_engineering.py:build_baseline_counts`) and frozen into
the model artifact alongside the trained `IsolationForest` — production scoring looks up each
row's user/PC/pair against that historical baseline, not against whatever else happens to be in
the file being scored. A user/PC that's genuinely common historically won't get flagged just
because it only appears once or twice in a small upload; a user/PC the baseline has never seen at
all is treated as maximally rare, which is exactly the right signal for a brand-new entity.

## Fallback ("dummy") mode
If the model artifact is missing at `backend/models/logon_iforest_v1.joblib`, or the uploaded CSV
doesn't match the expected logon schema (missing `date`/`user`/`pc`/`activity`), scoring falls
back to `anomaly_score=0.0`, `is_anomaly=0`, `model_version="dummy-v0"` for every row rather than
erroring. Check the `notes` field in the summary JSON if scores look suspiciously flat. The
dummy path also produces an empty `subjects` list (see below) rather than omitting the field.

## Per-subject investigative summary (`summary.subjects`)
Row-level scores answer "which events are weird." `backend/ai/investigation.py:
build_subject_summaries` answers the question an investigator actually has: "was **this person's**
behavior weird." Computed by grouping the scored rows by `user`, sorted by `risk_score` descending
and capped at 50 subjects:

| Field | Type | Meaning |
|---|---|---|
| `user` | string | The subject. |
| `event_count` | int | Rows for this user in this upload. |
| `distinct_pcs` | int | Distinct machines they logged into in this upload. |
| `new_pcs` | list[string] | Machines with **zero** historical count in the baseline's `user_pc_counts` — genuinely never used before, not just rare. |
| `off_hours_pct` | float | % of this user's rows with `hour < 7 or hour > 19` or a weekend date. |
| `risk_score` | float | `max(anomaly_score)` across their rows — one bad moment drives the headline number rather than getting averaged away. |
| `mean_anomaly_score` | float | Supporting context alongside `risk_score`. |
| `flagged_events` | list | Their top ~10 rows by `anomaly_score` (date, pc, activity, score) — the specific moments to review first. |

This is purely a reporting/aggregation layer over already-scored data plus the same frozen
baseline used for row-level scoring — it doesn't require retraining and doesn't touch `ml/`.
