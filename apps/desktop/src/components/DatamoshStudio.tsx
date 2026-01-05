import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";
import { useEffect, useRef, useState } from "react";
import { Upload, X, Play, Download, ArrowLeft } from "lucide-react";

type MediaFile = {
  id: string;
  name: string;
  file: File;
  chunks: EncodedVideoChunk[];
  config: VideoDecoderConfig | null;
  thumbnail: string;
};

type TimelineSegment = {
  mediaId: string;
  from: number;
  to: number;
  repeat: number;
};

const CANVAS_WIDTH = 640;
const CANVAS_HEIGHT = 480;
const FPS = 30;

function computeDescription(codecData: Uint8Array): Uint8Array {
  return codecData.slice(8);
}

interface DatamoshStudioProps {
  onBack: () => void;
}

export function DatamoshStudio({ onBack }: DatamoshStudioProps) {
  const [loadingFfmpeg, setLoadingFfmpeg] = useState(true);
  const [ffmpegError, setFfmpegError] = useState<string | null>(null);
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [timeline, setTimeline] = useState<TimelineSegment[]>([]);
  const [rendering, setRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);
  const [renderStatus, setRenderStatus] = useState("");
  const [outputUrl, setOutputUrl] = useState("");
  const [processingFile, setProcessingFile] = useState<string | null>(null);
  
  const ffmpegRef = useRef(new FFmpeg());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const loadFfmpeg = async () => {
      try {
        console.log("Starting FFmpeg load...");
        const ffmpeg = ffmpegRef.current;
        ffmpeg.on("log", ({ message }) => console.log("FFmpeg:", message));

        const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm";
        console.log("Loading FFmpeg core from:", baseURL);
        
        await ffmpeg.load({
          coreURL: await toBlobURL(
            `${baseURL}/ffmpeg-core.js`,
            "text/javascript"
          ),
          wasmURL: await toBlobURL(
            `${baseURL}/ffmpeg-core.wasm`,
            "application/wasm"
          ),
        });
        
        console.log("FFmpeg loaded successfully!");
        setLoadingFfmpeg(false);
      } catch (error) {
        console.error("Failed to load FFmpeg:", error);
        setFfmpegError(error instanceof Error ? error.message : "Failed to load FFmpeg");
        setLoadingFfmpeg(false);
      }
    };
    loadFfmpeg();
  }, []);

  const processVideoFile = async (file: File): Promise<MediaFile | null> => {
    try {
      const ffmpeg = ffmpegRef.current;
      const inputName = `input_${Date.now()}.mp4`;
      const outputName = `output_${Date.now()}.mp4`;

      setProcessingFile(file.name);

      await ffmpeg.writeFile(inputName, await fetchFile(file));
      
      await ffmpeg.exec([
        "-i", inputName,
        "-vf", `scale=${CANVAS_WIDTH}:${CANVAS_HEIGHT}`,
        "-vcodec", "libx264",
        "-g", "99999999",
        "-bf", "0",
        "-flags:v", "+cgop",
        "-pix_fmt", "yuv420p",
        "-movflags", "faststart",
        "-crf", "15",
        outputName
      ]);

      const data = await ffmpeg.readFile(outputName) as Uint8Array;
      
      const chunks = await extractChunks(data);
      const config = await getVideoConfig(data);
      const thumbnail = await generateThumbnail(file);

      setProcessingFile(null);

      return {
        id: Date.now().toString(),
        name: file.name,
        file,
        chunks,
        config,
        thumbnail,
      };
    } catch (error) {
      console.error("Error processing video:", error);
      setProcessingFile(null);
      return null;
    }
  };

  const extractChunks = async (data: Uint8Array): Promise<EncodedVideoChunk[]> => {
    return new Promise((resolve, reject) => {
      const chunks: EncodedVideoChunk[] = [];
      
      try {
        const mp4boxFile = (window as any).MP4Box.createFile();
        
        mp4boxFile.onError = (e: Error) => reject(e);
        
        mp4boxFile.onReady = (info: any) => {
          const track = info.videoTracks[0];
          mp4boxFile.setExtractionOptions(track.id);
          mp4boxFile.start();
        };
        
        mp4boxFile.onSamples = (_trackId: number, _ref: any, samples: any[]) => {
          for (const sample of samples) {
            chunks.push(new EncodedVideoChunk({
              type: sample.is_sync ? "key" : "delta",
              timestamp: (1e6 * sample.cts) / sample.timescale,
              duration: (1e6 * sample.duration) / sample.timescale,
              data: sample.data,
            }));
          }
          resolve(chunks);
        };

        const buffer = data.buffer as any;
        buffer.fileStart = 0;
        mp4boxFile.appendBuffer(buffer);
        mp4boxFile.flush();
      } catch (error) {
        reject(error);
      }
    });
  };

  const getVideoConfig = async (data: Uint8Array): Promise<VideoDecoderConfig | null> => {
    return new Promise((resolve) => {
      try {
        const mp4boxFile = (window as any).MP4Box.createFile();
        
        mp4boxFile.onReady = (info: any) => {
          const track = info.videoTracks[0];
          
          for (const entry of track.mdia.minf.stbl.stsd.entries) {
            const box = entry.avcC || entry.hvcC || entry.vpcC || entry.av1C;
            if (box) {
              const stream = new (window as any).MP4Box.DataStream(undefined, 0, true);
              box.write(stream);
              const description = new Uint8Array(stream.buffer, 8);
              
              resolve({
                codec: track.codec.startsWith("vp08") ? "vp8" : track.codec,
                codedHeight: track.video.height,
                codedWidth: track.video.width,
                description,
              });
              return;
            }
          }
          resolve(null);
        };

        const buffer = data.buffer as any;
        buffer.fileStart = 0;
        mp4boxFile.appendBuffer(buffer);
        mp4boxFile.flush();
      } catch (error) {
        resolve(null);
      }
    });
  };

  const generateThumbnail = async (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const video = document.createElement("video");
      video.src = URL.createObjectURL(file);
      video.currentTime = 0.1;
      video.onloadeddata = () => {
        const canvas = document.createElement("canvas");
        canvas.width = 80;
        canvas.height = 60;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(video, 0, 0, 80, 60);
        resolve(canvas.toDataURL());
        URL.revokeObjectURL(video.src);
      };
    });
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    for (const file of Array.from(files)) {
      if (file.type.startsWith("video/")) {
        const mediaFile = await processVideoFile(file);
        if (mediaFile) {
          setMediaFiles((prev) => [...prev, mediaFile]);
        }
      }
    }
    
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const addToTimeline = (mediaFile: MediaFile) => {
    setTimeline((prev) => [
      ...prev,
      {
        mediaId: mediaFile.id,
        from: 0,
        to: mediaFile.chunks.length,
        repeat: 1,
      },
    ]);
  };

  const removeFromTimeline = (index: number) => {
    setTimeline((prev) => prev.filter((_, i) => i !== index));
  };

  const renderMosh = async () => {
    if (timeline.length === 0 || !canvasRef.current) return;

    setRendering(true);
    setRenderProgress(0);
    setRenderStatus("Initializing decoder...");
    setOutputUrl("");

    try {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d")!;

      const allChunks = timeline.flatMap((segment) => {
        const media = mediaFiles.find((m) => m.id === segment.mediaId);
        if (!media) return [];
        
        return Array(segment.repeat)
          .fill(null)
          .flatMap(() => media.chunks.slice(segment.from, segment.to));
      });

      const firstMedia = mediaFiles.find((m) => m.id === timeline[0].mediaId);
      if (!firstMedia?.config) {
        setRenderStatus("Error: No video config found");
        setRendering(false);
        return;
      }

      setRenderStatus(`Decoding ${allChunks.length} frames...`);

      const decoder = new VideoDecoder({
        error: (error) => {
          console.error("Decoder error:", error);
          setRenderStatus(`Error: ${error.message}`);
          setRendering(false);
        },
        output: (frame) => {
          ctx.drawImage(frame, 0, 0);
          frame.close();
        },
      });

      decoder.configure(firstMedia.config);

      setRenderStatus("Starting recording...");
      const stream = canvas.captureStream(FPS);
      const mimeType = MediaRecorder.isTypeSupported("video/mp4")
        ? "video/mp4"
        : "video/webm";
      const recorder = new MediaRecorder(stream, { mimeType });

      const chunks: Blob[] = [];

      recorder.addEventListener("dataavailable", (evt) => {
        if (evt.data && evt.data.size > 0) {
          chunks.push(evt.data);
        }
      });

      recorder.addEventListener("stop", () => {
        if (chunks.length > 0) {
          const blob = new Blob(chunks, { type: mimeType });
          const url = URL.createObjectURL(blob);
          setOutputUrl(url);
          setRenderStatus("Render complete!");
        } else {
          setRenderStatus("Error: No video data recorded");
        }
        setRendering(false);
      });

      recorder.addEventListener("error", (error) => {
        console.error("Recorder error:", error);
        setRenderStatus("Recording error occurred");
        setRendering(false);
      });

      recorder.start();
      setRenderStatus("Rendering frames...");

      let frameIndex = 0;
      const renderInterval = setInterval(() => {
        if (frameIndex >= allChunks.length) {
          clearInterval(renderInterval);
          setRenderStatus("Finalizing recording...");
          
          setTimeout(() => {
            recorder.stop();
            decoder.close();
            stream.getTracks().forEach(track => track.stop());
          }, 100);
          
          return;
        }

        const progress = frameIndex / allChunks.length;
        setRenderProgress(progress);
        setRenderStatus(`Rendering frame ${frameIndex + 1} of ${allChunks.length}...`);
        
        try {
          decoder.decode(allChunks[frameIndex]);
        } catch (error) {
          console.error("Decode error:", error);
        }
        
        frameIndex++;
      }, 1000 / FPS);
    } catch (error) {
      console.error("Render error:", error);
      setRenderStatus(`Error: ${error instanceof Error ? error.message : "Unknown error"}`);
      setRendering(false);
    }
  };

  if (loadingFfmpeg) {
    return (
      <div style={{ padding: "20px", color: "#e0e0e0" }}>
        <div style={{ fontSize: "16px", marginBottom: "10px" }}>Loading FFmpeg...</div>
        <div style={{ fontSize: "12px", color: "#888" }}>
          This may take a moment on first load. Check the console for details.
        </div>
      </div>
    );
  }

  if (ffmpegError) {
    return (
      <div style={{ padding: "20px", color: "#e0e0e0" }}>
        <div style={{ fontSize: "16px", marginBottom: "10px", color: "#ff5555" }}>
          Failed to load FFmpeg
        </div>
        <div style={{ fontSize: "12px", color: "#888", marginBottom: "15px" }}>
          {ffmpegError}
        </div>
        <div style={{ fontSize: "12px", color: "#888" }}>
          Note: FFmpeg requires SharedArrayBuffer support. Make sure your browser supports it
          and that the appropriate CORS headers are set.
        </div>
        <button
          onClick={() => window.location.reload()}
          style={{
            marginTop: "15px",
            padding: "8px 16px",
            background: "#2a2a2b",
            color: "#e0e0e0",
            border: "1px solid #3a3a3b",
            borderRadius: "2px",
            cursor: "pointer",
            fontSize: "12px",
          }}
        >
          Reload Page
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: "20px", color: "#e0e0e0", maxWidth: "1200px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
        <button
          onClick={onBack}
          style={{
            padding: "6px 12px",
            background: "#2a2a2b",
            color: "#e0e0e0",
            border: "1px solid #3a3a3b",
            borderRadius: "2px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "12px",
          }}
        >
          <ArrowLeft size={14} />
          Back
        </button>
        <h2 style={{ fontSize: "18px", fontWeight: 600, margin: 0 }}>
          Datamosh Studio
        </h2>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        multiple
        style={{ display: "none" }}
        onChange={handleFileSelect}
      />

      <div style={{ marginBottom: "30px" }}>
        <h3 style={{ fontSize: "14px", marginBottom: "10px" }}>Media Files</h3>
        
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={!!processingFile}
          style={{
            padding: "8px 16px",
            background: "#00ff88",
            color: "#0a0a0b",
            border: "none",
            borderRadius: "2px",
            cursor: "pointer",
            fontWeight: 600,
            fontSize: "12px",
            marginBottom: "15px",
            display: "flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          <Upload size={14} />
          {processingFile ? `Processing ${processingFile}...` : "Upload Videos"}
        </button>

        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          {mediaFiles.map((media) => (
            <div
              key={media.id}
              style={{
                position: "relative",
                width: "120px",
                border: "1px solid #2a2a2b",
                borderRadius: "2px",
                overflow: "hidden",
                background: "#1a1a1b",
              }}
            >
              <img
                src={media.thumbnail}
                alt={media.name}
                style={{ width: "100%", height: "80px", objectFit: "cover" }}
              />
              <div style={{ padding: "8px", fontSize: "11px" }}>
                <div style={{ marginBottom: "4px", fontWeight: 600 }}>
                  {media.name}
                </div>
                <div style={{ color: "#888", fontSize: "10px" }}>
                  {media.chunks.length} frames
                </div>
                <button
                  onClick={() => addToTimeline(media)}
                  style={{
                    marginTop: "6px",
                    padding: "4px 8px",
                    background: "#2a2a2b",
                    color: "#e0e0e0",
                    border: "1px solid #3a3a3b",
                    borderRadius: "2px",
                    cursor: "pointer",
                    fontSize: "10px",
                    width: "100%",
                  }}
                >
                  Add to Timeline
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: "30px" }}>
        <h3 style={{ fontSize: "14px", marginBottom: "10px" }}>Timeline</h3>
        
        {timeline.length === 0 ? (
          <div style={{ color: "#666", fontSize: "12px", padding: "20px", textAlign: "center", border: "1px dashed #2a2a2b", borderRadius: "2px" }}>
            Add videos to the timeline to start moshing
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {timeline.map((segment, index) => {
              const media = mediaFiles.find((m) => m.id === segment.mediaId);
              return (
                <div
                  key={index}
                  style={{
                    padding: "12px",
                    background: "#1a1a1b",
                    border: "1px solid #2a2a2b",
                    borderRadius: "2px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <div style={{ fontSize: "12px" }}>
                    <span style={{ fontWeight: 600 }}>{media?.name}</span>
                    <span style={{ color: "#888", marginLeft: "10px" }}>
                      Frames {segment.from}-{segment.to} × {segment.repeat}
                    </span>
                  </div>
                  <button
                    onClick={() => removeFromTimeline(index)}
                    style={{
                      padding: "4px",
                      background: "transparent",
                      color: "#ff5555",
                      border: "none",
                      cursor: "pointer",
                      lineHeight: 0,
                    }}
                  >
                    <X size={16} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div style={{ marginBottom: "30px" }}>
        <button
          onClick={renderMosh}
          disabled={rendering || timeline.length === 0}
          style={{
            padding: "10px 20px",
            background: timeline.length === 0 ? "#2a2a2b" : "#00ff88",
            color: timeline.length === 0 ? "#666" : "#0a0a0b",
            border: "none",
            borderRadius: "2px",
            cursor: timeline.length === 0 ? "not-allowed" : "pointer",
            fontWeight: 600,
            fontSize: "14px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            marginBottom: rendering ? "12px" : "0",
          }}
        >
          <Play size={16} />
          {rendering ? "Rendering..." : "Render Datamosh"}
        </button>
        
        {rendering && (
          <div style={{ marginTop: "12px" }}>
            <div style={{ 
              fontSize: "12px", 
              color: "#888", 
              marginBottom: "6px",
              minHeight: "16px",
            }}>
              {renderStatus}
            </div>
            <div style={{
              width: "100%",
              height: "8px",
              background: "#2a2a2b",
              borderRadius: "2px",
              overflow: "hidden",
            }}>
              <div style={{
                width: `${renderProgress * 100}%`,
                height: "100%",
                background: "#00ff88",
                transition: "width 0.1s ease",
              }} />
            </div>
            <div style={{ 
              fontSize: "11px", 
              color: "#666", 
              marginTop: "4px",
              textAlign: "right",
            }}>
              {Math.round(renderProgress * 100)}%
            </div>
          </div>
        )}
      </div>

      {(rendering || outputUrl) && (
        <div style={{ marginBottom: "15px" }}>
          <div style={{ fontSize: "12px", color: "#888", marginBottom: "6px" }}>
            {rendering ? "Live Preview (rendering in progress)" : "Final Output"}
          </div>
          <canvas
            ref={canvasRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            style={{
              display: "block",
              width: "100%",
              maxWidth: "640px",
              border: "1px solid #2a2a2b",
              borderRadius: "2px",
              background: "#0a0a0b",
            }}
          />
        </div>
      )}

      {outputUrl && (
        <div>
          <video
            src={outputUrl}
            controls
            loop
            autoPlay
            onError={(e) => {
              console.error("Video load error:", e);
              setRenderStatus("Error loading video");
            }}
            onLoadedData={() => {
              console.log("Video loaded successfully");
            }}
            style={{
              width: "100%",
              maxWidth: "640px",
              border: "1px solid #2a2a2b",
              borderRadius: "2px",
              marginBottom: "15px",
            }}
          />
          <a
            href={outputUrl}
            download={`datamosh_${Date.now()}.${outputUrl.includes('mp4') ? 'mp4' : 'webm'}`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "8px 16px",
              background: "#2a2a2b",
              color: "#e0e0e0",
              textDecoration: "none",
              borderRadius: "2px",
              fontSize: "12px",
              fontWeight: 600,
            }}
          >
            <Download size={14} />
            Download
          </a>
        </div>
      )}
    </div>
  );
}

