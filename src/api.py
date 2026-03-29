"""
SubsidyScore AI — FastAPI Server
Эндпоинты для скоринга, рейтинга, explainability.
"""

import json
from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

OUTPUT_DIR = Path(__file__).resolve().parent.parent / "outputs"

app = FastAPI(
    title="SubsidyScore AI",
    description="Merit-based scoring system for agricultural subsidies",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------- Загрузка данных при старте ----------

_ranking: pd.DataFrame = pd.DataFrame()
_dashboard: dict = {}
_model_results: dict = {}
_feature_importance: pd.DataFrame = pd.DataFrame()


def _load_outputs():
    global _ranking, _dashboard, _model_results, _feature_importance
    if (OUTPUT_DIR / "ranking.csv").exists():
        _ranking = pd.read_csv(OUTPUT_DIR / "ranking.csv")
    if (OUTPUT_DIR / "dashboard_data.json").exists():
        with open(OUTPUT_DIR / "dashboard_data.json", encoding="utf-8") as f:
            _dashboard = json.load(f)
    if (OUTPUT_DIR / "model_results.json").exists():
        with open(OUTPUT_DIR / "model_results.json", encoding="utf-8") as f:
            _model_results = json.load(f)
    if (OUTPUT_DIR / "feature_importance.csv").exists():
        _feature_importance = pd.read_csv(OUTPUT_DIR / "feature_importance.csv")


@app.on_event("startup")
async def startup():
    _load_outputs()


# ---------- Endpoints ----------

@app.get("/")
def health():
    return {"status": "ok", "service": "SubsidyScore AI", "version": "1.0.0"}


@app.get("/api/stats")
def stats():
    if _dashboard and "overview" in _dashboard:
        return _dashboard["overview"]
    return {"error": "No data loaded. Run pipeline first."}


@app.get("/api/ranking")
def ranking(
    region: Optional[str] = Query(None),
    direction: Optional[str] = Query(None),
    min_score: float = Query(0),
    limit: int = Query(50),
    offset: int = Query(0),
):
    if _ranking.empty:
        raise HTTPException(404, "No ranking data. Run pipeline first.")

    df = _ranking.copy()
    score_col = "merit_score" if "merit_score" in df.columns else "ml_score"

    if region:
        df = df[df["region"].str.contains(region, case=False, na=False)]
    if direction:
        df = df[df["direction"].str.contains(direction, case=False, na=False)]
    if min_score > 0:
        df = df[df[score_col] >= min_score]

    df = df.sort_values(score_col, ascending=False)
    total = len(df)
    df = df.iloc[offset : offset + limit]

    records = df[
        [c for c in ["request_num", "region", "direction", "amount",
                      "ml_score", "merit_score", "risk_level", "merit_risk_level",
                      "rank", "merit_rank"] if c in df.columns]
    ].to_dict(orient="records")

    return {"total": total, "offset": offset, "limit": limit, "data": records}


@app.get("/api/explain/{request_id}")
def explain(request_id: str):
    if _ranking.empty:
        raise HTTPException(404, "No data.")

    row = _ranking[_ranking["request_num"].astype(str) == request_id]
    if row.empty:
        row = _ranking[_ranking["id"].astype(str) == request_id]
    if row.empty:
        raise HTTPException(404, f"Application {request_id} not found.")

    r = row.iloc[0]
    score_col = "merit_score" if "merit_score" in r.index else "ml_score"
    risk_col = "merit_risk_level" if "merit_risk_level" in r.index else "risk_level"

    result = {
        "request_num": str(r.get("request_num", "")),
        "region": r.get("region", ""),
        "direction": r.get("direction", ""),
        "amount": float(r.get("amount", 0)),
        "score": round(float(r.get(score_col, 0)), 2),
        "risk_level": r.get(risk_col, ""),
    }

    # Компоненты скора
    for comp in ["ml_score", "efficiency_score", "reliability_score", "need_score", "merit_score"]:
        if comp in r.index:
            result[comp] = round(float(r[comp]), 2)

    return result


class ScoreRequest(BaseModel):
    region: str
    direction: str
    subsidy_name: str
    normative: float
    amount: float
    district: str
    hour: int = 12
    month: int = 1
    day_of_week: int = 0


@app.post("/api/score")
def score_single(req: ScoreRequest):
    """Скоринг одной заявки (упрощённый — на основе похожих заявок)."""
    if _ranking.empty:
        raise HTTPException(404, "No data.")

    # Находим похожие заявки
    df = _ranking
    similar = df[df["direction"].str.contains(req.direction[:10], case=False, na=False)]
    if similar.empty:
        similar = df

    score_col = "merit_score" if "merit_score" in df.columns else "ml_score"
    avg = float(similar[score_col].mean())
    return {
        "estimated_score": round(avg, 2),
        "based_on": len(similar),
        "note": "Estimate based on similar applications. Run full pipeline for precise scoring.",
    }


@app.get("/api/model/info")
def model_info():
    if not _model_results:
        return {"error": "No model results."}
    return {"models": _model_results, "ensemble_weights": {"GradientBoosting": 0.5, "RandomForest": 0.3, "LogisticRegression": 0.2}}


@app.get("/api/features")
def features():
    if _feature_importance.empty:
        return {"error": "No feature importance data."}
    return _feature_importance.to_dict(orient="records")


# ---------- Запуск ----------

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
