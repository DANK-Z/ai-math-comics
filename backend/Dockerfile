FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1
WORKDIR /app/backend

COPY backend/requirements.txt ./
RUN python -m pip install -r requirements.txt \
    && addgroup --gid 10001 amc \
    && adduser --uid 10001 --gid 10001 --disabled-password --gecos '' amc \
    && install -d -o amc -g amc /app/data

COPY backend/app ./app
COPY backend/migrations ./migrations
COPY backend/alembic.ini ./
COPY frontend/public/mock-images /app/frontend/public/mock-images
USER amc

CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--forwarded-allow-ips", "*"]
