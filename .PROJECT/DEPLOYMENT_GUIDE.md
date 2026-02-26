# Team Sheets Deployment & Operations Guide

This guide provides comprehensive instructions for deploying, updating, and managing the Team Sheets application in a Docker environment.

---

## 1. Initial Installation (New Server)

Follow these steps to set up the application on a fresh Docker server.

### Prerequisites
- Docker and Docker Compose installed.
- Git installed.
- Access to the local Git server at `http://192.168.1.150:10055`.

### Step 1: Clone the Repository
```bash
git clone http://192.168.1.150:10055/stuartlea/teamsheets.git
cd teamsheets
```

### Step 2: Configure Environment Variables
You have two main ways to provide the required variables:

#### Option A: Use a `.env` file (Recommended)
Create a `.env` file in the root directory:
```bash
nano .env
```
Add the following:
- `SPOND_USERNAME`: Your Spond email.
- `SPOND_PASSWORD`: Your Spond password.
- `SECRET_KEY`: A secure random string for Django.

#### Option B: Define in `docker-compose.yml`
You can also hardcode them directly in the `environment:` section of [docker-compose.yml](file:///home/stuart/Development/TeamSheets/docker-compose.yml):
```yaml
services:
  backend:
    environment:
      - SPOND_USERNAME=your_email@example.com
      - SPOND_PASSWORD=your_password
      - SECRET_KEY=your_secret_key
```
> [!WARNING]
> Only use Option B if you are sure other people won't have access to your server or source code, as it exposes your secrets in plain text.

### Step 3: Launch Containers
Build and start the services in detached mode:
```bash
docker compose up --build -d
```

### Step 4: Initialize Database
Create the database tables and apply initial migrations:
```bash
docker compose exec backend uv run python manage.py migrate
```

---

## 2. Updates & Upgrades

When new code is pushed to the repository, follow these steps to update your running instance.

### Step 1: Pull Latest Code
```bash
git pull origin main
```

### Step 2: Rebuild & Restart
Rebuild the images (to catch dependency changes) and restart the containers:
```bash
docker compose build
docker compose up -d
```

### Step 3: Apply Migrations
Always run this command after updating to ensure the database schema matches the new code:
```bash
docker compose exec backend uv run python manage.py migrate
```

---

## 3. Operations & Troubleshooting

### Viewing Logs
To see what's happening inside the containers:
```bash
docker compose logs -f         # All services
docker compose logs -f backend # Backend only
docker compose logs -f frontend # Frontend/Nginx only
```

### Database Management
To create a new superuser for the Django Admin:
```bash
docker compose exec backend uv run python manage.py createsuperuser
```

To create new migrations after model changes:
```bash
docker compose exec backend uv run python manage.py makemigrations
```

### Static Assets
Player headshots should be placed in `backend/static/players/` on the host machine (if mapped) or within the container volume.
- **Naming Convension**: `surname-forename/head.png` or `firstname-lastname.png`.

---

## 4. Accessing the Application

- **Frontend UI**: `http://<server-ip>`
- **Backend API**: `http://<server-ip>:8000/api/`
- **Django Admin**: `http://<server-ip>:8000/admin/`
