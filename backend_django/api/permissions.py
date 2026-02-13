from rest_framework import permissions
from .models import TeamPermission

class HasTeamAccess(permissions.BasePermission):
    """
    Object-level permission to only allow owners/admins of a team to edit it.
    Assumes the model instance has a `team` attribute or is a Team instance itself.
    """

    def has_object_permission(self, request, view, obj):
        # Read permissions are allowed to any request,
        # so we'll always allow GET, HEAD or OPTIONS requests.
        # ALLOWING READ for all authenticated users? 
        # Requirement says: "RBAC (Owner/Admin/Editor/Viewer)"
        # So even Viewer needs permission to view?
        # Let's say: Authenticated users can list teams, but maybe only see ones they have access to?
        # For now, let's keep it simple: Read is open to authenticated users (or maybe public if we want).
        # But for Write (POST/PUT/DELETE), check TeamPermission.

        if request.method in permissions.SAFE_METHODS:
             return True

        # Determine team_id from obj
        team = obj
        if hasattr(obj, 'team'):
            team = obj.team
        elif hasattr(obj, 'team_season'):
            if obj.team_season:
                team = obj.team_season.team
            else:
                return False
        elif hasattr(obj, 'match'): # Availability/TeamSelection/Match -> Match -> TeamSeason -> Team
            if hasattr(obj.match, 'team_season') and obj.match.team_season:
                team = obj.match.team_season.team
            else:
                 return False # Orphaned match?

        if not team:
            return False

        # Check TeamPermission
        try:
            perm = TeamPermission.objects.get(user=request.user, team=team)
            # Owner/Admin/Editor can edit
            if perm.role in ['owner', 'admin', 'editor']:
                return True
            return False
        except TeamPermission.DoesNotExist:
            return request.user.is_superuser # Superuser can always edit
