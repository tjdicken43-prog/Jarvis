"""Offline test of the website audit and scoring, against a local web server."""
import http.server, importlib.util, pathlib, threading

spec = importlib.util.spec_from_file_location("scan", pathlib.Path(__file__).parents[1] / "prospects" / "scan.py")
scan = importlib.util.module_from_spec(spec); spec.loader.exec_module(scan)

PAGES = {
    "/old": "<html><head><title>Joe's Auto</title></head><body>" + "x" * 2000 + " &copy; 2014 Joe's Auto joe@joesauto.com</body></html>",
    "/good": '<html><head><meta name="viewport" content="width=device-width"><title>Good</title></head><body>'
             + "y" * 2000 + ' <a href="tel:4795550100">call</a> © 2026</body></html>',
    "/parked": "<html><body>This domain is for sale! " + "z" * 900 + "</body></html>",
}

class H(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        body = PAGES.get(self.path)
        self.send_response(200 if body else 404); self.end_headers()
        self.wfile.write((body or "nope").encode())
    def log_message(self, *a): pass

srv = http.server.HTTPServer(("127.0.0.1", 0), H)
threading.Thread(target=srv.serve_forever, daemon=True).start()
base = f"http://127.0.0.1:{srv.server_port}"

old = scan.audit(base + "/old")
assert old["state"] == "DATED" and "© 2014" in old["flags"] and old["emails"] == ["joe@joesauto.com"], old
assert scan.audit(base + "/good")["state"] == "OK-ISH"           # only "no https" left
assert scan.audit(base + "/parked")["state"] == "BROKEN"
assert scan.audit(base + "/missing")["state"] == "BROKEN"
assert scan.audit("https://www.facebook.com/joesauto")["state"] == "SOCIAL ONLY"

p = scan.place_from({"type": "node", "id": 1, "lat": 36.37, "lon": -94.2,
                     "tags": {"name": "Joe's Auto", "shop": "car_repair", "phone": "+1 479 555 0100",
                              "addr:street": "Main St", "addr:housenumber": "5", "opening_hours": "Mo-Fr 08:00-17:00"}})
p["site"] = {"state": "NO SITE"}
assert p["trade"] == "Auto repair" and scan.score(p) == 9, scan.score(p)
assert scan.place_from({"type": "node", "id": 2, "tags": {"name": "Jiffy", "shop": "car_repair", "brand": "Jiffy Lube"}}) is None
print("scan ok")
