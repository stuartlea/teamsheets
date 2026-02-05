import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), 'instance', 'teamsheets.db')

def migrate():
    print(f"Migrating database at {DB_PATH}")
    if not os.path.exists(DB_PATH):
        print("Database not found!")
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    columns = [
        ('team', 'spond_group_id', 'VARCHAR(100)'),
        ('match', 'spond_event_id', 'VARCHAR(100)'),
        ('match', 'spond_availability_id', 'VARCHAR(100)'),
        ('availability', 'spond_status', 'VARCHAR(100)'),
        ('availability', 'spond_last_updated', 'DATETIME'),
        ('player', 'spond_id', 'VARCHAR(100)'),
        ('player', 'left_date', 'DATE'),
        ('player', 'deleted_at', 'DATETIME'),
        ('team', 'logo_url', 'VARCHAR(255)') 
    ]
    
    for table, col, type_ in columns:
        try:
            cursor.execute(f"ALTER TABLE {table} ADD COLUMN {col} {type_}")
            print(f"Added {col} to {table}")
        except sqlite3.OperationalError as e:
            if 'duplicate column name' in str(e):
                print(f"Column {col} already exists in {table}")
            else:
                print(f"Error adding {col} to {table}: {e}")
                
    conn.commit()
    conn.close()
    print("Migration complete.")

if __name__ == '__main__':
    migrate()
