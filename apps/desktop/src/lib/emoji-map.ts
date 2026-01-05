
export interface EmojiColor {
  char: string;
  r: number;
  g: number;
  b: number;
}

export class EmojiMap {
  private palette: EmojiColor[] = [];

  async generatePalette(candidates: string[]): Promise<void> {
    const size = 32;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    
    if (!ctx) throw new Error('Could not get 2D context');

    ctx.font = `${size - 4}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    this.palette = candidates.map(char => {
      ctx.clearRect(0, 0, size, size);
      ctx.fillText(char, size / 2, size / 2);

      const imageData = ctx.getImageData(0, 0, size, size);
      const data = imageData.data;
      let r = 0, g = 0, b = 0, count = 0;

      for (let i = 0; i < data.length; i += 4) {
        const alpha = data[i + 3];
        // Only count pixels that have some opacity
        if (alpha > 20) {
            r += data[i];
            g += data[i + 1];
            b += data[i + 2];
            count++;
        }
      }

      if (count > 0) {
        return { char, r: r / count, g: g / count, b: b / count };
      } else {
        return { char, r: 0, g: 0, b: 0 };
      }
    });

    console.log('Emoji Palette Generated. Size:', this.palette.length);
  }

  findNearest(r: number, g: number, b: number): string {
    let minDist = Infinity;
    let bestChar = ' ';

    // Simple Euclidean distance
    // Optimization: Don't allow this loop to block too much if palette is huge. 
    // For ~60 items it's negligible.
    for (const em of this.palette) {
      const dr = em.r - r;
      const dg = em.g - g;
      const db = em.b - b;
      const dist = dr*dr + dg*dg + db*db;
      if (dist < minDist) {
        minDist = dist;
        bestChar = em.char;
      }
    }
    return bestChar;
  }
}

export const emojiMap = new EmojiMap();
