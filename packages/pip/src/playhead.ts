/** What a page last said of its video, in seconds, and when, in milliseconds. */
export type Heard = { at: number; duration: number; playing: boolean; position: number; playbackRate: number };

/** Where the video is at `now`: a page says so only when it changes. */
export const playhead = ({ at, duration, playing, position, playbackRate }: Heard, now: number): number =>
  playing ? Math.min(position + (playbackRate * Math.max(0, now - at)) / 1000, duration) : position;

export const clock = (seconds: number): string => {
  const whole = Math.floor(seconds);
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor((whole % 3600) / 60);
  const rest = String(whole % 60).padStart(2, "0");
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, "0")}:${rest}` : `${minutes}:${rest}`;
};
