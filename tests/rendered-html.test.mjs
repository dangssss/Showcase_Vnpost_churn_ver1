import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function readRenderedPage(relativePath) {
  return readFile(new URL(`../out/${relativePath}`, import.meta.url), "utf8");
}

test("renders the logistics churn case study", async () => {
  const html = await readRenderedPage("index.html");
  assert.match(html, /Explainable Customer Churn Prioritization/);
  assert.match(html, /Predict churn/);
  assert.match(html, /Portfolio-safe edition/);
  assert.match(html, /Purged walk-forward/i);
  assert.match(html, /Synthetic/);
  assert.match(html, /Simulate one monthly scoring run/);
  assert.match(html, /Who reaches the CRM queue/);
  assert.match(html, /CRM-ready CSV contract/);
  assert.match(html, /Score percentile/);
  assert.match(html, /Code-aligned model promotion/i);
  assert.match(html, /Population shift is a time series/i);
  assert.match(html, /Convert one risk profile into a controlled intervention/i);
  assert.match(html, /Implemented in current code/i);
  assert.match(html, /\/Showcase_Vnpost_churn_ver1\/case-study\//);
  assert.match(html, /\/Showcase_Vnpost_churn_ver1\/synthetic_risk_export\.csv/);
});

test("renders the full recruiter-facing case study", async () => {
  const html = await readRenderedPage("case-study/index.html");
  assert.match(html, /From a churn score to a/);
  assert.match(html, /BUSINESS DECISION/);
  assert.match(html, /ROLE &amp; OWNERSHIP/);
  assert.match(html, /MODEL PROMOTION &amp; MONITORING/);
  assert.match(html, /NO FABRICATED METRICS/);
  assert.match(html, /Open decision lab/);
});
