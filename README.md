# Video Transcoding Service

A distributed video transcoding service using RabbitMQ, GStreamer, and S3-compatible object storage (such as MinIO).

## Overview

This project is a distributed video transcoding service that leverages RabbitMQ for job distribution, GStreamer for video transcoding, and an S3-compatible object storage (such as MinIO) for storing input and output video files.

The service consists of the following components:

- RabbitMQ: used for managing and distributing transcoding jobs.
- GStreamer: a multimedia processing framework used for transcoding video files.
- S3-compatible object storage (e.g., MinIO): used for storing input and output video files.

## Getting Started

### Prerequisites

- Docker
- Docker Compose

### Setting up the environment

1. Clone the repository.

    ```shell
    $ git clone https://github.com/yourusername/video-transcoding-service.git
    $ cd video-transcoding-service
    ```


2. Create a `.env` file in the project root directory with the following content:

    ```
    AWS_ACCESS_KEY_ID=your_access_key
    AWS_SECRET_ACCESS_KEY=your_secret_key
    S3_BUCKET_NAME=your_bucket_name
    AWS_S3_ENDPOINT_URL=http://minio:9000
    ```

Replace `your_access_key`, `your_secret_key`, and `your_bucket_name` with the appropriate values for your S3-compatible object storage.

3. Start the services using Docker Compose:

    ```shell
    $ docker-compose up
    ```


## Usage

1. Add a video file to your S3-compatible object storage in the specified bucket.

2. Send a transcoding job to the RabbitMQ queue with the required input key, output key, and transcoding options:

    ```python
    import json
    import pika

    credentials = pika.PlainCredentials("guest", "guest")
    connection = pika.BlockingConnection(
        pika.ConnectionParameters("localhost", 5672, "/", credentials)
    )
    channel = connection.channel()

    job_data = {
        "job_id": "job1",
        "input_key": "path/to/input_file",
        "output_key": "path/to/output_file",
        "transcode_options": "videoconvert ! x264enc",
    }

    channel.basic_publish(
        exchange="",
        routing_key="transcoding_jobs",
        body=json.dumps(job_data),
    )

    connection.close()
    ```

    Replace the `input_key`, `output_key`, and `transcode_options` with the appropriate values for your use case.

3. Monitor the progress of the transcoding job by consuming messages from the transcoding_progress queue:

    ```python
    def on_progress(ch, method, properties, body):
        progress_data = json.loads(body)
        print(f"Job {progress_data['job_id']}: {progress_data['progress']}%")

    channel.basic_consume(
        queue="transcoding_progress",
        on_message_callback=on_progress,
        auto_ack=True,
    )

    channel.start_consuming()
    ```

4. After the transcoding job is completed, the output file will be uploaded to the specified output key in the S3-compatible object storage.
