import React, { useState, useRef, useEffect } from 'react';
import {
  Plus,
  Trash2,
  RotateCcw,
  X,
  Upload,
  Download,
  LayoutList,
  Palette,
  BookmarkCheck,
  Cloud,
  CloudUpload,
  Settings,
  Loader2,
  ChevronDown,
  FolderKanban,
  Sparkles,
  Cpu,
  Check,
  ShieldCheck,
  Terminal,
  AlertCircle,
  CheckCircle2,
  Copy,
} from 'lucide-react';
import { ConfirmedMasterTemplate } from '../utils/masterTemplateDb';
import {
  ApiChannelProfile,
  ChannelMode,
  CloudStorageProvider,
  ModelPresetItem,
  ReferenceImageItem,
  RuntimeLogEntry,
  ScreenTask,
  SkuTask,
  isSyncedToProvider,
} from '../types';

export type TopWorkspaceTab = 'detail_studio' | 'sku_studio' | 'master_library';

export type GlobalSettingsTab =
  | 'presets_fallback'
  | 'channel_model'
  | 'model_presets'
  | 'oss_storage'
  | 'desktop_arch';

interface StudioTopHeaderProps {
  activeTopTab: TopWorkspaceTab;
  onSelectTopTab: (tab: TopWorkspaceTab) => void;
  // Project & Master Template Props
  selectedPresetId: string;
  confirmedTemplates: ConfirmedMasterTemplate[];
  onSelectPreset: (id: string) => void;
  showSaveMasterModal: boolean;
  setShowSaveMasterModal: React.Dispatch<React.SetStateAction<boolean>>;
  newMasterNameInput: string;
  setNewMasterNameInput: (val: string) => void;
  onSaveCurrentAsMasterTemplate: (e: React.FormEvent) => void;
  onDeleteConfirmedTemplate: (id: string) => void;
  onClearWorkspaceToBlank: (options?: { preserveCopy?: boolean }) => void;
  confirmBeforeReset?: boolean;
  defaultPreserveCopyOnReset?: boolean;
  masterTemplateFileInputRef: React.RefObject<HTMLInputElement | null>;
  onImportMasterTemplateFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onExportCurrentMasterTemplateFile: () => void;
  // Counts & Workspace state
  tasks: ScreenTask[];
  skuTasks: SkuTask[];
  referenceImages: ReferenceImageItem[];
  skuReferenceImages?: ReferenceImageItem[];
  fullPlanDoc: string;
  commonAssetsCount: number;
  generationRecordsCount: number;
  // Model Quick-Switch & Cloud Storage (OSS / R2) Status Props
  isOssReady: boolean;
  storageProvider?: CloudStorageProvider;
  onSwitchStorageProvider?: (provider: CloudStorageProvider) => void;
  isSyncingAllRefsToOss?: boolean;
  onSyncAllReferencesToOss?: () => void;
  activeChannelMode: ChannelMode;
  activeChannelId: string;
  channels: ApiChannelProfile[];
  agentModel: string;
  enableHighThinking: boolean;
  imageModel: string;
  agentModelPresets: ModelPresetItem[];
  imageModelPresets: ModelPresetItem[];
  shortAgentLabel: string;
  shortImageLabel: string;
  onQuickSelectChannel: (channelId: string) => void;
  onQuickSelectAgentModel: (modelId: string) => void;
  onQuickToggleHighThinking: () => void;
  onQuickSelectImageModel: (modelId: string) => void;
  onOpenApiModal: (tab: GlobalSettingsTab) => void;
  // Runtime Log Props
  runtimeLogs?: RuntimeLogEntry[];
  onClearRuntimeLogs?: () => void;
  onMarkRuntimeLogsRead?: () => void;
  onCopyLogText?: (text: string) => void;
}

export const StudioTopHeader: React.FC<StudioTopHeaderProps> = ({
  activeTopTab,
  onSelectTopTab,
  selectedPresetId,
  confirmedTemplates,
  onSelectPreset,
  showSaveMasterModal,
  setShowSaveMasterModal,
  newMasterNameInput,
  setNewMasterNameInput,
  onSaveCurrentAsMasterTemplate,
  onDeleteConfirmedTemplate,
  onClearWorkspaceToBlank,
  confirmBeforeReset = true,
  defaultPreserveCopyOnReset = false,
  masterTemplateFileInputRef,
  onImportMasterTemplateFile,
  onExportCurrentMasterTemplateFile,
  tasks,
  skuTasks,
  referenceImages,
  skuReferenceImages = [],
  fullPlanDoc,
  commonAssetsCount,
  generationRecordsCount,
  isOssReady,
  storageProvider = 'aliyun_oss',
  onSwitchStorageProvider,
  isSyncingAllRefsToOss = false,
  onSyncAllReferencesToOss,
  activeChannelId,
  channels,
  agentModel,
  enableHighThinking,
  imageModel,
  agentModelPresets,
  imageModelPresets,
  shortAgentLabel,
  shortImageLabel,
  onQuickSelectChannel,
  onQuickSelectAgentModel,
  onQuickToggleHighThinking,
  onQuickSelectImageModel,
  onOpenApiModal,
  runtimeLogs = [],
  onClearRuntimeLogs,
  onMarkRuntimeLogsRead,
  onCopyLogText,
}) => {
  const [showLogPopover, setShowLogPopover] = useState(false);
  const [logFilter, setLogFilter] = useState<'all' | 'error' | 'detail' | 'sku'>('all');
  const [showModelPopover, setShowModelPopover] = useState(false);
  const [showOssPopover, setShowOssPopover] = useState(false);
  const [showResetPopover, setShowResetPopover] = useState(false);
  const [confirmDeletePresetId, setConfirmDeletePresetId] = useState<string | null>(null);
  const [preserveCopyChecked, setPreserveCopyChecked] = useState(
    defaultPreserveCopyOnReset
  );

  const logPopoverRef = useRef<HTMLDivElement>(null);
  const modelPopoverRef = useRef<HTMLDivElement>(null);
  const ossPopoverRef = useRef<HTMLDivElement>(null);
  const resetPopoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setPreserveCopyChecked(defaultPreserveCopyOnReset);
  }, [defaultPreserveCopyOnReset]);

  useEffect(() => {
    setConfirmDeletePresetId(null);
  }, [selectedPresetId]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        logPopoverRef.current &&
        !logPopoverRef.current.contains(target)
      ) {
        setShowLogPopover(false);
      }
      if (
        modelPopoverRef.current &&
        !modelPopoverRef.current.contains(target)
      ) {
        setShowModelPopover(false);
      }
      if (ossPopoverRef.current && !ossPopoverRef.current.contains(target)) {
        setShowOssPopover(false);
      }
      if (
        resetPopoverRef.current &&
        !resetPopoverRef.current.contains(target)
      ) {
        setShowResetPopover(false);
        setConfirmDeletePresetId(null);
      }
    };
    if (
      showLogPopover ||
      showModelPopover ||
      showOssPopover ||
      showResetPopover ||
      Boolean(confirmDeletePresetId)
    ) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showLogPopover, showModelPopover, showOssPopover, showResetPopover, confirmDeletePresetId]);

  const runningLogsCount = runtimeLogs.filter((l) => l.status === 'running').length;
  const errorLogsCount = runtimeLogs.filter((l) => l.status === 'error').length;
  const unreadErrorCount = runtimeLogs.filter(
    (l) => l.status === 'error' && l.unreadError
  ).length;
  const filteredRuntimeLogs = runtimeLogs.filter((l) => {
    if (logFilter === 'error') return l.status === 'error';
    if (logFilter === 'detail') return l.workspace === 'detail';
    if (logFilter === 'sku') return l.workspace === 'sku';
    return true;
  });

  const totalRefsCount = referenceImages.length + skuReferenceImages.length;
  const ossSyncedCount =
    referenceImages.filter((r) =>
      isSyncedToProvider(r.ossUrl, r.cloudUrls, storageProvider)
    ).length +
    skuReferenceImages.filter((r) =>
      isSyncedToProvider(r.ossUrl, r.cloudUrls, storageProvider)
    ).length;
  const unsyncedRefsCount = Math.max(0, totalRefsCount - ossSyncedCount);

  const canSaveOrExportTemplate =
    tasks.length > 0 ||
    skuTasks.length > 0 ||
    referenceImages.length > 0 ||
    skuReferenceImages.length > 0 ||
    Boolean(fullPlanDoc.trim());

  const isWorkspaceBlank =
    !canSaveOrExportTemplate && selectedPresetId === 'blank-workspace';

  const totalAssetLibraryCount = commonAssetsCount + generationRecordsCount;

  const handleResetButtonClick = () => {
    if (isWorkspaceBlank) return;
    setShowSaveMasterModal(false);
    setShowLogPopover(false);
    setShowModelPopover(false);
    setShowOssPopover(false);
    setConfirmDeletePresetId(null);
    if (!confirmBeforeReset) {
      onClearWorkspaceToBlank({ preserveCopy: defaultPreserveCopyOnReset });
      return;
    }
    setShowResetPopover((prev) => !prev);
  };

  return (
    <header className="h-13 shrink-0 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-3.5 lg:px-5 grid grid-cols-[1fr_auto_1fr] items-center gap-3 z-30 select-none">
      {/* ================= ZONE 1 (LEFT): 品牌标识 + 一体化工程控制舱 ================= */}
      <div className="flex items-center gap-2.5 min-w-0 justify-self-start">
        {/* Brand Identity */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-slate-900 to-slate-800 text-white flex items-center justify-center font-bold text-[11px] font-mono-tabular shadow-xs ring-1 ring-slate-900/10">
            EC
          </div>
          <span className="text-[13px] font-bold tracking-tight text-slate-900 whitespace-nowrap font-display hidden sm:inline">
            E-Com Studio
          </span>
        </div>

        <span className="h-4 w-px bg-slate-200/90 hidden md:inline-block shrink-0" />

        {/* Unified Project & Master Template Control Capsule */}
        <div className="flex items-center relative" ref={resetPopoverRef}>
          <input
            ref={masterTemplateFileInputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={onImportMasterTemplateFile}
          />

          <div className="h-8 bg-slate-100/85 border border-slate-200/80 rounded-lg p-0.5 flex items-center gap-0.5 shadow-[inset_0_1px_1px_rgba(15,23,42,0.03)]">
            {/* Project / Template Selector */}
            <div className="relative flex items-center">
              <FolderKanban
                className={`w-3.5 h-3.5 ml-2 pointer-events-none shrink-0 ${
                  selectedPresetId === 'blank-workspace'
                    ? 'text-slate-500'
                    : 'text-blue-600'
                }`}
              />
              <select
                value={selectedPresetId}
                onChange={(e) => onSelectPreset(e.target.value)}
                title="切换空白生产工作台或加载已保存的正式母版"
                className="appearance-none max-w-[130px] sm:max-w-[165px] lg:max-w-[215px] pl-1.5 pr-6 py-1 text-xs font-medium text-slate-700 hover:text-slate-900 bg-transparent rounded-md focus:outline-none truncate cursor-pointer transition-colors"
              >
                <option value="blank-workspace">工程：空白生产工作台</option>
                {confirmedTemplates.map((tpl) => (
                  <option key={tpl.id} value={tpl.id}>
                    母版：{tpl.name} ({tpl.tasks.length}屏
                    {tpl.skuTasks && tpl.skuTasks.length > 0
                      ? `/${tpl.skuTasks.length}款`
                      : ''}
                    )
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3 h-3 text-slate-400 absolute right-1.5 pointer-events-none" />
            </div>

            <span className="h-3.5 w-px bg-slate-200/90 shrink-0" />

            {/* Save as Master Template Trigger */}
            <button
              type="button"
              onClick={() => {
                setShowResetPopover(false);
                setShowLogPopover(false);
                setShowModelPopover(false);
                setShowOssPopover(false);
                setConfirmDeletePresetId(null);
                setShowSaveMasterModal((prev) => !prev);
              }}
              title="将当前工作台另存为正式母版，或导入/导出母版文件 (.json)"
              className={`h-6.5 px-2 rounded-md text-xs font-medium flex items-center gap-1 transition-all cursor-pointer shrink-0 ${
                showSaveMasterModal
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : canSaveOrExportTemplate
                    ? 'bg-white text-slate-700 hover:text-blue-600 shadow-2xs border border-slate-200/60'
                    : 'text-slate-600 hover:bg-white/80 hover:text-slate-900'
              }`}
            >
              <Plus className="w-3 h-3 shrink-0" />
              <span className="hidden xl:inline">存为母版</span>
            </button>

            {/* Delete Active Template (Two-step confirmation to prevent accidental deletion) */}
            {selectedPresetId !== 'blank-workspace' && (
              confirmDeletePresetId === selectedPresetId ? (
                <div className="flex items-center gap-0.5 px-1">
                  <button
                    type="button"
                    onClick={() => {
                      onDeleteConfirmedTemplate(selectedPresetId);
                      setConfirmDeletePresetId(null);
                    }}
                    title="确认永久删除该正式母版"
                    className="h-6 px-1.5 rounded bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-semibold flex items-center gap-0.5 cursor-pointer shrink-0 shadow-2xs"
                  >
                    <span>确认删</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDeletePresetId(null)}
                    title="取消删除"
                    className="h-6 w-5 rounded text-slate-400 hover:text-slate-700 flex items-center justify-center cursor-pointer shrink-0"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setShowResetPopover(false);
                    setShowSaveMasterModal(false);
                    setConfirmDeletePresetId(selectedPresetId);
                  }}
                  title="删除当前选中的正式母版（点击后需二次确认）"
                  className="h-6.5 w-6.5 rounded-md flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50/90 transition-colors cursor-pointer shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )
            )}

            {/* Reset Workspace to Blank (with Reset-Proof Protection) */}
            <button
              type="button"
              onClick={handleResetButtonClick}
              disabled={isWorkspaceBlank}
              title={
                isWorkspaceBlank
                  ? '当前已是空白生产工作台'
                  : '重置工作台：清空当前画布中的素材与卡片（您的 SKU 常用卖点方案库与兜底设置受保护，不会被清空）'
              }
              className={`h-6.5 px-1.5 rounded-md text-xs flex items-center gap-1 transition-colors shrink-0 ${
                isWorkspaceBlank
                  ? 'text-slate-300 cursor-not-allowed'
                  : showResetPopover
                    ? 'bg-rose-600 text-white shadow-2xs cursor-pointer'
                    : 'text-slate-500 hover:text-rose-600 hover:bg-white/90 cursor-pointer'
              }`}
            >
              <RotateCcw className="w-3 h-3" />
              <span className="hidden 2xl:inline">重置</span>
            </button>
          </div>

          {/* Reset Protection Confirmation Popover */}
          {showResetPopover && (
            <div className="absolute top-full left-0 mt-2 w-84 bg-white border border-slate-200/90 rounded-xl shadow-xl p-4 z-50 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <RotateCcw className="w-4 h-4 text-rose-600 shrink-0" />
                  <span className="text-xs font-bold text-slate-900">
                    确认重置当前生产工作台？
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowResetPopover(false)}
                  className="btn-ghost p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="p-2.5 rounded-lg bg-emerald-50/80 border border-emerald-200/70 flex items-start gap-2 text-[11px] text-emerald-800 leading-relaxed">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  <strong>卖点预置防丢保护已生效：</strong>
                  您的「SKU 常用卖点方案库」、默认标题公式以及「③ 资产库」受全局保护，重置后会自动为您保留并带出！
                </span>
              </div>

              <label className="flex items-start gap-2 p-2 rounded-lg bg-slate-50 border border-slate-200/80 cursor-pointer">
                <input
                  type="checkbox"
                  checked={preserveCopyChecked}
                  onChange={(e) => setPreserveCopyChecked(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 text-blue-600"
                />
                <div className="text-[11px] text-slate-700 leading-snug">
                  <div className="font-semibold text-slate-800">
                    保留当前已填写的企划文案与标题前缀
                  </div>
                  <div className="text-slate-500 mt-0.5">
                    勾选后仅清空上传的参考图与生成的分屏/SKU卡片，不清空左侧已写的文字
                  </div>
                </div>
              </label>

              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setShowResetPopover(false);
                    onOpenApiModal('presets_fallback');
                  }}
                  className="text-[11px] font-medium text-blue-600 hover:underline cursor-pointer"
                >
                  配置默认兜底方案 →
                </button>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setShowResetPopover(false)}
                    className="btn-ghost px-2.5 py-1 text-xs cursor-pointer"
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowResetPopover(false);
                      onClearWorkspaceToBlank({
                        preserveCopy: preserveCopyChecked,
                      });
                    }}
                    className="px-3 py-1 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-2xs cursor-pointer transition-colors"
                  >
                    确认重置
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Save / Import / Export Master Template Popover */}
          {showSaveMasterModal && (
            <form
              onSubmit={onSaveCurrentAsMasterTemplate}
              className="absolute top-full left-0 mt-2 w-92 bg-white border border-slate-200/90 rounded-xl shadow-xl p-4 z-50 space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <BookmarkCheck className="w-4 h-4 text-blue-600" />
                  <span className="text-xs font-semibold text-slate-900">
                    另存为正式母版
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSaveMasterModal(false)}
                  className="btn-ghost p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="bg-slate-50/80 border border-slate-200/70 rounded-lg p-2.5 space-y-1 text-[11px] text-slate-600">
                <div className="flex items-center justify-between">
                  <span>详情参考图 / SKU参考图</span>
                  <span className="font-mono-tabular font-semibold text-slate-800">
                    {referenceImages.length} 张 / {skuReferenceImages.length} 张
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>详情分屏 / SKU套图任务</span>
                  <span className="font-mono-tabular font-semibold text-slate-800">
                    {tasks.length} 屏 / {skuTasks.length} 款
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>已生成成图 (详情+SKU)</span>
                  <span className="font-mono-tabular font-semibold text-emerald-700">
                    {tasks.filter((t) => Boolean(t.resultImageUrl)).length +
                      skuTasks.filter((t) => Boolean(t.resultImageUrl)).length}{' '}
                    张
                  </span>
                </div>
              </div>

              <input
                type="text"
                autoFocus
                value={newMasterNameInput}
                onChange={(e) => setNewMasterNameInput(e.target.value)}
                placeholder="输入母版名称，如：TWS328 详情+SKU标准母版"
                className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
              />

              <div className="flex items-center justify-between gap-2 pt-1">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => masterTemplateFileInputRef.current?.click()}
                    className="btn-ghost px-2 py-1 text-[11px] flex items-center gap-1 cursor-pointer"
                  >
                    <Upload className="w-3 h-3" />
                    <span>导入 JSON</span>
                  </button>
                  <button
                    type="button"
                    onClick={onExportCurrentMasterTemplateFile}
                    disabled={!canSaveOrExportTemplate}
                    className="btn-ghost px-2 py-1 text-[11px] flex items-center gap-1 cursor-pointer"
                  >
                    <Download className="w-3 h-3" />
                    <span>导出备份</span>
                  </button>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setShowSaveMasterModal(false)}
                    className="btn-ghost px-2.5 py-1 text-xs cursor-pointer"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    disabled={!canSaveOrExportTemplate}
                    className="btn-primary px-3 py-1 text-xs cursor-pointer"
                  >
                    保存母版
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* ================= ZONE 2 (CENTER): 居中三工作台分段导航 (3-Workspace Segmented Switcher) ================= */}
      <nav
        aria-label="主工作台切换"
        className="justify-self-center flex items-center gap-1 bg-slate-100/90 p-1 rounded-xl border border-slate-200/75 shadow-[inset_0_1px_2px_rgba(15,23,42,0.04)] shrink-0"
      >
        <button
          type="button"
          onClick={() => onSelectTopTab('detail_studio')}
          className={`h-7 px-3 text-xs rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
            activeTopTab === 'detail_studio'
              ? 'bg-white text-slate-900 font-semibold shadow-xs ring-1 ring-slate-900/5'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/50 font-medium'
          }`}
        >
          <LayoutList
            className={`w-3.5 h-3.5 ${
              activeTopTab === 'detail_studio'
                ? 'text-blue-600'
                : 'text-slate-400'
            }`}
          />
          <span>① 详情页工作台</span>
          <span
            className={`px-1.5 py-0.5 rounded-md font-mono-tabular text-[10px] font-semibold transition-colors ${
              activeTopTab === 'detail_studio'
                ? 'bg-blue-50 text-blue-600'
                : 'bg-slate-200/70 text-slate-500'
            }`}
          >
            {tasks.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => onSelectTopTab('sku_studio')}
          className={`h-7 px-3 text-xs rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
            activeTopTab === 'sku_studio'
              ? 'bg-white text-slate-900 font-semibold shadow-xs ring-1 ring-slate-900/5'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/50 font-medium'
          }`}
        >
          <Palette
            className={`w-3.5 h-3.5 ${
              activeTopTab === 'sku_studio'
                ? 'text-blue-600'
                : 'text-slate-400'
            }`}
          />
          <span>② 主图/SKU工作台</span>
          <span
            className={`px-1.5 py-0.5 rounded-md font-mono-tabular text-[10px] font-semibold transition-colors ${
              activeTopTab === 'sku_studio'
                ? 'bg-blue-50 text-blue-600'
                : 'bg-slate-200/70 text-slate-500'
            }`}
          >
            {skuTasks.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => onSelectTopTab('master_library')}
          className={`h-7 px-3 text-xs rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
            activeTopTab === 'master_library'
              ? 'bg-white text-slate-900 font-semibold shadow-xs ring-1 ring-slate-900/5'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/50 font-medium'
          }`}
        >
          <BookmarkCheck
            className={`w-3.5 h-3.5 ${
              activeTopTab === 'master_library'
                ? 'text-blue-600'
                : 'text-slate-400'
            }`}
          />
          <span>③ 资产库</span>
          <span
            className={`px-1.5 py-0.5 rounded-md font-mono-tabular text-[10px] font-semibold transition-colors ${
              activeTopTab === 'master_library'
                ? 'bg-blue-50 text-blue-600'
                : 'bg-slate-200/70 text-slate-500'
            }`}
          >
            {totalAssetLibraryCount}
          </span>
        </button>
      </nav>

      {/* ================= ZONE 3 (RIGHT): 运行日志胶囊 + 模型快切胶囊 + OSS状态胶囊 + 独立设置按钮 ================= */}
      <div className="flex items-center gap-1.5 shrink-0 justify-self-end">
        {/* 0. Runtime Log Capsule (运行日志 · 位于模型控件左侧) */}
        <div className="relative" ref={logPopoverRef}>
          <button
            type="button"
            onClick={() => {
              setShowModelPopover(false);
              setShowOssPopover(false);
              setShowResetPopover(false);
              setShowSaveMasterModal(false);
              setShowLogPopover((prev) => {
                const next = !prev;
                if (next && onMarkRuntimeLogsRead) {
                  onMarkRuntimeLogsRead();
                }
                return next;
              });
            }}
            className={`h-8 px-2.5 text-xs rounded-lg border transition-all flex items-center gap-1.5 cursor-pointer font-mono-tabular ${
              runningLogsCount > 0
                ? 'bg-blue-50/90 border-blue-300 text-blue-700 shadow-2xs'
                : unreadErrorCount > 0
                  ? 'bg-rose-50/95 border-rose-300 text-rose-700 shadow-2xs'
                  : showLogPopover
                    ? 'bg-slate-100 border-slate-300 text-slate-900'
                    : 'bg-white hover:bg-slate-50 border-slate-200/90 text-slate-600 shadow-2xs'
            }`}
            title="查看实时运行日志：追踪 Agent 方案拆解、单卡/批量生图耗时与异常报错详情"
          >
            {runningLogsCount > 0 ? (
              <Loader2 className="w-3.5 h-3.5 text-blue-600 animate-spin shrink-0" />
            ) : unreadErrorCount > 0 ? (
              <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
            ) : (
              <Terminal className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            )}
            <span className="font-semibold whitespace-nowrap">
              {runningLogsCount > 0
                ? `运行中(${runningLogsCount})`
                : unreadErrorCount > 0
                  ? `异常(${unreadErrorCount})`
                  : '日志'}
            </span>
            {runningLogsCount === 0 &&
              unreadErrorCount === 0 &&
              runtimeLogs.length > 0 && (
                <span className="px-1 py-0.5 rounded bg-slate-100 text-slate-500 text-[10px] font-semibold">
                  {runtimeLogs.length}
                </span>
              )}
          </button>

          {showLogPopover && (
            <div className="absolute right-0 top-full mt-2 w-[410px] max-w-[92vw] bg-white border border-slate-200/90 rounded-xl shadow-2xl z-50 overflow-hidden flex flex-col">
              {/* Popover Header */}
              <div className="px-3.5 py-2.5 bg-slate-50/90 border-b border-slate-200/80 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5 text-slate-700" />
                  <span className="text-xs font-bold text-slate-900">
                    工作台运行日志
                  </span>
                  <span className="text-[11px] font-mono-tabular text-slate-400">
                    ({runtimeLogs.length})
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {runtimeLogs.length > 0 && onClearRuntimeLogs && (
                    <button
                      type="button"
                      onClick={() => onClearRuntimeLogs()}
                      className="text-[11px] text-slate-400 hover:text-rose-600 cursor-pointer transition-colors"
                    >
                      清空记录
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowLogPopover(false)}
                    className="p-0.5 text-slate-400 hover:text-slate-700 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Filter Bar */}
              <div className="px-3.5 py-1.5 bg-white border-b border-slate-100 flex items-center gap-1">
                {(
                  [
                    { id: 'all', label: `全部 (${runtimeLogs.length})` },
                    { id: 'error', label: `异常 (${errorLogsCount})` },
                    { id: 'detail', label: '详情/主图' },
                    { id: 'sku', label: 'SKU工作台' },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setLogFilter(tab.id)}
                    className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                      logFilter === tab.id
                        ? tab.id === 'error'
                          ? 'bg-rose-600 text-white font-semibold'
                          : 'bg-slate-900 text-white font-semibold'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Log List */}
              <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-100">
                {filteredRuntimeLogs.length === 0 ? (
                  <div className="py-10 px-4 text-center space-y-1">
                    <Terminal className="w-6 h-6 text-slate-300 mx-auto" />
                    <div className="text-xs font-medium text-slate-500">
                      暂无运行日志记录
                    </div>
                    <div className="text-[11px] text-slate-400">
                      当您点击 Agent 拆解方案、单屏生图或 SKU 批量生成时，实时进度与报错详情会在此完整记录
                    </div>
                  </div>
                ) : (
                  filteredRuntimeLogs.map((log) => {
                    const wsBadge =
                      log.workspace === 'detail'
                        ? { text: '详情/主图', cls: 'bg-blue-50 text-blue-700 border-blue-200/70' }
                        : log.workspace === 'sku'
                          ? { text: 'SKU工作台', cls: 'bg-indigo-50 text-indigo-700 border-indigo-200/70' }
                          : log.workspace === 'oss'
                            ? { text: 'OSS云存储', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200/70' }
                            : { text: '系统', cls: 'bg-slate-100 text-slate-700 border-slate-200' };

                    return (
                      <div
                        key={log.id}
                        className={`p-3 space-y-1.5 text-xs transition-colors ${
                          log.status === 'error'
                            ? 'bg-rose-50/40'
                            : log.status === 'running'
                              ? 'bg-blue-50/30'
                              : 'bg-white hover:bg-slate-50/60'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            {log.status === 'running' ? (
                              <Loader2 className="w-3.5 h-3.5 text-blue-600 animate-spin shrink-0" />
                            ) : log.status === 'error' ? (
                              <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                            ) : (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            )}
                            <span
                              className={`px-1.5 py-0.5 text-[10px] font-semibold rounded border shrink-0 ${wsBadge.cls}`}
                            >
                              {wsBadge.text}
                            </span>
                            <span className="font-semibold text-slate-900 truncate">
                              {log.title}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0 font-mono-tabular text-[10px] text-slate-400">
                            {typeof log.durationMs === 'number' && (
                              <span
                                className={`px-1 py-0.5 rounded font-semibold ${
                                  log.status === 'error'
                                    ? 'bg-rose-100/80 text-rose-700'
                                    : 'bg-slate-100 text-slate-600'
                                }`}
                              >
                                {(log.durationMs / 1000).toFixed(1)}s
                              </span>
                            )}
                            <span>{log.timestamp}</span>
                          </div>
                        </div>

                        {log.model && (
                          <div className="flex items-center gap-1.5 pl-5 text-[10px] font-mono-tabular text-slate-500">
                            <span>模型: {log.model}</span>
                          </div>
                        )}

                        {log.summary && (
                          <div className="pl-5 text-[11px] text-slate-600 leading-relaxed">
                            {log.summary}
                          </div>
                        )}

                        {log.errorDetail && (
                          <div className="ml-5 p-2 rounded-lg bg-rose-50 border border-rose-200/90 text-[11px] text-rose-800 space-y-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-bold text-rose-900">
                                异常原因详情：
                              </span>
                              {onCopyLogText && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    onCopyLogText(
                                      `[${log.timestamp}] ${log.title} (${log.model || ''})\n错误详情: ${log.errorDetail}`
                                    )
                                  }
                                  className="px-1.5 py-0.5 rounded bg-white hover:bg-rose-100 text-rose-700 border border-rose-200 text-[10px] flex items-center gap-1 cursor-pointer"
                                >
                                  <Copy className="w-2.5 h-2.5" />
                                  <span>复制报错</span>
                                </button>
                              )}
                            </div>
                            <div className="font-mono-tabular break-words whitespace-pre-wrap leading-relaxed text-[10.5px]">
                              {log.errorDetail}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* 1. Quick Model Switcher Capsule (e.g. "Argon(High) · Banana 2.1") */}
        <div className="relative" ref={modelPopoverRef}>
          <button
            type="button"
            onClick={() => {
              setShowLogPopover(false);
              setShowOssPopover(false);
              setShowResetPopover(false);
              setShowSaveMasterModal(false);
              setShowModelPopover((prev) => !prev);
            }}
            className={`h-8 px-2.5 text-xs rounded-lg border transition-all flex items-center gap-1.5 cursor-pointer ${
              showModelPopover
                ? 'bg-blue-50/70 border-blue-300 text-slate-900 shadow-xs'
                : 'bg-white hover:bg-slate-50 border-slate-200/90 text-slate-700 shadow-2xs'
            }`}
            title="点击快速切换已设定的常用策划模型、生图模型与 API 通道"
          >
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span className="font-mono-tabular font-semibold text-slate-800 tracking-tight truncate max-w-[180px] xl:max-w-[240px]">
              {shortAgentLabel}
              <span className="text-slate-300 mx-1">/</span>
              <span className="text-blue-600">{shortImageLabel}</span>
            </span>
            <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />
          </button>

          {showModelPopover && (
            <div className="absolute right-0 top-full mt-2 w-84 bg-white border border-slate-200/90 rounded-xl shadow-xl p-3.5 z-50 space-y-3">
              {/* Active Channel Quick Switch */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-slate-500">
                    API 通道切换
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setShowModelPopover(false);
                      onOpenApiModal('channel_model');
                    }}
                    className="text-blue-600 hover:underline font-medium cursor-pointer"
                  >
                    通道配置 →
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {channels.map((ch) => {
                    const active = ch.id === activeChannelId;
                    return (
                      <button
                        key={ch.id}
                        type="button"
                        onClick={() => onQuickSelectChannel(ch.id)}
                        className={`px-2.5 py-1.5 rounded-lg border text-left text-xs transition-all flex items-center justify-between gap-1 cursor-pointer ${
                          active
                            ? 'border-blue-600 bg-blue-50/70 text-blue-700 font-semibold'
                            : 'border-slate-200/80 hover:border-slate-300 text-slate-700 bg-slate-50/50'
                        }`}
                      >
                        <span className="truncate">{ch.name}</span>
                        {active && <Check className="w-3 h-3 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Agent Model Quick Switch + High Thinking Toggle */}
              <div className="space-y-1.5 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-slate-500 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-blue-600" />
                    <span>策划编排模型 (Agent)</span>
                  </span>
                  <label className="flex items-center gap-1 cursor-pointer text-[11px] font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={enableHighThinking}
                      onChange={onQuickToggleHighThinking}
                      className="rounded border-slate-300 text-blue-600 w-3 h-3"
                    />
                    <span>High 深度思考</span>
                  </label>
                </div>
                <div className="max-h-36 overflow-y-auto space-y-1 pr-0.5">
                  {agentModelPresets.map((m) => {
                    const active = m.id === agentModel;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => onQuickSelectAgentModel(m.id)}
                        className={`w-full px-2.5 py-1.5 rounded-lg border text-left transition-all flex items-center justify-between gap-2 cursor-pointer ${
                          active
                            ? 'border-blue-600 bg-blue-50/60 text-slate-900'
                            : 'border-slate-200/70 hover:border-slate-300 bg-white text-slate-700'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-mono-tabular font-semibold truncate">
                            {m.id}
                          </div>
                          <div className="text-[10px] text-slate-400 truncate">
                            {m.label}
                          </div>
                        </div>
                        {active && (
                          <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Image Model Quick Switch */}
              <div className="space-y-1.5 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-slate-500 flex items-center gap-1">
                    <Cpu className="w-3 h-3 text-emerald-600" />
                    <span>视觉生图模型 (Image)</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setShowModelPopover(false);
                      onOpenApiModal('model_presets');
                    }}
                    className="text-blue-600 hover:underline font-medium cursor-pointer"
                  >
                    + 管理常用池
                  </button>
                </div>
                <div className="max-h-36 overflow-y-auto space-y-1 pr-0.5">
                  {imageModelPresets.map((m) => {
                    const active = m.id === imageModel;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => onQuickSelectImageModel(m.id)}
                        className={`w-full px-2.5 py-1.5 rounded-lg border text-left transition-all flex items-center justify-between gap-2 cursor-pointer ${
                          active
                            ? 'border-blue-600 bg-blue-50/60 text-slate-900'
                            : 'border-slate-200/70 hover:border-slate-300 bg-white text-slate-700'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-mono-tabular font-semibold truncate">
                            {m.id}
                          </div>
                          <div className="text-[10px] text-slate-400 truncate">
                            {m.label}
                          </div>
                        </div>
                        {active && (
                          <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 2. Cloud Storage (Aliyun OSS / Cloudflare R2) Status & Sync Count Capsule */}
        <div className="relative hidden md:block" ref={ossPopoverRef}>
          <button
            type="button"
            onClick={() => {
              setShowLogPopover(false);
              setShowModelPopover(false);
              setShowResetPopover(false);
              setShowSaveMasterModal(false);
              setShowOssPopover((prev) => !prev);
            }}
            className={`h-8 px-2.5 text-xs rounded-lg border transition-all flex items-center gap-1.5 font-mono-tabular cursor-pointer ${
              isOssReady
                ? storageProvider === 'cloudflare_r2'
                  ? 'bg-orange-50/80 hover:bg-orange-50 border-orange-200/90 text-orange-800'
                  : 'bg-emerald-50/70 hover:bg-emerald-50 border-emerald-200/90 text-emerald-800'
                : 'bg-slate-100/80 hover:bg-slate-100 border-slate-200/80 text-slate-500'
            }`}
            title={
              isOssReady
                ? `${storageProvider === 'cloudflare_r2' ? 'Cloudflare R2' : '阿里云 OSS'} 已启用 · 当前工作台已同步 ${ossSyncedCount}/${totalRefsCount} 张参考图`
                : `${storageProvider === 'cloudflare_r2' ? 'Cloudflare R2' : '阿里云 OSS'} 未启用（点击自由切换或配置云存储）`
            }
          >
            <Cloud
              className={`w-3.5 h-3.5 shrink-0 ${
                isOssReady
                  ? storageProvider === 'cloudflare_r2'
                    ? 'text-orange-600'
                    : 'text-emerald-600'
                  : 'text-slate-400'
              }`}
            />
            <span className="font-semibold">
              {isOssReady
                ? `${storageProvider === 'cloudflare_r2' ? 'R2' : 'OSS'} ${ossSyncedCount}/${totalRefsCount}`
                : `${storageProvider === 'cloudflare_r2' ? 'R2' : 'OSS'} 未启用`}
            </span>
          </button>

          {showOssPopover && (
            <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-slate-200/90 rounded-xl shadow-xl p-3.5 z-50 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900">
                  {storageProvider === 'cloudflare_r2'
                    ? 'Cloudflare R2 云端存储'
                    : '阿里云 OSS 云端存储'}
                </span>
                <span
                  className={`px-1.5 py-0.5 text-[10px] font-semibold rounded ${
                    isOssReady
                      ? storageProvider === 'cloudflare_r2'
                        ? 'bg-orange-50 text-orange-700'
                        : 'bg-emerald-50 text-emerald-700'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {isOssReady ? '已启用 (0-Base64)' : '本地 Base64 模式'}
                </span>
              </div>

              {/* 1-Click Storage Provider Switcher */}
              {onSwitchStorageProvider && (
                <div className="p-1 bg-slate-100 rounded-lg grid grid-cols-2 gap-1">
                  <button
                    type="button"
                    onClick={() => onSwitchStorageProvider('aliyun_oss')}
                    className={`py-1.5 px-2 text-[11px] font-semibold rounded-md transition-all cursor-pointer flex items-center justify-center gap-1 ${
                      storageProvider !== 'cloudflare_r2'
                        ? 'bg-white text-emerald-700 shadow-2xs font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <span>阿里云 OSS</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onSwitchStorageProvider('cloudflare_r2')}
                    className={`py-1.5 px-2 text-[11px] font-semibold rounded-md transition-all cursor-pointer flex items-center justify-center gap-1 ${
                      storageProvider === 'cloudflare_r2'
                        ? 'bg-white text-orange-700 shadow-2xs font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <span>Cloudflare R2</span>
                  </button>
                </div>
              )}

              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/70 text-[11px] text-slate-600 space-y-1">
                <div className="flex items-center justify-between">
                  <span>工作台参考图同步进度</span>
                  <span className="font-mono-tabular font-semibold text-slate-900">
                    {ossSyncedCount} / {totalRefsCount} 张
                  </span>
                </div>
                {unsyncedRefsCount > 0 && isOssReady && (
                  <div className="text-[10px] text-amber-700">
                    尚有 {unsyncedRefsCount} 张参考图未同步至{' '}
                    {storageProvider === 'cloudflare_r2' ? 'R2' : 'OSS'}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between gap-2 pt-0.5">
                {isOssReady && totalRefsCount > 0 && onSyncAllReferencesToOss ? (
                  <button
                    type="button"
                    disabled={isSyncingAllRefsToOss}
                    onClick={() => {
                      onSyncAllReferencesToOss();
                      setShowOssPopover(false);
                    }}
                    className="btn-primary flex-1 py-1.5 px-2.5 text-xs flex items-center justify-center gap-1 cursor-pointer"
                  >
                    {isSyncingAllRefsToOss ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <CloudUpload className="w-3.5 h-3.5" />
                    )}
                    <span>
                      {unsyncedRefsCount > 0
                        ? `同步未传 (${unsyncedRefsCount})`
                        : '重新同步全部'}
                    </span>
                  </button>
                ) : null}

                <button
                  type="button"
                  onClick={() => {
                    setShowOssPopover(false);
                    onOpenApiModal('oss_storage');
                  }}
                  className="btn-secondary flex-1 py-1.5 px-2.5 text-xs text-center cursor-pointer"
                >
                  云存储设置 →
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 3. Far-Right Dedicated Global Settings Button (⚙️ 设置) */}
        <button
          type="button"
          onClick={() => {
            setShowModelPopover(false);
            setShowOssPopover(false);
            onOpenApiModal('presets_fallback');
          }}
          title="打开全局设置中心：管理 SKU 常用卖点方案兜底库、默认标题公式、API 通道、常用模型池与 OSS 云存储"
          className="h-8 px-3 text-xs font-semibold rounded-lg bg-slate-900 hover:bg-slate-800 text-white shadow-2xs flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
        >
          <Settings className="w-3.5 h-3.5 text-slate-200" />
          <span>设置</span>
        </button>
      </div>
    </header>
  );
};
