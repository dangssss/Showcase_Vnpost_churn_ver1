import type { Metadata } from "next";
import Link from "next/link";

const publicBasePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export const metadata: Metadata = {
  title: "Full Case Study | Explainable Logistics Churn Prioritization",
  description: "A detailed data science case study covering the business decision, temporal validation, model promotion, explainability, production scoring and retention handoff.",
};

const sources = [
  ["bccp_orderitem_YYMM", "Monthly partitions", "Order items, fees, delivery outcomes and service usage"],
  ["cas_customer", "Refreshed snapshot", "Customer master and account attributes"],
  ["cas_info", "Refreshed snapshot", "Profile, contract and organizational context"],
  ["cms_complaint", "Refreshed snapshot", "Complaint history and service-quality signals"],
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

const evidenceNeeded = [
  "Final holdout period and sample size",
  "PR-AUC, ROC-AUC and calibration evidence",
  "Precision, recall or capture at the real intervention capacity",
  "Realized queue volume and contact coverage",
  "A defined comparison group and two-month outcome window",
  "Approved retained-customer and attributable-revenue figures",
];

export default function CaseStudy() {
  return (
    <main className="case-page">
      <header className="topbar case-topbar">
        <Link className="brand" href="/" aria-label="Back to showcase home"><span className="brand-mark">CP</span><span>Churn / Decision Lab</span></Link>
        <nav aria-label="Case study navigation">
          <a href="#decision">Decision</a><a href="#data">Data</a><a href="#modeling">Modeling</a><a href="#production">Production</a><a href="#evidence">Evidence</a>
        </nav>
        <Link className="nav-cta" href="/#decision-lab">Open decision lab <span>↘</span></Link>
      </header>

      <section className="case-hero" id="top">
        <div className="case-hero-copy">
          <p className="eyebrow"><span /> Full case study · Logistics churn</p>
          <h1>From a churn score to a<br /><em>controlled retention workflow.</em></h1>
          <p>This case study explains the decisions behind a two-month customer-churn system: how time leakage was controlled, how candidate models are promoted, how scores become customer-level reasons, and how the final queue fits a real operating capacity.</p>
          <div className="hero-actions"><Link className="button primary" href="/#decision-lab">Explore the live demo <span>→</span></Link><a className="button secondary" href="#decision">Read the case</a></div>
        </div>
        <aside className="case-at-glance">
          <span>CASE AT A GLANCE</span>
          <dl>
            <div><dt>Role</dt><dd>Data Scientist</dd></div>
            <div><dt>Industry</dt><dd>Logistics</dd></div>
            <div><dt>Prediction horizon</dt><dd>Two months</dd></div>
            <div><dt>Feature surface</dt><dd>200+ signals</dd></div>
            <div><dt>Typical capacity</dt><dd>≈7,000 accounts</dd></div>
            <div><dt>Delivery</dt><dd>PostgreSQL · Airflow · Docker</dd></div>
          </dl>
          <p>Performance and verified business impact remain pending until an approved run artifact is available.</p>
        </aside>
      </section>

      <aside className="case-disclosure"><strong>Portfolio-safe edition</strong><p>No production customer records are shown. Synthetic examples reproduce the temporal shape and output contract, not production performance.</p><span>NO FABRICATED METRICS</span></aside>

      <div className="case-layout">
        <aside className="case-toc">
          <span>ON THIS PAGE</span>
          <div className="case-toc-links">
            <a href="#decision"><i>01</i>Business decision</a>
            <a href="#ownership-case"><i>02</i>Role &amp; ownership</a>
            <a href="#data"><i>03</i>Data &amp; time design</a>
            <a href="#modeling"><i>04</i>Model development</a>
            <a href="#production"><i>05</i>Production workflow</a>
            <a href="#output"><i>06</i>Output &amp; action</a>
            <a href="#monitoring-case"><i>07</i>Promotion &amp; monitoring</a>
            <a href="#evidence"><i>08</i>Limits &amp; evidence</a>
          </div>
          <Link className="toc-demo" href="/#decision-lab">Open interactive demo <span>↗</span></Link>
        </aside>

        <article className="case-article">
          <section className="case-section" id="decision">
            <div className="case-section-number">01 / BUSINESS DECISION</div>
            <h2>The constraint was not prediction.<br /><em>It was intervention capacity.</em></h2>
            <div className="case-two-col">
              <p>A retention team cannot contact every customer. A useful system therefore needs to do more than estimate churn probability: it must identify who should be reviewed first, explain why the score is high, and keep the queue within a workable capacity.</p>
              <div className="decision-question"><span>CORE DECISION</span><strong>Which active customers should receive attention now to reduce churn risk over the next two months?</strong></div>
            </div>
            <div className="case-outcome-grid">
              <div><span>MODEL OUTPUT</span><strong>Churn probability</strong><p>A comparable risk estimate for every eligible account.</p></div>
              <div><span>DECISION OUTPUT</span><strong>Ranked intervention queue</strong><p>A probability- or percentile-based list that fits operating capacity.</p></div>
              <div><span>USER OUTPUT</span><strong>Three structured reasons</strong><p>Metric, baseline, change and severity for human review.</p></div>
            </div>
          </section>

          <section className="case-section" id="ownership-case">
            <div className="case-section-number">02 / ROLE &amp; OWNERSHIP</div>
            <h2>A Data Scientist role spanning<br /><em>modeling and operationalization.</em></h2>
            <div className="ownership-boundary">
              <div><span>OWNED</span><ul><li>Problem framing and churn-label design</li><li>Logistic Regression baseline and XGBoost development</li><li>Purged walk-forward validation and final holdout</li><li>Random search and Optuna/TPE optimization</li><li>Operating policy, explainability and risk export</li><li>Monitoring logic and production integration</li></ul></div>
              <div><span>COLLABORATED</span><ul><li>Feature definitions and generation with data engineering</li><li>Operational interpretation with retention and service stakeholders</li><li>Source-system availability and production scheduling</li></ul><p>The portfolio does not claim sole ownership of the feature-engineering pipeline.</p></div>
            </div>
          </section>

          <section className="case-section" id="data">
            <div className="case-section-number">03 / DATA &amp; TEMPORAL DESIGN</div>
            <h2>Monthly behavior, refreshed context<br /><em>and a leakage-safe horizon.</em></h2>
            <p className="case-lede">One source is partitioned by reporting month; the remaining operational tables are refreshed snapshots. The modeling layer converts them into customer-level lifetime and temporal signals.</p>
            <div className="case-source-list">
              {sources.map(([name, cadence, purpose], index) => <div key={name}><i>{String(index + 1).padStart(2, "0")}</i><code>{name}</code><span>{cadence}</span><p>{purpose}</p></div>)}
            </div>
            <div className="case-window">
              <div className="window-heading"><span>TIME-AWARE EXAMPLE</span><strong>Scoring origin 2505</strong></div>
              <div className="window-track"><div className="history"><span>Historical context</span></div><div className="observe"><span>Observation window</span><b>Mar–May 2025</b></div><i>→</i><div className="predict"><span>Prediction period</span><b>Jun–Jul 2025</b></div></div>
              <p>Features stop at the scoring origin. Outcomes from the prediction period are used only as future labels during training or later backtesting.</p>
            </div>
          </section>

          <section className="case-section" id="modeling">
            <div className="case-section-number">04 / MODEL DEVELOPMENT</div>
            <h2>Complexity was added only after<br /><em>an interpretable baseline.</em></h2>
            <div className="model-decisions">
              <div><i>01</i><span><b>Baseline</b><strong>Logistic Regression</strong><p>Establish a transparent reference and expose directional or pipeline errors early.</p></span></div>
              <div><i>02</i><span><b>Candidate</b><strong>XGBoost</strong><p>Capture non-linear interactions across lifetime, recent-window and service-quality behavior.</p></span></div>
              <div><i>03</i><span><b>Search</b><strong>Random search → Optuna/TPE</strong><p>Explore broadly, then refine promising hyperparameter regions efficiently.</p></span></div>
              <div><i>04</i><span><b>Selection</b><strong>Purged walk-forward</strong><p>Train on the past, remove overlapping observations and validate on later months.</p></span></div>
              <div><i>05</i><span><b>Final check</b><strong>Chronological holdout</strong><p>Keep the latest eligible period outside tuning and model selection.</p></span></div>
            </div>
            <div className="metric-evidence-gap"><span>VALIDATED PERFORMANCE</span><strong>Pending approved run artifact</strong><p>No ROC-AUC, PR-AUC or business-impact number is invented for this public edition.</p></div>
          </section>

          <section className="case-section" id="production">
            <div className="case-section-number">05 / PRODUCTION WORKFLOW</div>
            <h2>The system is a monthly decision pipeline,<br /><em>not a one-off notebook.</em></h2>
            <div className="production-flow">
              <div><span>01</span><strong>Load</strong><p>Assemble the latest monthly window and refreshed customer context.</p></div>
              <div><span>02</span><strong>Train candidate</strong><p>Build a fresh candidate when the schedule and data state allow it.</p></div>
              <div><span>03</span><strong>Promote or retain</strong><p>Accept the candidate only when validation and monthly promotion rules pass.</p></div>
              <div><span>04</span><strong>Score</strong><p>Use the latest accepted bundle on active, churn-eligible customers.</p></div>
              <div><span>05</span><strong>Explain &amp; export</strong><p>Map positive SHAP evidence to reason buckets and write risk profiles.</p></div>
              <div><span>06</span><strong>Monitor</strong><p>Store score quantiles, risk ratio and feature drift by scoring origin.</p></div>
            </div>
            <div className="safe-fallback"><span>SAFE FAILURE BEHAVIOR</span><p>If a new candidate is rejected, the previous accepted model is retained. Scoring can continue with the known bundle instead of promoting an unsafe candidate.</p></div>
          </section>

          <section className="case-section" id="output">
            <div className="case-section-number">06 / OUTPUT &amp; ACTION</div>
            <h2>Explanations use observed evidence,<br /><em>not generic AI summaries.</em></h2>
            <p className="case-lede">Each exported profile contains identity and time fields, recent behavior, probability and up to three reasons. A reason carries a stable code plus the customer’s current metric, comparison baseline, delta, percentage change and severity.</p>
            <div className="reason-catalog">{reasons.map(([code, label], index) => <div key={code}><i>{String(index + 1).padStart(2, "0")}</i><strong>{label}</strong><span>System code · <code>{code}</code></span></div>)}</div>
            <div className="action-boundary-case">
              <div><span>CURRENT SYSTEM OUTPUT</span><strong>Risk profile CSV</strong><p>Probability, prediction period, recent metrics and three structured reasons.</p></div>
              <i>→</i>
              <div><span>HUMAN DECISION LAYER</span><strong>Context review and assignment</strong><p>Operations or account owners verify service and commercial context before contact.</p></div>
              <i>→</i>
              <div><span>PROPOSED CRM FEEDBACK</span><strong>Action and outcome fields</strong><p>Owner, status, contact time, outcome and retention after the horizon.</p></div>
            </div>
          </section>

          <section className="case-section" id="monitoring-case">
            <div className="case-section-number">07 / MODEL PROMOTION &amp; MONITORING</div>
            <h2>Promotion gates and drift monitoring<br /><em>solve different problems.</em></h2>
            <div className="guardrail-table">
              <div><span>Layer</span><span>Code-aligned rule</span><span>Failure behavior</span></div>
              <div><b>Walk-forward quality</b><p>Rejected-fold rate ≤25%; latest fold valid; not all folds rejected.</p><em>Reject candidate</em></div>
              <div><b>Final holdout</b><p>Required by default and must pass minimum quality checks.</p><em>Reject candidate</em></div>
              <div><b>Label prevalence</b><p>Block when candidate prevalence is above 45% and a prior bundle exists.</p><em>Keep prior bundle</em></div>
              <div><b>Month completeness</b><p>Rows ≥80%, active ≥50%, items ≥70%, revenue ≥70% versus prior month.</p><em>Keep prior bundle</em></div>
              <div><b>Current-period F1</b><p>Candidate must beat the accepted bundle re-evaluated on the current period.</p><em>Keep prior bundle</em></div>
              <div><b>Feature drift</b><p>PSI: OK ≤0.10, WARN &gt;0.10, ALERT &gt;0.20; discrete KS also stored.</p><em>Post-score monitoring</em></div>
              <div><b>Score drift</b><p>P50/P90/P99 and risk ratio; anomaly above historical median + 3 MAD.</p><em>Post-score monitoring</em></div>
            </div>
          </section>

          <section className="case-section evidence-section" id="evidence">
            <div className="case-section-number">08 / LIMITS &amp; NEXT EVIDENCE</div>
            <h2>What is known, what is simulated<br /><em>and what remains to prove.</em></h2>
            <div className="evidence-status"><div><span>KNOWN</span><strong>System design and operating flow</strong><p>Source cadence, temporal design, model pipeline, export contract, reason logic and intervention capacity.</p></div><div><span>SIMULATED</span><strong>Public customer examples</strong><p>A deterministic 30-customer, six-month cohort powers portfolio-safe profiles and reason evidence.</p></div><div><span>PENDING</span><strong>Performance and business impact</strong><p>Waiting for approved run outputs, realized interventions and the measurement window.</p></div></div>
            <div className="evidence-needed"><span>EVIDENCE TO ADD LATER</span><ul>{evidenceNeeded.map((item) => <li key={item}>{item}</li>)}</ul></div>
          </section>

          <section className="case-cta">
            <div><span>SEE THE SYSTEM WORK</span><h2>Move from the narrative<br />to the decision lab.</h2><p>Change the operating policy, inspect a customer’s monthly signals, review structured reasons and simulate a controlled handoff.</p></div>
            <div><Link className="button primary" href="/#decision-lab">Open decision lab <span>→</span></Link><a href={`${publicBasePath}/synthetic_risk_export.csv`} download>Download synthetic risk export ↓</a></div>
          </section>
        </article>
      </div>

      <footer><div><span className="brand-mark">CP</span><strong>Explainable Customer Churn Prioritization</strong></div><p>Full case study · Portfolio-safe edition</p><Link href="/">Back to showcase ↑</Link></footer>
    </main>
  );
}
