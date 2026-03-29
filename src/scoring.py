"""
SubsidyScore AI — Composite Merit Scorer
Композитный merit-скор: efficiency + reliability + need + ML score.
"""

import numpy as np
import pandas as pd


class MeritScorer:
    """
    Композитный merit-скор:
    MERIT = 0.3*Efficiency + 0.2*Reliability + 0.2*Need + 0.3*ML_Score
    """

    def __init__(self):
        self._category_medians = {}
        self._region_counts = {}
        self._region_specializations = {}

    def fit(self, df: pd.DataFrame):
        """Обучается на данных: медианы, региональная статистика."""
        # Медиана единиц по категориям
        if "estimated_units" in df.columns:
            self._category_medians = (
                df.groupby("subsidy_category")["estimated_units"].median().to_dict()
            )

        # Количество заявок по регионам (для определения «нуждаемости»)
        self._region_counts = df.groupby("region")["id"].count().to_dict()
        total = len(df)
        self._region_max = max(self._region_counts.values()) if self._region_counts else 1

        # Специализация региона — доминирующее направление
        self._region_specializations = (
            df.groupby("region")["direction"]
            .agg(lambda x: x.value_counts().index[0])
            .to_dict()
        )
        return self

    # ---------- Компоненты скора ----------

    def compute_efficiency_score(self, row: pd.Series) -> float:
        """
        Адекватность запроса нормативам.
        Запросы, близкие к типичным для категории, получают выше.
        """
        cat = row.get("subsidy_category", "other")
        units = row.get("estimated_units", 0)
        median_units = self._category_medians.get(cat, units if units > 0 else 1)

        if median_units <= 0:
            return 50.0

        ratio = units / median_units if median_units > 0 else 1.0
        # Оптимум вблизи 1.0 — чем дальше, тем ниже
        if ratio <= 0:
            return 10.0
        deviation = abs(np.log(ratio))
        score = 100 * np.exp(-0.5 * deviation)
        return float(np.clip(score, 0, 100))

    def compute_reliability_score(self, row: pd.Series) -> float:
        """
        Паттерны надёжного заявителя: рабочие часы, начало периода,
        район с высоким одобрением.
        """
        score = 50.0  # базовый уровень

        # Подача в рабочие часы
        if row.get("is_working_hours", 0) == 1:
            score += 15

        # Подача в рабочий день
        if row.get("is_weekday", 0) == 1:
            score += 10

        # Ранняя подача (начало квартала / года)
        speed = row.get("submission_speed", 0.5)
        score += speed * 15  # max +15

        # Район с высокой историей одобрений
        approval_rate = row.get("region_approval_rate", 0.5)
        score += approval_rate * 10  # max ~+10

        return float(np.clip(score, 0, 100))

    def compute_need_score(self, row: pd.Series) -> float:
        """
        Обоснованность потребности:
        - Регионы с меньшим числом субсидий → выше
        - Направление совпадает со специализацией региона → выше
        """
        score = 50.0

        # Региональная нуждаемость (меньше заявок → больше потребность)
        region = row.get("region", "")
        region_count = self._region_counts.get(region, 0)
        if self._region_max > 0:
            need_ratio = 1 - (region_count / self._region_max)
            score += need_ratio * 30  # max +30

        # Соответствие специализации
        direction = row.get("direction", "")
        spec = self._region_specializations.get(region, "")
        if direction == spec:
            score += 20

        return float(np.clip(score, 0, 100))

    # ---------- Композитный скор ----------

    def compute_composite_score(self, row: pd.Series, ml_score: float) -> float:
        """MERIT = 0.3*Efficiency + 0.2*Reliability + 0.2*Need + 0.3*ML_Score"""
        eff = self.compute_efficiency_score(row)
        rel = self.compute_reliability_score(row)
        need = self.compute_need_score(row)
        merit = 0.3 * eff + 0.2 * rel + 0.2 * need + 0.3 * ml_score
        return float(np.clip(merit, 0, 100))

    def score_dataframe(self, df: pd.DataFrame) -> pd.DataFrame:
        """Рассчитывает все компоненты и composite для DataFrame."""
        df = df.copy()
        df["efficiency_score"] = df.apply(self.compute_efficiency_score, axis=1)
        df["reliability_score"] = df.apply(self.compute_reliability_score, axis=1)
        df["need_score"] = df.apply(self.compute_need_score, axis=1)
        df["merit_score"] = df.apply(
            lambda row: self.compute_composite_score(row, row.get("ml_score", 50)),
            axis=1,
        )
        df["merit_rank"] = df["merit_score"].rank(ascending=False, method="min").astype(int)
        df["merit_risk_level"] = df["merit_score"].apply(_merit_risk)
        return df


def _merit_risk(score: float) -> str:
    if score >= 70:
        return "recommended"
    if score >= 50:
        return "low_risk"
    if score >= 30:
        return "medium_risk"
    return "high_risk"
