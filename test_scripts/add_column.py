import sqlite3
import os

db_path = os.path.join(os.getcwd(), 'backend', 'instance', 'teamsheets.db')
if not os.path.exists(db_path):
    # Try alternate path if not found (sometimes instance is in root)
    db_path = os.path.join(os.getcwd(), 'instance', 'teamsheets.db')
    
print(f"Migrating DB at: {db_path}")

try:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Check if column exists
    cursor.execute("PRAGMA table_info(player)")
    columns = [info[1] for info in cursor.fetchall()]
    
    if 'left_date' not in columns:
        print("Adding left_date column...")
        cursor.execute("ALTER TABLE player ADD COLUMN left_date DATE")
        conn.commit()
        print("Success.")
    else:
        print("Column left_date already exists.")
        
    conn.close()
except Exception as e:
    print(f"Error: {e}")
