# Unified Multi-stage Dockerfile for Team Sheets (Django + React)

# --- Stage 1: Frontend Build ---
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install
COPY frontend/ .
RUN npm run build

# --- Stage 2: Final Image ---
FROM python:3.14-slim
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1
ENV DJANGO_SETTINGS_MODULE config.settings
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    libsqlite3-dev \
    && rm -rf /var/lib/apt/lists/*

# Install uv for fast dependency management
RUN pip install --no-cache-dir uv

# Copy backend dependencies
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev

# Copy the Django application code
COPY backend/ ./backend/
# Copy the built frontend artifacts
COPY --from=frontend-build /app/frontend/dist ./frontend/dist

WORKDIR /app/backend

# Create static and data directories
RUN mkdir -p static/players static/pitch-assets data
RUN uv run python manage.py collectstatic --noinput

# Expose port 8000
EXPOSE 8000

# Run gunicorn
CMD ["uv", "run", "gunicorn", "--bind", "0.0.0.0:8000", "config.wsgi:application", "--workers", "3"]
