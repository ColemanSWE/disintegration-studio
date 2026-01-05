import { X, Download, Loader } from 'lucide-react';
import { useState } from 'react';

export type ExportFormat = 'png' | 'jpeg' | 'webp' | 'gif' | 'webm';

interface ExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (format: ExportFormat, quality?: number, gifOptions?: { duration: number; fps: number }) => Promise<void>;
  mode: 'photo' | 'video';
  isExporting?: boolean;
}

export function ExportDialog({ 
  isOpen, 
  onClose, 
  onExport, 
  mode,
  isExporting = false 
}: ExportDialogProps) {
  const [format, setFormat] = useState<ExportFormat>(mode === 'photo' ? 'png' : 'webm');
  const [quality, setQuality] = useState(90);
  const [gifDuration, setGifDuration] = useState(3);
  const [gifFps, setGifFps] = useState(10);

  if (!isOpen) return null;

  const handleExport = async () => {
    const gifOptions = format === 'gif' ? { duration: gifDuration, fps: gifFps } : undefined;
    await onExport(format, (format === 'jpeg' || format === 'webp') ? quality / 100 : undefined, gifOptions);
  };

  const formatOptions = mode === 'photo' 
    ? [
        { value: 'png', label: 'PNG (Lossless)' },
        { value: 'jpeg', label: 'JPEG (Smaller file)' },
        { value: 'webp', label: 'WebP (Modern, efficient)' },
        { value: 'gif', label: 'GIF (Animated)' },
      ]
    : [
        { value: 'webm', label: 'WebM (VP9)' },
      ];

  return (
    <div className="export-dialog-overlay" onClick={onClose}>
      <div className="export-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="export-dialog-header">
          <h2>Export {mode === 'photo' ? 'Photo' : 'Video'}</h2>
          <button className="export-dialog-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        
        <div className="export-dialog-body">
          <div className="export-field">
            <label>Format</label>
            <select 
              value={format} 
              onChange={(e) => setFormat(e.target.value as ExportFormat)}
              disabled={isExporting}
            >
              {formatOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          
          {(format === 'jpeg' || format === 'webp') && (
            <div className="export-field">
              <label>Quality: {quality}%</label>
              <input
                type="range"
                min={10}
                max={100}
                value={quality}
                onChange={(e) => setQuality(Number(e.target.value))}
                disabled={isExporting}
              />
            </div>
          )}
          
          {format === 'gif' && (
            <>
              <div className="export-field">
                <label>Duration: {gifDuration}s</label>
                <input
                  type="range"
                  min={1}
                  max={10}
                  value={gifDuration}
                  onChange={(e) => setGifDuration(Number(e.target.value))}
                  disabled={isExporting}
                />
              </div>
              <div className="export-field">
                <label>Frame Rate: {gifFps} fps</label>
                <input
                  type="range"
                  min={5}
                  max={30}
                  value={gifFps}
                  onChange={(e) => setGifFps(Number(e.target.value))}
                  disabled={isExporting}
                />
              </div>
            </>
          )}
        </div>
        
        <div className="export-dialog-footer">
          <button 
            className="export-btn-cancel" 
            onClick={onClose}
            disabled={isExporting}
          >
            Cancel
          </button>
          <button 
            className="export-btn-confirm"
            onClick={handleExport}
            disabled={isExporting}
          >
            {isExporting ? (
              <>
                <Loader size={16} className="spinner" />
                <span>Exporting...</span>
              </>
            ) : (
              <>
                <Download size={16} />
                <span>Export</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}


