import { useState } from 'react';
import styles from './styles/App.module.scss';
import { PhotoEditor } from './components/PhotoEditor';
import { DatamoshStudio } from './components/DatamoshStudio';
import { Camera, Film } from 'lucide-react';
import modeSelectorStyles from './styles/ModeSelector.module.scss';

type AppMode = 'photo' | 'datamosh';

type AppView = 'selector' | AppMode;

function App() {
  const [view, setView] = useState<AppView>('selector');

  const handleSelectMode = (mode: AppMode) => {
    setView(mode);
  };

  const handleBack = () => {
    setView('selector');
  };

  return (
    <div className={styles.appContainer}>
      {view === 'selector' && (
        <div className={modeSelectorStyles.modeSelector}>
          <div className={modeSelectorStyles.modeSelectorContent}>
            <h1 className={modeSelectorStyles.modeSelectorTitle}>Disintegration Studio</h1>
            <p className={modeSelectorStyles.modeSelectorSubtitle}>Photo Effects & Video Glitch Art</p>
            
            <div className={modeSelectorStyles.modeCards}>
              <button 
                className={modeSelectorStyles.modeCard}
                onClick={() => handleSelectMode('photo')}
              >
                <div className={modeSelectorStyles.modeCardIcon}>
                  <Camera size={48} strokeWidth={1.5} />
                </div>
                <h2>Photo Effects</h2>
                <p>Apply artistic effects to photos and camera feed</p>
              </button>
              
              <button 
                className={modeSelectorStyles.modeCard}
                onClick={() => handleSelectMode('datamosh')}
              >
                <div className={modeSelectorStyles.modeCardIcon}>
                  <Film size={48} strokeWidth={1.5} />
                </div>
                <h2>Datamosh Studio</h2>
                <p>Create glitch art by corrupting video codecs</p>
              </button>
            </div>
          </div>
          
          <div className={modeSelectorStyles.modeSelectorBg}>
            <div className="mode-selector-gradient" />
          </div>
        </div>
      )}
      {view === 'photo' && (
        <PhotoEditor onBack={handleBack} />
      )}
      {view === 'datamosh' && (
        <DatamoshStudio onBack={handleBack} />
      )}
    </div>
  );
}

export default App;

