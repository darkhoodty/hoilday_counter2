import json
import requests
from http.server import SimpleHTTPRequestHandler, HTTPServer
import urllib.parse

SERVICE_KEY = "02Esk57yanQ5IsHwio6g8Z4vtuWTcwZRWatt/+4xEEvBJzj+adaSN0uL+ukMqVoWF1SlgmhWZOUmA2tK4bREnA=="

class CustomProxyHandler(SimpleHTTPRequestHandler):
    def do_GET(self):
        parsed_url = urllib.parse.urlparse(self.path)
        query_params = urllib.parse.parse_qs(parsed_url.query)

        if parsed_url.path == "/api/holidays":
            self.handle_holidays(query_params)
        else:
            super().do_GET()

    def handle_holidays(self, params):
        year = params.get("solYear", params.get("year", ["2026"]))[0]
        month = params.get("solMonth", params.get("month", [""]))[0]

        url = "https://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getRestDeInfo"

        request_params = {
            "serviceKey": SERVICE_KEY,
            "solYear": year,
            "_type": "json"
        }

        if month:
            request_params["solMonth"] = month.zfill(2)

        self.proxy_request(url, request_params)

    def proxy_request(self, url, params):
        try:
            response = requests.get(
                url,
                params=params,
                timeout=10
            )

            print("요청 URL:")
            print(response.url)
            print("상태코드:", response.status_code)

            self.send_response(response.status_code)

            self.send_header(
                "Content-Type",
                response.headers.get(
                    "Content-Type",
                    "application/json; charset=utf-8"
                )
            )

            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()

            self.wfile.write(response.content)

        except Exception as e:
            self.send_response(500)
            self.send_header(
                "Content-Type",
                "application/json; charset=utf-8"
            )
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()

            error_data = {
                "error": str(e),
                "message": "Failed to fetch holiday data"
            }

            self.wfile.write(
                json.dumps(error_data).encode("utf-8")
            )

def run(port=8000):
    server_address = ("", port)
    httpd = HTTPServer(server_address, CustomProxyHandler)

    print(f"서버 시작: http://localhost:{port}")

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n서버 종료")
        httpd.server_close()

if __name__ == "__main__":
    run()
