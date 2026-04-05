# Architecture — SubsidyScore AI

## System Overview

SubsidyScore AI — merit-based scoring система для сельскохозяйственных субсидий Казахстана. Заменяет FIFO-подход на 5-компонентный Merit Score с интеграцией НПА РК.

## Pipeline Flow

```
GISS Data (xlsx, 36,651 rows)
    │
    ├── load_data()               → Raw DataFrame (11 cols)
    ├── parse_dates()             → + temporal features
    ├── create_target()           → Binary target (86.4% positive)
    ├── engineer_features()       → + 26 ML features (6 groups)
    │   └── add_regulatory_features()  → +3 НПА-features
    ├── prepare_model_data()      → X matrix + hash encoders
    │
    ├── SubsidyScoringModel.train()  (5-fold Stratified CV)
    │   ├── GradientBoosting     (w=0.5)
    │   ├── RandomForest         (w=0.3)
    │   └── LogisticRegression   (w=0.2)
    │
    ├── temporal_validate()       → 80/20 by date split
    ├── detect_anomalies()        → IsolationForest (3%)
    │
    ├── MeritScorer.score_dataframe()
    │   ├── Efficiency    (0.25) — deviation from category median
    │   ├── Reliability   (0.15) — submission timing patterns
    │   ├── Need          (0.15) — regional need assessment
    │   ├── Regulatory    (0.15) — НПА РК compliance
    │   └── ML Score      (0.30) — ensemble prediction
    │
    ├── Fairness Audit            → CV between regions
    ├── FIFO vs Merit comparison
    │
    └── Output:
        ├── ranking.csv           — Full ranking with all scores
        ├── dashboard_data.json   — Dashboard data (overview, stats, fairness, NPA)
        ├── model_results.json    — CV metrics
        ├── feature_importance.csv
        └── trained_model.joblib  — Serialized model for API
```

## Composite Merit Score

```
MERIT = 0.25 × Efficiency + 0.15 × Reliability + 0.15 × Need + 0.15 × Regulatory + 0.30 × ML
```

- **Efficiency Score**: Log-ratio deviation from category median. Applications with typical amounts score higher.
- **Reliability Score**: Working hours (+15), weekdays (+10), early submission (+15), regional approval rate (+10).
- **Need Score**: Regions with fewer applications score higher (+30). Matching regional specialization (+20).
- **Regulatory Score**: Direction in NPA (+20), priority level (+10/+5), normative in range (+15), pasture capacity (+5/+10). Based on V1500011064, V1900018404, V1500012488.
- **ML Score**: Ensemble probability of approval × 100.

## Regulatory Framework (НПА РК)

НПА integrates at two levels:

**Level A — ML Features** (model learns from normative context):
- `is_priority_direction`: Priority of livestock direction (high=3, medium=2, low=1, none=0)
- `normative_in_npa_range`: Whether normative falls within NPA-defined range (1=in, -1=out, 0=N/A)
- `pasture_capacity`: Pasture carrying capacity of the region's zone (0.08-0.80)

**Level B — Composite Score** (Regulatory Score component):
- Direction recognition (+20)
- Priority bonus (high +10, medium +5)
- Normative range check (+15 in range, -5 far out)
- Pasture zone suitability (+5/+10 for livestock directions)

## Data Flow — API

```
Client (React Dashboard)
    │
    ├── GET /api/stats          → Full dashboard data (cached from pipeline)
    ├── GET /api/ranking        → Paginated, filtered ranking from ranking.csv
    ├── GET /api/explain/{id}   → Score breakdown + regulatory explanation + tips
    ├── POST /api/score         → Real-time scoring through trained model
    ├── GET /api/budget-simulation → FIFO vs Merit budget comparison
    ├── GET /api/regulatory/info → Full NPA reference data
    ├── POST /api/upload/preview → Column mapping preview
    ├── POST /api/upload        → Upload + background pipeline run
    ├── POST /api/chat          → AI assistant (Groq/Llama 3.3)
    └── GET /api/export/ranking → Excel/CSV export
```

## Smart Column Mapper

Enables uploading arbitrary data files with different column names:
1. Exact match against known aliases (Russian/English)
2. Fuzzy matching via SequenceMatcher (threshold 0.55)
3. Reports mapping confidence and unmatched required columns

## Anomaly Detection

IsolationForest (contamination=3%) on the full 26-feature space. Anomalous applications are flagged in ranking and dashboard.

## Fairness Audit

Coefficient of Variation (CV) across regional average Merit Scores. CV < 10% considered fair. Dashboard shows per-region breakdown of recommendation rates.

## Human-in-the-Loop

The system recommends but does not decide. The ranking and explanations serve as decision support for the subsidy commission. Final approval authority remains with humans.
