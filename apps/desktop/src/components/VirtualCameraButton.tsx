import { useState, useEffect } from 'react';
import { Video, VideoOff, HelpCircle, Settings } from 'lucide-react';
import { useVirtualCamera } from '../hooks/useVirtualCamera';
import { useNativeVirtualCamera } from '../hooks/useNativeVirtualCamera';
import { isNativeAvailable } from '../lib/virtual-camera-native';
import styles from '../styles/VirtualCamera.module.scss';

interface VirtualCameraButtonProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  fps?: number;
}

export function VirtualCameraButton({ canvasRef, fps = 30 }: VirtualCameraButtonProps) {
  const [preferNative, setPreferNative] = useState(true);
  const [showHelp, setShowHelp] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const nativeCamera = useNativeVirtualCamera(canvasRef, fps);
  const fallbackCamera = useVirtualCamera(canvasRef, fps);

  const hasNative = isNativeAvailable();
  const useNative = preferNative && hasNative;

  const camera = useNative ? nativeCamera : fallbackCamera;

  useEffect(() => {
    if (!hasNative && preferNative) {
      setPreferNative(false);
    }
  }, [hasNative, preferNative]);

  const handleToggle = async () => {
    if (camera.isActive) {
      await camera.stop();
    } else {
      const success = await camera.start();
      if (!success && useNative && !camera.error?.includes('System Extension')) {
        setPreferNative(false);
        setTimeout(() => {
          fallbackCamera.start();
        }, 100);
      }
    }
  };

  return (
    <>
      <div className={styles.virtualCameraControl}>
        <button
          className={`${styles.virtualCameraBtn} ${camera.isActive ? styles.active : ''}`}
          onClick={handleToggle}
          title={camera.isActive ? 'Stop Virtual Camera' : 'Start Virtual Camera'}
        >
          {camera.isActive ? <VideoOff size={20} /> : <Video size={20} />}
          <span>{camera.isActive ? 'Stop' : 'Start'} Virtual Camera</span>
        </button>
        
        <button
          className={styles.virtualCameraHelpBtn}
          onClick={() => setShowHelp(!showHelp)}
          title="Virtual Camera Help"
        >
          <HelpCircle size={18} />
        </button>

        {hasNative && (
          <button
            className={styles.virtualCameraSettingsBtn}
            onClick={() => setShowSettings(!showSettings)}
            title="Virtual Camera Settings"
          >
            <Settings size={18} />
          </button>
        )}
      </div>

      {showSettings && hasNative && (
        <div className={styles.virtualCameraSettings} onClick={() => setShowSettings(false)}>
          <div className={styles.virtualCameraSettingsContent} onClick={(e) => e.stopPropagation()}>
            <h3>Virtual Camera Settings</h3>
            
            <div className={styles.settingOption}>
              <label>
                <input
                  type="radio"
                  checked={preferNative}
                  onChange={() => setPreferNative(true)}
                  disabled={camera.isActive}
                />
                <div>
                  <strong>Native System Camera</strong>
                  <p>Appears as "Disintegration Studio" in all apps. No OBS required.</p>
                  {nativeCamera.mode === 'native' && <span className={styles.badge}>Recommended</span>}
                </div>
              </label>
            </div>

            <div className={styles.settingOption}>
              <label>
                <input
                  type="radio"
                  checked={!preferNative}
                  onChange={() => setPreferNative(false)}
                  disabled={camera.isActive}
                />
                <div>
                  <strong>MediaStream (via OBS)</strong>
                  <p>Requires OBS Virtual Camera setup. More compatibility.</p>
                </div>
              </label>
            </div>

            {camera.isActive && (
              <p className={styles.settingNote}>
                Stop the virtual camera to change settings.
              </p>
            )}

            <button
              className={styles.virtualCameraSettingsClose}
              onClick={() => setShowSettings(false)}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {showHelp && (
        <div className={styles.virtualCameraHelp} onClick={() => setShowHelp(false)}>
          <div className={styles.virtualCameraHelpContent} onClick={(e) => e.stopPropagation()}>
            <h3>Virtual Camera Setup</h3>
            
            {useNative ? (
              <>
                <p>
                  Disintegration Studio creates a native virtual camera that appears as "Disintegration Studio Virtual Camera" 
                  in all video applications.
                </p>
                
                <div className={styles.virtualCameraSteps}>
                  <div className={styles.step}>
                    <div className={styles.stepNumber}>1</div>
                    <div className={styles.stepContent}>
                      <strong>First Time Setup</strong>
                      <p>When you first start the camera, macOS will ask for permission. 
                         Open System Preferences → Security & Privacy and click "Allow".</p>
                    </div>
                  </div>
                  
                  <div className={styles.step}>
                    <div className={styles.stepNumber}>2</div>
                    <div className={styles.stepContent}>
                      <strong>Select in Your App</strong>
                      <p>In Zoom, Discord, or any video app, choose "Disintegration Studio Virtual Camera" 
                         from the camera dropdown.</p>
                    </div>
                  </div>
                  
                  <div className={styles.step}>
                    <div className={styles.stepNumber}>3</div>
                    <div className={styles.stepContent}>
                      <strong>You're Done!</strong>
                      <p>Your virtual camera will now show whatever is displayed in Disintegration Studio.</p>
                    </div>
                  </div>
                </div>

                <div className={styles.virtualCameraNote}>
                  <strong>Troubleshooting:</strong> If the camera doesn't appear, try restarting 
                  your video app or computer. System Extensions sometimes need a reboot.
                </div>
              </>
            ) : (
              <>
                <p>
                  Disintegration Studio outputs a video stream that you can use with OBS Virtual Camera.
                </p>
                
                <div className={styles.virtualCameraSteps}>
                  <div className={styles.step}>
                    <div className={styles.stepNumber}>1</div>
                    <div className={styles.stepContent}>
                      <strong>Install OBS Studio</strong>
                      <p>Download OBS Studio (free) from <a href="https://obsproject.com" target="_blank" rel="noopener noreferrer">obsproject.com</a></p>
                    </div>
                  </div>
                  
                  <div className={styles.step}>
                    <div className={styles.stepNumber}>2</div>
                    <div className={styles.stepContent}>
                      <strong>Add Window Capture</strong>
                      <p>In OBS: Sources → "+" → "Window Capture" → Select "Disintegration Studio"</p>
                    </div>
                  </div>
                  
                  <div className={styles.step}>
                    <div className={styles.stepNumber}>3</div>
                    <div className={styles.stepContent}>
                      <strong>Start Virtual Camera</strong>
                      <p>Click "Start Virtual Camera" in OBS (bottom right)</p>
                    </div>
                  </div>
                  
                  <div className={styles.step}>
                    <div className={styles.stepNumber}>4</div>
                    <div className={styles.stepContent}>
                      <strong>Use in Your App</strong>
                      <p>Select "OBS Virtual Camera" in Zoom, Discord, etc.</p>
                    </div>
                  </div>
                </div>

                <div className={styles.virtualCameraTips}>
                  <h4>Tips:</h4>
                  <ul>
                    <li>Crop the window capture in OBS to show only the video area</li>
                    <li>Works with all major streaming and video conferencing apps</li>
                    <li>Alternative: Use screen sharing and select Disintegration Studio window</li>
                  </ul>
                </div>
              </>
            )}

            <button
              className={styles.virtualCameraHelpClose}
              onClick={() => setShowHelp(false)}
            >
              Got it
            </button>
          </div>
        </div>
      )}

      {camera.error && (
        <div className={styles.virtualCameraError}>
          <p>{camera.error}</p>
          {camera.error.includes('System Extension') && (
            <button
              className={styles.errorActionBtn}
              onClick={() => setShowHelp(true)}
            >
              Learn More
            </button>
          )}
        </div>
      )}

      {camera.isActive && (
        <div className={styles.virtualCameraStatus}>
          <div className={`${styles.statusIndicator} ${styles.active}`} />
          <span>
            {useNative ? 'Native' : 'MediaStream'} virtual camera active ({fps} FPS)
          </span>
        </div>
      )}
    </>
  );
}

