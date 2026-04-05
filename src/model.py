"""
SubsidyScore AI — ML Models & Explainability
Ансамбль из 3 моделей: GradientBoosting, RandomForest, LogisticRegression.
"""

import json
import numpy as np
import pandas as pd
from pathlib import Path
from sklearn.ensemble import GradientBoostingClassifier, RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import StratifiedKFold
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import roc_auc_score, accuracy_score, f1_score, precision_score, recall_score
from sklearn.inspection import permutation_importance


class SubsidyScoringModel:
    """Ансамблевая ML-модель для скоринга заявок на субсидии."""

    def __init__(self):
        self.models = {}
        self.scaler = StandardScaler()
        self.feature_cols = None
        self.cv_results = {}
        self.importances = {}

    # ---------- Инициализация моделей ----------

    def build_models(self):
        self.models = {
            "GradientBoosting": GradientBoostingClassifier(
                n_estimators=200, max_depth=4, learning_rate=0.05,
                subsample=0.8, min_samples_leaf=50, random_state=42,
            ),
            "RandomForest": RandomForestClassifier(
                n_estimators=200, max_depth=6, min_samples_leaf=30,
                random_state=42, n_jobs=-1,
            ),
            "LogisticRegression": LogisticRegression(
                max_iter=1000, C=1.0, random_state=42,
            ),
        }

    # ---------- Обучение с кросс-валидацией ----------

    def train(self, X: np.ndarray, y: np.ndarray, feature_cols: list) -> dict:
        self.feature_cols = feature_cols
        self.build_models()

        skf = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
        results = {}

        # Fit scaler on full data for LR
        self.scaler.fit(X)

        for name, model in self.models.items():
            fold_metrics = {"auc": [], "acc": [], "f1": [], "prec": [], "rec": []}
            X_input = self.scaler.transform(X) if name == "LogisticRegression" else X

            for train_idx, val_idx in skf.split(X_input, y):
                X_tr, X_val = X_input[train_idx], X_input[val_idx]
                y_tr, y_val = y[train_idx], y[val_idx]

                model_clone = _clone_model(model)
                model_clone.fit(X_tr, y_tr)

                y_prob = model_clone.predict_proba(X_val)[:, 1]
                y_pred = model_clone.predict(X_val)

                fold_metrics["auc"].append(roc_auc_score(y_val, y_prob))
                fold_metrics["acc"].append(accuracy_score(y_val, y_pred))
                fold_metrics["f1"].append(f1_score(y_val, y_pred))
                fold_metrics["prec"].append(precision_score(y_val, y_pred))
                fold_metrics["rec"].append(recall_score(y_val, y_pred))

            results[name] = {k: round(float(np.mean(v)), 4) for k, v in fold_metrics.items()}
            print(f"  {name:25s}  AUC={results[name]['auc']:.4f}  "
                  f"Acc={results[name]['acc']:.4f}  F1={results[name]['f1']:.4f}")

        # Fit all models on full data
        for name, model in self.models.items():
            X_input = self.scaler.transform(X) if name == "LogisticRegression" else X
            model.fit(X_input, y)

        # Permutation importance (на основном GradientBoosting)
        perm = permutation_importance(
            self.models["GradientBoosting"], X, y,
            n_repeats=5, random_state=42, n_jobs=-1,
        )
        self.importances = {
            feature_cols[i]: round(float(perm.importances_mean[i]), 6)
            for i in range(len(feature_cols))
        }
        self.cv_results = results
        return results

    # ---------- Temporal Validation ----------

    def temporal_validate(self, X, y, dates, feature_cols):
        """Train на первых 80% по дате, test на последних 20%."""
        # Build fresh models for temporal validation (don't overwrite self.models)
        temp_models = {
            "GradientBoosting": GradientBoostingClassifier(
                n_estimators=200, max_depth=4, learning_rate=0.05,
                subsample=0.8, min_samples_leaf=50, random_state=42,
            ),
            "RandomForest": RandomForestClassifier(
                n_estimators=200, max_depth=6, min_samples_leaf=30,
                random_state=42, n_jobs=-1,
            ),
            "LogisticRegression": LogisticRegression(
                max_iter=1000, C=1.0, random_state=42,
            ),
        }
        date_vals = pd.to_datetime(dates).astype(np.int64).values
        sorted_idx = np.argsort(date_vals)
        split = int(len(sorted_idx) * 0.8)
        tr_idx, te_idx = sorted_idx[:split], sorted_idx[split:]
        X_tr, X_te, y_tr, y_te = X[tr_idx], X[te_idx], y[tr_idx], y[te_idx]
        scaler = StandardScaler().fit(X_tr)
        results = {}
        for name, mdl in temp_models.items():
            Xtr = scaler.transform(X_tr) if name == "LogisticRegression" else X_tr
            Xte = scaler.transform(X_te) if name == "LogisticRegression" else X_te
            m = _clone_model(mdl)
            m.fit(Xtr, y_tr)
            yp = m.predict_proba(Xte)[:, 1]
            yd = m.predict(Xte)
            results[name] = {
                "auc": round(float(roc_auc_score(y_te, yp)), 4),
                "acc": round(float(accuracy_score(y_te, yd)), 4),
                "f1": round(float(f1_score(y_te, yd)), 4),
                "prec": round(float(precision_score(y_te, yd)), 4),
                "rec": round(float(recall_score(y_te, yd)), 4),
                "train_size": len(tr_idx), "test_size": len(te_idx),
            }
        return results

    # ---------- Anomaly Detection ----------

    def detect_anomalies(self, X, contamination=0.03):
        """IsolationForest для выявления аномальных заявок."""
        from sklearn.ensemble import IsolationForest
        iso = IsolationForest(contamination=contamination, random_state=42, n_jobs=-1)
        return iso.fit_predict(X)

    # ---------- Предсказание скора ----------

    def predict_score(self, X: np.ndarray) -> np.ndarray:
        """Weighted ensemble: GB*0.5 + RF*0.3 + LR*0.2, масштаб [0, 100]."""
        p_gb = self.models["GradientBoosting"].predict_proba(X)[:, 1]
        p_rf = self.models["RandomForest"].predict_proba(X)[:, 1]
        p_lr = self.models["LogisticRegression"].predict_proba(self.scaler.transform(X))[:, 1]

        ensemble = 0.5 * p_gb + 0.3 * p_rf + 0.2 * p_lr
        return np.clip(ensemble * 100, 0, 100)

    # ---------- Explainability ----------

    def explain_single(self, X_single: np.ndarray, feature_cols: list = None,
                       row: pd.Series = None, top_n: int = 5) -> dict:
        """Объяснение скора одной заявки с человекочитаемыми описаниями."""
        cols = feature_cols or self.feature_cols or []
        score = float(self.predict_score(X_single.reshape(1, -1))[0])

        sorted_feats = sorted(self.importances.items(), key=lambda x: abs(x[1]), reverse=True)
        top_factors = []
        for feat, imp in sorted_feats[:top_n]:
            idx = cols.index(feat) if feat in cols else -1
            val = float(X_single[idx]) if idx >= 0 else 0.0
            desc = _feature_description(feat, val, row)
            top_factors.append({
                "feature": _FEATURE_NAMES_RU.get(feat, feat),
                "value": round(val, 4),
                "importance": round(imp, 6),
                "impact": "positive" if val > 0.5 else "neutral",
                "description": desc,
            })

        risk = _risk_level(score)

        result = {"score": round(score, 2), "risk_level": risk, "top_factors": top_factors}

        if row is not None:
            components = {}
            for comp in ["efficiency_score", "reliability_score", "need_score", "regulatory_score", "merit_score"]:
                if comp in row.index:
                    components[comp.replace("_score", "")] = {
                        "score": round(float(row[comp]), 1),
                        "description": _COMPONENT_DESCRIPTIONS.get(comp, ""),
                    }
            components["ml_prediction"] = {
                "score": round(score, 1),
                "description": "Вероятность одобрения по историческим данным",
            }
            result["components"] = components

        return result

    # ---------- Рейтинг ----------

    def generate_ranking(self, X: np.ndarray, df_full: pd.DataFrame) -> pd.DataFrame:
        """Формирует рейтинг заявок по ML-скору."""
        df = df_full.copy()
        df["ml_score"] = self.predict_score(X)
        df["rank"] = df["ml_score"].rank(ascending=False, method="min").astype(int)
        df["risk_level"] = df["ml_score"].apply(_risk_level)
        df = df.sort_values("rank")
        return df

    # ---------- Сохранение результатов ----------

    def save_results(self, ranking: pd.DataFrame, results: dict, output_dir: str):
        out = Path(output_dir)
        out.mkdir(parents=True, exist_ok=True)

        # ranking.csv
        ranking.to_csv(out / "ranking.csv", index=False)

        # model_results.json
        with open(out / "model_results.json", "w", encoding="utf-8") as f:
            json.dump(results, f, indent=2, ensure_ascii=False)

        # feature_importance.csv
        imp_df = pd.DataFrame(
            sorted(self.importances.items(), key=lambda x: x[1], reverse=True),
            columns=["feature", "importance"],
        )
        imp_df.to_csv(out / "feature_importance.csv", index=False)

        # dashboard_data.json
        dash = self._build_dashboard_data(ranking, results)
        with open(out / "dashboard_data.json", "w", encoding="utf-8") as f:
            json.dump(dash, f, indent=2, ensure_ascii=False)

    def _build_dashboard_data(self, ranking: pd.DataFrame, results: dict) -> dict:
        """Собирает JSON для дашборда."""
        df = ranking

        # Use merit scores if available, fall back to ml_score
        score_col = "merit_score" if "merit_score" in df.columns else "ml_score"
        risk_col = "merit_risk_level" if "merit_risk_level" in df.columns else "risk_level"

        # Метрики
        total = len(df)
        avg_score = round(float(df[score_col].mean()), 2)
        total_amount = float(df["amount"].sum())
        recommended = int((df[risk_col] == "recommended").sum())
        pct_recommended = round(recommended / total * 100, 1) if total else 0

        # Распределение скоров (гистограмма)
        bins = list(range(0, 101, 5))
        hist, _ = np.histogram(df[score_col], bins=bins)
        score_distribution = [
            {"range": f"{bins[i]}-{bins[i+1]}", "count": int(hist[i])}
            for i in range(len(hist))
        ]

        # Распределение рисков
        risk_counts = df[risk_col].value_counts().to_dict()
        risk_distribution = [{"level": k, "count": v} for k, v in risk_counts.items()]

        # По направлениям
        dir_stats = df.groupby("direction").agg(
            count=(score_col, "size"),
            avg_score=(score_col, "mean"),
        ).reset_index()
        direction_stats = [
            {"direction": row["direction"], "count": int(row["count"]),
             "avg_score": round(float(row["avg_score"]), 2)}
            for _, row in dir_stats.iterrows()
        ]

        # По регионам
        reg_stats = df.groupby("region").agg(
            count=(score_col, "size"),
            avg_score=(score_col, "mean"),
            recommended=(risk_col, lambda x: int((x == "recommended").sum())),
        ).reset_index()
        region_stats = [
            {"region": row["region"], "count": int(row["count"]),
             "avg_score": round(float(row["avg_score"]), 2),
             "recommended": int(row["recommended"]),
             "pct_recommended": round(int(row["recommended"]) / int(row["count"]) * 100, 1)}
            for _, row in reg_stats.iterrows()
        ]

        # Feature importance top-15
        feat_imp = sorted(self.importances.items(), key=lambda x: x[1], reverse=True)[:15]
        feature_importance = [{"feature": f, "importance": round(i, 6)} for f, i in feat_imp]

        # Топ-10 заявок (by merit_rank if available)
        rank_col = "merit_rank" if "merit_rank" in df.columns else "rank"
        top10 = df.nsmallest(10, rank_col)
        top_applications = [
            {"rank": int(row[rank_col]), "request_num": str(row["request_num"]),
             "region": row["region"], "district": row.get("district", ""),
             "direction": row["direction"],
             "amount": float(row["amount"]), "score": round(float(row[score_col]), 2),
             "risk_level": row[risk_col]}
            for _, row in top10.iterrows()
        ]

        # Пример объяснения (первая заявка)
        example_explain = None
        if len(top10) > 0:
            first = top10.iloc[0]
            example_explain = {
                "request_num": str(first["request_num"]),
                "score": round(float(first[score_col]), 2),
                "risk_level": first[risk_col],
                "region": first["region"],
                "direction": first["direction"],
                "amount": float(first["amount"]),
                "factors": feature_importance[:5],
            }
            # Add component scores if available
            for comp in ["efficiency_score", "reliability_score", "need_score", "regulatory_score", "ml_score", "merit_score"]:
                if comp in first.index:
                    example_explain[comp] = round(float(first[comp]), 1)

        return {
            "overview": {
                "total_applications": total,
                "avg_score": avg_score,
                "total_amount": total_amount,
                "recommended": recommended,
                "pct_recommended": pct_recommended,
            },
            "score_distribution": score_distribution,
            "risk_distribution": risk_distribution,
            "direction_stats": direction_stats,
            "region_stats": region_stats,
            "model_results": results,
            "feature_importance": feature_importance,
            "top_applications": top_applications,
            "example_explain": example_explain,
        }


# ---------- Helpers ----------

_FEATURE_NAMES_RU = {
    "direction_approval_rate": "Одобряемость направления",
    "category_approval_rate": "Одобряемость категории",
    "region_approval_rate": "Одобряемость региона",
    "log_amount": "Сумма запроса",
    "log_normative": "Норматив",
    "log_estimated_units": "Расчётные единицы",
    "amount_vs_regional_median": "Сумма vs медиана региона",
    "amount_vs_category_median": "Сумма vs медиана категории",
    "is_large_request": "Крупный запрос",
    "month": "Месяц подачи",
    "quarter": "Квартал подачи",
    "day_of_week": "День недели",
    "hour": "Час подачи",
    "is_working_hours": "Рабочие часы",
    "is_weekday": "Рабочий день",
    "submission_speed": "Скорость подачи",
    "region_application_count": "Заявок в регионе",
    "district_application_count": "Заявок в районе",
    "month_application_count": "Заявок в месяце",
    "region_enc": "Регион (код)",
    "direction_enc": "Направление (код)",
    "subsidy_category_enc": "Категория субсидии (код)",
    "district_enc": "Район (код)",
    "is_priority_direction": "Приоритет направления (НПА)",
    "normative_in_npa_range": "Норматив в диапазоне НПА",
    "pasture_capacity": "Пастбищная ёмкость региона",
}

_COMPONENT_DESCRIPTIONS = {
    "efficiency_score": "Адекватность запроса нормативам категории",
    "reliability_score": "Паттерны надёжного заявителя",
    "need_score": "Обоснованность потребности региона",
    "regulatory_score": "Соответствие нормативно-правовым актам РК",
    "merit_score": "Композитный Merit-скор",
}


def _feature_description(feat: str, val: float, row=None) -> str:
    """Человекочитаемое описание фактора."""
    descriptions = {
        "direction_approval_rate": f"Направление имеет исторический процент одобрения {val*100:.0f}%",
        "category_approval_rate": f"Категория субсидии одобряется в {val*100:.0f}% случаев",
        "region_approval_rate": f"Регион имеет процент одобрения {val*100:.0f}%",
        "submission_speed": f"Заявка подана на {(1-val)*100:.0f}% от конца периода приёма",
        "is_working_hours": "Подана в рабочее время" if val == 1 else "Подана вне рабочих часов",
        "is_weekday": "Подана в рабочий день" if val == 1 else "Подана в выходной",
        "log_amount": f"Логарифм суммы запроса: {val:.2f}",
        "log_normative": f"Логарифм норматива: {val:.2f}",
        "amount_vs_regional_median": f"Сумма составляет {val*100:.0f}% от медианы региона",
        "amount_vs_category_median": f"Сумма составляет {val*100:.0f}% от медианы категории",
        "is_large_request": "Запрос в топ-10% по сумме" if val == 1 else "Стандартный размер запроса",
        "region_application_count": f"В регионе подано {val:.0f} заявок",
        "district_application_count": f"В районе подано {val:.0f} заявок",
    }
    return descriptions.get(feat, f"Значение: {val:.4f}")


def _risk_level(score: float) -> str:
    if score >= 70:
        return "recommended"
    if score >= 50:
        return "low_risk"
    if score >= 30:
        return "medium_risk"
    return "high_risk"


def _clone_model(model):
    """Простое клонирование модели через параметры."""
    from sklearn.base import clone
    return clone(model)
