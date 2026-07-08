FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Caps glibc's malloc arenas — without this, malloc fragmentation under
# torch/numpy's allocation patterns can inflate RSS well beyond what's
# actually live, which matters a lot on small (e.g. 512MB) instances.
ENV MALLOC_ARENA_MAX=1

EXPOSE 8000
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
