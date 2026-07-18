"""Generate a deterministic, portfolio-safe example of the churn risk export."""

from __future__ import annotations

import csv
import random
from pathlib import Path
from statistics import mean, pstdev


OUTPUT = Path(__file__).parent / "sample" / "synthetic_risk_export.csv"
PUBLIC_OUTPUT = Path(__file__).parents[1] / "public" / "synthetic_risk_export.csv"
MONTHLY_OUTPUT = Path(__file__).parent / "sample" / "synthetic_monthly_behavior.csv"
PUBLIC_MONTHLY_OUTPUT = Path(__file__).parents[1] / "public" / "synthetic_monthly_behavior.csv"
MONTHS = ("2412", "2501", "2502", "2503", "2504", "2505")
SYNTHETIC_IDS = (
    "SYN-LG-0412", "SYN-LG-1865", "SYN-LG-2308", "SYN-LG-3174", "SYN-LG-4091", "SYN-LG-5220",
    *(f"SYN-LG-{index:04d}" for index in range(7, 31)),
)


def build_monthly_behavior() -> list[dict[str, object]]:
    """Create a deterministic longitudinal cohort, not six unrelated snapshots."""
    randomizer = random.Random(143)
    rows: list[dict[str, object]] = []
    for index, customer_id in enumerate(SYNTHETIC_IDS, 1):
        risk_latent = max(0.12, min(0.92, 0.94 - index * 0.021))
        base_items = randomizer.randint(70, 260)
        base_value = randomizer.randint(65_000, 185_000)
        base_complaints = randomizer.randint(0, 2)
        base_delay = randomizer.uniform(2.5, 6.0)
        base_nodone = randomizer.uniform(1.8, 5.0)
        base_services = randomizer.randint(3, 7)
        low_tenure = index % 7 == 0

        for month_index, month in enumerate(MONTHS):
            progress = month_index / (len(MONTHS) - 1)
            item_noise = 1 + randomizer.uniform(-0.07, 0.07)
            items = max(6, round(base_items * (1 - 0.58 * risk_latent * progress) * item_noise))
            avg_value = max(30_000, round(base_value * (1 - 0.30 * risk_latent * progress) * (1 + randomizer.uniform(-0.04, 0.04))))
            complaints = max(0, round(base_complaints + 4.2 * risk_latent * progress + randomizer.uniform(-0.6, 0.6)))
            delay_rate = max(0.0, base_delay + 8.0 * risk_latent * progress + randomizer.uniform(-0.5, 0.5))
            nodone_rate = max(0.0, base_nodone + 6.0 * risk_latent * progress + randomizer.uniform(-0.4, 0.4))
            service_types = max(1, base_services - round(2.0 * risk_latent * progress))
            if month_index == len(MONTHS) - 1:
                items = max(4, round(items * (1 - 0.38 * risk_latent)))
                avg_value = max(25_000, round(avg_value * (1 - 0.15 * risk_latent)))
                complaints += max(1, round(3.0 * risk_latent))
                delay_rate += 4.0 * risk_latent
                nodone_rate += 3.0 * risk_latent
                if risk_latent > 0.45:
                    service_types = max(1, service_types - 1)
            active_months = month_index + 1 if low_tenure else 6
            rows.append({
                "cms_code_enc": customer_id,
                "window_end": month,
                "item_count": items,
                "total_fee": items * avg_value,
                "complaint_count": complaints,
                "delay_rate_pct": round(delay_rate, 2),
                "nodone_rate_pct": round(nodone_rate, 2),
                "avg_order_value": avg_value,
                "service_types": service_types,
                "active_months": active_months,
                "risk_latent_for_generation": round(risk_latent, 4),
            })
    return rows


def build_reasons_from_series(series: list[dict[str, object]]) -> list[dict[str, object]]:
    """Apply the same eight reason thresholds used by export_risk_mode."""
    current = series[-1]
    previous = series[-4:-1]
    candidates: list[dict[str, object]] = []

    def avg(key: str) -> float:
        return mean(float(row[key]) for row in previous)

    def add(priority: int, code: str, text: str, metric: float, baseline: float, delta_pct: float) -> None:
        candidates.append({
            "priority": priority,
            "code": code,
            "text": text,
            "metric": round(metric, 2),
            "baseline": round(baseline, 2),
            "delta": round(metric - baseline, 2),
            "delta_pct": round(delta_pct, 4),
            "severity": round(priority + max(delta_pct, 0), 4),
        })

    metric = float(current["item_count"])
    baseline = avg("item_count")
    if baseline > 0 and metric < 0.6 * baseline:
        change = 1 - metric / baseline
        add(10, "item_drop", f"Số bưu gửi tháng hiện tại thấp hơn {change * 100:.0f}% so với trung bình 3 tháng liền trước", metric, baseline, change)

    metric = float(current["complaint_count"])
    baseline = avg("complaint_count")
    if baseline > 0 and metric > 1.15 * baseline:
        change = metric / baseline - 1
        add(9, "complaint_increase", f"Số lượng khiếu nại nhận được tăng {change * 100:.0f}% so với trung bình 3 tháng liền trước", metric, baseline, change)

    metric = float(current["delay_rate_pct"])
    baseline = avg("delay_rate_pct")
    if baseline > 0 and metric > 1.15 * baseline:
        change = metric / baseline - 1
        add(8, "delay_rate_increase", f"Tỷ lệ số đơn giao muộn tăng {change * 100:.0f}% so với trung bình 3 tháng liền trước", metric, baseline, change)

    metric = float(current["nodone_rate_pct"])
    baseline = avg("nodone_rate_pct")
    if baseline > 0 and metric > 1.15 * baseline:
        change = metric / baseline - 1
        add(7, "nodone_rate_increase", f"Tỷ lệ số đơn không hoàn thành tăng {change * 100:.0f}% so với trung bình 3 tháng liền trước", metric, baseline, change)

    item_values = [float(row["item_count"]) for row in series]
    metric = pstdev(item_values) / mean(item_values) if mean(item_values) else 0.0
    if metric > 0.7:
        change = metric / 0.7 - 1
        add(6, "volume_volatility", f"Biến động số lượng bưu gửi cao (CV={metric:.2f})", metric, 0.7, change)

    metric = float(current["avg_order_value"])
    baseline = avg("avg_order_value")
    if baseline > 0 and metric < baseline:
        change = 1 - metric / baseline
        add(5, "order_value_drop", f"Giá trị đơn hàng trung bình giảm {change * 100:.0f}% theo thời gian", metric, baseline, change)

    metric = float(current["service_types"])
    baseline = max(float(row["service_types"]) for row in previous)
    if baseline > 0 and metric < baseline:
        change = 1 - metric / baseline
        add(4, "service_diversity_drop", f"Giảm đa dạng dịch vụ (giảm từ {int(baseline)} còn {int(metric)} loại)", metric, baseline, change)

    metric = float(current["active_months"])
    if metric < 6:
        change = 1 - metric / 6
        add(3, "low_tenure", f"Khách hàng mới, mức độ gắn bó thấp ({int(metric)} tháng)", metric, 6.0, change)

    candidates.sort(key=lambda reason: (float(reason["priority"]), float(reason["severity"])), reverse=True)
    return candidates[:3]


def main() -> None:
    randomizer = random.Random(42)
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    PUBLIC_OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    monthly_rows = build_monthly_behavior()
    fieldnames = [
        "cms_code_enc", "window_end", "predict_period", "item_last",
        "revenue_last", "complaint_last", "delay_last", "nodone_last",
        "order_score_last", "satisfaction_last", "churn_rate",
        "model_probability_pct", "reason_1", "reason_1_code",
        "reason_1_metric", "reason_1_baseline", "reason_1_delta",
        "reason_1_delta_pct", "reason_1_severity", "reason_2",
        "reason_2_code", "reason_2_metric", "reason_2_baseline",
        "reason_2_delta", "reason_2_delta_pct", "reason_2_severity",
        "reason_3", "reason_3_code", "reason_3_metric",
        "reason_3_baseline", "reason_3_delta", "reason_3_delta_pct",
        "reason_3_severity", "updated_at",
    ]

    series_by_customer: dict[str, list[dict[str, object]]] = {}
    for monthly_row in monthly_rows:
        series_by_customer.setdefault(str(monthly_row["cms_code_enc"]), []).append(monthly_row)

    rows = []
    for customer_id in SYNTHETIC_IDS:
        series = series_by_customer[customer_id]
        current = series[-1]
        risk_latent = float(current["risk_latent_for_generation"])
        probability = round(min(96.0, 28 + 66 * risk_latent + randomizer.uniform(-1.2, 1.2)), 2)
        selected_reasons = build_reasons_from_series(series)
        if len(selected_reasons) < 3:
            raise RuntimeError(f"Synthetic profile {customer_id} produced fewer than three reasons")
        row: dict[str, object] = {
            "cms_code_enc": customer_id,
            "window_end": "2505",
            "predict_period": "2507",
            "item_last": current["item_count"],
            "revenue_last": current["total_fee"],
            "complaint_last": current["complaint_count"],
            "delay_last": current["delay_rate_pct"],
            "nodone_last": current["nodone_rate_pct"],
            "order_score_last": round(max(1.0, 4.8 - 1.8 * risk_latent + randomizer.uniform(-0.15, 0.15)), 2),
            "satisfaction_last": round(max(1.0, 4.7 - 1.6 * risk_latent + randomizer.uniform(-0.15, 0.15)), 2),
            "churn_rate": round(probability / 100, 4),
            "model_probability_pct": probability,
            "updated_at": "2025-06-02T08:00:00Z",
        }
        for reason_index, reason in enumerate(selected_reasons, 1):
            row.update({
                f"reason_{reason_index}": reason["text"],
                f"reason_{reason_index}_code": reason["code"],
                f"reason_{reason_index}_metric": reason["metric"],
                f"reason_{reason_index}_baseline": reason["baseline"],
                f"reason_{reason_index}_delta": reason["delta"],
                f"reason_{reason_index}_delta_pct": reason["delta_pct"],
                f"reason_{reason_index}_severity": reason["severity"],
            })
        rows.append(row)

    for destination in (OUTPUT, PUBLIC_OUTPUT):
        with destination.open("w", newline="", encoding="utf-8-sig") as file:
            writer = csv.DictWriter(file, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(rows)
    monthly_fieldnames = list(monthly_rows[0])
    for destination in (MONTHLY_OUTPUT, PUBLIC_MONTHLY_OUTPUT):
        with destination.open("w", newline="", encoding="utf-8-sig") as file:
            writer = csv.DictWriter(file, fieldnames=monthly_fieldnames)
            writer.writeheader()
            writer.writerows(monthly_rows)
    print(
        f"Wrote {len(rows)} risk rows and {len(monthly_rows)} monthly behavior rows "
        f"to data/sample and public"
    )


if __name__ == "__main__":
    main()
