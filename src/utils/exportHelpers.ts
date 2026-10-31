import JSZip from 'jszip';
import { ScreenTask, SkuTask } from '../types';

function sanitizeFileName(input: string): string {
  return input
    .replace(/[\\/:*?"<>|\s]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 48);
}

function dataUrlToBlob(dataUrl: string): Blob | null {
  const commaIdx = dataUrl.indexOf(',');
  if (commaIdx === -1) return null;
  const header = dataUrl.slice(0, commaIdx);
  const base64 = dataUrl.slice(commaIdx + 1).trim();
  const mimeMatch = header.match(/^data:([^;]+)/i);
  const mimeType = mimeMatch?.[1] || 'image/png';
  try {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new Blob([bytes], { type: mimeType });
  } catch {
    return null;
  }
}

export async function triggerReliableImageDownload(
  imageUrl: string,
  filename: string
): Promise<void> {
  const raw = (imageUrl || '').trim();
  if (!raw) return;

  let objectUrl: string | null = null;
  try {
    if (raw.startsWith('data:')) {
      const blob = dataUrlToBlob(raw);
      if (blob) {
        objectUrl = URL.createObjectURL(blob);
      }
    } else if (/^https?:\/\//i.test(raw)) {
      try {
        const res = await fetch(raw);
        if (res.ok) {
          const blob = await res.blob();
          objectUrl = URL.createObjectURL(blob);
        }
      } catch {
        // Fallback to direct anchor if CORS blocks fetch
      }
    }

    const link = document.createElement('a');
    link.href = objectUrl || raw;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } finally {
    if (objectUrl) {
      setTimeout(() => URL.revokeObjectURL(objectUrl!), 3000);
    }
  }
}

export function downloadSingleScreenImage(task: ScreenTask): void {
  const srcUrl = task.resultImageUrl || task.resultOssUrl;
  if (!srcUrl) return;
  const paddedNum = String(task.screenNumber).padStart(2, '0');
  const prefix = task.screenCategory === 'main' ? '主图' : '详情屏';
  const safeTitle = sanitizeFileName(task.title || `${prefix}_${paddedNum}`);
  const filename = `${paddedNum}_${prefix}_${safeTitle}_${task.aspectRatio.replace(':', 'x')}_${task.imageSize}.png`;
  void triggerReliableImageDownload(srcUrl, filename);
}

export function downloadSingleSkuImage(task: SkuTask): void {
  const srcUrl = task.resultImageUrl || task.resultOssUrl;
  if (!srcUrl) return;
  const paddedNum = String(task.skuIndex).padStart(2, '0');
  const safeTitle = sanitizeFileName(task.skuTitle || `SKU_${paddedNum}`);
  const filename = `SKU_${paddedNum}_${safeTitle}_${task.aspectRatio.replace(':', 'x')}_${task.imageSize}.png`;
  void triggerReliableImageDownload(srcUrl, filename);
}

export function downloadGenerationRecordImage(
  imageUrl: string,
  itemIndex = 1,
  title = '生图成片'
): void {
  if (!imageUrl) return;
  const paddedNum = String(itemIndex || 1).padStart(2, '0');
  const safeTitle = sanitizeFileName(title || `成片_${paddedNum}`);
  const filename = `${paddedNum}_${safeTitle}.png`;
  void triggerReliableImageDownload(imageUrl, filename);
}

async function addImageUrlToZipFolder(
  folder: JSZip,
  fileName: string,
  imageUrl: string | undefined,
  fallbackOssUrl?: string
): Promise<void> {
  const raw = (imageUrl || fallbackOssUrl || '').trim();
  if (!raw) return;

  if (raw.startsWith('data:')) {
    const commaIdx = raw.indexOf(',');
    const base64Part = commaIdx !== -1 ? raw.slice(commaIdx + 1).trim() : '';
    if (base64Part) {
      folder.file(fileName, base64Part, { base64: true });
      return;
    }
  }

  // Fallback for remote http(s):// or blob: URLs
  for (const candidateUrl of [raw, fallbackOssUrl].filter(Boolean) as string[]) {
    if (/^(https?:|blob:)/i.test(candidateUrl)) {
      try {
        const resp = await fetch(candidateUrl);
        if (resp.ok) {
          const buf = await resp.arrayBuffer();
          folder.file(fileName, buf);
          return;
        }
      } catch {
        // Try next candidate
      }
    }
  }
}

export async function exportGenerationRecordsAsZip(
  records: Array<{
    id: string;
    itemIndex: number;
    title: string;
    imageUrl: string;
    ossUrl?: string;
    cloudUrls?: Partial<Record<string, string>>;
    sourceStudio?: 'detail_studio' | 'sku_studio';
    batchTitle?: string;
    promptSnapshot?: string;
    createdAt?: string;
    aspectRatio?: string;
    imageSize?: string;
  }>,
  archiveName = 'EComStudio_历史成图批量导出'
): Promise<void> {
  if (records.length === 0) return;
  const zip = new JSZip();
  const folder = zip.folder(sanitizeFileName(archiveName)) || zip;

  const manifestLines: string[] = [
    `# ${archiveName} - 生成记录归档导出清单`,
    `导出时间：${new Date().toLocaleString('zh-CN')}`,
    `总计导出成图张数：${records.length} 张`,
    '',
    '## 成图明细与生图提示词归档',
    '',
  ];

  for (let i = 0; i < records.length; i++) {
    const rec = records[i];
    const paddedSeq = String(i + 1).padStart(2, '0');
    const paddedNum = String(rec.itemIndex || i + 1).padStart(2, '0');
    const studioTag =
      rec.sourceStudio === 'sku_studio'
        ? 'SKU'
        : rec.sourceStudio === 'detail_studio'
          ? '详情'
          : '成片';
    const safeTitle = sanitizeFileName(rec.title || `${studioTag}_${paddedNum}`);
    const ratioTag = rec.aspectRatio ? `_${rec.aspectRatio.replace(':', 'x')}` : '';
    const sizeTag = rec.imageSize ? `_${rec.imageSize}` : '';
    const fileName = `${paddedSeq}_${studioTag}_${safeTitle}${ratioTag}${sizeTag}.png`;

    const fallbackCloudUrl =
      rec.ossUrl ||
      rec.cloudUrls?.cloudflare_r2 ||
      rec.cloudUrls?.aliyun_oss;

    await addImageUrlToZipFolder(
      folder,
      fileName,
      rec.imageUrl,
      fallbackCloudUrl
    );

    manifestLines.push(`### ${paddedSeq}. [${studioTag}] ${rec.title || safeTitle}`);
    manifestLines.push(`- 导出文件名：\`${fileName}\``);
    if (rec.batchTitle) {
      manifestLines.push(`- 所属批次：${rec.batchTitle}`);
    }
    if (rec.aspectRatio || rec.imageSize) {
      manifestLines.push(
        `- 画面规格：比例 ${rec.aspectRatio || '1:1'} | 分辨率 ${rec.imageSize || '1K'}`
      );
    }
    if (rec.createdAt) {
      manifestLines.push(`- 生成时间：${rec.createdAt}`);
    }
    if (fallbackCloudUrl) {
      manifestLines.push(`- 云端归档直链：${fallbackCloudUrl}`);
    }
    if (rec.promptSnapshot) {
      manifestLines.push(`- 生图提示词快照：\n${rec.promptSnapshot}`);
    }
    manifestLines.push('');
  }

  folder.file('00_生图记录归档清单.md', manifestLines.join('\n'));

  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${sanitizeFileName(archiveName)}_${records.length}张.zip`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export async function exportSkuTasksAsZip(
  skuTasks: SkuTask[],
  projectName = '电商SKU规格图全套成片',
  referenceInfoText = ''
): Promise<void> {
  const completedTasks = skuTasks
    .filter((t) => t.status === 'completed' && (t.resultImageUrl || t.resultOssUrl))
    .sort((a, b) => a.skuIndex - b.skuIndex);

  if (completedTasks.length === 0) {
    throw new Error('暂无已生成完毕的 SKU 规格图可供打包下载。');
  }

  const zip = new JSZip();
  const folder = zip.folder(sanitizeFileName(projectName)) || zip;

  const manifestLines: string[] = [
    `# ${projectName} - 批量 SKU 规格图交付清单`,
    `导出时间：${new Date().toLocaleString('zh-CN')}`,
    `总计完成 SKU 张数：${completedTasks.length} 张`,
    '',
  ];

  if (referenceInfoText && referenceInfoText.trim()) {
    manifestLines.push('## 一、全局产品参考信息（卖点/功能/规格说明）');
    manifestLines.push(referenceInfoText.trim());
    manifestLines.push('');
    manifestLines.push('---');
    manifestLines.push('');
  }

  manifestLines.push('## 二、各 SKU 规格图参数与排版明细');
  manifestLines.push('');

  for (const task of completedTasks) {
    const paddedNum = String(task.skuIndex).padStart(2, '0');
    const safeTitle = sanitizeFileName(task.skuTitle || `SKU_${paddedNum}`);
    const fileName = `SKU_${paddedNum}_${safeTitle}_${task.aspectRatio.replace(':', 'x')}_${task.imageSize}.png`;

    await addImageUrlToZipFolder(
      folder,
      fileName,
      task.resultImageUrl,
      task.resultOssUrl
    );

    manifestLines.push(`### SKU #${paddedNum}: ${task.skuTitle}`);
    manifestLines.push(`- 卖点/功能角标：${task.sellingPointBadge || '无'}`);
    if (task.packageSpecNote) {
      manifestLines.push(`- 机型/包装说明：${task.packageSpecNote}`);
    }
    manifestLines.push(
      `- 规格参数：比例 ${task.aspectRatio} | 分辨率 ${task.imageSize} | 文字模式：${
        task.textMode === 'with_text' ? '含文字排版直出' : '无文字纯视觉底图'
      }`
    );
    if (task.resultOssUrl) {
      manifestLines.push(`- 阿里云 OSS 云端直链：${task.resultOssUrl}`);
    }
    manifestLines.push(`- 视觉构图提示词：${task.visualPrompt}`);
    manifestLines.push(`- 文案排版规划：\n${task.typographyPlan}`);
    manifestLines.push('');
  }

  folder.file('00_全套SKU规格图设计清单.md', manifestLines.join('\n'));

  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${sanitizeFileName(projectName)}_${completedTasks.length}张SKU成片.zip`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export async function exportTasksAsZip(
  tasks: ScreenTask[],
  projectName = '电商详情页全套成片',
  fullPlanDoc = ''
): Promise<void> {
  const completedTasks = tasks
    .filter((t) => t.status === 'completed' && (t.resultImageUrl || t.resultOssUrl))
    .sort((a, b) => a.screenNumber - b.screenNumber);

  if (completedTasks.length === 0) {
    throw new Error('暂无已生成完毕的分屏图片可供打包下载。');
  }

  const zip = new JSZip();
  const folder = zip.folder(sanitizeFileName(projectName)) || zip;

  const manifestLines: string[] = [
    `# ${projectName} - 全案设计与分屏生图交付清单`,
    `导出时间：${new Date().toLocaleString('zh-CN')}`,
    `总计完成张数：${completedTasks.length} 张`,
    '',
  ];

  if (fullPlanDoc && fullPlanDoc.trim()) {
    manifestLines.push('## 一、完整多屏淘宝详情页设计方案原文');
    manifestLines.push(fullPlanDoc.trim());
    manifestLines.push('');
    manifestLines.push('---');
    manifestLines.push('');
  }

  manifestLines.push('## 二、各分屏生图参数与文案排版规划明细');
  manifestLines.push('');

  for (const task of completedTasks) {
    const paddedNum = String(task.screenNumber).padStart(2, '0');
    const prefix = task.screenCategory === 'main' ? '主图' : '详情屏';
    const safeTitle = sanitizeFileName(task.title || `${prefix}_${paddedNum}`);
    const fileName = `${paddedNum}_${prefix}_${safeTitle}_${task.aspectRatio.replace(':', 'x')}_${task.imageSize}.png`;

    await addImageUrlToZipFolder(
      folder,
      fileName,
      task.resultImageUrl,
      task.resultOssUrl
    );

    manifestLines.push(`### ${paddedNum}. [${prefix}] ${task.title}`);
    manifestLines.push(`- 模块定位：${task.sectionType}`);
    if (task.benchmarkCase) {
      manifestLines.push(`- 对标案例：${task.benchmarkCase}`);
    }
    manifestLines.push(
      `- 规格参数：比例 ${task.aspectRatio} | 分辨率 ${task.imageSize} | 文字模式：${
        task.textMode === 'with_text' ? '含文字排版直出' : '无文字纯视觉底图'
      }`
    );
    if (task.resultOssUrl) {
      manifestLines.push(`- 阿里云 OSS 云端归档直链：${task.resultOssUrl}`);
    }
    manifestLines.push(`- 视觉场景与产品构图提示词：${task.visualPrompt}`);
    manifestLines.push(`- 文案排版规划：\n${task.typographyPlan || task.copywriting}`);
    manifestLines.push('');
  }

  folder.file('00_详情页完整设计方案与提示词清单.md', manifestLines.join('\n'));

  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${sanitizeFileName(projectName)}_${completedTasks.length}张高清成片.zip`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

const MAX_SAFE_CANVAS_HEIGHT = 16384;

/**
 * Seamlessly stitches all completed screen images vertically into a single
 * high-resolution e-commerce detail page long image (PNG).
 * Includes automatic canvas height ceiling protection (16,384px) so browsers never return blank data URLs.
 */
export async function stitchLongDetailPageImage(
  tasks: ScreenTask[],
  targetWidth = 1080
): Promise<string> {
  const completedTasks = tasks
    .filter((t) => t.status === 'completed' && (t.resultImageUrl || t.resultOssUrl))
    .sort((a, b) => a.screenNumber - b.screenNumber);

  if (completedTasks.length === 0) {
    throw new Error('暂无已生成的分屏图片可供拼接长图。');
  }

  const loadedImages: HTMLImageElement[] = await Promise.all(
    completedTasks.map(async (task) => {
      const rawSrc = (task.resultImageUrl || task.resultOssUrl || '').trim();
      let safeSrc = rawSrc;
      let tempObjUrl: string | null = null;
      if (/^https?:\/\//i.test(rawSrc)) {
        try {
          const resp = await fetch(rawSrc);
          if (resp.ok) {
            const blob = await resp.blob();
            tempObjUrl = URL.createObjectURL(blob);
            safeSrc = tempObjUrl;
          }
        } catch {
          // Fallback to crossOrigin anonymous
        }
      }
      return new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          if (tempObjUrl) URL.revokeObjectURL(tempObjUrl);
          resolve(img);
        };
        img.onerror = () => {
          if (tempObjUrl) URL.revokeObjectURL(tempObjUrl);
          reject(new Error(`加载第 ${task.screenNumber} 屏图片失败`));
        };
        img.src = safeSrc;
      });
    })
  );

  const rawHeights = loadedImages.map((img) =>
    Math.round(
      ((img.naturalHeight || 1) / Math.max(1, img.naturalWidth || 1)) *
        targetWidth
    )
  );
  const rawTotalHeight = rawHeights.reduce((sum, h) => sum + h, 0);

  // Guard against browser HTMLCanvasElement maximum height limit (16,384px)
  const safetyScale =
    rawTotalHeight > MAX_SAFE_CANVAS_HEIGHT
      ? MAX_SAFE_CANVAS_HEIGHT / rawTotalHeight
      : 1;
  const finalWidth = Math.max(320, Math.round(targetWidth * safetyScale));
  const scaledHeights = rawHeights.map((h) =>
    Math.max(1, Math.round(h * safetyScale))
  );
  const totalHeight = scaledHeights.reduce((sum, h) => sum + h, 0);

  const canvas = document.createElement('canvas');
  canvas.width = finalWidth;
  canvas.height = totalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('无法创建长图拼接画布。');
  }

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, finalWidth, totalHeight);

  let currentY = 0;
  for (let i = 0; i < loadedImages.length; i++) {
    const img = loadedImages[i];
    const h = scaledHeights[i];
    ctx.drawImage(img, 0, currentY, finalWidth, h);
    currentY += h;
  }

  const outDataUrl = canvas.toDataURL('image/png');
  if (!outDataUrl || outDataUrl === 'data:,') {
    return canvas.toDataURL('image/jpeg', 0.92);
  }
  return outDataUrl;
}
