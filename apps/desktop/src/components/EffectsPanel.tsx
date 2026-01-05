import {
  Plus,
  X,
  ChevronDown,
  ChevronUp,
  Upload,
  Camera,
  Trash2,
  RefreshCcw,
  Image as ImageIcon,
} from "lucide-react";
import { useState, useRef } from "react";
import { Effect, EffectType } from "../lib/types";
import { PALETTES } from "../lib/palettes";
import { PresetsPanel } from "./PresetsPanel";
import styles from "../styles/EffectsPanel.module.scss";

interface EffectsPanelProps {
  effects: Effect[];
  onAddEffect: (type: EffectType) => void;
  onToggleEffect: (effectId: string) => void;
  onUpdateEffect: (effectId: string, params: Record<string, unknown>) => void;
  onRemoveEffect: (effectId: string) => void;
  onReorderEffect?: (effectId: string, direction: "up" | "down") => void;
  onLoadPreset?: (effects: Effect[]) => void;
  title?: string;
  canvasRef?: React.RefObject<HTMLCanvasElement | null>;
}

interface EffectOption {
  type: EffectType;
  label: string;
  category: "glitch" | "distortion" | "color" | "retro" | "noise" | "style";
}

const EFFECT_OPTIONS: EffectOption[] = [
  { type: "glitch", label: "Digital Glitch", category: "glitch" },
  { type: "datamosh", label: "Datamosh", category: "glitch" },
  { type: "block-shoving", label: "Block Shoving", category: "glitch" },
  { type: "motion-smear", label: "Motion Smear", category: "glitch" },
  { type: "block-corrupt", label: "Block Corrupt", category: "glitch" },
  { type: "pixel-sort", label: "Pixel Sort", category: "glitch" },
  { type: "rgb-channel-separation", label: "RGB Split", category: "glitch" },

  {
    type: "chromatic-aberration",
    label: "Chromatic Aberration",
    category: "distortion",
  },
  { type: "mirror", label: "Mirror", category: "distortion" },
  { type: "displacement", label: "Displacement", category: "distortion" },
  { type: "wave-distortion", label: "Wave", category: "distortion" },
  { type: "twirl", label: "Twirl", category: "distortion" },
  { type: "ripple", label: "Ripple", category: "distortion" },

  { type: "invert", label: "Invert", category: "color" },
  { type: "posterize", label: "Posterize", category: "color" },
  { type: "solarize", label: "Solarize", category: "color" },
  { type: "duotone", label: "Duotone", category: "color" },
  { type: "color-shift", label: "Color Shift", category: "color" },
  { type: "channel-swap", label: "Channel Swap", category: "color" },
  { type: "thermal", label: "Thermal", category: "color" },
  { type: "edge-detect", label: "Edge Detect", category: "color" },
  { type: "vignette", label: "Vignette", category: "color" },
  { type: "bloom", label: "Bloom", category: "color" },

  { type: "vhs", label: "VHS", category: "retro" },
  { type: "crt", label: "CRT", category: "retro" },
  { type: "scanlines", label: "Scanlines", category: "retro" },
  { type: "dither", label: "Dither", category: "retro" },

  { type: "film-grain", label: "Film Grain", category: "noise" },
  { type: "noise", label: "Static Noise", category: "noise" },

  { type: "pixelate", label: "Pixelate", category: "style" },
  { type: "emoji", label: "Emoji", category: "style" },
  { type: "ascii", label: "ASCII", category: "style" },
  { type: "matrix", label: "Matrix", category: "style" },
  { type: "halftone", label: "Halftone", category: "style" },
  { type: "3d-mesh", label: "3D Mesh", category: "style" },
];

const CATEGORY_LABELS: Record<EffectOption["category"], string> = {
  glitch: "Glitch",
  distortion: "Distortion",
  color: "Color",
  retro: "Retro",
  noise: "Noise",
  style: "Style",
};

const STYLE_EFFECT_TYPES = [
  "pixelate",
  "emoji",
  "ascii",
  "matrix",
  "halftone",
  "3d-mesh",
];

export function EffectsPanel({
  effects,
  onAddEffect,
  onToggleEffect,
  onUpdateEffect,
  onRemoveEffect,
  onReorderEffect,
  onLoadPreset,
  title = "Effects",
  canvasRef,
}: EffectsPanelProps) {
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);

  const categories = [
    "glitch",
    "distortion",
    "color",
    "retro",
    "noise",
    "style",
  ] as const;

  return (
    <div className={styles.effectsPanel}>
      <div className={styles.effectsPanelHeader}>
        <h3>{title}</h3>
        <div className={styles.effectsAddContainer}>
          <button
            className={styles.effectsAddBtn}
            onClick={() => setIsAddMenuOpen(!isAddMenuOpen)}
          >
            <Plus size={16} />
            <span>Add Effect</span>
          </button>

          {isAddMenuOpen && (
            <div className={styles.effectsAddMenu}>
              {categories.map((category) => {
                const categoryEffects = EFFECT_OPTIONS.filter(
                  (e) => e.category === category
                );
                if (categoryEffects.length === 0) return null;
                return (
                  <div key={category} className={styles.effectsMenuSection}>
                    <span className={styles.effectsMenuLabel}>
                      {CATEGORY_LABELS[category]}
                    </span>
                    {categoryEffects.map((opt) => (
                      <button
                        key={opt.type}
                        className={styles.effectsAddMenuItem}
                        onClick={() => {
                          onAddEffect(opt.type);
                          setIsAddMenuOpen(false);
                        }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className={styles.effectsList}>
        {effects.length === 0 ? (
          <div className={styles.effectsEmpty}>
            No effects applied. Click "Add Effect" to get started.
          </div>
        ) : (
          effects.map((effect, index) => {
            const is3DMesh = effect.type === "3d-mesh";
            const isLast = index === effects.length - 1;
            const has3DMeshAfter = effects
              .slice(index + 1)
              .some((e) => e.type === "3d-mesh");

            return (
              <EffectCard
                key={effect.id}
                effect={effect}
                index={index}
                total={effects.length}
                onToggle={() => onToggleEffect(effect.id)}
                onUpdate={(params) => onUpdateEffect(effect.id, params)}
                onRemove={() => onRemoveEffect(effect.id)}
                onMoveUp={
                  onReorderEffect && !is3DMesh && index > 0 && !has3DMeshAfter
                    ? () => onReorderEffect(effect.id, "up")
                    : undefined
                }
                onMoveDown={
                  onReorderEffect && !is3DMesh && !isLast && !has3DMeshAfter
                    ? () => onReorderEffect(effect.id, "down")
                    : undefined
                }
                canvasRef={canvasRef}
              />
            );
          })
        )}
      </div>

      {onLoadPreset && (
        <PresetsPanel effects={effects} onLoadPreset={onLoadPreset} />
      )}
    </div>
  );
}

interface EffectCardProps {
  effect: Effect;
  index: number;
  total: number;
  onToggle: () => void;
  onUpdate: (params: Record<string, unknown>) => void;
  onRemove: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  canvasRef?: React.RefObject<HTMLCanvasElement | null>;
}

function EffectCard({
  effect,
  index,
  total,
  onToggle,
  onUpdate,
  onRemove,
  onMoveUp,
  onMoveDown,
  canvasRef,
}: EffectCardProps) {
  const isStyleEffect = STYLE_EFFECT_TYPES.includes(effect.type);
  const effectOption = EFFECT_OPTIONS.find((e) => e.type === effect.type);
  const label = effectOption?.label || effect.type;

  return (
    <div
      className={`${styles.effectCard} ${
        !effect.active ? styles.disabled : ""
      } ${isStyleEffect ? styles.style : ""}`}
    >
      <div className={styles.effectCardHeader}>
        <label className={styles.effectToggle}>
          <input type="checkbox" checked={effect.active} onChange={onToggle} />
          <span className={styles.effectName}>{label}</span>
          {isStyleEffect && <span className={styles.effectBadge}>Style</span>}
        </label>

        <div className={styles.effectCardActions}>
          {effect.type === "3d-mesh" ? (
            <>
              <button
                className={`${styles.effectActionBtn} ${styles.disabled}`}
                disabled
                title="3D Mesh must stay last to preserve live preview"
              >
                <ChevronUp size={14} />
              </button>
              <button
                className={`${styles.effectActionBtn} ${styles.disabled}`}
                disabled
                title="3D Mesh must stay last to preserve live preview"
              >
                <ChevronDown size={14} />
              </button>
            </>
          ) : (
            <>
              {onMoveUp && index > 0 && (
                <button
                  className={styles.effectActionBtn}
                  onClick={onMoveUp}
                  title="Move up"
                >
                  <ChevronUp size={14} />
                </button>
              )}
              {onMoveDown && index < total - 1 && (
                <button
                  className={styles.effectActionBtn}
                  onClick={onMoveDown}
                  title="Move down"
                >
                  <ChevronDown size={14} />
                </button>
              )}
            </>
          )}
          <button
            className={`${styles.effectActionBtn} ${styles.remove}`}
            onClick={onRemove}
            title="Remove"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {effect.active && (
        <div className={styles.effectCardParams}>
          <EffectParams
            effect={effect}
            onUpdate={onUpdate}
            canvasRef={canvasRef}
          />
        </div>
      )}
    </div>
  );
}

interface EffectParamsProps {
  effect: Effect;
  onUpdate: (params: Record<string, unknown>) => void;
  canvasRef?: React.RefObject<HTMLCanvasElement | null>;
}

function EffectParams({ effect, onUpdate, canvasRef }: EffectParamsProps) {
  switch (effect.type) {
    case "invert":
      return null;

    case "glitch":
      return (
        <>
          <ParamSlider
            label="Intensity"
            value={(effect.params.intensity as number) || 50}
            min={0}
            max={100}
            onChange={(v) => onUpdate({ intensity: v })}
          />
          <ParamSlider
            label="Speed"
            value={(effect.params.speed as number) || 10}
            min={0}
            max={50}
            onChange={(v) => onUpdate({ speed: v })}
          />
        </>
      );

    case "datamosh":
      return (
        <DatamoshParams
          effect={effect}
          onUpdate={onUpdate}
          canvasRef={canvasRef}
        />
      );

    case "block-shoving":
      return (
        <BlockShovingParams
          effect={effect}
          onUpdate={onUpdate}
          canvasRef={canvasRef}
        />
      );

    case "motion-smear":
      return (
        <MotionSmearParams
          effect={effect}
          onUpdate={onUpdate}
          canvasRef={canvasRef}
        />
      );

    case "block-corrupt":
      return (
        <>
          <ParamSlider
            label="Intensity"
            value={(effect.params.intensity as number) || 30}
            min={0}
            max={100}
            onChange={(v) => onUpdate({ intensity: v })}
          />
          <ParamSlider
            label="Block Size"
            value={(effect.params.blockSize as number) || 16}
            min={4}
            max={64}
            suffix="px"
            onChange={(v) => onUpdate({ blockSize: v })}
          />
        </>
      );

    case "pixel-sort":
      return (
        <>
          <ParamSlider
            label="Threshold"
            value={(effect.params.threshold as number) || 50}
            min={0}
            max={255}
            onChange={(v) => onUpdate({ threshold: v })}
          />
          <ParamSelect
            label="Direction"
            value={(effect.params.direction as string) || "horizontal"}
            options={[
              ["horizontal", "Horizontal"],
              ["vertical", "Vertical"],
            ]}
            onChange={(v) => onUpdate({ direction: v })}
          />
        </>
      );

    case "rgb-channel-separation":
      return (
        <>
          <ParamSlider
            label="R Offset"
            value={(effect.params.rOffset as number) || 5}
            min={-30}
            max={30}
            suffix="px"
            onChange={(v) => onUpdate({ rOffset: v })}
          />
          <ParamSlider
            label="G Offset"
            value={(effect.params.gOffset as number) || 0}
            min={-30}
            max={30}
            suffix="px"
            onChange={(v) => onUpdate({ gOffset: v })}
          />
          <ParamSlider
            label="B Offset"
            value={(effect.params.bOffset as number) || -5}
            min={-30}
            max={30}
            suffix="px"
            onChange={(v) => onUpdate({ bOffset: v })}
          />
        </>
      );

    case "dither":
      return (
        <ParamSlider
          label="Depth"
          value={(effect.params.depth as number) || 4}
          min={2}
          max={16}
          onChange={(v) => onUpdate({ depth: v })}
        />
      );

    case "chromatic-aberration":
      return (
        <ParamSlider
          label="Offset"
          value={(effect.params.offset as number) || 5}
          min={1}
          max={30}
          suffix="px"
          onChange={(v) => onUpdate({ offset: v })}
        />
      );

    case "vignette":
      return (
        <>
          <ParamSlider
            label="Intensity"
            value={((effect.params.intensity as number) || 0.5) * 100}
            min={0}
            max={100}
            suffix="%"
            onChange={(v) => onUpdate({ intensity: v / 100 })}
          />
          <ParamSlider
            label="Radius"
            value={((effect.params.radius as number) || 0.8) * 100}
            min={30}
            max={150}
            suffix="%"
            onChange={(v) => onUpdate({ radius: v / 100 })}
          />
        </>
      );

    case "film-grain":
      return (
        <ParamSlider
          label="Intensity"
          value={(effect.params.intensity as number) || 30}
          min={0}
          max={100}
          onChange={(v) => onUpdate({ intensity: v })}
        />
      );

    case "scanlines":
      return (
        <>
          <ParamSlider
            label="Spacing"
            value={(effect.params.spacing as number) || 3}
            min={2}
            max={10}
            suffix="px"
            onChange={(v) => onUpdate({ spacing: v })}
          />
          <ParamSlider
            label="Opacity"
            value={((effect.params.opacity as number) || 0.4) * 100}
            min={10}
            max={90}
            suffix="%"
            onChange={(v) => onUpdate({ opacity: v / 100 })}
          />
        </>
      );

    case "edge-detect":
      return (
        <>
          <ParamSlider
            label="Threshold"
            value={(effect.params.threshold as number) || 50}
            min={10}
            max={200}
            onChange={(v) => onUpdate({ threshold: v })}
          />
          <ParamCheckbox
            label="Invert"
            checked={(effect.params.invert as boolean) || false}
            onChange={(v) => onUpdate({ invert: v })}
          />
        </>
      );

    case "thermal":
      return (
        <ParamSelect
          label="Palette"
          value={(effect.params.palette as string) || "thermal"}
          options={[
            ["thermal", "Thermal"],
            ["night-vision", "Night Vision"],
            ["infrared", "Infrared"],
          ]}
          onChange={(v) => onUpdate({ palette: v })}
        />
      );

    case "mirror":
      return (
        <ParamSelect
          label="Mode"
          value={(effect.params.mode as string) || "horizontal"}
          options={[
            ["horizontal", "Horizontal"],
            ["vertical", "Vertical"],
            ["quad", "Quad"],
            ["kaleidoscope", "Kaleidoscope"],
          ]}
          onChange={(v) => onUpdate({ mode: v })}
        />
      );

    case "bloom":
      return (
        <>
          <ParamSlider
            label="Threshold"
            value={(effect.params.threshold as number) || 200}
            min={100}
            max={255}
            onChange={(v) => onUpdate({ threshold: v })}
          />
          <ParamSlider
            label="Intensity"
            value={((effect.params.intensity as number) || 0.5) * 100}
            min={10}
            max={100}
            suffix="%"
            onChange={(v) => onUpdate({ intensity: v / 100 })}
          />
          <ParamSlider
            label="Radius"
            value={(effect.params.radius as number) || 3}
            min={1}
            max={8}
            onChange={(v) => onUpdate({ radius: v })}
          />
        </>
      );

    case "displacement":
      return (
        <>
          <ParamSlider
            label="Scale"
            value={(effect.params.scale as number) || 20}
            min={5}
            max={50}
            onChange={(v) => onUpdate({ scale: v })}
          />
          <ParamCheckbox
            label="Animated"
            checked={(effect.params.animated as boolean) ?? true}
            onChange={(v) => onUpdate({ animated: v })}
          />
        </>
      );

    case "wave-distortion":
      return (
        <>
          <ParamSlider
            label="Amplitude"
            value={(effect.params.amplitude as number) || 10}
            min={0}
            max={50}
            suffix="px"
            onChange={(v) => onUpdate({ amplitude: v })}
          />
          <ParamSlider
            label="Frequency"
            value={((effect.params.frequency as number) || 0.1) * 100}
            min={1}
            max={50}
            onChange={(v) => onUpdate({ frequency: v / 100 })}
          />
          <ParamSelect
            label="Direction"
            value={(effect.params.direction as string) || "horizontal"}
            options={[
              ["horizontal", "Horizontal"],
              ["vertical", "Vertical"],
            ]}
            onChange={(v) => onUpdate({ direction: v })}
          />
          <ParamCheckbox
            label="Animated"
            checked={(effect.params.animated as boolean) ?? true}
            onChange={(v) => onUpdate({ animated: v })}
          />
        </>
      );

    case "twirl":
      return (
        <>
          <ParamSlider
            label="Angle"
            value={(effect.params.angle as number) || 0.5}
            min={0}
            max={3}
            step={0.1}
            onChange={(v) => onUpdate({ angle: v })}
          />
          <ParamSlider
            label="Radius"
            value={((effect.params.radius as number) || 0.5) * 100}
            min={10}
            max={100}
            suffix="%"
            onChange={(v) => onUpdate({ radius: v / 100 })}
          />
        </>
      );

    case "ripple":
      return (
        <>
          <ParamSlider
            label="Amplitude"
            value={(effect.params.amplitude as number) || 20}
            min={0}
            max={50}
            suffix="px"
            onChange={(v) => onUpdate({ amplitude: v })}
          />
          <ParamSlider
            label="Frequency"
            value={((effect.params.frequency as number) || 0.05) * 1000}
            min={10}
            max={200}
            onChange={(v) => onUpdate({ frequency: v / 1000 })}
          />
          <ParamSlider
            label="Center X"
            value={((effect.params.centerX as number) || 0.5) * 100}
            min={0}
            max={100}
            suffix="%"
            onChange={(v) => onUpdate({ centerX: v / 100 })}
          />
          <ParamSlider
            label="Center Y"
            value={((effect.params.centerY as number) || 0.5) * 100}
            min={0}
            max={100}
            suffix="%"
            onChange={(v) => onUpdate({ centerY: v / 100 })}
          />
        </>
      );

    case "vhs":
      return (
        <ParamSlider
          label="Intensity"
          value={(effect.params.intensity as number) || 50}
          min={0}
          max={100}
          onChange={(v) => onUpdate({ intensity: v })}
        />
      );

    case "crt":
      return (
        <>
          <ParamSlider
            label="Curvature"
            value={((effect.params.curvature as number) || 0.2) * 100}
            min={0}
            max={50}
            suffix="%"
            onChange={(v) => onUpdate({ curvature: v / 100 })}
          />
          <ParamSlider
            label="Scanlines"
            value={((effect.params.scanlines as number) || 0.3) * 100}
            min={0}
            max={100}
            suffix="%"
            onChange={(v) => onUpdate({ scanlines: v / 100 })}
          />
        </>
      );

    case "posterize":
      return (
        <ParamSlider
          label="Levels"
          value={(effect.params.levels as number) || 8}
          min={2}
          max={32}
          onChange={(v) => onUpdate({ levels: v })}
        />
      );

    case "solarize":
      return (
        <ParamSlider
          label="Threshold"
          value={(effect.params.threshold as number) || 128}
          min={0}
          max={255}
          onChange={(v) => onUpdate({ threshold: v })}
        />
      );

    case "duotone":
      return (
        <>
          <ParamColor
            label="Color 1"
            value={(effect.params.color1 as string) || "#000000"}
            onChange={(v) => onUpdate({ color1: v })}
          />
          <ParamColor
            label="Color 2"
            value={(effect.params.color2 as string) || "#00ff88"}
            onChange={(v) => onUpdate({ color2: v })}
          />
        </>
      );

    case "color-shift":
      return (
        <ParamSlider
          label="Speed"
          value={(effect.params.speed as number) || 1}
          min={0}
          max={10}
          step={0.1}
          onChange={(v) => onUpdate({ speed: v })}
        />
      );

    case "channel-swap":
      return (
        <ParamSelect
          label="Swap"
          value={(effect.params.swap as string) || "rg"}
          options={[
            ["rg", "R ↔ G"],
            ["rb", "R ↔ B"],
            ["gb", "G ↔ B"],
            ["rgb", "R → G → B"],
          ]}
          onChange={(v) => onUpdate({ swap: v })}
        />
      );

    case "noise":
      return (
        <>
          <ParamSlider
            label="Intensity"
            value={(effect.params.intensity as number) || 20}
            min={0}
            max={100}
            onChange={(v) => onUpdate({ intensity: v })}
          />
          <ParamCheckbox
            label="Colored"
            checked={(effect.params.colored as boolean) || false}
            onChange={(v) => onUpdate({ colored: v })}
          />
        </>
      );

    case "pixelate":
    case "emoji":
    case "ascii":
    case "matrix":
      const density = (effect.params.density as number) || 64;
      return (
        <>
          <ParamSlider
            label="Density"
            value={density}
            min={effect.type === "emoji" ? 16 : 20}
            max={200}
            onChange={(v) => onUpdate({ density: v })}
          />
          {effect.type === "emoji" && (
            <ParamSelect
              label="Palette"
              value={(effect.params.palette as string) || "full"}
              options={Object.entries(PALETTES).map(([k, v]) => [k, v.name])}
              onChange={(v) => onUpdate({ palette: v })}
            />
          )}
          {effect.type === "ascii" && (
            <ParamCheckbox
              label="Colored"
              checked={(effect.params.colored as boolean) ?? true}
              onChange={(v) => onUpdate({ colored: v })}
            />
          )}
        </>
      );

    case "halftone":
      return (
        <>
          <ParamSlider
            label="Density"
            value={(effect.params.density as number) || 48}
            min={16}
            max={128}
            onChange={(v) => onUpdate({ density: v })}
          />
          <ParamSlider
            label="Dot Scale"
            value={((effect.params.dotScale as number) || 1.0) * 100}
            min={50}
            max={150}
            suffix="%"
            onChange={(v) => onUpdate({ dotScale: v / 100 })}
          />
        </>
      );

    case "3d-mesh":
      return (
        <>
          <ParamSlider
            label="Displacement"
            value={(effect.params.displacementScale as number) || 3}
            min={0}
            max={10}
            step={0.5}
            onChange={(v) => onUpdate({ displacementScale: v })}
          />
          <ParamCheckbox
            label="Wireframe"
            checked={(effect.params.wireframe as boolean) ?? true}
            onChange={(v) => onUpdate({ wireframe: v })}
          />
        </>
      );

    default:
      return null;
  }
}

function ParamSlider({
  label,
  value,
  min,
  max,
  step,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onChange: (value: number) => void;
}) {
  return (
    <div className={styles.paramRow}>
      <label>
        <span>{label}</span>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
        />
        <span className={styles.paramValue}>
          {Math.round(value * 10) / 10}
          {suffix || ""}
        </span>
      </label>
    </div>
  );
}

function ParamSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: [string, string][];
  onChange: (value: string) => void;
}) {
  return (
    <div className={styles.paramRow}>
      <label>
        <span>{label}</span>
        <select value={value} onChange={(e) => onChange(e.target.value)}>
          {options.map(([val, lbl]) => (
            <option key={val} value={val}>
              {lbl}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

function ParamCheckbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className={styles.paramRow}>
      <label className={styles.checkboxRow}>
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span>{label}</span>
      </label>
    </div>
  );
}

function ParamColor({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className={styles.paramRow}>
      <label>
        <span>{label}</span>
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </label>
    </div>
  );
}

function useMediaSourceControls(
  effect: Effect,
  onUpdate: (params: Record<string, unknown>) => void,
  canvasRef?: React.RefObject<HTMLCanvasElement | null>
) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaSources = (effect.params.mediaSources as ImageData[]) || [];
  const [thumbnailCache, setThumbnailCache] = useState<Map<number, string>>(
    new Map()
  );

  const addMediaSource = (imageData: ImageData) => {
    const updated = [...mediaSources, imageData];
    onUpdate({ ...effect.params, mediaSources: updated });
  };

  const removeMediaSource = (index: number) => {
    const updated = mediaSources.filter((_, i) => i !== index);
    setThumbnailCache((prev) => {
      const newCache = new Map();
      prev.forEach((v, k) => {
        if (k < index) newCache.set(k, v);
        else if (k > index) newCache.set(k - 1, v);
      });
      return newCache;
    });

    // Also reset active source if it was removed
    const currentActive = effect.params.activeSource as number;
    if (currentActive === index) {
      onUpdate({
        ...effect.params,
        mediaSources: updated,
        activeSource: -1,
        lastUpdate: Date.now(),
      });
    } else if (currentActive > index) {
      onUpdate({
        ...effect.params,
        mediaSources: updated,
        activeSource: currentActive - 1,
      });
    } else {
      onUpdate({ ...effect.params, mediaSources: updated });
    }
  };

  const handleCapture = () => {
    if (!canvasRef?.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    addMediaSource(imageData);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isVideo = file.type.startsWith("video/");
    const isImage = file.type.startsWith("image/");
    if (!isVideo && !isImage) return;

    const url = URL.createObjectURL(file);

    if (isImage) {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        addMediaSource(imageData);
        URL.revokeObjectURL(url);
        if (fileInputRef.current) fileInputRef.current.value = "";
      };
      img.src = url;
    } else {
      const video = document.createElement("video");
      video.muted = true;
      video.onloadeddata = () => {
        video.currentTime = 0;
      };
      video.onseeked = () => {
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(video, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        addMediaSource(imageData);

        const midFrame = video.duration / 2;
        if (midFrame > 0.1) {
          video.currentTime = midFrame;
          video.onseeked = () => {
            ctx.drawImage(video, 0, 0);
            const midImageData = ctx.getImageData(
              0,
              0,
              canvas.width,
              canvas.height
            );
            addMediaSource(midImageData);
            URL.revokeObjectURL(url);
            if (fileInputRef.current) fileInputRef.current.value = "";
          };
        } else {
          URL.revokeObjectURL(url);
          if (fileInputRef.current) fileInputRef.current.value = "";
        }
      };
      video.src = url;
      video.load();
    }
  };

  const getThumbnail = (imageData: ImageData, index: number): string => {
    if (thumbnailCache.has(index)) {
      return thumbnailCache.get(index)!;
    }

    const canvas = document.createElement("canvas");
    const targetSize = 50;
    const aspect = imageData.width / imageData.height;
    canvas.width = aspect >= 1 ? targetSize : Math.round(targetSize * aspect);
    canvas.height = aspect >= 1 ? Math.round(targetSize / aspect) : targetSize;
    const ctx = canvas.getContext("2d");
    if (!ctx) return "";

    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = imageData.width;
    tempCanvas.height = imageData.height;
    const tempCtx = tempCanvas.getContext("2d");
    if (tempCtx) {
      tempCtx.putImageData(imageData, 0, 0);
      ctx.drawImage(tempCanvas, 0, 0, canvas.width, canvas.height);
    }

    const dataUrl = canvas.toDataURL("image/jpeg", 0.6);
    setThumbnailCache((prev) => new Map(prev).set(index, dataUrl));
    return dataUrl;
  };

  const handleClear = () => {
    setThumbnailCache(new Map());
    onUpdate({
      ...effect.params,
      mediaSources: [],
      activeSource: -1,
      lastUpdate: Date.now(),
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return {
    fileInputRef,
    mediaSources,
    handleCapture,
    handleFileUpload,
    getThumbnail,
    handleClear,
    removeMediaSource,
  };
}

const mediaButtonStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "4px",
  padding: "5px 8px",
  background: "#2a2a2b",
  border: "1px solid #3a3a3b",
  color: "#e0e0e0",
  fontSize: "10px",
  borderRadius: "3px",
  cursor: "pointer",
  flexShrink: 0,
};

function MotionSmearParams({ effect, onUpdate, canvasRef }: EffectParamsProps) {
  const {
    fileInputRef,
    mediaSources,
    handleCapture,
    handleFileUpload,
    getThumbnail,
    handleClear,
    removeMediaSource,
  } = useMediaSourceControls(effect, onUpdate, canvasRef);

  const currentMode = (effect.params.mode as string) || "melt";

  return (
    <div style={{ overflow: "hidden" }}>
      <div
        style={{
          fontSize: "11px",
          color: "#888",
          marginBottom: "8px",
          lineHeight: "1.4",
        }}
      >
        {currentMode === "melt"
          ? "Melt: Motion smears pixels creating trails. Move to see the effect."
          : "Bloom: Motion displaces pixels from your source image."}
      </div>
      <ParamSelect
        label="Mode"
        value={currentMode}
        options={[
          ["melt", "Melt"],
          ["bloom", "Bloom"],
        ]}
        onChange={(v) => onUpdate({ ...effect.params, mode: v })}
      />
      <ParamSlider
        label="Intensity"
        value={(effect.params.intensity as number) ?? 70}
        min={0}
        max={100}
        onChange={(v) => onUpdate({ ...effect.params, intensity: v })}
      />
      <ParamSlider
        label="Momentum"
        value={((effect.params.momentum as number) ?? 0.92) * 100}
        min={50}
        max={99}
        suffix="%"
        onChange={(v) => onUpdate({ ...effect.params, momentum: v / 100 })}
      />

      <div
        style={{
          marginTop: "12px",
          paddingTop: "12px",
          borderTop: "1px solid #2a2a2b",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            fontSize: "11px",
            fontWeight: 600,
            marginBottom: "6px",
            color: "#e0e0e0",
            display: "flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          <span>Source Image</span>
          {currentMode === "bloom" && mediaSources.length === 0 && (
            <span
              style={{ color: "#ff6b6b", fontSize: "10px", fontWeight: 500 }}
            >
              (required for bloom)
            </span>
          )}
          {mediaSources.length >= 1 && (
            <span
              style={{ color: "#00ff88", fontSize: "10px", fontWeight: 500 }}
            >
              ({mediaSources.length})
            </span>
          )}
        </div>
        {currentMode === "melt" && mediaSources.length === 0 && (
          <div style={{ fontSize: "10px", color: "#666", marginBottom: "6px" }}>
            Optional: Add an image for bloom mode
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          style={{ display: "none" }}
          onChange={handleFileUpload}
        />

        <div
          style={{
            display: "flex",
            gap: "4px",
            marginBottom: "8px",
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            onClick={handleCapture}
            style={mediaButtonStyle}
          >
            <Camera size={11} /> Capture
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            style={mediaButtonStyle}
          >
            <Upload size={11} /> Upload
          </button>
          {mediaSources.length > 0 && (
            <button
              type="button"
              onClick={handleClear}
              style={mediaButtonStyle}
            >
              <Trash2 size={11} /> Clear
            </button>
          )}
        </div>

        {mediaSources.length > 0 && (
          <div
            style={{
              display: "flex",
              gap: "4px",
              flexWrap: "wrap",
              maxWidth: "100%",
            }}
          >
            {mediaSources.map((source, index) => (
              <div
                key={index}
                style={{
                  position: "relative",
                  width: "50px",
                  height: "50px",
                  flexShrink: 0,
                  background: "#0a0a0b",
                  border: "1px solid #2a2a2b",
                  borderRadius: "2px",
                  overflow: "hidden",
                }}
              >
                <img
                  src={getThumbnail(source, index)}
                  alt={`Source ${index + 1}`}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
                <div
                  style={{
                    position: "absolute",
                    bottom: "1px",
                    left: "1px",
                    background: "rgba(0, 0, 0, 0.8)",
                    color: "#00ff88",
                    fontSize: "9px",
                    fontWeight: 600,
                    padding: "0 3px",
                    borderRadius: "1px",
                  }}
                >
                  {index + 1}
                </div>
                <button
                  type="button"
                  onClick={() => removeMediaSource(index)}
                  style={{
                    position: "absolute",
                    top: "1px",
                    right: "1px",
                    padding: "1px",
                    background: "rgba(255, 50, 50, 0.9)",
                    border: "none",
                    color: "white",
                    borderRadius: "1px",
                    cursor: "pointer",
                    lineHeight: 0,
                  }}
                >
                  <X size={9} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function BlockShovingParams({
  effect,
  onUpdate,
  canvasRef,
}: EffectParamsProps) {
  const {
    fileInputRef,
    mediaSources,
    handleCapture,
    handleFileUpload,
    getThumbnail,
    handleClear,
    removeMediaSource,
  } = useMediaSourceControls(effect, onUpdate, canvasRef);

  const activeSource = (effect.params.activeSource as number) ?? -1;
  const isLive = activeSource === -1;
  const currentStyle = (effect.params.style as string) || "block";

  const setActiveSource = (index: number) => {
    onUpdate({ ...effect.params, activeSource: index, lastUpdate: Date.now() });
  };

  return (
    <div style={{ overflow: "hidden" }}>
      <ParamSelect
        label="Style"
        value={currentStyle}
        options={[
          ["block", "Blocky"],
          ["fluid", "Fluid"],
        ]}
        onChange={(v) => onUpdate({ style: v })}
      />
      <ParamSlider
        label="Intensity"
        value={(effect.params.intensity as number) || 50}
        min={0}
        max={100}
        onChange={(v) => onUpdate({ intensity: v })}
      />
      <ParamSlider
        label="Block Size"
        value={(effect.params.blockSize as number) || 16}
        min={4}
        max={64}
        suffix="px"
        onChange={(v) => onUpdate({ blockSize: v })}
      />

      <div
        style={{
          marginTop: "12px",
          paddingTop: "12px",
          borderTop: "1px solid #2a2a2b",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            fontSize: "11px",
            fontWeight: 600,
            marginBottom: "6px",
            color: "#e0e0e0",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span>Mosh Sources</span>
          {mediaSources.length > 0 && (
            <span style={{ fontSize: "10px", color: "#666" }}>
              Click to inject
            </span>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          style={{ display: "none" }}
          onChange={handleFileUpload}
        />

        <div
          style={{
            display: "flex",
            gap: "4px",
            marginBottom: "8px",
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            onClick={handleCapture}
            style={mediaButtonStyle}
          >
            <Camera size={11} /> Capture
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            style={mediaButtonStyle}
          >
            <Upload size={11} /> Upload
          </button>
          <button
            type="button"
            onClick={handleClear}
            style={{
              ...mediaButtonStyle,
              opacity: mediaSources.length ? 1 : 0.5,
            }}
            disabled={!mediaSources.length}
          >
            <Trash2 size={11} /> Clear
          </button>
        </div>

        <div
          style={{
            display: "flex",
            gap: "4px",
            flexWrap: "wrap",
            maxWidth: "100%",
          }}
        >
          <button
            type="button"
            onClick={() => setActiveSource(-1)}
            style={{
              position: "relative",
              width: "50px",
              height: "50px",
              flexShrink: 0,
              background: isLive ? "#00ff88" : "#0a0a0b",
              border: isLive ? "2px solid #00ff88" : "1px solid #2a2a2b",
              borderRadius: "2px",
              overflow: "hidden",
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              color: isLive ? "#000" : "#888",
            }}
            title="Inject Live Feed"
          >
            <RefreshCcw size={16} />
            <span
              style={{
                fontSize: "9px",
                fontWeight: 600,
                marginTop: "2px",
              }}
            >
              LIVE
            </span>
          </button>

          {mediaSources.map((source, index) => {
            const isActive = activeSource === index;
            return (
              <div
                key={index}
                onClick={() => setActiveSource(index)}
                style={{
                  position: "relative",
                  width: "50px",
                  height: "50px",
                  flexShrink: 0,
                  background: "#0a0a0b",
                  border: isActive ? "2px solid #00ff88" : "1px solid #2a2a2b",
                  borderRadius: "2px",
                  overflow: "hidden",
                  cursor: "pointer",
                }}
                title={`Inject Source ${index + 1}`}
              >
                <img
                  src={getThumbnail(source, index)}
                  alt={`Source ${index + 1}`}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    opacity: isActive ? 0.8 : 1,
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    bottom: "1px",
                    left: "1px",
                    background: "rgba(0, 0, 0, 0.8)",
                    color: "#00ff88",
                    fontSize: "9px",
                    fontWeight: 600,
                    padding: "0 3px",
                    borderRadius: "1px",
                  }}
                >
                  {index + 1}
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeMediaSource(index);
                  }}
                  style={{
                    position: "absolute",
                    top: "1px",
                    right: "1px",
                    padding: "1px",
                    background: "rgba(255, 50, 50, 0.9)",
                    border: "none",
                    color: "white",
                    borderRadius: "1px",
                    cursor: "pointer",
                    lineHeight: 0,
                  }}
                >
                  <X size={9} />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function DatamoshParams({ effect, onUpdate, canvasRef }: EffectParamsProps) {
  const {
    fileInputRef,
    mediaSources,
    handleCapture,
    handleFileUpload,
    getThumbnail,
    handleClear,
    removeMediaSource,
  } = useMediaSourceControls(effect, onUpdate, canvasRef);

  const activeSource = (effect.params.activeSource as number) ?? -1;
  const isLive = activeSource === -1;

  const setActiveSource = (index: number) => {
    onUpdate({ ...effect.params, activeSource: index, lastUpdate: Date.now() });
  };

  return (
    <div style={{ overflow: "hidden" }}>
      <ParamSlider
        label="Intensity"
        value={(effect.params.intensity as number) || 50}
        min={0}
        max={100}
        onChange={(v) => onUpdate({ intensity: v })}
      />

      <div
        style={{
          marginTop: "12px",
          paddingTop: "12px",
          borderTop: "1px solid #2a2a2b",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            fontSize: "11px",
            fontWeight: 600,
            marginBottom: "6px",
            color: "#e0e0e0",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span>Mosh Sources</span>
          {mediaSources.length > 0 && (
            <span style={{ fontSize: "10px", color: "#666" }}>
              Click to inject
            </span>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          style={{ display: "none" }}
          onChange={handleFileUpload}
        />

        <div
          style={{
            display: "flex",
            gap: "4px",
            marginBottom: "8px",
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            onClick={handleCapture}
            style={mediaButtonStyle}
          >
            <Camera size={11} /> Capture
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            style={mediaButtonStyle}
          >
            <Upload size={11} /> Upload
          </button>
          <button
            type="button"
            onClick={handleClear}
            style={{
              ...mediaButtonStyle,
              opacity: mediaSources.length ? 1 : 0.5,
            }}
            disabled={!mediaSources.length}
          >
            <Trash2 size={11} /> Clear
          </button>
        </div>

        <div
          style={{
            display: "flex",
            gap: "4px",
            flexWrap: "wrap",
            maxWidth: "100%",
          }}
        >
          <button
            type="button"
            onClick={() => setActiveSource(-1)}
            style={{
              position: "relative",
              width: "50px",
              height: "50px",
              flexShrink: 0,
              background: isLive ? "#00ff88" : "#0a0a0b",
              border: isLive ? "2px solid #00ff88" : "1px solid #2a2a2b",
              borderRadius: "2px",
              overflow: "hidden",
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              color: isLive ? "#000" : "#888",
            }}
            title="Inject Live Feed"
          >
            <RefreshCcw size={16} />
            <span
              style={{
                fontSize: "9px",
                fontWeight: 600,
                marginTop: "2px",
              }}
            >
              LIVE
            </span>
          </button>

          {mediaSources.map((source, index) => {
            const isActive = activeSource === index;
            return (
              <div
                key={index}
                onClick={() => setActiveSource(index)}
                style={{
                  position: "relative",
                  width: "50px",
                  height: "50px",
                  flexShrink: 0,
                  background: "#0a0a0b",
                  border: isActive ? "2px solid #00ff88" : "1px solid #2a2a2b",
                  borderRadius: "2px",
                  overflow: "hidden",
                  cursor: "pointer",
                }}
                title={`Inject Source ${index + 1}`}
              >
                <img
                  src={getThumbnail(source, index)}
                  alt={`Source ${index + 1}`}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    opacity: isActive ? 0.8 : 1,
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    bottom: "1px",
                    left: "1px",
                    background: "rgba(0, 0, 0, 0.8)",
                    color: "#00ff88",
                    fontSize: "9px",
                    fontWeight: 600,
                    padding: "0 3px",
                    borderRadius: "1px",
                  }}
                >
                  {index + 1}
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeMediaSource(index);
                  }}
                  style={{
                    position: "absolute",
                    top: "1px",
                    right: "1px",
                    padding: "1px",
                    background: "rgba(255, 50, 50, 0.9)",
                    border: "none",
                    color: "white",
                    borderRadius: "1px",
                    cursor: "pointer",
                    lineHeight: 0,
                  }}
                >
                  <X size={9} />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
