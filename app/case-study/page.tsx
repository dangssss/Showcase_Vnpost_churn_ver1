import type { Metadata } from "next";
import Link from "next/link";
import artifacts from "../notebook-artifacts.json";

const publicBasePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export const metadata: Metadata = {
  title: "Full Case Study | Explainable Logistics Churn Prioritization",
  description:
    "A detailed data science case study covering the business decision, temporal validation, a reproducible notebook demo, explainability, production scoring, retention handoff and the operating design around the model.",
};

const sources = [
  ["bccp_orderitem_YYMM", "Monthly partitions", "Order items, fees, delivery outcomes and service usage"],
  ["cas_customer", "Refreshed snapshot", "Customer master and account attributes"],
  ["cas_info", "Refreshed snapshot", "Profile, contract and organizational context"],
  ["cms_complaint", "Refreshed snapshot", "Complaint history and service-quality signals"],
  ["Label.label_YYMM", "Monthly outcome lists", "Future-month churn labels for training and backtesting"],
];

const reasons = [
  ["item_drop", "Shipment volume below the previous three-month average"],
  ["complaint_increase", "Complaint count above the previous three-month average"],
  ["delay_rate_increase", "Late-delivery rate increased"],
  ["nodone_rate_increase", "Non-completed delivery rate increased"],
  ["volume_volatility", "High shipment-volume coefficient of variation"],
  ["order_value_drop", "Average order value declined"],
  ["service_diversity_drop", "The customer uses fewer service types"],
  ["low_tenure", "New customer with low engagement tenure"],
];

const crmFieldGroups = [
  ["Identity & organization", "Who the customer is and who owns the relationship", "Customer, account owner, sales supervisor, unit, ward, province"],
  ["Model output", "The comparable risk estimate every active customer receives", "Churn probability, prediction month, data window month"],
  ["Explanation", "Why the score is high, in words a reviewer can verify", "Reason group, reason, reason category"],
  ["Priority", "Where this customer sits once value and urgency are weighed", "Final priority, customer segment, estimated customer value"],
  ["Recommended action", "What a human should do next, and with whom", "Recommended action, owner team, action deadline"],
  ["Outcome tracking", "What actually happened after the queue was worked", "Processing status, processing result, result detail"],
];

const actionRouting = [
  ["Delay / non-completion increase", "Operations + account owner", "Clear the backlog before any retention call", "High", "48 hours", "Phone + internal fix"],
  ["Complaint escalation", "Customer service", "Resolve open complaints, respond proactively", "High", "24 hours", "Phone"],
  ["Volume drop / volatility", "Territory account owner", "Understand the drop, offer a fitting service adjustment", "Medium", "5 business days", "Phone / in person"],
  ["Order value decline", "Account management", "Review pricing fit, propose a better-suited plan", "Medium", "5 business days", "Phone"],
  ["Low tenure / low service diversity", "Customer success", "Onboarding check-in, confirm the service matches the need", "Medium", "7 business days", "Phone / message"],
  ["A single depot, route or service point", "Regional operations", "Handled as an incident, not a per-customer case — see Overlay", "Incident SLA", "Per incident", "Internal first"],
];

const reviewChecklist = [
  ["Data quality", "Freshness, row-count continuity and snapshot age against defined floors", "Block ingestion downstream"],
  ["Feature alignment", "Training and scoring read the same column list, encoding and gating logic from one saved bundle", "Reject mismatched bundle"],
  ["Model performance", "Walk-forward folds, final holdout F1 and score-spread gates (Section 10)", "Reject candidate"],
  ["Threshold & segments", "Operating threshold re-checked against current-period prevalence and region mix", "Hold at prior threshold"],
  ["Output contract test", "Every required column present, typed and non-null on a full export run", "Block file handoff"],
  ["CRM integration test", "A sample batch loads cleanly into the receiving CRM fields end to end", "Block integration"],
  ["Business UAT", "One full cycle reviewed by retention and account teams before it drives real contact", "Hold for sign-off"],
  ["Deployment approval & rollback", "A named approver accepts the release; the previous accepted bundle stays one command away", "Roll back to prior bundle"],
];

const feedbackKpis = [
  ["Contact coverage", "Customers contacted ÷ customers flagged", "How much of the predicted risk actually reaches a human"],
  ["Action completion rate", "Cases closed within SLA ÷ cases opened", "Operational discipline, independent of the model"],
  ["Realized precision", "Confirmed at-risk ÷ total contacted", "The model's precision measured against real outcomes, not validation"],
  ["Retention lift", "Churn rate (contacted) − churn rate (comparable, not contacted)", "The actual effect of the action, isolated from the score"],
  ["Feedback completeness", "Rows with a recorded outcome ÷ rows exported", "Whether the loop itself is being closed"],
];

const roadmapItems = [
  ["Champion–challenger", "Run a candidate bundle alongside the accepted one before it ever sets a customer's priority"],
  ["A/B and uplift measurement", "Hold out a comparable, uncontacted group to isolate the action's true effect from the score"],
  ["Bias monitoring", "Track flag rate and false-positive rate by region and segment so no group is systematically over- or under-served"],
  ["Access control", "Role-based access to risk exports, separate from access to the underlying customer tables"],
  ["Decision audit log", "Who saw which queue, when, and what action was recorded against it"],
  ["Response SLA", "A time-to-contact target for each priority tier, tracked the same way data-freshness SLAs already are"],
  ["Cost and ROI framing", "Retention cost per saved account, measured against Expected Value of Retention (Section 07)"],
  ["Model vs. business performance", "Report F1/AP and realized retention lift as two separate numbers, never one blended score"],
  ["Human-in-the-loop by design", "No export field ever contacts a customer directly — every row still waits for a person to act"],
  ["Rollback procedure", "A named command to fall back to the last accepted bundle, not just a stored file"],
];

const evidenceNeeded = [
  "Approved production holdout period and sample size",
  "Production PR-AUC, ROC-AUC and calibration evidence",
  "Precision, recall or capture at the real intervention capacity",
  "Realized queue volume and contact coverage",
  "A defined comparison group and two-month outcome window",
  "Approved retained-customer and attributable-revenue figures",
];

export default function CaseStudy() {
  const holdout = artifacts.metric_comparison[1];
  const validation = artifacts.metric_comparison[0];
  return (
    <main className="case-page">
      <header className="topbar case-topbar">
        <Link className="brand" href="/" aria-label="Back to showcase home">
          <span className="brand-mark">CP</span>
          <span>Churn / Decision Lab</span>
        </Link>
        <nav aria-label="Case study navigation">
          <a href="#decision">Decision</a>
          <a href="#data">Data</a>
          <a href="#modeling">Modeling</a>
          <a href="#demo-evidence">Demo</a>
          <a href="#production">Production</a>
          <a href="#evidence">Evidence</a>
        </nav>
        <Link className="nav-cta" href="/#decision-lab">
          Open decision lab <span>↘</span>
        </Link>
      </header>

      <section className="case-hero" id="top">
        <div className="case-hero-copy">
          <p className="eyebrow">
            <span /> Full case study · Logistics churn
          </p>
          <h1>
            From a churn score to a<br />
            <em>controlled retention workflow.</em>
          </h1>
          <p>
            This case study explains the thinking behind a two-month customer-churn system: how time leakage was
            controlled, how the sliding window was selected, how a score becomes a prioritized, explainable action —
            and how the whole method is demonstrated end to end by a public, reproducible notebook on synthetic data.
          </p>
          <div className="hero-actions">
            <Link className="button primary" href="/#decision-lab">
              Explore the live demo <span>→</span>
            </Link>
            <a className="button secondary" href="#decision">
              Read the case
            </a>
          </div>
        </div>
        <aside className="case-at-glance">
          <span>CASE AT A GLANCE</span>
          <dl>
            <div><dt>Role</dt><dd>Data Scientist</dd></div>
            <div><dt>Industry</dt><dd>Logistics</dd></div>
            <div><dt>Prediction horizon</dt><dd>Two months</dd></div>
            <div><dt>Sliding window</dt><dd>K = 13 months (LR sweep)</dd></div>
            <div><dt>Public demo</dt><dd>1,400 × 22-month synthetic cohort</dd></div>
            <div><dt>Demo holdout</dt><dd>F1 {holdout.f1.toFixed(3)} · ROC-AUC {holdout.roc_auc.toFixed(3)}</dd></div>
            <div><dt>Delivery</dt><dd>PostgreSQL · Airflow · Docker</dd></div>
          </dl>
          <p>
            Demo metrics are real notebook outputs on synthetic data. Production performance and verified business impact
            remain pending until an approved run artifact is available.
          </p>
        </aside>
      </section>

      <aside className="case-disclosure">
        <strong>Portfolio-safe edition</strong>
        <p>
          No production customer records are shown. The synthetic cohort reproduces the temporal structure and output
          contract; its metrics are honest results of the public notebook, never presented as production performance.
        </p>
        <span>NO FABRICATED METRICS</span>
      </aside>

      <div className="case-layout">
        <aside className="case-toc">
          <span>ON THIS PAGE</span>
          <div className="case-toc-links">
            <a href="#decision"><i>01</i>Business decision</a>
            <a href="#ownership-case"><i>02</i>Role &amp; ownership</a>
            <a href="#data"><i>03</i>Data &amp; time design</a>
            <a href="#features"><i>04</i>Feature management</a>
            <a href="#modeling"><i>05</i>Model development</a>
            <a href="#demo-evidence"><i>06</i>The notebook demo</a>
            <a href="#risk-value"><i>07</i>Risk vs. value</a>
            <a href="#output"><i>08</i>Output &amp; action</a>
            <a href="#production"><i>09</i>Production &amp; overlay</a>
            <a href="#monitoring-case"><i>10</i>Promotion &amp; monitoring</a>
            <a href="#review-approval"><i>11</i>Review &amp; approval</a>
            <a href="#feedback-loop"><i>12</i>Feedback loop</a>
            <a href="#evidence"><i>13</i>Limits &amp; roadmap</a>
          </div>
          <Link className="toc-demo" href="/#decision-lab">
            Open interactive demo <span>↗</span>
          </Link>
        </aside>

        <article className="case-article">
          <section className="case-section" id="decision">
            <div className="case-section-number">01 / BUSINESS DECISION</div>
            <h2>
              The constraint was not prediction.
              <br />
              <em>It was intervention capacity.</em>
            </h2>
            <div className="case-two-col">
              <p>
                A retention team cannot contact every customer. A useful system therefore needs to do more than estimate
                churn probability: it must identify who should be reviewed first, explain why the score is high, and keep
                the queue within a workable capacity — approximately 7,000 intervention slots in a typical production run.
              </p>
              <div className="decision-question">
                <span>CORE DECISION</span>
                <strong>
                  Which active customers should receive attention now to reduce churn risk over the next two months?
                </strong>
              </div>
            </div>
            <div className="case-outcome-grid">
              <div>
                <span>MODEL OUTPUT</span>
                <strong>Churn probability</strong>
                <p>A comparable risk estimate for every active, eligible account.</p>
              </div>
              <div>
                <span>DECISION OUTPUT</span>
                <strong>Ranked intervention queue</strong>
                <p>A probability- or capacity-based list with an explicit priority rank per customer.</p>
              </div>
              <div>
                <span>USER OUTPUT</span>
                <strong>Structured reasons</strong>
                <p>Metric, baseline, change and severity for human review before any contact.</p>
              </div>
            </div>
          </section>

          <section className="case-section" id="ownership-case">
            <div className="case-section-number">02 / ROLE &amp; OWNERSHIP</div>
            <h2>
              A Data Scientist role spanning
              <br />
              <em>modeling and operationalization.</em>
            </h2>
            <div className="ownership-boundary">
              <div>
                <span>OWNED</span>
                <ul>
                  <li>Problem framing and churn-label design</li>
                  <li>Logistic Regression baseline and XGBoost development</li>
                  <li>Sliding-window (K) selection and temporal validation</li>
                  <li>Threshold strategy, explainability and risk export</li>
                  <li>The operating design: feedback loop, priority framework, overlay and review process</li>
                  <li>The public, reproducible notebook demo</li>
                </ul>
              </div>
              <div>
                <span>COLLABORATED</span>
                <ul>
                  <li>Feature definitions and generation with data engineering</li>
                  <li>Operational interpretation with retention and service stakeholders</li>
                  <li>Source-system availability and production scheduling</li>
                </ul>
                <p>The portfolio does not claim sole ownership of the feature-engineering pipeline.</p>
              </div>
            </div>
          </section>

          <section className="case-section" id="data">
            <div className="case-section-number">03 / DATA &amp; TEMPORAL DESIGN</div>
            <h2>
              Monthly behavior, refreshed context
              <br />
              <em>and a leakage-safe horizon.</em>
            </h2>
            <p className="case-lede">
              Orders are partitioned by reporting month; customer and complaint tables are refreshed snapshots; churn
              labels arrive as monthly lists of departed customers. The modeling layer converts them into sliding-window
              feature tables named <code>cus_feature_&#123;K&#125;m_YYMM_YYMM</code> — lags, volume and revenue aggregates,
              slopes, volatility, delivery-quality rates, service mix, RFM and lifetime ratios.
            </p>
            <div className="case-source-list">
              {sources.map(([name, cadence, purpose], index) => (
                <div key={name}>
                  <i>{String(index + 1).padStart(2, "0")}</i>
                  <code>{name}</code>
                  <span>{cadence}</span>
                  <p>{purpose}</p>
                </div>
              ))}
            </div>
            <div className="case-window">
              <div className="window-heading">
                <span>TIME-AWARE EXAMPLE · HOLDOUT SNAPSHOT</span>
                <strong>Scoring origin Aug 2026</strong>
              </div>
              <div className="case-window-track">
                <div className="history"><span>Earlier history</span><b>Jan 2025 →</b></div>
                <div className="observe"><span>13-month feature window</span><b>Aug 2025 – Aug 2026</b></div>
                <i>→</i>
                <div className="predict"><span>Label month (t + 2)</span><b>Oct 2026</b></div>
              </div>
              <p>
                Features stop at the scoring origin; the label lives two months later. An active-now gate keeps only
                customers still shipping at month t, so the model learns “active today, gone in two months” rather than
                re-detecting customers who already left.
              </p>
            </div>
          </section>

          <section className="case-section" id="features">
            <div className="case-section-number">04 / FEATURE MANAGEMENT</div>
            <h2>
              A feature table&apos;s name
              <br />
              <em>is its version.</em>
            </h2>
            <p className="case-lede">
              At batch scale, feature management is less about tooling and more about discipline: every table has to say
              what it is just by its name, and the code that builds a feature has to be the same code whether it runs at
              training time or at scoring time. That discipline is what this system is designed around.
            </p>
            <div className="model-decisions">
              <div>
                <i>01</i>
                <span>
                  <b>Naming as versioning</b>
                  <strong>The table name is the version key</strong>
                  <p>
                    A window table encodes its own window length and start/end month; a lifetime snapshot encodes its own
                    month. There is no separate version number that can drift out of sync with what the table actually
                    contains.
                  </p>
                </span>
              </div>
              <div>
                <i>02</i>
                <span>
                  <b>One code path</b>
                  <strong>Training and scoring build features the same way</strong>
                  <p>
                    Gating, outlier handling and time-based feature construction run through shared functions. The exact
                    column list, categorical encoding and date handling used at training time are saved with the model
                    bundle and reloaded unchanged at scoring time — training–serving drift is closed by construction, not
                    by convention.
                  </p>
                </span>
              </div>
              <div>
                <i>03</i>
                <span>
                  <b>Missing data</b>
                  <strong>Resolved at the source, not left ambiguous</strong>
                  <p>
                    Numeric aggregates are zero-filled where zero is the honest value; categorical gaps get an explicit
                    “missing” label rather than a silent null; outliers are clipped to a percentile bound instead of
                    dropping the row, so one abnormal month never removes a customer from training.
                  </p>
                </span>
              </div>
              <div>
                <i>04</i>
                <span>
                  <b>Reuse over rebuilding</b>
                  <strong>Feature tables are recomputed incrementally</strong>
                  <p>
                    Only the window that actually changed gets rebuilt, and training, tuning and scoring all read from the
                    same tables — the same feature is never computed twice by two different pieces of code.
                  </p>
                </span>
              </div>
              <div>
                <i>05</i>
                <span>
                  <b>Lineage</b>
                  <strong>Every accepted bundle carries its own history</strong>
                  <p>
                    A bundle stores the exact feature list it was trained on, a snapshot of the feature distribution at
                    that time, and its own validation report — enough to answer “what data produced this model” after
                    the fact, not just at release time.
                  </p>
                </span>
              </div>
            </div>
            <div className="direct-answer">
              <span>A QUESTION WORTH ANSWERING DIRECTLY</span>
              <strong>Does this need a Feature Store?</strong>
              <p>
                Not at this cadence. Nothing here needs a feature value served in milliseconds — everything runs in
                monthly or weekly batches. A template-driven pipeline with disciplined table naming, one shared code path
                between training and scoring, and per-bundle lineage already delivers what a feature store exists to
                guarantee: consistency, reuse and traceability. A feature store earns its operational cost only once a
                real-time scoring path exists; until then, a well-governed pipeline is the right-sized answer, not a gap
                to apologize for. The one open item is extending drift monitoring to categorical features — today it
                profiles them, but only numeric features get a PSI score (Section 10).
              </p>
            </div>
          </section>

          <section className="case-section" id="modeling">
            <div className="case-section-number">05 / MODEL DEVELOPMENT</div>
            <h2>
              Complexity was added only after
              <br />
              <em>an interpretable baseline.</em>
            </h2>
            <div className="model-decisions">
              <div>
                <i>01</i>
                <span>
                  <b>Baseline as referee</b>
                  <strong>Logistic Regression selects K</strong>
                  <p>
                    An elastic-net LR sweep across K ∈ &#123;3, 6, 9, 13&#125; × static-feature options picks the window
                    configuration — it is deliberately not the final model.
                  </p>
                </span>
              </div>
              <div>
                <i>02</i>
                <span>
                  <b>Main model</b>
                  <strong>XGBoost on the selected dataset</strong>
                  <p>Histogram trees with early stopping on AP and the class weight inherited from the LR guardrail.</p>
                </span>
              </div>
              <div>
                <i>03</i>
                <span>
                  <b>Search</b>
                  <strong>Focused grid → Random search → Optuna/TPE</strong>
                  <p>
                    The notebook demonstrates a focused five-candidate grid; the production system extends the same
                    selection logic with random search and Optuna refinement.
                  </p>
                </span>
              </div>
              <div>
                <i>04</i>
                <span>
                  <b>Selection metric</b>
                  <strong>Validation F1, AP as tie-breaker</strong>
                  <p>
                    Degenerate predict-all-positive solutions are rejected; precision, recall and ROC-AUC are always read
                    alongside.
                  </p>
                </span>
              </div>
              <div>
                <i>05</i>
                <span>
                  <b>Final check</b>
                  <strong>Chronological holdout with a locked threshold</strong>
                  <p>
                    The last month stays untouched through selection and tuning; the decision threshold is fixed on
                    validation before it ever sees the holdout.
                  </p>
                </span>
              </div>
            </div>
          </section>

          <section className="case-section" id="demo-evidence">
            <div className="case-section-number">06 / THE NOTEBOOK DEMO</div>
            <h2>
              Method claims are cheap.
              <br />
              <em>So the demo re-runs everything.</em>
            </h2>
            <p className="case-lede">
              Because production data cannot be published, a public notebook generates a 1,400-customer × 22-month
              synthetic cohort mirroring the production schema, then executes the full pipeline: sliding-window feature
              tables, the LR sweep (which independently selects K = 13 with static features), XGBoost tuning, and a final
              untouched holdout month. Every figure on the showcase is exported from that run — deterministic at seed 42.
            </p>
            <div className="demo-results">
              <span>SYNTHETIC HOLDOUT · REAL NOTEBOOK OUTPUT</span>
              <h3>Locked threshold {artifacts.chosen_threshold.toFixed(3)} · scoring origin Aug 2026</h3>
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Split</th>
                      <th>F1</th>
                      <th>Precision</th>
                      <th>Recall</th>
                      <th>AP</th>
                      <th>ROC-AUC</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td><b>Validation (tuned)</b></td>
                      <td>{validation.f1.toFixed(4)}</td>
                      <td>{validation.precision.toFixed(4)}</td>
                      <td>{validation.recall.toFixed(4)}</td>
                      <td>{validation.ap.toFixed(4)}</td>
                      <td>{validation.roc_auc.toFixed(4)}</td>
                    </tr>
                    <tr>
                      <td><b>Holdout · locked threshold</b></td>
                      <td><b>{holdout.f1.toFixed(4)}</b></td>
                      <td>{holdout.precision.toFixed(4)}</td>
                      <td>{holdout.recall.toFixed(4)}</td>
                      <td>{holdout.ap.toFixed(4)}</td>
                      <td>{holdout.roc_auc.toFixed(4)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p>
                On the {artifacts.xgb_setup.test_rows.toLocaleString("en-US")}-customer holdout the model caught{" "}
                {artifacts.confusion.tp} of {artifacts.holdout_positives} churners with {artifacts.confusion.fp} false
                alarms; contacting only the top 10% of the queue reaches{" "}
                {(artifacts.top10pct.precision * 100).toFixed(1)}% precision. Five guardrail asserts (non-degenerate
                prediction, AP above prevalence, sane ranking, score spread, threshold usefulness) must pass before the
                notebook completes. <Link href="/#performance">See the full results dashboard →</Link>
              </p>
            </div>
          </section>

          <section className="case-section" id="risk-value">
            <div className="case-section-number">07 / RISK VS. VALUE</div>
            <h2>
              The highest churn risk
              <br />
              <em>is not always who to save first.</em>
            </h2>
            <p className="case-lede">
              Ranking a queue by churn probability alone creates a bad incentive: a small account at 90% risk would
              outrank a strategic account at 40% risk whose loss matters far more, while contact capacity is always
              limited. The queue needs a second axis — value — sitting right next to probability.
            </p>
            <div className="formula-block">
              <code>{"Expected Value of Retention  =  P(churn) × Customer Value × P(saved | contacted)  −  Cost of the action"}</code>
              <small>
                A lighter Retention Priority Score blends the same four ingredients — normalized churn probability,
                customer value, urgency and action cost — into a single rank for day-to-day triage, for the days a full
                expected-value calculation isn&apos;t practical. Customer value itself is scored the same way the churn
                side is: a recency–frequency–monetary read of the account, weighted with a voice-of-customer signal from
                complaint history.
              </small>
            </div>
            <div className="priority-matrix">
              <div className="tier-urgent">
                <span>HIGH CHURN · HIGH VALUE</span>
                <strong>Save now</strong>
                <p>Direct contact within 24–48 hours, handled by the account owner, no automation in the loop.</p>
                <em>Urgent</em>
              </div>
              <div>
                <span>HIGH CHURN · LOW VALUE</span>
                <strong>Low-cost outreach</strong>
                <p>Automated or templated contact, capped effort — the risk is real but the loss is small.</p>
                <em>Medium</em>
              </div>
              <div className="tier-watch">
                <span>LOW CHURN · HIGH VALUE</span>
                <strong>Proactive relationship care</strong>
                <p>Not retention — growth. Scheduled check-ins so a high-value account never quietly drifts into risk.</p>
                <em>Ongoing</em>
              </div>
              <div>
                <span>LOW CHURN · LOW VALUE</span>
                <strong>Monitor only</strong>
                <p>No active outreach. Resources stay where they change an outcome.</p>
                <em>Low</em>
              </div>
            </div>
          </section>

          <section className="case-section" id="output">
            <div className="case-section-number">08 / OUTPUT &amp; ACTION</div>
            <h2>
              Explanations use observed evidence,
              <br />
              <em>not generic AI summaries.</em>
            </h2>
            <p className="case-lede">
              The notebook demo exports a six-column risk list — customer, scoring origin, label, probability, decision
              and priority rank — and demonstrates global explainability with XGBoost gain importance. The production
              layer extends this: model attribution ranks which of eight operational reason buckets to surface per
              customer, and each one is always rendered with a deterministic comparison — the observed metric, its
              three-month baseline, delta and severity — so a reason never depends on the attribution step succeeding,
              and a retention user can verify every number without knowing what SHAP is.
            </p>
            <div className="reason-catalog">
              {reasons.map(([code, label], index) => (
                <div key={code}>
                  <i>{String(index + 1).padStart(2, "0")}</i>
                  <div>
                    <strong>{label}</strong>
                    <code>{code}</code>
                  </div>
                </div>
              ))}
            </div>

            <h3 className="case-subheading">A risk score is not a CRM output. A prioritized, explained customer is.</h3>
            <p>
              The full export is designed around six roles, each answering a different question a retention team asks
              before making contact:
            </p>
            <div className="table-scroll">
              <table className="data-table prose">
                <thead>
                  <tr>
                    <th>Group</th>
                    <th>Purpose</th>
                    <th>Example fields</th>
                  </tr>
                </thead>
                <tbody>
                  {crmFieldGroups.map(([group, purpose, fields]) => (
                    <tr key={group}>
                      <td><b>{group}</b></td>
                      <td>{purpose}</td>
                      <td>{fields}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h3 className="case-subheading">From reason to response</h3>
            <p>
              Each reason bucket routes to a specific owner with its own priority and clock — a churn queue is only as
              useful as the response it triggers:
            </p>
            <div className="table-scroll">
              <table className="data-table prose">
                <thead>
                  <tr>
                    <th>Reason group</th>
                    <th>Owner</th>
                    <th>Recommended action</th>
                    <th>Priority</th>
                    <th>SLA</th>
                    <th>Channel</th>
                  </tr>
                </thead>
                <tbody>
                  {actionRouting.map(([reason, owner, action, priority, sla, channel]) => (
                    <tr key={reason}>
                      <td><b>{reason}</b></td>
                      <td>{owner}</td>
                      <td>{action}</td>
                      <td>{priority}</td>
                      <td>{sla}</td>
                      <td>{channel}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="action-boundary-case">
              <div>
                <span>NOTEBOOK DEMO — IMPLEMENTED</span>
                <strong>Ranked six-column risk list</strong>
                <p>Probability, decision at the locked threshold and priority rank for every active holdout customer.</p>
              </div>
              <i>→</i>
              <div>
                <span>PRODUCTION EXPORT — SYSTEM CODE</span>
                <strong>Risk profiles with structured reasons</strong>
                <p>Recent behavior aggregates plus up to three model-ranked reasons in business language.</p>
              </div>
              <i>→</i>
              <div>
                <span>OPERATING DESIGN</span>
                <strong>Priority, routing and outcome fields</strong>
                <p>Final priority, recommended action, owner and outcome, so contact and impact can be measured.</p>
              </div>
            </div>
          </section>

          <section className="case-section" id="production">
            <div className="case-section-number">09 / PRODUCTION &amp; OVERLAY</div>
            <h2>
              The system is a monthly decision pipeline,
              <br />
              <em>with room to react in between.</em>
            </h2>
            <div className="production-flow">
              <div><span>01</span><strong>Load</strong><p>Assemble the latest monthly window and refreshed customer context.</p></div>
              <div><span>02</span><strong>Train candidate</strong><p>Build a fresh candidate when the schedule and data state allow it.</p></div>
              <div><span>03</span><strong>Promote or retain</strong><p>Accept the candidate only when validation and monthly promotion rules pass.</p></div>
              <div><span>04</span><strong>Score</strong><p>Use the latest accepted bundle on active, churn-eligible customers.</p></div>
              <div><span>05</span><strong>Explain &amp; export</strong><p>Rank SHAP evidence into reason buckets and write risk profiles.</p></div>
              <div><span>06</span><strong>Monitor</strong><p>Store score quantiles, risk ratio and feature drift by scoring origin.</p></div>
            </div>
            <div className="safe-fallback">
              <span>SAFE FAILURE BEHAVIOR</span>
              <p>
                If a new candidate is rejected, the previous accepted model is retained. Scoring continues with the known
                bundle instead of promoting an unsafe candidate.
              </p>
            </div>

            <h3 className="case-subheading">Overlay: reacting to an incident without retraining</h3>
            <p>
              Monthly scoring is kept deliberately separate from retraining — scoring can run on its own, without ever
              touching the model. That separation is exactly where an operational overlay belongs: a thin rule layer
              that sits after scoring, reads a live event (a delayed depot, a payment outage, a service disruption in one
              area), finds the customers active in that place and window, and raises their priority — without ever
              changing the model&apos;s own probability. A model forecasts two months out; it has no reason to know about
              yesterday&apos;s incident. Operations does, and the overlay is the bridge between the two clocks.
            </p>
            <div className="production-flow">
              <div><span>01</span><strong>Operational event</strong><p>A depot, route or service-point disruption is logged.</p></div>
              <div><span>02</span><strong>Impacted customers</strong><p>Match affected customers by place and time window.</p></div>
              <div><span>03</span><strong>Overlay rules</strong><p>Assign a severity and a validity window — never open-ended.</p></div>
              <div><span>04</span><strong>Final priority</strong><p>Combine the model score with overlay severity; the original probability is never overwritten.</p></div>
              <div><span>05</span><strong>Recommended action</strong><p>Route to the owning team with an incident-based deadline.</p></div>
              <div><span>06</span><strong>CRM</strong><p>The overlay reason and its expiry travel with the record.</p></div>
            </div>
            <div className="table-scroll">
              <table className="data-table prose">
                <thead>
                  <tr>
                    <th>Field</th>
                    <th>Source</th>
                  </tr>
                </thead>
                <tbody>
                  <tr><td><code>model_churn_probability</code></td><td>The model, unchanged by any overlay</td></tr>
                  <tr><td><code>model_risk_level</code></td><td>Threshold banding of the probability</td></tr>
                  <tr><td><code>overlay_flag</code></td><td>Whether an incident is currently affecting this customer</td></tr>
                  <tr><td><code>overlay_reason</code></td><td>Plain description of the incident</td></tr>
                  <tr><td><code>overlay_severity</code></td><td>Low / medium / high, set by the incident, not the model</td></tr>
                  <tr><td><code>final_priority</code></td><td>Model priority adjusted by overlay severity</td></tr>
                  <tr><td><code>recommended_action</code></td><td>May switch temporarily to an incident-specific action</td></tr>
                  <tr><td><code>action_deadline</code></td><td>Shortened automatically when overlay severity is high</td></tr>
                </tbody>
              </table>
            </div>
            <p>
              Every overlay carries a start and expiry — it lapses back to the model&apos;s own priority automatically —
              and applies only to the customers actually inside the affected place and window, so one local incident
              never inflates the whole queue. The reason and its expiry are logged separately from the model&apos;s own
              run log, so an audit later can tell a model problem from an operational one at a glance.
            </p>
          </section>

          <section className="case-section" id="monitoring-case">
            <div className="case-section-number">10 / MODEL PROMOTION &amp; MONITORING</div>
            <h2>
              Promotion gates and drift monitoring
              <br />
              <em>solve different problems.</em>
            </h2>
            <p>
              The notebook ends with five hard asserts — non-degenerate predictions, AP above prevalence, ranking above
              random, sufficient score spread and a threshold that actually helps validation F1. Production extends that
              instinct into explicit gates:
            </p>
            <div className="guardrail-table">
              <div><span>Layer</span><span>Code-aligned rule</span><span>Failure behavior</span></div>
              <div><b>Walk-forward quality</b><p>Rejected-fold rate ≤ 25%; latest fold valid; not all folds rejected.</p><em>Reject candidate</em></div>
              <div><b>Final holdout</b><p>Required by default and must pass minimum quality checks.</p><em>Reject candidate</em></div>
              <div><b>Label prevalence</b><p>Block when candidate prevalence is above 45% and a prior bundle exists.</p><em>Keep prior bundle</em></div>
              <div><b>Month completeness</b><p>Rows ≥ 80%, active ≥ 50%, items ≥ 70%, revenue ≥ 70% versus prior month.</p><em>Keep prior bundle</em></div>
              <div><b>Current-period F1</b><p>Candidate must beat the accepted bundle re-evaluated on the current period.</p><em>Keep prior bundle</em></div>
              <div><b>Feature drift</b><p>PSI: OK ≤ 0.10, WARN &gt; 0.10, ALERT &gt; 0.20; discrete KS also stored.</p><em>Post-score monitoring</em></div>
              <div><b>Score drift</b><p>P50/P90/P99 and risk ratio; anomaly above historical median + 3 MAD.</p><em>Post-score monitoring</em></div>
            </div>
          </section>

          <section className="case-section" id="review-approval">
            <div className="case-section-number">11 / REVIEW &amp; APPROVAL</div>
            <h2>
              A model earns production
              <br />
              <em>the same way it earns a customer&apos;s trust — with evidence.</em>
            </h2>
            <p className="case-lede">
              Passing the model-performance gates above is necessary but not sufficient for a proof of concept to become
              something a business runs on. A release also has to prove the surrounding system works — the data feeding
              it, the contract it exports, and the people expected to act on it:
            </p>
            <div className="guardrail-table">
              <div><span>Step</span><span>What is verified</span><span>Outcome if it fails</span></div>
              {reviewChecklist.map(([step, detail, failure]) => (
                <div key={step}><b>{step}</b><p>{detail}</p><em>{failure}</em></div>
              ))}
            </div>
            <p>
              A candidate is only ready for production once it clears every model gate in Section 10, passes the output
              and CRM integration tests above, has survived one full cycle of business review with no blocking feedback,
              and has a confirmed path back to the previous accepted bundle if it needs to be reversed.
            </p>
          </section>

          <section className="case-section" id="feedback-loop">
            <div className="case-section-number">12 / FEEDBACK LOOP</div>
            <h2>
              A prediction is not finished
              <br />
              <em>until its outcome comes back.</em>
            </h2>
            <p className="case-lede">
              Exporting a risk file is not the end of the workflow — it is the start of a loop that has to close, or the
              system never learns whether it is actually helping:
            </p>
            <div className="pipeline" aria-label="Feedback loop stages">
              <div><span>01</span><strong>Prediction</strong><small>Risk export, ranked and reasoned</small></div>
              <i>→</i>
              <div><span>02</span><strong>Business action</strong><small>Routed to an owner by reason bucket</small></div>
              <i>→</i>
              <div><span>03</span><strong>Actual outcome</strong><small>Contacted, result, retained or not</small></div>
              <i>→</i>
              <div><span>04</span><strong>Model evaluation</strong><small>Predicted risk vs. real behavior at t+2</small></div>
              <i>→</i>
              <div><span>05</span><strong>Model improvement</strong><small>Retrain, re-threshold or re-feature</small></div>
            </div>
            <p>
              Step five feeds back into step one — the loop is a cycle, not a line. Outcome data is used to evaluate the
              policy, not to relabel training data directly, which would let the act of contacting a customer quietly
              bias the very model that decided to contact them.
            </p>
            <div className="table-scroll">
              <table className="data-table prose">
                <thead>
                  <tr>
                    <th>KPI</th>
                    <th>Formula</th>
                    <th>What it tells you</th>
                  </tr>
                </thead>
                <tbody>
                  {feedbackKpis.map(([kpi, formula, meaning]) => (
                    <tr key={kpi}>
                      <td><b>{kpi}</b></td>
                      <td>{formula}</td>
                      <td>{meaning}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p>
              Retraining is already designed to respond to more than the calendar: alongside the fixed quarterly cycle,
              a retrain is due early the moment feature drift crosses into alert territory. The same principle should
              extend to the loop above — the operating threshold gets reviewed when realized precision (measured from
              actual outcomes, not validation) drifts down for several months in a row, and a reason bucket gets revisited
              when it consistently produces actions that don&apos;t change the outcome.
            </p>
          </section>

          <section className="case-section evidence-section" id="evidence">
            <div className="case-section-number">13 / LIMITS &amp; ROADMAP</div>
            <h2>
              What is demonstrated, what is designed
              <br />
              <em>and what remains to prove.</em>
            </h2>
            <div className="evidence-status">
              <div>
                <span>DEMONSTRATED</span>
                <strong>The pipeline, end to end</strong>
                <p>
                  Window selection, tuning, locked-threshold holdout, ranking and explainability — reproduced by the
                  public notebook on a 1,400 × 22-month synthetic cohort with verifiable outputs.
                </p>
              </div>
              <div>
                <span>DESIGNED</span>
                <strong>The operating layer around the model</strong>
                <p>
                  Reason buckets, promotion gates, drift monitoring, the risk/value priority framework, the overlay
                  mechanism and the feedback loop, aligned with the production codebase.
                </p>
              </div>
              <div>
                <span>PENDING</span>
                <strong>Production performance and impact</strong>
                <p>Waiting for approved run outputs, realized interventions and the two-month measurement window.</p>
              </div>
            </div>
            <div className="evidence-needed">
              <span>EVIDENCE TO ADD LATER</span>
              <ul>
                {evidenceNeeded.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>

            <h3 className="case-subheading">Roadmap: what a production-grade system adds next</h3>
            <div className="reason-catalog">
              {roadmapItems.map(([title, detail], index) => (
                <div key={title}>
                  <i>{String(index + 1).padStart(2, "0")}</i>
                  <div>
                    <strong>{title}</strong>
                    <span className="reason-detail">{detail}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="case-cta">
            <div>
              <span>SEE THE SYSTEM WORK</span>
              <h2>
                Move from the narrative
                <br />
                to the decision lab.
              </h2>
              <p>
                Move the operating threshold over the real holdout scores, open 22-month customer dossiers, and inspect
                the ranked queue the notebook produced.
              </p>
            </div>
            <div>
              <Link className="button primary" href="/#decision-lab">
                Open decision lab <span>→</span>
              </Link>
              <a href={`${publicBasePath}/notebook_risk_list.csv`} download>
                Download the notebook risk list ↓
              </a>
            </div>
          </section>
        </article>
      </div>

      <footer>
        <div>
          <span className="brand-mark">CP</span>
          <strong>Explainable Customer Churn Prioritization</strong>
        </div>
        <p>Full case study · Portfolio-safe edition</p>
        <Link href="/">Back to showcase ↑</Link>
      </footer>
    </main>
  );
}
