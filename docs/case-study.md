# Case study: Explainable Customer Churn Prioritization

## 1. Business decision

The project supports a retention team that cannot contact every customer. The model therefore has two linked jobs:

1. estimate the probability that a customer will churn within the next two months;
2. convert those estimates into a ranked, explainable queue that fits operational capacity.

The production workflow supports two policies. Probability mode includes customers whose model score clears an approved threshold. Capacity mode selects the top-N customers, with approximately 7,000 intervention slots in a typical run.

## 2. Data model

Raw tables provide order, customer and service behavior. `bccp_orderitem_YYMM` is partitioned by month; `cas_customer`, `cas_info` and `cms_complaint` are refreshed snapshots. Churn labels arrive as monthly lists (`Label.label_YYMM`) joined during training and backtesting.

The modeling layer converts them into sliding-window feature tables named `cus_feature_{K}m_YYMM_YYMM`: monthly lags, volume/revenue/complaint aggregates, activity and recency, slopes, volatility, delivery-quality rates, service mix, RFM and lifetime ratios. Feature generation was a collaboration with data engineering; the data scientist's ownership begins with feature use, validation and downstream modeling.

## 3. Label and leakage control

Observation windows end at the scoring origin `t`; the label lives at `t + 2`. An active-now gate keeps only customers still shipping at month `t`, so the model learns "active today, gone in two months" rather than re-detecting customers who already left.

Evaluation splits by time: earlier snapshot months train, the second-to-last month validates, and the final month remains an untouched holdout during window selection, tuning and threshold choice. The production system extends this with purged walk-forward folds.

## 4. Feature management

A feature table's name is its version: a window table encodes its own window length and start/end month; a lifetime snapshot encodes its own month, so there is no separate version number that can drift out of sync with what a table actually contains.

Training and scoring build features through the same code path — gating, outlier handling and time-based feature construction run through shared functions, and the exact column list, categorical encoding and date handling used at training time are saved with the model bundle and reloaded unchanged at scoring time. Training–serving drift is closed by construction, not by convention. Missing values are resolved at the source (zero-filled aggregates where zero is the honest value, an explicit "missing" label for categorical gaps) rather than left as ambiguous nulls, and outliers are clipped to a percentile bound instead of dropping the row. Feature tables are recomputed incrementally, and every accepted model bundle carries its own lineage: the feature list it was trained on, a snapshot of the feature distribution at that time, and its own validation report.

At this batch cadence — monthly and weekly jobs, no request needing a feature value in milliseconds — a template-driven pipeline with disciplined naming, one shared training/serving code path and per-bundle lineage already delivers what a feature store exists to guarantee. A feature store earns its operational cost only once a real-time scoring path exists; until then, a well-governed pipeline is the right-sized answer. The one acknowledged gap is extending drift monitoring to categorical features — today they are profiled, but only numeric features carry a PSI score (Section 7).

## 5. Model development

- Logistic Regression is the referee, not the final model: an elastic-net LR sweep across `K ∈ {3, 6, 9, 13}` × static-feature options selects the sliding-window configuration.
- XGBoost is the main model, trained on the selected dataset with histogram trees, early stopping on AP and the class weight inherited from the LR guardrail.
- Selection uses validation F1 with AP as tie-breaker; degenerate predict-all-positive solutions are rejected.
- The decision threshold is locked on validation before the holdout is ever scored.

## 6. The public notebook demo

Because production data cannot be published, a public notebook (`VNPost_Churn_Prediction_Final_Demo.ipynb`) generates a 1,400-customer × 22-month synthetic cohort that mirrors the production schema and runs the full pipeline deterministically (seed 42). The showcase re-runs it via `data/export_notebook_artifacts.py`, verifies the outputs against the notebook's printed results, and renders only exported artifacts.

Key synthetic-run results (never presented as production performance):

- LR sweep selects `K = 13` with static features (validation F1 0.7145).
- XGBoost tuning winner `d6_regularized` (validation F1 0.7372).
- Synthetic holdout at the locked threshold 0.437: F1 0.714, precision 0.661, recall 0.776, AP 0.769, ROC-AUC 0.913.
- Confusion matrix 915 / 121 / 68 / 236 on 1,340 active customers; top-10% of the queue reaches 87.3% precision.
- Five guardrail asserts (non-degenerate prediction, AP above prevalence, sane ranking, score spread, threshold usefulness) must pass before the run completes.

## 7. Balancing risk and value

Ranking a queue by churn probability alone creates a bad incentive: a small account at 90% risk would outrank a strategic account at 40% risk whose loss matters far more, while contact capacity is always limited. Expected Value of Retention gives the queue a second axis:

```
Expected Value of Retention = P(churn) × Customer Value × P(saved | contacted) − Cost of the action
```

A lighter Retention Priority Score blends the same four ingredients — normalized churn probability, customer value, urgency and action cost — into a single rank for day-to-day triage. Customer value is scored the same way churn risk is: a recency–frequency–monetary read of the account, weighted with a voice-of-customer signal from complaint history.

Four combinations follow directly from the two axes: high churn/high value gets a direct, urgent contact from the account owner; high churn/low value gets low-cost, capped-effort outreach; low churn/high value gets proactive relationship care rather than retention; low churn/low value is monitored, not actively worked.

## 8. Explainability and export

The notebook demo exports a six-column risk list — customer, scoring origin, label, probability, decision, priority rank — and demonstrates global explainability with XGBoost gain importance.

The production layer extends this: model attribution ranks which of eight operational reason buckets to surface per customer, and each is always rendered with a deterministic comparison — the observed metric, its three-month baseline, delta and severity — so a reason never depends on the attribution step succeeding:

- current shipment volume below the previous three-month average;
- complaints above the previous three-month average;
- late-delivery rate above the previous three-month average;
- non-completed delivery rate above the previous three-month average;
- high shipment-volume variation measured by coefficient of variation;
- declining average order value;
- reduced service diversity;
- low tenure for a new customer.

The decision lab's dossier computes the same business-rule evidence live from each customer's real 22-month synthetic series.

A risk score is only a CRM-ready output once it is organized around the questions a retention team actually asks: who the customer is and who owns the relationship, what the model predicts, why the score is high, where the customer ranks once value and urgency are weighed, what to do next and with whom, and what happened after the queue was worked. Each reason bucket routes to a specific owner with its own priority and clock — delivery-quality reasons go to operations within 48 hours, complaints go to customer service within 24 hours, behavioral decline goes to the account owner within 5–7 business days, and an issue tied to a single depot, route or service point is handled as an incident rather than a per-customer case (Section 10).

## 9. Production, promotion, monitoring and overlay

The workflow integrates with PostgreSQL, Airflow and Docker. Model promotion and post-scoring monitoring are deliberately separated.

A candidate variant is rejected when all walk-forward folds fail, the latest fold is invalid, the rejected-fold rate exceeds 25%, or the final temporal holdout is unavailable or fails its configured minimum checks. Monthly promotion then considers label prevalence (above 45% blocks retraining when a prior bundle exists), data completeness (rows ≥80%, active ≥50%, items ≥70%, revenue ≥70% versus the previous month) and current-period F1 versus the accepted bundle. If promotion is rejected, the previous accepted model is retained and scoring continues.

After scoring, the monitoring layer stores active count, risk count, risk ratio and score quantiles P50/P90/P99 by scoring origin; a high risk ratio is flagged against historical median plus three MAD. Feature drift uses PSI (`OK` ≤ 0.10, `WARN` > 0.10, `ALERT` > 0.20) and discrete KS.

Monthly scoring is kept separate from retraining so it can run — or be adjusted — without ever touching the model. That separation is where an operational overlay belongs: a thin rule layer sitting after scoring that reads a live event (a delayed depot, a payment outage, a service disruption in one area), finds the customers active in that place and window, and raises their priority without ever changing the model's own probability. Every overlay carries a validity window and applies only to the customers actually affected, so it lapses automatically and never inflates the whole queue; its reason is logged separately from the model's own run log, so an audit can tell a model problem from an operational one at a glance. The output distinguishes `model_churn_probability` and `model_risk_level` (untouched by any overlay) from `overlay_flag`, `overlay_reason`, `overlay_severity`, `final_priority`, `recommended_action` and `action_deadline`.

## 10. Review and approval before production

Passing the model-performance gates above is necessary but not sufficient for a proof of concept to become something a business runs on. A release also has to prove data quality, feature alignment between training and scoring, threshold and segment stability, a correct output contract, a working CRM integration, and a full cycle of business review with no blocking feedback — with a confirmed path back to the previous accepted bundle if any of it needs to be reversed.

## 11. Feedback loop

Exporting a risk file is the start of a loop, not the end of the workflow: prediction routes to a business action, the action produces an actual outcome, the outcome is evaluated against the original prediction, and that evaluation feeds model improvement — which feeds the next prediction. Outcome data evaluates the policy; it does not relabel training data directly, which would let the act of contacting a customer quietly bias the model that decided to contact them.

Five KPIs keep the loop honest: contact coverage (customers contacted ÷ customers flagged), action completion rate (cases closed within SLA ÷ cases opened), realized precision (confirmed at-risk ÷ total contacted), retention lift (churn rate of contacted customers versus a comparable, uncontacted group) and feedback completeness (rows with a recorded outcome ÷ rows exported).

Retraining is already designed to respond to more than the calendar — a retrain is due early the moment feature drift crosses into alert territory, alongside the fixed quarterly cycle. The same principle extends to the loop: the operating threshold should be reviewed when realized precision, measured from actual outcomes, drifts down for several months in a row, and a reason bucket should be revisited when it consistently produces actions that don't change the outcome.

## 12. Ownership

**Owned:** problem framing, label design, modeling, temporal validation, threshold strategy, explainability, output contract, the operating design (feature management, risk/value framework, overlay mechanism, review process and feedback loop), monitoring logic, production integration and the public notebook demo.

**Collaborated:** feature definitions and generation with data engineering.

## 13. Roadmap and evidence required for the final portfolio update

Before publishing production model or business claims, add only approved, reproducible evidence:

- approved production holdout period and sample size;
- production ROC-AUC, PR-AUC and ranking metrics appropriate to class balance;
- precision/recall or capture at the actual intervention capacity;
- threshold and calibration evidence;
- realized intervention volume;
- a clearly defined business measurement window and comparison group;
- contacted customers, retained customers and attributable revenue, if approved.

Beyond evidence, a production-grade system adds: champion–challenger evaluation before a candidate ever sets a customer's priority; A/B or uplift measurement to isolate the action's true effect from the score; bias monitoring by region and segment; role-based access control separate from the underlying customer tables; a decision audit log; a response SLA alongside the existing data-freshness SLA; a cost/ROI framing measured against Expected Value of Retention; model performance and business performance reported as two separate numbers, never blended; and an explicit rollback command to the last accepted bundle. Human-in-the-loop is already a standing property of the design — no export field ever contacts a customer directly.

Until the evidence above exists, the site labels production performance and business impact as pending, while the synthetic notebook run remains fully reproducible evidence of the method.
