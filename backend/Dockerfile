# Personal AI Agent Platform - backend image
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# psycopg[binary] ships wheels, so no libpq build toolchain is needed.
# PIP_INDEX_URL lets a China-region deploy use a local mirror
# (compose passes it through from .env; default is upstream PyPI).
ARG PIP_INDEX_URL=https://pypi.org/simple
COPY requirements.txt ./
RUN pip install --no-cache-dir --index-url "$PIP_INDEX_URL" -r requirements.txt

COPY . .

RUN mkdir -p /data/storage/uploads
ENV STORAGE_DIR=/data/storage

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
