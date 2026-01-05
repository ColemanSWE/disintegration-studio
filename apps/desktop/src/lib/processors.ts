import { registerEffect, ProcessConfig } from "./effect-registry";

const BAYER_MATRIX_4x4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

registerEffect({
  type: "invert",
  label: "Invert",
  category: "color",
  processor: (data) => {
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 255 - data[i];
      data[i + 1] = 255 - data[i + 1];
      data[i + 2] = 255 - data[i + 2];
    }
  },
});

registerEffect({
  type: "glitch",
  label: "Digital Glitch",
  category: "glitch",
  processor: (data, { width, height, time = 0 }, params) => {
    const intensity = (params.intensity as number) || 50;
    const speed = (params.speed as number) || 10;
    if (intensity === 0) return;

    const source = new Uint8ClampedArray(data);
    const t = time * (speed / 10);
    const seed = Math.floor(t / 5);

    const numSlices = Math.floor(3 + intensity / 20);
    for (let s = 0; s < numSlices; s++) {
      const sliceY = Math.floor(pseudoRandom(seed + s * 1000) * height);
      const sliceHeight = Math.floor(
        2 + pseudoRandom(seed + s * 2000) * (intensity / 3)
      );
      const shiftX = Math.floor(
        (pseudoRandom(seed + s * 3000) - 0.5) * (intensity * 2)
      );
      const channelShift = Math.floor(pseudoRandom(seed + s * 4000) * 3);

      for (let y = sliceY; y < Math.min(sliceY + sliceHeight, height); y++) {
        for (let x = 0; x < width; x++) {
          const srcX = (((x - shiftX) % width) + width) % width;
          const srcIdx = (y * width + srcX) * 4;
          const dstIdx = (y * width + x) * 4;

          if (channelShift === 0) {
            data[dstIdx] = source[srcIdx];
            data[dstIdx + 1] = source[(y * width + x) * 4 + 1];
            data[dstIdx + 2] = source[(y * width + x) * 4 + 2];
          } else if (channelShift === 1) {
            data[dstIdx] = source[(y * width + x) * 4];
            data[dstIdx + 1] = source[srcIdx + 1];
            data[dstIdx + 2] = source[(y * width + x) * 4 + 2];
          } else {
            data[dstIdx] = source[(y * width + x) * 4];
            data[dstIdx + 1] = source[(y * width + x) * 4 + 1];
            data[dstIdx + 2] = source[srcIdx + 2];
          }
        }
      }
    }

    if (intensity > 30) {
      const corruptLines = Math.floor(intensity / 20);
      for (let c = 0; c < corruptLines; c++) {
        const y = Math.floor(pseudoRandom(seed + c * 5000 + t) * height);
        const corruptType = Math.floor(pseudoRandom(seed + c * 6000) * 3);

        for (let x = 0; x < width; x++) {
          const i = (y * width + x) * 4;
          if (corruptType === 0) {
            data[i] =
              data[i + 1] =
              data[i + 2] =
                pseudoRandom(seed + x) > 0.5 ? 255 : 0;
          } else if (corruptType === 1) {
            const repeat =
              data[(y * width + Math.floor(x / 8) * 8) * 4 + (x % 3)];
            data[i] = data[i + 1] = data[i + 2] = repeat;
          } else {
            data[i + Math.floor(pseudoRandom(seed + x) * 3)] = 255;
          }
        }
      }
    }
  },
});

const motionSmearState: {
  prevFrame: Uint8ClampedArray | null;
  meltBuffer: Uint8ClampedArray | null;
  mvX: Float32Array | null;
  mvY: Float32Array | null;
  width: number;
  height: number;
} = {
  prevFrame: null,
  meltBuffer: null,
  mvX: null,
  mvY: null,
  width: 0,
  height: 0,
};

registerEffect({
  type: "motion-smear",
  label: "Motion Smear",
  category: "glitch",
  processor: (data, { width, height, time = 0, timelineFrames }, params) => {
    const mode = (params.mode as string) || "melt";
    const intensity = (params.intensity as number) ?? 70;
    const momentum = (params.momentum as number) ?? 0.92;
    if (intensity === 0) return;

    const strength = intensity / 100;
    const blockSize = 16;
    const blocksX = Math.ceil(width / blockSize);
    const blocksY = Math.ceil(height / blockSize);
    const totalBlocks = blocksX * blocksY;

    const needsInit =
      motionSmearState.width !== width ||
      motionSmearState.height !== height ||
      !motionSmearState.prevFrame;

    if (needsInit) {
      motionSmearState.prevFrame = new Uint8ClampedArray(data);
      motionSmearState.meltBuffer = new Uint8ClampedArray(data);
      motionSmearState.mvX = new Float32Array(totalBlocks);
      motionSmearState.mvY = new Float32Array(totalBlocks);
      motionSmearState.width = width;
      motionSmearState.height = height;
      return;
    }

    const prev = motionSmearState.prevFrame!;
    const melt = motionSmearState.meltBuffer!;
    const mvX = motionSmearState.mvX!;
    const mvY = motionSmearState.mvY!;

    for (let by = 0; by < blocksY; by++) {
      for (let bx = 0; bx < blocksX; bx++) {
        const bi = by * blocksX + bx;
        const startX = bx * blockSize;
        const startY = by * blockSize;
        const endX = Math.min(startX + blockSize, width);
        const endY = Math.min(startY + blockSize, height);

        let bestDx = 0,
          bestDy = 0,
          bestScore = Infinity;
        const search = 16;

        for (let dy = -search; dy <= search; dy += 4) {
          for (let dx = -search; dx <= search; dx += 4) {
            let score = 0;
            let samples = 0;
            for (let py = startY; py < endY; py += 4) {
              for (let px = startX; px < endX; px += 4) {
                const sx = px + dx;
                const sy = py + dy;
                if (sx < 0 || sx >= width || sy < 0 || sy >= height) continue;
                const ci = (py * width + px) * 4;
                const si = (sy * width + sx) * 4;
                score +=
                  Math.abs(data[ci] - prev[si]) +
                  Math.abs(data[ci + 1] - prev[si + 1]) +
                  Math.abs(data[ci + 2] - prev[si + 2]);
                samples++;
              }
            }
            if (samples > 0) score /= samples;
            if (score < bestScore) {
              bestScore = score;
              bestDx = dx;
              bestDy = dy;
            }
          }
        }

        mvX[bi] = mvX[bi] * momentum + bestDx * (1 - momentum);
        mvY[bi] = mvY[bi] * momentum + bestDy * (1 - momentum);
      }
    }

    const sourceImg =
      timelineFrames && timelineFrames.length > 0 ? timelineFrames[0] : null;
    const output = new Uint8ClampedArray(data.length);

    if (mode === "bloom" && sourceImg) {
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const i = (y * width + x) * 4;
          const bx = Math.floor(x / blockSize);
          const by = Math.floor(y / blockSize);
          const bi = Math.min(by * blocksX + bx, totalBlocks - 1);

          const dx = mvX[bi] * strength * 3;
          const dy = mvY[bi] * strength * 3;

          const srcX = Math.max(
            0,
            Math.min(
              sourceImg.width - 1,
              Math.floor((x / width) * sourceImg.width + dx)
            )
          );
          const srcY = Math.max(
            0,
            Math.min(
              sourceImg.height - 1,
              Math.floor((y / height) * sourceImg.height + dy)
            )
          );
          const srcI = (srcY * sourceImg.width + srcX) * 4;

          output[i] = sourceImg.data[srcI];
          output[i + 1] = sourceImg.data[srcI + 1];
          output[i + 2] = sourceImg.data[srcI + 2];
          output[i + 3] = 255;
        }
      }
    } else {
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const i = (y * width + x) * 4;
          const bx = Math.floor(x / blockSize);
          const by = Math.floor(y / blockSize);
          const bi = Math.min(by * blocksX + bx, totalBlocks - 1);

          const dx = mvX[bi] * strength * 2;
          const dy = mvY[bi] * strength * 2;

          const srcX = Math.max(0, Math.min(width - 1, Math.round(x + dx)));
          const srcY = Math.max(0, Math.min(height - 1, Math.round(y + dy)));
          const srcI = (srcY * width + srcX) * 4;

          output[i] = melt[srcI];
          output[i + 1] = melt[srcI + 1];
          output[i + 2] = melt[srcI + 2];
          output[i + 3] = 255;
        }
      }

      const blendBack = 1 - (momentum * 0.5 + 0.4);
      for (let i = 0; i < data.length; i += 4) {
        melt[i] = output[i] * (1 - blendBack) + data[i] * blendBack;
        melt[i + 1] = output[i + 1] * (1 - blendBack) + data[i + 1] * blendBack;
        melt[i + 2] = output[i + 2] * (1 - blendBack) + data[i + 2] * blendBack;
      }
    }

    for (let i = 0; i < data.length; i++) {
      data[i] = output[i];
    }

    motionSmearState.prevFrame = new Uint8ClampedArray(data);
  },
});

const datamoshState: {
  prevInput: Uint8ClampedArray | null;
  moshBuffer: Uint8ClampedArray | null;
  width: number;
  height: number;
  lastUpdate: number;
  mvXBuffer: Float32Array | null;
  mvYBuffer: Float32Array | null;
} = {
  prevInput: null,
  moshBuffer: null,
  width: 0,
  height: 0,
  lastUpdate: 0,
  mvXBuffer: null,
  mvYBuffer: null,
};

const blockShovingState: {
  prevInput: Uint8ClampedArray | null;
  moshBuffer: Uint8ClampedArray | null;
  width: number;
  height: number;
  lastUpdate: number;
  mvXBuffer: Float32Array | null;
  mvYBuffer: Float32Array | null;
} = {
  prevInput: null,
  moshBuffer: null,
  width: 0,
  height: 0,
  lastUpdate: 0,
  mvXBuffer: null,
  mvYBuffer: null,
};

registerEffect({
  type: "block-shoving",
  label: "Block Shoving",
  category: "glitch",
  processor: (data, { width, height }, params) => {
    const style = (params.style as string) || "block";
    const intensity = (params.intensity as number) ?? 50;
    const blockSize = (params.blockSize as number) || 16;
    const activeSource = (params.activeSource as number) ?? -1;
    const lastUpdate = (params.lastUpdate as number) || 0;
    const mediaSources = (params.mediaSources as ImageData[]) || [];

    if (intensity === 0) return;

    const strength = intensity / 50;
    const blocksX = Math.ceil(width / blockSize);
    const blocksY = Math.ceil(height / blockSize);
    const totalBlocks = blocksX * blocksY;

    const needsInit =
      blockShovingState.width !== width ||
      blockShovingState.height !== height ||
      !blockShovingState.prevInput;

    const currentInput = new Uint8ClampedArray(data);

    if (needsInit) {
      blockShovingState.prevInput = currentInput;
      blockShovingState.moshBuffer = new Uint8ClampedArray(data);
      blockShovingState.width = width;
      blockShovingState.height = height;
      blockShovingState.lastUpdate = lastUpdate;
      blockShovingState.mvXBuffer = new Float32Array(totalBlocks);
      blockShovingState.mvYBuffer = new Float32Array(totalBlocks);
      return;
    }

    const prevInput = blockShovingState.prevInput!;
    const moshBuffer = blockShovingState.moshBuffer!;

    if (
      !blockShovingState.mvXBuffer ||
      blockShovingState.mvXBuffer.length !== totalBlocks
    ) {
      blockShovingState.mvXBuffer = new Float32Array(totalBlocks);
      blockShovingState.mvYBuffer = new Float32Array(totalBlocks);
    }
    const mvX = blockShovingState.mvXBuffer!;
    const mvY = blockShovingState.mvYBuffer!;

    if (lastUpdate > blockShovingState.lastUpdate) {
      blockShovingState.lastUpdate = lastUpdate;

      if (activeSource === -1) {
        for (let i = 0; i < data.length; i++) {
          moshBuffer[i] = currentInput[i];
        }
      } else if (mediaSources[activeSource]) {
        const source = mediaSources[activeSource];
        const srcData = source.data;
        const sw = source.width;
        const sh = source.height;

        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const sx = Math.floor(x * (sw / width));
            const sy = Math.floor(y * (sh / height));
            const si = (sy * sw + sx) * 4;
            const di = (y * width + x) * 4;

            moshBuffer[di] = srcData[si];
            moshBuffer[di + 1] = srcData[si + 1];
            moshBuffer[di + 2] = srcData[si + 2];
            moshBuffer[di + 3] = 255;
          }
        }
      }
    }

    for (let by = 0; by < blocksY; by++) {
      for (let bx = 0; bx < blocksX; bx++) {
        const bi = by * blocksX + bx;
        const startX = bx * blockSize;
        const startY = by * blockSize;
        const endX = Math.min(startX + blockSize, width);
        const endY = Math.min(startY + blockSize, height);

        let bestDx = 0,
          bestDy = 0,
          bestScore = Infinity;
        const search = 16;

        for (let dy = -search; dy <= search; dy += 8) {
          for (let dx = -search; dx <= search; dx += 8) {
            let score = 0;
            let samples = 0;
            for (let py = startY; py < endY; py += 8) {
              for (let px = startX; px < endX; px += 8) {
                const sx = px + dx;
                const sy = py + dy;
                if (sx < 0 || sx >= width || sy < 0 || sy >= height) continue;

                const ci = (py * width + px) * 4;
                const si = (sy * width + sx) * 4;

                const lumC =
                  currentInput[ci] +
                  currentInput[ci + 1] +
                  currentInput[ci + 2];
                const lumP =
                  prevInput[si] + prevInput[si + 1] + prevInput[si + 2];

                score += Math.abs(lumC - lumP);
                samples++;
              }
            }
            if (samples > 0) score /= samples;
            if (score < bestScore) {
              bestScore = score;
              bestDx = dx;
              bestDy = dy;
            }
          }
        }

        mvX[bi] = mvX[bi] * 0.5 + bestDx * 0.5;
        mvY[bi] = mvY[bi] * 0.5 + bestDy * 0.5;
      }
    }

    const tempBuffer = new Uint8ClampedArray(moshBuffer);

    if (style === "fluid") {
      const smoothMVX = new Float32Array(totalBlocks);
      const smoothMVY = new Float32Array(totalBlocks);

      for (let by = 0; by < blocksY; by++) {
        for (let bx = 0; bx < blocksX; bx++) {
          const bi = by * blocksX + bx;
          let sumX = 0,
            sumY = 0,
            count = 0;

          for (let ky = -1; ky <= 1; ky++) {
            for (let kx = -1; kx <= 1; kx++) {
              const ny = by + ky;
              const nx = bx + kx;
              if (ny >= 0 && ny < blocksY && nx >= 0 && nx < blocksX) {
                const ni = ny * blocksX + nx;
                sumX += mvX[ni];
                sumY += mvY[ni];
                count++;
              }
            }
          }
          smoothMVX[bi] = sumX / count;
          smoothMVY[bi] = sumY / count;
        }
      }

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const bx = Math.min(blocksX - 1, Math.floor(x / blockSize));
          const by = Math.min(blocksY - 1, Math.floor(y / blockSize));
          const bi = by * blocksX + bx;

          const dx = smoothMVX[bi] * strength;
          const dy = smoothMVY[bi] * strength;

          const srcX = x + dx;
          const srcY = y + dy;

          const r = bilinearSample(tempBuffer, width, height, srcX, srcY, 0);
          const g = bilinearSample(tempBuffer, width, height, srcX, srcY, 1);
          const b = bilinearSample(tempBuffer, width, height, srcX, srcY, 2);

          const di = (y * width + x) * 4;
          moshBuffer[di] = r;
          moshBuffer[di + 1] = g;
          moshBuffer[di + 2] = b;
          moshBuffer[di + 3] = 255;
        }
      }
    } else {
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const bx = Math.floor(x / blockSize);
          const by = Math.floor(y / blockSize);
          const bi = Math.min(by * blocksX + bx, totalBlocks - 1);

          const dx = mvX[bi] * strength;
          const dy = mvY[bi] * strength;

          const srcX = Math.max(0, Math.min(width - 1, Math.round(x + dx)));
          const srcY = Math.max(0, Math.min(height - 1, Math.round(y + dy)));

          const dstI = (y * width + x) * 4;
          const srcI = (srcY * width + srcX) * 4;

          moshBuffer[dstI] = tempBuffer[srcI];
          moshBuffer[dstI + 1] = tempBuffer[srcI + 1];
          moshBuffer[dstI + 2] = tempBuffer[srcI + 2];
        }
      }
    }

    for (let i = 0; i < data.length; i++) {
      data[i] = moshBuffer[i];
    }

    blockShovingState.prevInput = currentInput;
  },
});

registerEffect({
  type: "datamosh",
  label: "Datamosh",
  category: "glitch",
  processor: (data, { width, height }, params) => {
    const intensity = (params.intensity as number) ?? 50;
    const activeSource = (params.activeSource as number) ?? -1;
    const lastUpdate = (params.lastUpdate as number) || 0;
    const mediaSources = (params.mediaSources as ImageData[]) || [];

    if (intensity === 0) return;

    const needsInit =
      datamoshState.width !== width ||
      datamoshState.height !== height ||
      !datamoshState.prevInput;

    const currentInput = new Uint8ClampedArray(data);

    if (needsInit) {
      datamoshState.prevInput = currentInput;
      datamoshState.moshBuffer = new Uint8ClampedArray(data);
      datamoshState.width = width;
      datamoshState.height = height;
      datamoshState.lastUpdate = lastUpdate;
      datamoshState.mvXBuffer = null;
      datamoshState.mvYBuffer = null;
      return;
    }

    const prevInput = datamoshState.prevInput!;
    const moshBuffer = datamoshState.moshBuffer!;

    if (lastUpdate > datamoshState.lastUpdate) {
      datamoshState.lastUpdate = lastUpdate;

      if (activeSource === -1) {
        for (let i = 0; i < data.length; i++) {
          moshBuffer[i] = currentInput[i];
        }
      } else if (mediaSources[activeSource]) {
        const source = mediaSources[activeSource];
        const srcData = source.data;
        const sw = source.width;
        const sh = source.height;

        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const sx = Math.floor(x * (sw / width));
            const sy = Math.floor(y * (sh / height));
            const si = (sy * sw + sx) * 4;
            const di = (y * width + x) * 4;

            moshBuffer[di] = srcData[si];
            moshBuffer[di + 1] = srcData[si + 1];
            moshBuffer[di + 2] = srcData[si + 2];
            moshBuffer[di + 3] = 255;
          }
        }
      }
    }

    const factor = intensity / 100;

    for (let i = 0; i < data.length; i += 4) {
      const deltaR = currentInput[i] - prevInput[i];
      const deltaG = currentInput[i + 1] - prevInput[i + 1];
      const deltaB = currentInput[i + 2] - prevInput[i + 2];

      moshBuffer[i] = Math.max(
        0,
        Math.min(255, moshBuffer[i] + deltaR * factor)
      );
      moshBuffer[i + 1] = Math.max(
        0,
        Math.min(255, moshBuffer[i + 1] + deltaG * factor)
      );
      moshBuffer[i + 2] = Math.max(
        0,
        Math.min(255, moshBuffer[i + 2] + deltaB * factor)
      );

      data[i] = moshBuffer[i];
      data[i + 1] = moshBuffer[i + 1];
      data[i + 2] = moshBuffer[i + 2];
    }

    datamoshState.prevInput = currentInput;
  },
});

function bilinearSample(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number,
  channel: number
): number {
  const x1 = Math.floor(x);
  const y1 = Math.floor(y);
  const x2 = x1 + 1;
  const y2 = y1 + 1;

  const wx = x - x1;
  const wy = y - y1;

  // Clamp coordinates
  const sx1 = Math.max(0, Math.min(width - 1, x1));
  const sy1 = Math.max(0, Math.min(height - 1, y1));
  const sx2 = Math.max(0, Math.min(width - 1, x2));
  const sy2 = Math.max(0, Math.min(height - 1, y2));

  const idx11 = (sy1 * width + sx1) * 4 + channel;
  const idx21 = (sy1 * width + sx2) * 4 + channel;
  const idx12 = (sy2 * width + sx1) * 4 + channel;
  const idx22 = (sy2 * width + sx2) * 4 + channel;

  const v11 = data[idx11];
  const v21 = data[idx21];
  const v12 = data[idx12];
  const v22 = data[idx22];

  return (
    (1 - wy) * ((1 - wx) * v11 + wx * v21) + wy * ((1 - wx) * v12 + wx * v22)
  );
}

registerEffect({
  type: "block-corrupt",
  label: "Block Corrupt",
  category: "glitch",
  processor: (data, { width, height, time = 0 }, params) => {
    const intensity = (params.intensity as number) || 30;
    const blockSize = (params.blockSize as number) || 16;
    if (intensity === 0) return;

    const source = new Uint8ClampedArray(data);
    const seed = Math.floor((time || 0) / 8);

    const blocksX = Math.ceil(width / blockSize);
    const blocksY = Math.ceil(height / blockSize);
    const numCorrupt = Math.floor(blocksX * blocksY * (intensity / 100) * 0.3);

    for (let i = 0; i < numCorrupt; i++) {
      const bx = Math.floor(pseudoRandom(seed + i * 100) * blocksX);
      const by = Math.floor(pseudoRandom(seed + i * 200) * blocksY);
      const effect = Math.floor(pseudoRandom(seed + i * 300) * 4);

      const startX = bx * blockSize;
      const startY = by * blockSize;
      const endX = Math.min(startX + blockSize, width);
      const endY = Math.min(startY + blockSize, height);

      if (effect === 0) {
        const srcBx = Math.floor(pseudoRandom(seed + i * 400) * blocksX);
        const srcBy = Math.floor(pseudoRandom(seed + i * 500) * blocksY);
        const srcStartX = srcBx * blockSize;
        const srcStartY = srcBy * blockSize;

        for (let y = startY; y < endY; y++) {
          for (let x = startX; x < endX; x++) {
            const srcX = srcStartX + (x - startX);
            const srcY = srcStartY + (y - startY);
            if (srcX < width && srcY < height) {
              const dstIdx = (y * width + x) * 4;
              const srcIdx = (srcY * width + srcX) * 4;
              data[dstIdx] = source[srcIdx];
              data[dstIdx + 1] = source[srcIdx + 1];
              data[dstIdx + 2] = source[srcIdx + 2];
            }
          }
        }
      } else if (effect === 1) {
        const shiftX = Math.floor(
          (pseudoRandom(seed + i * 600) - 0.5) * blockSize * 2
        );
        for (let y = startY; y < endY; y++) {
          for (let x = startX; x < endX; x++) {
            const srcX = (((x + shiftX) % width) + width) % width;
            const dstIdx = (y * width + x) * 4;
            const srcIdx = (y * width + srcX) * 4;
            data[dstIdx] = source[srcIdx];
            data[dstIdx + 1] = source[srcIdx + 1];
            data[dstIdx + 2] = source[srcIdx + 2];
          }
        }
      } else if (effect === 2) {
        const avgR = getBlockAverage(
          source,
          width,
          startX,
          startY,
          endX,
          endY,
          0
        );
        const avgG = getBlockAverage(
          source,
          width,
          startX,
          startY,
          endX,
          endY,
          1
        );
        const avgB = getBlockAverage(
          source,
          width,
          startX,
          startY,
          endX,
          endY,
          2
        );
        for (let y = startY; y < endY; y++) {
          for (let x = startX; x < endX; x++) {
            const idx = (y * width + x) * 4;
            data[idx] = avgR;
            data[idx + 1] = avgG;
            data[idx + 2] = avgB;
          }
        }
      } else {
        const firstPixelIdx = (startY * width + startX) * 4;
        const repeatR = source[firstPixelIdx];
        const repeatG = source[firstPixelIdx + 1];
        const repeatB = source[firstPixelIdx + 2];
        for (let y = startY; y < endY; y++) {
          for (let x = startX; x < endX; x++) {
            const idx = (y * width + x) * 4;
            data[idx] = repeatR;
            data[idx + 1] = repeatG;
            data[idx + 2] = repeatB;
          }
        }
      }
    }
  },
});

registerEffect({
  type: "pixel-sort",
  label: "Pixel Sort",
  category: "glitch",
  processor: (data, { width, height }, params) => {
    const threshold = (params.threshold as number) || 50;
    const direction = (params.direction as string) || "horizontal";

    if (direction === "horizontal") {
      for (let y = 0; y < height; y++) {
        const rowStart = y * width * 4;
        let segmentStart = -1;

        for (let x = 0; x < width; x++) {
          const i = rowStart + x * 4;
          const bri = (data[i] + data[i + 1] + data[i + 2]) / 3;

          if (bri > threshold) {
            if (segmentStart === -1) segmentStart = x;
          } else {
            if (segmentStart !== -1) {
              sortSegment(data, rowStart, segmentStart, x - 1);
              segmentStart = -1;
            }
          }
        }
        if (segmentStart !== -1)
          sortSegment(data, rowStart, segmentStart, width - 1);
      }
    } else {
      for (let x = 0; x < width; x++) {
        let segmentStart = -1;

        for (let y = 0; y < height; y++) {
          const i = (y * width + x) * 4;
          const bri = (data[i] + data[i + 1] + data[i + 2]) / 3;

          if (bri > threshold) {
            if (segmentStart === -1) segmentStart = y;
          } else {
            if (segmentStart !== -1) {
              sortSegmentV(data, width, x, segmentStart, y - 1);
              segmentStart = -1;
            }
          }
        }
        if (segmentStart !== -1)
          sortSegmentV(data, width, x, segmentStart, height - 1);
      }
    }
  },
});

registerEffect({
  type: "rgb-channel-separation",
  label: "RGB Split",
  category: "glitch",
  processor: (data, { width, height }, params) => {
    const rOffset = (params.rOffset as number) || 5;
    const gOffset = (params.gOffset as number) || 0;
    const bOffset = (params.bOffset as number) || -5;

    const source = new Uint8ClampedArray(data);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        const rX = clamp(x + rOffset, 0, width - 1);
        const gX = clamp(x + gOffset, 0, width - 1);
        const bX = clamp(x + bOffset, 0, width - 1);

        data[i] = source[(y * width + rX) * 4];
        data[i + 1] = source[(y * width + gX) * 4 + 1];
        data[i + 2] = source[(y * width + bX) * 4 + 2];
      }
    }
  },
});

registerEffect({
  type: "dither",
  label: "Dither",
  category: "retro",
  processor: (data, { width, height }, params) => {
    const depth = (params.depth as number) || 4;
    const step = 255 / (depth - 1);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        const bayerVal = BAYER_MATRIX_4x4[y % 4][x % 4];
        const noise = (bayerVal / 16 - 0.5) * step;

        data[i] = clamp(Math.round((data[i] + noise) / step) * step, 0, 255);
        data[i + 1] = clamp(
          Math.round((data[i + 1] + noise) / step) * step,
          0,
          255
        );
        data[i + 2] = clamp(
          Math.round((data[i + 2] + noise) / step) * step,
          0,
          255
        );
      }
    }
  },
});

registerEffect({
  type: "chromatic-aberration",
  label: "Chromatic Aberration",
  category: "distortion",
  processor: (data, { width, height }, params) => {
    const offset = (params.offset as number) || 5;
    if (offset === 0) return;

    const source = new Uint8ClampedArray(data);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        const rX = clamp(x + offset, 0, width - 1);
        const bX = clamp(x - offset, 0, width - 1);

        data[i] = source[(y * width + rX) * 4];
        data[i + 2] = source[(y * width + bX) * 4 + 2];
      }
    }
  },
});

registerEffect({
  type: "vignette",
  label: "Vignette",
  category: "color",
  processor: (data, { width, height }, params) => {
    const intensity = (params.intensity as number) || 0.5;
    const radius = (params.radius as number) || 0.8;

    const cx = width / 2;
    const cy = height / 2;
    const maxDist = Math.sqrt(cx * cx + cy * cy);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
        const normalizedDist = dist / maxDist / radius;
        const factor = 1 - Math.pow(Math.min(normalizedDist, 1), 2) * intensity;

        const i = (y * width + x) * 4;
        data[i] = Math.max(0, data[i] * factor);
        data[i + 1] = Math.max(0, data[i + 1] * factor);
        data[i + 2] = Math.max(0, data[i + 2] * factor);
      }
    }
  },
});

registerEffect({
  type: "film-grain",
  label: "Film Grain",
  category: "noise",
  processor: (data, { width, height, time = 0 }, params) => {
    const intensity = (params.intensity as number) || 30;
    if (intensity === 0) return;

    const strength = intensity * 2.55;
    const seed = Math.floor(time / 2);

    for (let i = 0; i < data.length; i += 4) {
      const noise = (pseudoRandom(seed + i) - 0.5) * strength;
      data[i] = clamp(data[i] + noise, 0, 255);
      data[i + 1] = clamp(data[i + 1] + noise, 0, 255);
      data[i + 2] = clamp(data[i + 2] + noise, 0, 255);
    }
  },
});

registerEffect({
  type: "scanlines",
  label: "Scanlines",
  category: "retro",
  processor: (data, { width, height }, params) => {
    const spacing = (params.spacing as number) || 3;
    const opacity = (params.opacity as number) || 0.4;
    const darken = 1 - opacity;

    for (let y = 0; y < height; y++) {
      if (y % spacing === 0) {
        for (let x = 0; x < width; x++) {
          const i = (y * width + x) * 4;
          data[i] *= darken;
          data[i + 1] *= darken;
          data[i + 2] *= darken;
        }
      }
    }
  },
});

registerEffect({
  type: "edge-detect",
  label: "Edge Detect",
  category: "color",
  processor: (data, { width, height }, params) => {
    const threshold = (params.threshold as number) || 50;
    const invert = (params.invert as boolean) || false;

    const source = new Uint8ClampedArray(data);
    const sobelX = [
      [-1, 0, 1],
      [-2, 0, 2],
      [-1, 0, 1],
    ];
    const sobelY = [
      [-1, -2, -1],
      [0, 0, 0],
      [1, 2, 1],
    ];

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        let gx = 0,
          gy = 0;

        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const idx = ((y + ky) * width + (x + kx)) * 4;
            const lum = (source[idx] + source[idx + 1] + source[idx + 2]) / 3;
            gx += lum * sobelX[ky + 1][kx + 1];
            gy += lum * sobelY[ky + 1][kx + 1];
          }
        }

        const mag = Math.sqrt(gx * gx + gy * gy);
        let edge = mag > threshold ? 255 : 0;
        if (invert) edge = 255 - edge;

        const i = (y * width + x) * 4;
        data[i] = data[i + 1] = data[i + 2] = edge;
      }
    }
  },
});

registerEffect({
  type: "thermal",
  label: "Thermal",
  category: "color",
  processor: (data, config, params) => {
    const palette = (params.palette as string) || "thermal";
    const gradients: Record<string, number[][]> = {
      thermal: [
        [0, 0, 0],
        [30, 0, 100],
        [120, 0, 180],
        [220, 0, 100],
        [255, 50, 0],
        [255, 150, 0],
        [255, 255, 100],
        [255, 255, 255],
      ],
      "night-vision": [
        [0, 0, 0],
        [0, 20, 0],
        [0, 60, 0],
        [0, 120, 0],
        [0, 180, 0],
        [50, 220, 50],
        [150, 255, 150],
        [220, 255, 220],
      ],
      infrared: [
        [0, 0, 50],
        [0, 0, 150],
        [100, 0, 200],
        [200, 0, 150],
        [255, 50, 50],
        [255, 150, 50],
        [255, 220, 150],
        [255, 255, 255],
      ],
    };

    const gradient = gradients[palette] || gradients.thermal;
    const len = gradient.length;

    for (let i = 0; i < data.length; i += 4) {
      const lum = (data[i] + data[i + 1] + data[i + 2]) / 3 / 255;
      const pos = lum * (len - 1);
      const idx = Math.min(len - 2, Math.floor(pos));
      const t = pos - idx;

      data[i] =
        gradient[idx][0] + (gradient[idx + 1][0] - gradient[idx][0]) * t;
      data[i + 1] =
        gradient[idx][1] + (gradient[idx + 1][1] - gradient[idx][1]) * t;
      data[i + 2] =
        gradient[idx][2] + (gradient[idx + 1][2] - gradient[idx][2]) * t;
    }
  },
});

registerEffect({
  type: "mirror",
  label: "Mirror",
  category: "distortion",
  processor: (data, { width, height }, params) => {
    const mode = (params.mode as string) || "horizontal";
    const source = new Uint8ClampedArray(data);
    const cx = width / 2;
    const cy = height / 2;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let srcX = x,
          srcY = y;

        if (mode === "horizontal") {
          if (x >= cx) srcX = width - 1 - x;
        } else if (mode === "vertical") {
          if (y >= cy) srcY = height - 1 - y;
        } else if (mode === "quad") {
          if (x >= cx) srcX = width - 1 - x;
          if (y >= cy) srcY = height - 1 - y;
        } else if (mode === "kaleidoscope") {
          const dx = x - cx;
          const dy = y - cy;
          const dist = Math.sqrt(dx * dx + dy * dy);
          let angle = Math.atan2(dy, dx);
          const segments = 6;
          const segmentAngle = (Math.PI * 2) / segments;
          angle = Math.abs((angle % segmentAngle) - segmentAngle / 2);
          srcX = clamp(Math.floor(cx + Math.cos(angle) * dist), 0, width - 1);
          srcY = clamp(Math.floor(cy + Math.sin(angle) * dist), 0, height - 1);
        }

        const src = (srcY * width + srcX) * 4;
        const dst = (y * width + x) * 4;
        data[dst] = source[src];
        data[dst + 1] = source[src + 1];
        data[dst + 2] = source[src + 2];
      }
    }
  },
});

registerEffect({
  type: "bloom",
  label: "Bloom",
  category: "color",
  processor: (data, { width, height }, params) => {
    const threshold = (params.threshold as number) || 200;
    const intensity = (params.intensity as number) || 0.5;
    const radius = (params.radius as number) || 3;

    const brightPixels = new Float32Array(width * height * 3);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        const bi = (y * width + x) * 3;
        const lum = (data[i] + data[i + 1] + data[i + 2]) / 3;

        if (lum > threshold) {
          const factor = (lum - threshold) / (255 - threshold);
          brightPixels[bi] = data[i] * factor;
          brightPixels[bi + 1] = data[i + 1] * factor;
          brightPixels[bi + 2] = data[i + 2] * factor;
        }
      }
    }

    const blurred = new Float32Array(brightPixels.length);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let r = 0,
          g = 0,
          b = 0,
          count = 0;

        for (let ky = -radius; ky <= radius; ky++) {
          for (let kx = -radius; kx <= radius; kx++) {
            const ny = y + ky,
              nx = x + kx;
            if (ny >= 0 && ny < height && nx >= 0 && nx < width) {
              const bi = (ny * width + nx) * 3;
              r += brightPixels[bi];
              g += brightPixels[bi + 1];
              b += brightPixels[bi + 2];
              count++;
            }
          }
        }

        const bi = (y * width + x) * 3;
        blurred[bi] = r / count;
        blurred[bi + 1] = g / count;
        blurred[bi + 2] = b / count;
      }
    }

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        const bi = (y * width + x) * 3;
        data[i] = Math.min(255, data[i] + blurred[bi] * intensity);
        data[i + 1] = Math.min(255, data[i + 1] + blurred[bi + 1] * intensity);
        data[i + 2] = Math.min(255, data[i + 2] + blurred[bi + 2] * intensity);
      }
    }
  },
});

registerEffect({
  type: "displacement",
  label: "Displacement",
  category: "distortion",
  processor: (data, { width, height, time = 0 }, params) => {
    const scale = (params.scale as number) || 20;
    const animated = (params.animated as boolean) ?? true;

    const source = new Uint8ClampedArray(data);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        const lum = (source[i] + source[i + 1] + source[i + 2]) / 3 / 255;

        let wave = 0;
        if (animated) {
          wave = Math.sin(time * 0.05 + y * 0.05) * (scale * 0.3);
        }

        const offsetX = Math.floor((lum - 0.5) * scale + wave);
        const srcX = clamp(x + offsetX, 0, width - 1);

        const src = (y * width + srcX) * 4;
        data[i] = source[src];
        data[i + 1] = source[src + 1];
        data[i + 2] = source[src + 2];
      }
    }
  },
});

registerEffect({
  type: "wave-distortion",
  label: "Wave",
  category: "distortion",
  processor: (data, { width, height, time = 0 }, params) => {
    const amplitude = (params.amplitude as number) || 10;
    const frequency = (params.frequency as number) || 0.1;
    const direction = (params.direction as string) || "horizontal";
    const animated = (params.animated as boolean) ?? true;

    const source = new Uint8ClampedArray(data);
    const phase = animated ? time * 0.1 : 0;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        let srcX = x,
          srcY = y;

        if (direction === "horizontal") {
          srcX = Math.floor(x + Math.sin(y * frequency + phase) * amplitude);
        } else {
          srcY = Math.floor(y + Math.sin(x * frequency + phase) * amplitude);
        }

        srcX = clamp(srcX, 0, width - 1);
        srcY = clamp(srcY, 0, height - 1);

        const srcIdx = (srcY * width + srcX) * 4;
        data[i] = source[srcIdx];
        data[i + 1] = source[srcIdx + 1];
        data[i + 2] = source[srcIdx + 2];
      }
    }
  },
});

registerEffect({
  type: "twirl",
  label: "Twirl",
  category: "distortion",
  processor: (data, { width, height }, params) => {
    const angle = (params.angle as number) || 0.5;
    const radius = (params.radius as number) || 0.5;

    const source = new Uint8ClampedArray(data);
    const cx = width / 2;
    const cy = height / 2;
    const maxDist = Math.sqrt(cx * cx + cy * cy);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        const dx = x - cx;
        const dy = y - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const normalizedDist = dist / maxDist;

        if (normalizedDist < radius) {
          const twist = angle * (1 - normalizedDist / radius);
          const a = Math.atan2(dy, dx) + twist;
          const srcX = clamp(Math.floor(cx + Math.cos(a) * dist), 0, width - 1);
          const srcY = clamp(
            Math.floor(cy + Math.sin(a) * dist),
            0,
            height - 1
          );

          const srcIdx = (srcY * width + srcX) * 4;
          data[i] = source[srcIdx];
          data[i + 1] = source[srcIdx + 1];
          data[i + 2] = source[srcIdx + 2];
        }
      }
    }
  },
});

registerEffect({
  type: "ripple",
  label: "Ripple",
  category: "distortion",
  processor: (data, { width, height, time = 0 }, params) => {
    const amplitude = (params.amplitude as number) || 20;
    const frequency = (params.frequency as number) || 0.05;
    const centerX = (params.centerX as number) || 0.5;
    const centerY = (params.centerY as number) || 0.5;

    const source = new Uint8ClampedArray(data);
    const cx = centerX * width;
    const cy = centerY * height;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        const dx = x - cx;
        const dy = y - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const ripple = Math.sin(dist * frequency - time * 0.1) * amplitude;

        const angle = Math.atan2(dy, dx);
        const srcX = clamp(
          Math.floor(x + Math.cos(angle) * ripple),
          0,
          width - 1
        );
        const srcY = clamp(
          Math.floor(y + Math.sin(angle) * ripple),
          0,
          height - 1
        );

        const srcIdx = (srcY * width + srcX) * 4;
        data[i] = source[srcIdx];
        data[i + 1] = source[srcIdx + 1];
        data[i + 2] = source[srcIdx + 2];
      }
    }
  },
});

registerEffect({
  type: "vhs",
  label: "VHS",
  category: "retro",
  processor: (data, { width, height, time = 0 }, params) => {
    const intensity = (params.intensity as number) || 50;
    if (intensity === 0) return;

    const source = new Uint8ClampedArray(data);
    const seed = Math.floor(time / 3);

    for (let y = 0; y < height; y++) {
      const trackingOffset =
        Math.sin(y * 0.01 + time * 0.05) * (intensity / 30);
      const jitter =
        pseudoRandom(seed + y) < 0.02
          ? Math.floor((pseudoRandom(seed + y * 2) - 0.5) * intensity)
          : 0;

      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        const srcX = clamp(
          Math.floor(x + trackingOffset + jitter),
          0,
          width - 1
        );

        const chromaOffset = Math.floor(intensity / 20);
        const rX = clamp(srcX + chromaOffset, 0, width - 1);
        const bX = clamp(srcX - chromaOffset, 0, width - 1);

        data[i] = source[(y * width + rX) * 4];
        data[i + 1] = source[(y * width + srcX) * 4 + 1];
        data[i + 2] = source[(y * width + bX) * 4 + 2];
      }
    }

    const noiseIntensity = intensity / 200;
    for (let i = 0; i < data.length; i += 4) {
      if (pseudoRandom(seed + i) < noiseIntensity) {
        const noise = (pseudoRandom(seed + i + 1) - 0.5) * 100;
        data[i] = clamp(data[i] + noise, 0, 255);
        data[i + 1] = clamp(data[i + 1] + noise, 0, 255);
        data[i + 2] = clamp(data[i + 2] + noise, 0, 255);
      }
    }

    const numTrackingLines = Math.floor(intensity / 30);
    for (let t = 0; t < numTrackingLines; t++) {
      const lineY = Math.floor(pseudoRandom(seed + t * 1000) * height);
      const lineThickness = 1 + Math.floor(pseudoRandom(seed + t * 2000) * 3);

      for (let dy = 0; dy < lineThickness && lineY + dy < height; dy++) {
        for (let x = 0; x < width; x++) {
          const i = ((lineY + dy) * width + x) * 4;
          const brightness = 0.3 + pseudoRandom(seed + x + t) * 0.4;
          data[i] *= brightness;
          data[i + 1] *= brightness;
          data[i + 2] *= brightness;
        }
      }
    }
  },
});

registerEffect({
  type: "crt",
  label: "CRT",
  category: "retro",
  processor: (data, { width, height }, params) => {
    const curvature = (params.curvature as number) || 0.2;
    const scanlineIntensity = (params.scanlines as number) || 0.3;

    const source = new Uint8ClampedArray(data);
    const cx = width / 2;
    const cy = height / 2;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        const dx = (x - cx) / width;
        const dy = (y - cy) / height;
        const dist = Math.sqrt(dx * dx + dy * dy);

        const curve = 1 + curvature * dist * dist;
        const srcX = clamp(Math.floor(cx + dx * width * curve), 0, width - 1);
        const srcY = clamp(Math.floor(cy + dy * height * curve), 0, height - 1);

        if (srcX < 0 || srcX >= width || srcY < 0 || srcY >= height) {
          data[i] = data[i + 1] = data[i + 2] = 0;
        } else {
          const srcIdx = (srcY * width + srcX) * 4;
          data[i] = source[srcIdx];
          data[i + 1] = source[srcIdx + 1];
          data[i + 2] = source[srcIdx + 2];
        }

        const scanline = y % 3 === 0 ? 1 - scanlineIntensity : 1;
        data[i] *= scanline;
        data[i + 1] *= scanline;
        data[i + 2] *= scanline;
      }
    }
  },
});

registerEffect({
  type: "posterize",
  label: "Posterize",
  category: "color",
  processor: (data, config, params) => {
    const levels = (params.levels as number) || 8;
    const step = 255 / (levels - 1);

    for (let i = 0; i < data.length; i += 4) {
      data[i] = Math.round(data[i] / step) * step;
      data[i + 1] = Math.round(data[i + 1] / step) * step;
      data[i + 2] = Math.round(data[i + 2] / step) * step;
    }
  },
});

registerEffect({
  type: "solarize",
  label: "Solarize",
  category: "color",
  processor: (data, config, params) => {
    const threshold = (params.threshold as number) || 128;

    for (let i = 0; i < data.length; i += 4) {
      if (data[i] > threshold) data[i] = 255 - data[i];
      if (data[i + 1] > threshold) data[i + 1] = 255 - data[i + 1];
      if (data[i + 2] > threshold) data[i + 2] = 255 - data[i + 2];
    }
  },
});

registerEffect({
  type: "duotone",
  label: "Duotone",
  category: "color",
  processor: (data, config, params) => {
    const color1 = hexToRgb((params.color1 as string) || "#000000");
    const color2 = hexToRgb((params.color2 as string) || "#ffffff");

    for (let i = 0; i < data.length; i += 4) {
      const lum = (data[i] + data[i + 1] + data[i + 2]) / 3 / 255;
      data[i] = color1.r + (color2.r - color1.r) * lum;
      data[i + 1] = color1.g + (color2.g - color1.g) * lum;
      data[i + 2] = color1.b + (color2.b - color1.b) * lum;
    }
  },
});

registerEffect({
  type: "color-shift",
  label: "Color Shift",
  category: "color",
  processor: (data, { time = 0 }, params) => {
    const speed = (params.speed as number) || 1;
    const hueShift = (time * speed) % 360;

    for (let i = 0; i < data.length; i += 4) {
      const [h, s, l] = rgbToHsl(data[i], data[i + 1], data[i + 2]);
      const [r, g, b] = hslToRgb((h + hueShift) % 360, s, l);
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
    }
  },
});

registerEffect({
  type: "channel-swap",
  label: "Channel Swap",
  category: "color",
  processor: (data, config, params) => {
    const swap = (params.swap as string) || "rg";

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i],
        g = data[i + 1],
        b = data[i + 2];

      if (swap === "rg") {
        data[i] = g;
        data[i + 1] = r;
      } else if (swap === "rb") {
        data[i] = b;
        data[i + 2] = r;
      } else if (swap === "gb") {
        data[i + 1] = b;
        data[i + 2] = g;
      } else if (swap === "rgb") {
        data[i] = g;
        data[i + 1] = b;
        data[i + 2] = r;
      }
    }
  },
});

registerEffect({
  type: "noise",
  label: "Static Noise",
  category: "noise",
  processor: (data, { time = 0 }, params) => {
    const intensity = (params.intensity as number) || 20;
    const colored = (params.colored as boolean) || false;
    if (intensity === 0) return;

    const seed = Math.floor(time);

    for (let i = 0; i < data.length; i += 4) {
      if (pseudoRandom(seed + i) * 100 < intensity) {
        if (colored) {
          data[i] = pseudoRandom(seed + i + 1) * 255;
          data[i + 1] = pseudoRandom(seed + i + 2) * 255;
          data[i + 2] = pseudoRandom(seed + i + 3) * 255;
        } else {
          const v = pseudoRandom(seed + i + 1) > 0.5 ? 255 : 0;
          data[i] = data[i + 1] = data[i + 2] = v;
        }
      }
    }
  },
});

function pseudoRandom(seed: number): number {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function sortSegment(
  data: Uint8ClampedArray,
  rowStart: number,
  startX: number,
  endX: number
): void {
  const pixels = [];
  for (let x = startX; x <= endX; x++) {
    const i = rowStart + x * 4;
    pixels.push({
      r: data[i],
      g: data[i + 1],
      b: data[i + 2],
      bri: data[i] + data[i + 1] + data[i + 2],
    });
  }
  pixels.sort((a, b) => a.bri - b.bri);
  for (let x = startX; x <= endX; x++) {
    const i = rowStart + x * 4;
    const p = pixels[x - startX];
    data[i] = p.r;
    data[i + 1] = p.g;
    data[i + 2] = p.b;
  }
}

function sortSegmentV(
  data: Uint8ClampedArray,
  width: number,
  x: number,
  startY: number,
  endY: number
): void {
  const pixels = [];
  for (let y = startY; y <= endY; y++) {
    const i = (y * width + x) * 4;
    pixels.push({
      r: data[i],
      g: data[i + 1],
      b: data[i + 2],
      bri: data[i] + data[i + 1] + data[i + 2],
    });
  }
  pixels.sort((a, b) => a.bri - b.bri);
  for (let y = startY; y <= endY; y++) {
    const i = (y * width + x) * 4;
    const p = pixels[y - startY];
    data[i] = p.r;
    data[i + 1] = p.g;
    data[i + 2] = p.b;
  }
}

function getBlockAverage(
  data: Uint8ClampedArray,
  width: number,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  channel: number
): number {
  let sum = 0,
    count = 0;
  for (let y = startY; y < endY; y++) {
    for (let x = startX; x < endX; x++) {
      sum += data[(y * width + x) * 4 + channel];
      count++;
    }
  }
  return count > 0 ? sum / count : 0;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : { r: 0, g: 0, b: 0 };
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b);
  let h = 0,
    s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }

  return [h * 360, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  h /= 360;
  let r, g, b;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}
