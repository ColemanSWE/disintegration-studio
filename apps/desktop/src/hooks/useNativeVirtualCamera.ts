import { useState, useRef, useCallback, useEffect } from 'react';
import { getNativeModule, isNativeAvailable } from '../lib/virtual-camera-native';

export interface NativeVirtualCameraState {
  isActive: boolean;
  isAvailable: boolean;
  error: string | null;
  mode: 'native' | 'fallback';
}

export function useNativeVirtualCamera(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  fps: number = 30
) {
  const [state, setState] = useState<NativeVirtualCameraState>({
    isActive: false,
    isAvailable: isNativeAvailable(),
    error: null,
    mode: isNativeAvailable() ? 'native' : 'fallback',
  });

  const animationFrameRef = useRef<number | null>(null);
  const isRunningRef = useRef(false);
  const lastFrameTimeRef = useRef(0);

  const captureAndPushFrame = useCallback(async () => {
    const canvas = canvasRef.current;
    const nativeModule = getNativeModule();

    if (!canvas || !nativeModule || !isRunningRef.current) {
      return;
    }

    const now = performance.now();
    const frameDuration = 1000 / fps;

    if (now - lastFrameTimeRef.current < frameDuration) {
      animationFrameRef.current = requestAnimationFrame(captureAndPushFrame);
      return;
    }

    lastFrameTimeRef.current = now;

    try {
      const width = canvas.width;
      const height = canvas.height;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        throw new Error('Failed to get canvas context');
      }

      const imageData = ctx.getImageData(0, 0, width, height);
      const arrayBuffer = imageData.data.buffer.slice(
        imageData.data.byteOffset,
        imageData.data.byteOffset + imageData.data.byteLength
      );

      await nativeModule.pushFrame(arrayBuffer, width, height);
    } catch (err) {
      console.error('Failed to push frame to native camera:', err);
      setState(prev => ({
        ...prev,
        error: err instanceof Error ? err.message : 'Frame push failed',
      }));
    }

    if (isRunningRef.current) {
      animationFrameRef.current = requestAnimationFrame(captureAndPushFrame);
    }
  }, [canvasRef, fps]);

  const start = useCallback(async () => {
    const nativeModule = getNativeModule();

    if (!nativeModule) {
      setState(prev => ({
        ...prev,
        error: 'Native virtual camera not available',
      }));
      return false;
    }

    const canvas = canvasRef.current;
    if (!canvas) {
      setState(prev => ({
        ...prev,
        error: 'Canvas not available',
      }));
      return false;
    }

    try {
      const success = await nativeModule.start();

      if (!success) {
        throw new Error('Failed to start native virtual camera. Is the System Extension installed?');
      }

      isRunningRef.current = true;
      lastFrameTimeRef.current = performance.now();

      setState({
        isActive: true,
        isAvailable: true,
        error: null,
        mode: 'native',
      });

      animationFrameRef.current = requestAnimationFrame(captureAndPushFrame);

      return true;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to start native camera';
      setState(prev => ({
        ...prev,
        error: errorMsg,
      }));
      console.error('Native virtual camera error:', err);
      return false;
    }
  }, [canvasRef, captureAndPushFrame]);

  const stop = useCallback(async () => {
    isRunningRef.current = false;

    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    const nativeModule = getNativeModule();
    if (nativeModule) {
      try {
        await nativeModule.stop();
      } catch (err) {
        console.error('Failed to stop native camera:', err);
      }
    }

    setState({
      isActive: false,
      isAvailable: isNativeAvailable(),
      error: null,
      mode: isNativeAvailable() ? 'native' : 'fallback',
    });
  }, []);

  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  return {
    ...state,
    start,
    stop,
  };
}

