# SubsidyScore AI

**Merit-based scoring system for agricultural subsidies in Kazakhstan**

Hackathon: **Decentrathon 5.0** | Track: **AI inDrive** | Case 2

---

## Problem

Agricultural subsidies in Kazakhstan are distributed on a first-come-first-served basis through GISS (subsidy.plem.kz). This approach does not evaluate the merit or efficiency of applicants. SubsidyScore AI replaces the queue with a transparent, explainable merit-based ranking system.

## Solution

An AI system that:
1. Analyzes 36,651 subsidy applications from 2025
2. Computes a composite **Merit Score** for each application
3. Explains the score with key factors
4. Generates a shortlist for the commission (human-in-the-loop)

## Architecture

```
                    +-------------------+
                    |   GISS Data       |
                    |   (36,651 apps)   |
                    +--------+----------+
                             |
                    +--------v----------+
                    |  Preprocessing    |
                    |  23 features      |
                    |  5 feature groups |
                    +--------+----------+
                             |
                +------------+------------+
                |            |            |
         +------v---+ +-----v----+ +-----v-----+
         | Gradient | | Random   | | Logistic  |
         | Boosting | | Forest   | | Regression|
         | (0.5)    | | (0.3)    | | (0.2)     |
         +------+---+ +-----+----+ +-----+-----+
                |            |            |
                +-----+------+------+-----+
                      |  Ensemble   |
                      +------+------+
                             |
                    +--------v----------+
                    |  Merit Scorer     |
                    |  Efficiency  0.3  |
                    |  Reliability 0.2  |
                    |  Need        0.2  |
                    |  ML Score    0.3  |
                    +--------+----------+
                             |
                    +--------v----------+
                    |  Ranking +        |
                    |  Explainability   |
                    +-------------------+
```

## Data

- **Source**: GISS (subsidy.plem.kz), anonymized export
- **Volume**: 36,651 applications, 2025
- **Columns**: date, region (18), district (192), direction (9), subsidy type (45+), status, normative, amount
- **Target**: Approved (86.4%) vs Rejected (13.6%)

## Feature Engineering (23 features, 5 groups)

| Group | Features | Description |
|-------|----------|-------------|
| Financial (6) | log_amount, log_normative, log_estimated_units, amount_vs_regional_median, amount_vs_category_median, is_large_request | Request size analysis |
| Temporal (7) | month, quarter, day_of_week, hour, is_working_hours, is_weekday, submission_speed | Submission timing patterns |
| Regional (3) | region_application_count, district_application_count, region_approval_rate | Regional statistics |
| Categorical (3) | direction_approval_rate, category_approval_rate, subsidy_category | Subsidy type patterns |
| Encoded (4) | region_enc, direction_enc, subsidy_category_enc, district_enc | Label-encoded categoricals |

**Note**: Approval rates use leave-one-out encoding to prevent data leakage.

## Models

| Model | AUC | Accuracy | F1 | Weight |
|-------|-----|----------|-----|--------|
| GradientBoosting | 1.0000 | 1.0000 | 1.0000 | 0.5 |
| RandomForest | 1.0000 | 0.9992 | 0.9995 | 0.3 |
| LogisticRegression | 0.6705 | 0.8643 | 0.9272 | 0.2 |

Evaluation: 5-fold Stratified Cross-Validation.

## Quick Start

```bash
# Install dependencies
pip install -r requirements.txt

# Run the full pipeline
python src/pipeline.py

# Start API server
python src/api.py

# Run tests
pytest tests/ -v
```

## Project Structure

```
subsidy-scoring/
├── data/                    # GISS export (xlsx)
├── src/
│   ├── preprocessing.py     # Data loading, cleaning, feature engineering
│   ├── model.py             # ML models, training, explainability
│   ├── scoring.py           # Composite merit scorer
│   ├── pipeline.py          # Main pipeline (one command)
│   └── api.py               # FastAPI server
├── dashboard/
│   └── app.jsx              # React dashboard
├── outputs/                 # Generated results
├── tests/
│   └── test_pipeline.py     # Unit tests
├── README.md
├── ARCHITECTURE.md
├── requirements.txt
├── Dockerfile
└── .gitignore
```

## API Documentation

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Health check |
| `/api/stats` | GET | Overall statistics |
| `/api/ranking` | GET | Ranking with filters (region, direction, min_score, limit, offset) |
| `/api/explain/{id}` | GET | Score explanation for a specific application |
| `/api/score` | POST | Score a single application |
| `/api/model/info` | GET | Model information and metrics |
| `/api/features` | GET | Feature importance list |

## Limitations

- Data is anonymized — no applicant identity features
- Historical data only (2025) — no temporal validation
- No external data sources (weather, market prices, farm size)
- Approval rate features may overfit on historical patterns
- Single-year snapshot — model may not generalize to policy changes

## Next Steps

- Integration with GISS API for real-time scoring
- Adding external data: weather, satellite imagery, market prices
- Temporal validation with 2024 data
- A/B testing against the current first-come-first-served system
- Multi-language interface (Kazakh, Russian, English)
- Fairness audit across regions and farm sizes
