"""Smart Column Mapper — автоматический маппинг колонок входного файла."""
from difflib import SequenceMatcher
import pandas as pd

REQUIRED = {
    "date": ["дата", "date", "дата подачи", "дата заявки", "created"],
    "region": ["область", "region", "регион"],
    "district": ["район", "district", "аудан"],
    "direction": ["направление", "direction", "вид субсидии"],
    "subsidy_name": ["наименование субсидии", "subsidy_name", "название", "наименование"],
    "status": ["статус", "status", "состояние"],
    "normative": ["норматив", "normative", "норма", "ставка"],
    "amount": ["сумма", "amount", "запрашиваемая сумма", "размер"],
}

OPTIONAL = {
    "id": ["id", "№", "номер п/п", "ид"],
    "request_num": ["номер заявки", "request_num", "заявка"],
    "akimat": ["акимат", "akimat"],
}

def auto_map_columns(file_columns: list) -> dict:
    mapping = {}
    used = set()
    cols_lower = {c: c.lower().strip() for c in file_columns}

    for expected, aliases in {**REQUIRED, **OPTIONAL}.items():
        for actual, actual_low in cols_lower.items():
            if actual in used:
                continue
            if actual_low in [a.lower() for a in aliases]:
                mapping[expected] = actual
                used.add(actual)
                break

    for expected, aliases in REQUIRED.items():
        if expected in mapping:
            continue
        best_score, best_col = 0, None
        for actual, actual_low in cols_lower.items():
            if actual in used:
                continue
            for alias in aliases:
                s = SequenceMatcher(None, actual_low, alias.lower()).ratio()
                if s > best_score and s > 0.55:
                    best_score, best_col = s, actual
        if best_col:
            mapping[expected] = best_col
            used.add(best_col)

    unmatched = [c for c in REQUIRED if c not in mapping]
    extra = [c for c in file_columns if c not in used]
    return {
        "mapping": mapping,
        "unmatched_required": unmatched,
        "extra_columns": extra,
        "ready": len(unmatched) == 0,
        "confidence": round(len(mapping) / len(REQUIRED), 2),
    }

def apply_mapping(df: pd.DataFrame, mapping: dict) -> pd.DataFrame:
    rename = {v: k for k, v in mapping.items()}
    df = df.rename(columns=rename)
    for col in REQUIRED:
        if col not in df.columns:
            df[col] = ""
    return df

def smart_read_file(filepath: str) -> pd.DataFrame:
    """Умное чтение файла: определяет формат, находит header."""
    import os
    ext = os.path.splitext(filepath)[1].lower()

    if ext == ".csv":
        df = pd.read_csv(filepath)
    elif ext in (".xlsx", ".xls"):
        # Пробуем разные варианты header
        for skip in [0, 1, 2, 3, 4, 5, 6]:
            try:
                df = pd.read_excel(filepath, skiprows=skip)
                # Если первая колонка — числовой id, мы нашли данные
                if len(df) > 10 and not all(isinstance(c, str) and len(str(c)) > 50 for c in df.columns):
                    break
            except Exception:
                continue
        else:
            df = pd.read_excel(filepath)
    else:
        raise ValueError(f"Неподдерживаемый формат: {ext}. Поддерживаются: .xlsx, .xls, .csv")

    return df
