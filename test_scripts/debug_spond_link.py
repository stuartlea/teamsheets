import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), 'backend/instance/teamsheets.db')

def check_team_link():
    if not os.path.exists(DB_PATH):
        print(f"Database not found at {DB_PATH}")
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    print("--- Teams and Spond Group IDs ---")
    cursor.execute("SELECT id, name, spond_group_id FROM team")
    teams = cursor.fetchall()
    for t in teams:
        print(f"ID: {t[0]}, Name: {t[1]}, SpondGroupID: {t[2]}")
        
    print("\n--- Match 26 Details ---")
    # User mentioned match/26
    cursor.execute("SELECT id, name, team_season_id FROM match WHERE id=26")
    match = cursor.fetchone()
    if match:
        print(f"Match ID: {match[0]}, Name: {match[1]}, TeamSeasonID: {match[2]}")
        if match[2]:
            cursor.execute("SELECT id, team_id, season_id FROM team_season WHERE id=?", (match[2],))
            ts = cursor.fetchone()
            if ts:
                print(f"TeamSeason ID: {ts[0]}, TeamID: {ts[1]}")
                # Check that specific team
                cursor.execute("SELECT id, name, spond_group_id FROM team WHERE id=?", (ts[1],))
                linked_team = cursor.fetchone()
                print(f"Linked Team: {linked_team}")
    else:
        print("Match 26 not found.")

    conn.close()

if __name__ == '__main__':
    check_team_link()
