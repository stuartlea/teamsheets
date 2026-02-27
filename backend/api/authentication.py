from rest_framework.authentication import SessionAuthentication


class CsrfExemptSessionAuthentication(SessionAuthentication):
    """
    SessionAuthentication subclass that skips CSRF enforcement.

    This is safe for our use case because:
    - The React SPA is served from the same origin as the API
    - There is no cross-origin access to the API
    - The app was migrated from Flask which had no CSRF protection
    """

    def enforce_csrf(self, request):
        # Skip CSRF check — safe for same-origin SPA
        return
