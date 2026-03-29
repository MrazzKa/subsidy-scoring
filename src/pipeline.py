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


def header(text: str):
    print(f"\n{SEPARATOR}")
    print(f"  {text}")
    print(SEPARATOR)


def sub_header(text: str):
    print(f"\n{THIN_SEP}")
    print(f"  {text}")
    print(THIN_SEP)


# ---------- Pipeline ----------

def main():
    t0 = time.time()

    header("SubsidyScore AI — Merit-Based Scoring Pipeline")
    print(f"  Data: {DATA_PATH.name}")
    print(f"  Output: {OUTPUT_DIR}")

    # 1. Загрузка
    header("1. Загрузка данных")
    df = load_data(str(DATA_PATH))
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

    # 9. Explainability (3 примера)
    header("9. Explainability — примеры объяснений")
    sample_indices = [0, len(X) // 2, len(X) - 1]
    for idx in sample_indices:
        expl = model.explain_single(X[idx], feature_cols, top_n=5)
        row = ranking.iloc[idx]
        print(f"\n  Заявка: {row.get('request_num', 'N/A')}")
        print(f"  Регион: {row.get('region', 'N/A')} | {row.get('direction', 'N/A')}")
        print(f"  Сумма: {row.get('amount', 0):,.0f} тг")
        print(f"  ML Score: {expl['score']:.1f} | Merit Score: {row.get('merit_score', 0):.1f}")
        print(f"  Risk: {expl['risk_level']}")
        print(f"  Ключевые факторы:")
        for f in expl["top_factors"]:
            print(f"    - {f['feature']:35s} = {f['value']:10.4f}  (importance: {f['importance']:.6f})")

    # 10. Сохранение
    header("10. Сохранение результатов")
    model.save_results(ranking, results, str(OUTPUT_DIR))
    print(f"  ranking.csv             — {len(ranking):,} строк")
    print(f"  model_results.json      — метрики {len(results)} моделей")
    print(f"  feature_importance.csv  — {len(model.importances)} признаков")
    print(f"  dashboard_data.json     — данные для дашборда")

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


if __name__ == "__main__":
    main()
