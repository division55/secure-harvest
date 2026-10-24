
"""SecureHarvest AI Pricing Microservice.

Retrieves real historical rainfall from NASA POWER for a farmer-entered
location. Satellite NDVI remains optional until credentials are configured.
"""

from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from urllib.error import URLError, HTTPError
from collections import defaultdict
import json
import math
import os
import statistics
import sys

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from risk_model import model_instance

NASA_START_DATE = os.environ.get("NASA_POWER_START_DATE", "20150101")
NASA_END_DATE = os.environ.get("NASA_POWER_END_DATE", "20241231")
USER_AGENT = "SecureHarvestStudentProject/1.0"


def get_json(url, timeout=35):
    request = Request(
        url,
        headers={"User-Agent": USER_AGENT, "Accept": "application/json"}
    )
    with urlopen(request, timeout=timeout) as response:
        return json.loads(response.read().decode("utf-8"))


def geocode_location(location):
    """Convert a place name or address into coordinates."""
    if not location or not location.strip():
        raise ValueError("Please enter your farm location.")

    query = urlencode({
        "q": location.strip(),
        "format": "jsonv2",
        "limit": 1
    })

    results = get_json(
        f"https://nominatim.openstreetmap.org/search?{query}",
        timeout=20
    )

    if not results:
        raise ValueError(
            "Location not found. Try a more specific address or city."
        )

    result = results[0]

    return {
        "latitude": float(result["lat"]),
        "longitude": float(result["lon"]),
        "displayName": result.get("display_name", location),
        "geocodingSource": "OpenStreetMap Nominatim"
    }


def fetch_nasa_power_rainfall(latitude, longitude):
    """Fetch daily rainfall and calculate monthly rainfall statistics."""
    if not (-90 <= latitude <= 90 and -180 <= longitude <= 180):
        raise ValueError("Invalid latitude or longitude.")

    query = urlencode({
        "parameters": "PRECTOTCORR",
        "community": "AG",
        "longitude": f"{longitude:.5f}",
        "latitude": f"{latitude:.5f}",
        "start": NASA_START_DATE,
        "end": NASA_END_DATE,
        "format": "JSON"
    })

    url = (
        "https://power.larc.nasa.gov/api/temporal/daily/point?"
        + query
    )
    payload = get_json(url)

    try:
        daily_values = payload["properties"]["parameter"]["PRECTOTCORR"]
    except (KeyError, TypeError) as exc:
        raise RuntimeError(
            "NASA POWER returned an unexpected rainfall response."
        ) from exc

    monthly_totals = defaultdict(float)
    valid_days = defaultdict(int)

    for date_key, raw_value in daily_values.items():
        value = float(raw_value)

        # Ignore missing/invalid NASA POWER values.
        if not math.isfinite(value) or value < 0 or value >= 900:
            continue

        month = date_key[:6]
        monthly_totals[month] += value
        valid_days[month] += 1

    # Exclude incomplete months.
    complete_months = [
        monthly_totals[month]
        for month in sorted(monthly_totals)
        if valid_days[month] >= 25
    ]

    if len(complete_months) < 24:
        raise RuntimeError(
            "Not enough complete rainfall months were returned."
        )

    return {
        "historicalRainfallMean": round(
            statistics.mean(complete_months), 3
        ),
        "historicalRainfallStd": round(
            statistics.pstdev(complete_months), 3
        ),
        "unit": "mm/month",
        "source": "NASA POWER PRECTOTCORR",
        "periodStart": NASA_START_DATE,
        "periodEnd": NASA_END_DATE,
        "completeMonths": len(complete_months),
        "monthlyTotalsSample": [
            round(value, 2) for value in complete_months[-12:]
        ]
    }


class PricingRequestHandler(BaseHTTPRequestHandler):

    def send_json(self, status, data):
        body = json.dumps(data).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_json(200, {"status": "OK"})

    def do_GET(self):
        if self.path == "/health":
            self.send_json(200, {
                "status": "HEALTHY",
                "service": "SecureHarvest AI Pricing Engine"
            })
        else:
            self.send_json(404, {"error": "Endpoint not found"})

    def do_POST(self):
        if self.path != "/api/pricing/quote":
            self.send_json(404, {"error": "Endpoint not found"})
            return

        try:
            length = int(self.headers.get("Content-Length", 0))
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
        except (ValueError, UnicodeDecodeError, json.JSONDecodeError) as exc:
            self.send_json(400, {
                "error": "Invalid JSON request",
                "details": str(exc)
            })
            return

        try:
            plot_id = str(payload.get("plotId", "plot-default"))
            coverage = float(payload.get("coverageAmount", 1.0))
            threshold = float(payload.get("triggerThreshold", 50.0))

            if coverage <= 0:
                raise ValueError("Coverage must be greater than zero.")

            location = str(payload.get("location", "")).strip()
            latitude = payload.get("latitude")
            longitude = payload.get("longitude")

            if latitude is None or longitude is None:
                if not location:
                    raise ValueError(
                        "Enter a farm location to retrieve rainfall data."
                    )
                geo = geocode_location(location)
                latitude = geo["latitude"]
                longitude = geo["longitude"]
            else:
                latitude = float(latitude)
                longitude = float(longitude)
                geo = {
                    "latitude": latitude,
                    "longitude": longitude,
                    "displayName": location or (
                        f"{latitude:.5f}, {longitude:.5f}"
                    ),
                    "geocodingSource": "User-provided coordinates"
                }

            rainfall = fetch_nasa_power_rainfall(latitude, longitude)

            quote = model_instance.predict_quote(
                plot_id=plot_id,
                coverage_amount=coverage,
                trigger_threshold=threshold,
                historical_rainfall_mean=rainfall[
                    "historicalRainfallMean"
                ],
                historical_rainfall_std=rainfall[
                    "historicalRainfallStd"
                ],
                soil_retention_index=float(
                    payload.get("soilRetentionIndex", 0.5)
                ),
                sensor_distance_km=float(
                    payload.get("sensorDistanceKm", 5.0)
                ),
                elevation_m=float(
                    payload.get("elevationMeters", 300.0)
                )
            )

            quote["location"] = geo
            quote["environmentalData"] = {
                "rainfall": rainfall,
                "ndvi": {
                    "status": "NOT_CONFIGURED",
                    "value": None,
                    "source": None,
                    "message": (
                        "NDVI is unavailable until satellite data access "
                        "is configured. No NDVI value has been fabricated."
                    )
                },
                "modelNotice": (
                    "Rainfall is retrieved from NASA POWER. The current "
                    "Random Forest uses synthetic training labels, so its "
                    "drought probabilities are prototype estimates and "
                    "are not yet validated against real drought outcomes."
                )
            }
            quote["source"] = "NASA_POWER_RAINFALL"

            self.send_json(200, quote)

        except ValueError as exc:
            self.send_json(400, {
                "error": str(exc),
                "source": "DATA_UNAVAILABLE"
            })
        except (HTTPError, URLError, TimeoutError, OSError) as exc:
            self.send_json(502, {
                "error": (
                    "Could not retrieve location or rainfall data. "
                    "Check your internet connection and try again."
                ),
                "details": str(exc),
                "source": "DATA_UNAVAILABLE"
            })
        except Exception as exc:
            self.send_json(502, {
                "error": "Could not process the environmental data.",
                "details": str(exc),
                "source": "DATA_UNAVAILABLE"
            })


def run_server(port=5000):
    server = HTTPServer(("", port), PricingRequestHandler)
    print(f"SecureHarvest pricing service running on port {port}")
    print("Rainfall source: NASA POWER")
    print("NDVI: optional, not configured")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping pricing service...")
        server.server_close()


if __name__ == "__main__":
    run_server(int(os.environ.get("PORT", 5000)))
