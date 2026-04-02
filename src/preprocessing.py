"""
SubsidyScore AI — Preprocessing & Feature Engineering
Загрузка данных из ГИСС, очистка, создание признаков для ML-модели.
"""

import pandas as pd
import numpy as np
from pathlib import Path
from sklearn.preprocessing import LabelEncoder


# ---------- Загрузка и очистка ----------

def load_data(filepath: str) -> pd.DataFrame:
    """Загружает XLSX-выгрузку ГИСС, пропускает заголовок (5 строк)."""
    df = pd.read_excel(filepath, header=None, skiprows=5)
    df.columns = [
        "id", "date", "_col2", "_col3",
        "region", "akimat", "request_num", "direction",
        "subsidy_name", "status", "normative", "amount", "district",
    ]
    df = df.drop(columns=["_col2", "_col3"])
    df = df.dropna(subset=["id", "date", "region", "status"])
    df["id"] = df["id"].astype(str)
    return df


# ---------- Парсинг дат и временные признаки ----------

def parse_dates(df: pd.DataFrame) -> pd.DataFrame:
    """Парсит дату заявки, извлекает временные признаки."""
    df = df.copy()
    df["date"] = pd.to_datetime(df["date"], format="%d.%m.%Y %H:%M:%S", errors="coerce")
    df = df.dropna(subset=["date"])

    df["month"] = df["date"].dt.month
    df["day_of_week"] = df["date"].dt.dayofweek          # 0=Mon
    df["hour"] = df["date"].dt.hour
    df["quarter"] = df["date"].dt.quarter
    df["day_of_year"] = df["date"].dt.dayofyear
    df["is_working_hours"] = df["hour"].between(9, 17).astype(int)
    df["is_weekday"] = (df["day_of_week"] < 5).astype(int)
    return df


# ---------- Целевая переменная ----------

POSITIVE_STATUSES = {"Исполнена", "Одобрена", "Сформировано поручение", "Получена"}
NEGATIVE_STATUSES = {"Отклонена", "Отозвано"}


def create_target(df: pd.DataFrame) -> pd.DataFrame:
    """Создаёт бинарный таргет: 1 — одобрена, 0 — отклонена/отозвана."""
    df = df.copy()
    df["target"] = np.where(
        df["status"].isin(POSITIVE_STATUSES), 1,
        np.where(df["status"].isin(NEGATIVE_STATUSES), 0, np.nan),
    )
    df = df.dropna(subset=["target"])
    df["target"] = df["target"].astype(int)
    return df


# ---------- Категории субсидий ----------

_CATEGORY_KEYWORDS = {
    "milk_production":  ["молок", "молоч"],
    "poultry_meat":     ["птиц", "яиц", "яйц"],
    "breeding_bulls":   ["быков", "бычк", "бугаев"],
    "cattle_breeding":  ["крупного рогатого", "крс"],
    "sheep_breeding":   ["овец", "овцематок", "баранов", "ягнят"],
    "selection_work":   ["селекцион", "племенн"],
    "young_stock":      ["молодняк"],
    "fattening_sales":  ["откорм", "реализац"],
    "feed_costs":       ["корм"],
    "insemination":     ["осеменен"],
    "semen_purchase":   ["семен"],
    "honey":            ["мёд", "мед", "пчел"],
    "wool":             ["шерст"],
    "pigs":             ["свин"],
    "goats":            ["коз"],
    "camels":           ["верблюд"],
    "horses":           ["конев", "лошад", "жереб"],
}


def extract_subsidy_category(name: str) -> str:
    """Определяет категорию субсидии по ключевым словам в названии."""
    if not isinstance(name, str):
        return "other"
    low = name.lower()
    for cat, keywords in _CATEGORY_KEYWORDS.items():
        if any(kw in low for kw in keywords):
            return cat
    return "other"


# ---------- Feature Engineering ----------

def _leave_one_out_rate(df: pd.DataFrame, col: str, target: str,
                        smoothing: float = 50000.0) -> pd.Series:
    """
    Leave-one-out mean encoding со сглаживанием (Bayesian smoothing).
    smoothing контролирует «подтяжку» к глобальному среднему:
    чем выше — тем меньше группа может отклониться от среднего.
    Это предотвращает слишком точное кодирование таргета.
    """
    global_mean = df[target].mean()
    group_sum = df.groupby(col)[target].transform("sum")
    group_cnt = df.groupby(col)[target].transform("count")
    # LOO: исключаем текущую строку
    loo_sum = group_sum - df[target]
    loo_cnt = group_cnt - 1
    # Bayesian smoothing: подтягиваем к глобальному среднему
    smoothed = (loo_sum + smoothing * global_mean) / (loo_cnt + smoothing)
    return smoothed.fillna(global_mean)


def engineer_features(df: pd.DataFrame) -> pd.DataFrame:
    """Создаёт 23+ признаков для модели."""
    df = df.copy()

    # Категория субсидии
    df["subsidy_category"] = df["subsidy_name"].apply(extract_subsidy_category)

    # --- Финансовые ---
    df["normative"] = pd.to_numeric(df["normative"], errors="coerce").fillna(0)
    df["amount"] = pd.to_numeric(df["amount"], errors="coerce").fillna(0)
    df["log_amount"] = np.log1p(df["amount"])
    df["log_normative"] = np.log1p(df["normative"])
    df["estimated_units"] = np.where(
        df["normative"] > 0, df["amount"] / df["normative"], 0,
    )
    df["log_estimated_units"] = np.log1p(df["estimated_units"])

    # Сравнение с медианой
    region_med = df.groupby("region")["amount"].transform("median")
    df["amount_vs_regional_median"] = np.where(
        region_med > 0, df["amount"] / region_med, 1,
    )
    cat_med = df.groupby("subsidy_category")["amount"].transform("median")
    df["amount_vs_category_median"] = np.where(
        cat_med > 0, df["amount"] / cat_med, 1,
    )
    threshold = df["amount"].quantile(0.90)
    df["is_large_request"] = (df["amount"] >= threshold).astype(int)

    # Отношение норматива к сумме (нормализованная стоимость единицы)
    df["normative_amount_ratio"] = np.where(
        df["amount"] > 0, df["normative"] / df["amount"], 0,
    )

    # --- Временные (уже должны быть из parse_dates) ---
    # submission_speed: чем раньше в году — тем выше
    max_doy = df["day_of_year"].max()
    df["submission_speed"] = 1 - df["day_of_year"] / max_doy if max_doy > 0 else 0
    df["day_of_month"] = df["date"].dt.day
    # Ранняя подача — в первые 60 дней периода приёма
    min_doy = df["day_of_year"].min()
    df["is_early_submission"] = ((df["day_of_year"] - min_doy) <= 60).astype(int)

    # --- Региональные ---
    df["region_application_count"] = df.groupby("region")["id"].transform("count")
    df["district_application_count"] = df.groupby("district")["id"].transform("count")

    # LOO approval rates (target нужен)
    if "target" in df.columns:
        df["region_approval_rate"] = _leave_one_out_rate(df, "region", "target")
        df["direction_approval_rate"] = _leave_one_out_rate(df, "direction", "target")
        df["category_approval_rate"] = _leave_one_out_rate(df, "subsidy_category", "target")
    else:
        df["region_approval_rate"] = 0.0
        df["direction_approval_rate"] = 0.0
        df["category_approval_rate"] = 0.0

    # --- Конкурентные ---
    df["month_application_count"] = df.groupby("month")["id"].transform("count")

    # Replace inf/NaN
    df = df.replace([np.inf, -np.inf], np.nan)
    numeric_cols = df.select_dtypes(include=[np.number]).columns
    df[numeric_cols] = df[numeric_cols].fillna(0)

    return df


# ---------- Подготовка данных для модели ----------

FEATURE_COLS = [
    # Financial (7)
    "log_amount", "log_normative", "log_estimated_units",
    "amount_vs_regional_median", "amount_vs_category_median", "is_large_request",
    "normative_amount_ratio",
    # Temporal (9)
    "month", "quarter", "day_of_week", "day_of_month", "hour",
    "is_working_hours", "is_weekday", "submission_speed",
    "is_early_submission",
    # Regional / competition (3)
    "region_application_count", "district_application_count",
    "month_application_count",
    # Encoded identifiers (4) — hash-bucketed to prevent target leakage
    "region_enc", "direction_enc", "subsidy_category_enc", "district_enc",
]

# Approval rate features — computed via LOO-Bayesian encoding.
# Used ONLY in MeritScorer (composite scoring), excluded from ML model
# to prevent target-proxy leakage through categorical approval rates.
APPROVAL_RATE_COLS = [
    "region_approval_rate", "direction_approval_rate", "category_approval_rate",
]


def prepare_model_data(df: pd.DataFrame):
    """
    Кодирует категориальные признаки, возвращает (X, y, feature_cols, encoders, df).
    Применяет frequency encoding вместо label encoding для direction и category,
    чтобы модель не могла напрямую запомнить direction→approval mapping.
    """
    df = df.copy()
    encoders = {}
    for col, enc_col in [
        ("region", "region_enc"),
        ("direction", "direction_enc"),
        ("subsidy_category", "subsidy_category_enc"),
        ("district", "district_enc"),
    ]:
        le = LabelEncoder()
        df[enc_col] = le.fit_transform(df[col].astype(str))
        encoders[col] = le

    # Hash encoding into limited buckets — provides some categorical signal
    # while preventing exact identification of groups (and target leakage).
    for col, enc_col, n_buckets in [
        ("region", "region_enc", 6),
        ("direction", "direction_enc", 5),
        ("subsidy_category", "subsidy_category_enc", 6),
        ("district", "district_enc", 20),
    ]:
        df[enc_col] = df[col].astype(str).apply(lambda x: hash(x) % n_buckets)

    X = df[FEATURE_COLS].values.astype(np.float64)
    X = np.nan_to_num(X, nan=0.0, posinf=0.0, neginf=0.0)
    y = df["target"].values.astype(int)
    return X, y, FEATURE_COLS, encoders, df
