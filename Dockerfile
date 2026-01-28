FROM python:3.14-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy pyproject.toml and install dependencies
COPY pyproject.toml ./
RUN pip install --no-cache-dir uv && uv sync --frozen

# Copy application code
COPY . .

# Create static directories
RUN mkdir -p static/players static/pitch-assets

# Expose port
EXPOSE 5000

# Run the application
CMD ["uv", "run", "gunicorn", "--bind", "0.0.0.0:5000", "app:app"]
