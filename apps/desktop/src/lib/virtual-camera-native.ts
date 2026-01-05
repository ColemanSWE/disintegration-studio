export interface VirtualCameraNative {
  start(): Promise<boolean>;
  stop(): Promise<boolean>;
  pushFrame(buffer: ArrayBuffer, width: number, height: number): Promise<boolean>;
  isRunning(): Promise<boolean>;
}

declare global {
  interface Window {
    nativeVirtualCamera?: {
      initialize: () => Promise<boolean>;
      start: () => Promise<boolean>;
      stop: () => Promise<boolean>;
      pushFrame: (buffer: ArrayBuffer, width: number, height: number) => Promise<boolean>;
      isRunning: () => Promise<boolean>;
    };
  }
}

export function getNativeModule(): VirtualCameraNative | null {
  if (typeof window === 'undefined' || !window.nativeVirtualCamera) {
    return null;
  }

  return {
    start: async () => {
      try {
        const initialized = await window.nativeVirtualCamera!.initialize();
        if (!initialized) {
          throw new Error('Failed to initialize native camera module');
        }
        return await window.nativeVirtualCamera!.start();
      } catch (err) {
        console.error('Native camera start error:', err);
        return false;
      }
    },
    stop: () => window.nativeVirtualCamera!.stop(),
    pushFrame: async (buffer: ArrayBuffer, width: number, height: number) => {
      return await window.nativeVirtualCamera!.pushFrame(buffer, width, height);
    },
    isRunning: () => window.nativeVirtualCamera!.isRunning(),
  };
}

export function isNativeAvailable(): boolean {
  return typeof window !== 'undefined' && !!window.nativeVirtualCamera;
}

