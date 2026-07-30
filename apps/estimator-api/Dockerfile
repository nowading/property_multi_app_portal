# Multi-stage Dockerfile for the Property Value Estimator API (FastAPI).
#
# Stage 1 (builder): install dependencies into a venv.
# Stage 2 (runtime): copy the venv + app source, run as non-root.

# ---------- Stage 1: builder ----------
FROM python:3.12-slim AS builder

# Build-time args (no secrets baked into the image)
ARG HTTP_PROXY=""
ARG HTTPS_PROXY=""

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /build

# Install build dependencies required by some wheels
RUN apt-get update \
    && apt-get install -y --no-install-recommends gcc \
    && rm -rf /var/lib/apt/lists/*

# Create a venv so we can copy it cleanly to the runtime stage
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

COPY requirements.txt .
RUN if [ -n "$HTTP_PROXY" ]; then pip config set global.proxy "$HTTP_PROXY"; fi \
    && pip install --upgrade pip \
    && pip install -r requirements.txt

# ---------- Stage 2: runtime ----------
FROM python:3.12-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/opt/venv/bin:$PATH" \
    ESTIMATOR_API_HOST=0.0.0.0 \
    ESTIMATOR_API_PORT=8001 \
    LOG_LEVEL=INFO

# Create a non-root user for runtime
RUN groupadd --system app \
    && useradd --system --gid app --home-dir /app --shell /usr/sbin/nologin app

WORKDIR /app

# Copy the venv from the builder stage
COPY --from=builder /opt/venv /opt/venv

# Copy application source
COPY --chown=app:app . .

USER app

EXPOSE 8001

# Healthcheck uses the unified /healthz endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request, sys; \
        r = urllib.request.urlopen('http://localhost:8001/healthz', timeout=4); \
        sys.exit(0 if r.status == 200 else 1)"

# Run with uvicorn; ML_SERVICE_URL is injected at runtime via env
CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001"]
