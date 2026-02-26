---
description: How to perform a fresh installation on a separate Docker server
---

To deploy this application to a new/separate Docker server, follow these steps:

### 1. Prerequisites
Ensure the target server has `docker` and `git` installed, and can reach your local git server at `192.168.1.150`.

### 2. Clone the Repository
SSH into your separate Docker server and run:
```bash
git clone http://192.168.1.150:10055/stuartlea/teamsheets.git
cd teamsheets
```

### 3. Configure Environment Variables
Create a `.env` file in the root directory. You can use your local one as a template:
```bash
nano .env
```
Ensure you include:
- `SPOND_USERNAME`
- `SPOND_PASSWORD`
- `SECRET_KEY` (Generate a new secure string for production)

### 4. Build and Start
Run the initial orchestration. This will build the unified image containing both backend and frontend:
```bash
docker compose up --build -d
```

### 5. Initialize the Database
Run the Django migrations to create the SQLite database and tables inside the container:
```bash
docker compose exec app uv run python manage.py migrate
```

### 6. Verification
The app should now be accessible at:
- Web Interface: `http://<server-ip>:8000`
- Django Admin: `http://<server-ip>:8000/admin`
