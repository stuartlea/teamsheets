# Multi-stage Dockerfile for React (Vite)

# Stage 1: Build
FROM node:20-alpine AS build

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm install

# Copy application code
COPY . .

# Build the application
# Note: Ensure VITE_API_URL is handled if needed at build time
RUN npm run build

# Stage 2: Serve with Nginx
FROM nginx:stable-alpine

# Copy build output from Stage 1
COPY --from=build /app/dist /usr/share/nginx/html

# Copy custom nginx config if we had one, but standard is fine for basic React
# For React Router to work correctly on refresh, we need a simple try_files
RUN echo 'server { \
    listen 80; \
    location / { \
        root /usr/share/nginx/html; \
        index index.html index.htm; \
        try_files $uri $uri/ /index.html; \
    } \
    location /api { \
        proxy_pass http://backend:8000; \
        proxy_set_header Host $host; \
        proxy_set_header X-Real-IP $remote_addr; \
    } \
    location /static { \
        proxy_pass http://backend:8000; \
    } \
    location /auth { \
        proxy_pass http://backend:8000; \
    } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
