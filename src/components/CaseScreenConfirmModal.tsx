import React, { useState, useMemo } from 'react';
import {
  CheckCircle2,
  Scissors,
  Sparkles,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Layers,
  X,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
} from 'lucide-react';
import {
  FlattenedLogicalScreenItem,
  ReferenceImageItem,
} from '../types';
import {
  expandFlattenedScreensToTargetCount,
  formatSubScreenRegionLabel,
} from '../utils/casePromptEngine';

interface CaseScreenConfirmModalProps {
  isOpen: boolean;
  caseRefs: ReferenceImageItem[];
  initialScreens: FlattenedLogicalScreenItem[];
  initialUnifiedVisualSpec: string;
  defaultTargetScreenCount: number;
  canResliceOriginal: boolean;
  originalCandidateName?: string;
  onClose: () => void;
  onConfirmGenerateTasks: (payload: {
    confirmedScreens: FlattenedLogicalScreenItem[];
    confirmedUnifiedSpec: string;
  }) => void;
  onRequestManualReslice: (desiredSliceCount: number) => void;
}

function recomputeSliceSubScreenPositions(
  list: FlattenedLogicalScreenItem[]
): FlattenedLogicalScreenItem[] {
  const countByCase = new Map<string, number>();
  for (const item of list) {
    countByCase.set(
      item.sourceCaseId,
      (countByCase.get(item.sourceCaseId) || 0) + 1
    );
  }

  const seenByCase = new Map<string, number>();
  return list.map((item, idx) => {
    const total = countByCase.get(item.sourceCaseId) || 1;
    const subIdx = (seenByCase.get(item.sourceCaseId) || 0) + 1;
    seenByCase.set(item.sourceCaseId, subIdx);
    return {
      ...item,
      screenNumber: idx + 1,
      subScreenIndex: subIdx,
      subScreenTotal: total,
      regionLabel: formatSubScreenRegionLabel(subIdx, total),
    };
  });
}

export const CaseScreenConfirmModal: React.FC<CaseScreenConfirmModalProps> = ({
  isOpen,
  caseRefs,
  initialScreens,
  initialUnifiedVisualSpec,
  defaultTargetScreenCount,
  canResliceOriginal,
  originalCandidateName,
  onClose,
  onConfirmGenerateTasks,
  onRequestManualReslice,
}) => {
  const [screens, setScreens] = useState<FlattenedLogicalScreenItem[]>(() =>
    recomputeSliceSubScreenPositions(initialScreens)
  );
  const [unifiedSpec, setUnifiedSpec] = useState<string>(
    initialUnifiedVisualSpec
  );
  const [showUnifiedSpecEditor, setShowUnifiedSpecEditor] =
    useState<boolean>(false);
  const [expandedDnaRowIdx, setExpandedDnaRowIdx] = useState<number | null>(
    null
  );
  const [desiredResliceCount, setDesiredResliceCount] = useState<number>(() =>
    Math.max(2, Math.min(20, defaultTargetScreenCount || initialScreens.length || 10))
  );

  const caseMap = useMemo(() => {
    const map = new Map<string, ReferenceImageItem>();
    for (const c of caseRefs) {
      map.set(c.id, c);
    }
    return map;
  }, [caseRefs]);

  if (!isOpen) return null;

  const handleTitleChange = (idx: number, newTitle: string) => {
    setScreens((prev) =>
      prev.map((item, i) =>
        i === idx
          ? {
              ...item,
              title: newTitle,
              sectionType: newTitle.split(/[·•\s]/)[0] || item.sectionType,
            }
          : item
      )
    );
  };

  const handleDnaChange = (idx: number, newDna: string) => {
    setScreens((prev) =>
      prev.map((item, i) =>
        i === idx ? { ...item, extractedLayoutDna: newDna } : item
      )
    );
  };

  const handleSourceCaseChange = (idx: number, newCaseId: string) => {
    const matched = caseMap.get(newCaseId);
    if (!matched) return;
    setScreens((prev) => {
      const updated = prev.map((item, i) =>
        i === idx
          ? {
              ...item,
              sourceCaseId: matched.id,
              sourceCaseCode: matched.code,
            }
          : item
      );
      return recomputeSliceSubScreenPositions(updated);
    });
  };

  const handleSplitSubScreenAfter = (idx: number) => {
    setScreens((prev) => {
      if (prev.length >= 20) return prev;
      const target = prev[idx];
      if (!target) return prev;
      const newSub: FlattenedLogicalScreenItem = {
        ...target,
        title: `${target.title.replace(/（.*）$/, '')}·下段卖点延展`,
        extractedLayoutDna: target.extractedLayoutDna,
      };
      const next = [
        ...prev.slice(0, idx + 1),
        newSub,
        ...prev.slice(idx + 1),
      ];
      return recomputeSliceSubScreenPositions(next);
    });
  };

  const handleRemoveScreen = (idx: number) => {
    setScreens((prev) => {
      if (prev.length <= 1) return prev;
      const next = prev.filter((_, i) => i !== idx);
      return recomputeSliceSubScreenPositions(next);
    });
  };

  const handleMoveScreen = (idx: number, direction: -1 | 1) => {
    setScreens((prev) => {
      const targetIdx = idx + direction;
      if (targetIdx < 0 || targetIdx >= prev.length) return prev;
      const next = [...prev];
      const temp = next[idx];
      next[idx] = next[targetIdx];
      next[targetIdx] = temp;
      return recomputeSliceSubScreenPositions(next);
    });
  };

  const handleQuickAlignScreenCount = (targetCount: number) => {
    const clamped = Math.max(1, Math.min(20, targetCount));
    setDesiredResliceCount(clamped);
    setScreens((prev) =>
      recomputeSliceSubScreenPositions(
        expandFlattenedScreensToTargetCount(prev, caseRefs, clamped)
      )
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden text-zinc-100">
        {/* Header */}
        <div className="px-5 py-4 border-b border-zinc-800 bg-zinc-950/60 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-300 shrink-0">
              <Layers className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-sm font-bold text-zinc-100">
                  竞品长图分屏识别结果与生成屏数确认
                </h2>
                <span className="text-xs font-mono tabular-nums text-amber-300">
                  已上传 {caseRefs.length} 张长图切片 → 识别拆解为 {screens.length} 个逻辑分屏
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                单张长切片内的多个子屏模块已按阅读顺序拆解。请确认各屏内容标题与总屏数；若屏数或切分位置不符预期，可直接修改或点击左下角重新手动按实际屏数精细切分。
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors cursor-pointer shrink-0"
            title="关闭窗口"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Top Control Bar: Quick Screen Count Alignment & Unified Visual Spec */}
        <div className="px-5 py-3 bg-zinc-900/90 border-b border-zinc-800/80 space-y-2.5 shrink-0">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-400" />
                快速对齐目标总屏数：
              </span>
              {[6, 8, 10, 12].map((presetNum) => (
                <button
                  key={presetNum}
                  type="button"
                  onClick={() => handleQuickAlignScreenCount(presetNum)}
                  className={`px-2.5 py-1 rounded-md text-xs font-mono tabular-nums font-semibold transition-all cursor-pointer border ${
                    screens.length === presetNum
                      ? 'bg-indigo-600 border-indigo-500 text-white shadow-xs'
                      : 'bg-zinc-800/80 border-zinc-700 text-zinc-300 hover:border-zinc-600 hover:text-white'
                  }`}
                >
                  {presetNum} 屏
                </button>
              ))}
              <div className="flex items-center gap-1 ml-1 bg-zinc-950 border border-zinc-800 rounded-md px-2 py-0.5">
                <span className="text-[11px] text-zinc-400">自定义:</span>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={screens.length}
                  onChange={(e) =>
                    handleQuickAlignScreenCount(Number(e.target.value) || 1)
                  }
                  className="w-12 text-center text-xs font-mono tabular-nums font-bold text-amber-300 bg-transparent focus:outline-none"
                />
                <span className="text-[11px] text-zinc-400">屏</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowUnifiedSpecEditor((prev) => !prev)}
              className="px-2.5 py-1 rounded-lg bg-zinc-800/80 hover:bg-zinc-800 border border-zinc-700 text-[11px] font-medium text-zinc-300 flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>整页统一视觉规范（已从切片提取）</span>
              {showUnifiedSpecEditor ? (
                <ChevronUp className="w-3.5 h-3.5 text-zinc-400" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
              )}
            </button>
          </div>

          {showUnifiedSpecEditor && (
            <div className="p-2.5 rounded-xl bg-zinc-950/90 border border-zinc-800 space-y-1">
              <div className="flex items-center justify-between text-[11px] text-zinc-400">
                <span>
                  整页统一视觉规范（用于约束全页所有分屏的展台材质语言、光影反差、主辅色调与字体排版层级）：
                </span>
              </div>
              <textarea
                rows={3}
                value={unifiedSpec}
                onChange={(e) => setUnifiedSpec(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700/80 text-xs text-zinc-200 focus:outline-none focus:border-indigo-500 leading-relaxed"
              />
            </div>
          )}
        </div>

        {/* Main Scrollable Screen List */}
        <div className="flex-1 overflow-y-auto p-5 space-y-2">
          {screens.map((item, idx) => {
            const boundCase = caseMap.get(item.sourceCaseId) || caseRefs[0];
            const isDnaOpen = expandedDnaRowIdx === idx;
            return (
              <div
                key={`confirm-screen-${idx}-${item.sourceCaseId}`}
                className="rounded-xl bg-zinc-950/70 border border-zinc-800/90 hover:border-zinc-700 transition-all p-3"
              >
                <div className="flex items-center gap-3">
                  {/* Screen Number */}
                  <div className="w-16 shrink-0 flex flex-col items-center justify-center py-1.5 px-2 rounded-lg bg-indigo-500/15 border border-indigo-500/30">
                    <span className="text-xs font-mono tabular-nums font-bold text-indigo-300">
                      第 {item.screenNumber} 屏
                    </span>
                    <span className="text-[10px] text-zinc-400 font-mono tabular-nums">
                      {idx + 1 <= 3 ? '⚡动态屏' : '🔒静态屏'}
                    </span>
                  </div>

                  {/* Source #Case Thumbnail & Sub-screen Region */}
                  {boundCase && (
                    <div className="flex items-center gap-2.5 shrink-0 bg-zinc-900/90 border border-zinc-800 rounded-lg p-1.5 pr-2.5">
                      <img
                        src={boundCase.previewUrl || boundCase.ossUrl}
                        alt={boundCase.code}
                        className="w-9 h-12 object-cover rounded border border-zinc-700 bg-zinc-950 shrink-0"
                      />
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5">
                          <select
                            value={item.sourceCaseId}
                            onChange={(e) =>
                              handleSourceCaseChange(idx, e.target.value)
                            }
                            className="bg-zinc-950 border border-zinc-700 rounded px-1.5 py-0.5 text-[11px] font-mono font-semibold text-amber-300 focus:outline-none focus:border-amber-400 cursor-pointer"
                          >
                            {caseRefs.map((c) => (
                              <option key={c.id} value={c.id}>
                                #{c.code}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="text-[10px] font-mono tabular-nums text-zinc-400">
                          {item.regionLabel}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Editable Screen Title & Layout Summary */}
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={item.title}
                        onChange={(e) => handleTitleChange(idx, e.target.value)}
                        placeholder={`请输入第 ${item.screenNumber} 屏内容标题`}
                        className="w-full px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700/80 text-xs font-semibold text-zinc-100 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[11px] text-zinc-400 truncate">
                        {item.extractedLayoutDna || '按选中维度提取本子屏版式骨架与视觉规范'}
                      </p>
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedDnaRowIdx(isDnaOpen ? null : idx)
                        }
                        className="text-[11px] text-indigo-400 hover:text-indigo-300 shrink-0 cursor-pointer"
                      >
                        {isDnaOpen ? '收起版式详情' : '编辑版式描述'}
                      </button>
                    </div>
                  </div>

                  {/* Row Action Buttons */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleSplitSubScreenAfter(idx)}
                      disabled={screens.length >= 20}
                      title="将当前切片拆出下一个子屏（在下方新增一屏）"
                      className="px-2 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/80 text-[11px] font-medium text-amber-300 flex items-center gap-1 cursor-pointer disabled:opacity-40 transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                      <span>拆分子屏</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMoveScreen(idx, -1)}
                      disabled={idx === 0}
                      title="上移此屏"
                      className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-zinc-200 disabled:opacity-30 cursor-pointer"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMoveScreen(idx, 1)}
                      disabled={idx === screens.length - 1}
                      title="下移此屏"
                      className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-zinc-200 disabled:opacity-30 cursor-pointer"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveScreen(idx)}
                      disabled={screens.length <= 1}
                      title="删除此屏"
                      className="p-1.5 rounded-lg bg-zinc-900 hover:bg-rose-950/60 border border-zinc-800 hover:border-rose-500/40 text-zinc-400 hover:text-rose-300 disabled:opacity-30 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {isDnaOpen && (
                  <div className="mt-2.5 pt-2.5 border-t border-zinc-800/80">
                    <label className="block text-[11px] text-zinc-400 mb-1">
                      第 {item.screenNumber} 屏逆向提取的版式骨架与内容结构描述：
                    </label>
                    <textarea
                      rows={2}
                      value={item.extractedLayoutDna}
                      onChange={(e) => handleDnaChange(idx, e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-xs text-zinc-200 focus:outline-none focus:border-indigo-500 leading-relaxed"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer: Dual Path (Path A: Manual Fine Re-slice | Path B: Confirm & Generate N Tasks) */}
        <div className="px-5 py-3.5 border-t border-zinc-800 bg-zinc-950/90 flex flex-wrap items-center justify-between gap-3 shrink-0">
          {/* Path A: Re-open manual fine slicer */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-1.5">
              <Scissors className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="text-xs text-amber-200">
                屏数或切分位置不符预期？按实际
              </span>
              <input
                type="number"
                min={2}
                max={20}
                value={desiredResliceCount}
                onChange={(e) =>
                  setDesiredResliceCount(
                    Math.max(2, Math.min(20, Number(e.target.value) || 10))
                  )
                }
                className="w-11 px-1 py-0.5 rounded bg-zinc-900 border border-amber-500/40 text-center text-xs font-mono tabular-nums font-bold text-amber-300 focus:outline-none"
              />
              <span className="text-xs text-amber-200">屏：</span>
              <button
                type="button"
                onClick={() => onRequestManualReslice(desiredResliceCount)}
                className="ml-1 px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                {canResliceOriginal
                  ? `重新手动精细切分原长图${originalCandidateName ? ` (${originalCandidateName.slice(0, 12)})` : ''}`
                  : '重新手动精细切分长图'}
              </button>
            </div>
          </div>

          {/* Path B: Confirm & Generate N Screen Tasks */}
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-zinc-300 transition-colors cursor-pointer whitespace-nowrap"
            >
              稍后调整
            </button>
            <button
              type="button"
              onClick={() =>
                onConfirmGenerateTasks({
                  confirmedScreens: screens,
                  confirmedUnifiedSpec: unifiedSpec,
                })
              }
              className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-sm flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span className="font-mono tabular-nums">
                确认无误，按序生成 {screens.length} 屏任务卡
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
