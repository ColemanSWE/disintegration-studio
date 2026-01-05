import { useState, useEffect } from 'react';
import { Save, FolderOpen, Trash2, Edit2, X, Check } from 'lucide-react';
import { Effect } from '../lib/types';
import { getAllPresets, savePreset, deletePreset, updatePreset, Preset } from '../lib/presets';
import styles from '../styles/PresetsPanel.module.scss';

interface PresetsPanelProps {
  effects: Effect[];
  onLoadPreset: (effects: Effect[]) => void;
}

export function PresetsPanel({ effects, onLoadPreset }: PresetsPanelProps) {
  const [presets, setPresets] = useState<Preset[]>([]);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveName, setSaveName] = useState('');

  useEffect(() => {
    loadPresets();
  }, []);

  const loadPresets = () => {
    setPresets(getAllPresets());
  };

  const handleSave = () => {
    if (!saveName.trim()) return;
    
    try {
      savePreset({
        name: saveName.trim(),
        effects: effects.map(e => ({ ...e })),
      });
      setSaveName('');
      setShowSaveDialog(false);
      loadPresets();
    } catch (error: any) {
      alert(error.message || 'Failed to save preset');
    }
  };

  const handleLoad = (preset: Preset) => {
    onLoadPreset(preset.effects.map(e => ({ ...e })));
    setIsMenuOpen(false);
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Delete this preset?')) {
      deletePreset(id);
      loadPresets();
    }
  };

  const handleStartEdit = (preset: Preset, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(preset.id);
    setEditName(preset.name);
  };

  const handleSaveEdit = (id: string) => {
    if (!editName.trim()) return;
    updatePreset(id, { name: editName.trim() });
    setEditingId(null);
    setEditName('');
    loadPresets();
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditName('');
  };

  return (
    <div className={styles.presetsPanel}>
      <div className={styles.presetsHeader}>
        <h4>Presets</h4>
        <div className={styles.presetsActions}>
          <button
            className={styles.presetBtn}
            onClick={() => setShowSaveDialog(true)}
            title="Save current effects as preset"
          >
            <Save size={14} />
            Save
          </button>
          <div className={styles.presetsMenuContainer}>
            <button
              className={styles.presetBtn}
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              title="Load preset"
            >
              <FolderOpen size={14} />
              Load
            </button>
            {isMenuOpen && (
              <div className={styles.presetsMenu}>
                {presets.length === 0 ? (
                  <div className={styles.presetsEmpty}>No presets saved</div>
                ) : (
                  presets.map((preset) => (
                    <div
                      key={preset.id}
                      className={styles.presetItem}
                      onClick={() => handleLoad(preset)}
                    >
                      {editingId === preset.id ? (
                        <div className={styles.presetEdit}>
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveEdit(preset.id);
                              if (e.key === 'Escape') handleCancelEdit();
                            }}
                            autoFocus
                            className={styles.presetEditInput}
                          />
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSaveEdit(preset.id);
                            }}
                            className={styles.presetEditBtn}
                          >
                            <Check size={12} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCancelEdit();
                            }}
                            className={styles.presetEditBtn}
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ) : (
                        <>
                          <span className={styles.presetName}>{preset.name}</span>
                          <div className={styles.presetActions}>
                            <button
                              onClick={(e) => handleStartEdit(preset, e)}
                              className={styles.presetActionBtn}
                              title="Rename"
                            >
                              <Edit2 size={12} />
                            </button>
                            <button
                              onClick={(e) => handleDelete(preset.id, e)}
                              className={styles.presetActionBtn}
                              title="Delete"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {showSaveDialog && (
        <div className={styles.saveDialog}>
          <div className={styles.saveDialogContent}>
            <h5>Save Preset</h5>
            <input
              type="text"
              placeholder="Preset name"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSave();
                if (e.key === 'Escape') {
                  setShowSaveDialog(false);
                  setSaveName('');
                }
              }}
              autoFocus
              className={styles.saveInput}
            />
            <div className={styles.saveDialogActions}>
              <button onClick={handleSave} className={styles.saveBtn}>
                Save
              </button>
              <button
                onClick={() => {
                  setShowSaveDialog(false);
                  setSaveName('');
                }}
                className={styles.cancelBtn}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

