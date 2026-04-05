"""
SubsidyScore AI — Regulatory Framework (НПА РК)

Интеграция нормативно-правовых актов Республики Казахстан:
1. Приказ МСХ РК от 14.04.2015 №3-3/332 (V1500011064) — Нормы нагрузки на пастбища
2. Приказ МСХ РК V1900018404 — Правила субсидирования племенного животноводства
3. Приказ МСХ РК V1500012488 — Правила субсидирования растениеводства

Используется на двух уровнях:
A) ML-features: is_priority_direction, normative_in_npa_range, pasture_capacity → обучение модели
B) Composite scoring: Regulatory Score → компонент Merit Score
"""

import numpy as np
import pandas as pd


# ══════════════════════════════════════════════════════
# НПА 1: V1500011064 — Нормы нагрузки на пастбища
# ══════════════════════════════════════════════════════

PASTURE_ZONES = {
    "лесостепная":   {"norm": 0.80, "desc": "Северный КЗ, высокая ёмкость"},
    "степная":       {"norm": 0.50, "desc": "Центральный КЗ"},
    "сухостепная":   {"norm": 0.30, "desc": "Западный КЗ"},
    "полупустынная": {"norm": 0.15, "desc": "Южный КЗ"},
    "пустынная":     {"norm": 0.08, "desc": "Юго-запад КЗ, низкая ёмкость"},
    "горная":        {"norm": 0.40, "desc": "Горные районы"},
}

REGION_ZONES = {
    "Акмолинская область": "степная",
    "Актюбинская область": "сухостепная",
    "Алматинская область": "горная",
    "Атырауская область": "пустынная",
    "Восточно-Казахстанская область": "лесостепная",
    "Жамбылская область": "полупустынная",
    "Западно-Казахстанская область": "сухостепная",
    "Карагандинская область": "степная",
    "Костанайская область": "степная",
    "Кызылординская область": "пустынная",
    "Мангистауская область": "пустынная",
    "Павлодарская область": "степная",
    "Северо-Казахстанская область": "лесостепная",
    "Туркестанская область": "полупустынная",
    "область Ұлытау": "сухостепная",
    "область Абай": "степная",
    "область Жетісу": "горная",
    "город Шымкент": "полупустынная",
}


# ══════════════════════════════════════════════════════
# НПА 2: V1900018404 — Субсидирование животноводства
# ══════════════════════════════════════════════════════

LIVESTOCK_NORMS = {
    "Субсидирование в скотоводстве": {
        "npa": "V1900018404", "priority": "high",
        "normative_range": (5000, 50000),
        "desc": "Развитие племенного КРС, повышение продуктивности",
    },
    "Субсидирование в овцеводстве": {
        "npa": "V1900018404", "priority": "high",
        "normative_range": (1000, 15000),
        "desc": "Племенное овцеводство, шерсть, селекция",
    },
    "Субсидирование в коневодстве": {
        "npa": "V1900018404", "priority": "medium",
        "normative_range": (5000, 40000),
        "desc": "Племенное коневодство",
    },
    "Субсидирование в верблюдоводстве": {
        "npa": "V1900018404", "priority": "medium",
        "normative_range": (5000, 30000),
        "desc": "Племенное верблюдоводство",
    },
    "Субсидирование в птицеводстве": {
        "npa": "V1900018404", "priority": "medium",
        "normative_range": (100, 5000),
        "desc": "Птицеводство, яйценоскость",
    },
    "Субсидирование в свиноводстве": {
        "npa": "V1900018404", "priority": "low",
        "normative_range": (3000, 20000),
        "desc": "Племенное свиноводство",
    },
    "Субсидирование в козоводстве": {
        "npa": "V1900018404", "priority": "medium",
        "normative_range": (1000, 10000),
        "desc": "Племенное козоводство",
    },
    "Субсидирование в пчеловодстве": {
        "npa": "V1900018404", "priority": "low",
        "normative_range": (500, 5000),
        "desc": "Племенное пчеловодство",
    },
    "Субсидирование затрат по искусственному осеменению": {
        "npa": "V1900018404", "priority": "high",
        "normative_range": (2000, 10000),
        "desc": "Искусственное осеменение КРС и МРС",
    },
}

PRIORITY_MAP = {"high": 3, "medium": 2, "low": 1}


# ══════════════════════════════════════════════════════
# НПА 3: V1500012488 — Субсидирование растениеводства
# ══════════════════════════════════════════════════════

CROP_NORMS = {
    "npa": "V1500012488",
    "desc": "Субсидирование повышения урожайности и качества продукции растениеводства",
    "reimbursement_rates": {
        "оригинальные семена": 0.70,
        "элитные семена": 0.70,
        "первая репродукция": 0.50,
        "гибриды F1": 0.50,
    },
}


# ══════════════════════════════════════════════════════
# ML Features из НПА (уровень A)
# ══════════════════════════════════════════════════════

def add_regulatory_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Добавляет ML-features на основе НПА. Эти фичи идут в FEATURE_COLS
    и используются при обучении модели — модель УЧИТСЯ на нормативном контексте.
    """
    df = df.copy()

    # 1. is_priority_direction: направление с высоким приоритетом по НПА
    df["is_priority_direction"] = df["direction"].apply(
        lambda d: PRIORITY_MAP.get(
            LIVESTOCK_NORMS.get(str(d), {}).get("priority", ""), 0
        )
    )

    # 2. normative_in_npa_range: норматив попадает в диапазон НПА
    def _check_norm_range(row):
        norms = LIVESTOCK_NORMS.get(str(row.get("direction", "")))
        if not norms:
            return 0
        normative = float(row.get("normative", 0) or 0)
        if normative <= 0:
            return 0
        lo, hi = norms["normative_range"]
        if lo <= normative <= hi:
            return 1
        return -1  # вне диапазона
    df["normative_in_npa_range"] = df.apply(_check_norm_range, axis=1)

    # 3. pasture_capacity: ёмкость пастбищ региона (из V1500011064)
    df["pasture_capacity"] = df["region"].apply(
        lambda r: PASTURE_ZONES.get(REGION_ZONES.get(str(r), ""), {}).get("norm", 0.0)
    )

    return df


# ══════════════════════════════════════════════════════
# Regulatory Score (уровень B — composite scoring)
# ══════════════════════════════════════════════════════

def compute_regulatory_score(row: pd.Series) -> float:
    """Regulatory Compliance Score [0-100]."""
    score = 50.0
    direction = str(row.get("direction", ""))
    region = str(row.get("region", ""))
    normative = float(row.get("normative", 0) or 0)

    norms = LIVESTOCK_NORMS.get(direction)
    if norms:
        score += 20
        p = norms["priority"]
        score += 10 if p == "high" else (5 if p == "medium" else 0)
        lo, hi = norms["normative_range"]
        if normative > 0:
            if lo <= normative <= hi:
                score += 15
            elif normative > hi * 1.5 or (0 < normative < lo * 0.5):
                score -= 5

    if any(kw in direction.lower() for kw in ["скотовод", "овцевод", "коневод", "верблюд"]):
        zone = REGION_ZONES.get(region, "")
        pn = PASTURE_ZONES.get(zone, {}).get("norm", 0)
        if pn >= 0.5:
            score += 10
        elif pn >= 0.3:
            score += 5

    return float(np.clip(score, 0, 100))


def get_regulatory_explanation(row: pd.Series) -> dict:
    """Текстовое объяснение для explainability."""
    direction = str(row.get("direction", ""))
    region = str(row.get("region", ""))
    normative = float(row.get("normative", 0) or 0)
    factors = []
    refs = []

    norms = LIVESTOCK_NORMS.get(direction)
    if norms:
        refs.append({"id": norms["npa"], "url": f"https://adilet.zan.kz/rus/docs/{norms['npa']}"})
        factors.append(f"Направление «{direction}» — приоритет: {norms['priority']} (НПА {norms['npa']})")
        lo, hi = norms["normative_range"]
        if normative > 0:
            in_range = "в допустимом диапазоне" if lo <= normative <= hi else "вне диапазона"
            factors.append(f"Норматив {normative:,.0f} тг — {in_range} ({lo:,}–{hi:,} тг)")

    zone = REGION_ZONES.get(region, "")
    if zone:
        refs.append({"id": "V1500011064", "url": "https://adilet.zan.kz/rus/docs/V1500011064"})
        pn = PASTURE_ZONES.get(zone, {}).get("norm", 0)
        factors.append(f"Регион «{region}» — зона «{zone}», ёмкость: {pn} усл.гол/га")

    return {"factors": factors, "npa_references": refs, "summary": "; ".join(factors)}


def get_all_npa_info() -> dict:
    """Полная информация об НПА для dashboard."""
    return {
        "documents": [
            {
                "id": "V1500011064",
                "title": "Предельно допустимые нормы нагрузки на площадь пастбищ",
                "authority": "Приказ МСХ РК от 14.04.2015 №3-3/332",
                "url": "https://adilet.zan.kz/rus/docs/V1500011064",
                "usage": "ML-feature pasture_capacity + Regulatory Score для скотоводческих направлений",
            },
            {
                "id": "V1900018404",
                "title": "Правила субсидирования развития племенного животноводства",
                "authority": "Приказ МСХ РК",
                "url": "https://adilet.zan.kz/rus/docs/V1900018404",
                "usage": "ML-features is_priority_direction, normative_in_npa_range + Regulatory Score",
            },
            {
                "id": "V1500012488",
                "title": "Правила субсидирования повышения урожайности растениеводства",
                "authority": "Приказ МСХ РК",
                "url": "https://adilet.zan.kz/rus/docs/V1500012488",
                "usage": "Нормативы возмещения затрат растениеводства (50-70%)",
            },
        ],
        "pasture_zones": {k: v for k, v in PASTURE_ZONES.items()},
        "region_zones": REGION_ZONES,
        "livestock_norms": {k: {**v, "normative_range": list(v["normative_range"])} for k, v in LIVESTOCK_NORMS.items()},
        "crop_norms": CROP_NORMS,
    }
