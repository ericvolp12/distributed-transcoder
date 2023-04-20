export interface Job {
  created_at: Date;
  error_type?: string;
  error?: string;
  input_s3_path: string;
  job_id: string;
  output_s3_path: string;
  pipeline?: string;
  preset?: Preset;
  preset_name?: string;
  state: string;
  updated_at: Date;
  transcode_started_at?: Date;
  transcode_completed_at?: Date;
  playlists?: Playlist[];
}

export interface Playlist {
  created_at: Date;
  updated_at: Date;
  id: string;
  name: string;
}

export interface Preset {
  preset_id: string;
  name: string;
  input_type: string;
  output_type: string;
  pipeline: string;
  video_encoding: string;
  video_bitrate: string;
  resolution: string;
  audio_encoding: string;
  audio_bitrate: string;
  created_at: Date;
  updated_at: Date;
}
