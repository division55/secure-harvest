"""Replay prototype risk scores against held-out historical monsoon rainfall.

This is a small rainfall-deficit proxy check, not crop-loss validation. NASA POWER's
monthly PRECTOTCORR values are gridded/reanalysis rainfall, not farm-gate gauges.
The 20% rainfall-deficit threshold follows the IMD deficient-rainfall category.
"""

from datetime import date
from urllib.parse import urlencode
from urllib.request import Request, urlopen
import json
import math
import statistics

from risk_model import model_instance


SITES = [
    ("Dharwad", 15.4589, 75.0078),
    ("Nagpur (Vidarbha proxy)", 21.1458, 79.0882),
    ("Ludhiana", 30.9010, 75.8573),
    ("Thanjavur", 10.7870, 79.1378),
    ("Warangal", 17.9689, 79.5941),
]
BASELINE_YEARS = range(1981, 2001)
EVALUATION_YEARS = range(2001, 2025)
DEFICIT_FRACTION = 0.20


def fetch_monthly_rainfall(lat, lon):
    query = urlencode({
        "parameters": "PRECTOTCORR",
        "community": "AG",
        "longitude": f"{lon:.4f}",
        "latitude": f"{lat:.4f}",
        "start": min(BASELINE_YEARS),
        "end": max(EVALUATION_YEARS),
        "format": "JSON",
    })
    url = f"https://power.larc.nasa.gov/api/temporal/monthly/point?{query}"
    request = Request(url, headers={"User-Agent": "SecureHarvestCoursework/1.0"})
    with urlopen(request, timeout=45) as response:
        payload = json.loads(response.read().decode("utf-8"))

    values = payload["properties"]["parameter"]["PRECTOTCORR"]
    monthly_totals = {}
    for key, mean_daily_mm in values.items():
        year, month = int(key[:4]), int(key[4:])
        if month < 1 or month > 12 or year < min(BASELINE_YEARS) or year > max(EVALUATION_YEARS):
            continue
        days = (date(year + (month == 12), month % 12 + 1, 1) - date(year, month, 1)).days
        value = float(mean_daily_mm)
        if math.isfinite(value) and value >= 0:
            monthly_totals[(year, month)] = value * days
    return monthly_totals


def brier_score(probabilities, labels):
    return sum((p - y) ** 2 for p, y in zip(probabilities, labels)) / len(labels)


def main():
    rows = []
    site_summaries = []

    for name, lat, lon in SITES:
        rainfall = fetch_monthly_rainfall(lat, lon)
        baseline_months = [rainfall[(year, month)] for year in BASELINE_YEARS for month in range(1, 13)]
        baseline_monsoons = {
            year: sum(rainfall[(year, month)] for month in range(6, 10))
            for year in BASELINE_YEARS
        }
        normal_monsoon = statistics.mean(baseline_monsoons.values())
        baseline_event_rate = sum(
            total < normal_monsoon * (1.0 - DEFICIT_FRACTION)
            for total in baseline_monsoons.values()
        ) / len(baseline_monsoons)
        prediction = model_instance.predict_quote(
            plot_id=name,
            coverage_amount=1.0,
            trigger_threshold=50.0,
            historical_rainfall_mean=statistics.mean(baseline_months),
            historical_rainfall_std=statistics.pstdev(baseline_months),
            soil_retention_index=0.5,
            sensor_distance_km=5.0,
            elevation_m=300.0,
        )["droughtProbability"]

        site_events = 0
        for year in EVALUATION_YEARS:
            monsoon_total = sum(rainfall[(year, month)] for month in range(6, 10))
            label = int(monsoon_total < normal_monsoon * (1.0 - DEFICIT_FRACTION))
            site_events += label
            rows.append({"site": name, "year": year, "risk": prediction, "baseline": baseline_event_rate, "event": label})
        site_summaries.append({"site": name, "risk": prediction, "baseline": baseline_event_rate, "events": site_events})

    labels = [row["event"] for row in rows]
    risks = [row["risk"] for row in rows]
    prevalence = sum(labels) / len(labels)
    baseline_risks = [row["baseline"] for row in rows]
    print("Historical monsoon rainfall replay (NASA POWER PRECTOTCORR)")
    print(f"Baseline: {min(BASELINE_YEARS)}-{max(BASELINE_YEARS)}; evaluation: {min(EVALUATION_YEARS)}-{max(EVALUATION_YEARS)}")
    print("Event label: June-September rainfall at least 20% below each site's baseline mean.")
    print(f"Samples: {len(rows)} site-years; rainfall-deficit events: {sum(labels)} ({prevalence:.1%}).")
    print(f"Model Brier score: {brier_score(risks, labels):.4f}")
    print(f"Earlier-period climatology Brier score: {brier_score(baseline_risks, labels):.4f}")
    print("Per-site prototype risk, earlier-period rate, and held-out deficit count:")
    for summary in site_summaries:
        print(f"  {summary['site']}: model={summary['risk']:.3f}; earlier rate={summary['baseline']:.3f}; events={summary['events']}/{len(EVALUATION_YEARS)}")
    print(f"Limit: five locations and {len(EVALUATION_YEARS)} held-out years; labels are rainfall deficits, not measured crop losses. The model does not use the policy trigger threshold.")


if __name__ == "__main__":
    main()
