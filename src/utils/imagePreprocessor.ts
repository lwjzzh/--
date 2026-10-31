import { OversizedImageCandidate } from '../types';

export const MAX_SAFE_IMAGE_DIMENSION = 4096;
export const MAX_LONG_IMAGE_SLICE_COUNT = 20;

export interface SlicedSegmentResult {
  index: number;
  sliceIndex: number;
  sliceTotal: number;
  name: string;
  dataUrl: string;
  width: number;
  height: number;
  startPct: number;
  endPct: number;
}

/**
 * Inspect an uploaded image File to check if:
 * 1) Its width or height exceeds MAX_SAFE_IMAGE_DIMENSION (4096px), OR
 * 2) It is a multi-screen vertical detail page reference image (targetTag === 'case' && height >= 2400 && aspect >= 2.4).
 */
export async function inspectOversizedImageFile(
  file: File,
  targetTag: 'product' | 'case'
): Promise<OversizedImageCandidate | null> {
  if (!file || !file.type.startsWith('image/')) return null;

  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const width = img.naturalWidth || img.width;
      const height = img.naturalHeight || img.height;
      const isMultiScreenLongCase =
        targetTag === 'case' &&
        height >= 2400 &&
        height / Math.max(1, width) >= 2.4;

      if (
        width > MAX_SAFE_IMAGE_DIMENSION ||
        height > MAX_SAFE_IMAGE_DIMENSION ||
        isMultiScreenLongCase
      ) {
        // Standard e-commerce single screen height is typically ~1.5x to 1.65x of width (e.g. 790x1200 ~ 790x1350)
        const idealScreenHeight = Math.max(750, Math.round(width * 1.55));
        const estimatedSlices =
          height >= width
            ? Math.max(2, Math.round(height / idealScreenHeight))
            : Math.max(2, Math.ceil(width / 1400));

        resolve({
          id: `oversized-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          file,
          name: file.name.replace(/\.[^/.]+$/, ''),
          width,
          height,
          previewUrl: objectUrl,
          targetTag,
          recommendedSliceCount: Math.min(
            MAX_LONG_IMAGE_SLICE_COUNT,
            Math.max(2, estimatedSlices)
          ),
        });
      } else {
        URL.revokeObjectURL(objectUrl);
        resolve(null);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(null);
    };
    img.src = objectUrl;
  });
}

/**
 * Generates uniform cut percentages [1/N * 100, 2/N * 100, ..., (N-1)/N * 100]
 */
export function buildUniformCutPercents(sliceCount: number): number[] {
  const count = Math.max(2, Math.min(MAX_LONG_IMAGE_SLICE_COUNT, sliceCount));
  return Array.from({ length: count - 1 }, (_, i) =>
    Number((((i + 1) / count) * 100).toFixed(2))
  );
}

/**
 * Canvas Pixel-Row Energy & Variance Smart Seam Detector:
 * Scans a vertical (or horizontal) long image to find the safest module boundaries
 * (whitespace bands, solid color dividers, low-detail transitions) near each target screen height,
 * avoiding cutting through typography headlines or product subjects.
 */
export async function detectSmartSeamCutPercents(
  source: OversizedImageCandidate | string,
  sliceCount: number
): Promise<number[]> {
  const count = Math.max(2, Math.min(MAX_LONG_IMAGE_SLICE_COUNT, sliceCount));
  const uniformCuts = buildUniformCutPercents(count);
  const previewUrl =
    typeof source === 'string' ? source : source?.previewUrl || '';
  if (!previewUrl) {
    return uniformCuts;
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const origW = img.naturalWidth || img.width;
        const origH = img.naturalHeight || img.height;
        const isVertical = origH >= origW;

        if (!isVertical) {
          resolve(uniformCuts);
          return;
        }

        // Downsample to a fast analysis canvas (width ~180px, height up to 2400px)
        const sampleW = Math.min(180, Math.max(64, origW));
        const sampleH = Math.min(2400, Math.max(360, Math.round(origH / 4)));
        const canvas = document.createElement('canvas');
        canvas.width = sampleW;
        canvas.height = sampleH;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(uniformCuts);
          return;
        }

        ctx.drawImage(img, 0, 0, sampleW, sampleH);
        const imgData = ctx.getImageData(0, 0, sampleW, sampleH).data;

        // 1. Compute horizontal detail energy for every row (ignoring 6% left/right outer borders)
        const xStart = Math.floor(sampleW * 0.06);
        const xEnd = Math.max(xStart + 1, Math.ceil(sampleW * 0.94));
        const spanW = xEnd - xStart;

        const rawRowEnergy = new Float32Array(sampleH);
        for (let y = 0; y < sampleH; y++) {
          let rSum = 0;
          let gSum = 0;
          let bSum = 0;
          let horizDiffSum = 0;
          let vertDiffSum = 0;

          const rowOffset = y * sampleW * 4;
          const prevRowOffset = Math.max(0, y - 1) * sampleW * 4;

          for (let x = xStart; x < xEnd; x++) {
            const idx = rowOffset + x * 4;
            const r = imgData[idx];
            const g = imgData[idx + 1];
            const b = imgData[idx + 2];
            rSum += r;
            gSum += g;
            bSum += b;

            if (x > xStart) {
              const prevIdx = idx - 4;
              horizDiffSum +=
                Math.abs(r - imgData[prevIdx]) +
                Math.abs(g - imgData[prevIdx + 1]) +
                Math.abs(b - imgData[prevIdx + 2]);
            }

            if (y > 0) {
              const upIdx = prevRowOffset + x * 4;
              vertDiffSum +=
                Math.abs(r - imgData[upIdx]) +
                Math.abs(g - imgData[upIdx + 1]) +
                Math.abs(b - imgData[upIdx + 2]);
            }
          }

          const rMean = rSum / spanW;
          const gMean = gSum / spanW;
          const bMean = bSum / spanW;

          let colorVarSum = 0;
          for (let x = xStart; x < xEnd; x++) {
            const idx = rowOffset + x * 4;
            colorVarSum +=
              Math.abs(imgData[idx] - rMean) +
              Math.abs(imgData[idx + 1] - gMean) +
              Math.abs(imgData[idx + 2] - bMean);
          }

          const avgHorizEdge = horizDiffSum / spanW;
          const avgVertEdge = vertDiffSum / spanW;
          const avgColorSpread = colorVarSum / spanW;

          // Text lines and product bodies have high horizontal edge & color spread.
          // Safe gaps between screens have very low horizontal edge and low color spread.
          rawRowEnergy[y] =
            avgHorizEdge * 1.8 + avgColorSpread * 0.9 + avgVertEdge * 0.5;
        }

        // 2. Smooth row energy over a 5-row vertical window so we pick the middle of a clean gap
        //    Also slightly reward rows that sit right next to a clean horizontal section divider
        const smoothedEnergy = new Float32Array(sampleH);
        const radius = 2;
        for (let y = 0; y < sampleH; y++) {
          let sum = 0;
          let cnt = 0;
          for (let dy = -radius; dy <= radius; dy++) {
            const ny = y + dy;
            if (ny >= 0 && ny < sampleH) {
              sum += rawRowEnergy[ny];
              cnt++;
            }
          }
          smoothedEnergy[y] = sum / Math.max(1, cnt);
        }

        // 3. For each ideal cut line, search within ±32% of a screen step for the lowest-energy seam
        const stepPct = 100 / count;
        const maxSearchHalfPct = Math.min(8.5, stepPct * 0.34);
        const minGapPct = Math.max(2.5, stepPct * 0.42);

        const detectedCuts: number[] = [];
        for (let i = 0; i < count - 1; i++) {
          const idealPct = ((i + 1) / count) * 100;
          const prevCutPct = i > 0 ? detectedCuts[i - 1] : 0;
          const minAllowedPct = Math.max(
            prevCutPct + minGapPct,
            idealPct - maxSearchHalfPct
          );
          const maxAllowedPct = Math.min(
            100 - (count - 1 - i) * minGapPct,
            idealPct + maxSearchHalfPct
          );

          const yMin = Math.max(
            2,
            Math.floor((minAllowedPct / 100) * sampleH)
          );
          const yMax = Math.min(
            sampleH - 3,
            Math.ceil((maxAllowedPct / 100) * sampleH)
          );
          const yIdeal = Math.round((idealPct / 100) * sampleH);

          let bestY = yIdeal;
          let bestScore = Number.POSITIVE_INFINITY;

          for (let y = yMin; y <= yMax; y++) {
            // Mild distance penalty from ideal position so slices stay reasonably balanced
            const distRatio =
              Math.abs(y - yIdeal) / Math.max(1, (maxSearchHalfPct / 100) * sampleH);
            const score = smoothedEnergy[y] + distRatio * 8.5;
            if (score < bestScore) {
              bestScore = score;
              bestY = y;
            }
          }

          const bestPct = Number(((bestY / sampleH) * 100).toFixed(2));
          detectedCuts.push(
            Math.max(
              Number(minAllowedPct.toFixed(2)),
              Math.min(Number(maxAllowedPct.toFixed(2)), bestPct)
            )
          );
        }

        resolve(detectedCuts);
      } catch {
        resolve(uniformCuts);
      }
    };
    img.onerror = () => resolve(uniformCuts);
    img.src = previewUrl;
  });
}

/**
 * High-resolution image normalizer with OSS-aware relaxation:
 * - When OSS is enabled (or highResMode=true): allows up to 2560px (or 4096px max) at quality 0.92,
 *   preserving crisp typography on #Case reference images.
 * - When OSS is not enabled: keeps reasonable 1600px / 0.85 quality to avoid browser memory bloat.
 */
export async function normalizeUploadedImageHighRes(
  file: File,
  options?: {
    ossEnabled?: boolean;
    maxDimensionOverride?: number;
    qualityOverride?: number;
  }
): Promise<{ dataUrl: string; width: number; height: number; mimeType: string }> {
  const ossEnabled = options?.ossEnabled ?? true;
  const maxDimension =
    options?.maxDimensionOverride ?? (ossEnabled ? 2560 : 1600);
  const targetQuality = options?.qualityOverride ?? (ossEnabled ? 0.92 : 0.84);

  const rawDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error || new Error('Failed to read image file'));
    reader.readAsDataURL(file);
  });

  const { mimeType: rawMime } = extractMimeAndExtFromDataUrl(
    rawDataUrl,
    file.type || 'image/jpeg'
  );

  if (!file.type.startsWith('image/')) {
    return { dataUrl: rawDataUrl, width: 0, height: 0, mimeType: rawMime };
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const origW = img.naturalWidth || img.width;
      const origH = img.naturalHeight || img.height;

      // If within maxDimension and file size is already reasonable (< 4.5MB on OSS), keep original quality & format
      if (
        Math.max(origW, origH) <= maxDimension &&
        file.size <= (ossEnabled ? 4.5 * 1024 * 1024 : 900 * 1024)
      ) {
        resolve({ dataUrl: rawDataUrl, width: origW, height: origH, mimeType: rawMime });
        return;
      }

      const scale = Math.min(1, maxDimension / Math.max(origW, origH));
      const targetW = Math.max(1, Math.round(origW * scale));
      const targetH = Math.max(1, Math.round(origH * scale));

      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve({ dataUrl: rawDataUrl, width: origW, height: origH, mimeType: rawMime });
        return;
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, targetW, targetH);

      // Detect if PNG/WebP has actual alpha transparency so we don't flatten transparent product cutouts (#Prod) to white JPEG
      let hasTransparency = false;
      if (rawMime === 'image/png' || rawMime === 'image/webp') {
        try {
          const sampleStepX = Math.max(1, Math.floor(targetW / 32));
          const sampleStepY = Math.max(1, Math.floor(targetH / 32));
          const imgData = ctx.getImageData(0, 0, targetW, targetH).data;
          for (let y = 0; y < targetH && !hasTransparency; y += sampleStepY) {
            for (let x = 0; x < targetW; x += sampleStepX) {
              const alpha = imgData[(y * targetW + x) * 4 + 3];
              if (alpha < 250) {
                hasTransparency = true;
                break;
              }
            }
          }
        } catch {
          // Ignore canvas read error
        }
      }

      if (hasTransparency) {
        const pngDataUrl = canvas.toDataURL('image/png');
        resolve({ dataUrl: pngDataUrl, width: targetW, height: targetH, mimeType: 'image/png' });
        return;
      }

      // Opaque image: composite over pure white and encode as high-res JPEG
      ctx.globalCompositeOperation = 'destination-over';
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, targetW, targetH);
      ctx.globalCompositeOperation = 'source-over';

      const compressed = canvas.toDataURL('image/jpeg', targetQuality);
      resolve({ dataUrl: compressed, width: targetW, height: targetH, mimeType: 'image/jpeg' });
    };
    img.onerror = () => resolve({ dataUrl: rawDataUrl, width: 0, height: 0, mimeType: rawMime });
    img.src = rawDataUrl;
  });
}

export function extractMimeAndExtFromDataUrl(
  dataUrl: string,
  fallbackMime = 'image/jpeg'
): { mimeType: string; ext: string } {
  let mime = fallbackMime;
  if (dataUrl.startsWith('data:image/')) {
    const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,/i);
    if (match?.[1]) {
      mime = match[1].toLowerCase();
    }
  } else {
    const b64 = dataUrl.trim();
    if (b64.startsWith('iVBORw0KGgo')) mime = 'image/png';
    else if (b64.startsWith('/9j/')) mime = 'image/jpeg';
    else if (b64.startsWith('UklGR')) mime = 'image/webp';
  }
  const ext =
    mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
  return { mimeType: mime, ext };
}

/**
 * Slice an oversized vertical (or horizontal) reference image using custom cut line percentages
 * (either from Smart Seam Detection or user drag adjustment) + optional overlap padding.
 */
export async function sliceOversizedImageByCustomCuts(
  candidate: OversizedImageCandidate,
  cutPercents: number[],
  overlapPx: number = 40
): Promise<SlicedSegmentResult[]> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const origW = img.naturalWidth || img.width;
      const origH = img.naturalHeight || img.height;
      const isVertical = origH >= origW;

      const sortedCuts = [...cutPercents]
        .filter((p) => p > 0.5 && p < 99.5)
        .sort((a, b) => a - b);
      const boundaries = [0, ...sortedCuts, 100];
      const count = boundaries.length - 1;
      const results: SlicedSegmentResult[] = [];
      const halfOverlap = Math.max(0, Math.round(overlapPx / 2));

      for (let i = 0; i < count; i++) {
        const startPct = boundaries[i];
        const endPct = boundaries[i + 1];

        if (isVertical) {
          const rawStartY = Math.round((startPct / 100) * origH);
          const rawEndY = Math.round((endPct / 100) * origH);
          const sy = i === 0 ? 0 : Math.max(0, rawStartY - halfOverlap);
          const ey =
            i === count - 1
              ? origH
              : Math.min(origH, rawEndY + halfOverlap);
          const sh = Math.max(1, ey - sy);

          const scale = Math.min(
            1,
            MAX_SAFE_IMAGE_DIMENSION / Math.max(origW, sh)
          );
          const dw = Math.max(1, Math.round(origW * scale));
          const dh = Math.max(1, Math.round(sh * scale));

          const canvas = document.createElement('canvas');
          canvas.width = dw;
          canvas.height = dh;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, dw, dh);
            ctx.drawImage(img, 0, sy, origW, sh, 0, 0, dw, dh);
            results.push({
              index: i + 1,
              sliceIndex: i + 1,
              sliceTotal: count,
              name: `${candidate.name}_第${i + 1}屏`,
              dataUrl: canvas.toDataURL('image/jpeg', 0.93),
              width: dw,
              height: dh,
              startPct: Number(startPct.toFixed(1)),
              endPct: Number(endPct.toFixed(1)),
            });
          }
        } else {
          const rawStartX = Math.round((startPct / 100) * origW);
          const rawEndX = Math.round((endPct / 100) * origW);
          const sx = i === 0 ? 0 : Math.max(0, rawStartX - halfOverlap);
          const ex =
            i === count - 1
              ? origW
              : Math.min(origW, rawEndX + halfOverlap);
          const sw = Math.max(1, ex - sx);

          const scale = Math.min(
            1,
            MAX_SAFE_IMAGE_DIMENSION / Math.max(sw, origH)
          );
          const dw = Math.max(1, Math.round(sw * scale));
          const dh = Math.max(1, Math.round(origH * scale));

          const canvas = document.createElement('canvas');
          canvas.width = dw;
          canvas.height = dh;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, dw, dh);
            ctx.drawImage(img, sx, 0, sw, origH, 0, 0, dw, dh);
            results.push({
              index: i + 1,
              sliceIndex: i + 1,
              sliceTotal: count,
              name: `${candidate.name}_切片${i + 1}`,
              dataUrl: canvas.toDataURL('image/jpeg', 0.93),
              width: dw,
              height: dh,
              startPct: Number(startPct.toFixed(1)),
              endPct: Number(endPct.toFixed(1)),
            });
          }
        }
      }

      resolve(results);
    };
    img.onerror = () => reject(new Error('无法加载超长图片进行切分'));
    img.src = candidate.previewUrl;
  });
}

/**
 * Backward-compatible wrapper for uniform slicing.
 */
export async function sliceOversizedImageToSegments(
  candidate: OversizedImageCandidate,
  sliceCount: number,
  overlapPx: number = 60
): Promise<Array<{ name: string; dataUrl: string; width: number; height: number }>> {
  const cuts = buildUniformCutPercents(sliceCount);
  return sliceOversizedImageByCustomCuts(candidate, cuts, overlapPx);
}

/**
 * Crop a specific vertical or horizontal range [startPercent, endPercent] from an OversizedImageCandidate,
 * ensuring the output stays <= 4096px.
 */
export async function cropOversizedImageRange(
  candidate: OversizedImageCandidate,
  startPercent: number,
  endPercent: number
): Promise<SlicedSegmentResult> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const origW = img.naturalWidth || img.width;
      const origH = img.naturalHeight || img.height;
      const isVertical = origH >= origW;

      const clampedStart = Math.max(0, Math.min(95, startPercent)) / 100;
      const clampedEnd = Math.max(clampedStart + 0.05, Math.min(100, endPercent) / 100);

      const sx = isVertical ? 0 : Math.round(origW * clampedStart);
      const sy = isVertical ? Math.round(origH * clampedStart) : 0;
      const sw = isVertical ? origW : Math.max(1, Math.round(origW * (clampedEnd - clampedStart)));
      const sh = isVertical ? Math.max(1, Math.round(origH * (clampedEnd - clampedStart))) : origH;

      const scale = Math.min(1, MAX_SAFE_IMAGE_DIMENSION / Math.max(sw, sh));
      const dw = Math.max(1, Math.round(sw * scale));
      const dh = Math.max(1, Math.round(sh * scale));

      const canvas = document.createElement('canvas');
      canvas.width = dw;
      canvas.height = dh;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas context unavailable'));
        return;
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, dw, dh);
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, dw, dh);

      resolve({
        index: 1,
        sliceIndex: 1,
        sliceTotal: 1,
        name: `${candidate.name}_裁剪区`,
        dataUrl: canvas.toDataURL('image/jpeg', 0.93),
        width: dw,
        height: dh,
        startPct: Number((clampedStart * 100).toFixed(1)),
        endPct: Number((clampedEnd * 100).toFixed(1)),
      });
    };
    img.onerror = () => reject(new Error('图片加载失败'));
    img.src = candidate.previewUrl;
  });
}
