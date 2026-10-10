FROM node:22-bookworm-slim AS frontend
WORKDIR /build/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PORT=10000
WORKDIR /app
COPY backend/requirements.lock /app/backend/requirements.lock
RUN pip install --no-cache-dir -r backend/requirements.lock
COPY backend/ /app/backend/
COPY --from=frontend /build/frontend/dist /app/frontend/dist
RUN useradd --create-home maak && chown -R maak:maak /app
USER maak
WORKDIR /app/backend
EXPOSE 10000
CMD ["sh", "-c", "exec gunicorn 'app:create_app()' --bind 0.0.0.0:${PORT:-10000} --workers 1 --threads 4 --access-logfile -"]
