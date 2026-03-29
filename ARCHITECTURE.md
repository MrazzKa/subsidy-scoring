# Architecture — SubsidyScore AI

## System Overview

SubsidyScore AI is a merit-based scoring system that ranks agricultural subsidy applications using a composite score combining ML predictions with domain-specific heuristics.

## Pipeline Flow

```
GISS Data (xlsx)
    │
    ├── load_data()        → Raw DataFrame (36,651 rows, 11 cols)
    ├── parse_dates()      → + 7 temporal features
    ├── create_target()    → Binary target from status field
    ├── engineer_features()→ + 23 ML features (5 groups)
    ├── prepare_model_data() → X matrix + label encoders
    │
    ├── SubsidyScoringModel.train()
    │   ├── GradientBoosting (5-fold CV)
    │   ├── RandomForest (5-fold CV)
    │   └── LogisticRegression (5-fold CV, scaled)
    │
    ├── predict_score()    → ML Score [0-100]
    │
    ├── MeritScorer.score_dataframe()
    │   ├── Efficiency  (0.3) — request adequacy vs norms
    │   ├── Reliability (0.2) — applicant behavior patterns
    │   ├── Need        (0.2) — regional need assessment
    │   └── ML Score    (0.3) — ensemble prediction
    │
    └── Output: ranking.csv, dashboard_data.json, model_results.json
```

## Composite Merit Score

The key differentiator is the composite score that goes beyond pure ML prediction:

- **Efficiency Score**: How well the requested amount aligns with category norms. Applications requesting typical amounts score higher.
- **Reliability Score**: Based on submission timing (working hours, weekdays) and regional approval history.
- **Need Score**: Regions with fewer subsidies per capita score higher. Matching regional agricultural specialization adds points.
- **ML Score**: Ensemble probability of approval based on all 23 features.

## Data Leakage Mitigation

Approval rate features (region, direction, category) use **leave-one-out encoding**: each row's rate is computed excluding itself, preventing information from the target leaking into features.

## Explainability

Every application gets:
1. A composite score (0-100)
2. Component breakdown (efficiency, reliability, need, ML)
3. Top-5 contributing features with importance values
4. Risk classification (recommended / low_risk / medium_risk / high_risk)

This ensures the commission understands **why** each application scored as it did.

## Human-in-the-Loop

The system **recommends** but does not **decide**. The ranking and explanations serve as decision support for the subsidy commission. Final approval authority remains with humans.
