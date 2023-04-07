# Dockerfile
FROM python:3.9-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    gcc \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*


RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir poetry && \
    pip install uvicorn[standard]

# Copy and install Python dependencies
COPY pyproject.toml poetry.lock ./

RUN poetry config virtualenvs.create false && \
    poetry install --no-interaction --no-ansi --no-root --no-dev

# Copy the rest of the application
COPY . .

RUN poetry install --no-interaction --no-ansi

# RUN python3 -m pip install --no-cache-dir dist/*.whl

# Expose the API port
EXPOSE 8000

# Start the application
CMD ["uvicorn", "distributed_transcoder_api.api:app", "--host", "0.0.0.0", "--port", "8000"]
