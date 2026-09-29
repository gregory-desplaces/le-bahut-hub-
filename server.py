#!/usr/bin/env python3
"""Petit serveur local pour Le Bahut Hub.

Sert les fichiers statiques du dossier et expose quelques routes API
pour que les données (liens de cours, raccourcis) soient écrites
directement dans les fichiers versionnés par git, et pour déclencher
un git pull / git push depuis l'interface — c'est ce mécanisme qui
sert de "synchronisation" entre plusieurs postes.
"""
import json
import subprocess
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DATA_DIR = ROOT / "data"

# Whitelist stricte : on n'écrit jamais un chemin fourni par le client.
SAVE_TARGETS = {
    "liens": DATA_DIR / "liens.json",
    "config": DATA_DIR / "config.json",
    "support": DATA_DIR / "support.json",
}


def run_git(*args):
    result = subprocess.run(
        ["git", *args], cwd=ROOT, capture_output=True, text=True, timeout=30
    )
    return result.returncode, (result.stdout + result.stderr).strip()


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def log_message(self, fmt, *args):
        pass  # évite de polluer la console

    def _send_json(self, status, payload):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        if self.path == "/api/save":
            self._handle_save()
        elif self.path == "/api/git-pull":
            self._handle_git_pull()
        elif self.path == "/api/git-push":
            self._handle_git_push()
        else:
            self._send_json(404, {"ok": False, "message": "Route inconnue"})

    def _read_json_body(self):
        length = int(self.headers.get("Content-Length", 0))
        raw = self.rfile.read(length) if length else b"{}"
        return json.loads(raw or b"{}")

    def _handle_save(self):
        try:
            body = self._read_json_body()
            target = body.get("file")
            data = body.get("data")
            path = SAVE_TARGETS.get(target)
            if path is None:
                self._send_json(400, {"ok": False, "message": f"Fichier inconnu: {target}"})
                return
            path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
            self._send_json(200, {"ok": True, "message": "Enregistré"})
        except Exception as exc:
            self._send_json(500, {"ok": False, "message": str(exc)})

    def _handle_git_pull(self):
        code, out = run_git("pull", "--ff-only")
        self._send_json(200 if code == 0 else 500, {"ok": code == 0, "message": out or "OK"})

    def _handle_git_push(self):
        try:
            run_git("add", "-A")
            status_code, status_out = run_git("status", "--porcelain")
            if status_out.strip() == "":
                self._send_json(200, {"ok": True, "message": "Rien à publier, déjà à jour."})
                return
            import socket
            commit_msg = f"Mise à jour des données depuis {socket.gethostname()}"
            commit_code, commit_out = run_git("commit", "-m", commit_msg)
            if commit_code != 0:
                self._send_json(500, {"ok": False, "message": commit_out})
                return
            push_code, push_out = run_git("push")
            self._send_json(200 if push_code == 0 else 500, {"ok": push_code == 0, "message": push_out or "Publié"})
        except Exception as exc:
            self._send_json(500, {"ok": False, "message": str(exc)})


if __name__ == "__main__":
    import sys
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8791
    server = ThreadingHTTPServer(("localhost", port), Handler)
    print(f"Le Bahut Hub sur http://localhost:{port}")
    server.serve_forever()
