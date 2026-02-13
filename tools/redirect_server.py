import http.server
import socketserver
import urllib.parse

PORT = 5000
TARGET_BASE = "http://localhost:8000"

class RedirectHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        # Parse the path and query
        parsed = urllib.parse.urlparse(self.path)
        
        # Construct the new URL
        new_url = f"{TARGET_BASE}{self.path}"
        
        print(f"Redirecting {self.path} -> {new_url}")
        
        # Send 302 Redirect
        self.send_response(302)
        self.send_header('Location', new_url)
        self.end_headers()

if __name__ == "__main__":
    Handler = RedirectHandler
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        print(f"Redirect Server running at port {PORT}, forwarding to {TARGET_BASE}")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            pass
