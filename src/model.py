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
                n_estimators=200, max_depth=5, learning_rate=0.1,
                subsample=0.8, random_state=42,
            ),
            "RandomForest": RandomForestClassifier(
                n_estimators=200, max_depth=10, random_state=42, n_jobs=-1,
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

    # ---------- Предсказание скора ----------

    def predict_score(self, X: np.ndarray) -> np.ndarray:
        """Weighted ensemble: GB*0.5 + RF*0.3 + LR*0.2, масштаб [0, 100]."""
        p_gb = self.models["GradientBoosting"].predict_proba(X)[:, 1]
        p_rf = self.models["RandomForest"].predict_proba(X)[:, 1]
        p_lr = self.models["LogisticRegression"].predict_proba(self.scaler.transform(X))[:, 1]

        ensemble = 0.5 * p_gb + 0.3 * p_rf + 0.2 * p_lr
        return np.clip(ensemble * 100, 0, 100)

    # ---------- Explainability ----------

    def explain_single(self, X_single: np.ndarray, feature_cols: list = None, top_n: int = 5) -> dict:
        """Объяснение скора одной заявки: ключевые факторы."""
        cols = feature_cols or self.feature_cols or []
        score = float(self.predict_score(X_single.reshape(1, -1))[0])

        # Feature contributions через permutation importance
        sorted_feats = sorted(self.importances.items(), key=lambda x: abs(x[1]), reverse=True)
        top_factors = []
        for feat, imp in sorted_feats[:top_n]:
            idx = cols.index(feat) if feat in cols else -1
            val = float(X_single[idx]) if idx >= 0 else 0.0
            top_factors.append({
                "feature": feat,
                "value": round(val, 4),
                "importance": round(imp, 6),
            })

        risk = _risk_level(score)
        return {"score": round(score, 2), "risk_level": risk, "top_factors": top_factors}

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

        # Метрики
        total = len(df)
        avg_score = round(float(df["ml_score"].mean()), 2)
        total_amount = float(df["amount"].sum())
        recommended = int((df["risk_level"] == "recommended").sum())
        pct_recommended = round(recommended / total * 100, 1) if total else 0

        # Распределение скоров (гистограмма)
        bins = list(range(0, 101, 5))
        hist, _ = np.histogram(df["ml_score"], bins=bins)
        score_distribution = [
            {"range": f"{bins[i]}-{bins[i+1]}", "count": int(hist[i])}
            for i in range(len(hist))
        ]

        # Распределение рисков
        risk_counts = df["risk_level"].value_counts().to_dict()
        risk_distribution = [{"level": k, "count": v} for k, v in risk_counts.items()]

        # По направлениям
        dir_stats = df.groupby("direction").agg(
            count=("ml_score", "size"),
            avg_score=("ml_score", "mean"),
        ).reset_index()
        direction_stats = [
            {"direction": row["direction"], "count": int(row["count"]),
             "avg_score": round(float(row["avg_score"]), 2)}
            for _, row in dir_stats.iterrows()
        ]

        # По регионам
        reg_stats = df.groupby("region").agg(
            count=("ml_score", "size"),
            avg_score=("ml_score", "mean"),
            recommended=("risk_level", lambda x: int((x == "recommended").sum())),
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

        # Топ-10 заявок
        top10 = df.nsmallest(10, "rank")
        top_applications = [
            {"rank": int(row["rank"]), "request_num": str(row["request_num"]),
             "region": row["region"], "direction": row["direction"],
             "amount": float(row["amount"]), "score": round(float(row["ml_score"]), 2),
             "risk_level": row["risk_level"]}
            for _, row in top10.iterrows()
        ]

        # Пример объяснения (первая заявка)
        example_explain = None
        if len(top10) > 0:
            first = top10.iloc[0]
            example_explain = {
                "request_num": str(first["request_num"]),
                "score": round(float(first["ml_score"]), 2),
                "risk_level": first["risk_level"],
                "region": first["region"],
                "direction": first["direction"],
                "amount": float(first["amount"]),
                "factors": feature_importance[:5],
            }

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
