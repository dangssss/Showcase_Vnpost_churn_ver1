# Faithful re-run of VNPost_Churn_Prediction_Final_Demo.ipynb (seed 42) that
# exports JSON artifacts for the showcase. Model/data cells are copied verbatim
# from the notebook so the RNG call order and results stay identical.
from __future__ import annotations

import json
import sys
import warnings

warnings.filterwarnings("ignore")

import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    average_precision_score, balanced_accuracy_score, confusion_matrix,
    f1_score, precision_recall_curve, precision_score, recall_score,
    roc_auc_score, roc_curve,
)
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler
import xgboost as xgb

SEED = 42
N_CUSTOMERS = 1_400
N_MONTHS = 22
HORIZON = 2
K_CANDIDATES = [3, 6, 9, 13]
LABEL_COL = f"y_churn_t_plus_{HORIZON}"
rng = np.random.default_rng(SEED)

PRODUCTION_REFERENCE = {
    "source_commit": "a76ef64c1f7ddade905ccfd2ca5f6bd702c8479d",
    "best_k": 13,
    "horizon": 2,
    "lr_f1_val": 0.764289,
    "lr_ap_val": 0.864325,
    "xgb_f1_val": 0.784030,
    "xgb_ap_val": 0.871149,
    "xgb_threshold": 0.275306,
}


def sigmoid(z):
    return 1.0 / (1.0 + np.exp(-np.clip(z, -30, 30)))


months = pd.period_range("2025-01", periods=N_MONTHS, freq="M")
customer_ids = np.array([f"T{i:07d}" for i in range(N_CUSTOMERS)])

tenure = rng.integers(3, 121, N_CUSTOMERS)
service_types = rng.choice([1, 2, 3, 4], N_CUSTOMERS, p=[0.30, 0.38, 0.23, 0.09])
custype = rng.choice([0, 1, 2], N_CUSTOMERS, p=[0.10, 0.66, 0.24])
region = rng.choice(["BAC", "TRUNG", "NAM", "NOI_HN", "NOI_HCM"], N_CUSTOMERS)
dominant_service = rng.choice(list("CEMRL"), N_CUSTOMERS, p=[0.35, 0.43, 0.05, 0.14, 0.03])
quality_risk = rng.normal(0, 1, N_CUSTOMERS)
base_items = rng.lognormal(mean=3.25, sigma=0.65, size=N_CUSTOMERS)
revenue_per_item = rng.lognormal(mean=10.20, sigma=0.30, size=N_CUSTOMERS)

static_risk = (
    0.75 * (tenure < 12) + 0.55 * (service_types == 1)
    + 0.50 * (custype == 1) + 0.65 * quality_risk
)

state = rng.normal(0, 0.7, N_CUSTOMERS)
raw_parts, label_parts = [], []

for month_idx, month in enumerate(months):
    state = 0.94 * state + rng.normal(0, 0.28, N_CUSTOMERS)
    season = 1.0 + 0.10 * np.sin(2 * np.pi * month_idx / 12)
    risk_score = -1.75 + static_risk + 1.70 * state
    churn_prob = sigmoid(risk_score)
    y_month = (risk_score + rng.normal(0, 0.28, N_CUSTOMERS) > -0.10).astype(int)

    behavior_risk = sigmoid(-0.60 + 0.90 * static_risk + 1.55 * state)
    item_mu = base_items * season * np.exp(-1.25 * behavior_risk)
    item = rng.poisson(np.clip(item_mu, 0.05, None)).astype(float)

    severity = np.where(y_month == 1, rng.choice([0.0, 0.18, 0.38], N_CUSTOMERS, p=[0.14, 0.48, 0.38]), 1.0)
    item = np.round(item * severity).astype(int)
    revenue = item * revenue_per_item * rng.lognormal(0, 0.16, N_CUSTOMERS)

    complaint_rate = sigmoid(-4.0 + 1.10 * behavior_risk + 0.55 * quality_risk)
    complaint = rng.binomial(np.maximum(item, 1), complaint_rate)
    delay = rng.binomial(np.maximum(item, 1), np.clip(0.025 + 0.11 * behavior_risk, 0, 0.35))
    nodone = rng.binomial(np.maximum(item, 1), np.clip(0.012 + 0.15 * behavior_risk, 0, 0.40))
    order_score = np.clip(10.8 - 2.4 * behavior_risk + rng.normal(0, 0.45, N_CUSTOMERS), 0, 12)
    satisfaction = np.clip(8.3 - 3.1 * behavior_risk + rng.normal(0, 0.55, N_CUSTOMERS), 0, 10)

    yymm = month.strftime("%y%m")
    raw_parts.append(pd.DataFrame({
        "cms_code_enc": customer_ids,
        "report_month": int(yymm),
        "order_source_table": f"bccp_orderitem_{yymm}",
        "item": item,
        "revenue": revenue,
        "complaint": complaint,
        "delay": delay,
        "nodone": nodone,
        "order_score": order_score,
        "satisfaction": satisfaction,
        "service": dominant_service,
    }))
    label_parts.append(pd.DataFrame({
        "label_month": int(yymm),
        "label_table": f"Label.label_{yymm}",
        "cms_code_enc": customer_ids[y_month == 1],
    }))

raw_monthly = pd.concat(raw_parts, ignore_index=True)
label_keys = pd.concat(label_parts, ignore_index=True)

life = raw_monthly.groupby("cms_code_enc", as_index=False).agg(
    lifetime_total_items=("item", "sum"),
    lifetime_total_revenue=("revenue", "sum"),
    lifetime_total_complaint=("complaint", "sum"),
    lifetime_months_active=("item", lambda s: int((s > 0).sum())),
    lifetime_avg_order_score=("order_score", "mean"),
    lifetime_avg_satisfaction=("satisfaction", "mean"),
)
cus_lifetime = pd.DataFrame({
    "cms_code_enc": customer_ids,
    "tenure": tenure,
    "custype": custype,
    "cus_province": rng.integers(10, 98, N_CUSTOMERS),
    "most_common_region": region,
    "lifetime_service_types_count": service_types,
    "lifetime_dominant_service": dominant_service,
    "quality_risk_proxy": quality_risk,
}).merge(life, on="cms_code_enc", how="left")

monthly_label_rate = (
    label_keys.groupby("label_month").size()
    .div(N_CUSTOMERS).rename("churn_rate").reset_index()
)

STATIC_COLS = [
    "tenure", "custype", "cus_province", "most_common_region",
    "lifetime_service_types_count", "lifetime_dominant_service",
    "quality_risk_proxy", "lifetime_total_items", "lifetime_total_revenue",
    "lifetime_total_complaint", "lifetime_months_active",
    "lifetime_avg_order_score", "lifetime_avg_satisfaction",
]


def row_slope(matrix: np.ndarray) -> np.ndarray:
    x = np.arange(matrix.shape[1], dtype=float)
    xc = x - x.mean()
    return ((matrix - matrix.mean(axis=1, keepdims=True)) * xc).sum(axis=1) / (xc @ xc)


def build_feature_table(k: int, anchor_idx: int) -> pd.DataFrame:
    start_idx = anchor_idx - k + 1
    window_months = [int(m.strftime("%y%m")) for m in months[start_idx:anchor_idx + 1]]
    window = raw_monthly[raw_monthly["report_month"].isin(window_months)].copy()
    ids = pd.Index(customer_ids, name="cms_code_enc")

    matrices = {}
    for col in ["item", "revenue", "complaint", "delay", "nodone", "order_score", "satisfaction"]:
        matrices[col] = (
            window.pivot(index="cms_code_enc", columns="report_month", values=col)
            .reindex(index=ids, columns=window_months).to_numpy(float)
        )

    feat = pd.DataFrame(index=ids)
    for col, mat in matrices.items():
        for lag in range(k):
            suffix = "t" if lag == 0 else f"{lag}m_ago"
            feat[f"{col}_{suffix}"] = mat[:, k - 1 - lag]

    item_mat, rev_mat = matrices["item"], matrices["revenue"]
    for prefix, mat in [("item", item_mat), ("revenue", rev_mat), ("complaint", matrices["complaint"])]:
        feat[f"{prefix}_sum"] = mat.sum(axis=1)
        feat[f"{prefix}_avg"] = mat.mean(axis=1)
        feat[f"{prefix}_std"] = mat.std(axis=1)
        feat[f"{prefix}_median"] = np.median(mat, axis=1)

    feat["active_months"] = (item_mat > 0).sum(axis=1)
    feat["inactive_months"] = k - feat["active_months"]
    feat["item_slope"] = row_slope(item_mat)
    feat["revenue_slope"] = row_slope(rev_mat)
    feat["satisfy_slope"] = row_slope(matrices["satisfaction"])
    feat["complaint_slope"] = row_slope(matrices["complaint"])
    feat["cv_item"] = feat["item_std"] / feat["item_avg"].replace(0, np.nan)
    feat["cv_revenue"] = feat["revenue_std"] / feat["revenue_avg"].replace(0, np.nan)
    feat["pct_delay"] = matrices["delay"].sum(axis=1) / np.maximum(item_mat.sum(axis=1), 1)
    feat["pct_noaccepted"] = matrices["nodone"].sum(axis=1) / np.maximum(item_mat.sum(axis=1), 1)
    feat["satisfaction_avg"] = matrices["satisfaction"].mean(axis=1)
    feat["order_score_avg"] = matrices["order_score"].mean(axis=1)
    feat["frequency"] = item_mat.sum(axis=1) / np.maximum(feat["active_months"], 1)
    feat["monetary"] = rev_mat.sum(axis=1) / np.maximum(feat["active_months"], 1)

    active_mask = item_mat > 0
    last_active_pos = np.where(active_mask, np.arange(k), -1).max(axis=1)
    feat["recency"] = np.where(last_active_pos >= 0, k - 1 - last_active_pos, k)

    service_counts = window.groupby(["cms_code_enc", "service"]).size().unstack(fill_value=0).reindex(ids, fill_value=0)
    feat["service_types_used"] = (service_counts > 0).sum(axis=1)
    feat["dominant_service_ratio"] = service_counts.max(axis=1) / service_counts.sum(axis=1).clip(lower=1)

    feat = feat.reset_index().merge(cus_lifetime, on="cms_code_enc", how="left")
    feat["ratio_item_last__lifetime_total_items"] = feat["item_t"] / feat["lifetime_total_items"].replace(0, np.nan)
    feat["ratio_revenue_last__lifetime_total_revenue"] = feat["revenue_t"] / feat["lifetime_total_revenue"].replace(0, np.nan)
    feat["ratio_complaint_last__lifetime_total_complaint"] = feat["complaint_t"] / feat["lifetime_total_complaint"].replace(0, np.nan)

    start_yymm, end_yymm = window_months[0], window_months[-1]
    target_yymm = int(months[anchor_idx + HORIZON].strftime("%y%m"))
    churn_ids = set(label_keys.loc[label_keys["label_month"] == target_yymm, "cms_code_enc"])
    feat[LABEL_COL] = feat["cms_code_enc"].isin(churn_ids).astype(int)
    feat["window_size"] = k
    feat["window_start"] = start_yymm
    feat["window_end"] = end_yymm
    feat["source_table_t"] = f"cus_feature_{k}m_{start_yymm:04d}_{end_yymm:04d}"
    feat["source_table_t_plus_h"] = f"Label.label_{target_yymm:04d}"
    feat["is_churned_now"] = ((feat["item_t"] == 0) & (feat["revenue_t"] == 0)).astype(int)
    feat["is_active_now"] = 1 - feat["is_churned_now"]
    feat["gate_group"] = np.where(feat["is_active_now"].eq(1), "active_now", "churned_now")
    return feat


datasets = {}
build_summary = []
for k in K_CANDIDATES:
    frames = [
        build_feature_table(k, anchor_idx)
        for anchor_idx in range(k - 1, N_MONTHS - HORIZON)
    ]
    df_k = pd.concat(frames, ignore_index=True)
    datasets[k] = df_k
    active = df_k[df_k["is_active_now"].eq(1)]
    build_summary.append({
        "K": k,
        "rows_all": len(df_k),
        "rows_active": len(active),
        "snapshots": active["window_end"].nunique(),
        "churn_rate_active": active[LABEL_COL].mean(),
        "n_features": df_k.shape[1] - 10,
    })

META_COLS = {
    "cms_code_enc", "window_size", "window_start", "window_end",
    "source_table_t", "source_table_t_plus_h", "is_active_now",
    "is_churned_now", "gate_group", LABEL_COL,
}


def metric_row(y_true, prob, threshold):
    pred = (np.asarray(prob) >= threshold).astype(int)
    return {
        "threshold": float(threshold),
        "precision": precision_score(y_true, pred, zero_division=0),
        "recall": recall_score(y_true, pred, zero_division=0),
        "f1": f1_score(y_true, pred, zero_division=0),
        "ap": average_precision_score(y_true, prob),
        "roc_auc": roc_auc_score(y_true, prob),
        "balanced_accuracy": balanced_accuracy_score(y_true, pred),
        "predicted_positive_rate": pred.mean(),
    }


def best_f1_threshold(y_true, prob, floor=0.05):
    precision, recall, thresholds = precision_recall_curve(y_true, prob)
    f1 = 2 * precision[:-1] * recall[:-1] / np.maximum(precision[:-1] + recall[:-1], 1e-12)
    eligible = thresholds >= floor
    pred_pos = np.array([(prob >= t).sum() for t in thresholds])
    non_degenerate = (pred_pos > 0) & (pred_pos < len(y_true))
    valid = eligible & non_degenerate
    if not valid.any():
        valid = eligible
    idx = np.where(valid)[0][np.argmax(f1[valid])]
    return float(thresholds[idx])


def split_last_two_months(df):
    months_available = sorted(df["window_end"].unique())
    val_month, test_month = months_available[-2], months_available[-1]
    train = df[df["window_end"] < val_month].copy()
    val = df[df["window_end"] == val_month].copy()
    test = df[df["window_end"] == test_month].copy()
    return train, val, test, int(val_month), int(test_month)


def feature_columns(df, use_static):
    cols = [c for c in df.columns if c not in META_COLS]
    if not use_static:
        cols = [c for c in cols if c not in STATIC_COLS and not c.startswith("ratio_")]
    return cols


def make_lr_pipeline(df, cols, class_weight):
    num_cols = [c for c in cols if pd.api.types.is_numeric_dtype(df[c])]
    cat_cols = [c for c in cols if c not in num_cols]
    pre = ColumnTransformer([
        ("num", Pipeline([
            ("imp", SimpleImputer(strategy="median")),
            ("sc", StandardScaler(with_mean=False)),
        ]), num_cols),
        ("cat", Pipeline([
            ("imp", SimpleImputer(strategy="most_frequent")),
            ("oh", OneHotEncoder(handle_unknown="ignore")),
        ]), cat_cols),
    ], sparse_threshold=0.3)
    model = LogisticRegression(
        max_iter=2_500, solver="saga", tol=1e-3, C=0.1,
        l1_ratio=0.5, class_weight=class_weight, random_state=SEED,
    )
    return Pipeline([("pre", pre), ("clf", model)])


lr_rows = []
for k, df_all in datasets.items():
    df = df_all[df_all["is_active_now"].eq(1)].copy()
    train, val, test, val_month, test_month = split_last_two_months(df)
    for use_static in [False, True]:
        cols = feature_columns(df, use_static)
        y_train = train[LABEL_COL].astype(int)
        n_pos, n_neg = int(y_train.sum()), int((1 - y_train).sum())
        churn_ratio = y_train.mean()
        raw_spw = n_neg / max(n_pos, 1)
        spw = raw_spw if churn_ratio <= 0.35 else 1.0
        class_weight = {0: 1.0, 1: spw}

        pipe = make_lr_pipeline(train, cols, class_weight)
        pipe.fit(train[cols], y_train)
        val_prob = pipe.predict_proba(val[cols])[:, 1]
        threshold = best_f1_threshold(val[LABEL_COL].to_numpy(), val_prob)
        metrics = metric_row(val[LABEL_COL].to_numpy(), val_prob, threshold)
        prevalence = val[LABEL_COL].mean()
        dummy_f1 = 2 * prevalence / (1 + prevalence)
        degenerate = abs(metrics["f1"] - dummy_f1) < 0.005

        lr_rows.append({
            "K": k, "use_static": use_static, "val_month": val_month,
            "test_month": test_month, "train_rows": len(train),
            "spw_used": spw, "churn_ratio_train": churn_ratio,
            **metrics, "dummy_all_positive_f1": dummy_f1,
            "degenerate": degenerate,
        })

lr_results = (
    pd.DataFrame(lr_rows)
    .query("degenerate == False")
    .sort_values(["f1", "ap"], ascending=False)
    .reset_index(drop=True)
)
selected_lr = lr_results.iloc[0].to_dict()
print(f"Selected by LR: K={int(selected_lr['K'])}, use_static={bool(selected_lr['use_static'])}, f1={selected_lr['f1']:.4f}")

best_k = int(selected_lr["K"])
use_static = bool(selected_lr["use_static"])
df_main = datasets[best_k].query("is_active_now == 1").copy()
train, val, test, val_month, test_month = split_last_two_months(df_main)
main_cols = feature_columns(df_main, use_static)

num_cols = [c for c in main_cols if pd.api.types.is_numeric_dtype(train[c])]
cat_cols = [c for c in main_cols if c not in num_cols]
xgb_pre = ColumnTransformer([
    ("num", SimpleImputer(strategy="median"), num_cols),
    ("cat", Pipeline([
        ("imp", SimpleImputer(strategy="most_frequent")),
        ("oh", OneHotEncoder(handle_unknown="ignore", sparse_output=False)),
    ]), cat_cols),
], sparse_threshold=0.0)

X_train = xgb_pre.fit_transform(train[main_cols])
X_val = xgb_pre.transform(val[main_cols])
X_test = xgb_pre.transform(test[main_cols])
y_train = train[LABEL_COL].astype(int).to_numpy()
y_val = val[LABEL_COL].astype(int).to_numpy()
y_test = test[LABEL_COL].astype(int).to_numpy()

spw = float(selected_lr["spw_used"])
xgb_setup = {
    "K": best_k, "use_static": use_static, "features_after_encoding": int(X_train.shape[1]),
    "train_rows": len(train), "val_rows": len(val), "test_rows": len(test),
    "val_month": val_month, "test_month": test_month, "spw": round(spw, 3),
}
print(xgb_setup)

candidates = [
    {"name": "d3_balanced", "max_depth": 3, "learning_rate": 0.040, "min_child_weight": 3, "gamma": 0.0, "reg_alpha": 0.2, "reg_lambda": 2.0},
    {"name": "d4_balanced", "max_depth": 4, "learning_rate": 0.035, "min_child_weight": 4, "gamma": 0.0, "reg_alpha": 0.4, "reg_lambda": 2.5},
    {"name": "d5_flexible", "max_depth": 5, "learning_rate": 0.030, "min_child_weight": 3, "gamma": 0.0, "reg_alpha": 0.3, "reg_lambda": 2.0},
    {"name": "d6_regularized", "max_depth": 6, "learning_rate": 0.025, "min_child_weight": 6, "gamma": 0.1, "reg_alpha": 0.8, "reg_lambda": 3.0},
    {"name": "d4_low_reg", "max_depth": 4, "learning_rate": 0.050, "min_child_weight": 2, "gamma": 0.0, "reg_alpha": 0.0, "reg_lambda": 1.0},
]

tuning_rows, fitted_models = [], {}
for cfg in candidates:
    model = xgb.XGBClassifier(
        n_estimators=1_500,
        max_depth=cfg["max_depth"],
        learning_rate=cfg["learning_rate"],
        min_child_weight=cfg["min_child_weight"],
        gamma=cfg["gamma"],
        reg_alpha=cfg["reg_alpha"],
        reg_lambda=cfg["reg_lambda"],
        subsample=0.85,
        colsample_bytree=0.85,
        tree_method="hist",
        eval_metric="aucpr",
        early_stopping_rounds=80,
        scale_pos_weight=spw,
        random_state=SEED,
        n_jobs=4,
    )
    model.fit(X_train, y_train, eval_set=[(X_val, y_val)], verbose=False)
    val_prob = model.predict_proba(X_val)[:, 1]
    threshold = best_f1_threshold(y_val, val_prob)
    metrics = metric_row(y_val, val_prob, threshold)
    tuning_rows.append({
        **cfg, **metrics,
        "best_iteration": int(model.best_iteration),
        "score_range": float(val_prob.max() - val_prob.min()),
    })
    fitted_models[cfg["name"]] = model

tuning_results = (
    pd.DataFrame(tuning_rows)
    .sort_values(["f1", "ap"], ascending=False)
    .reset_index(drop=True)
)
best_cfg = tuning_results.iloc[0].to_dict()
best_model = fitted_models[best_cfg["name"]]
print(f"Best XGB: {best_cfg['name']} f1={best_cfg['f1']:.4f}")

val_prob = best_model.predict_proba(X_val)[:, 1]
test_prob = best_model.predict_proba(X_test)[:, 1]
chosen_threshold = float(best_cfg["threshold"])

val_metrics = metric_row(y_val, val_prob, chosen_threshold)
test_metrics = metric_row(y_test, test_prob, chosen_threshold)
test_default = metric_row(y_test, test_prob, 0.50)

test_pred = (test_prob >= chosen_threshold).astype(int)
tn, fp, fn, tp = confusion_matrix(y_test, test_pred).ravel()
print(f"Holdout confusion: tn={tn} fp={fp} fn={fn} tp={tp}")

risk_list = test[["cms_code_enc", "window_end", LABEL_COL]].copy()
risk_list["churn_probability"] = test_prob
risk_list["predicted_churn"] = test_pred
risk_list["priority_rank"] = risk_list["churn_probability"].rank(method="first", ascending=False).astype(int)
risk_list = risk_list.sort_values("churn_probability", ascending=False)

top_n = max(1, int(np.ceil(0.10 * len(risk_list))))
top10 = risk_list.head(top_n)
precision_at_10 = top10[LABEL_COL].mean()
recall_at_10 = top10[LABEL_COL].sum() / max(risk_list[LABEL_COL].sum(), 1)
print(f"Top 10% | precision={precision_at_10:.3f} | recall={recall_at_10:.3f} | customers={top_n:,}")

feature_names = xgb_pre.get_feature_names_out()
importance_all = (
    pd.DataFrame({"feature": feature_names, "importance": best_model.feature_importances_})
    .sort_values("importance", ascending=False)
)
importance_top = importance_all.head(15).copy()
importance_top["feature"] = (
    importance_top["feature"].str.replace("num__", "", regex=False).str.replace("cat__", "", regex=False)
)

val_default = metric_row(y_val, val_prob, 0.50)
guardrails = [
    {"name": "non_degenerate_prediction", "detail": "0 < predicted churn < holdout size",
     "passed": bool(0 < test_pred.sum() < len(test_pred))},
    {"name": "ap_beats_prevalence", "detail": f"AP {test_metrics['ap']:.3f} > prevalence {y_test.mean():.3f}",
     "passed": bool(test_metrics["ap"] > y_test.mean())},
    {"name": "ranking_beats_random", "detail": f"ROC-AUC {test_metrics['roc_auc']:.3f} > 0.50",
     "passed": bool(test_metrics["roc_auc"] > 0.50)},
    {"name": "score_range_wide_enough", "detail": f"score range {np.ptp(test_prob):.3f} >= 0.05",
     "passed": bool(np.ptp(test_prob) >= 0.05)},
    {"name": "tuned_threshold_helps_validation", "detail": f"val F1 {val_metrics['f1']:.3f} >= default {val_default['f1']:.3f}",
     "passed": bool(val_metrics["f1"] + 1e-12 >= val_default["f1"])},
]
assert all(g["passed"] for g in guardrails), "notebook guardrails failed on re-run"

# ---------------------------------------------------------------------------
# Verification against the numbers printed in the notebook
# ---------------------------------------------------------------------------
checks = []


def check(name, actual, expected, tol=5e-4):
    ok = abs(actual - expected) <= tol
    checks.append((name, actual, expected, ok))
    return ok


bs = pd.DataFrame(build_summary).set_index("K")
check("rows_active_k13", bs.loc[13, "rows_active"], 10712, 0)
check("lr_top_f1", lr_results.iloc[0]["f1"], 0.7145)
check("lr_top_ap", lr_results.iloc[0]["ap"], 0.7633)
check("xgb_best_val_f1", best_cfg["f1"], 0.7372)
check("holdout_f1", test_metrics["f1"], 0.7141)
check("holdout_ap", test_metrics["ap"], 0.7686)
check("holdout_roc", test_metrics["roc_auc"], 0.9130)
check("confusion_tn", tn, 915, 0)
check("confusion_fp", fp, 121, 0)
check("confusion_fn", fn, 68, 0)
check("confusion_tp", tp, 236, 0)
check("top10_precision", precision_at_10, 0.873)
check("top10_recall", recall_at_10, 0.385)
check("churn_rate_2610", monthly_label_rate.set_index("label_month").loc[2610, "churn_rate"], 0.2521)
all_ok = all(c[3] for c in checks)
for name, actual, expected, ok in checks:
    print(f"{'PASS' if ok else 'FAIL'} {name}: got {actual:.4f} expected {expected:.4f}")
print("VERIFICATION:", "ALL MATCH" if all_ok else "MISMATCH — do not use for showcase without review")

# ---------------------------------------------------------------------------
# Export artifacts
# ---------------------------------------------------------------------------


def downsample_curve(xs, ys, n=140):
    idx = np.unique(np.linspace(0, len(xs) - 1, n).astype(int))
    return [{"x": round(float(xs[i]), 4), "y": round(float(ys[i]), 4)} for i in idx]


p_curve, r_curve, _ = precision_recall_curve(y_test, test_prob)
fpr, tpr, _ = roc_curve(y_test, test_prob)

threshold_sweep = []
for t in np.round(np.arange(0.02, 0.99, 0.02), 2):
    pred_t = (test_prob >= t).astype(int)
    tn_t, fp_t, fn_t, tp_t = confusion_matrix(y_test, pred_t, labels=[0, 1]).ravel()
    threshold_sweep.append({
        "threshold": float(t),
        "tp": int(tp_t), "fp": int(fp_t), "fn": int(fn_t), "tn": int(tn_t),
        "flagged": int(pred_t.sum()),
        "precision": round(float(precision_score(y_test, pred_t, zero_division=0)), 4),
        "recall": round(float(recall_score(y_test, pred_t, zero_division=0)), 4),
        "f1": round(float(f1_score(y_test, pred_t, zero_division=0)), 4),
    })

bins = np.linspace(0, 1, 21)
hist_counts, _ = np.histogram(test_prob, bins=bins)
hist_churn, _ = np.histogram(test_prob[y_test == 1], bins=bins)
score_histogram = [
    {"lo": round(float(bins[i]), 2), "hi": round(float(bins[i + 1]), 2),
     "count": int(hist_counts[i]), "churn": int(hist_churn[i])}
    for i in range(20)
]

# Customer time series: top-6 ranked, 2 borderline around the F1 threshold, 2 low-risk.
sorted_risk = risk_list.reset_index(drop=True)
above = sorted_risk[sorted_risk["churn_probability"] >= chosen_threshold]
below = sorted_risk[sorted_risk["churn_probability"] < chosen_threshold]
picks = pd.concat([
    sorted_risk.head(6),
    above.tail(1), below.head(1),
    below[(below["churn_probability"] > 0.02) & (below["churn_probability"] < 0.10)].head(2),
]).drop_duplicates("cms_code_enc")

series_cols = ["item", "revenue", "complaint", "delay", "nodone", "order_score", "satisfaction"]
customer_timeseries = []
for _, row in picks.iterrows():
    cid = row["cms_code_enc"]
    hist = raw_monthly[raw_monthly["cms_code_enc"] == cid].sort_values("report_month")
    static = cus_lifetime[cus_lifetime["cms_code_enc"] == cid].iloc[0]
    customer_timeseries.append({
        "cms_code_enc": cid,
        "priority_rank": int(row["priority_rank"]),
        "churn_probability": round(float(row["churn_probability"]), 4),
        "predicted_churn": int(row["predicted_churn"]),
        "y_true": int(row[LABEL_COL]),
        "window_end": int(row["window_end"]),
        "tenure_months": int(static["tenure"]),
        "region": str(static["most_common_region"]),
        "dominant_service": str(static["lifetime_dominant_service"]),
        "service_types_count": int(static["lifetime_service_types_count"]),
        "months": [int(m) for m in hist["report_month"]],
        "series": {
            col: [round(float(v), 1) for v in hist[col]]
            for col in series_cols
        },
    })

artifacts = {
    "meta": {
        "source_notebook": "VNPost_Churn_Prediction_Final_Demo.ipynb",
        "seed": SEED,
        "n_customers": N_CUSTOMERS,
        "n_months": N_MONTHS,
        "horizon": HORIZON,
        "label_col": LABEL_COL,
        "k_candidates": K_CANDIDATES,
        "val_month": val_month,
        "test_month": test_month,
        "raw_rows": len(raw_monthly),
        "label_rows": len(label_keys),
        "verification_all_match": bool(all_ok),
        "library_versions": {
            "numpy": np.__version__, "pandas": pd.__version__,
            "xgboost": xgb.__version__,
        },
    },
    "production_reference": PRODUCTION_REFERENCE,
    "monthly_churn_rate": [
        {"month": int(r["label_month"]), "rate": round(float(r["churn_rate"]), 4)}
        for _, r in monthly_label_rate.iterrows()
    ],
    "build_summary": [
        {**row, "churn_rate_active": round(float(row["churn_rate_active"]), 4)}
        for row in build_summary
    ],
    "lr_results": [
        {
            "K": int(r["K"]), "use_static": bool(r["use_static"]),
            "f1": round(float(r["f1"]), 4), "precision": round(float(r["precision"]), 4),
            "recall": round(float(r["recall"]), 4), "ap": round(float(r["ap"]), 4),
            "roc_auc": round(float(r["roc_auc"]), 4), "threshold": round(float(r["threshold"]), 4),
            "train_rows": int(r["train_rows"]), "spw_used": round(float(r["spw_used"]), 4),
        }
        for _, r in lr_results.iterrows()
    ],
    "selected_lr": {"K": best_k, "use_static": use_static},
    "xgb_setup": xgb_setup,
    "tuning_results": [
        {
            "name": str(r["name"]), "f1": round(float(r["f1"]), 4),
            "precision": round(float(r["precision"]), 4), "recall": round(float(r["recall"]), 4),
            "ap": round(float(r["ap"]), 4), "roc_auc": round(float(r["roc_auc"]), 4),
            "threshold": round(float(r["threshold"]), 4), "best_iteration": int(r["best_iteration"]),
            "max_depth": int(r["max_depth"]), "learning_rate": float(r["learning_rate"]),
            "min_child_weight": int(r["min_child_weight"]),
        }
        for _, r in tuning_results.iterrows()
    ],
    "chosen_threshold": round(chosen_threshold, 4),
    "metric_comparison": [
        {"split": name, **{k2: round(float(v), 4) for k2, v in m.items()}}
        for name, m in [
            ("validation_tuned", val_metrics),
            ("holdout_fixed_threshold", test_metrics),
            ("holdout_threshold_0.50", test_default),
        ]
    ],
    "confusion": {"tn": int(tn), "fp": int(fp), "fn": int(fn), "tp": int(tp)},
    "holdout_prevalence": round(float(y_test.mean()), 4),
    "holdout_positives": int(y_test.sum()),
    "pr_curve": downsample_curve(r_curve, p_curve),
    "roc_curve": downsample_curve(fpr, tpr),
    "threshold_sweep": threshold_sweep,
    "score_histogram": score_histogram,
    "score_quantiles": {
        "p50": round(float(np.quantile(test_prob, 0.50)), 4),
        "p90": round(float(np.quantile(test_prob, 0.90)), 4),
        "p99": round(float(np.quantile(test_prob, 0.99)), 4),
    },
    "risk_list_top": [
        {
            "cms_code_enc": str(r["cms_code_enc"]), "window_end": int(r["window_end"]),
            "y_true": int(r[LABEL_COL]), "churn_probability": round(float(r["churn_probability"]), 4),
            "predicted_churn": int(r["predicted_churn"]), "priority_rank": int(r["priority_rank"]),
        }
        for _, r in risk_list.head(15).iterrows()
    ],
    "top10pct": {
        "precision": round(float(precision_at_10), 4),
        "recall": round(float(recall_at_10), 4),
        "customers": int(top_n),
    },
    "feature_importance": [
        {"feature": str(r["feature"]), "importance": round(float(r["importance"]), 5)}
        for _, r in importance_top.iterrows()
    ],
    "guardrails": guardrails,
    "customer_timeseries": customer_timeseries,
}

out_path = sys.argv[1] if len(sys.argv) > 1 else "notebook_artifacts.json"
with open(out_path, "w", encoding="utf-8") as f:
    json.dump(artifacts, f, ensure_ascii=False, indent=1)
print(f"Wrote {out_path}")

if len(sys.argv) > 2:
    csv_dir = sys.argv[2]
    export_cols = ["cms_code_enc", "window_end", LABEL_COL, "churn_probability", "predicted_churn", "priority_rank"]
    full_risk = risk_list[export_cols].copy()
    full_risk["churn_probability"] = full_risk["churn_probability"].round(4)
    full_risk.to_csv(f"{csv_dir}/notebook_risk_list.csv", index=False)

    rep_ids = [c["cms_code_enc"] for c in customer_timeseries]
    rep_monthly = raw_monthly[raw_monthly["cms_code_enc"].isin(rep_ids)].copy()
    rep_monthly["revenue"] = rep_monthly["revenue"].round(0).astype(int)
    rep_monthly[["order_score", "satisfaction"]] = rep_monthly[["order_score", "satisfaction"]].round(2)
    rep_monthly = rep_monthly.drop(columns=["order_source_table"]).sort_values(["cms_code_enc", "report_month"])
    rep_monthly.to_csv(f"{csv_dir}/notebook_monthly_behavior.csv", index=False)
    print(f"Wrote CSVs to {csv_dir}: risk list {len(full_risk):,} rows, monthly behavior {len(rep_monthly):,} rows")
