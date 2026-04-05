"""
SubsidyScore AI — FastAPI Server (Production)
"""
import json, os, io, datetime
from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd
import joblib
from fastapi import FastAPI, HTTPException, Query, UploadFile, File, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel

OUTPUT_DIR = Path(__file__).resolve().parent.parent / "outputs"
DATA_DIR = Path(__file__).resolve().parent.parent / "data"

app = FastAPI(title="SubsidyScore AI", description="Merit-based scoring for agricultural subsidies", version="2.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# ── State ──
_ranking = pd.DataFrame()
_dashboard = {}
_model_results = {}
_feature_importance = pd.DataFrame()
_trained_model = None
_merit_scorer = None
_pipeline_status = {"running": False, "progress": "", "error": None, "last_run": None}

def _load_outputs():
    global _ranking, _dashboard, _model_results, _feature_importance, _trained_model, _merit_scorer
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
    if (OUTPUT_DIR / "trained_model.joblib").exists():
        saved = joblib.load(str(OUTPUT_DIR / "trained_model.joblib"))
        from src.model import SubsidyScoringModel
        _trained_model = SubsidyScoringModel()
        _trained_model.models = saved["models"]
        _trained_model.scaler = saved["scaler"]
        _trained_model.feature_cols = saved["feature_cols"]
        _trained_model.importances = saved["importances"]
        if not _ranking.empty:
            from src.scoring import MeritScorer
            _merit_scorer = MeritScorer()
            _merit_scorer.fit(_ranking)

@app.on_event("startup")
async def startup():
    _load_outputs()

# ── Health ──
@app.get("/")
def health():
    return {"status": "ok", "service": "SubsidyScore AI", "version": "2.0.0", "has_model": _trained_model is not None, "total_applications": len(_ranking)}

# ── Dashboard data ──
@app.get("/api/stats")
def stats():
    if not _dashboard:
        raise HTTPException(404, "No data. Run pipeline first.")
    return _dashboard

# ── Ranking ──
@app.get("/api/ranking")
def ranking(region: Optional[str]=Query(None), direction: Optional[str]=Query(None), min_score: float=Query(0), max_score: float=Query(100), risk_level: Optional[str]=Query(None), search: Optional[str]=Query(None), anomaly_only: bool=Query(False), limit: int=Query(50), offset: int=Query(0)):
    if _ranking.empty:
        raise HTTPException(404, "No data.")
    df = _ranking.copy()
    sc = "merit_score" if "merit_score" in df.columns else "ml_score"
    rc = "merit_risk_level" if "merit_risk_level" in df.columns else "risk_level"
    if region: df = df[df["region"].str.contains(region, case=False, na=False)]
    if direction: df = df[df["direction"].str.contains(direction, case=False, na=False)]
    if min_score > 0: df = df[df[sc] >= min_score]
    if max_score < 100: df = df[df[sc] <= max_score]
    if risk_level: df = df[df[rc] == risk_level]
    if search:
        rns = df["request_num"].astype(str).str.replace(r'\.0$','',regex=True)
        df = df[rns.str.contains(search, na=False)]
    if anomaly_only and "is_anomaly" in df.columns: df = df[df["is_anomaly"]==True]
    df = df.sort_values(sc, ascending=False)
    total = len(df)
    page = df.iloc[offset:offset+limit]
    cols = [c for c in ["request_num","region","district","direction","amount","ml_score","merit_score","merit_risk_level","merit_rank","is_anomaly"] if c in page.columns]
    return {"total": total, "offset": offset, "limit": limit, "data": page[cols].to_dict(orient="records")}

def _safe_float(v, default=0.0):
    """Convert to float safely, replacing NaN/Inf with default."""
    try:
        f = float(v)
        if np.isnan(f) or np.isinf(f): return default
        return f
    except (ValueError, TypeError): return default

# ── Explain ──
@app.get("/api/explain/{request_id}")
def explain(request_id: str):
    if _ranking.empty: raise HTTPException(404, "No data.")
    rns = _ranking["request_num"].astype(str).str.replace(r'\.0$','',regex=True)
    rid = str(request_id).replace('.0','')
    row = _ranking[rns == rid]
    if row.empty:
        ids = _ranking["id"].astype(str).str.replace(r'\.0$','',regex=True)
        row = _ranking[ids == rid]
    if row.empty: raise HTTPException(404, f"Application {request_id} not found.")
    r = row.iloc[0]
    sc = "merit_score" if "merit_score" in r.index else "ml_score"
    result = {"request_num": str(r.get("request_num","")), "region": str(r.get("region","")), "direction": str(r.get("direction","")), "amount": round(_safe_float(r.get("amount",0)),2), "score": round(_safe_float(r.get(sc,0)),2), "risk_level": str(r.get("merit_risk_level", r.get("risk_level","")))}
    for comp in ["ml_score","efficiency_score","reliability_score","need_score","regulatory_score","merit_score"]:
        if comp in r.index:
            val = _safe_float(r[comp])
            result[comp] = round(val, 2)
    from src.regulatory import compute_regulatory_score, get_regulatory_explanation
    result["regulatory_score"] = round(_safe_float(compute_regulatory_score(r)),2)
    result["regulatory_explanation"] = get_regulatory_explanation(r)
    if _merit_scorer:
        from src.scoring import generate_improvement_tips
        result["improvement_tips"] = generate_improvement_tips(r, _merit_scorer)
    return result

# ── Real scoring ──
class ScoreRequest(BaseModel):
    region: str; direction: str; subsidy_name: str = ""; normative: float; amount: float; district: str = ""; hour: int = 12; month: int = 1; day_of_week: int = 0

@app.post("/api/score")
def score_single(req: ScoreRequest):
    """Реальный скоринг одной заявки через обученную ML-модель."""
    if _trained_model is None:
        raise HTTPException(503, "Model not loaded. Run pipeline first.")
    from src.preprocessing import extract_subsidy_category
    from src.regulatory import compute_regulatory_score, get_regulatory_explanation, PRIORITY_MAP, LIVESTOCK_NORMS, PASTURE_ZONES, REGION_ZONES
    subsidy_cat = extract_subsidy_category(req.subsidy_name)
    est_units = req.amount / req.normative if req.normative > 0 else 0
    # Build features
    f = {}
    f["log_amount"] = np.log1p(req.amount)
    f["log_normative"] = np.log1p(req.normative)
    f["log_estimated_units"] = np.log1p(est_units)
    if not _ranking.empty:
        rm = _ranking[_ranking["region"]==req.region]["amount"].median()
        f["amount_vs_regional_median"] = req.amount / rm if rm and rm > 0 else 1
        cm = _ranking[_ranking.get("subsidy_category",pd.Series())==subsidy_cat]["amount"].median() if "subsidy_category" in _ranking.columns else req.amount
        f["amount_vs_category_median"] = req.amount / cm if cm and cm > 0 else 1
        thr = _ranking["amount"].quantile(0.9)
        f["is_large_request"] = 1 if req.amount >= thr else 0
    else:
        f["amount_vs_regional_median"] = f["amount_vs_category_median"] = 1.0; f["is_large_request"] = 0
    f["normative_amount_ratio"] = req.normative / req.amount if req.amount > 0 else 0
    f["month"] = req.month; f["quarter"] = (req.month-1)//3+1; f["day_of_week"] = req.day_of_week; f["day_of_month"] = 15; f["hour"] = req.hour
    f["is_working_hours"] = 1 if 9<=req.hour<=17 else 0; f["is_weekday"] = 1 if req.day_of_week<5 else 0; f["submission_speed"] = 0.5; f["is_early_submission"] = 0
    f["region_application_count"] = len(_ranking[_ranking["region"]==req.region]) if not _ranking.empty else 1000
    f["district_application_count"] = len(_ranking[_ranking["district"]==req.district]) if not _ranking.empty and "district" in _ranking.columns else 100
    f["month_application_count"] = len(_ranking[_ranking["month"]==req.month]) if not _ranking.empty and "month" in _ranking.columns else 5000
    # NPA features
    f["is_priority_direction"] = PRIORITY_MAP.get(LIVESTOCK_NORMS.get(req.direction,{}).get("priority",""),0)
    norms = LIVESTOCK_NORMS.get(req.direction)
    f["normative_in_npa_range"] = 0
    if norms and req.normative > 0:
        lo,hi = norms["normative_range"]
        f["normative_in_npa_range"] = 1 if lo<=req.normative<=hi else -1
    f["pasture_capacity"] = PASTURE_ZONES.get(REGION_ZONES.get(req.region,""),{}).get("norm",0.0)
    # Encoded
    f["region_enc"] = hash(req.region)%6; f["direction_enc"] = hash(req.direction)%5; f["subsidy_category_enc"] = hash(subsidy_cat)%6; f["district_enc"] = hash(req.district)%20
    # Build X
    X = np.array([[f.get(c,0) for c in _trained_model.feature_cols]], dtype=np.float64)
    X = np.nan_to_num(X, nan=0.0, posinf=0.0, neginf=0.0)
    ml_score = float(_trained_model.predict_score(X)[0])
    # Merit components
    row_s = pd.Series({**{"direction": req.direction, "region": req.region, "normative": req.normative, "amount": req.amount, "subsidy_category": subsidy_cat, "estimated_units": est_units, "ml_score": ml_score, "is_working_hours": f["is_working_hours"], "is_weekday": f["is_weekday"], "submission_speed": f["submission_speed"], "region_approval_rate": 0.86}})
    if _merit_scorer:
        eff = _merit_scorer.compute_efficiency_score(row_s); rel = _merit_scorer.compute_reliability_score(row_s); need = _merit_scorer.compute_need_score(row_s)
    else:
        eff=rel=need=50.0
    reg = compute_regulatory_score(row_s)
    merit = float(np.clip(0.25*eff + 0.15*rel + 0.15*need + 0.15*reg + 0.30*ml_score, 0, 100))
    risk = "recommended" if merit>=70 else ("low_risk" if merit>=50 else ("medium_risk" if merit>=30 else "high_risk"))
    return {
        "merit_score": round(merit,2), "risk_level": risk,
        "components": {"efficiency": round(eff,2), "reliability": round(rel,2), "need": round(need,2), "regulatory": round(reg,2), "ml_score": round(ml_score,2)},
        "regulatory_explanation": get_regulatory_explanation(row_s),
        "recommendation": "Рекомендована к рассмотрению комиссией" if risk=="recommended" else ("Требует дополнительной проверки" if risk=="low_risk" else "Высокий риск — рекомендуется отклонить"),
    }

# ── Budget simulation ──
@app.get("/api/budget-simulation")
def budget_sim(budget: float = Query(1_000_000_000)):
    if _ranking.empty: raise HTTPException(404, "No data.")
    sc = "merit_score" if "merit_score" in _ranking.columns else "ml_score"
    # FIFO: sort by date if available, else by index (original order)
    if "date" in _ranking.columns:
        try:
            fifo = _ranking.sort_values("date")
        except Exception:
            fifo = _ranking
    else:
        fifo = _ranking
    fc = fifo["amount"].fillna(0).cumsum(); fn = int((fc<=budget).sum())
    merit = _ranking.sort_values(sc, ascending=False); mc = merit["amount"].fillna(0).cumsum(); mn = int((mc<=budget).sum())
    fa = _safe_float(fifo.head(fn)[sc].mean()) if fn>0 else 0
    ma = _safe_float(merit.head(mn)[sc].mean()) if mn>0 else 0
    imp = round((ma-fa)/fa*100,1) if fa>0 else 0
    return {"budget": budget, "fifo": {"funded": fn, "avg_score": round(fa,2)}, "merit": {"funded": mn, "avg_score": round(ma,2)}, "improvement_pct": imp}

# ── Regulatory info ──
@app.get("/api/regulatory/info")
def reg_info():
    from src.regulatory import get_all_npa_info
    return get_all_npa_info()

# ── Export ──
@app.get("/api/export/ranking")
def export_ranking(format: str = Query("xlsx"), region: Optional[str]=Query(None), min_score: float=Query(0), limit: int=Query(0)):
    if _ranking.empty: raise HTTPException(404, "No data.")
    df = _ranking.copy(); sc = "merit_score" if "merit_score" in df.columns else "ml_score"
    if region: df = df[df["region"].str.contains(region, case=False, na=False)]
    if min_score > 0: df = df[df[sc]>=min_score]
    df = df.sort_values(sc, ascending=False)
    if limit > 0: df = df.head(limit)
    cols = [c for c in ["merit_rank","request_num","region","district","direction","subsidy_name","amount","normative","merit_score","efficiency_score","reliability_score","need_score","regulatory_score","ml_score","merit_risk_level","is_anomaly"] if c in df.columns]
    out = df[cols]
    fp = OUTPUT_DIR / f"export_ranking.{format}"
    if format == "csv": out.to_csv(fp, index=False); return FileResponse(fp, filename="subsidy_ranking.csv")
    else: out.to_excel(fp, index=False, sheet_name="Рейтинг"); return FileResponse(fp, filename="subsidy_ranking.xlsx", media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")

# ── File upload ──
@app.post("/api/upload/preview")
async def upload_preview(file: UploadFile = File(...)):
    from src.column_mapper import auto_map_columns, smart_read_file
    content = await file.read()
    import tempfile, os
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(file.filename)[1])
    tmp.write(content); tmp.close()
    try:
        df = smart_read_file(tmp.name)
        mapping = auto_map_columns(list(df.columns))
        sample = df.head(3).fillna("").to_dict(orient="records")
        return {"filename": file.filename, "rows": len(df), "columns": list(df.columns), "mapping": mapping, "sample": sample}
    finally:
        os.unlink(tmp.name)

@app.post("/api/upload")
async def upload_data(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    if _pipeline_status["running"]: raise HTTPException(409, "Pipeline уже запущен.")
    DATA_DIR.mkdir(exist_ok=True)
    path = DATA_DIR / ("uploaded_data" + Path(file.filename).suffix)
    with open(path, "wb") as f: f.write(await file.read())
    background_tasks.add_task(_run_pipeline_bg, str(path))
    return {"status": "accepted", "message": "Pipeline запущен."}

def _run_pipeline_bg(data_path):
    global _pipeline_status
    _pipeline_status = {"running": True, "progress": "Загрузка файла...", "stage": 1, "total_stages": 6, "error": None, "last_run": None}
    try:
        _pipeline_status["progress"] = "Анализ структуры данных..."
        _pipeline_status["stage"] = 2
        from src.pipeline import run_pipeline
        import src.pipeline as _pl
        # Monkey-patch header to track stages
        _orig_header = _pl.header
        _stage_map = {
            "3.": ("Создание целевой переменной...", 2),
            "4.": ("Извлечение признаков (26 features)...", 3),
            "6.": ("Обучение ML-моделей...", 4),
            "8.": ("Расчёт Merit Score...", 5),
            "11.": ("Сохранение результатов...", 6),
        }
        def _tracked_header(text):
            for prefix, (msg, stage) in _stage_map.items():
                if prefix in text:
                    _pipeline_status["progress"] = msg
                    _pipeline_status["stage"] = stage
                    break
            _orig_header(text)
        _pl.header = _tracked_header
        summary = run_pipeline(data_path, str(OUTPUT_DIR))
        _pl.header = _orig_header
        _load_outputs()
        _pipeline_status = {"running": False, "progress": "Завершён", "stage": 6, "total_stages": 6, "error": None, "last_run": datetime.datetime.now().isoformat(), "summary": summary}
    except Exception as e:
        _pipeline_status = {"running": False, "progress": "Ошибка", "stage": 0, "total_stages": 6, "error": str(e), "last_run": None}

@app.get("/api/pipeline/status")
def pipeline_status():
    return _pipeline_status

# ── AI Chat ──
class ChatRequest(BaseModel):
    message: str; history: list = []

@app.post("/api/chat")
def chat(req: ChatRequest):
    import requests as http_req
    groq_key = os.environ.get("GROQ_API_KEY", "")
    if not groq_key: raise HTTPException(503, "AI-ассистент недоступен: не настроен GROQ_API_KEY")
    ctx = _build_chat_context()
    messages = [{"role": "system", "content": ctx}] + req.history[-10:] + [{"role": "user", "content": req.message}]
    try:
        resp = http_req.post("https://api.groq.com/openai/v1/chat/completions", headers={"Authorization": f"Bearer {groq_key}", "Content-Type": "application/json"}, json={"model": "llama-3.3-70b-versatile", "messages": messages, "max_tokens": 2000, "temperature": 0.2}, timeout=30)
        resp.raise_for_status()
        return {"answer": resp.json()["choices"][0]["message"]["content"]}
    except Exception as e:
        raise HTTPException(500, f"AI error: {e}")

def _build_chat_context():
    c = """Ты — AI-ассистент системы SubsidyScore AI для анализа сельскохозяйственных субсидий Казахстана.

Твоя задача — помогать специалистам комиссии понять результаты скоринга. Объясняй откуда берутся цифры, как считается Merit Score, почему конкретная заявка получила такой балл.

Merit Score = 0.25×Efficiency + 0.15×Reliability + 0.15×Need + 0.15×Regulatory + 0.30×ML
- Efficiency: насколько сумма заявки соответствует медиане категории (log-отклонение)
- Reliability: подача в рабочие часы (+15), рабочий день (+10), ранняя подача (+15), одобряемость региона (+10)
- Need: регионы с меньшим числом заявок получают больше (до +30), совпадение специализации (+20)
- Regulatory: направление в НПА (+20), приоритет high/medium (+10/+5), норматив в диапазоне (+15), пастбищная ёмкость (+5/+10)
- ML Score: ансамбль GradientBoosting (w=0.5) + RandomForest (w=0.3) + LogisticRegression (w=0.2)

НПА: V1500011064 (пастбищные нормы), V1900018404 (животноводство), V1500012488 (растениеводство)

26 ML-features: 7 финансовых, 9 временных, 3 региональных, 3 НПА-based, 4 закодированных

Отвечай на русском. Используй конкретные числа. Если спрашивают про конкретную заявку или регион — ссылайся на данные ниже. Финальное решение всегда за комиссией (Human-in-the-Loop).
"""
    if _dashboard:
        ov = _dashboard.get("overview", {})
        c += f"\nВсего заявок: {ov.get('total_applications','?')}, средний Merit Score: {ov.get('avg_score','?')}, рекомендовано: {ov.get('recommended','?')} ({ov.get('pct_recommended','?')}%)\n"
        for r in sorted(_dashboard.get("region_stats",[]), key=lambda x: x.get("avg_score",0), reverse=True)[:5]:
            c += f"- {r['region']}: ср. скор {r['avg_score']}, заявок {r['count']}, рекоменд. {r.get('pct_recommended','?')}%\n"
        for d in sorted(_dashboard.get("direction_stats",[]), key=lambda x: x.get("count",0), reverse=True)[:5]:
            c += f"- {d['direction']}: {d['count']} заявок, ср. скор {d['avg_score']}\n"
        fm = _dashboard.get("fifo_vs_merit", {})
        if fm:
            c += f"\nFIFO vs Merit (топ-1000): FIFO {fm.get('fifo_top1000_avg_score','?')} → Merit {fm.get('merit_top1000_avg_score','?')} (+{fm.get('score_improvement_pct','?')}%)\n"
        fa = _dashboard.get("fairness_audit", {})
        if fa:
            c += f"Fairness: CV={fa.get('cv','?')}%, диапазон рекомендованных: {fa.get('min_pct','?')}%–{fa.get('max_pct','?')}%\n"
        an = _dashboard.get("anomaly_stats", {})
        if an:
            c += f"Аномалий: {an.get('total_anomalies','?')} ({an.get('pct','?')}%)\n"
    return c

# ── Model info ──
@app.get("/api/model/info")
def model_info():
    if not _model_results: return {"error": "No model results."}
    return {"models": _model_results, "ensemble_weights": {"GradientBoosting": 0.5, "RandomForest": 0.3, "LogisticRegression": 0.2}}

@app.get("/api/features")
def features():
    if _feature_importance.empty: return {"error": "No data."}
    return _feature_importance.to_dict(orient="records")

# ── Serve React static build ──
_DIST = Path(__file__).resolve().parent.parent / "dashboard-runner" / "dist"
if _DIST.exists():
    from fastapi.staticfiles import StaticFiles
    app.mount("/", StaticFiles(directory=str(_DIST), html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", 8000)))
