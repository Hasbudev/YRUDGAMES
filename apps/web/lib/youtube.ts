export interface YTPlayer {
  playVideo(): void;
  pauseVideo(): void;
  stopVideo(): void;
  loadVideoById(videoId: string): void;
  setVolume(volume: number): void;
  mute(): void;
  unMute(): void;
  getPlayerState(): number;
  destroy(): void;
}

export interface YTPlayerOptions {
  videoId?: string;
  playerVars?: Record<string, number | string>;
  events?: {
    onReady?: (event: { target: YTPlayer }) => void;
    onStateChange?: (event: { data: number; target: YTPlayer }) => void;
    onError?: () => void;
  };
}

declare global {
  interface Window {
    YT?: { Player: new (element: HTMLElement, options: YTPlayerOptions) => YTPlayer };
    onYouTubeIframeAPIReady?: () => void;
  }
}

export const YT_PLAYING = 1;

// Loaded once for the whole app — every player (blind test clips, the
// background ambiance loop) shares this same cached script/global instead
// of each injecting its own <script> tag.
let apiPromise: Promise<void> | null = null;

export function loadYouTubeApi(): Promise<void> {
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve) => {
    if (window.YT?.Player) {
      resolve();
      return;
    }
    const previousReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previousReady?.();
      resolve();
    };
    if (!document.getElementById("youtube-iframe-api")) {
      const script = document.createElement("script");
      script.id = "youtube-iframe-api";
      script.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(script);
    }
  });
  return apiPromise;
}
