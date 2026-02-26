from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views.auth import AuthStatusView, LoginView, LogoutView, auth_login_oauth, oauth_callback, auth_logout_oauth, DataView
from .views.teams import TeamViewSet, SeasonViewSet, TeamSeasonViewSet, PlayerViewSet
from .views.matches import MatchViewSet, MatchFormatViewSet, PlayerScoreViewSet
from .views.spond import SpondGroupsView, SpondEventsView, SpondMembersView
from .views.availability import AvailabilityViewSet
from .views.images import PlayerImageView, StaticProxyView

router = DefaultRouter()
router.register(r'teams', TeamViewSet, basename='team')
router.register(r'seasons', SeasonViewSet)
router.register(r'team-seasons', TeamSeasonViewSet)
router.register(r'players', PlayerViewSet)
router.register(r'matches', MatchViewSet)
router.register(r'match-formats', MatchFormatViewSet)
router.register(r'player-scores', PlayerScoreViewSet)
router.register(r'availabilities', AvailabilityViewSet)

urlpatterns = [
    # Auth Endpoints
    path('auth/status/', AuthStatusView.as_view(), name='auth-status'),
    path('auth/login/', LoginView.as_view(), name='auth-login'),
    path('auth/logout/', LogoutView.as_view(), name='auth-logout'),
    path('auth/oauth/login/', auth_login_oauth, name='oauth-login'),
    path('auth/oauth/callback/', oauth_callback, name='oauth-callback'),
    path('auth/oauth/logout/', auth_logout_oauth, name='oauth-logout'),
    path('auth/oauth/logout/', auth_logout_oauth, name='oauth-logout'),
    path('data/', DataView.as_view(), name='data-csrf'),
    
    # Player Images
    path('player-image/<str:player_name>/', PlayerImageView.as_view(), name='player-image'),
    path('static-proxy/<path:filepath>', StaticProxyView.as_view(), name='static-proxy'),

    # Spond Endpoints
    path('spond/groups/', SpondGroupsView.as_view(), name='spond-groups'),
    path('spond/events/', SpondEventsView.as_view(), name='spond-events'),
    path('spond/members/', SpondMembersView.as_view(), name='spond-members'),
    
    # ViewSets
    path('', include(router.urls)),
]
