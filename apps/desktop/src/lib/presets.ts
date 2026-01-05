import { Effect } from './types';

export interface Preset {
  id: string;
  name: string;
  effects: Effect[];
  createdAt: number;
  updatedAt: number;
}

const STORAGE_KEY = 'kinetic-presets';
const MAX_PRESETS = 50;

export function getAllPresets(): Preset[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    return JSON.parse(stored) as Preset[];
  } catch {
    return [];
  }
}

export function savePreset(preset: Omit<Preset, 'id' | 'createdAt' | 'updatedAt'>): Preset {
  const presets = getAllPresets();
  
  if (presets.length >= MAX_PRESETS) {
    throw new Error(`Maximum of ${MAX_PRESETS} presets allowed`);
  }

  const newPreset: Preset = {
    id: Math.random().toString(36).substr(2, 9),
    name: preset.name.trim() || `Preset ${presets.length + 1}`,
    effects: preset.effects,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  presets.push(newPreset);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
  
  return newPreset;
}

export function updatePreset(id: string, updates: Partial<Omit<Preset, 'id' | 'createdAt'>>): Preset | null {
  const presets = getAllPresets();
  const index = presets.findIndex(p => p.id === id);
  
  if (index === -1) return null;

  const updated: Preset = {
    ...presets[index],
    ...updates,
    updatedAt: Date.now(),
  };

  presets[index] = updated;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
  
  return updated;
}

export function deletePreset(id: string): boolean {
  const presets = getAllPresets();
  const filtered = presets.filter(p => p.id !== id);
  
  if (filtered.length === presets.length) return false;

  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  return true;
}

export function getPreset(id: string): Preset | null {
  const presets = getAllPresets();
  return presets.find(p => p.id === id) || null;
}

