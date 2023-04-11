class TranscodeException(Exception):
    def __init__(self, error_type: str, *args):
        super().__init__(*args)
        self.error_type = error_type


class FailedToPlay(TranscodeException):
    "Raised when the pipeline cannot be played by GStreamer."

    def __init__(self, *args):
        super().__init__("pipeline_play", *args)


class FailedToParsePipeline(TranscodeException):
    "Raised when the pipeline cannot be parsed by GStreamer."

    def __init__(self, *args):
        super().__init__("pipeline_parse", *args)


class FailedMidTranscode(TranscodeException):
    "Raised when the pipeline fails after starting transcode."

    def __init__(self, *args):
        super().__init__("mid_transcode", *args)


class PipelineTimeout(TranscodeException):
    "Raised when the pipeline fails to progress after starting transcode."

    def __init__(self, *args):
        super().__init__("pipeline_timeout", *args)
