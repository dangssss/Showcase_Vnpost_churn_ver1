import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function readRenderedPage(relativePath) {
  return readFile(new URL(`../out/${relativePath}`, import.meta.url), "utf8");
}

test("renders the logistics churn showcase with real notebook outputs", async () => {
  const html = await readRenderedPage("index.html");
  assert.match(html, /Explainable Customer Churn Prioritization/);
  assert.match(html, /Predict churn/);
  assert.match(html, /Portfolio-safe edition/);
  assert.match(html, /NO PRODUCTION DATA/);
  // Notebook run scale
  assert.match(html, /1,400/);
  assert.match(html, /30,800/);
  assert.match(html, /synthetic customers/);
  // Model development: LR sweep selects K=13, XGBoost wins with d6_regularized
  assert.match(html, /LR SWEEP/i);
  assert.match(html, /XGBOOST TUNING/i);
  assert.match(html, /d6_regularized/);
  assert.match(html, /0\.7145/);
  // Synthetic holdout results
  assert.match(html, /Synthetic holdout results/i);
  assert.match(html, /0\.714/);
  assert.match(html, /0\.913/);
  assert.match(html, />915</);
  assert.match(html, />236</);
  assert.match(html, /missed churners/i);
  // Decision lab interactivity and real exports
  assert.match(html, /Decision lab/i);
  assert.match(html, /Flag customers with probability/);
  assert.match(html, /T0000955/);
  assert.match(html, /notebook_risk_list\.csv/);
  assert.match(html, /notebook_monthly_behavior\.csv/);
  // Explainability honesty: gain importance in the demo, SHAP as production design
  assert.match(html, /XGBOOST GAIN/i);
  assert.match(html, /lifetime_avg_satisfaction/);
  assert.match(html, /SHAP evidence mapped to eight business reasons/i);
  // Production design and monitoring layers stay clearly labeled
  assert.match(html, /From notebook to production/i);
  assert.match(html, /Code-aligned model promotion/i);
  assert.match(html, /Logic reference · not a run result/i);
  // Static-export base path
  assert.match(html, /\/Showcase_Vnpost_churn_ver1\/case-study\//);
});

test("renders the full recruiter-facing case study", async () => {
  const html = await readRenderedPage("case-study/index.html");
  assert.match(html, /From a churn score to a/);
  assert.match(html, /BUSINESS DECISION/);
  assert.match(html, /ROLE &amp; OWNERSHIP/);
  assert.match(html, /FEATURE MANAGEMENT/);
  assert.match(html, /Does this need a Feature Store/i);
  assert.match(html, /THE NOTEBOOK DEMO/);
  assert.match(html, /SYNTHETIC HOLDOUT · REAL NOTEBOOK OUTPUT/);
  assert.match(html, /RISK VS\. VALUE/);
  assert.match(html, /Expected Value of Retention/);
  assert.match(html, /HIGH CHURN · HIGH VALUE/);
  assert.match(html, /From reason to response/i);
  assert.match(html, /PRODUCTION &amp; OVERLAY/);
  assert.match(html, /reacting to an incident without retraining/i);
  assert.match(html, /overlay_severity/);
  assert.match(html, /MODEL PROMOTION &amp; MONITORING/);
  assert.match(html, /REVIEW &amp; APPROVAL/);
  assert.match(html, /FEEDBACK LOOP/);
  assert.match(html, /Retention lift/);
  assert.match(html, /Roadmap: what a production-grade system adds next/i);
  assert.match(html, /NO FABRICATED METRICS/);
  assert.match(html, /Open decision lab/);
  assert.match(html, /notebook_risk_list\.csv/);
});
