import os

class ApiTrailingSlashMiddleware:
    """
    Middleware that ensures API requests are handled correctly regarding trailing slashes.
    If a request to /api/ comes in without a trailing slash, it adds one internally
    so that Django's router can find the match without requiring a 301 redirect
    (which breaks PUT/POST/DELETE requests).
    """
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        path = request.path_info
        
        # Only target /api/ routes that don't have a trailing slash
        # and don't look like a file (have an extension)
        if path.startswith('/api/') and not path.endswith('/') and '.' not in os.path.basename(path):
            request.path_info = path + '/'
            
        response = self.get_response(request)
        return response
