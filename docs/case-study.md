# Case study: Explainable Customer Churn Prioritization

## 1. Business decision

The project supports a retention team that cannot contact every customer. The model therefore has two linked jobs:

1. estimate the probability that a customer will churn within the next two months;
2. convert those estimates into a ranked, explainable queue that fits operational capacity.

The production workflow supports two policies. Probability mode includes customers whose model score clears an approved threshold. Capacity mode selects the top-N customers, with approximately 7,000 intervention slots in a typical run.

## 2. Data model

Four raw tables provide order, customer and service behavior. `bccp_orderitem_YYMM` is partitioned by month; `cas_customer`, `cas_info` and `cms_complaint` are refreshed snapshots. Monthly label tables are joined separately during training and backtesting.

More than 200 customer-level signals describe lifetime behavior, recent temporal windows, order frequency, item and revenue trends, delays, non-completed deliveries, complaints, order quality and satisfaction. Feature generation was a collaboration with data engineering; the data scientist's ownership begins with feature use, validation and downstream modeling rather than claiming sole ownership of the feature pipeline.

## 3. Label and leakage control

The label combines business-confirmed outcomes with a rule-based fallback when the confirmed outcome is unavailable. Observation windows end before the two-month prediction period begins.

Evaluation uses purged walk-forward folds. Each fold trains on past periods, removes observations whose windows could overlap the validation horizon, and validates on a later period. A final chronological holdout remains untouched during model and hyperparameter selection.

## 4. Model development

- Establish Logistic Regression as an interpretable baseline.
- Develop an XGBoost classifier for non-linear interactions and mixed temporal behavior.
- Explore a broad search space using random search.
- Refine promising regions with Optuna's TPE sampler.
- Select the final configuration using walk-forward evidence, then evaluate once on the final holdout.

Model performance is not reported in this public edition because a validated production artifact is not currently available. The website uses an explicit `Pending update` state rather than fabricated results.

## 5. Explainability and export

The operational export is designed for both machines and retention users. It contains customer and prediction-period identifiers, recent behavioral aggregates, churn probability, and the three strongest reasons per customer. Each reason can carry a business label, metric, baseline, delta, percentage delta and severity.

SHAP contributions provide model-level evidence. Positive contributions are mapped to eight operational reason buckets, then rendered using the customer's observed metric and its baseline:

- current shipment volume below the previous three-month average;
- complaints above the previous three-month average;
- late-delivery rate above the previous three-month average;
- non-completed delivery rate above the previous three-month average;
- high shipment-volume variation measured by coefficient of variation;
- declining average order value;
- reduced service diversity;
- low tenure for a new customer.

The public decision lab mirrors this contract: each synthetic reason includes the production reason code, current metric, three-month baseline and percentage change. This is more faithful than a generic natural-language summary and lets a retention user verify the evidence behind the ranked reason.

## 6. Production, promotion and monitoring

The workflow integrates with PostgreSQL, Airflow and Docker. Model promotion and post-scoring monitoring are deliberately separated.

A candidate variant is rejected when all walk-forward folds fail, the latest fold is invalid, the rejected-fold rate exceeds 25%, or the final temporal holdout is unavailable or fails its configured minimum checks. Monthly promotion then considers label prevalence, data completeness and current-period F1. With a previous bundle available, prevalence above 45% blocks retraining. For normal monthly runs, the current month must retain at least 80% of rows, 50% of active customers, 70% of items and 70% of revenue versus the previous month. The candidate F1 must beat the accepted bundle re-evaluated on the current period, plus the configured epsilon.

If promotion is rejected, the previous accepted model is retained and scoring can continue with the known bundle. First-run and mandatory-cycle behavior are recorded as explicit exceptions rather than hidden inside a generic quality checklist.

After scoring, the monitoring layer stores active count, risk count, risk ratio and score quantiles P50/P90/P99 by scoring origin. A high risk ratio can be flagged against historical median plus three median absolute deviations. Feature drift compares the scoring population with the training profile using PSI and discrete KS. PSI is `OK` up to 0.10, `WARN` above 0.10 and `ALERT` above 0.20.

## 7. Action boundary

The implemented system output is the risk profile and structured reasons. The retention decision remains human-controlled: operations or the account owner reviews service and commercial context before contact.

The portfolio demo adds a proposed CRM feedback contract—owner, action status, contact timestamp, outcome and retention after the prediction horizon—to show how intervention effectiveness could later be measured. Those fields are presented as an integration layer, not as functionality already proven in the current Python export.

## 8. Ownership

**Owned:** problem framing, label design, modeling, temporal validation, hyperparameter optimization, operating-policy design, explainability, output contract, monitoring logic and production integration.

**Collaborated:** feature definitions and generation with data engineering.

## 9. Evidence required for the final portfolio update

Before publishing model or business claims, add only approved, reproducible evidence:

- final holdout period and sample size;
- ROC-AUC, PR-AUC and ranking metrics appropriate to class balance;
- precision/recall or capture at the actual intervention capacity;
- threshold and calibration evidence;
- realized intervention volume;
- a clearly defined business measurement window and comparison group;
- contacted customers, retained customers and attributable revenue, if approved.

Until those artifacts exist, the site intentionally labels both performance and business impact as pending.
