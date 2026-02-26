---
description: How to upgrade the application and run database migrations in Docker
---

To upgrade your application to a new version, follow these steps:

### 1. Get the latest code
Pull the latest changes from your repository:
```bash
git pull origin main
```

### 2. Update the Docker images
Build the new images (this ensures any dependency changes in `pyproject.toml` or `package.json` are captured):
```bash
docker-compose build
```

### 3. Restart the services
Restart the containers with the new images:
```bash
docker-compose up -d
```

### 4. Run Database Migrations
If your changes included model updates, you MUST run the migrations inside the backend container:
```bash
docker-compose exec backend uv run python manage.py migrate
```

### 5. (Optional) Create Migrations
If you've made new changes to your models locally and want to generate migration files:
```bash
docker-compose exec backend uv run python manage.py makemigrations
```

### 6. (Optional) Check Logs
If something goes wrong, check the logs:
```bash
docker-compose logs -f
```
