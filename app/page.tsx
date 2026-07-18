"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

const publicBasePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

type Customer = {
  id: string;
  probability: number;
  revenue: string;
  trend: number[];
  monthlySignals: {
    shipments: number[];
    complaints: number[];
    lateRate: number[];
    nonCompletedRate: number[];
    avgValue: number[];
    serviceTypes: number[];
  };
  segment: string;
  region: string;
  activeMonths: number;
  itemsInWindow: number;
  serviceTypes: number;
  reasons: {
    code: string;
    text: string;
    metric: string;
    baseline: string;
    delta: string;
    severity: "High" | "Medium";
  }[];
};

const customers: Customer[] = [
  {
    id: "SYN-LG-0412",
    probability: 0.86,
    revenue: "₫18.4m",
    trend: [82, 75, 51, 46, 39, 24],
    monthlySignals: {
      shipments: [82, 75, 51, 46, 39, 24],
      complaints: [1, 2, 3, 3, 3, 5],
      lateRate: [4.1, 4.4, 4.8, 5.2, 6.4, 8.9],
      nonCompletedRate: [3.1, 4.0, 4.7, 5.1, 4.9, 8.2],
      avgValue: [94, 93, 91, 88, 82, 74],
      serviceTypes: [5, 5, 5, 4, 4, 4],
    },
    segment: "Marketplace seller",
    region: "North",
    activeMonths: 6,
    itemsInWindow: 317,
    serviceTypes: 4,
    reasons: [
      { code: "item_drop", text: "Current shipment volume is 47% below the previous three-month average", metric: "24 shipments", baseline: "45.3 shipments", delta: "−47%", severity: "High" },
      { code: "nodone_rate_increase", text: "Non-completed delivery rate increased 67% versus the previous three-month average", metric: "8.2%", baseline: "4.9%", delta: "+67%", severity: "High" },
      { code: "complaint_increase", text: "Customer complaints increased 67% versus the previous three-month average", metric: "5 complaints", baseline: "3.0 complaints", delta: "+67%", severity: "Medium" },
    ],
  },
  {
    id: "SYN-LG-1865",
    probability: 0.79,
    revenue: "₫12.7m",
    trend: [70, 73, 66, 55, 42, 31],
    monthlySignals: {
      shipments: [70, 73, 66, 55, 42, 31],
      complaints: [1, 1, 2, 2, 2, 3],
      lateRate: [3.8, 4.1, 4.0, 4.8, 5.2, 6.1],
      nonCompletedRate: [2.7, 2.9, 3.1, 3.4, 3.8, 4.5],
      avgValue: [103, 101, 98, 95, 83, 71],
      serviceTypes: [5, 5, 5, 4, 4, 3],
    },
    segment: "Retail chain",
    region: "Central",
    activeMonths: 4,
    itemsInWindow: 391,
    serviceTypes: 3,
    reasons: [
      { code: "order_value_drop", text: "Average order value declined 23% over time", metric: "₫71k / item", baseline: "₫92k / item", delta: "−23%", severity: "High" },
      { code: "service_diversity_drop", text: "Service diversity decreased from five to three service types", metric: "3 types", baseline: "5 types", delta: "−40%", severity: "Medium" },
      { code: "low_tenure", text: "New customer with low engagement tenure (four months)", metric: "4 months", baseline: "6-month mark", delta: "−2 mo.", severity: "Medium" },
    ],
  },
  {
    id: "SYN-LG-2308",
    probability: 0.72,
    revenue: "₫9.8m",
    trend: [5, 160, 58, 55, 48, 29],
    monthlySignals: {
      shipments: [5, 160, 58, 55, 48, 29],
      complaints: [1, 2, 1, 3, 3, 4],
      lateRate: [4.6, 5.0, 5.8, 6.9, 9.8, 12.4],
      nonCompletedRate: [3.0, 3.4, 3.2, 4.1, 5.7, 6.8],
      avgValue: [89, 92, 85, 90, 79, 76],
      serviceTypes: [5, 5, 5, 5, 5, 5],
    },
    segment: "Social commerce",
    region: "South",
    activeMonths: 6,
    itemsInWindow: 355,
    serviceTypes: 5,
    reasons: [
      { code: "item_drop", text: "Current shipment volume is 46% below the previous three-month average", metric: "29 shipments", baseline: "53.7 shipments", delta: "−46%", severity: "High" },
      { code: "delay_rate_increase", text: "Late-delivery rate increased 65% versus the previous three-month average", metric: "12.4%", baseline: "7.5%", delta: "+65%", severity: "High" },
      { code: "volume_volatility", text: "Shipment-volume volatility is high (CV = 0.84)", metric: "CV 0.84", baseline: "Alert at 0.70", delta: "+20%", severity: "Medium" },
    ],
  },
  {
    id: "SYN-LG-3174",
    probability: 0.63,
    revenue: "₫15.1m",
    trend: [78, 69, 72, 61, 54, 44],
    monthlySignals: {
      shipments: [78, 69, 72, 61, 54, 44],
      complaints: [2, 2, 3, 3, 4, 6],
      lateRate: [5.1, 5.0, 5.8, 6.0, 6.8, 7.4],
      nonCompletedRate: [3.8, 3.5, 4.1, 4.3, 4.9, 5.4],
      avgValue: [112, 109, 105, 104, 106, 86],
      serviceTypes: [4, 4, 4, 4, 3, 2],
    },
    segment: "Wholesale",
    region: "North",
    activeMonths: 6,
    itemsInWindow: 419,
    serviceTypes: 2,
    reasons: [
      { code: "complaint_increase", text: "Customer complaints increased 80% versus the previous three-month average", metric: "6.0 complaints", baseline: "3.3 complaints", delta: "+80%", severity: "High" },
      { code: "order_value_drop", text: "Average order value declined 18% over time", metric: "₫86k / item", baseline: "₫105k / item", delta: "−18%", severity: "Medium" },
      { code: "service_diversity_drop", text: "Service diversity decreased from four to two service types", metric: "2 types", baseline: "4 types", delta: "−50%", severity: "Medium" },
    ],
  },
  {
    id: "SYN-LG-4091",
    probability: 0.48,
    revenue: "₫7.3m",
    trend: [1, 135, 59, 49, 43, 38],
    monthlySignals: {
      shipments: [1, 135, 59, 49, 43, 38],
      complaints: [1, 1, 2, 2, 2, 3],
      lateRate: [4.2, 4.0, 4.8, 5.2, 5.8, 6.3],
      nonCompletedRate: [3.6, 4.1, 5.2, 5.0, 6.0, 7.8],
      avgValue: [84, 82, 86, 79, 77, 73],
      serviceTypes: [4, 4, 4, 4, 4, 4],
    },
    segment: "SME retailer",
    region: "Central",
    activeMonths: 5,
    itemsInWindow: 325,
    serviceTypes: 4,
    reasons: [
      { code: "nodone_rate_increase", text: "Non-completed delivery rate increased 44% versus the previous three-month average", metric: "7.8%", baseline: "5.4%", delta: "+44%", severity: "High" },
      { code: "volume_volatility", text: "Shipment-volume volatility is high (CV = 0.78)", metric: "CV 0.78", baseline: "Alert at 0.70", delta: "+11%", severity: "Medium" },
      { code: "low_tenure", text: "New customer with low engagement tenure (five months)", metric: "5 months", baseline: "6-month mark", delta: "−1 mo.", severity: "Medium" },
    ],
  },
  {
    id: "SYN-LG-5220",
    probability: 0.38,
    revenue: "₫6.1m",
    trend: [48, 44, 47, 42, 40, 36],
    monthlySignals: {
      shipments: [48, 44, 47, 42, 40, 36],
      complaints: [1, 1, 1, 2, 2, 2],
      lateRate: [5.8, 6.3, 6.7, 7.0, 8.2, 9.4],
      nonCompletedRate: [3.9, 4.0, 4.4, 4.8, 5.2, 5.6],
      avgValue: [91, 89, 86, 85, 87, 74],
      serviceTypes: [4, 4, 4, 4, 4, 3],
    },
    segment: "Online merchant",
    region: "South",
    activeMonths: 4,
    itemsInWindow: 201,
    serviceTypes: 3,
    reasons: [
      { code: "delay_rate_increase", text: "Late-delivery rate increased 29% versus the previous three-month average", metric: "9.4%", baseline: "7.3%", delta: "+29%", severity: "High" },
      { code: "order_value_drop", text: "Average order value declined 14% over time", metric: "₫74k / item", baseline: "₫86k / item", delta: "−14%", severity: "Medium" },
      { code: "service_diversity_drop", text: "Service diversity decreased from four to three service types", metric: "3 types", baseline: "4 types", delta: "−25%", severity: "Medium" },
    ],
  },
];

const sourceSystems = [
  ["01", "Monthly orders", "bccp_orderitem_YYMM", "Partitioned by reporting month"],
  ["02", "Customer master", "cas_customer", "Continuously refreshed snapshot"],
  ["03", "Customer profile", "cas_info", "Continuously refreshed snapshot"],
  ["04", "Complaints", "cms_complaint", "Continuously refreshed snapshot"],
];

const developmentSteps = [
  ["01", "Frame", "Define churn, the two-month prediction horizon and leakage-safe observation windows."],
  ["02", "Baseline", "Establish an interpretable Logistic Regression benchmark before increasing model complexity."],
  ["03", "Validate", "Use purged walk-forward folds so training observations cannot leak into future evaluation periods."],
  ["04", "Tune", "Move from a broad random search to Optuna/TPE for efficient XGBoost hyperparameter exploration."],
  ["05", "Hold out", "Reserve the final time period as a one-time approximation of the next production run."],
  ["06", "Operationalize", "Translate scores into probability- or capacity-based queues with customer-level reasons."],
];

const demoPopulationScores = [
  0.86, 0.79, 0.72, 0.63, 0.48, 0.38, 0.34, 0.31,
  0.29, 0.27, 0.25, 0.23, 0.21, 0.20, 0.18, 0.17,
  0.15, 0.14, 0.12, 0.10, 0.09, 0.08, 0.06, 0.05,
];

const runStages = [
  ["01", "Load", "Monthly window + customer snapshot"],
  ["02", "Gate", "Active and churn-eligible only"],
  ["03", "Score", "XGBoost probability + percentile"],
  ["04", "Explain", "SHAP mapped to eight reason buckets"],
  ["05", "Export", "CRM-ready risk profiles"],
];

type SignalMetric = keyof Customer["monthlySignals"];

const signalOptions: { key: SignalMetric; label: string; unit: string }[] = [
  { key: "shipments", label: "Shipments", unit: "items" },
  { key: "complaints", label: "Complaints", unit: "cases" },
  { key: "lateRate", label: "Late rate", unit: "%" },
  { key: "nonCompletedRate", label: "Not completed", unit: "%" },
  { key: "avgValue", label: "Avg. value", unit: "₫000 / item" },
  { key: "serviceTypes", label: "Service types", unit: "types" },
];

const monitoringMonths = [
  { key: "2412", label: "Dec 24", p50: 15, p90: 52, p99: 78, riskRatio: 12 },
  { key: "2501", label: "Jan 25", p50: 17, p90: 55, p99: 80, riskRatio: 13 },
  { key: "2502", label: "Feb 25", p50: 18, p90: 59, p99: 81, riskRatio: 14 },
  { key: "2503", label: "Mar 25", p50: 20, p90: 62, p99: 82, riskRatio: 16 },
  { key: "2504", label: "Apr 25", p50: 21, p90: 65, p99: 83, riskRatio: 17 },
  { key: "2505", label: "May 25", p50: 22, p90: 69, p99: 84, riskRatio: 25 },
];

const featureDrift = [
  { name: "item_last", values: [0.05, 0.06, 0.07, 0.09, 0.12, 0.23] },
  { name: "revenue_last", values: [0.04, 0.05, 0.06, 0.08, 0.11, 0.16] },
  { name: "complaint_last", values: [0.03, 0.04, 0.06, 0.08, 0.13, 0.21] },
  { name: "delay_last", values: [0.02, 0.04, 0.05, 0.07, 0.09, 0.13] },
  { name: "nodone_last", values: [0.05, 0.05, 0.07, 0.10, 0.14, 0.19] },
  { name: "service_types", values: [0.03, 0.03, 0.04, 0.05, 0.06, 0.08] },
];

function psiStatus(value: number) {
  if (value > 0.2) return "ALERT";
  if (value > 0.1) return "WARN";
  return "OK";
}

function actionPlan(customer: Customer) {
  const codes = new Set(customer.reasons.map((reason) => reason.code));
  if (["complaint_increase", "delay_rate_increase", "nodone_rate_increase"].some((code) => codes.has(code))) {
    return {
      route: "Service recovery before outreach",
      owner: "Operations + account owner",
      next: "Review open complaints and recent failed or late deliveries; resolve service context before a retention call.",
      evidence: "Complaint, late-delivery and completion history",
    };
  }
  if (codes.has("service_diversity_drop")) {
    return {
      route: "Account review + service consultation",
      owner: "Account management",
      next: "Validate the service-mix contraction and discuss whether an alternative logistics service fits the account.",
      evidence: "Service mix, volume and average order value",
    };
  }
  if (codes.has("low_tenure")) {
    return {
      route: "Early-life onboarding follow-up",
      owner: "Customer success",
      next: "Check onboarding friction, confirm expected shipping pattern and schedule a guided follow-up.",
      evidence: "Tenure, activation and first-month usage",
    };
  }
  return {
    route: "Retention account review",
    owner: "Account management",
    next: "Validate the volume or value decline, review commercial context and prioritize a retention conversation.",
    evidence: "Shipment volume, revenue and order-value trend",
  };
}

function Bars({ values }: { values: number[] }) {
  return (
    <span className="mini-bars" aria-label={`Activity trend: ${values.join(", ")}`}>
      {values.map((value, index) => (
        <i key={index} style={{ height: `${Math.max(value, 16)}%` }} />
      ))}
    </span>
  );
}

export default function Home() {
  const [policy, setPolicy] = useState<"probability" | "percentile">("probability");
  const [threshold, setThreshold] = useState(35);
  const [percentile, setPercentile] = useState(90);
  const [regionFilter, setRegionFilter] = useState<"All" | "North" | "Central" | "South">("All");
  const [selectedId, setSelectedId] = useState(customers[0].id);
  const [signalMetric, setSignalMetric] = useState<SignalMetric>("shipments");
  const [monitoringMonth, setMonitoringMonth] = useState(5);
  const [actionStep, setActionStep] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);

  const riskFlagCount = useMemo(
    () => policy === "probability"
      ? demoPopulationScores.filter((score) => score * 100 >= threshold).length
      : Math.max(1, Math.ceil(demoPopulationScores.length * (100 - percentile) / 100)),
    [policy, threshold, percentile],
  );
  const policyCustomers = useMemo(
    () => policy === "probability"
      ? customers.filter((customer) => customer.probability * 100 >= threshold)
      : customers.slice(0, Math.min(customers.length, riskFlagCount)),
    [policy, threshold, riskFlagCount],
  );
  const visibleCustomers = useMemo(
    () => regionFilter === "All" ? policyCustomers : policyCustomers.filter((customer) => customer.region === regionFilter),
    [policyCustomers, regionFilter],
  );
  const selected = visibleCustomers.find((customer) => customer.id === selectedId) ?? visibleCustomers[0] ?? customers[0];
  const selectedSignal = selected.monthlySignals[signalMetric];
  const selectedSignalMax = Math.max(...selectedSignal, 1);
  const selectedSignalMeta = signalOptions.find((option) => option.key === signalMetric) ?? signalOptions[0];
  const selectedAction = actionPlan(selected);
  const monitoringSeries = monitoringMonths.map((month, index) => (
    index === monitoringMonths.length - 1
      ? { ...month, riskRatio: Math.round(riskFlagCount / demoPopulationScores.length * 100) }
      : month
  ));
  const currentMonitoring = monitoringSeries[monitoringMonth];

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Back to top">
          <span className="brand-mark">CP</span>
          <span>Churn / Decision Lab</span>
        </a>
        <button className="menu-button" onClick={() => setMenuOpen(!menuOpen)} aria-expanded={menuOpen} aria-label="Toggle navigation">Menu</button>
        <nav className={menuOpen ? "nav-open" : ""} aria-label="Main navigation">
          <a href="#problem" onClick={() => setMenuOpen(false)}>Problem</a>
          <a href="#method" onClick={() => setMenuOpen(false)}>Method</a>
          <a href="#decision-lab" onClick={() => setMenuOpen(false)}>Decision lab</a>
          <Link href="/case-study" onClick={() => setMenuOpen(false)}>Case study</Link>
          <a href="#ownership" onClick={() => setMenuOpen(false)}>Ownership</a>
        </nav>
        <a className="nav-cta" href="#decision-lab">Explore the queue <span>↘</span></a>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow"><span /> Logistics · Data science case study</p>
          <h1>Predict churn.<br /><em>Prioritize action.</em></h1>
          <p className="hero-lede">A production-oriented system that identifies customers at risk of leaving two months ahead, explains the behavioral signals, and generates a workable intervention queue.</p>
          <div className="hero-actions">
            <a className="button primary" href="#decision-lab">Open decision lab <span>→</span></a>
            <Link className="button secondary" href="/case-study">Read full case study</Link>
          </div>
          <div className="hero-stats" aria-label="Project facts">
            <div><strong>2 mo.</strong><span>prediction horizon</span></div>
            <div><strong>200+</strong><span>engineered signals</span></div>
            <div><strong>≈7k</strong><span>leads per run</span></div>
            <div><strong>4</strong><span>source systems</span></div>
          </div>
        </div>

        <div className="hero-console" aria-label="Synthetic risk queue preview">
          <div className="console-head">
            <div><span className="live-dot" /> Operational preview</div>
            <span>Illustrative</span>
          </div>
          <div className="console-title">
            <div><p>Intervention queue</p><h2>Top risk accounts</h2></div>
            <span className="period-chip">T + 2 months</span>
          </div>
          <div className="queue-head"><span>Customer</span><span>Signal</span><span>Risk</span></div>
          {customers.slice(0, 4).map((customer, index) => (
            <div className="preview-row" key={customer.id}>
              <span className="rank">0{index + 1}</span>
              <span><strong>{customer.id}</strong><small>{customer.segment}</small></span>
              <Bars values={customer.trend} />
              <strong className="risk-value">{Math.round(customer.probability * 100)}%</strong>
            </div>
          ))}
          <div className="console-foot"><span>Ranked by predicted probability</span><span>Explainable export ready ↗</span></div>
        </div>
      </section>

      <aside className="disclosure" aria-label="Data disclosure">
        <strong>Portfolio-safe edition.</strong>
        <p>All customer records shown here are synthetic. Production performance and verified business impact are intentionally reserved for a validated update.</p>
        <span>NO PRODUCTION DATA</span>
      </aside>

      <section className="section problem" id="problem">
        <div className="section-label">01 / Business &amp; data</div>
        <div className="section-intro split-intro">
          <h2>From a score to an<br /><em>intervention decision.</em></h2>
          <div>
            <p>The useful question was not simply “who might churn?” It was: which customers should an operations team contact first, why are they at risk, and how can the list fit a real intervention capacity?</p>
            <div className="question-grid">
              <span><b>WHO</b> is at risk?</span><span><b>WHEN</b> might they leave?</span>
              <span><b>WHY</b> did the score rise?</span><span><b>WHAT</b> fits capacity?</span>
            </div>
          </div>
        </div>

        <div className="source-grid">
          {sourceSystems.map(([number, title, table, note]) => (
            <article className="source-card" key={number}>
              <span className="source-number">{number}</span>
              <p>{title}</p>
              <code>{table}</code>
              <small>{note}</small>
            </article>
          ))}
        </div>

        <div className="pipeline" aria-label="System workflow">
          <div><span>01</span><strong>Ingest</strong><small>Monthly + snapshots</small></div>
          <i>→</i>
          <div><span>02</span><strong>Build signals</strong><small>Lifetime + temporal</small></div>
          <i>→</i>
          <div><span>03</span><strong>Train &amp; score</strong><small>Leakage-safe design</small></div>
          <i>→</i>
          <div><span>04</span><strong>Explain</strong><small>SHAP + business rules</small></div>
          <i>→</i>
          <div><span>05</span><strong>Intervene</strong><small>Ranked customer queue</small></div>
        </div>
      </section>

      <section className="section method" id="method">
        <div className="section-label light">02 / Model development</div>
        <div className="section-intro method-intro">
          <div><p className="eyebrow mint"><span /> Evaluation philosophy</p><h2>Time-aware by design.<br /><em>Honest by default.</em></h2></div>
          <p>Random train/test splits can make churn models look better than they will behave in production. This workflow respects time, purges overlapping windows and keeps a final period untouched until model selection is complete.</p>
        </div>

        <div className="method-layout">
          <div className="timeline">
            {developmentSteps.map(([number, title, description]) => (
              <article key={number}>
                <span>{number}</span><div><h3>{title}</h3><p>{description}</p></div>
              </article>
            ))}
          </div>
          <aside className="validation-card">
            <div className="card-kicker">PURGED WALK-FORWARD</div>
            <h3>Validate as the system will run</h3>
            <div className="folds" aria-label="Illustration of walk-forward validation folds">
              <div><span>Fold 01</span><i className="train w3" /><i className="gap" /><i className="valid" /></div>
              <div><span>Fold 02</span><i className="train w4" /><i className="gap" /><i className="valid" /></div>
              <div><span>Fold 03</span><i className="train w5" /><i className="gap" /><i className="valid" /></div>
              <div><span>Holdout</span><i className="train w6" /><i className="holdout" /></div>
            </div>
            <div className="legend"><span><i className="train" />Train</span><span><i className="gap" />Purge</span><span><i className="valid" />Validate</span><span><i className="holdout" />Final</span></div>
            <div className="metric-placeholder"><span>Validated model metrics</span><strong>Pending update</strong><small>To be populated from an approved production run.</small></div>
          </aside>
        </div>
      </section>

      <section className="section lab" id="decision-lab">
        <div className="section-label">03 / Intervention queue</div>
        <div className="section-intro lab-intro">
          <div><p className="eyebrow"><span /> Interactive synthetic demo</p><h2>Turn predictions into<br /><em>a contact strategy.</em></h2></div>
          <p>Switch the operating policy, adjust the probability threshold and select a synthetic customer to see how model evidence becomes an actionable explanation.</p>
        </div>

        <div className="lab-shell">
          <div className="run-purpose">
            <div><span>THE DECISION, NOT JUST THE SCORE</span><h3>Simulate one monthly scoring run</h3></div>
            <p>The system first removes inactive or ineligible customers, then scores the remaining cohort, applies an operating policy, maps positive SHAP evidence to business reasons and exports only intervention-ready profiles.</p>
            <span className="synthetic-chip">Synthetic run</span>
          </div>

          <div className="run-stages" aria-label="Export risk mode workflow">
            {runStages.map(([number, title, detail]) => (
              <div key={number}><span>{number}</span><strong>{title}</strong><small>{detail}</small></div>
            ))}
          </div>

          <div className="run-dashboard">
            <div className="run-config">
              <div className="run-card-title"><span>RUN CONFIGURATION</span><strong>Scoring origin 2505</strong><small>Illustrative month · no production records</small></div>
              <dl className="config-facts">
                <div><dt>Observation window</dt><dd>Mar–May 2025</dd></div>
                <div><dt>Prediction period</dt><dd>Jun–Jul 2025</dd></div>
                <div><dt>Model bundle</dt><dd>Selected XGBoost</dd></div>
                <div><dt>Intervention cap</dt><dd>7,000 profiles</dd></div>
              </dl>
              <div className="control-block policy-control">
                <label>Operating decision mode</label>
                <div className="segmented">
                  <button className={policy === "probability" ? "active" : ""} onClick={() => setPolicy("probability")}>Probability</button>
                  <button className={policy === "percentile" ? "active" : ""} onClick={() => setPolicy("percentile")}>Score percentile</button>
                </div>
              </div>
              {policy === "probability" ? (
                <div className="control-block range-block">
                  <label htmlFor="threshold">Flag when probability ≥ <strong>{threshold}%</strong></label>
                  <input id="threshold" type="range" min="30" max="80" value={threshold} onChange={(event) => setThreshold(Number(event.target.value))} />
                  <div><span>30%</span><span>80%</span></div>
                </div>
              ) : (
                <div className="control-block range-block">
                  <label htmlFor="percentile">Keep customers at or above <strong>P{percentile}</strong></label>
                  <input id="percentile" type="range" min="60" max="95" step="5" value={percentile} onChange={(event) => setPercentile(Number(event.target.value))} />
                  <div><span>P60</span><span>P95</span></div>
                </div>
              )}
              <div className="policy-readout" aria-live="polite">
                <span>{policy === "probability" ? "FIXED DECISION BOUNDARY" : "CAPACITY-STYLE RANKING"}</span>
                <strong>{riskFlagCount} of 24 eligible profiles are flagged</strong>
                <p>{policy === "probability"
                  ? `Scores stay unchanged. The slider only moves the cutoff to probability ≥ ${threshold}%.`
                  : `The cohort is sorted by score and the preview keeps the top ${100 - percentile}% at or above P${percentile}.`}</p>
              </div>
            </div>

            <div className="cohort-funnel">
              <div className="run-card-title"><span>COHORT GATES</span><strong>Who reaches the CRM queue?</strong><small>Counts below describe the 30-record synthetic cohort</small></div>
              <div className="funnel-row"><span>01</span><div><strong>Monthly feature rows</strong><small>Staged scoring population</small></div><i style={{ width: "100%" }} /><b>30</b></div>
              <div className="funnel-row"><span>02</span><div><strong>Active now</strong><small>Current item or revenue activity</small></div><i style={{ width: "90%" }} /><b>27</b></div>
              <div className="funnel-row"><span>03</span><div><strong>Churn eligible</strong><small>Activity-window and volume rules</small></div><i style={{ width: "80%" }} /><b>24</b></div>
              <div className="funnel-row flagged"><span>04</span><div><strong>Risk flag = 1</strong><small>{policy === "probability" ? `Probability ≥ ${threshold}%` : `Score percentile ≥ P${percentile}`}</small></div><i style={{ width: `${Math.max(9, riskFlagCount / 30 * 100)}%` }} /><b>{riskFlagCount}</b></div>
              <div className="funnel-row exported"><span>05</span><div><strong>Exported profiles</strong><small>After the 7,000-profile cap</small></div><i style={{ width: `${Math.max(9, Math.min(riskFlagCount, 7000) / 30 * 100)}%` }} /><b>{Math.min(riskFlagCount, 7000)}</b></div>
              <p><strong>Production behavior:</strong> every exported row must be active, eligible, risk-flagged and accompanied by up to three structured reasons.</p>
            </div>

            <div className="score-audit">
              <div className="run-card-title"><span>RUN AUDIT</span><strong>Score distribution</strong><small>Stored for drift monitoring by scoring origin</small></div>
              <div className="score-stats"><span><small>P50</small><strong>22%</strong></span><span><small>P90</small><strong>69%</strong></span><span><small>P99</small><strong>84%</strong></span></div>
              <div className="distribution-mini" aria-label="Synthetic churn score distribution">
                {demoPopulationScores.slice().reverse().map((score, index) => <i key={index} style={{ height: `${Math.max(7, score * 100)}%` }} />)}
              </div>
              <div className="audit-checks"><span><i />Schema aligned</span><span><i />Reasons populated</span><span><i />Queue below cap</span></div>
              <p>Monitoring stores active count, risk count, risk ratio and score quantiles; unusually high risk ratios are checked against historical median + 3 MAD.</p>
            </div>
          </div>

          <div className="queue-toolbar">
            <div><span>INTERVENTION WORKSPACE</span><h3>Inspect the ranked queue and customer dossier</h3></div>
            <label>Region
              <select value={regionFilter} onChange={(event) => setRegionFilter(event.target.value as "All" | "North" | "Central" | "South")}>
                <option>All</option><option>North</option><option>Central</option><option>South</option>
              </select>
            </label>
            <div className="preview-count"><strong>{visibleCustomers.length}</strong><span>representative rows<br />in this preview</span></div>
          </div>

          <div className="lab-grid">
            <div className="full-queue">
              <div className="table-title"><div><span>RISK_FLAG = 1 ONLY</span><h3>Customer risk queue</h3></div><span className="synthetic-chip">Sorted high → low</span></div>
              <div className="table-header"><span>Rank / account</span><span>6M activity</span><span>Revenue</span><span>Probability</span></div>
              <div className="table-body">
                {visibleCustomers.map((customer, index) => (
                  <button className={`customer-row ${selected.id === customer.id ? "selected" : ""}`} key={customer.id} onClick={() => setSelectedId(customer.id)}>
                    <span className="customer-main"><i>{String(index + 1).padStart(2, "0")}</i><span><strong>{customer.id}</strong><small>{customer.segment} · {customer.region}</small></span></span>
                    <Bars values={customer.trend} />
                    <span className="revenue">{customer.revenue}</span>
                    <span className="score"><i style={{ width: `${customer.probability * 100}%` }} /><strong>{Math.round(customer.probability * 100)}%</strong></span>
                  </button>
                ))}
                {visibleCustomers.length === 0 && <div className="empty-state">No representative dossier matches this policy and region. Lower the cutoff or clear the region filter.</div>}
              </div>
            </div>

            <aside className="explanation">
              <div className="explanation-head"><span>CUSTOMER DOSSIER</span><strong>{selected.id}</strong><small>{selected.segment} · {selected.region}</small></div>
              <div className="dossier-facts"><span><small>Eligibility</small><b>Eligible</b></span><span><small>Active months</small><b>{selected.activeMonths} / 6</b></span><span><small>Window volume</small><b>{selected.itemsInWindow}</b></span><span><small>Services</small><b>{selected.serviceTypes}</b></span></div>
              <div className="explanation-score"><div><span>Churn probability</span><strong>{Math.round(selected.probability * 100)}%</strong></div><div className="score-track"><i style={{ width: `${selected.probability * 100}%` }} /></div><small>risk_flag = 1 · prediction horizon: two months</small></div>
              <div className="signal-explorer">
                <div className="signal-tabs" aria-label="Select customer time-series signal">
                  {signalOptions.map((option) => (
                    <button key={option.key} className={signalMetric === option.key ? "active" : ""} onClick={() => setSignalMetric(option.key)}>{option.label}</button>
                  ))}
                </div>
                <div className="activity-window">
                  <div><span>{selectedSignalMeta.label.toUpperCase()}</span><small>Six monthly snapshots · {selectedSignalMeta.unit}</small></div>
                  <div>{selectedSignal.map((value, index) => <span key={index}><b>{value}</b><i style={{ height: `${Math.max(8, value / selectedSignalMax * 100)}%` }} /><small>{index === selectedSignal.length - 1 ? "Now" : `M-${selectedSignal.length - index - 1}`}</small></span>)}</div>
                </div>
                <p className="time-series-note">Longitudinal synthetic data: the latest month is compared with the previous three-month baseline. It mirrors the temporal calculation shape, not the unknown production distribution. <a href={`${publicBasePath}/synthetic_monthly_behavior.csv`} download>Download the 30 × 6 cohort ↓</a></p>
              </div>
              <div className="reason-title"><span>TOP THREE REASONS</span><small>Positive SHAP buckets · business-rule evidence</small></div>
              <ol className="reasons">
                {selected.reasons.map((reason, index) => (
                  <li key={reason.code}>
                    <span>0{index + 1}</span>
                    <div className="reason-content">
                      <div className="reason-meta"><code>{reason.code}</code><em className={reason.severity.toLowerCase()}>{reason.severity}</em></div>
                      <strong className="reason-text">{reason.text}</strong>
                      <div className="reason-evidence"><span><small>Current metric</small><b>{reason.metric}</b></span><span><small>3M baseline</small><b>{reason.baseline}</b></span><span><small>Change</small><b>{reason.delta}</b></span></div>
                    </div>
                  </li>
                ))}
              </ol>
              <div className="recommended-action"><span>Decision boundary</span><p>The model ranks and explains this account. A human reviewer validates service and commercial context before any contact decision.</p></div>
            </aside>
          </div>

          <div className="action-workspace">
            <div className="action-heading">
              <div><span>TAKE ACTION</span><h3>Convert one risk profile into a controlled intervention</h3><p>The recommendation changes with the selected account’s reason codes; the workflow below is a portfolio integration layer, not an automated decision.</p></div>
              <span className="human-chip">Human review required</span>
            </div>
            <div className="action-grid">
              <section className="action-recommendation">
                <span>RECOMMENDED ROUTE</span>
                <h4>{selectedAction.route}</h4>
                <dl>
                  <div><dt>Account</dt><dd>{selected.id}</dd></div>
                  <div><dt>Suggested owner</dt><dd>{selectedAction.owner}</dd></div>
                  <div><dt>Evidence to review</dt><dd>{selectedAction.evidence}</dd></div>
                  <div><dt>Priority basis</dt><dd>Queue rank + structured reasons</dd></div>
                </dl>
                <p><strong>Next step:</strong> {selectedAction.next}</p>
              </section>
              <section className="action-flow">
                <span>DEMO WORKFLOW</span>
                <h4>Record the handoff, not just the prediction</h4>
                <div className="action-steps">
                  {["Queued", "Context reviewed", "Assigned", "Contacted", "Outcome logged"].map((step, index) => (
                    <button key={step} className={index <= actionStep ? "complete" : ""} onClick={() => setActionStep(index)}><i>{String(index + 1).padStart(2, "0")}</i><span>{step}</span></button>
                  ))}
                </div>
                <p>Click a stage to simulate status. This UI does not write to a CRM or contact a customer.</p>
              </section>
              <section className="output-boundary">
                <span>OUTPUT BOUNDARY</span>
                <div>
                  <article><b>Implemented in current code</b><p>Risk CSV, probability, prediction period, recent metrics and up to three reason records with code, metric, baseline, delta and severity.</p></article>
                  <article><b>Proposed CRM integration</b><p><code>action_owner</code>, <code>action_status</code>, <code>contacted_at</code>, <code>outcome</code> and <code>retained_after_horizon</code> for intervention measurement.</p></article>
                </div>
              </section>
            </div>
          </div>

          <div className="export-contract">
            <div className="export-heading"><div><span>FINAL SYSTEM OUTPUT</span><h3>CRM-ready CSV contract</h3><p>The downloadable sample mirrors the production export shape while using synthetic identifiers and values.</p></div><a href={`${publicBasePath}/synthetic_risk_export.csv`} download>Download synthetic CSV <span>↓</span></a></div>
            <div className="field-groups">
              <div><span>IDENTITY &amp; TIME</span><code>cms_code_enc</code><code>window_end</code><code>predict_period</code><code>updated_at</code></div>
              <div><span>RECENT BEHAVIOR</span><code>item_last</code><code>revenue_last</code><code>complaint_last</code><code>delay_last</code><code>nodone_last</code></div>
              <div><span>MODEL OUTPUT</span><code>churn_rate</code><code>model_probability_pct</code></div>
              <div><span>STRUCTURED REASONS × 3</span><code>reason_n</code><code>reason_n_code</code><code>metric · baseline · delta</code><code>delta_pct · severity</code></div>
            </div>
            <div className="export-row"><span><small>cms_code_enc</small><b>{selected.id}</b></span><span><small>window_end</small><b>2505</b></span><span><small>predict_period</small><b>2507</b></span><span><small>model_probability_pct</small><b>{Math.round(selected.probability * 100)}.0</b></span><span><small>reason_1_code</small><b>{selected.reasons[0].code}</b></span><span><small>reason_1_delta_pct</small><b>{selected.reasons[0].delta}</b></span></div>
          </div>
        </div>
      </section>

      <section className="section monitoring">
        <div className="section-label">04 / Monitoring</div>
        <div className="section-intro monitoring-intro"><h2>Separate promotion<br /><em>from monitoring.</em></h2><p>The code first decides whether a candidate model is safe to promote. After an accepted bundle scores the month, score drift and feature drift are recorded by scoring origin. These are related controls, but they are not one generic “run acceptance” checklist.</p></div>

        <article className="promotion-logic">
          <div className="promotion-heading"><div><span>CODE-ALIGNED MODEL PROMOTION</span><h3>What can actually accept or reject a candidate?</h3></div><b>Logic reference · not a run result</b></div>
          <div className="gate-lanes">
            <section>
              <span>01 / CANDIDATE VALIDATION</span>
              <ul>
                <li><b>Walk-forward folds</b><p>Reject if all folds fail, the latest fold is invalid, or the rejected-fold rate exceeds 25%.</p></li>
                <li><b>Final temporal holdout</b><p>Required by default. Main F1 and operating F1 must each be at least 0.01; predicted-positive rate must be at least 0.1%.</p></li>
                <li><b>Sanity comparators</b><p>AP is checked against constant, random and two-feature Logistic Regression baselines. These produce warnings for investigation, not the monthly promotion rule.</p></li>
              </ul>
            </section>
            <section>
              <span>02 / MONTHLY PROMOTION</span>
              <ul>
                <li><b>Label prevalence</b><p>With a previous bundle available, candidate training prevalence above 45% blocks retraining.</p></li>
                <li><b>Month completeness</b><p>Versus the previous month: rows ≥80%, active customers ≥50%, items ≥70% and revenue ≥70%.</p></li>
                <li><b>Current-period comparison</b><p>The candidate F1 must beat the accepted bundle re-evaluated on the current period, plus the configured epsilon.</p></li>
                <li><b>Safe fallback</b><p>If promotion is rejected, the prior accepted model is retained and monthly scoring can continue.</p></li>
              </ul>
            </section>
          </div>
          <div className="promotion-notes"><span><b>First run:</b> accepted before these monthly comparison gates.</span><span><b>Mandatory 3-month cycle:</b> bypasses completeness/F1 comparison after the prevalence guard.</span><span><b>No real status shown:</b> current values are unavailable.</span></div>
        </article>

        <div className="monitoring-toolbar">
          <div><span>MONTHLY POST-SCORING MONITORING</span><h3>Select a scoring origin</h3></div>
          <div className="month-selector">
            {monitoringSeries.map((month, index) => <button key={month.key} className={monitoringMonth === index ? "active" : ""} onClick={() => setMonitoringMonth(index)}>{month.label}</button>)}
          </div>
        </div>

        <div className="monitor-system">
          <article className="score-drift-card">
            <span className="card-kicker">SCORE DRIFT BY MONTH</span><h3>Population shift is a time series</h3>
            <div className="risk-ratio-chart" aria-label="Illustrative monthly risk ratio">
              {monitoringSeries.map((month, index) => <button key={month.key} className={monitoringMonth === index ? "active" : ""} onClick={() => setMonitoringMonth(index)}><b>{month.riskRatio}%</b><i style={{ height: `${Math.max(12, month.riskRatio * 3)}%` }} /><small>{month.key}</small></button>)}
            </div>
            <div className="selected-score-stats"><span><small>Selected origin</small><b>{currentMonitoring.key}</b></span><span><small>P50</small><b>{currentMonitoring.p50}%</b></span><span><small>P90</small><b>{currentMonitoring.p90}%</b></span><span><small>P99</small><b>{currentMonitoring.p99}%</b></span><span><small>Risk ratio</small><b>{currentMonitoring.riskRatio}%</b></span></div>
            <p>The production monitor stores active count, risk count, risk ratio and P50/P90/P99. A high risk ratio is flagged against the previous six runs using median + 3 MAD once enough history exists.</p>
            <em>Demo behavior: changing the operating cutoff updates May’s risk ratio, but not its score quantiles—the model scores themselves did not change.</em>
          </article>

          <article className="feature-drift-card">
            <span className="card-kicker">FEATURE DRIFT · {currentMonitoring.key}</span><h3>PSI against the training profile</h3>
            <div className="drift-table">
              <div><span>Feature</span><span>PSI</span><span>State</span></div>
              {featureDrift.map((feature) => {
                const value = feature.values[monitoringMonth];
                const state = psiStatus(value);
                return <div key={feature.name}><code>{feature.name}</code><b>{value.toFixed(2)}</b><em className={state.toLowerCase()}>{state}</em></div>;
              })}
            </div>
            <div className="drift-legend"><span><i className="ok" />OK ≤ 0.10</span><span><i className="warn" />WARN &gt; 0.10</span><span><i className="alert" />ALERT &gt; 0.20</span></div>
            <p>PSI and discrete KS are calculated feature by feature. The table is synthetic, but its thresholds and monthly indexing match the monitoring code.</p>
          </article>

          <article className="impact-card"><span className="card-kicker">BUSINESS OUTCOME</span><h3>Impact measurement</h3><div className="pending-impact"><strong>Pending</strong><span>validated update</span></div><p>Intervention reach, retained customers and attributable revenue will be reported only after action outcomes and the two-month measurement window are available.</p></article>
        </div>
      </section>

      <section className="section ownership" id="ownership">
        <div className="section-label light">05 / Ownership</div>
        <div className="ownership-grid">
          <div><p className="eyebrow mint"><span /> Role: Data Scientist</p><h2>Built for decisions,<br /><em>not just a notebook.</em></h2></div>
          <div className="ownership-copy"><p>Owned problem formulation, label design, baseline and XGBoost modeling, temporal validation, hyperparameter tuning, threshold strategy, explainability, risk export, monitoring and production integration.</p><p>Collaborated with the data engineering team on feature definitions and generation.</p></div>
        </div>
        <div className="stack-row"><span>Python</span><span>XGBoost</span><span>Optuna</span><span>SHAP</span><span>PostgreSQL</span><span>Airflow</span><span>Docker</span></div>
        <div className="cv-block"><span>CV SUMMARY</span><p>Developed and productionized a two-month logistics churn model using XGBoost, purged walk-forward validation and final holdout evaluation, producing explainable intervention queues of approximately 7,000 high-risk customers per run.</p></div>
      </section>

      <footer><div><span className="brand-mark">CP</span><strong>Explainable Customer Churn Prioritization</strong></div><p><Link href="/case-study">Read full case study ↗</Link> · Synthetic demonstration data</p><a href="#top">Back to top ↑</a></footer>
    </main>
  );
}
