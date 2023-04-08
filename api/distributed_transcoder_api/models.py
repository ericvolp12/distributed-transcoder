import os

from fastapi import FastAPI
from tortoise import Tortoise, fields, run_async
from tortoise.contrib.fastapi import register_tortoise
from tortoise.models import Model

POSTGRES_USER = os.environ["POSTGRES_USER"]
POSTGRES_PASSWORD = os.environ["POSTGRES_PASSWORD"]
POSTGRES_DB = os.environ["POSTGRES_DB"]
POSTGRES_HOST = os.environ["POSTGRES_HOST"]


class Job(Model):
    id = fields.UUIDField(pk=True)
    job_id = fields.CharField(max_length=50, unique=True)
    input_s3_path = fields.CharField(max_length=255)
    output_s3_path = fields.CharField(max_length=255)
    pipeline = fields.TextField()
    preset_id = fields.CharField(max_length=50, null=True)
    state = fields.CharField(max_length=20, default="queued")
    error = fields.TextField(null=True)
    error_type = fields.CharField(max_length=50, null=True)
    created_at = fields.DatetimeField(auto_now_add=True)
    updated_at = fields.DatetimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]


class Preset(Model):
    preset_id = fields.UUIDField(pk=True)
    name = fields.CharField(max_length=250, unique=True)
    input_type = fields.CharField(max_length=30)
    output_type = fields.CharField(max_length=30)
    pipeline = fields.TextField()
    created_at = fields.DatetimeField(auto_now_add=True)
    updated_at = fields.DatetimeField(auto_now=True)

    class Meta:
        ordering = ["name"]


def init_db(app: FastAPI):
    register_tortoise(
        app,
        db_url=f"postgres://{POSTGRES_USER}:{POSTGRES_PASSWORD}@{POSTGRES_HOST}/{POSTGRES_DB}",
        modules={"models": ["distributed_transcoder_api.models"]},
        generate_schemas=True,
        add_exception_handlers=True,
    )
