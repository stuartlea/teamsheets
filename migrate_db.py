import sys
import os
sys.path.append(os.getcwd())
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from backend.app import app, db
from sqlalchemy import text

def migrate():
    with app.app_context():
        # Check if column exists
        with db.engine.connect() as conn:
            result = conn.execute(text("PRAGMA table_info(match)"))
            columns = [row[1] for row in result]
            
            if 'opponent_name' not in columns:
                print("Adding opponent_name column to match table...")
                conn.execute(text("ALTER TABLE match ADD COLUMN opponent_name VARCHAR(100)"))
                conn.commit()
                print("Migration successful.")
            else:
                print("Column opponent_name already exists.")

if __name__ == "__main__":
    migrate()
