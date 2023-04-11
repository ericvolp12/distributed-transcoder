from distributed_transcoder_api.models import Preset


async def seed_presets():
    presets = [
        {
            "name": "Scale to 1080p x265 (1.5 mbit) mp4->mp4",
            "input_type": "mp4",
            "output_type": "mp4",
            "pipeline": "filesrc location={{input_file}} ! qtdemux name=d mp4mux name=mux ! filesink location={{output_file}} d.audio_0 ! queue max-size-buffers=0 max-size-bytes=0 max-size-time=0 ! decodebin ! audioconvert ! avenc_aac ! mux.audio_0 d.video_0 ! queue max-size-buffers=0 max-size-bytes=0 max-size-time=0 ! decodebin ! videoscale ! video/x-raw,width=1920, height=1080 ! x265enc bitrate=1536 ! {{progress}} ! h265parse ! mux.video_0",
        },
        {
            "name": "Scale to 720p x265 (1 mbit) mp4->mp4",
            "input_type": "mp4",
            "output_type": "mp4",
            "pipeline": "filesrc location={{input_file}} ! qtdemux name=d mp4mux name=mux ! filesink location={{output_file}} d.audio_0 ! queue max-size-buffers=0 max-size-bytes=0 max-size-time=0 ! decodebin ! audioconvert ! avenc_aac ! mux.audio_0 d.video_0 ! queue max-size-buffers=0 max-size-bytes=0 max-size-time=0 ! decodebin ! videoscale ! video/x-raw,width=1280, height=720 ! x265enc bitrate=1024 ! {{progress}} ! h265parse ! mux.video_0",
        },
        {
            "name": "Scale to 720p x264 (1 mbit) mp4->mp4",
            "input_type": "mp4",
            "output_type": "mp4",
            "pipeline": "filesrc location={{input_file}} ! qtdemux name=d mp4mux name=mux ! filesink location={{output_file}} d.audio_0 ! queue max-size-buffers=0 max-size-bytes=0 max-size-time=0 ! decodebin ! audioconvert ! avenc_aac ! mux.audio_0 d.video_0 ! queue max-size-buffers=0 max-size-bytes=0 max-size-time=0 ! decodebin ! videoscale ! video/x-raw,width=1280, height=720 ! x264enc bitrate=1536 ! {{progress}} ! h264parse ! mux.video_0",
        },
        {
            "name": "Scale to 480p x265 (756 kbit) mp4->mp4",
            "input_type": "mp4",
            "output_type": "mp4",
            "pipeline": "filesrc location={{input_file}} ! qtdemux name=d mp4mux name=mux ! filesink location={{output_file}} d.audio_0 ! queue max-size-buffers=0 max-size-bytes=0 max-size-time=0 ! decodebin ! audioconvert ! avenc_aac ! mux.audio_0 d.video_0 ! queue max-size-buffers=0 max-size-bytes=0 max-size-time=0 ! decodebin ! videoscale ! video/x-raw,width=640, height=480 ! x265enc bitrate=768 ! {{progress}} ! h265parse ! mux.video_0",
        },
        {
            "name": "Scale to 1080p x265 (1.5 mbit) mp4->mkv",
            "input_type": "mp4",
            "output_type": "mkv",
            "pipeline": "filesrc location={{input_file}} ! qtdemux name=d matroskamux name=mux ! filesink location={{output_file}} d.audio_0 ! queue max-size-buffers=0 max-size-bytes=0 max-size-time=0 ! decodebin ! audioconvert ! avenc_aac ! mux.audio_0 d.video_0 ! queue max-size-buffers=0 max-size-bytes=0 max-size-time=0 ! decodebin ! videoscale ! video/x-raw,width=1920, height=1080 ! x265enc bitrate=1536 ! {{progress}} ! h265parse ! mux.video_0",
        },
        {
            "name": "Scale to 720p x265 (1 mbit) mp4->mkv",
            "input_type": "mp4",
            "output_type": "mkv",
            "pipeline": "filesrc location={{input_file}} ! qtdemux name=d matroskamux name=mux ! filesink location={{output_file}} d.audio_0 ! queue max-size-buffers=0 max-size-bytes=0 max-size-time=0 ! decodebin ! audioconvert ! avenc_aac ! mux.audio_0 d.video_0 ! queue max-size-buffers=0 max-size-bytes=0 max-size-time=0 ! decodebin ! videoscale ! video/x-raw,width=1280, height=720 ! x265enc bitrate=1024 ! {{progress}} ! h265parse ! mux.video_0",
        },
        {
            "name": "Scale to 480p x265 (756 kbit) mp4->mkv",
            "input_type": "mp4",
            "output_type": "mkv",
            "pipeline": "filesrc location={{input_file}} ! qtdemux name=d matroskamux name=mux ! filesink location={{output_file}} d.audio_0 ! queue max-size-buffers=0 max-size-bytes=0 max-size-time=0 ! decodebin ! audioconvert ! avenc_aac ! mux.audio_0 d.video_0 ! queue max-size-buffers=0 max-size-bytes=0 max-size-time=0 ! decodebin ! videoscale ! video/x-raw,width=640, height=480 ! x265enc bitrate=768 ! {{progress}} ! h265parse ! mux.video_0",
        },
        {
            "name": "Scale to 1080p x265 (1.5 mbit) mkv->mp4",
            "input_type": "mkv",
            "output_type": "mp4",
            "pipeline": "filesrc location={{input_file}} ! matroskademux name=d mp4mux name=mux ! filesink location={{output_file}} d.audio_0 ! queue max-size-buffers=0 max-size-bytes=0 max-size-time=0 ! decodebin ! audioconvert ! avenc_aac ! mux.audio_0 d.video_0 ! queue max-size-buffers=0 max-size-bytes=0 max-size-time=0 ! decodebin ! videoscale ! video/x-raw,width=1920, height=1080 ! x265enc bitrate=1536 ! {{progress}} ! h265parse ! mux.video_0",
        },
        {
            "name": "Scale to 720p x265 (1 mbit) mkv->mp4",
            "input_type": "mkv",
            "output_type": "mp4",
            "pipeline": "filesrc location={{input_file}} ! matroskademux name=d mp4mux name=mux ! filesink location={{output_file}} d.audio_0 ! queue max-size-buffers=0 max-size-bytes=0 max-size-time=0 ! decodebin ! audioconvert ! avenc_aac ! mux.audio_0 d.video_0 ! queue max-size-buffers=0 max-size-bytes=0 max-size-time=0 ! decodebin ! videoscale ! video/x-raw,width=1280, height=720 ! x265enc bitrate=1024 ! {{progress}} ! h265parse ! mux.video_0",
        },
        {
            "name": "Scale to 720p x264 (2 mbit) mkv->mp4",
            "input_type": "mkv",
            "output_type": "mp4",
            "pipeline": "filesrc location={{input_file}} ! matroskademux name=d mp4mux name=mux ! filesink location={{output_file}} d.audio_0 ! queue max-size-buffers=0 max-size-bytes=0 max-size-time=0 ! decodebin ! audioconvert ! avenc_aac ! mux.audio_0 d.video_0 ! queue max-size-buffers=0 max-size-bytes=0 max-size-time=0 ! decodebin ! videoscale ! video/x-raw,width=1280, height=720 ! x264enc bitrate=1024 ! {{progress}} ! h264parse ! mux.video_0",
        },
        {
            "name": "Scale to 480p x265 (756 kbit) mkv->mp4",
            "input_type": "mkv",
            "output_type": "mp4",
            "pipeline": "filesrc location={{input_file}} ! matroskademux name=d mp4mux name=mux ! filesink location={{output_file}} d.audio_0 ! queue max-size-buffers=0 max-size-bytes=0 max-size-time=0 ! decodebin ! audioconvert ! avenc_aac ! mux.audio_0 d.video_0 ! queue max-size-buffers=0 max-size-bytes=0 max-size-time=0 ! decodebin ! videoscale ! video/x-raw,width=640, height=480 ! x265enc bitrate=768 ! {{progress}} ! h265parse ! mux.video_0",
        },
        {
            "name": "Scale to 1080p x265 (1.5 mbit) mkv->mkv",
            "input_type": "mkv",
            "output_type": "mkv",
            "pipeline": "filesrc location={{input_file}} ! matroskademux name=d matroskamux name=mux ! filesink location={{output_file}} d.audio_0 ! queue max-size-buffers=0 max-size-bytes=0 max-size-time=0 ! decodebin ! audioconvert ! avenc_aac ! mux.audio_0 d.video_0 ! queue max-size-buffers=0 max-size-bytes=0 max-size-time=0 ! decodebin ! videoscale ! video/x-raw,width=1920, height=1080 ! x265enc bitrate=1536 ! {{progress}} ! h265parse ! mux.video_0",
        },
        {
            "name": "Scale to 720p x265 (1 mbit) mkv->mkv",
            "input_type": "mkv",
            "output_type": "mkv",
            "pipeline": "filesrc location={{input_file}} ! matroskademux name=d matroskamux name=mux ! filesink location={{output_file}} d.audio_0 ! queue max-size-buffers=0 max-size-bytes=0 max-size-time=0 ! decodebin ! audioconvert ! avenc_aac ! mux.audio_0 d.video_0 ! queue max-size-buffers=0 max-size-bytes=0 max-size-time=0 ! decodebin ! videoscale ! video/x-raw,width=1280, height=720 ! x265enc bitrate=1024 ! {{progress}} ! h265parse ! mux.video_0",
        },
        {
            "name": "Scale to 480p x265 (756 kbit) mkv->mkv",
            "input_type": "mkv",
            "output_type": "mkv",
            "pipeline": "filesrc location={{input_file}} ! matroskademux name=d matroskamux name=mux ! filesink location={{output_file}} d.audio_0 ! queue max-size-buffers=0 max-size-bytes=0 max-size-time=0 ! decodebin ! audioconvert ! avenc_aac ! mux.audio_0 d.video_0 ! queue max-size-buffers=0 max-size-bytes=0 max-size-time=0 ! decodebin ! videoscale ! video/x-raw,width=640, height=480 ! x265enc bitrate=768 ! {{progress}} ! h265parse ! mux.video_0",
        },
    ]

    for preset in presets:
        existing_preset = await Preset.get_or_none(name=preset["name"])
        if not existing_preset:
            await Preset.create(**preset)
