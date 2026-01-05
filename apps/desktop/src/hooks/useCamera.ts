import { useState, useEffect } from 'react';

export function useCamera(constraints: MediaStreamConstraints = { video: { facingMode: 'user', width: 640, height: 480 } }) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let currentStream: MediaStream | null = null;

    async function enableStream() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        setStream(stream);
        currentStream = stream;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown camera error'));
      }
    }

    enableStream();

    return () => {
      if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  return { stream, error };
}
