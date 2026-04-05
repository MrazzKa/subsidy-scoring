"""
SubsidyScore AI — Main Pipeline
Запуск: python src/pipeline.py
"""

import sys
import time
from pathlib import Path

# Добавляем корень проекта в sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

import numpy as np
import pandas as pd

from src.preprocessing import (
    load_data, parse_dates, create_target,
    engineer_features, prepare_model_data, FEATURE_COLS,
)
from src.model import SubsidyScoringModel
from src.scoring import MeritScorer


# ---------- Helpers ----------

SEPARATOR = "=" * 70
THIN_SEP = "-" * 70
DATA_PATH = PROJECT_ROOT / "data" / "Выгрузка по выданным субсидиям 2025 год (обезлич).xlsx"
OUTPUT_DIR = PROJECT_ROOT / "outputs"


def _compute_fifo_vs_merit(ranking: pd.DataFrame, top_n: int = 1000) -> dict:
    """Сравнение FIFO (по дате) vs Merit (по merit_score)."""
    score_col = "merit_score" if "merit_score" in ranking.columns else "ml_score"
    risk_col = "merit_risk_level" if "merit_risk_level" in ranking.columns else "risk_level"

    # FIFO: сортировка по дате подачи (первые пришли — первые получили)
    fifo = ranking.sort_values("date").head(top_n)
    # Merit: сортировка по merit-скору (лучшие — первые)
    merit = ranking.sort_values(score_col, ascending=False).head(top_n)

    fifo_avg = round(float(fifo[score_col].mean()), 1)
    merit_avg = round(float(merit[score_col].mean()), 1)
    improvement = round((merit_avg - fifo_avg) / fifo_avg * 100, 1) if fifo_avg > 0 else 0

    fifo_high = int((fifo[risk_col] == "high_risk").sum())
    merit_high = int((merit[risk_col] == "high_risk").sum())
    fifo_medium = int((fifo[risk_col] == "medium_risk").sum())
    merit_medium = int((merit[risk_col] == "medium_risk").sum())

    # Risk distribution for chart
    fifo_risk = fifo[risk_col].value_counts().to_dict()
    merit_risk = merit[risk_col].value_counts().to_dict()
    risk_comparison = []
    for level in ["recommended", "low_risk", "medium_risk", "high_risk"]:
        risk_comparison.append({
            "level": level,
            "fifo": fifo_risk.get(level, 0),
            "merit": merit_risk.get(level, 0),
        })

    fifo_not_recommended = top_n - fifo_risk.get("recommended", 0)
    budget_msg = (
        f"При merit-based подходе {fifo_not_recommended} заявок с пониженным приоритетом "
        f"(low/medium/high risk) из топ-{top_n} были бы заменены на рекомендованные. "
        f"Средний скор вырос бы с {fifo_avg} до {merit_avg} (+{improvement}%)"
    )

    return {
        "fifo_top1000_avg_score": fifo_avg,
        "merit_top1000_avg_score": merit_avg,
        "fifo_top1000_high_risk_count": fifo_high,
        "merit_top1000_high_risk_count": merit_high,
        "fifo_top1000_medium_risk_count": fifo_medium,
        "merit_top1000_medium_risk_count": merit_medium,
        "score_improvement_pct": improvement,
        "budget_efficiency_gain": budget_msg,
        "risk_comparison": risk_comparison,
    }


def header(text: str):
    print(f"\n{SEPARATOR}")
    print(f"  {text}")
    print(SEPARATOR)


def sub_header(text: str):
    print(f"\n{THIN_SEP}")
    print(f"  {text}")
    print(THIN_SEP)


# ---------- Pipeline ----------

def run_pipeline(data_path: str, output_dir: str) -> dict:
    """Основной pipeline. Возвращает summary dict."""
    t0 = time.time()

    header("SubsidyScore AI — Merit-Based Scoring Pipeline")
    print(f"  Data: {Path(data_path).name}")
    print(f"  Output: {output_dir}")

    # 1. Загрузка
    header("1. Загрузка данных")
    df = load_data(data_path)
    print(f"  Загружено строк: {len(df):,}")
    print(f"  Колонки: {list(df.columns)}")

    # 2. Парсинг дат
    sub_header("2. Парсинг дат и временные признаки")
    df = parse_dates(df)
    print(f"  Строк после очистки дат: {len(df):,}")
    print(f"  Период: {df['date'].min()} — {df['date'].max()}")

    # 3. Целевая переменная
    sub_header("3. Создание целевой переменной")
    df = create_target(df)
    print(f"  Строк с определённым таргетом: {len(df):,}")
    print(f"  Positive (одобрено): {(df['target'] == 1).sum():,}")
    print(f"  Negative (отклонено): {(df['target'] == 0).sum():,}")
    print(f"  Баланс классов: {df['target'].mean():.2%} positive")

    # 4. Feature Engineering
    sub_header("4. Feature Engineering")
    df = engineer_features(df)
    print(f"  Создано признаков: {len(FEATURE_COLS)}")
    print(f"  Признаки: {FEATURE_COLS}")

    # 5. Подготовка данных
    sub_header("5. Подготовка данных для модели")
    X, y, feature_cols, encoders, df_full = prepare_model_data(df)
    print(f"  X shape: {X.shape}")
    print(f"  y shape: {y.shape}")
    print(f"  Features: {len(feature_cols)}")

    # 6. Обучение моделей
    header("6. Обучение моделей (5-fold CV)")
    model = SubsidyScoringModel()
    results = model.train(X, y, feature_cols)

    sub_header("Результаты кросс-валидации")
    for name, metrics in results.items():
        print(f"  {name:25s}  AUC={metrics['auc']:.4f}  Acc={metrics['acc']:.4f}  "
              f"F1={metrics['f1']:.4f}  Prec={metrics['prec']:.4f}  Rec={metrics['rec']:.4f}")

    # 6b. Temporal Validation
    sub_header("6b. Temporal Validation (80/20 по дате)")
    temporal_results = model.temporal_validate(X, y, df_full["date"].values, feature_cols)
    for name, metrics in temporal_results.items():
        print(f"  {name:25s}  AUC={metrics['auc']:.4f}  Acc={metrics['acc']:.4f}  F1={metrics['f1']:.4f}")

    # 6c. Сохранение модели
    import joblib
    model_path = Path(output_dir) / "trained_model.joblib"
    joblib.dump({"models": model.models, "scaler": model.scaler, "feature_cols": model.feature_cols, "importances": model.importances}, str(model_path))
    print(f"  Модель сохранена: {model_path}")

    # 7. ML-скоринг
    header("7. ML-скоринг")
    ranking = model.generate_ranking(X, df_full)
    print(f"  Средний ML-скор: {ranking['ml_score'].mean():.2f}")
    print(f"  Медиана ML-скор: {ranking['ml_score'].median():.2f}")
    print(f"  Распределение рисков:")
    for level in ["recommended", "low_risk", "medium_risk", "high_risk"]:
        cnt = (ranking["risk_level"] == level).sum()
        pct = cnt / len(ranking) * 100
        print(f"    {level:15s}: {cnt:6,} ({pct:5.1f}%)")

    # 7b. Anomaly Detection
    sub_header("7b. Детектор аномалий (IsolationForest)")
    anomaly_labels = model.detect_anomalies(X)
    ranking["is_anomaly"] = anomaly_labels == -1
    anomaly_count = int(ranking["is_anomaly"].sum())
    print(f"  Аномалий: {anomaly_count} ({anomaly_count/len(ranking)*100:.1f}%)")

    # 8. Композитный Merit-скор
    header("8. Композитный Merit-скор")
    scorer = MeritScorer()
    scorer.fit(ranking)
    ranking = scorer.score_dataframe(ranking)

    print(f"  Средний Merit-скор: {ranking['merit_score'].mean():.2f}")
    print(f"  Медиана Merit-скор: {ranking['merit_score'].median():.2f}")
    print(f"  Распределение Merit-рисков:")
    for level in ["recommended", "low_risk", "medium_risk", "high_risk"]:
        cnt = (ranking["merit_risk_level"] == level).sum()
        pct = cnt / len(ranking) * 100
        print(f"    {level:15s}: {cnt:6,} ({pct:5.1f}%)")

    # 9. FIFO vs Merit сравнение
    header("9. FIFO vs Merit — сравнение подходов")
    fifo_vs_merit = _compute_fifo_vs_merit(ranking)
    print(f"  FIFO топ-1000 средний Merit-скор:  {fifo_vs_merit['fifo_top1000_avg_score']:.1f}")
    print(f"  Merit топ-1000 средний Merit-скор: {fifo_vs_merit['merit_top1000_avg_score']:.1f}")
    print(f"  Улучшение:                         {fifo_vs_merit['score_improvement_pct']:.1f}%")
    print(f"  FIFO high_risk в топ-1000:         {fifo_vs_merit['fifo_top1000_high_risk_count']}")
    print(f"  Merit high_risk в топ-1000:        {fifo_vs_merit['merit_top1000_high_risk_count']}")
    print(f"  FIFO medium_risk в топ-1000:       {fifo_vs_merit['fifo_top1000_medium_risk_count']}")
    print(f"  Merit medium_risk в топ-1000:      {fifo_vs_merit['merit_top1000_medium_risk_count']}")

    # 9b. Fairness Audit
    sub_header("9b. Fairness Audit")
    import statistics
    fairness = {}
    for region in ranking["region"].unique():
        rd = ranking[ranking["region"] == region]
        fairness[region] = {"count": len(rd), "avg_merit": round(float(rd["merit_score"].mean()), 2), "pct_recommended": round((rd["merit_risk_level"]=="recommended").mean()*100, 1)}
    regional_scores = [v["avg_merit"] for v in fairness.values()]
    cv = statistics.stdev(regional_scores) / statistics.mean(regional_scores) * 100
    pct_values = [v["pct_recommended"] for v in fairness.values()]
    print(f"  CV между регионами: {cv:.1f}%")
    print(f"  Диапазон % рекомендованных: {min(pct_values):.1f}% — {max(pct_values):.1f}%")

    # 10. Explainability (3 примера)
    header("10. Explainability — примеры объяснений")
    sample_indices = [0, len(X) // 2, len(X) - 1]
    for idx in sample_indices:
        row = ranking.iloc[idx]
        expl = model.explain_single(X[idx], feature_cols, row=row, top_n=5)
        print(f"\n  Заявка: {row.get('request_num', 'N/A')}")
        print(f"  Регион: {row.get('region', 'N/A')} | {row.get('direction', 'N/A')}")
        print(f"  Сумма: {row.get('amount', 0):,.0f} тг")
        print(f"  ML Score: {expl['score']:.1f} | Merit Score: {row.get('merit_score', 0):.1f}")
        print(f"  Risk: {expl['risk_level']}")
        print(f"  Ключевые факторы:")
        for f in expl["top_factors"]:
            print(f"    - {f['feature']:35s} = {f['value']:10.4f}")
            print(f"      {f['description']}")

    # 11. Сохранение
    header("11. Сохранение результатов")
    model.save_results(ranking, results, output_dir)

    # Inject additional data into dashboard_data.json
    import json
    from src.regulatory import get_all_npa_info

    dash_path = Path(output_dir) / "dashboard_data.json"
    with open(dash_path, encoding="utf-8") as f:
        dash = json.load(f)
    dash["fifo_vs_merit"] = fifo_vs_merit
    dash["temporal_validation"] = temporal_results
    dash["regulatory_info"] = get_all_npa_info()
    dash["anomaly_stats"] = {
        "total_anomalies": anomaly_count,
        "pct": round(anomaly_count / len(ranking) * 100, 1),
    }
    dash["fairness_audit"] = {
        "cv": round(cv, 1), "is_fair": cv < 10,
        "min_pct": round(min(pct_values), 1), "max_pct": round(max(pct_values), 1),
        "details": fairness,
    }
    dash["merit_formula"] = {
        "formula": "MERIT = 0.25×Eff + 0.15×Rel + 0.15×Need + 0.15×Reg + 0.30×ML",
        "components": [
            {"name": "Efficiency", "weight": 0.25, "desc": "Адекватность запроса нормативам"},
            {"name": "Reliability", "weight": 0.15, "desc": "Паттерны надёжного заявителя"},
            {"name": "Need", "weight": 0.15, "desc": "Потребность региона"},
            {"name": "Regulatory", "weight": 0.15, "desc": "Соответствие НПА РК"},
            {"name": "ML Score", "weight": 0.30, "desc": "Прогноз ML-модели"},
        ],
    }
    with open(dash_path, "w", encoding="utf-8") as f:
        json.dump(dash, f, indent=2, ensure_ascii=False)

    print(f"  ranking.csv             — {len(ranking):,} строк")
    print(f"  model_results.json      — метрики {len(results)} моделей")
    print(f"  feature_importance.csv  — {len(model.importances)} признаков")
    print(f"  dashboard_data.json     — данные для дашборда (с FIFO vs Merit)")

    # Summary
    header("SUMMARY")
    elapsed = time.time() - t0
    print(f"  Всего заявок обработано: {len(ranking):,}")
    print(f"  Лучшая модель (AUC):     {max(results.items(), key=lambda x: x[1]['auc'])[0]} "
          f"({max(r['auc'] for r in results.values()):.4f})")
    print(f"  Средний Merit-скор:       {ranking['merit_score'].mean():.2f}")
    print(f"  Рекомендовано:            {(ranking['merit_risk_level'] == 'recommended').sum():,}")
    print(f"  Время выполнения:         {elapsed:.1f} сек")
    print(f"\n{SEPARATOR}")
    print(f"  Pipeline завершён успешно!")
    print(f"{SEPARATOR}\n")

    return {
        "total": len(ranking),
        "avg_merit": round(float(ranking["merit_score"].mean()), 2),
        "recommended": int((ranking["merit_risk_level"] == "recommended").sum()),
        "anomalies": anomaly_count,
        "best_auc": max(r["auc"] for r in results.values()),
        "elapsed": round(time.time() - t0, 1),
    }


def main():
    run_pipeline(str(DATA_PATH), str(OUTPUT_DIR))


if __name__ == "__main__":
    main()
