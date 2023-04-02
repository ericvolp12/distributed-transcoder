# Dockerfile
FROM python:3.9

RUN apt-get update && apt-get install -y \
    libgstreamer1.0-0 \
    gstreamer1.0-plugins-base \
    gstreamer1.0-plugins-good \
    gstreamer1.0-plugins-bad \
    gstreamer1.0-plugins-ugly \
    gstreamer1.0-tools \
    libgirepository1.0-dev \
    gcc \
    libcairo2-dev \
    pkg-config \
    python3-dev \
    gir1.2-gstreamer-1.0

RUN pip install pygobject pika boto3

WORKDIR /app

COPY worker.py /app/

CMD ["python", "worker.py"]
