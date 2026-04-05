"""
SubsidyScore AI — Tests
"""

import sys
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

DATA_PATH = PROJECT_ROOT / "data" / "Выгрузка по выданным субсидиям 2025 год (обезлич).xlsx"

from src.preprocessing import (
    load_data, parse_dates, create_target,
    engineer_features, prepare_model_data, FEATURE_COLS,
)
from src.model import SubsidyScoringModel
from src.scoring import MeritScorer


# ---------- Tests ----------

def test_load_data():
    df = load_data(str(DATA_PATH))
    assert len(df) > 30_000, f"Expected >30k rows, got {len(df)}"
    assert "region" in df.columns
    assert "status" in df.columns
    assert "amount" in df.columns


def test_parse_dates():
    df = load_data(str(DATA_PATH))
    df = parse_dates(df)
    assert "month" in df.columns
    assert "hour" in df.columns
    assert "is_working_hours" in df.columns
    assert df["month"].between(1, 12).all()


def test_feature_engineering():
    df = load_data(str(DATA_PATH))
    df = parse_dates(df)
    df = create_target(df)
    df = engineer_features(df)
    for col in FEATURE_COLS[:19]:  # non-encoded cols
        assert col in df.columns, f"Missing feature: {col}"
    assert len(FEATURE_COLS) >= 23


def test_prepare_model_data():
    df = load_data(str(DATA_PATH))
    df = parse_dates(df)
    df = create_target(df)
    df = engineer_features(df)
    X, y, cols, enc, df_full = prepare_model_data(df)
    assert X.shape[0] > 30_000
    assert X.shape[1] == len(cols)
    assert not np.any(np.isnan(X)), "X contains NaN"
    assert set(np.unique(y)) == {0, 1}


def test_model_train():
    df = load_data(str(DATA_PATH))
    df = parse_dates(df)
    df = create_target(df)
    df = engineer_features(df)
    X, y, cols, _, _ = prepare_model_data(df)

    model = SubsidyScoringModel()
    results = model.train(X, y, cols)

    assert "GradientBoosting" in results
    assert results["GradientBoosting"]["auc"] > 0.65
    assert results["RandomForest"]["auc"] > 0.65


def test_scoring():
    df = load_data(str(DATA_PATH))
    df = parse_dates(df)
    df = create_target(df)
    df = engineer_features(df)
    X, y, cols, _, df_full = prepare_model_data(df)

    model = SubsidyScoringModel()
    model.train(X, y, cols)
    scores = model.predict_score(X)

    assert scores.min() >= 0
    assert scores.max() <= 100
    assert len(scores) == len(X)


def test_merit_scorer():
    df = load_data(str(DATA_PATH))
    df = parse_dates(df)
    df = create_target(df)
    df = engineer_features(df)
    X, y, cols, _, df_full = prepare_model_data(df)

    model = SubsidyScoringModel()
    model.train(X, y, cols)
    ranking = model.generate_ranking(X, df_full)

    scorer = MeritScorer()
    scorer.fit(ranking)
    ranking = scorer.score_dataframe(ranking)

    assert "merit_score" in ranking.columns
    assert ranking["merit_score"].between(0, 100).all()


def test_regulatory_features():
    """НПА-features добавляются в данные."""
    df = load_data(str(DATA_PATH))
    df = parse_dates(df)
    df = create_target(df)
    df = engineer_features(df)
    assert "is_priority_direction" in df.columns
    assert "normative_in_npa_range" in df.columns
    assert "pasture_capacity" in df.columns


def test_feature_cols_26():
    assert len(FEATURE_COLS) == 26, f"Expected 26 features, got {len(FEATURE_COLS)}"


def test_regulatory_score():
    from src.regulatory import compute_regulatory_score
    row = pd.Series({"direction": "Субсидирование в скотоводстве", "region": "Карагандинская область", "normative": 15000, "amount": 750000})
    assert compute_regulatory_score(row) > 70


def test_regulatory_unknown():
    from src.regulatory import compute_regulatory_score
    row = pd.Series({"direction": "???", "region": "???", "normative": 0, "amount": 0})
    assert compute_regulatory_score(row) == 50.0


def test_npa_info():
    from src.regulatory import get_all_npa_info
    assert len(get_all_npa_info()["documents"]) == 3


def test_column_mapper():
    from src.column_mapper import auto_map_columns
    cols = ["Дата подачи", "Область", "Район", "Направление", "Наименование субсидии", "Статус", "Норматив", "Сумма"]
    result = auto_map_columns(cols)
    assert result["ready"] == True
    assert "date" in result["mapping"]


def test_merit_has_regulatory():
    df = load_data(str(DATA_PATH)); df = parse_dates(df); df = create_target(df); df = engineer_features(df)
    X, y, cols, _, df_full = prepare_model_data(df)
    model = SubsidyScoringModel(); model.train(X, y, cols)
    ranking = model.generate_ranking(X, df_full)
    scorer = MeritScorer(); scorer.fit(ranking); ranking = scorer.score_dataframe(ranking)
    assert "regulatory_score" in ranking.columns


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
