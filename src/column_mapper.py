"""Smart Column Mapper — автоматический маппинг колонок входного файла."""
from difflib import SequenceMatcher
import pandas as pd

REQUIRED = {
    "date": ["дата", "date", "дата подачи", "дата заявки", "created", "дата поступления"],
    "region": ["область", "region", "регион"],
    "district": ["район", "district", "аудан", "район хозяйства"],
    "direction": ["направление", "direction", "вид субсидии", "направление водства"],
    "subsidy_name": ["наименование субсидии", "subsidy_name", "название", "наименование", "наименование субсидирования"],
    "status": ["статус", "status", "состояние", "статус заявки"],
    "normative": ["норматив", "normative", "норма", "ставка"],
    "amount": ["сумма", "amount", "запрашиваемая сумма", "размер", "причитающая сумма"],
}

OPTIONAL = {
    "id": ["id", "№", "номер п/п", "ид", "№ п/п"],
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
        return df
    elif ext in (".xlsx", ".xls"):
        best_df = None
        best_score = -1
        # Пробуем разные варианты skiprows, ищем строку с заголовками
        for skip in [0, 1, 2, 3, 4, 5, 6, 7, 8]:
            try:
                df = pd.read_excel(filepath, skiprows=skip)
                if len(df) < 5:
                    continue
                # Drop completely empty columns (spacer columns like "Unnamed: 2")
                df = df.dropna(axis=1, how="all")
                # Оценка качества: сколько колонок НЕ начинаются с "Unnamed"
                named = sum(1 for c in df.columns if not str(c).startswith("Unnamed"))
                total = len(df.columns)
                # Проверяем маппинг
                mapping = auto_map_columns(list(df.columns))
                matched = len(mapping.get("mapping", {}))
                score = named * 10 + matched * 100
                if score > best_score:
                    best_score = score
                    best_df = df
                # Если всё сматчилось — отлично
                if mapping.get("ready"):
                    return df
            except Exception:
                continue
        # Также пробуем header=None (файл без заголовков)
        try:
            for skip in [5, 4, 6, 3]:
                df = pd.read_excel(filepath, header=None, skiprows=skip)
                # Drop completely empty columns
                df = df.dropna(axis=1, how="all")
                if len(df) > 10 and len(df.columns) >= 8:
                    # Назначаем стандартные имена ГИСС
                    giss_cols = ["id", "date", "region", "akimat",
                                 "request_num", "direction", "subsidy_name", "status",
                                 "normative", "amount", "district"]
                    if len(df.columns) == len(giss_cols):
                        df.columns = giss_cols
                        return df
                    elif len(df.columns) >= 11:
                        cols = list(df.columns)
                        rename = {}
                        for i, name in enumerate(giss_cols):
                            if i < len(cols):
                                rename[cols[i]] = name
                        df = df.rename(columns=rename)
                        return df
        except Exception:
            pass
        # Return best found df, also dropping empty columns
        if best_df is not None:
            return best_df
        df = pd.read_excel(filepath)
        df = df.dropna(axis=1, how="all")
        return df
    else:
        raise ValueError(f"Неподдерживаемый формат: {ext}. Поддерживаются: .xlsx, .xls, .csv")
