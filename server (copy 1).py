import os
from dotenv import load_dotenv
import json
import logging
from flask import Flask, request, jsonify, send_from_directory, abort
from flask_cors import CORS

# ---------------- Logging ----------------
LOG_DIR = "<add a full path here outside of the neo browser folder> <example- /home/username/Downloads/PROJECTS/NEO-BROWSER-LOGS/>"
os.makedirs(LOG_DIR, exist_ok=True)

LOG_FILE = os.path.join(LOG_DIR, "neobrowser.log")

logging.basicConfig(
    level=logging.DEBUG,
    format="%(asctime)s - %(levelname)s - %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler(LOG_FILE, mode="a", encoding="utf-8")
    ]
)

load_dotenv()
# ---------------- Config ----------------
app = Flask(__name__, static_folder=None)
CORS(app)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
REG_PATH = os.path.join(BASE_DIR, "registry.json")
SERVER_HOST = "0.0.0.0"
SERVER_PORT = 5000
GLOBAL_SERVER_URL = os.getenv("GLOBAL_SERVER_URL")
# ---------------- Registry ----------------
def load_registry():
    if not os.path.exists(REG_PATH):
        logging.error(f"registry.json not found at {REG_PATH}")
        return {}
    try:
        with open(REG_PATH, "r") as f:
            return json.load(f)
    except Exception as e:
        logging.error(f"Error loading registry: {e}")
        return {}

REG = load_registry()

def resolve_domain(domain):
    """Return absolute site root folder for a given .neo domain."""
    domain = domain.strip().lower()
    if domain.startswith("fetch://"):
        domain = domain[len("fetch://"):]
    if domain in REG:
        rel_path = REG[domain].get("path")
        if rel_path:
            abs_path = os.path.join(BASE_DIR, os.path.dirname(rel_path))
            if os.path.exists(abs_path):
                return abs_path
    return None

def search_registry(keyword):
    keyword = keyword.lower().strip()
    results = []
    for domain, meta in REG.items():
        name = meta.get("name", domain)
        if keyword in name.lower() or keyword in domain.lower():
            url = f"{GLOBAL_SERVER_URL}/site/{domain}/"
            results.append([domain, name, url])
    return results

# ---------------- Routes ----------------
@app.route("/search")
def search():
    query = request.args.get("query", "")
    if not query:
        return jsonify({"error": "No query provided"}), 400
    
    root = resolve_domain(query)
    if root:
        url = f"{GLOBAL_SERVER_URL}/site/{query}/"
        return jsonify({"url": url})
    
    results = search_registry(query)
    return jsonify({"results": results})

@app.route("/load")
def load():
    domain = request.args.get("domain", "")
    if not domain:
        return jsonify({"error": "No domain provided"}), 400
    
    root = resolve_domain(domain)
    if root:
        url = f"{GLOBAL_SERVER_URL}/site/{domain}/"
        return jsonify({"url": url})
    
    return jsonify({"error": f"Could not resolve {domain}"}), 400

# Serve site files
@app.route("/site/<domain>/", defaults={"req_path": "index.html"})
@app.route("/site/<domain>/<path:req_path>")
def serve_site(domain, req_path):
    root = resolve_domain(domain)
    if not root:
        abort(404)
    
    file_path = os.path.join(root, req_path)
    if not os.path.exists(file_path):
        abort(404)

    return send_from_directory(root, req_path)

@app.route("/status")
def status():
    return jsonify({
        "status": "online",
        "entries": len(REG),
        "server": f"{GLOBAL_SERVER_URL}",
        "message": "NeoBrowser Global Server"
    })

# ---------------- Run ----------------
if __name__ == "__main__":
    print(f"Starting NeoBrowser Server at http://127.0.0.1:{SERVER_PORT}")
    app.run(host=SERVER_HOST, port=SERVER_PORT, debug=True)
