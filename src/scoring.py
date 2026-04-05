"""
SubsidyScore AI — Composite Merit Scorer
Композитный merit-скор: efficiency + reliability + need + ML score.
"""

import numpy as np
import pandas as pd

from src.regulatory import compute_regulatory_score, LIVESTOCK_NORMS


class MeritScorer:
    """
    Композитный merit-скор (5 компонентов):
    MERIT = 0.25*Efficiency + 0.15*Reliability + 0.15*Need + 0.15*Regulatory + 0.30*ML

    Regulatory Score основан на НПА РК (V1500011064, V1900018404, V1500012488).
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
        """MERIT = 0.25*Eff + 0.15*Rel + 0.15*Need + 0.15*Reg + 0.30*ML"""
        eff = self.compute_efficiency_score(row)
        rel = self.compute_reliability_score(row)
        need = self.compute_need_score(row)
        reg = compute_regulatory_score(row)
        merit = 0.25 * eff + 0.15 * rel + 0.15 * need + 0.15 * reg + 0.30 * ml_score
        return float(np.clip(merit, 0, 100))

    def score_dataframe(self, df: pd.DataFrame) -> pd.DataFrame:
        """Рассчитывает все компоненты и composite для DataFrame."""
        df = df.copy()
        df["efficiency_score"] = df.apply(self.compute_efficiency_score, axis=1)
        df["reliability_score"] = df.apply(self.compute_reliability_score, axis=1)
        df["need_score"] = df.apply(self.compute_need_score, axis=1)
        df["regulatory_score"] = df.apply(compute_regulatory_score, axis=1)
        df["merit_score"] = df.apply(
            lambda row: self.compute_composite_score(row, row.get("ml_score", 50)),
            axis=1,
        )
        df["merit_rank"] = df["merit_score"].rank(ascending=False, method="min").astype(int)
        df["merit_risk_level"] = df["merit_score"].apply(_merit_risk)
        return df


def generate_improvement_tips(row: pd.Series, scorer: MeritScorer) -> list:
    """Рекомендации по улучшению Merit Score для заявителя."""
    tips = []
    eff = scorer.compute_efficiency_score(row)
    if eff < 80:
        cat = row.get("subsidy_category", "other")
        median = scorer._category_medians.get(cat, 0)
        if median > 0:
            tips.append({"tip": f"Скорректируйте объём ближе к медиане категории ({median:,.0f} ед). Текущий Efficiency: {eff:.0f}/100.", "gain": round(min((100-eff)*0.25, 15), 1), "component": "Efficiency"})
    if row.get("is_working_hours", 0) == 0:
        tips.append({"tip": "Подавайте заявку в рабочие часы (9:00–17:00) — это добавит до +15 к Reliability.", "gain": round(15*0.15, 1), "component": "Reliability"})
    if row.get("is_weekday", 0) == 0:
        tips.append({"tip": "Подавайте заявку в рабочий день (пн–пт) — это добавит до +10 к Reliability.", "gain": round(10*0.15, 1), "component": "Reliability"})
    if row.get("submission_speed", 0) < 0.5:
        tips.append({"tip": "Подавайте заявку в начале периода приёма — ранняя подача повышает Reliability.", "gain": round(10*0.15, 1), "component": "Reliability"})
    norms = LIVESTOCK_NORMS.get(str(row.get("direction", "")))
    if norms:
        lo, hi = norms["normative_range"]
        normative = float(row.get("normative", 0) or 0)
        if normative > 0 and (normative < lo or normative > hi):
            tips.append({"tip": f"Норматив ({normative:,.0f} тг) вне диапазона НПА ({lo:,}–{hi:,} тг). Корректировка добавит до +15 к Regulatory.", "gain": round(15*0.15, 1), "component": "Regulatory"})
    tips.sort(key=lambda t: t["gain"], reverse=True)
    return tips[:5]


def _merit_risk(score: float) -> str:
    if score >= 70:
        return "recommended"
    if score >= 50:
        return "low_risk"
    if score >= 30:
        return "medium_risk"
    return "high_risk"
