"""Sirve la página en http://localhost:8000 sin caché, para que cada recarga use el código más reciente."""

from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

PUERTO = 8000


class SinCache(SimpleHTTPRequestHandler):
    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


if __name__ == "__main__":
    manejador = partial(SinCache, directory=Path(__file__).parent)
    print(f"Página en http://localhost:{PUERTO} (Ctrl + C para detener)")
    ThreadingHTTPServer(("localhost", PUERTO), manejador).serve_forever()
