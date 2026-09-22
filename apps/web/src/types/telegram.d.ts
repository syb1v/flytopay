export {};

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData: string;
        ready: () => void;
        expand: () => void;
        requestFullscreen?: () => void;
        disableVerticalSwipes?: () => void;
        onEvent?: (event: string, callback: () => void) => void;
        offEvent?: (event: string, callback: () => void) => void;
      };
    };
  }
}
