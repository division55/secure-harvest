"""
SecureHarvest AI Pricing Microservice
Exposes REST endpoints for plot-specific risk premium quotes and basis risk evaluation.
"""

from http.server import HTTPServer, BaseHTTPRequestHandler
import json
import os
import sys

# Ensure local imports work regardless of execution directory
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from risk_model import model_instance

class PricingRequestHandler(BaseHTTPRequestHandler):
    def _send_json(self, status_code: int, data: dict):
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.end_headers()
        self.wfile.write(json.dumps(data).encode("utf-8"))

    def do_OPTIONS(self):
        self._send_json(200, {"status": "OK"})

    def do_GET(self):
        if self.path == "/health":
            self._send_json(200, {"status": "HEALTHY", "service": "SecureHarvest AI Pricing Engine"})
        else:
            self._send_json(404, {"error": "Endpoint not found"})

    def do_POST(self):
        if self.path == "/api/pricing/quote":
            content_length = int(self.headers.get("Content-Length", 0))
            body_data = self.rfile.read(content_length)
            
            try:
                payload = json.loads(body_data.decode("utf-8"))
            except Exception as e:
                return self._send_json(400, {"error": "Invalid JSON body", "details": str(e)})

            plot_id = payload.get("plotId", "plot-default")
            coverage_amount = float(payload.get("coverageAmount", 1.0))
            trigger_threshold = float(payload.get("triggerThreshold", 50.0))
            rainfall_mean = float(payload.get("historicalRainfallMean", 60.0))
            rainfall_std = float(payload.get("historicalRainfallStd", 15.0))
            soil_retention = float(payload.get("soilRetentionIndex", 0.5))
            sensor_distance = float(payload.get("sensorDistanceKm", 5.0))
            elevation = float(payload.get("elevationMeters", 300.0))

            quote = model_instance.predict_quote(
                plot_id=plot_id,
                coverage_amount=coverage_amount,
                trigger_threshold=trigger_threshold,
                historical_rainfall_mean=rainfall_mean,
                historical_rainfall_std=rainfall_std,
                soil_retention_index=soil_retention,
                sensor_distance_km=sensor_distance,
                elevation_m=elevation
            )

            self._send_json(200, quote)
        else:
            self._send_json(404, {"error": "Endpoint not found"})

def run_server(port=5000):
    server_address = ("", port)
    httpd = HTTPServer(server_address, PricingRequestHandler)
    print(f"🌾 SecureHarvest AI Pricing Microservice running on port {port}")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down AI pricing service...")
        httpd.server_close()

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    run_server(port)
