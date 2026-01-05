export type EffectType =
  | "invert"
  | "glitch"
  | "motion-smear"
  | "block-corrupt"
  | "pixel-sort"
  | "rgb-channel-separation"
  | "dither"
  | "chromatic-aberration"
  | "vignette"
  | "film-grain"
  | "scanlines"
  | "edge-detect"
  | "thermal"
  | "mirror"
  | "bloom"
  | "displacement"
  | "wave-distortion"
  | "twirl"
  | "ripple"
  | "vhs"
  | "crt"
  | "posterize"
  | "solarize"
  | "duotone"
  | "color-shift"
  | "channel-swap"
  | "noise"
  | "pixelate"
  | "emoji"
  | "ascii"
  | "matrix"
  | "halftone"
  | "block-shoving"
  | "datamosh"
  | "3d-mesh";

export interface Effect {
  id: string;
  type: EffectType;
  active: boolean;
  params: Record<string, unknown>;
}

export function getDefaultParams(type: EffectType): Record<string, unknown> {
  switch (type) {
    case "invert":
      return {};
    case "glitch":
      return { intensity: 50, speed: 10 };
    case "motion-smear":
      return { mode: "melt", intensity: 70, momentum: 0.92, mediaSources: [] };
    case "block-corrupt":
      return { intensity: 30, blockSize: 16 };
    case "pixel-sort":
      return { threshold: 50, direction: "horizontal" };
    case "rgb-channel-separation":
      return { rOffset: 5, gOffset: 0, bOffset: -5 };
    case "dither":
      return { depth: 4 };
    case "chromatic-aberration":
      return { offset: 5 };
    case "vignette":
      return { intensity: 0.5, radius: 0.8 };
    case "film-grain":
      return { intensity: 30 };
    case "scanlines":
      return { spacing: 3, opacity: 0.4 };
    case "edge-detect":
      return { threshold: 50, invert: false };
    case "thermal":
      return { palette: "thermal" };
    case "mirror":
      return { mode: "horizontal" };
    case "bloom":
      return { threshold: 200, intensity: 0.5, radius: 3 };
    case "displacement":
      return { scale: 20, animated: true };
    case "wave-distortion":
      return {
        amplitude: 10,
        frequency: 0.1,
        direction: "horizontal",
        animated: true,
      };
    case "twirl":
      return { angle: 0.5, radius: 0.5 };
    case "ripple":
      return { amplitude: 20, frequency: 0.05, centerX: 0.5, centerY: 0.5 };
    case "vhs":
      return { intensity: 50 };
    case "crt":
      return { curvature: 0.2, scanlines: 0.3 };
    case "posterize":
      return { levels: 8 };
    case "solarize":
      return { threshold: 128 };
    case "duotone":
      return { color1: "#000000", color2: "#00ff88" };
    case "color-shift":
      return { speed: 1 };
    case "channel-swap":
      return { swap: "rg" };
    case "noise":
      return { intensity: 20, colored: false };
    case "pixelate":
      return { density: 64 };
    case "emoji":
      return { density: 48, palette: "full" };
    case "ascii":
      return { density: 80, colored: true };
    case "matrix":
      return { density: 64 };
    case "halftone":
      return { density: 48, dotScale: 1.0 };
    case "block-shoving":
      return {
        style: "block",
        intensity: 50,
        blockSize: 16,
        mediaSources: [],
        lastUpdate: 0,
        activeSource: -1,
      };
    case "datamosh":
      return {
        intensity: 50,
        mediaSources: [],
        lastUpdate: 0,
        activeSource: -1,
      };
    case "3d-mesh":
      return { displacementScale: 3, wireframe: true };
    default:
      return {};
  }
}
