from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import api_view, permission_classes
from core.services.spond_service import SpondService

class SpondGroupsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        service = SpondService()
        if not service.login():
             return Response({'error': 'Spond login failed'}, status=500)
        
        groups = service.get_groups()
        return Response({'groups': groups})

class SpondEventsView(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        group_id = request.query_params.get('groupId')
        if not group_id:
            return Response({'error': 'Missing groupId'}, status=400)
            
        service = SpondService()
        if not service.login():
             return Response({'error': 'Spond login failed'}, status=500)
             
        events = service.get_events(group_id)
        return Response({'events': events})

class SpondMembersView(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        group_id = request.query_params.get('groupId')
        if not group_id:
            return Response({'error': 'Missing groupId'}, status=400)
            
        service = SpondService()
        if not service.login():
             return Response({'error': 'Spond login failed'}, status=500)
             
        members = service.get_group_members(group_id)
        return Response({'members': members})
