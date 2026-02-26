# Production Dockerfile for Django

FROM python:3.14-slim

# Set environment variables
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

# Copy the entire project context to leverage pyproject.toml
COPY pyproject.toml uv.lock ./

# Sync dependencies (including django and gunicorn)
RUN uv sync --frozen --no-dev

# Copy the Django application code
COPY backend/ .

# Ensure static directories exist
RUN mkdir -p static/players static/pitch-assets

# Expose port 8000
EXPOSE 8000

# Run gunicorn
# Note: we use 'uv run' to ensure we use the virtualenv created by uv
CMD ["uv", "run", "gunicorn", "--bind", "0.0.0.0:8000", "config.wsgi:application", "--workers", "3"]
