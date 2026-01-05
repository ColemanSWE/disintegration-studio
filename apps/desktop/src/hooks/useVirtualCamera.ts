import { useState, useRef, useCallback, useEffect } from 'react';

export interface VirtualCameraState {
  isActive: boolean;
  stream: MediaStream | null;
  error: string | null;
}

export function useVirtualCamera(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  fps: number = 30
) {
  const [state, setState] = useState<VirtualCameraState>({
    isActive: false,
    stream: null,
    error: null,
  });

  const streamRef = useRef<MediaStream | null>(null);
  const trackRef = useRef<MediaStreamTrack | null>(null);

  const start = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      setState(prev => ({
        ...prev,
        error: 'Canvas not available',
      }));
      return;
    }

    try {
      const stream = canvas.captureStream(fps);
      streamRef.current = stream;
      
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        trackRef.current = videoTrack;
        videoTrack.onended = () => {
          setState(prev => ({
            ...prev,
            isActive: false,
            stream: null,
          }));
        };
      }

      setState({
        isActive: true,
        stream,
        error: null,
      });
    } catch (err) {
      setState(prev => ({
        ...prev,
        error: err instanceof Error ? err.message : 'Failed to start virtual camera',
      }));
    }
  }, [canvasRef, fps]);

  const stop = useCallback(() => {
    if (trackRef.current) {
      trackRef.current.stop();
      trackRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    setState({
      isActive: false,
      stream: null,
      error: null,
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

