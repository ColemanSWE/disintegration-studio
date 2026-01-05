import { useState, useCallback, useRef } from "react";
import { Effect, EffectType, getDefaultParams } from "../lib/types";

export interface PhotoState {
  capturedImage: string | null;
  effects: Effect[];
}

export function usePhotoEditor() {
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [effects, setEffects] = useState<Effect[]>([]);
  const [isCapturing, setIsCapturing] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const captureFromVideo = useCallback((videoElement: HTMLVideoElement) => {
    const canvas = document.createElement("canvas");
    canvas.width = videoElement.videoWidth;
    canvas.height = videoElement.videoHeight;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(videoElement, 0, 0);
      const dataUrl = canvas.toDataURL("image/png");
      setCapturedImage(dataUrl);
    }
  }, []);

  const loadImage = useCallback((file: File) => {
    const url = URL.createObjectURL(file);
    setCapturedImage(url);
  }, []);

  const clearImage = useCallback(() => {
    setCapturedImage(null);
    setEffects([]);
  }, []);

  const addEffect = useCallback((type: EffectType) => {
    const newEffect: Effect = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      active: true,
      params: getDefaultParams(type),
    };
    setEffects((prev) => {
      if (type === "3d-mesh") {
        const without3D = prev.filter((e) => e.type !== "3d-mesh");
        return [...without3D, newEffect];
      }
      const existing3D = prev.find((e) => e.type === "3d-mesh");
      if (existing3D) {
        const without3D = prev.filter((e) => e.type !== "3d-mesh");
        return [...without3D, newEffect, existing3D];
      }
      return [...prev, newEffect];
    });
  }, []);

  const updateEffect = useCallback(
    (effectId: string, params: Record<string, unknown>) => {
      setEffects((prev) =>
        prev.map((e) =>
          e.id === effectId ? { ...e, params: { ...e.params, ...params } } : e
        )
      );
    },
    []
  );

  const toggleEffect = useCallback((effectId: string) => {
    setEffects((prev) =>
      prev.map((e) => (e.id === effectId ? { ...e, active: !e.active } : e))
    );
  }, []);

  const removeEffect = useCallback((effectId: string) => {
    setEffects((prev) => prev.filter((e) => e.id !== effectId));
  }, []);

  const reorderEffect = useCallback(
    (effectId: string, direction: "up" | "down") => {
      setEffects((prev) => {
        const index = prev.findIndex((e) => e.id === effectId);
        if (index === -1) return prev;

        const effect = prev[index];
        if (effect.type === "3d-mesh") return prev;

        const newIndex = direction === "up" ? index - 1 : index + 1;
        if (newIndex < 0 || newIndex >= prev.length) return prev;

        const targetEffect = prev[newIndex];
        if (targetEffect.type === "3d-mesh") return prev;

        const newEffects = [...prev];
        [newEffects[index], newEffects[newIndex]] = [
          newEffects[newIndex],
          newEffects[index],
        ];
        return newEffects;
      });
    },
    []
  );

  const loadPreset = useCallback((presetEffects: Effect[]) => {
    setEffects(presetEffects.map(e => ({
      ...e,
      id: Math.random().toString(36).substr(2, 9),
    })));
  }, []);

  const exportPhoto = useCallback(
    async (format: "png" | "jpeg", quality?: number): Promise<void> => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const mimeType = format === "png" ? "image/png" : "image/jpeg";
      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, mimeType, quality);
      });

      if (blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `kinetic-photo-${Date.now()}.${format}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    },
    []
  );

  return {
    capturedImage,
    effects,
    isCapturing,
    setIsCapturing,
    canvasRef,
    captureFromVideo,
    loadImage,
    clearImage,
    addEffect,
    updateEffect,
    toggleEffect,
    removeEffect,
    reorderEffect,
    loadPreset,
    exportPhoto,
  };
}
