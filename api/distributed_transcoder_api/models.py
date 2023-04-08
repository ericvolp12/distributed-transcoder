from tortoise import fields
from tortoise.models import Model
from tortoise.contrib.pydantic import pydantic_model_creator


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


PresetOut = pydantic_model_creator(Preset, name="PresetOut")
