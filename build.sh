#!/bin/bash
# Local build script for testing the unified application

set -e

echo "--- Building Frontend ---"
cd frontend
npm install
npm run build
cd ..

echo "--- Preparing Backend Static Files ---"
cd backend
# Create data and static directories if they don't exist
mkdir -p data static/players static/pitch-assets

# Install dependencies if needed
uv sync

# Collect static files (including the newly built React dist)
uv run python manage.py collectstatic --noinput

echo ""
echo "--- Build Complete ---"
echo "You can now run the application locally with:"
echo "  cd backend && uv run python manage.py runserver"
echo ""
echo "The application will be available at http://localhost:8000"
