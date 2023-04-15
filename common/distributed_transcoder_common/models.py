from tortoise import fields, Tortoise
from tortoise.models import Model
from tortoise.contrib.pydantic import pydantic_model_creator


class Preset(Model):
    preset_id = fields.UUIDField(pk=True)
    name = fields.CharField(max_length=250, unique=True)
    input_type = fields.CharField(max_length=30)
    output_type = fields.CharField(max_length=30)
    resolution = fields.CharField(max_length=30)
    video_encoding = fields.CharField(max_length=30)
    video_bitrate = fields.CharField(max_length=30)
    audio_encoding = fields.CharField(max_length=30)
    audio_bitrate = fields.CharField(max_length=30)
    pipeline = fields.TextField()
    created_at = fields.DatetimeField(auto_now_add=True)
    updated_at = fields.DatetimeField(auto_now=True)

    class Meta:
        ordering = ["name"]

    class PydanticMeta:
        exclude = ("jobs",)


class Job(Model):
    id = fields.UUIDField(pk=True)
    job_id = fields.CharField(max_length=50, unique=True)
    input_s3_path = fields.CharField(max_length=255)
    output_s3_path = fields.CharField(max_length=255)
    pipeline = fields.TextField()
    preset: fields.ForeignKeyNullableRelation[Preset] = fields.ForeignKeyField(
        "models.Preset", null=True
    )
    state = fields.CharField(max_length=20, default="queued")
    error = fields.TextField(null=True)
    error_type = fields.CharField(max_length=50, null=True)
    created_at = fields.DatetimeField(auto_now_add=True)
    updated_at = fields.DatetimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]


Tortoise.init_models(["distributed_transcoder_common.models"], "models")
PresetOut = pydantic_model_creator(Preset, name="PresetOut")
JobOut = pydantic_model_creator(Job, name="JobOut")
