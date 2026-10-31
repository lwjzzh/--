import React, { useState, useEffect, useRef } from 'react';
import {
  Scissors,
  Crop,
  Maximize2,
  AlertTriangle,
  CheckCircle2,
  X,
  Loader2,
  Sparkles,
  MoveVertical,
  Wand2,
  Check,
} from 'lucide-react';
import { OversizedImageCandidate } from '../types';
import {
  MAX_SAFE_IMAGE_DIMENSION,
  MAX_LONG_IMAGE_SLICE_COUNT,
  SlicedSegmentResult,
  buildUniformCutPercents,
  detectSmartSeamCutPercents,
  sliceOversizedImageByCustomCuts,
  cropOversizedImageRange,
  normalizeUploadedImageHighRes,
} from '../utils/imagePreprocessor';

export interface CompletedSliceSegment extends SlicedSegmentResult {
  customTag?: string;
}

export interface LongImageCompleteOptions {
  isLongPageSlice?: boolean;
  autoSyncScreenCount?: boolean;
}

interface LongImageHelperModalProps {
  candidate: OversizedImageCandidate;
  remainingCount: number;
  ossEnabled: boolean;
  onCompleteSegments: (
    segments: CompletedSliceSegment[],
    candidate: OversizedImageCandidate,
    options?: LongImageCompleteOptions
  ) => Promise<void>;
  onSkip: (candidate: OversizedImageCandidate) => void;
}

export const LongImageHelperModal: React.FC<LongImageHelperModalProps> = ({
  candidate,
  remainingCount,
  ossEnabled,
  onCompleteSegments,
  onSkip,
}) => {
  const [mode, setMode] = useState<'slice' | 'crop' | 'scale'>('slice');
  const [sliceCount, setSliceCount] = useState<number>(
    Math.min(MAX_LONG_IMAGE_SLICE_COUNT, Math.max(2, candidate.recommendedSliceCount || 8))
  );
  const [cutStrategy, setCutStrategy] = useState<'smart_seam' | 'uniform'>('smart_seam');
  const [cutPercents, setCutPercents] = useState<number[]>(() =>
    buildUniformCutPercents(Math.min(MAX_LONG_IMAGE_SLICE_COUNT, Math.max(2, candidate.recommendedSliceCount || 8)))
  );
  const [overlapPx, setOverlapPx] = useState<number>(30);
  const [cropStartPct, setCropStartPct] = useState<number>(0);
  const [cropEndPct, setCropEndPct] = useState<number>(
    Math.min(100, Math.round((MAX_SAFE_IMAGE_DIMENSION / Math.max(candidate.width, candidate.height)) * 100))
  );
  const [isDetectingSeams, setIsDetectingSeams] = useState<boolean>(false);
  const [liveSegments, setLiveSegments] = useState<SlicedSegmentResult[]>([]);
  const [excludedIndices, setExcludedIndices] = useState<Set<number>>(new Set());
  const [segmentCustomTags, setSegmentCustomTags] = useState<Record<number, string>>({});
  const isVertical = candidate.height >= candidate.width;
  const estSegmentHeight = isVertical
    ? Math.round((candidate.height + overlapPx * (sliceCount - 1)) / sliceCount)
    : candidate.height;
  const estSegmentWidth = !isVertical
    ? Math.round((candidate.width + overlapPx * (sliceCount - 1)) / sliceCount)
    : candidate.width;

  // Determine if each slice still spans multiple vertical screens (e.g. > 2.15x width)
  const isCoarseMultiScreenSlice =
    isVertical && estSegmentHeight > Math.max(1, candidate.width) * 2.15;
  const estSubScreensPerSlice = isVertical
    ? Math.max(1, Math.round(estSegmentHeight / (Math.max(1, candidate.width) * 1.65)))
    : 1;

  const [autoSyncScreenCount, setAutoSyncScreenCount] = useState<boolean>(
    candidate.targetTag === 'case' &&
      candidate.targetStudio !== 'sku_studio' &&
      !isCoarseMultiScreenSlice
  );
  const [draggingCutIdx, setDraggingCutIdx] = useState<number | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const previewImageContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (candidate.recommendedSliceCount) {
      const nextCount = Math.min(
        MAX_LONG_IMAGE_SLICE_COUNT,
        Math.max(2, candidate.recommendedSliceCount)
      );
      setSliceCount(nextCount);
    }
  }, [candidate.id, candidate.recommendedSliceCount]);

  useEffect(() => {
    if (candidate.targetTag === 'case' && candidate.targetStudio !== 'sku_studio') {
      setAutoSyncScreenCount(!isCoarseMultiScreenSlice);
    }
  }, [isCoarseMultiScreenSlice, candidate.targetTag, candidate.targetStudio]);

  const croppedPixelHeight = isVertical
    ? Math.round((candidate.height * Math.max(5, cropEndPct - cropStartPct)) / 100)
    : candidate.height;
  const croppedPixelWidth = !isVertical
    ? Math.round((candidate.width * Math.max(5, cropEndPct - cropStartPct)) / 100)
    : candidate.width;

  // Automatically calculate smart seams or uniform cuts when sliceCount or cutStrategy changes
  useEffect(() => {
    let cancelled = false;
    const runSeamCompute = async () => {
      setExcludedIndices(new Set());
      if (cutStrategy === 'smart_seam' && isVertical) {
        setIsDetectingSeams(true);
        try {
          const detected = await detectSmartSeamCutPercents(candidate, sliceCount);
          if (!cancelled) {
            setCutPercents(detected);
          }
        } catch {
          if (!cancelled) {
            setCutPercents(buildUniformCutPercents(sliceCount));
          }
        } finally {
          if (!cancelled) {
            setIsDetectingSeams(false);
          }
        }
      } else {
        setCutPercents(buildUniformCutPercents(sliceCount));
      }
    };
    runSeamCompute();
    return () => {
      cancelled = true;
    };
  }, [candidate, sliceCount, cutStrategy, isVertical]);

  // Debounced live preview slicing whenever cutPercents or overlapPx change
  useEffect(() => {
    if (mode !== 'slice') return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const segs = await sliceOversizedImageByCustomCuts(candidate, cutPercents, overlapPx);
        if (!cancelled) {
          setLiveSegments(segs);
        }
      } catch (err) {
        console.warn('Live segment preview failed:', err);
      }
    }, 140);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [candidate, cutPercents, overlapPx, mode]);

  // Handle mouse dragging of cut lines on the preview image
  useEffect(() => {
    if (draggingCutIdx === null) return;

    const handlePointerMove = (e: PointerEvent) => {
      const container = previewImageContainerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      if (rect.height <= 0 || rect.width <= 0) return;

      const rawPct = isVertical
        ? ((e.clientY - rect.top) / rect.height) * 100
        : ((e.clientX - rect.left) / rect.width) * 100;

      setCutPercents((prev) => {
        const next = [...prev];
        const minBound = draggingCutIdx > 0 ? next[draggingCutIdx - 1] + 2.5 : 3;
        const maxBound = draggingCutIdx < next.length - 1 ? next[draggingCutIdx + 1] - 2.5 : 97;
        const clamped = Number(Math.max(minBound, Math.min(maxBound, rawPct)).toFixed(2));
        next[draggingCutIdx] = clamped;
        return next;
      });
    };

    const handlePointerUp = () => {
      setDraggingCutIdx(null);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [draggingCutIdx, isVertical]);

  const toggleExcludeSegment = (idx: number) => {
    setExcludedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) {
        next.delete(idx);
      } else {
        // Always keep at least 1 segment selected
        if (liveSegments.length - next.size <= 1) return prev;
        next.add(idx);
      }
      return next;
    });
  };

  const selectedSegmentCount = Math.max(1, (liveSegments.length || sliceCount) - excludedIndices.size);

  const handleConfirm = async () => {
    setIsProcessing(true);
    try {
      if (mode === 'slice') {
        const rawSegments =
          liveSegments.length === cutPercents.length + 1
            ? liveSegments
            : await sliceOversizedImageByCustomCuts(candidate, cutPercents, overlapPx);

        const filtered = rawSegments.filter((_, idx) => !excludedIndices.has(idx));
        const finalTotal = filtered.length;
        const baseName = candidate.name.replace(/\.[^.]+$/, '');

        const enrichedSegments: CompletedSliceSegment[] = filtered.map((seg, newIdx) => {
          const origIdx = seg.sliceIndex - 1;
          const userTag = (segmentCustomTags[origIdx] || '').trim();
          const finalTag =
            userTag ||
            (candidate.targetTag === 'case'
              ? `竞品第${newIdx + 1}屏`
              : `分屏#${newIdx + 1}`);
          return {
            ...seg,
            name: `${baseName}_第${newIdx + 1}屏(共${finalTotal}屏).jpg`,
            sliceIndex: newIdx + 1,
            sliceTotal: finalTotal,
            customTag: finalTag,
          };
        });

        await onCompleteSegments(enrichedSegments, candidate, {
          isLongPageSlice: true,
          autoSyncScreenCount:
            candidate.targetTag === 'case' &&
            candidate.targetStudio !== 'sku_studio' &&
            autoSyncScreenCount,
        });
      } else if (mode === 'crop') {
        const cropped = await cropOversizedImageRange(candidate, cropStartPct, cropEndPct);
        await onCompleteSegments([cropped], candidate, { isLongPageSlice: false });
      } else {
        const normalized = await normalizeUploadedImageHighRes(candidate.file, {
          ossEnabled: true,
          maxDimensionOverride: MAX_SAFE_IMAGE_DIMENSION,
          qualityOverride: 0.93,
        });
        await onCompleteSegments(
          [
            {
              index: 1,
              name: candidate.name,
              dataUrl: normalized.dataUrl,
              width: normalized.width,
              height: normalized.height,
              sliceIndex: 1,
              sliceTotal: 1,
              startPct: 0,
              endPct: 100,
            },
          ],
          candidate,
          { isLongPageSlice: false }
        );
      }
    } finally {
      setIsProcessing(false);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isProcessing && draggingCutIdx === null) {
        onSkip(candidate);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [candidate, isProcessing, draggingCutIdx, onSkip]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/65 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-6xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-3.5 bg-amber-50/90 border-b border-amber-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-sm shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold text-slate-900">
                  检测到超长详情参考图（支持智能寻缝切屏 + 鼠标拖拽微调 + 逐屏剔除冗余屏）
                </h3>
                {remainingCount > 1 && (
                  <span className="px-2 py-0.5 text-xs font-semibold bg-amber-200/80 text-amber-900 rounded-md tabular-nums">
                    待处理队列: 剩余 {remainingCount} 张
                  </span>
                )}
              </div>
              <p className="text-xs text-amber-800 mt-0.5">
                当前长图 <span className="font-semibold">{candidate.name}</span> 原始尺寸为{' '}
                <span className="font-mono font-bold tabular-nums">
                  {candidate.width} × {candidate.height} px
                </span>
                。按屏切分后，大模型可逐屏 1:1 逆向竞品版式骨架，彻底避免长图被压缩成马赛克。
              </p>
            </div>
          </div>
          <button
            onClick={() => onSkip(candidate)}
            disabled={isProcessing}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-white/60 transition-colors cursor-pointer"
            title="跳过此图"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left Preview Column with Interactive Draggable Cut Lines */}
          <div className="lg:col-span-5 flex flex-col bg-slate-900 rounded-xl p-3 border border-slate-800 overflow-hidden">
            <div className="flex items-center justify-between text-xs text-slate-300 mb-2 pb-2 border-b border-slate-800">
              <div className="flex items-center gap-1.5">
                <MoveVertical className="w-3.5 h-3.5 text-blue-400" />
                <span>长图切分预览（可直接上下拖动蓝线微调）</span>
              </div>
              <span className="font-mono tabular-nums text-amber-400">
                {candidate.width} × {candidate.height} px
              </span>
            </div>

            <div className="relative flex-1 min-h-[340px] max-h-[520px] overflow-y-auto flex items-start justify-center bg-slate-950/90 rounded-lg p-3 select-none">
              <div ref={previewImageContainerRef} className="relative inline-block max-w-full">
                <img
                  src={candidate.previewUrl}
                  alt={candidate.name}
                  draggable={false}
                  className="max-w-full h-auto rounded border border-slate-700 block select-none"
                />

                {/* Screen Number Watermarks & Excluded Overlay */}
                {mode === 'slice' &&
                  isVertical &&
                  [0, ...cutPercents].map((startP, segIdx) => {
                    const endP = segIdx < cutPercents.length ? cutPercents[segIdx] : 100;
                    const heightP = Math.max(1, endP - startP);
                    const isExcluded = excludedIndices.has(segIdx);
                    return (
                      <div
                        key={`seg-zone-${segIdx}`}
                        style={{ top: `${startP}%`, height: `${heightP}%` }}
                        onClick={() => toggleExcludeSegment(segIdx)}
                        title={isExcluded ? '点击恢复此屏' : '点击剔除此屏（如资质/工厂/售后等无需参考的屏）'}
                        className={`absolute left-0 right-0 transition-colors cursor-pointer ${
                          isExcluded
                            ? 'bg-rose-950/70 backdrop-grayscale'
                            : 'hover:bg-blue-500/10'
                        }`}
                      >
                        <div className="absolute top-1.5 left-1.5 flex items-center gap-1 pointer-events-none">
                          <span
                            className={`px-1.5 py-0.5 text-[10px] font-bold rounded shadow ${
                              isExcluded
                                ? 'bg-rose-600 text-white line-through'
                                : 'bg-slate-900/85 text-blue-300 border border-blue-500/40'
                            }`}
                          >
                            {isExcluded ? `已剔除 #${segIdx + 1}` : `第 ${segIdx + 1} 屏`}
                          </span>
                        </div>
                      </div>
                    );
                  })}

                {/* Interactive Draggable Slice Lines Overlay */}
                {mode === 'slice' &&
                  cutPercents.map((pct, idx) =>
                    isVertical ? (
                      <div
                        key={`cut-${idx}`}
                        style={{ top: `${pct}%` }}
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          setDraggingCutIdx(idx);
                        }}
                        className={`absolute left-0 right-0 h-5 -translate-y-2.5 z-20 flex items-center justify-end pr-1.5 cursor-ns-resize group`}
                      >
                        <div
                          className={`w-full border-t-2 border-dashed transition-colors ${
                            draggingCutIdx === idx
                              ? 'border-amber-400 bg-amber-400/30 h-1.5'
                              : 'border-blue-400 group-hover:border-amber-300 bg-blue-500/20'
                          }`}
                        />
                        <span
                          className={`absolute right-1.5 px-1.5 py-0.5 text-[10px] text-white font-mono rounded shadow flex items-center gap-1 ${
                            draggingCutIdx === idx
                              ? 'bg-amber-500 scale-105'
                              : 'bg-blue-600 group-hover:bg-blue-500'
                          }`}
                        >
                          <MoveVertical className="w-2.5 h-2.5" />
                          切线#{idx + 1} ({Math.round((candidate.height * pct) / 100)}px)
                        </span>
                      </div>
                    ) : (
                      <div
                        key={`cut-${idx}`}
                        style={{ left: `${pct}%` }}
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          setDraggingCutIdx(idx);
                        }}
                        className="absolute top-0 bottom-0 border-l-2 border-dashed border-blue-400 bg-blue-500/20 w-3 -translate-x-1.5 cursor-ew-resize z-20"
                      />
                    )
                  )}

                {/* Visual Crop Box Overlay */}
                {mode === 'crop' && isVertical && (
                  <>
                    <div
                      style={{ height: `${cropStartPct}%` }}
                      className="absolute top-0 left-0 right-0 bg-black/70 pointer-events-none"
                    />
                    <div
                      style={{ top: `${cropStartPct}%`, height: `${Math.max(5, cropEndPct - cropStartPct)}%` }}
                      className="absolute left-0 right-0 border-2 border-emerald-400 bg-emerald-500/10 pointer-events-none flex items-center justify-center"
                    >
                      <span className="px-2 py-0.5 bg-emerald-600 text-white text-[11px] font-mono rounded shadow">
                        保留区域 ({croppedPixelWidth}×{croppedPixelHeight}px)
                      </span>
                    </div>
                    <div
                      style={{ top: `${cropEndPct}%`, height: `${100 - cropEndPct}%` }}
                      className="absolute left-0 right-0 bg-black/70 pointer-events-none"
                    />
                  </>
                )}
              </div>
            </div>

            <div className="mt-2 pt-2 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
              <span>提示：点击左侧画面任意分屏可快速剔除/恢复该屏</span>
              <span className={ossEnabled ? 'text-emerald-400 font-medium' : 'text-amber-400 font-medium'}>
                {ossEnabled ? 'OSS 原画直传已启用' : '本地高清模式'}
              </span>
            </div>
          </div>

          {/* Right Action Options & Live Sliced Screens Selector */}
          <div className="lg:col-span-7 flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              {/* Mode Tabs */}
              <div className="grid grid-cols-3 gap-2.5">
                <button
                  type="button"
                  onClick={() => setMode('slice')}
                  className={`p-3 rounded-xl border-2 text-left transition-all cursor-pointer ${
                    mode === 'slice'
                      ? 'border-blue-600 bg-blue-50/60 shadow-sm'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                        mode === 'slice' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      <Scissors className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900">智能切分多屏</div>
                      <div className="text-[10px] text-blue-600 font-semibold">强烈推荐 · 逐屏1:1拆解</div>
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setMode('crop')}
                  className={`p-3 rounded-xl border-2 text-left transition-all cursor-pointer ${
                    mode === 'crop'
                      ? 'border-emerald-600 bg-emerald-50/50 shadow-sm'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                        mode === 'crop' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      <Crop className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900">截取局部区间</div>
                      <div className="text-[10px] text-slate-500">只保留单段核心画面</div>
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setMode('scale')}
                  className={`p-3 rounded-xl border-2 text-left transition-all cursor-pointer ${
                    mode === 'scale'
                      ? 'border-slate-800 bg-slate-50 shadow-sm'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                        mode === 'scale' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      <Maximize2 className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900">整张缩放导入</div>
                      <div className="text-[10px] text-slate-500">仅适合参考整体色调</div>
                    </div>
                  </div>
                </button>
              </div>

              {/* Mode 1: Smart Slicing Controls + Live Screen Grid */}
              {mode === 'slice' && (
                <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/30 space-y-3.5">
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                    <div className="sm:col-span-5">
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-semibold text-slate-700">
                          总切分屏数：<span className="font-mono font-bold text-blue-600">{sliceCount} 屏</span>
                        </label>
                        <span className="text-[11px] text-slate-400 font-mono">
                          均高≈{estSegmentHeight}px
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="range"
                          min={2}
                          max={MAX_LONG_IMAGE_SLICE_COUNT}
                          value={sliceCount}
                          onChange={(e) => setSliceCount(Number(e.target.value))}
                          className="flex-1 accent-blue-600"
                        />
                        <input
                          type="number"
                          min={2}
                          max={MAX_LONG_IMAGE_SLICE_COUNT}
                          value={sliceCount}
                          onChange={(e) =>
                            setSliceCount(
                              Math.min(MAX_LONG_IMAGE_SLICE_COUNT, Math.max(2, Number(e.target.value) || 2))
                            )
                          }
                          className="w-14 px-1.5 py-1 text-xs font-mono font-bold text-center bg-white border border-slate-300 rounded-md"
                        />
                      </div>
                    </div>

                    <div className="sm:col-span-4">
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        切屏寻缝方式
                      </label>
                      <div className="grid grid-cols-2 gap-1 bg-slate-200/70 p-0.5 rounded-lg">
                        <button
                          type="button"
                          onClick={() => setCutStrategy('smart_seam')}
                          className={`px-2 py-1 text-[11px] font-semibold rounded-md flex items-center justify-center gap-1 transition-all cursor-pointer ${
                            cutStrategy === 'smart_seam'
                              ? 'bg-white text-blue-600 shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          <Wand2 className="w-3 h-3" />
                          智能寻缝
                        </button>
                        <button
                          type="button"
                          onClick={() => setCutStrategy('uniform')}
                          className={`px-2 py-1 text-[11px] font-semibold rounded-md flex items-center justify-center gap-1 transition-all cursor-pointer ${
                            cutStrategy === 'uniform'
                              ? 'bg-white text-blue-600 shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          等距均分
                        </button>
                      </div>
                    </div>

                    <div className="sm:col-span-3">
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        防断字重叠: <span className="font-mono text-blue-600">{overlapPx}px</span>
                      </label>
                      <input
                        type="range"
                        min={0}
                        max={160}
                        step={10}
                        value={overlapPx}
                        onChange={(e) => setOverlapPx(Number(e.target.value))}
                        className="w-full accent-blue-600"
                      />
                    </div>
                  </div>

                  {/* Live Sliced Screens Preview Grid */}
                  <div className="bg-white rounded-xl border border-slate-200 p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-800">
                          切分后各屏预览与选屏（共 {liveSegments.length || sliceCount} 屏，已勾选导入{' '}
                          <span className="text-blue-600 font-mono">{selectedSegmentCount}</span> 屏）
                        </span>
                        {isDetectingSeams && (
                          <span className="text-[11px] text-blue-600 flex items-center gap-1">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            正在识别模块留白接缝...
                          </span>
                        )}
                      </div>
                      {excludedIndices.size > 0 && (
                        <button
                          type="button"
                          onClick={() => setExcludedIndices(new Set())}
                          className="text-[11px] text-blue-600 hover:underline font-medium cursor-pointer"
                        >
                          恢复全部 ({excludedIndices.size} 屏已剔除)
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2.5 max-h-[250px] overflow-y-auto pr-1">
                      {liveSegments.map((seg, idx) => {
                        const isExcluded = excludedIndices.has(idx);
                        const defaultLabel =
                          candidate.targetTag === 'case' ? `竞品第${idx + 1}屏` : `分屏#${idx + 1}`;
                        return (
                          <div
                            key={`seg-card-${idx}`}
                            className={`group relative rounded-lg border transition-all overflow-hidden flex flex-col ${
                              isExcluded
                                ? 'border-slate-200 bg-slate-50 opacity-50'
                                : 'border-blue-300 bg-white shadow-xs'
                            }`}
                          >
                            <div
                              onClick={() => toggleExcludeSegment(idx)}
                              className="relative h-24 bg-slate-900 flex items-center justify-center overflow-hidden cursor-pointer"
                            >
                              <img
                                src={seg.dataUrl}
                                alt={seg.name}
                                className="max-h-full max-w-full object-contain"
                              />
                              <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-slate-900/80 text-[10px] font-mono font-bold text-white">
                                #{idx + 1}
                              </div>
                              <div
                                className={`absolute top-1 right-1 w-4 h-4 rounded flex items-center justify-center border ${
                                  isExcluded
                                    ? 'bg-white/90 border-slate-300 text-transparent'
                                    : 'bg-blue-600 border-blue-600 text-white'
                                }`}
                              >
                                <Check className="w-3 h-3 stroke-[3]" />
                              </div>
                              <div className="absolute bottom-0 inset-x-0 bg-black/65 text-[9px] font-mono text-slate-200 text-center py-0.5">
                                {seg.width}×{seg.height}px
                              </div>
                            </div>
                            <div className="p-1.5 bg-white border-t border-slate-100">
                              <input
                                type="text"
                                value={segmentCustomTags[idx] ?? defaultLabel}
                                onChange={(e) =>
                                  setSegmentCustomTags((prev) => ({ ...prev, [idx]: e.target.value }))
                                }
                                disabled={isExcluded}
                                placeholder={defaultLabel}
                                className="w-full text-[11px] font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 focus:outline-none focus:border-blue-500"
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Auto-Sync Screen Count & 1:1 Screen Binding Option for #Case in Detail Studio */}
                  {candidate.targetTag === 'case' && candidate.targetStudio !== 'sku_studio' && (
                    <label
                      className={`flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl border cursor-pointer ${
                        isCoarseMultiScreenSlice
                          ? 'bg-amber-50/90 border-amber-200'
                          : 'bg-indigo-50/90 border-indigo-200'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={autoSyncScreenCount}
                          onChange={(e) => setAutoSyncScreenCount(e.target.checked)}
                          className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                        />
                        <div>
                          <div
                            className={`text-xs font-bold flex items-center gap-1.5 ${
                              isCoarseMultiScreenSlice ? 'text-amber-950' : 'text-indigo-950'
                            }`}
                          >
                            <Sparkles
                              className={`w-3.5 h-3.5 ${
                                isCoarseMultiScreenSlice ? 'text-amber-600' : 'text-indigo-600'
                              }`}
                            />
                            <span>
                              {isCoarseMultiScreenSlice
                                ? `检测到当前为「多屏合并长切片」（共 ${selectedSegmentCount} 张，每张约含 ${estSubScreensPerSlice} 个子屏）`
                                : `单屏精细切分：导入后将「详情页屏数」同步为 ${selectedSegmentCount} 屏并 1:1 对标`}
                            </span>
                          </div>
                          <div
                            className={`text-[11px] ${
                              isCoarseMultiScreenSlice ? 'text-amber-800' : 'text-indigo-700'
                            }`}
                          >
                            {isCoarseMultiScreenSlice
                              ? `建议保持不勾选（不强行把目标屏数改写为 ${selectedSegmentCount} 屏）；导入后点击「逐屏逆向版式」，模型将自动识别每张长切片内的多个子屏并弹窗供您确认总屏数`
                              : `让第 1~${selectedSegmentCount} 屏分别严格对应单屏切片的版式骨架，同时共享整页统一视觉规范`}
                          </div>
                        </div>
                      </div>
                    </label>
                  )}
                </div>
              )}

              {/* Mode 2: Interactive Crop */}
              {mode === 'crop' && (
                <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/30 space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        起点位置: <span className="font-mono font-bold tabular-nums">{cropStartPct}%</span>
                      </label>
                      <input
                        type="range"
                        min={0}
                        max={85}
                        value={cropStartPct}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setCropStartPct(val);
                          if (cropEndPct <= val + 5) setCropEndPct(Math.min(100, val + 20));
                        }}
                        className="w-full accent-emerald-600"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        终点位置: <span className="font-mono font-bold tabular-nums">{cropEndPct}%</span>
                      </label>
                      <input
                        type="range"
                        min={15}
                        max={100}
                        value={cropEndPct}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setCropEndPct(Math.max(cropStartPct + 5, val));
                        }}
                        className="w-full accent-emerald-600"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs bg-white px-3 py-2 rounded-lg border border-emerald-200">
                    <span className="text-slate-600">截取后像素尺寸:</span>
                    <span
                      className={`font-mono font-bold tabular-nums ${
                        Math.max(croppedPixelWidth, croppedPixelHeight) > MAX_SAFE_IMAGE_DIMENSION
                          ? 'text-amber-600'
                          : 'text-emerald-700'
                      }`}
                    >
                      {croppedPixelWidth} × {croppedPixelHeight} px
                      {Math.max(croppedPixelWidth, croppedPixelHeight) > MAX_SAFE_IMAGE_DIMENSION
                        ? ` (将自动微缩至 ${MAX_SAFE_IMAGE_DIMENSION}px)`
                        : ' (1:1 原画无损)'}
                    </span>
                  </div>
                </div>
              )}

              {/* Mode 3: Single Scaled High-Res */}
              {mode === 'scale' && (
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-600 space-y-1.5">
                  <div className="font-bold text-slate-800">
                    保持单张完整长图（以 {MAX_SAFE_IMAGE_DIMENSION}px 高清上限直传）
                  </div>
                  <p>
                    注意：对于高度超过 8000px 的详情长图，整张塞入大模型视觉窗口会导致每屏细节与小字被严重压缩，仅适合提取全局色彩氛围，不推荐用于精准还原每屏排版结构。
                  </p>
                </div>
              )}
            </div>

            {/* Footer Actions */}
            <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
              <button
                type="button"
                onClick={() => onSkip(candidate)}
                disabled={isProcessing}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                放弃导入此图
              </button>

              <button
                type="button"
                onClick={handleConfirm}
                disabled={isProcessing}
                className="btn-primary px-5 py-2.5 disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-sm flex items-center gap-2 transition-all cursor-pointer"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>正在切分高清分屏并同步...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>
                      {mode === 'slice'
                        ? `确认导入选中的 ${selectedSegmentCount} 屏高清参考图`
                        : mode === 'crop'
                        ? '确认截取选中区域并导入'
                        : `以 ${MAX_SAFE_IMAGE_DIMENSION}px 高清上限单张导入`}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
