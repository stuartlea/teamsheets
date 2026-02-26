#!/bin/bash
# Local runserver script

# Default port is 8000 if not provided
PORT=${1:-8000}

echo "--- Starting Team Sheets Backend on port $PORT ---"
cd backend

# Run the server using uv
uv run python manage.py runserver 0.0.0.0:$PORT
