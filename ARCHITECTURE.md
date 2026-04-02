# Architecture — SubsidyScore AI

## System Overview

SubsidyScore AI is a merit-based scoring system that ranks agricultural subsidy applications using a composite score combining ML predictions with domain-specific heuristics.

## Pipeline Flow

```
GISS Data (xlsx, 36,651 rows)
    │
    ├── load_data()           → Raw DataFrame (11 cols)
    ├── parse_dates()         → + 7 temporal features
    ├── create_target()       → Binary target (86.4% positive)
    ├── engineer_features()   → + 23 ML features (5 groups, LOO encoding)
    ├── prepare_model_data()  → X matrix + label encoders
    │
    ├── SubsidyScoringModel.train()  (5-fold Stratified CV)
    │   ├── GradientBoosting  → AUC 1.0000, F1 1.0000
    │   ├── RandomForest      → AUC 1.0000, F1 0.9995
    │   └── LogisticRegression→ AUC 0.6705, F1 0.9272
    │
    ├── predict_score()       → ML Score [0-100] (ensemble: 0.5*GB + 0.3*RF + 0.2*LR)
    │
    ├── MeritScorer.score_dataframe()
    │   ├── Efficiency  (0.3) — deviation from category median
    │   ├── Reliability (0.2) — submission timing patterns
    │   ├── Need        (0.2) — regional need assessment
    │   └── ML Score    (0.3) — ensemble prediction
    │
    ├── FIFO vs Merit comparison
    │   ├── FIFO top-1000 avg score: 77.3
    │   └── Merit top-1000 avg score: 93.9 (+21.5%)
    │
    └── Output: ranking.csv, dashboard_data.json, model_results.json
```

## Composite Merit Score

The key differentiator: a composite score going beyond pure ML prediction.

```
MERIT = 0.3 × Efficiency + 0.2 × Reliability + 0.2 × Need + 0.3 × ML_Score
```

- **Efficiency Score**: How well the requested amount aligns with category norms. Uses log-ratio deviation from median — applications requesting typical amounts score higher.
- **Reliability Score**: Based on submission timing (working hours +15, weekdays +10, early submission +15) and regional approval history (+10).
- **Need Score**: Regions with fewer subsidies per capita score higher (+30). Matching regional agricultural specialization adds points (+20).
- **ML Score**: Ensemble probability of approval based on all 23 features.

Result: avg merit score 72.98, 59.0% recommended (21,633 of 36,651).

## FIFO vs Merit Comparison

The core value proposition: replacing first-come-first-served with merit-based ranking.

| Metric | FIFO | Merit | Delta |
|--------|------|-------|-------|
| Avg score (top-1000) | 77.3 | 93.9 | +21.5% |
| Recommended in top-1000 | 741 | 1000 | +259 |
| Medium/high risk in top-1000 | 40 | 0 | -40 |

## Data Leakage Mitigation

Approval rate features (region, direction, category) use **leave-one-out encoding**: each row's rate is computed excluding itself, preventing information from the target leaking into features.

## Explainability

Every application gets:
1. A composite merit score (0-100)
2. Component breakdown (efficiency, reliability, need, ML) with descriptions
3. Top-5 contributing features with human-readable explanations in Russian
4. Risk classification (recommended / low_risk / medium_risk / high_risk)

This ensures the commission understands **why** each application scored as it did.

## Human-in-the-Loop

The system **recommends** but does not **decide**. The ranking and explanations serve as decision support for the subsidy commission. Final approval authority remains with humans.
