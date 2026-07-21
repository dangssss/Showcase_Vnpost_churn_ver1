"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import artifacts from "./notebook-artifacts.json";

const publicBasePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function monthLabel(yymm: number) {
  return `${MONTH_NAMES[(yymm % 100) - 1]} ${Math.floor(yymm / 100)}`;
}

const fmt = (value: number) => value.toLocaleString("en-US");
const pct = (value: number, digits = 1) => `${(value * 100).toFixed(digits)}%`;

const regionLabels: Record<string, string> = {
  BAC: "North",
  TRUNG: "Central",
  NAM: "South",
  NOI_HN: "Hanoi metro",
  NOI_HCM: "HCMC metro",
};

type RepCustomer = (typeof artifacts.customer_timeseries)[number];
type SignalKey = keyof RepCustomer["series"];

const signalOptions: { key: SignalKey; label: string; unit: string }[] = [
  { key: "item", label: "Parcel volume", unit: "items / month" },
  { key: "revenue", label: "Revenue", unit: "₫ / month" },
  { key: "complaint", label: "Complaints", unit: "cases / month" },
  { key: "delay", label: "Late deliveries", unit: "parcels / month" },
  { key: "nodone", label: "Failed deliveries", unit: "parcels / month" },
  { key: "order_score", label: "Order quality", unit: "score 0–12" },
  { key: "satisfaction", label: "Satisfaction", unit: "score 0–10" },
];

const riskBands: { label: string; ranks: number[]; note: string }[] = [
  { label: "Top of the queue", ranks: [1, 2, 3, 4, 5, 6], note: "Highest predicted probability" },
  { label: "Borderline", ranks: [357, 358], note: "Sitting on the decision threshold" },
  { label: "Low risk", ranks: [574, 575], note: "Scored low by the same model" },
];

const actionStages = [
  {
    label: "Queued",
    short: "Profile enters the review queue",
    status: "queued",
    eventField: "queued_at",
    description:
      "The scored profile is visible to the intervention team. It is prioritized, but no reviewer or account owner has accepted it yet.",
  },
  {
    label: "Context reviewed",
    short: "Operational evidence is validated",
    status: "context_reviewed",
    eventField: "reviewed_at",
    description:
      "A reviewer checks complaints, delivery quality and commercial context to confirm that outreach is appropriate.",
  },
  {
    label: "Assigned",
    short: "Case is handed to an owner",
    status: "assigned",
    eventField: "assigned_at",
    description:
      "The case is assigned to the suggested team. Ownership and the recommended route become part of the handoff record.",
  },
  {
    label: "Contacted",
    short: "Customer outreach is recorded",
    status: "contacted",
    eventField: "contacted_at",
    description:
      "A real CRM would record the outreach channel and contact time. This portfolio demo only previews that state change.",
  },
  {
    label: "Outcome logged",
    short: "Intervention result is captured",
    status: "outcome_logged",
    eventField: "outcome",
    description:
      "The immediate outcome is stored so retention can later be measured after the two-month prediction horizon.",
  },
];

const reasonCatalog = [
  ["item_drop", "Shipment volume below the previous three-month average"],
  ["complaint_increase", "Complaint count above the previous three-month average"],
  ["delay_rate_increase", "Late-delivery rate increased"],
  ["nodone_rate_increase", "Non-completed delivery rate increased"],
  ["volume_volatility", "High shipment-volume coefficient of variation"],
  ["order_value_drop", "Average order value declined"],
  ["service_diversity_drop", "The customer uses fewer service types"],
  ["low_tenure", "New customer with low engagement tenure"],
];

const monitoringMonths = [
  { key: "2603", label: "Mar 26", p50: 15, p90: 52, p99: 78, riskRatio: 12 },
  { key: "2604", label: "Apr 26", p50: 17, p90: 55, p99: 80, riskRatio: 13 },
  { key: "2605", label: "May 26", p50: 18, p90: 59, p99: 81, riskRatio: 14 },
  { key: "2606", label: "Jun 26", p50: 20, p90: 62, p99: 82, riskRatio: 16 },
  { key: "2607", label: "Jul 26", p50: 21, p90: 65, p99: 83, riskRatio: 17 },
  { key: "2608", label: "Aug 26", p50: 22, p90: 69, p99: 84, riskRatio: 25 },
];

const featureDrift = [
  { name: "item_t", label: "Current parcel volume", values: [0.05, 0.06, 0.07, 0.09, 0.12, 0.23] },
  { name: "revenue_t", label: "Current revenue", values: [0.04, 0.05, 0.06, 0.08, 0.11, 0.16] },
  { name: "complaint_t", label: "Complaint count", values: [0.03, 0.04, 0.06, 0.08, 0.13, 0.21] },
  { name: "pct_delay", label: "Late-delivery rate", values: [0.02, 0.04, 0.05, 0.07, 0.09, 0.13] },
  { name: "pct_noaccepted", label: "Failed-delivery rate", values: [0.05, 0.05, 0.07, 0.1, 0.14, 0.19] },
  { name: "service_types_used", label: "Service types used", values: [0.03, 0.03, 0.04, 0.05, 0.06, 0.08] },
];

function psiStatus(value: number) {
  if (value > 0.2) return "ALERT";
  if (value > 0.1) return "WARN";
  return "OK";
}

type DerivedSignal = {
  code: string;
  label: string;
  text: string;
  current: string;
  baseline: string;
  delta: string;
  severity: "High" | "Medium";
  weight: number;
};

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(xs.length, 1);

function deriveSignals(customer: RepCustomer): DerivedSignal[] {
  const t = customer.months.indexOf(customer.window_end);
  if (t < 3) return [];
  const s = customer.series;
  const out: DerivedSignal[] = [];

  const itemNow = s.item[t];
  const itemBase = mean(s.item.slice(t - 3, t));
  if (itemBase > 0 && itemNow <= itemBase * 0.85) {
    const change = (itemNow - itemBase) / itemBase;
    out.push({
      code: "item_drop",
      label: "Shipment volume drop",
      text: `Parcel volume is ${pct(Math.abs(change), 0)} below the previous three-month average`,
      current: `${fmt(itemNow)} items`,
      baseline: `${itemBase.toFixed(1)} items`,
      delta: `−${pct(Math.abs(change), 0)}`,
      severity: change <= -0.4 ? "High" : "Medium",
      weight: Math.abs(change) + 1,
    });
  }

  const compNow = s.complaint[t];
  const compBase = mean(s.complaint.slice(t - 3, t));
  if (compNow >= 2 && compNow > compBase) {
    const change = compBase > 0 ? (compNow - compBase) / compBase : 1;
    out.push({
      code: "complaint_increase",
      label: "Complaint escalation",
      text:
        compBase > 0
          ? `Complaints are ${pct(change, 0)} above the previous three-month average`
          : `${fmt(compNow)} complaints after a quiet three-month baseline`,
      current: `${fmt(compNow)} cases`,
      baseline: `${compBase.toFixed(1)} cases`,
      delta: `+${pct(change, 0)}`,
      severity: change >= 0.6 ? "High" : "Medium",
      weight: change,
    });
  }

  const rateAt = (num: number[], i: number) => num[i] / Math.max(s.item[i], 1);
  const delayNow = rateAt(s.delay, t);
  const delayBase = mean([rateAt(s.delay, t - 3), rateAt(s.delay, t - 2), rateAt(s.delay, t - 1)]);
  if (delayNow > Math.max(delayBase * 1.2, 0.03)) {
    const change = delayBase > 0 ? (delayNow - delayBase) / delayBase : 1;
    out.push({
      code: "delay_rate_increase",
      label: "Late-delivery increase",
      text: `Late-delivery rate rose to ${pct(delayNow)} versus a ${pct(delayBase)} baseline`,
      current: pct(delayNow),
      baseline: pct(delayBase),
      delta: `+${pct(change, 0)}`,
      severity: change >= 0.5 ? "High" : "Medium",
      weight: change,
    });
  }

  const nodoneNow = rateAt(s.nodone, t);
  const nodoneBase = mean([rateAt(s.nodone, t - 3), rateAt(s.nodone, t - 2), rateAt(s.nodone, t - 1)]);
  if (nodoneNow > Math.max(nodoneBase * 1.2, 0.02)) {
    const change = nodoneBase > 0 ? (nodoneNow - nodoneBase) / nodoneBase : 1;
    out.push({
      code: "nodone_rate_increase",
      label: "Failed-delivery increase",
      text: `Failed-delivery rate rose to ${pct(nodoneNow)} versus a ${pct(nodoneBase)} baseline`,
      current: pct(nodoneNow),
      baseline: pct(nodoneBase),
      delta: `+${pct(change, 0)}`,
      severity: change >= 0.5 ? "High" : "Medium",
      weight: change * 0.95,
    });
  }

  const last6 = s.item.slice(t - 5, t + 1);
  const vol = mean(last6) > 0 ? Math.sqrt(mean(last6.map((v) => (v - mean(last6)) ** 2))) / mean(last6) : 0;
  if (vol > 0.6) {
    out.push({
      code: "volume_volatility",
      label: "Unstable shipment volume",
      text: `Six-month volume volatility is high (CV = ${vol.toFixed(2)})`,
      current: `CV ${vol.toFixed(2)}`,
      baseline: "Alert at 0.60",
      delta: `+${pct(vol / 0.6 - 1, 0)}`,
      severity: vol > 1 ? "High" : "Medium",
      weight: vol * 0.6,
    });
  }

  const valueAt = (i: number) => s.revenue[i] / Math.max(s.item[i], 1);
  const valueNow = valueAt(t);
  const valueBase = mean([valueAt(t - 3), valueAt(t - 2), valueAt(t - 1)]);
  if (s.item[t] > 0 && valueBase > 0 && valueNow <= valueBase * 0.85) {
    const change = (valueNow - valueBase) / valueBase;
    out.push({
      code: "order_value_drop",
      label: "Average order value decline",
      text: `Average order value declined ${pct(Math.abs(change), 0)} versus the three-month baseline`,
      current: `₫${fmt(Math.round(valueNow / 1000))}k / item`,
      baseline: `₫${fmt(Math.round(valueBase / 1000))}k / item`,
      delta: `−${pct(Math.abs(change), 0)}`,
      severity: change <= -0.35 ? "High" : "Medium",
      weight: Math.abs(change) * 0.9,
    });
  }

  if (customer.tenure_months < 12) {
    out.push({
      code: "low_tenure",
      label: "New / low-tenure customer",
      text: `New customer with ${customer.tenure_months} months of tenure`,
      current: `${customer.tenure_months} months`,
      baseline: "12-month mark",
      delta: `−${12 - customer.tenure_months} mo.`,
      severity: "Medium",
      weight: 0.3,
    });
  }

  return out.sort((a, b) => b.weight - a.weight).slice(0, 3);
}

function CurvePlot({
  points,
  color,
  title,
  badge,
  xLabel,
  yLabel,
  diagonal,
  refY,
  refYLabel,
  marker,
  markerLabel,
}: {
  points: { x: number; y: number }[];
  color: string;
  title: string;
  badge: string;
  xLabel: string;
  yLabel: string;
  diagonal?: boolean;
  refY?: number;
  refYLabel?: string;
  marker?: { x: number; y: number };
  markerLabel?: string;
}) {
  const W = 420;
  const H = 320;
  const P = { l: 52, r: 16, t: 18, b: 46 };
  const sx = (x: number) => P.l + x * (W - P.l - P.r);
  const sy = (y: number) => H - P.b - y * (H - P.t - P.b);
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join(" ");
  const ticks = [0, 0.25, 0.5, 0.75, 1];
  return (
    <figure className="curve-plot">
      <figcaption>
        <strong>{title}</strong>
        <span>{badge}</span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${title}: ${badge}`}>
        {ticks.map((tick) => (
          <g key={tick}>
            <line x1={sx(tick)} y1={sy(0)} x2={sx(tick)} y2={sy(1)} className="grid" />
            <line x1={sx(0)} y1={sy(tick)} x2={sx(1)} y2={sy(tick)} className="grid" />
            <text x={sx(tick)} y={H - P.b + 22} textAnchor="middle" className="tick">
              {tick}
            </text>
            <text x={P.l - 10} y={sy(tick) + 4} textAnchor="end" className="tick">
              {tick}
            </text>
          </g>
        ))}
        {diagonal && <line x1={sx(0)} y1={sy(0)} x2={sx(1)} y2={sy(1)} className="refline" />}
        {refY !== undefined && (
          <g>
            <line x1={sx(0)} y1={sy(refY)} x2={sx(1)} y2={sy(refY)} className="refline" />
            {refYLabel && (
              <text x={sx(0.02)} y={sy(refY) - 7} className="ref-label">
                {refYLabel}
              </text>
            )}
          </g>
        )}
        <path d={path} fill="none" stroke={color} strokeWidth="3" />
        {marker && (
          <g>
            <circle cx={sx(marker.x)} cy={sy(marker.y)} r="7" fill="#b3402a" />
            {markerLabel && (
              <text x={sx(marker.x) + 12} y={sy(marker.y) - 10} className="marker-label">
                {markerLabel}
              </text>
            )}
          </g>
        )}
        <text x={(W + P.l - P.r) / 2} y={H - 8} textAnchor="middle" className="axis-label">
          {xLabel}
        </text>
        <text x={14} y={(H - P.b + P.t) / 2} textAnchor="middle" className="axis-label" transform={`rotate(-90 14 ${(H - P.b + P.t) / 2})`}>
          {yLabel}
        </text>
      </svg>
    </figure>
  );
}

export default function Home() {
  const meta = artifacts.meta;
  const holdout = artifacts.metric_comparison[1];
  const confusion = artifacts.confusion;
  const [menuOpen, setMenuOpen] = useState(false);
  const [threshold, setThreshold] = useState(0.44);
  const [selectedId, setSelectedId] = useState(artifacts.customer_timeseries[0].cms_code_enc);
  const [signalKey, setSignalKey] = useState<SignalKey>("item");
  const [revealOutcome, setRevealOutcome] = useState(false);
  const [actionStep, setActionStep] = useState(0);
  const [monitoringMonth, setMonitoringMonth] = useState(5);

  const sweepRow = useMemo(
    () =>
      artifacts.threshold_sweep.reduce((best, row) =>
        Math.abs(row.threshold - threshold) < Math.abs(best.threshold - threshold) ? row : best,
      ),
    [threshold],
  );

  const selected =
    artifacts.customer_timeseries.find((customer) => customer.cms_code_enc === selectedId) ??
    artifacts.customer_timeseries[0];
  const anchorIdx = selected.months.indexOf(selected.window_end);
  const selectedSeries = selected.series[signalKey];
  const selectedSignalMeta = signalOptions.find((option) => option.key === signalKey) ?? signalOptions[0];
  const observedMax = Math.max(...selectedSeries, 1);
  const derived = deriveSignals(selected);
  const selectedFlagged = selected.churn_probability >= sweepRow.threshold;

  const testIdx = artifacts.monthly_churn_rate.findIndex((row) => row.month === meta.test_month);
  const maxChurnRate = Math.max(...artifacts.monthly_churn_rate.map((row) => row.rate));
  const maxImportance = Math.max(...artifacts.feature_importance.map((row) => row.importance));
  const maxHistogram = Math.max(...artifacts.score_histogram.map((bin) => bin.count));
  const currentMonitoring = monitoringMonths[monitoringMonth];
  const currentStage = actionStages[actionStep];

  const heroRows = artifacts.risk_list_top.slice(0, 4).map((row) => {
    const history = artifacts.customer_timeseries.find((customer) => customer.cms_code_enc === row.cms_code_enc);
    const anchor = history ? history.months.indexOf(history.window_end) : -1;
    return { ...row, bars: history && anchor >= 7 ? history.series.item.slice(anchor - 7, anchor + 1) : [] };
  });

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Back to top">
          <span className="brand-mark">CP</span>
          <span>Churn / Decision Lab</span>
        </a>
        <button className="menu-button" onClick={() => setMenuOpen(!menuOpen)} aria-expanded={menuOpen} aria-label="Toggle navigation">
          Menu
        </button>
        <nav className={menuOpen ? "nav-open" : ""} aria-label="Main navigation">
          <a href="#problem" onClick={() => setMenuOpen(false)}>Problem</a>
          <a href="#notebook-run" onClick={() => setMenuOpen(false)}>Notebook run</a>
          <a href="#performance" onClick={() => setMenuOpen(false)}>Results</a>
          <a href="#decision-lab" onClick={() => setMenuOpen(false)}>Decision lab</a>
          <Link href="/case-study" onClick={() => setMenuOpen(false)}>Case study</Link>
        </nav>
        <a className="nav-cta" href="#decision-lab">
          Open decision lab <span>↘</span>
        </a>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow">
            <span /> Logistics · Data science case study
          </p>
          <h1>
            Predict churn.
            <br />
            <em>Prioritize action.</em>
          </h1>
          <p className="hero-lede">
            A churn system for a national logistics network: it flags customers likely to leave within two months, explains
            the behavior behind each score, and turns predictions into a workable intervention queue. Everything below is
            reproduced by one public notebook on synthetic data — every number on this page comes from that run.
          </p>
          <div className="hero-actions">
            <a className="button primary" href="#decision-lab">
              Open decision lab <span>→</span>
            </a>
            <Link className="button secondary" href="/case-study">
              Read full case study
            </Link>
          </div>
          <div className="hero-stats" aria-label="Demo run facts">
            <div>
              <strong>{fmt(meta.n_customers)}</strong>
              <span>synthetic customers × {meta.n_months} months</span>
            </div>
            <div>
              <strong>K = {artifacts.selected_lr.K}</strong>
              <span>window chosen by LR sweep</span>
            </div>
            <div>
              <strong>{holdout.f1.toFixed(3)}</strong>
              <span>F1 · synthetic holdout</span>
            </div>
            <div>
              <strong>{holdout.roc_auc.toFixed(3)}</strong>
              <span>ROC-AUC · synthetic holdout</span>
            </div>
          </div>
        </div>

        <div className="hero-console" aria-label="Top of the demo risk queue">
          <div className="console-head">
            <div>
              <span className="live-dot" /> Notebook output
            </div>
            <span>Seed {meta.seed} · deterministic</span>
          </div>
          <div className="console-title">
            <div>
              <p>Intervention queue</p>
              <h2>Top risk accounts</h2>
            </div>
            <span className="period-chip">Predicts {monthLabel(2610)}</span>
          </div>
          <div className="queue-head">
            <span>Customer</span>
            <span>Volume trend</span>
            <span>Risk</span>
          </div>
          {heroRows.map((row) => (
            <div className="preview-row" key={row.cms_code_enc}>
              <span className="rank">{String(row.priority_rank).padStart(2, "0")}</span>
              <span>
                <strong>{row.cms_code_enc}</strong>
                <small>rank {row.priority_rank} of {fmt(artifacts.xgb_setup.test_rows)}</small>
              </span>
              <span className="mini-bars" aria-hidden="true">
                {row.bars.map((value, index) => (
                  <i key={index} style={{ height: `${Math.max((value / Math.max(...row.bars, 1)) * 100, 9)}%` }} />
                ))}
              </span>
              <strong className="risk-value">{pct(row.churn_probability)}</strong>
            </div>
          ))}
          <div className="console-foot">
            <span>Ranked by predicted probability</span>
            <span>Scoring origin {monthLabel(meta.test_month)}</span>
          </div>
        </div>
      </section>

      <aside className="disclosure" aria-label="Data disclosure">
        <strong>Portfolio-safe edition.</strong>
        <p>
          All customers are synthetic, generated with the production schema shapes. Metrics shown are real outputs of the
          public notebook run — they are not production performance, which remains pending approval.
        </p>
        <span>NO PRODUCTION DATA</span>
      </aside>

      <section className="domain-scene" aria-labelledby="domain-scene-title">
        <Image
          src={`${publicBasePath}/logistics-network.png`}
          alt="Illustrated parcel sorting hub connected to a regional last-mile delivery network"
          width={1710}
          height={920}
          sizes="100vw"
        />
        <div className="domain-scene-card">
          <span>LOGISTICS OPERATING CONTEXT</span>
          <h2 id="domain-scene-title">
            Churn signals begin
            <br />
            inside the parcel flow.
          </h2>
          <p>
            Before a customer leaves, the network usually sees it first: parcel volume slips, late and failed deliveries
            climb, complaints appear. The model turns those operational patterns into a reviewable customer queue.
          </p>
          <div className="domain-signal-grid">
            <div>
              <i>01</i>
              <strong>Parcel flow</strong>
              <small>Shipment volume, revenue and volatility</small>
            </div>
            <div>
              <i>02</i>
              <strong>Delivery quality</strong>
              <small>Late, failed and complaint behavior</small>
            </div>
            <div>
              <i>03</i>
              <strong>Relationship depth</strong>
              <small>Tenure, satisfaction and service mix</small>
            </div>
          </div>
        </div>
      </section>

      <section className="section problem" id="problem">
        <div className="section-label">01 / Business &amp; data</div>
        <div className="section-intro split-intro">
          <h2>
            From a score to an
            <br />
            <em>intervention decision.</em>
          </h2>
          <div>
            <p>
              The useful question was never just “who might churn?” It was: which customers should a retention team contact
              first, why are they at risk, and how does the list fit real intervention capacity? The system is designed
              around that decision — and the public demo reproduces its full path from raw monthly data to a ranked queue.
            </p>
            <div className="question-grid">
              <span><b>WHO</b> is at risk?</span>
              <span><b>WHEN</b> might they leave?</span>
              <span><b>WHY</b> did the score rise?</span>
              <span><b>WHAT</b> fits capacity?</span>
            </div>
          </div>
        </div>

        <div className="source-grid">
          <article className="source-card">
            <span className="source-number">01</span>
            <p>Monthly orders</p>
            <code>bccp_orderitem_YYMM</code>
            <small>Partitioned by reporting month</small>
          </article>
          <article className="source-card">
            <span className="source-number">02</span>
            <p>Customer master</p>
            <code>cas_customer · cas_info</code>
            <small>Refreshed snapshots</small>
          </article>
          <article className="source-card">
            <span className="source-number">03</span>
            <p>Complaints</p>
            <code>cms_complaint</code>
            <small>Refreshed snapshot</small>
          </article>
          <article className="source-card">
            <span className="source-number">04</span>
            <p>Churn labels</p>
            <code>Label.label_YYMM</code>
            <small>Future-month outcome lists</small>
          </article>
        </div>

        <div className="pipeline" aria-label="System workflow">
          <div><span>01</span><strong>Ingest</strong><small>Monthly + snapshots</small></div>
          <i>→</i>
          <div><span>02</span><strong>Build windows</strong><small>cus_feature_Km tables</small></div>
          <i>→</i>
          <div><span>03</span><strong>Select K with LR</strong><small>Baseline sweep</small></div>
          <i>→</i>
          <div><span>04</span><strong>Train XGBoost</strong><small>Main model</small></div>
          <i>→</i>
          <div><span>05</span><strong>Rank &amp; intervene</strong><small>Priority queue</small></div>
        </div>
      </section>

      <section className="section notebook-run" id="notebook-run">
        <div className="section-label light">02 / The notebook run</div>
        <div className="section-intro method-intro">
          <div>
            <p className="eyebrow mint"><span /> Reproducible evidence</p>
            <h2>
              One synthetic cohort.
              <br />
              <em>The real pipeline.</em>
            </h2>
          </div>
          <p>
            Production data cannot be published, so the demo notebook generates a {fmt(meta.n_customers)}-customer,{" "}
            {meta.n_months}-month cohort that mirrors the production schema — monthly order partitions, lifetime snapshots
            and future-month label tables — then runs the same pipeline end to end. Deterministic seed, verifiable at every
            step.
          </p>
        </div>

        <div className="run-facts" aria-label="Cohort scale">
          <div><strong>{fmt(meta.n_customers)}</strong><span>synthetic customers</span></div>
          <div><strong>{meta.n_months}</strong><span>months · {monthLabel(2501)} – {monthLabel(2610)}</span></div>
          <div><strong>{fmt(meta.raw_rows)}</strong><span>raw monthly rows</span></div>
          <div><strong>{fmt(meta.label_rows)}</strong><span>churn label rows</span></div>
          <div><strong>t + {meta.horizon}</strong><span>months prediction horizon</span></div>
        </div>

        <div className="run-panels">
          <article className="churn-month-card">
            <div className="card-kicker mint">POPULATION SHIFT</div>
            <h3>Monthly churn rate is a moving target</h3>
            <div className="churn-month-chart" aria-label="Churn rate by month from the notebook run">
              {artifacts.monthly_churn_rate.map((row) => {
                const highlight = row.month === 2609 ? "val" : row.month === 2610 ? "test" : "";
                return (
                  <div key={row.month} className={`churn-bar ${highlight}`} title={`${monthLabel(row.month)}: ${pct(row.rate)}`}>
                    <b>{(row.rate * 100).toFixed(1)}</b>
                    <i style={{ height: `${(row.rate / maxChurnRate) * 100}%` }} />
                    <small>{monthLabel(row.month).replace(" ", " ’")}</small>
                  </div>
                );
              })}
            </div>
            <div className="churn-month-legend">
              <span><i className="regular" />Training-period label months</span>
              <span><i className="val" />Validation labels ({monthLabel(2609)})</span>
              <span><i className="test" />Holdout labels ({monthLabel(2610)})</span>
            </div>
            <p>
              Churn drifts between {pct(Math.min(...artifacts.monthly_churn_rate.map((r) => r.rate)))} and{" "}
              {pct(maxChurnRate)} by design. A random split would blend these months together; the pipeline splits by time
              instead, so evaluation matches how the system runs in production.
            </p>
          </article>

          <article className="window-card">
            <div className="card-kicker mint">LEAKAGE-SAFE DESIGN</div>
            <h3>Features stop at month t. Labels live at t + 2.</h3>
            <div className="window-track" aria-label="Sliding window and label horizon">
              {artifacts.monthly_churn_rate.map((row, index) => {
                const cls =
                  row.month === meta.test_month
                    ? "anchor"
                    : row.month === meta.val_month
                      ? "val-anchor"
                      : index > testIdx
                        ? "future"
                        : index >= testIdx - 12
                          ? "window"
                          : "history";
                return (
                  <span key={row.month} className={cls} title={monthLabel(row.month)}>
                    <small>{String(row.month % 100).padStart(2, "0")}</small>
                  </span>
                );
              })}
            </div>
            <div className="window-legend">
              <span><i className="history" />Earlier anchors</span>
              <span><i className="window" />13-month feature window</span>
              <span><i className="val-anchor" />Validation anchor</span>
              <span><i className="anchor" />Holdout anchor</span>
              <span><i className="future" />Label-only months</span>
            </div>
            <dl className="window-facts">
              <div><dt>Train anchors</dt><dd>{monthLabel(2601)} – {monthLabel(2606)} · {fmt(artifacts.xgb_setup.train_rows)} rows</dd></div>
              <div><dt>Validation anchor</dt><dd>{monthLabel(meta.val_month)} · {fmt(artifacts.xgb_setup.val_rows)} rows</dd></div>
              <div><dt>Holdout anchor</dt><dd>{monthLabel(meta.test_month)} · {fmt(artifacts.xgb_setup.test_rows)} rows — untouched until the end</dd></div>
            </dl>
            <p>
              Each snapshot table is named <code>cus_feature_13m_YYMM_YYMM</code>, exactly like production. An active-now
              gate keeps only customers still shipping at month t, so the model learns “active today, gone in two months” —
              not “already gone”.
            </p>
          </article>
        </div>
      </section>

      <section className="section method" id="method">
        <div className="section-label light">03 / Model development</div>
        <div className="section-intro method-intro">
          <div>
            <p className="eyebrow mint"><span /> Baseline before complexity</p>
            <h2>
              LR chooses the window.
              <br />
              <em>XGBoost is the model.</em>
            </h2>
          </div>
          <p>
            Logistic Regression is deliberately not the final model — it is the transparent referee that picks the sliding
            window size K and whether static profile features help. Only then does XGBoost tuning start, on the exact
            configuration the baseline selected.
          </p>
        </div>

        <div className="sweep-grid">
          <article className="sweep-card">
            <div className="table-heading">
              <div>
                <span className="card-kicker">STEP 1 · WINDOW CANDIDATES</span>
                <h3>Four window sizes, built like production tables</h3>
              </div>
            </div>
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>K</th>
                    <th>Rows</th>
                    <th>Snapshots</th>
                    <th>Churn</th>
                    <th>Features</th>
                  </tr>
                </thead>
                <tbody>
                  {artifacts.build_summary.map((row) => (
                    <tr key={row.K} className={row.K === artifacts.selected_lr.K ? "winner" : ""}>
                      <td><b>{row.K} mo</b></td>
                      <td>{fmt(row.rows_active)}</td>
                      <td>{row.snapshots}</td>
                      <td>{pct(row.churn_rate_active)}</td>
                      <td>{row.n_features}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="table-note">
              Longer windows carry more history per row but leave fewer valid snapshots — the classic sliding-window
              trade-off.
            </p>
          </article>

          <aside className="production-ref">
            <span className="card-kicker">PRODUCTION BUNDLE REFERENCE</span>
            <h3>The real system agrees on K = 13</h3>
            <dl>
              <div><dt>Source commit</dt><dd><code>{artifacts.production_reference.source_commit.slice(0, 7)}</code></dd></div>
              <div><dt>Window / horizon</dt><dd>K = {artifacts.production_reference.best_k} · t + {artifacts.production_reference.horizon}</dd></div>
              <div><dt>LR validation F1</dt><dd>{artifacts.production_reference.lr_f1_val.toFixed(3)}</dd></div>
              <div><dt>XGBoost validation F1</dt><dd>{artifacts.production_reference.xgb_f1_val.toFixed(3)}</dd></div>
              <div><dt>XGBoost validation AP</dt><dd>{artifacts.production_reference.xgb_ap_val.toFixed(3)}</dd></div>
            </dl>
            <p>
              Reference values recorded in the production model bundle — shown for context only. They are not results of
              the synthetic run below and are not verified public performance claims.
            </p>
          </aside>

          <article className="sweep-card wide">
            <div className="table-heading">
              <div>
                <span className="card-kicker">STEP 2 · LR SWEEP</span>
                <h3>Eight configurations, ranked by validation F1</h3>
              </div>
              <span className="chip">Winner: K = 13 + static profile</span>
            </div>
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>K</th>
                    <th>Static</th>
                    <th>F1</th>
                    <th>Precision</th>
                    <th>Recall</th>
                    <th>AP</th>
                    <th>ROC-AUC</th>
                  </tr>
                </thead>
                <tbody>
                  {artifacts.lr_results.map((row) => (
                    <tr key={`${row.K}-${row.use_static}`} className={row.K === 13 && row.use_static ? "winner" : ""}>
                      <td><b>{row.K}</b></td>
                      <td>{row.use_static ? "Yes" : "No"}</td>
                      <td><b>{row.f1.toFixed(4)}</b></td>
                      <td>{row.precision.toFixed(4)}</td>
                      <td>{row.recall.toFixed(4)}</td>
                      <td>{row.ap.toFixed(4)}</td>
                      <td>{row.roc_auc.toFixed(4)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="table-note">
              Degenerate solutions (F1 within 0.005 of predicting “everyone churns”) are rejected before ranking. Class
              weights are only enabled while training churn stays under 35%.
            </p>
          </article>

          <article className="sweep-card wide">
            <div className="table-heading">
              <div>
                <span className="card-kicker">STEP 3 · XGBOOST TUNING</span>
                <h3>Five candidates on the selected K = 13 dataset</h3>
              </div>
              <span className="chip">Winner: d6_regularized</span>
            </div>
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Candidate</th>
                    <th>F1</th>
                    <th>Precision</th>
                    <th>Recall</th>
                    <th>AP</th>
                    <th>ROC-AUC</th>
                    <th>Trees</th>
                  </tr>
                </thead>
                <tbody>
                  {artifacts.tuning_results.map((row, index) => (
                    <tr key={row.name} className={index === 0 ? "winner" : ""}>
                      <td><code>{row.name}</code></td>
                      <td><b>{row.f1.toFixed(4)}</b></td>
                      <td>{row.precision.toFixed(4)}</td>
                      <td>{row.recall.toFixed(4)}</td>
                      <td>{row.ap.toFixed(4)}</td>
                      <td>{row.roc_auc.toFixed(4)}</td>
                      <td>{row.best_iteration}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="table-note">
              All candidates train with histogram trees, early stopping on AP and the class weight inherited from the LR
              guardrail ({artifacts.xgb_setup.spw}). Validation F1 decides; AP breaks ties. Every candidate lands within
              0.005 F1 — the signal is in the data design, not one magic hyperparameter.
            </p>
          </article>

        </div>
      </section>

      <section className="section performance" id="performance">
        <div className="section-label">04 / Synthetic holdout results</div>
        <div className="section-intro split-intro">
          <h2>
            Judged on a month
            <br />
            <em>it never saw.</em>
          </h2>
          <div>
            <p>
              The final month of the cohort ({monthLabel(meta.test_month)} anchors, {monthLabel(2610)} labels) stayed
              untouched during window selection, tuning and threshold choice. The decision threshold was locked on
              validation at {artifacts.chosen_threshold.toFixed(3)}, then applied once. These are real outputs of the
              notebook — on synthetic data, and labeled that way.
            </p>
            <div className="headline-metrics" aria-label="Headline holdout metrics">
              <div><small>F1</small><strong>{holdout.f1.toFixed(3)}</strong></div>
              <div><small>Precision</small><strong>{holdout.precision.toFixed(3)}</strong></div>
              <div><small>Recall</small><strong>{holdout.recall.toFixed(3)}</strong></div>
              <div><small>AP</small><strong>{holdout.ap.toFixed(3)}</strong></div>
              <div><small>ROC-AUC</small><strong>{holdout.roc_auc.toFixed(3)}</strong></div>
            </div>
          </div>
        </div>

        <div className="performance-grid">
          <CurvePlot
            points={artifacts.pr_curve}
            color="#c96a2e"
            title="Precision–Recall · holdout"
            badge={`AP = ${holdout.ap.toFixed(3)}`}
            xLabel="Recall"
            yLabel="Precision"
            refY={artifacts.holdout_prevalence}
            refYLabel={`Prevalence ${artifacts.holdout_prevalence.toFixed(3)}`}
            marker={{ x: holdout.recall, y: holdout.precision }}
            markerLabel="F1 threshold"
          />
          <CurvePlot
            points={artifacts.roc_curve}
            color="#2d5f8a"
            title="ROC · holdout"
            badge={`ROC-AUC = ${holdout.roc_auc.toFixed(3)}`}
            xLabel="False positive rate"
            yLabel="True positive rate"
            diagonal
          />

          <article className="confusion-card">
            <div className="card-kicker">CONFUSION MATRIX · THRESHOLD {artifacts.chosen_threshold.toFixed(3)}</div>
            <h3>{fmt(artifacts.xgb_setup.test_rows)} active customers, one decision each</h3>
            <div className="confusion-grid" role="table" aria-label="Holdout confusion matrix">
              <span className="corner" />
              <span className="col-head">Predicted active</span>
              <span className="col-head">Predicted churn</span>
              <span className="row-head">Actually active</span>
              <div className="cell good"><strong>{fmt(confusion.tn)}</strong><small>true negatives</small></div>
              <div className="cell warn"><strong>{fmt(confusion.fp)}</strong><small>false alarms</small></div>
              <span className="row-head">Actually churned</span>
              <div className="cell bad"><strong>{fmt(confusion.fn)}</strong><small>missed churners</small></div>
              <div className="cell good"><strong>{fmt(confusion.tp)}</strong><small>caught in time</small></div>
            </div>
            <p>
              Of {fmt(artifacts.holdout_positives)} customers who really churned two months later, the model caught{" "}
              {fmt(confusion.tp)} and missed {fmt(confusion.fn)}. The business trade-off: {fmt(confusion.fp)} false alarms
              buy {pct(holdout.recall)} recall.
            </p>
          </article>

          <article className="comparison-card">
            <div className="card-kicker">THRESHOLD DISCIPLINE</div>
            <h3>Validation chose it. Holdout lived with it.</h3>
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Split</th>
                    <th>Thr.</th>
                    <th>F1</th>
                    <th>Precision</th>
                    <th>Recall</th>
                    <th>AP</th>
                  </tr>
                </thead>
                <tbody>
                  {artifacts.metric_comparison.map((row, index) => (
                    <tr key={row.split} className={index === 1 ? "winner" : ""}>
                      <td>
                        <b>
                          {row.split === "validation_tuned"
                            ? "Validation"
                            : row.split === "holdout_fixed_threshold"
                              ? "Holdout · locked"
                              : "Holdout · 0.50"}
                        </b>
                      </td>
                      <td>{row.threshold.toFixed(3)}</td>
                      <td><b>{row.f1.toFixed(3)}</b></td>
                      <td>{row.precision.toFixed(3)}</td>
                      <td>{row.recall.toFixed(3)}</td>
                      <td>{row.ap.toFixed(3)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p>
              The small drop from validation to holdout ({artifacts.metric_comparison[0].f1.toFixed(3)} →{" "}
              {holdout.f1.toFixed(3)}) is exactly the honest gap a fixed threshold pays on a new month. AP and ROC-AUC are
              identical across threshold rows because ranking does not change.
            </p>
          </article>

          <article className="guardrail-card">
            <div className="card-kicker">RUN GUARDRAILS</div>
            <h3>Five asserts before this page could publish</h3>
            <ul>
              {artifacts.guardrails.map((guard) => (
                <li key={guard.name}>
                  <i className={guard.passed ? "pass" : "fail"}>{guard.passed ? "PASS" : "FAIL"}</i>
                  <div>
                    <b>{guard.name.replaceAll("_", " ")}</b>
                    <small>{guard.detail}</small>
                  </div>
                </li>
              ))}
            </ul>
            <p>
              The notebook refuses to hand over a degenerate run: predict-all-positive, prevalence-level AP or a collapsed
              score range all fail the build. The production system extends these into full promotion gates (section 07).
            </p>
          </article>
        </div>
      </section>

      <section className="section lab" id="decision-lab">
        <div className="section-label">05 / Decision lab</div>
        <div className="section-intro lab-intro">
          <div>
            <p className="eyebrow"><span /> Interactive · real notebook outputs</p>
            <h2>
              Turn {fmt(artifacts.xgb_setup.test_rows)} scores into
              <br />
              <em>a contact strategy.</em>
            </h2>
          </div>
          <p>
            Every control below recomputes against the actual holdout scores and labels exported from the notebook — move
            the operating threshold, inspect ranked customers, and open a 22-month behavioral dossier for each one.
          </p>
        </div>

        <div className="lab-shell">
          <div className="threshold-block">
            <div className="threshold-controls">
              <div className="card-kicker">OPERATING THRESHOLD</div>
              <h3>Where should the intervention line sit?</h3>
              <label htmlFor="threshold">
                Flag customers with probability ≥ <strong>{pct(sweepRow.threshold, 0)}</strong>
              </label>
              <input
                id="threshold"
                type="range"
                min="0.02"
                max="0.98"
                step="0.02"
                value={threshold}
                onChange={(event) => setThreshold(Number(event.target.value))}
              />
              <div className="range-scale"><span>2%</span><span>50%</span><span>98%</span></div>
              <button className="reset-threshold" onClick={() => setThreshold(0.44)}>
                ↺ Back to the F1-optimal threshold ({artifacts.chosen_threshold.toFixed(3)})
              </button>
              <p>
                The model’s ranking never changes — the slider only moves the decision line, trading alert volume against
                missed churners on the real holdout month.
              </p>
            </div>

            <div className="threshold-readout" aria-live="polite">
              <div className="readout-tiles">
                <div>
                  <small>Flagged for contact</small>
                  <strong>{fmt(sweepRow.flagged)}</strong>
                  <span>of {fmt(artifacts.xgb_setup.test_rows)} active customers</span>
                </div>
                <div>
                  <small>Precision</small>
                  <strong>{pct(sweepRow.precision)}</strong>
                  <span>flagged who really churn</span>
                </div>
                <div>
                  <small>Recall</small>
                  <strong>{pct(sweepRow.recall)}</strong>
                  <span>of {fmt(artifacts.holdout_positives)} churners caught</span>
                </div>
                <div>
                  <small>Missed churners</small>
                  <strong>{fmt(sweepRow.fn)}</strong>
                  <span>false alarms: {fmt(sweepRow.fp)}</span>
                </div>
              </div>
              <div className="histogram-wrap">
                <div className="histogram" aria-label="Holdout score distribution with decision threshold">
                  {artifacts.score_histogram.map((bin) => (
                    <div
                      key={bin.lo}
                      className="hist-col"
                      title={`${pct(bin.lo, 0)}–${pct(bin.hi, 0)}: ${bin.count} customers (${bin.churn} churned)`}
                    >
                      <i className="stay" style={{ height: `${((bin.count - bin.churn) / maxHistogram) * 100}%` }} />
                      <i className="churn" style={{ height: `${(bin.churn / maxHistogram) * 100}%` }} />
                    </div>
                  ))}
                  <span className="threshold-line" style={{ left: `${sweepRow.threshold * 100}%` }}>
                    <b>{pct(sweepRow.threshold, 0)}</b>
                  </span>
                </div>
                <div className="hist-legend">
                  <span><i className="stay" />Stayed</span>
                  <span><i className="churn" />Churned within 2 months</span>
                  <span className="hist-note">Scores right of the line are flagged</span>
                </div>
              </div>
            </div>
          </div>

          <div className="capacity-strip">
            <div>
              <span className="card-kicker">CAPACITY VIEW</span>
              <h3>Top 10% of the queue = {fmt(artifacts.top10pct.customers)} customers</h3>
            </div>
            <div className="capacity-stats">
              <div><small>Precision in top 10%</small><strong>{pct(artifacts.top10pct.precision)}</strong></div>
              <div><small>Churners captured</small><strong>{pct(artifacts.top10pct.recall)}</strong></div>
              <div><small>Production capacity</small><strong>≈7,000</strong><span>per monthly run (design)</span></div>
            </div>
            <p>
              When capacity, not probability, sets the line: contacting only the top decile reaches {pct(artifacts.top10pct.precision, 0)}{" "}
              precision. The production system applies the same ranking logic to an ~7,000-slot intervention budget.
            </p>
          </div>

          <div className="queue-workspace">
            <div className="queue-panel">
              <div className="table-heading">
                <div>
                  <span className="card-kicker">RISK QUEUE · TOP 12 OF {fmt(artifacts.xgb_setup.test_rows)}</span>
                  <h3>Exactly as the notebook printed it</h3>
                </div>
                <a className="download-link" href={`${publicBasePath}/notebook_risk_list.csv`} download>
                  Full risk list CSV ↓
                </a>
              </div>
              <div className="table-scroll">
                <table className="data-table risk-table">
                  <thead>
                    <tr>
                      <th>Rank</th>
                      <th>Customer</th>
                      <th>Probability</th>
                      <th>Flagged</th>
                      <th>At t + 2</th>
                    </tr>
                  </thead>
                  <tbody>
                    {artifacts.risk_list_top.slice(0, 12).map((row) => (
                      <tr key={row.cms_code_enc}>
                        <td><b>{row.priority_rank}</b></td>
                        <td><code>{row.cms_code_enc}</code></td>
                        <td>
                          <span className="prob-cell">
                            <i style={{ width: `${row.churn_probability * 100}%` }} />
                            <b>{pct(row.churn_probability)}</b>
                          </span>
                        </td>
                        <td>{row.churn_probability >= sweepRow.threshold ? "Yes" : "No"}</td>
                        <td>
                          <em className={row.y_true === 1 ? "outcome churned" : "outcome stayed"}>
                            {row.y_true === 1 ? "Churned" : "Stayed"}
                          </em>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="table-note">
                Columns mirror the notebook risk list: customer, scoring origin, probability, decision and priority rank.
                The outcome column exists here only because this is a backtest month — a live run cannot see it.
              </p>
            </div>

            <aside className="dossier">
              <div className="card-kicker">CUSTOMER DOSSIER · 22-MONTH HISTORY</div>
              <div className="rep-picker">
                {riskBands.map((band) => (
                  <div className="rep-band" key={band.label}>
                    <small>{band.label}</small>
                    <div>
                      {artifacts.customer_timeseries
                        .filter((customer) => band.ranks.includes(customer.priority_rank))
                        .map((customer) => (
                          <button
                            key={customer.cms_code_enc}
                            className={selected.cms_code_enc === customer.cms_code_enc ? "active" : ""}
                            onClick={() => {
                              setSelectedId(customer.cms_code_enc);
                              setRevealOutcome(false);
                            }}
                          >
                            #{customer.priority_rank}
                          </button>
                        ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="dossier-head">
                <div>
                  <strong>{selected.cms_code_enc}</strong>
                  <small>
                    {regionLabels[selected.region] ?? selected.region} · service {selected.dominant_service} ·{" "}
                    {selected.tenure_months} mo. tenure
                  </small>
                </div>
                <div className="dossier-prob">
                  <small>churn probability</small>
                  <strong>{pct(selected.churn_probability)}</strong>
                  <span className={selectedFlagged ? "flag on" : "flag off"}>
                    {selectedFlagged ? `Flagged at ≥ ${pct(sweepRow.threshold, 0)}` : `Below the ${pct(sweepRow.threshold, 0)} line`}
                  </span>
                </div>
              </div>

              <div className="signal-tabs" aria-label="Select behavioral signal">
                {signalOptions.map((option) => (
                  <button
                    key={option.key}
                    className={signalKey === option.key ? "active" : ""}
                    onClick={() => setSignalKey(option.key)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              <div className="series-chart-head">
                <span>{selectedSignalMeta.label.toUpperCase()}</span>
                <small>{selectedSignalMeta.unit}</small>
              </div>
              <div className="series-chart" aria-label={`${selectedSignalMeta.label} over 22 months`}>
                {selectedSeries.map((value, index) => {
                  const zone = index > anchorIdx ? "future" : index > anchorIdx - 13 ? "window" : "history";
                  return (
                    <div
                      key={index}
                      className={`series-bar ${zone}`}
                      title={`${monthLabel(selected.months[index])}: ${fmt(value)}`}
                    >
                      <i style={{ height: `${Math.max((value / observedMax) * 100, 3)}%` }} />
                    </div>
                  );
                })}
              </div>
              <div className="series-scale">
                <span>{monthLabel(selected.months[0])}</span>
                <span className="anchor-note">↑ scored at {monthLabel(selected.window_end)}</span>
                <span>{monthLabel(selected.months[21])}</span>
              </div>
              <div className="series-legend">
                <span><i className="history" />Earlier history</span>
                <span><i className="window" />13-month feature window</span>
                <span><i className="future" />After scoring · hidden from the model</span>
              </div>

              <div className="derived-signals">
                <div className="derived-title">
                  <span>BEHAVIOR EVIDENCE AT SCORING TIME</span>
                  <small>Business rules on the window above · production pairs this with SHAP</small>
                </div>
                {derived.length > 0 ? (
                  <ol>
                    {derived.map((signal, index) => (
                      <li key={signal.code}>
                        <span>0{index + 1}</span>
                        <div>
                          <div className="derived-meta">
                            <b>{signal.label}</b>
                            <em className={signal.severity.toLowerCase()}>{signal.severity}</em>
                          </div>
                          <p>{signal.text}</p>
                          <div className="derived-evidence">
                            <span><small>Now</small><b>{signal.current}</b></span>
                            <span><small>3-month baseline</small><b>{signal.baseline}</b></span>
                            <span><small>Change</small><b>{signal.delta}</b></span>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="derived-empty">
                    No strong negative behavior rule fires for this customer at scoring time — consistent with its low
                    model score.
                  </p>
                )}
              </div>

              <div className="outcome-reveal">
                {revealOutcome ? (
                  <div className={`outcome-panel ${selected.y_true === 1 ? "churned" : "stayed"}`}>
                    <strong>
                      {selected.y_true === 1
                        ? `Churned in ${monthLabel(2610)}.`
                        : `Still active in ${monthLabel(2610)}.`}
                    </strong>
                    <p>
                      {selected.predicted_churn === 1 && selected.y_true === 1 &&
                        `At the notebook's locked ${artifacts.chosen_threshold.toFixed(3)} threshold, the model flagged this customer in time — a true positive.`}
                      {selected.predicted_churn === 1 && selected.y_true === 0 &&
                        `At the notebook's locked ${artifacts.chosen_threshold.toFixed(3)} threshold, the model raised a false alarm on this customer.`}
                      {selected.predicted_churn === 0 && selected.y_true === 1 &&
                        `At the notebook's locked ${artifacts.chosen_threshold.toFixed(3)} threshold, the model missed this churner — a false negative.`}
                      {selected.predicted_churn === 0 && selected.y_true === 0 &&
                        `At the notebook's locked ${artifacts.chosen_threshold.toFixed(3)} threshold, this customer was correctly left alone — a true negative.`}
                    </p>
                  </div>
                ) : (
                  <button className="reveal-button" onClick={() => setRevealOutcome(true)}>
                    Reveal what actually happened two months later →
                  </button>
                )}
              </div>
              <p className="dossier-note">
                Series reconstructed by joining the risk list back to the raw monthly table —{" "}
                <a href={`${publicBasePath}/notebook_monthly_behavior.csv`} download>
                  download the 10-customer × 22-month sample ↓
                </a>
              </p>
            </aside>
          </div>

          <div className="importance-block">
            <div className="table-heading">
              <div>
                <span className="card-kicker">GLOBAL EXPLAINABILITY · XGBOOST GAIN</span>
                <h3>What the demo model actually looks at</h3>
              </div>
              <span className="chip">Top 15 of {artifacts.xgb_setup.features_after_encoding} encoded features</span>
            </div>
            <div className="importance-bars">
              {artifacts.feature_importance.map((row) => (
                <div key={row.feature} className="importance-row">
                  <code>{row.feature}</code>
                  <div className="importance-track">
                    <i style={{ width: `${(row.importance / maxImportance) * 100}%` }} />
                  </div>
                  <b>{row.importance.toFixed(3)}</b>
                </div>
              ))}
            </div>
            <p className="table-note">
              Lifetime satisfaction and order-quality dominate, followed by volume slope and recency-style ratios — the
              model reads relationship health first, then recent shipping behavior. This is gain-based importance from the
              notebook; per-customer SHAP explanations belong to the production layer below.
            </p>
          </div>
        </div>
      </section>

      <section className="section production-design" id="production-design">
        <div className="section-label light">06 / From notebook to production</div>
        <div className="section-intro method-intro">
          <div>
            <p className="eyebrow mint"><span /> Design layer · clearly separated</p>
            <h2>
              The score is the start.
              <br />
              <em>The workflow is the product.</em>
            </h2>
          </div>
          <p>
            Everything in this section is the production design that surrounds the model: structured reasons, a human
            review workflow and a CRM contract. The notebook does not export these — they are shown as design, never as
            demo results.
          </p>
        </div>

        <div className="design-grid">
          <article className="design-card">
            <span className="card-kicker mint">STRUCTURED REASONS · PRODUCTION</span>
            <h3>SHAP evidence mapped to eight business reasons</h3>
            <div className="reason-catalog">
              {reasonCatalog.map(([code, label], index) => (
                <div key={code}>
                  <i>{String(index + 1).padStart(2, "0")}</i>
                  <div>
                    <strong>{label}</strong>
                    <code>{code}</code>
                  </div>
                </div>
              ))}
            </div>
            <p>
              In production, positive SHAP contributions select up to three of these buckets per customer, each rendered
              with the observed metric, three-month baseline and delta — the same shape the dossier preview computes from
              raw behavior above.
            </p>
          </article>

          <article className="design-card action-card">
            <span className="card-kicker mint">HUMAN WORKFLOW · DESIGN</span>
            <h3>Record the handoff, not just the prediction</h3>
            <div className="action-steps">
              {actionStages.map((stage, index) => (
                <button
                  key={stage.status}
                  className={`${index <= actionStep ? "complete" : ""} ${index === actionStep ? "current" : ""}`}
                  onClick={() => setActionStep(index)}
                  aria-current={index === actionStep ? "step" : undefined}
                >
                  <i>{String(index + 1).padStart(2, "0")}</i>
                  <span>
                    <strong>{stage.label}</strong>
                    <small>{stage.short}</small>
                  </span>
                </button>
              ))}
            </div>
            <div className="workflow-status" aria-live="polite">
              <div>
                <span>SIMULATED STATE</span>
                <code>action_status = {currentStage.status}</code>
              </div>
              <strong>{currentStage.label}</strong>
              <p>{currentStage.description}</p>
              <small>
                CRM field updated: <code>{currentStage.eventField}</code> · No customer is contacted; no external system
                changes.
              </small>
            </div>
          </article>

          <article className="design-card contract-card">
            <span className="card-kicker mint">OUTPUT CONTRACT · THREE LAYERS</span>
            <h3>What exists today, and what is designed</h3>
            <div className="contract-layers">
              <div>
                <b>Notebook demo — implemented</b>
                <p>Six-column risk list: customer, scoring origin, label, probability, decision, priority rank.</p>
                <code>cms_code_enc · window_end · y_churn_t_plus_2 · churn_probability · predicted_churn · priority_rank</code>
              </div>
              <div>
                <b>Production risk export — implemented in the system</b>
                <p>Adds recent behavior aggregates plus up to three structured reasons with metric, baseline, delta and severity.</p>
                <code>item_last · complaint_last · delay_last · reason_1..3 (code · metric · baseline · delta · severity)</code>
              </div>
              <div>
                <b>CRM feedback — proposed design</b>
                <p>Closes the loop so retention impact can be measured after the two-month horizon.</p>
                <code>action_owner · action_status · contacted_at · outcome · retained_after_horizon</code>
              </div>
            </div>
          </article>
        </div>
      </section>

      <section className="section monitoring" id="monitoring">
        <div className="section-label">07 / Promotion &amp; monitoring</div>
        <div className="section-intro split-intro">
          <h2>
            Separate promotion
            <br />
            <em>from monitoring.</em>
          </h2>
          <div>
            <p>
              The notebook’s five asserts are the seed of a bigger discipline: production first decides whether a candidate
              model may be promoted, then monitors score and feature drift by scoring origin. The rules below are aligned
              with the production code; the drift numbers are illustrative mechanics, not run results.
            </p>
          </div>
        </div>

        <article className="promotion-logic">
          <div className="promotion-heading">
            <div>
              <span className="card-kicker">CODE-ALIGNED MODEL PROMOTION</span>
              <h3>What can actually accept or reject a candidate?</h3>
            </div>
            <b>Logic reference · not a run result</b>
          </div>
          <div className="gate-lanes">
            <section>
              <span>01 / CANDIDATE VALIDATION</span>
              <ul>
                <li><b>Walk-forward folds</b><p>Reject if all folds fail, the latest fold is invalid, or the rejected-fold rate exceeds 25%.</p></li>
                <li><b>Final temporal holdout</b><p>Required by default. Main F1 and operating F1 must each clear minimum checks; predicted-positive rate must stay above 0.1%.</p></li>
                <li><b>Sanity comparators</b><p>AP is checked against constant, random and two-feature LR baselines — warnings for investigation, not the promotion rule.</p></li>
              </ul>
            </section>
            <section>
              <span>02 / MONTHLY PROMOTION</span>
              <ul>
                <li><b>Label prevalence</b><p>With a previous bundle available, candidate training prevalence above 45% blocks retraining.</p></li>
                <li><b>Month completeness</b><p>Versus the previous month: rows ≥ 80%, active customers ≥ 50%, items ≥ 70%, revenue ≥ 70%.</p></li>
                <li><b>Current-period comparison</b><p>The candidate F1 must beat the accepted bundle re-evaluated on the current period, plus an epsilon.</p></li>
                <li><b>Safe fallback</b><p>If promotion is rejected, the prior accepted model is retained and monthly scoring continues.</p></li>
              </ul>
            </section>
          </div>
        </article>

        <div className="monitor-system">
          <article className="drift-card">
            <div className="drift-toolbar">
              <div>
                <span className="card-kicker">POST-SCORING MONITORING · ILLUSTRATIVE</span>
                <h3>Score and feature drift by scoring origin</h3>
              </div>
              <div className="month-selector" role="tablist" aria-label="Select scoring origin">
                {monitoringMonths.map((month, index) => (
                  <button key={month.key} className={monitoringMonth === index ? "active" : ""} onClick={() => setMonitoringMonth(index)}>
                    {month.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="drift-columns">
              <div className="score-drift">
                <div className="risk-ratio-chart" aria-label="Illustrative monthly risk ratio">
                  {monitoringMonths.map((month, index) => (
                    <button key={month.key} className={monitoringMonth === index ? "active" : ""} onClick={() => setMonitoringMonth(index)}>
                      <b>{month.riskRatio}%</b>
                      <i style={{ height: `${Math.max(12, month.riskRatio * 3.4)}%` }} />
                      <small>{month.label}</small>
                    </button>
                  ))}
                </div>
                <div className="score-stats">
                  <span><small>P50</small><b>{currentMonitoring.p50}%</b></span>
                  <span><small>P90</small><b>{currentMonitoring.p90}%</b></span>
                  <span><small>P99</small><b>{currentMonitoring.p99}%</b></span>
                  <span><small>Risk ratio</small><b>{currentMonitoring.riskRatio}%</b></span>
                </div>
                <p>
                  The monitor stores active count, risk count, risk ratio and score quantiles per origin; a risk ratio above
                  historical median + 3 MAD is flagged once enough history exists.
                </p>
              </div>
              <div className="feature-drift">
                <div className="drift-table">
                  <div><span>Feature</span><span>PSI</span><span>State</span></div>
                  {featureDrift.map((feature) => {
                    const value = feature.values[monitoringMonth];
                    const state = psiStatus(value);
                    return (
                      <div key={feature.name}>
                        <span className="feature-name">
                          <strong>{feature.label}</strong>
                          <code>{feature.name}</code>
                        </span>
                        <b>{value.toFixed(2)}</b>
                        <em className={state.toLowerCase()}>{state}</em>
                      </div>
                    );
                  })}
                </div>
                <div className="drift-legend">
                  <span><i className="ok" />OK ≤ 0.10</span>
                  <span><i className="warn" />WARN &gt; 0.10</span>
                  <span><i className="alert" />ALERT &gt; 0.20</span>
                </div>
                <p>PSI and discrete KS run feature by feature against the training profile — thresholds match the monitoring code.</p>
              </div>
            </div>
          </article>

          <article className="impact-card">
            <span className="card-kicker">BUSINESS OUTCOME</span>
            <h3>Impact measurement</h3>
            <div className="pending-impact"><strong>Pending</strong><span>validated update</span></div>
            <p>
              Intervention reach, retained customers and attributable revenue will be reported only after action outcomes
              and the two-month measurement window are available from an approved production run.
            </p>
          </article>
        </div>
      </section>

      <section className="section ownership" id="ownership">
        <div className="section-label light">08 / Ownership</div>
        <div className="ownership-grid">
          <div>
            <p className="eyebrow mint"><span /> Role: Data Scientist</p>
            <h2>
              Built for decisions,
              <br />
              <em>and proven in a notebook.</em>
            </h2>
          </div>
          <div className="ownership-copy">
            <p>
              Owned problem formulation, label design, baseline and XGBoost modeling, temporal validation, threshold
              strategy, explainability, risk export, monitoring and production integration. The public notebook demo
              reproduces that pipeline end to end on synthetic data.
            </p>
            <p>Feature definitions and generation were a collaboration with the data engineering team.</p>
          </div>
        </div>
        <div className="stack-row">
          <span>Python</span><span>XGBoost</span><span>scikit-learn</span><span>Optuna</span><span>SHAP</span>
          <span>PostgreSQL</span><span>Airflow</span><span>Docker</span>
        </div>
        <div className="cv-block">
          <span>CV SUMMARY</span>
          <p>
            Developed and productionized a two-month logistics churn model (LR window selection → XGBoost, temporal
            validation, locked-threshold holdout) and shipped a public, reproducible notebook demo achieving F1{" "}
            {holdout.f1.toFixed(2)} / ROC-AUC {holdout.roc_auc.toFixed(2)} on a synthetic holdout, with an explainable,
            capacity-aware intervention queue.
          </p>
        </div>
      </section>

      <footer>
        <div>
          <span className="brand-mark">CP</span>
          <strong>Explainable Customer Churn Prioritization</strong>
        </div>
        <p>
          <Link href="/case-study">Read full case study ↗</Link> · Synthetic demonstration data · Seed {meta.seed}
        </p>
        <a href="#top">Back to top ↑</a>
      </footer>
    </main>
  );
}
