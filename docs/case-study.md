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

A lighter Retention Priority Score supports day-to-day triage when a full value model is unavailable:

```
RPS = 0.40 × normalized risk + 0.30 × customer value + 0.20 × urgency + 0.10 × save propensity − action-cost penalty
```

The operational queue removes negative-value actions, ranks the remainder by EVR and takes the highest-value cases that fit owner capacity and SLA. For example, an account at 86% churn risk with ₫8M value, 25% save propensity and ₫0.12M action cost has EVR ₫1.60M; a strategic account at only 42% risk but ₫95M value, 35% save propensity and ₫0.45M action cost has EVR ₫13.52M and is therefore reviewed first.

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

A risk score becomes CRM-ready through a typed, idempotent contract. `case_id` prevents duplicate upserts; `model_version` and `model_churn_probability` preserve the original decision; structured reason evidence, `priority_score`, `recommended_action`, `action_owner` and `action_deadline` drive the handoff; `action_status`, `outcome`, `outcome_detail` and `retained_after_horizon` close the loop. Each reason bucket routes to a specific owner with its own priority, clock and result code — delivery-quality reasons go to operations within 48 hours, complaints go to customer service within 24 hours, behavioral decline goes to the account owner within 5–7 business days, and an issue tied to a single depot, route or service point is handled as an incident rather than a per-customer case (Section 9).

## 9. Production, promotion, monitoring and overlay

The workflow integrates with PostgreSQL, Airflow and Docker. Model promotion and post-scoring monitoring are deliberately separated.

A candidate variant is rejected when all walk-forward folds fail, the latest fold is invalid, the rejected-fold rate exceeds 25%, or the final temporal holdout is unavailable or fails its configured minimum checks. Monthly promotion then considers label prevalence (above 45% blocks retraining when a prior bundle exists), data completeness (rows ≥80%, active ≥50%, items ≥70%, revenue ≥70% versus the previous month) and current-period F1 versus the accepted bundle. If promotion is rejected, the previous accepted model is retained and scoring continues.

After scoring, the monitoring layer stores active count, risk count, risk ratio and score quantiles P50/P90/P99 by scoring origin; a high risk ratio is flagged against historical median plus three MAD. Feature drift uses PSI (`OK` ≤ 0.10, `WARN` > 0.10, `ALERT` > 0.20) and discrete KS.

Monthly scoring is kept separate from retraining so it can run — or be adjusted — without ever touching the model. The operational overlay is a post-score rule layer that reads a live event (a delayed depot, a payment outage, a service disruption in one area), finds the customers active in that place and window, and raises their priority without ever changing the model's own probability. Matching uses place, service and validity window; the highest severity controls the deadline, priority may move at most two tiers, `event_id + case_id` is idempotent, and an operations owner can disable the rules without disabling scoring. Every overlay expires automatically and its reason is logged separately from the model run. The output distinguishes `model_churn_probability` and `model_risk_level` from `overlay_flag`, `overlay_reason`, `overlay_severity`, `final_priority`, `recommended_action` and `action_deadline`.

## 10. Review and approval before production

Passing the model-performance gates above is necessary but not sufficient. The operating release blocks when data continuity falls below the configured floors, feature alignment differs from the saved bundle, rejected walk-forward folds exceed 25%, the final holdout is unavailable, required export fields are missing, duplicate `case_id` values exist, CRM upsert is not idempotent or business UAT records a severity-1 defect. Data Science and Business owners sign the release; the previous accepted bundle remains the rollback target.

## 11. Feedback loop

Exporting a risk file is the start of a loop, not the end of the workflow: prediction routes to a business action, the action produces an actual outcome, the outcome is evaluated against the original prediction, and that evaluation feeds model improvement — which feeds the next prediction. Outcome data evaluates the policy; it does not relabel training data directly, which would let the act of contacting a customer quietly bias the model that decided to contact them.

Six KPIs keep the loop honest: contact coverage, action completion rate, capture at capacity on labeled outcomes, retention lift (`control churn − action-group churn`), feedback completeness and net retention value (`protected margin − action cost`). Model quality and action effectiveness remain separate measurements because contact can change the outcome the model predicted.

One record moves through the full cycle: a 78%-risk customer with complaint escalation is routed to Customer Service within 24 hours; the complaint is closed, the account owner contacts the customer, and `retained_after_horizon` is recorded at `t + 2`. The result updates reason-level save propensity for the next EVR rank without directly relabeling the training row. Retraining also responds to numeric-feature PSI alerts alongside the quarterly cycle; threshold and reason-action rules are reviewed when capture or measured lift deteriorates across consecutive cycles.

The showcase reports a transparent planning scenario per scoring cycle instead of an unaudited production claim: 7,000 available cases × 80% contact coverage, 18.0% control churn versus 14.2% action-group churn, ₫18.5M protected margin per retained account and ₫110K action cost per contact. The assumptions model +3.8 percentage-point lift, 213 retained accounts and ₫3.32B net retention value. Production reporting replaces each assumption with CRM and finance fields.

## 12. Ownership

**Owned:** problem framing, label design, modeling, temporal validation, threshold strategy, explainability, output contract, the operating workflow (feature management, risk/value framework, overlay mechanism, review process and feedback loop), monitoring logic, production integration and the public notebook demo.

**Collaborated:** feature definitions and generation with data engineering.

## 13. Delivery and evidence contract

Every operating run preserves six evidence groups:

- model evidence: temporal holdout, locked threshold, AP/F1/ROC-AUC and capture at capacity;
- decision evidence: case ID, model version, original score, priority and reason evidence;
- action evidence: owner, SLA, channel, contact timestamp, cost and resolution code;
- outcome evidence: `retained_after_horizon` at `t + 2` with a comparison-group definition;
- business evidence: protected margin and net value, reported separately from model quality;
- audit evidence: overlay reason/expiry, approver and rollback target.

Continuous-improvement controls include champion–challenger evaluation, A/B or uplift measurement, bias monitoring by region and segment, role-based access control, a decision audit log and a named rollback command. Human-in-the-loop remains a standing operating property — no export field contacts a customer automatically.

The portfolio presents three inspectable layers: publicly reproduced notebook evidence, implementation traceable to system code, and the operational playbook used to turn scores into controlled retention work. Scenario economics are always labeled as assumptions rather than audited realized revenue.
