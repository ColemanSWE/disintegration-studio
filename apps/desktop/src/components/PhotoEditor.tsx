import { useEffect, useRef, useState } from "react";
import { Camera, Upload, Trash2, Download, ArrowLeft } from "lucide-react";
import { useCamera } from "../hooks/useCamera";
import { usePhotoEditor } from "../hooks/usePhotoEditor";
import { EffectsPanel } from "./EffectsPanel";
import { ExportDialog, ExportFormat } from "./ExportDialog";
import { ThreeView } from "./ThreeView";
import { VirtualCameraButton } from "./VirtualCameraButton";
import {
  renderWithEffects,
  getActiveStyleEffect,
  initializeEmojiPalette,
} from "../lib/effects-renderer";
import { PaletteKey } from "../lib/palettes";
import editorStyles from "../styles/Editor.module.scss";
import photoStyles from "../styles/PhotoEditor.module.scss";

interface PhotoEditorProps {
  onBack: () => void;
}

export function PhotoEditor({ onBack }: PhotoEditorProps) {
  const { stream } = useCamera();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const threeSourceCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  const photoEditor = usePhotoEditor();
  const {
    capturedImage,
    effects,
    addEffect,
    updateEffect,
    toggleEffect,
    removeEffect,
    reorderEffect,
    loadPreset,
    captureFromVideo,
    loadImage,
    clearImage,
  } = photoEditor;

  const [showExport, setShowExport] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [emojiReady, setEmojiReady] = useState(false);
  const [threeCanvasReady, setThreeCanvasReady] = useState(false);
  const [threeCanvasHasContent, setThreeCanvasHasContent] = useState(false);

  const tickRef = useRef(0);
  const bufferRef = useRef<HTMLCanvasElement | null>(null);

  const activeStyle = getActiveStyleEffect(effects);
  const is3DMode = activeStyle?.type === "3d-mesh";

  useEffect(() => {
    bufferRef.current = document.createElement("canvas");
  }, []);

  useEffect(() => {
    if (activeStyle?.type === "emoji") {
      const palette = (activeStyle.params.palette as PaletteKey) || "full";
      setEmojiReady(false);
      initializeEmojiPalette(palette).then(() => setEmojiReady(true));
    }
  }, [effects, activeStyle]);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(() => {});
    }
  }, [stream]);

  useEffect(() => {
    if (is3DMode && threeSourceCanvasRef.current) {
      const canvas = threeSourceCanvasRef.current;
      const ctx = canvas.getContext("2d");
      if (ctx && (canvas.width === 0 || canvas.height === 0)) {
        canvas.width = 640;
        canvas.height = 480;
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        setThreeCanvasReady(true);
      }
    } else {
      setThreeCanvasReady(false);
    }
  }, [is3DMode]);

  useEffect(() => {
    let animId: number;
    const canvas = canvasRef.current;
    const buffer = bufferRef.current;
    const threeCanvas = threeSourceCanvasRef.current;

    if (!buffer) return;
    const bufferCtx = buffer.getContext("2d", { willReadFrequently: true });
    if (!bufferCtx) return;

    const ctx = canvas?.getContext("2d", { alpha: false });
    const threeCtx = threeCanvas?.getContext("2d", {
      willReadFrequently: true,
    });

    const needsEmoji = activeStyle?.type === "emoji";
    if (needsEmoji && !emojiReady) return;

    if (is3DMode && (!threeCanvas || !threeCtx)) return;
    if (!is3DMode && (!canvas || !ctx)) return;

    const render = () => {
      tickRef.current += 1;

      let source: CanvasImageSource | null = null;
      let sourceWidth = 0;
      let sourceHeight = 0;

      if (capturedImage) {
        const img = imageRef.current;
        if (img && img.complete && img.naturalWidth > 0) {
          source = img;
          sourceWidth = img.naturalWidth;
          sourceHeight = img.naturalHeight;
        }
      } else if (
        videoRef.current &&
        videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA
      ) {
        source = videoRef.current;
        sourceWidth = videoRef.current.videoWidth;
        sourceHeight = videoRef.current.videoHeight;
      }

      if (!source) {
        if (is3DMode && threeCanvas && threeCtx) {
          if (threeCanvas.width === 0 || threeCanvas.height === 0) {
            threeCanvas.width = 640;
            threeCanvas.height = 480;
          }
          threeCtx.fillStyle = "#000";
          threeCtx.fillRect(0, 0, threeCanvas.width, threeCanvas.height);
        } else if (!is3DMode && canvas && ctx) {
          const rect = canvas.getBoundingClientRect();
          if (canvas.width !== rect.width || canvas.height !== rect.height) {
            canvas.width = rect.width;
            canvas.height = rect.height;
          }
          ctx.fillStyle = "#111";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
      } else if (is3DMode && threeCanvas && threeCtx) {
        const effectsWithout3D = effects.filter((e) => e.type !== "3d-mesh");

        if (
          threeCanvas.width !== sourceWidth ||
          threeCanvas.height !== sourceHeight
        ) {
          threeCanvas.width = sourceWidth;
          threeCanvas.height = sourceHeight;
        }

        const tempCanvas = document.createElement("canvas");
        tempCanvas.width = sourceWidth;
        tempCanvas.height = sourceHeight;
        const tempCtx = tempCanvas.getContext("2d", {
          willReadFrequently: true,
        });

        if (tempCtx) {
          renderWithEffects(
            {
              ctx: tempCtx,
              buffer,
              bufferCtx,
              source,
              sourceWidth,
              sourceHeight,
              canvasWidth: sourceWidth,
              canvasHeight: sourceHeight,
              tick: tickRef.current,
            },
            effectsWithout3D
          );

          threeCtx.drawImage(tempCanvas, 0, 0);
        }

        if (sourceWidth > 0 && sourceHeight > 0) {
          setThreeCanvasReady(true);
          setThreeCanvasHasContent(true);
        }
      } else if (canvas && ctx) {
        const rect = canvas.getBoundingClientRect();
        if (canvas.width !== rect.width || canvas.height !== rect.height) {
          canvas.width = rect.width;
          canvas.height = rect.height;
        }

        renderWithEffects(
          {
            ctx,
            buffer,
            bufferCtx,
            source,
            sourceWidth,
            sourceHeight,
            canvasWidth: canvas.width,
            canvasHeight: canvas.height,
            tick: tickRef.current,
          },
          effects
        );
      }

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animId) cancelAnimationFrame(animId);
    };
  }, [capturedImage, effects, emojiReady, is3DMode, activeStyle, stream]);

  const handleCapture = () => {
    if (videoRef.current) {
      captureFromVideo(videoRef.current);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith("image/")) {
      loadImage(file);
    }
  };

  const handleExport = async (
    format: ExportFormat,
    quality?: number,
    gifOptions?: { duration: number; fps: number }
  ) => {
    if (format === "webm") return;

    setIsExporting(true);
    try {
      const canvas = canvasRef.current;
      if (!canvas) return;

      if (format === "gif" && gifOptions) {
        await exportGIF(canvas, gifOptions);
      } else {
        let mimeType: string;
        switch (format) {
          case "png":
            mimeType = "image/png";
            break;
          case "jpeg":
            mimeType = "image/jpeg";
            break;
          case "webp":
            mimeType = "image/webp";
            break;
          default:
            mimeType = "image/png";
        }

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
      }
    } finally {
      setIsExporting(false);
      setShowExport(false);
    }
  };

  const exportGIF = async (
    canvas: HTMLCanvasElement,
    options: { duration: number; fps: number }
  ) => {
    const frames: string[] = [];
    const frameDelay = 1000 / options.fps;
    const totalFrames = Math.floor(options.duration * options.fps);

    for (let i = 0; i < totalFrames; i++) {
      frames.push(canvas.toDataURL("image/png"));
      await new Promise((resolve) => setTimeout(resolve, frameDelay));
    }

    const gifBlob = await createGIFFromFrames(
      frames,
      frameDelay,
      canvas.width,
      canvas.height
    );

    if (gifBlob) {
      const url = URL.createObjectURL(gifBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `kinetic-photo-${Date.now()}.gif`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  const createGIFFromFrames = async (
    frames: string[],
    delay: number,
    width: number,
    height: number
  ): Promise<Blob | null> => {
    try {
      const GIF = (await import("gif.js")).default;
      const gif = new GIF({
        workers: 2,
        quality: 10,
        width,
        height,
      });

      for (const frameDataUrl of frames) {
        const img = new Image();
        await new Promise<void>((resolve, reject) => {
          img.onload = () => {
            gif.addFrame(img, { delay: Math.round(delay / 10) });
            resolve();
          };
          img.onerror = reject;
          img.src = frameDataUrl;
        });
      }

      return new Promise<Blob>((resolve) => {
        gif.on("finished", (blob: Blob) => resolve(blob));
        gif.on("progress", () => {});
        gif.render();
      });
    } catch (error) {
      console.error("GIF export failed, falling back to single frame:", error);
      const img = new Image();
      return new Promise<Blob | null>((resolve) => {
        img.onload = () => {
          const fallbackCanvas = document.createElement("canvas");
          fallbackCanvas.width = width;
          fallbackCanvas.height = height;
          const ctx = fallbackCanvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(img, 0, 0);
            fallbackCanvas.toBlob(resolve, "image/png");
          } else {
            resolve(null);
          }
        };
        img.onerror = () => resolve(null);
        img.src = frames[0];
      });
    }
  };

  const displacementScale =
    (activeStyle?.params?.displacementScale as number) || 3;
  const wireframe = (activeStyle?.params?.wireframe as boolean) ?? true;

  return (
    <div className={editorStyles.editor}>
      <video ref={videoRef} style={{ display: "none" }} playsInline muted />
      {capturedImage && (
        <img
          ref={imageRef}
          src={capturedImage}
          style={{ display: "none" }}
          alt="captured"
        />
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={handleFileUpload}
      />

      <header className={editorStyles.editorHeader}>
        <button className={editorStyles.headerBtn} onClick={onBack}>
          <ArrowLeft size={20} />
          <span>Back</span>
        </button>
        <h1>Photo Editor</h1>
        <div className={editorStyles.headerActions}>
          <VirtualCameraButton canvasRef={canvasRef} />
          {capturedImage && (
            <button
              className={`${editorStyles.headerBtn} ${editorStyles.primary}`}
              onClick={() => setShowExport(true)}
            >
              <Download size={20} />
              <span>Export</span>
            </button>
          )}
        </div>
      </header>

      <div className={editorStyles.editorMain}>
        <div className={editorStyles.editorViewport}>
          {is3DMode ? (
            <div
              className={editorStyles.mainCanvas}
              style={{ width: "100%", height: "100%" }}
            >
              <canvas ref={threeSourceCanvasRef} style={{ display: "none" }} />
              {threeSourceCanvasRef.current &&
                threeCanvasReady &&
                threeCanvasHasContent && (
                  <ThreeView
                    key={`${threeSourceCanvasRef.current.width}x${threeSourceCanvasRef.current.height}`}
                    source={threeSourceCanvasRef.current}
                    displacementScale={displacementScale}
                    wireframe={wireframe}
                  />
                )}
            </div>
          ) : (
            <canvas
              ref={canvasRef}
              className={editorStyles.mainCanvas}
              style={{
                transform: !capturedImage ? "scaleX(-1)" : "none",
              }}
            />
          )}

          {!capturedImage && (
            <div className={photoStyles.captureControls}>
              <button
                className={photoStyles.captureBtn}
                onClick={handleCapture}
              >
                <Camera size={24} />
              </button>
              <button
                className={photoStyles.uploadBtn}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload size={20} />
                <span>Upload</span>
              </button>
            </div>
          )}

          {capturedImage && (
            <div className={photoStyles.photoActions}>
              <button
                className={photoStyles.photoActionBtn}
                onClick={clearImage}
                title="Discard photo"
              >
                <Trash2 size={18} />
                <span>Discard</span>
              </button>
            </div>
          )}
        </div>

        <aside className={editorStyles.editorSidebar}>
          <EffectsPanel
            effects={effects}
            onAddEffect={addEffect}
            onToggleEffect={toggleEffect}
            onUpdateEffect={updateEffect}
            onRemoveEffect={removeEffect}
            onReorderEffect={reorderEffect}
            onLoadPreset={loadPreset}
            canvasRef={canvasRef}
          />
        </aside>
      </div>

      <ExportDialog
        isOpen={showExport}
        onClose={() => setShowExport(false)}
        onExport={handleExport}
        mode="photo"
        isExporting={isExporting}
      />
    </div>
  );
}
