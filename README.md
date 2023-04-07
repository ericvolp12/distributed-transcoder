# Video Transcoding Service

A distributed video transcoding service using RabbitMQ, GStreamer, and S3-compatible object storage (such as MinIO).

## Overview

This project is a distributed video transcoding service that leverages RabbitMQ for job distribution, GStreamer for video transcoding, and an S3-compatible object storage (such as MinIO) for storing input and output video files.

The service consists of the following components:

- RabbitMQ: used for managing and distributing transcoding jobs.
- GStreamer: a multimedia processing framework used for transcoding video files.
- S3-compatible object storage (e.g., MinIO): used for storing input and output video files.
- FastAPI: a modern, fast (high-performance) web framework for building APIs.

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

1. **Upload a video file**: Make a POST request to the `/upload` endpoint with the video file in the request body.

    ```
    POST http://localhost:8000/upload
    ```

    Example using `curl`:

    ```shell
    $ curl -X POST -H "Content-Type: multipart/form-data" -F "file=@path/to/input_file.mp4" http://localhost:8000/upload
    ```

2. **Submit a transcoding job**: Make a POST request to the `/submit_job` endpoint with the required input key, output key, and transcoding options:

    ```
    POST http://localhost:8000/submit_job
    ```

    Example JSON payload:

    ```json
    {
        "job_id": "job1",
        "input_s3_path": "input_file.mp4",
        "output_s3_path": "output_file.mp4",
        "transcode_options": "filesrc location={{input_file}} ! qtdemux ! decodebin ! videoconvert ! x264enc ! {{progress}} ! mp4mux ! filesink location={{output_file}}"
    }
    ```

    Replace the `input_s3_path`, `output_s3_path`, and `transcode_options` with the appropriate values for your use case.

    `transcode_options` has 3 placeholders for you to insert, they'll be replaced by the worker when parsing the transcode pipeline:
    - `{{input_file}}` will be filled with the temporary file location of the input chunk
    - `{{output_file}}` will be filled with the temporary file location of the output chunk before upload
    - `{{progress}}` will insert a progress report node like `progressreport update-freq=10 silent=true` and use that to provide status reports. Place it in the critical path of your slowest thread.

3. **Monitor the progress of the transcoding job**: Open a WebSocket connection to the `/progress/{job_id}` endpoint, replacing `{job_id}` with the appropriate job ID.

    Example using JavaScript:

    ```javascript
    const socket = new WebSocket("ws://localhost:8000/progress/job1");

    socket.onmessage = function(event) {
        console.log("Message received:", event.data);
    };

    socket.onclose = function(event) {
        console.log("WebSocket closed:", event);
    };
    ```

4. **Download the output file**: Once the transcoding job is completed, the output file will be uploaded to the specified output key in the S3-compatible object storage. To download the file, make a GET request to the `/download/{filename}` endpoint, replacing `{filename}` with the output file name:

    ```
    GET http://localhost:8000/download/output_file.mp4
    ```

    Example using `curl`:

    ```shell
    $ curl -X GET http://localhost:8000/download/output_file.mp4 --output output_file.mp4
    ```
