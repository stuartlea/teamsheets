import sys
import os

# Add backend to sys.path so we can import app and services as if we were in backend/
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from app import app, db
from models import PlayerAlias

with app.app_context():
    db.create_all()
    print("Database tables updated (PlayerAlias created if missing).")
