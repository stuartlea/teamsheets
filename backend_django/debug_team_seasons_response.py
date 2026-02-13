import os
import django
import json

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from rest_framework.test import APIRequestFactory
from api.views.teams import TeamSeasonViewSet
from api.models import TeamSeason

factory = APIRequestFactory()
request = factory.get('/api/team-seasons/')
view = TeamSeasonViewSet.as_view({'get': 'list'})

# Force authentication/user context if needed?
# Typically ViewSets need request.user
from django.contrib.auth.models import User
user = User.objects.first() # Get superuser
from rest_framework.test import force_authenticate

request.user = user
force_authenticate(request, user=user)

response = view(request)
print(json.dumps(response.data, indent=2, default=str))
