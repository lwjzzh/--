import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Plus,
  Trash2,
  Upload,
  Sparkles,
  Square,
  RefreshCw,
  Download,
  FileArchive,
  Check,
  Maximize2,
  AlertCircle,
  Loader2,
  Wand2,
  Link2,
  CloudUpload,
  ChevronDown,
  ChevronUp,
  Info,
  Globe,
  Layers,
  BookmarkCheck,
  X,
  ArrowRight,
  SlidersHorizontal,
  Dices,
  CopyPlus,
  ScanEye,
  Lock,
  Unlock,
  LayoutGrid,
  Columns2,
  History,
  Settings,
  Zap,
  ShieldCheck,
} from 'lucide-react';
import {
  ReferenceImageItem,
  AspectRatioOption,
  ImageSizeOption,
  CaseRefDimension,
  CloudStorageProvider,
  SkuBatchConfig,
  SkuTask,
  SkuSellingPointPreset,
  ReplicaFidelity,
  ReplicaLanguage,
  ReplicaMatchMode,
  ProductAngleRole,
  PROD_ANGLE_ROLE_OPTIONS,
  StyleLinkageMode,
  PrintThemeLinkageConfig,
} from '../types';
import { SavedCommonAsset } from '../utils/assetLibraryDb';
import { downloadSingleSkuImage } from '../utils/exportHelpers';
import {
  QUICK_REFINE_RESCUE_CHIPS,
  QuickAssetSelectMode,
  autoFixSkuTaskQuality,
  buildSkuPayloadPreview,
  filterEnabledProds,
  getEffectiveProdRole,
  inspectSkuTaskQuality,
  smartPickComplementaryProds,
  toggleRefineChipInstruction,
} from '../utils/qualityGuardEngine';

const REPLICA_ASPECT_RATIOS: { value: AspectRatioOption; label: string }[] = [
  { value: '1:1', label: '1:1 方图' },
  { value: '3:4', label: '3:4 竖图' },
  { value: '9:16', label: '9:16 长屏' },
  { value: '4:3', label: '4:3 横图' },
  { value: '16:9', label: '16:9 宽屏' },
];

const REPLICA_LANGUAGES: { value: ReplicaLanguage; label: string }[] = [
  { value: 'zh', label: '中文海报' },
  { value: 'en', label: '英文海报' },
  { value: 'none', label: '无文字底图' },
];

// Curated 4D Print Theme Inspiration Presets for 1-click "🎲 换灵感"
const PRINT_THEME_INSPIRATION_POOL: {
  keywords: RegExp;
  story: string;
  palette: string;
  stage: string;
  elements: string;
  uiStyle: string;
}[] = [
  {
    keywords: /芝士|奶酪|鼠|黄|cheese|火箭/i,
    story: '太空芝士火箭小鼠',
    palette: '60%奶油鹅黄渐变(#FFFDF2->#FCE9A8) + 30%暖杏芝士黄(#F7C948) + 10%焦糖棕点缀(#5C3A21)',
    stage: '泡泡玛特风圆润哑光多孔芝士星球微缩底座',
    elements: '2~3个悬浮3D软萌芝士块、迷你小火箭与十字星光符号',
    uiStyle: '深焦糖棕粗圆体主标题(#4A2C11) + 奶油黄圆角卖点胶囊(#FFF8DC)',
  },
  {
    keywords: /兔|星|月|梦|紫|蓝|sleep|dream/i,
    story: '星月云朵美梦兔',
    palette: '60%梦幻雾霾紫蓝渐变(#F3F0FF->#DCD3FF) + 30%绵软云朵白(#FFFFFF) + 10%星光柔金(#FACC15)',
    stage: '圆润磨砂云朵阶梯与弯月托盘潮玩底座',
    elements: '2~3个漂浮3D软胶小弯月、睡眠Zzz气泡与四角闪星✨',
    uiStyle: '深靛紫圆体主标题(#311B92) + 香芋紫半透明毛玻璃卖点胶囊(#EDE7F6)',
  },
  {
    keywords: /刺猬|露营|洋梨|梨|熊|绿|森|camp/i,
    story: '森系洋梨帐篷露营',
    palette: '60%奶油抹茶杏仁白渐变(#F7F9F2->#E2ECD2) + 30%森系鼠尾草绿(#A3B88C) + 10%暖琥珀黄(#D97706)',
    stage: '微缩圆润森系草坪与哑光鹅卵石露营展台',
    elements: '2~3个3D软萌小洋梨、迷你露营小帐篷与原木叶片符号',
    uiStyle: '深橄榄绿主标题(#1E3A1E) + 暖米杏圆角胶囊框配琥珀黄高亮标(#F4EFE6)',
  },
  {
    keywords: /猫|黑|酷|甜酷|粉|cat|kitty/i,
    story: '甜酷潮玩喵星人',
    palette: '60%樱花粉雾白渐变(#FFF5F7->#FCE4EC) + 30%丝绒酷黑与奶白撞色(#2D2D34) + 10%树莓粉点缀(#EC4899)',
    stage: '盲盒级圆润猫爪软垫与双层磨砂亚克力几何展台',
    elements: '2~3个漂浮3D立体小猫爪印、毛线球与爱心音符符号',
    uiStyle: '炭黑粗体主标题(#18181B) + 樱花粉白圆角胶囊框(#FDF2F8)',
  },
  {
    keywords: /.*/,
    story: '马卡龙潮玩盲盒主题',
    palette: '60%高明度马卡龙渐变背景(#F8FAFC->#E0F2FE) + 30%温润奶油白展台(#FFFFFF) + 10%活力糖果色点缀(#3B82F6)',
    stage: '泡泡玛特风圆润软胶立体圆盘底座配细腻漫反射光影',
    elements: '2~3个从壳面图案提取的3D哑光漂浮微缩伴生小符号',
    uiStyle: '同色系深色圆体主标题(#1E293B) + 浅奶油色圆角16px卖点胶囊(#F1F5F9)',
  },
];

// Extract #HEX codes from any palette/spec string for visual swatch rendering
function extractHexSwatches(text?: string): string[] {
  if (!text) return [];
  const matches = text.match(/#[0-9A-Fa-f]{6}\b/g);
  if (!matches) return [];
  return Array.from(new Set(matches.map((m) => m.toUpperCase()))).slice(0, 5);
}

// Map AspectRatioOption to Tailwind aspect ratio class
function getAspectBoxClass(ratio?: AspectRatioOption): string {
  switch (ratio) {
    case '3:4':
      return 'aspect-[3/4] max-h-[340px]';
    case '9:16':
      return 'aspect-[9/16] max-h-[360px]';
    case '4:3':
      return 'aspect-[4/3]';
    case '16:9':
      return 'aspect-[16/9]';
    case '1:1':
    default:
      return 'aspect-square';
  }
}

export interface SkuStudioViewProps {
  prodAssets: ReferenceImageItem[];
  caseAssets: ReferenceImageItem[];
  commonAssets: SavedCommonAsset[];
  detailWorkspaceAssets?: ReferenceImageItem[];
  skuBatchConfig: SkuBatchConfig;
  skuTasks: SkuTask[];
  skuBatchSummary: string;
  detailProductInfoText: string;
  ossEnabled: boolean;
  storageProvider?: CloudStorageProvider;
  isAnalyzingRefs: boolean;
  isParsingSkuPlan: boolean;
  isSkuBatchRunning: boolean;
  polishingSkuTaskId: string | null;
  generatingPromptSkuTaskId?: string | null;
  isExtractingCaseLayout?: boolean;
  isExportingSkuZip: boolean;
  onUpdateSkuBatchConfig: (patch: Partial<SkuBatchConfig>) => void;
  onUpdateSkuTask: (taskId: string, patch: Partial<SkuTask>) => void;
  onDeleteSkuTask: (taskId: string) => void;
  onAddBlankSkuTask: () => void;
  onQuickCreateTasksFromSelectedProds: () => void;
  onAgentGenerateSkuPlan: () => void;
  onAgentGenerateSingleSkuPrompt: (
    task: SkuTask,
    autoGenerateImageAfter?: boolean
  ) => void;
  onPolishSkuPrompt: (task: SkuTask) => void;
  onGenerateSingleSkuImage: (task: SkuTask) => void;
  onStartBatchGenerateSkus: (onlyUnfinished?: boolean) => void;
  onStopBatchGenerateSkus: () => void;
  onSyncGlobalConfigToAllSkuTasks: () => void;
  onExtractCaseLayout?: () => void;
  onPromoteTaskResultToGlobalCase?: (task: SkuTask) => void;
  onExportSkuZip: () => void;
  onUploadFiles: (
    files: FileList | null,
    category: 'product' | 'case',
    targetSkuTaskId?: string
  ) => void;
  onSelectAssetsFromLibrary: (
    assets: SavedCommonAsset[],
    category: 'product' | 'case',
    targetSkuTaskId?: string
  ) => void;
  onUploadCommonAssetFiles?: (
    files: FileList | null,
    category: 'product' | 'case'
  ) => void;
  onSaveSkuAssetsToLibrary?: (category?: 'product' | 'case') => void;
  onUpdateSkuAssetTag?: (refId: string, newTag: string) => void;
  onUploadSkuRefsToOss?: (items: ReferenceImageItem[]) => void;
  isSyncingOss?: boolean;
  onRemoveSkuAsset: (refId: string) => void;
  onClearSkuCategoryAssets: (category: 'product' | 'case') => void;
  onToggleCaseDimension: (refId: string, dim: CaseRefDimension) => void;
  onSetCaseDimensions?: (refId: string, dims: CaseRefDimension[]) => void;
  onToggleCaseLockBaseSwap?: (refId: string) => void;
  onUpdateCaseCustomRule?: (refId: string, customRule: string) => void;
  onAutoAnalyzeRefs: () => void;
  onUploadSkuResultToOss: (task: SkuTask) => void;
  onPreviewImage: (url: string, title?: string, subtitle?: string) => void;
  onShowToast: (text: string, type?: 'info' | 'success' | 'error') => void;
  onSyncReplicaPairsAndRun?: (autoStartRender: boolean) => void;
  onExtendReplicaToDetail?: (
    targetRatio: AspectRatioOption,
    singleTask?: SkuTask,
    useResultAsAnchor?: boolean
  ) => void;
  onUpdateSkuProdRole?: (refId: string, role: ProductAngleRole) => void;
  onFissionTaskToOtherProds?: (
    sourceTask: SkuTask,
    targetProdIds: string[],
    useCompletedAsCase: boolean,
    autoRunAfter: boolean
  ) => void;
  onBuildStandardFiveMainCards?: () => void;
  onToggleSkuAssetEnabled?: (refId: string) => void;
  onBatchSetSkuAssetsEnabled?: (mode: QuickAssetSelectMode) => void;
  sellingPointPresets?: SkuSellingPointPreset[];
  onOpenPresetSettings?: () => void;
}

export const SkuStudioView: React.FC<SkuStudioViewProps> = ({
  prodAssets,
  caseAssets,
  commonAssets,
  skuBatchConfig,
  skuTasks,
  ossEnabled,
  storageProvider = 'aliyun_oss',
  isAnalyzingRefs,
  isParsingSkuPlan,
  isSkuBatchRunning,
  generatingPromptSkuTaskId,
  isExportingSkuZip,
  onUpdateSkuBatchConfig,
  onUpdateSkuTask,
  onDeleteSkuTask,
  onGenerateSingleSkuImage,
  onStartBatchGenerateSkus,
  onStopBatchGenerateSkus,
  onExportSkuZip,
  onUploadFiles,
  onSelectAssetsFromLibrary,
  onSaveSkuAssetsToLibrary,
  onUpdateSkuAssetTag,
  onUploadSkuRefsToOss,
  isSyncingOss = false,
  onRemoveSkuAsset,
  onClearSkuCategoryAssets,
  onUpdateCaseCustomRule,
  onAutoAnalyzeRefs,
  onUploadSkuResultToOss,
  onPreviewImage,
  onShowToast,
  onSyncReplicaPairsAndRun,
  onExtendReplicaToDetail,
  onUpdateSkuProdRole,
  onFissionTaskToOtherProds,
  onBuildStandardFiveMainCards,
  onToggleSkuAssetEnabled,
  onBatchSetSkuAssetsEnabled,
  sellingPointPresets = [],
  onOpenPresetSettings,
}) => {
  const isR2 = storageProvider === 'cloudflare_r2';
  const cloudShort = isR2 ? 'R2' : 'OSS';

  // Canvas View Mode: 'detailed_2col' (default 2-col editor) vs 'showcase_5col' (5-card overview)
  const [canvasViewMode, setCanvasViewMode] = useState<
    'detailed_2col' | 'showcase_5col'
  >(() => {
    try {
      const saved = localStorage.getItem('ecom_studio_sku_view_mode_v1');
      if (saved === 'showcase_5col' || saved === 'detailed_2col') {
        return saved;
      }
    } catch {
      // Ignore storage error
    }
    return 'detailed_2col';
  });

  const handleSelectCanvasViewMode = (
    mode: 'detailed_2col' | 'showcase_5col'
  ) => {
    setCanvasViewMode(mode);
    try {
      localStorage.setItem('ecom_studio_sku_view_mode_v1', mode);
    } catch {
      // Ignore storage error
    }
  };

  // Selling Point Presets Popover states
  const [showGlobalPresetMenu, setShowGlobalPresetMenu] = useState(false);
  const [openCardPresetMenuId, setOpenCardPresetMenuId] = useState<
    string | null
  >(null);

  useEffect(() => {
    if (!showGlobalPresetMenu && !openCardPresetMenuId) return;
    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && !target.closest('[data-preset-menu-root="true"]')) {
        setShowGlobalPresetMenu(false);
        setOpenCardPresetMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [showGlobalPresetMenu, openCardPresetMenuId]);

  const effectivePresets = useMemo(() => {
    if (sellingPointPresets && sellingPointPresets.length > 0) {
      return sellingPointPresets;
    }
    if (
      skuBatchConfig.sellingPointPresets &&
      skuBatchConfig.sellingPointPresets.length > 0
    ) {
      return skuBatchConfig.sellingPointPresets;
    }
    return [];
  }, [sellingPointPresets, skuBatchConfig.sellingPointPresets]);

  // Left sidebar state
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlInputText, setUrlInputText] = useState('');
  const [isImportingUrl, setIsImportingUrl] = useState(false);
  const [showPerRefRules, setShowPerRefRules] = useState(false);
  const [isCaseGridExpanded, setIsCaseGridExpanded] = useState(false);
  const [isProdGridExpanded, setIsProdGridExpanded] = useState(false);
  const [hoveredFidelity, setHoveredFidelity] = useState<ReplicaFidelity | null>(
    null
  );
  const [showConsistencyTooltip, setShowConsistencyTooltip] = useState(false);
  const [assetLibraryModal, setAssetLibraryModal] = useState<{
    open: boolean;
    category: 'product' | 'case';
    selectedIds: string[];
  }>({
    open: false,
    category: 'case',
    selectedIds: [],
  });

  // Per-card collapsible states
  const [expandedTaskPromptIds, setExpandedTaskPromptIds] = useState<string[]>(
    []
  );
  const [expandedPrint4DTaskIds, setExpandedPrint4DTaskIds] = useState<string[]>(
    []
  );
  const [inspirationSeedMap, setInspirationSeedMap] = useState<
    Record<string, number>
  >({});

  // Single-Card Multi-SKU Pattern Fission Modal state ("🧬 拿此图裂变其他花色")
  const [fissionModal, setFissionModal] = useState<{
    open: boolean;
    sourceTask: SkuTask | null;
    selectedProdIds: string[];
    useCompletedAsCase: boolean;
  }>({
    open: false,
    sourceTask: null,
    selectedIds: [],
    selectedProdIds: [],
    useCompletedAsCase: true,
  } as any);

  const caseFileInputRef = useRef<HTMLInputElement | null>(null);
  const prodFileInputRef = useRef<HTMLInputElement | null>(null);

  const replicaFidelity: ReplicaFidelity =
    skuBatchConfig.replicaFidelity === 'style_reference'
      ? 'style_ref'
      : skuBatchConfig.replicaFidelity || 'high_replica';
  const consistentOutputStyle: boolean =
    skuBatchConfig.consistentOutputStyle !== false;
  const styleLinkageMode: StyleLinkageMode =
    skuBatchConfig.styleLinkageMode ||
    (consistentOutputStyle ? 'print_4d' : 'lock_scene');
  const replicaLanguage: ReplicaLanguage =
    skuBatchConfig.replicaLanguage ||
    (skuBatchConfig.textMode === 'without_text' ? 'none' : 'zh');
  const rawMatchMode =
    skuBatchConfig.replicaMatchMode ||
    (prodAssets.length > 1 && caseAssets.length <= 1
      ? 'multi_prod_to_single_ref'
      : 'single_prod_to_multi_ref');
  const replicaMatchMode: ReplicaMatchMode =
    rawMatchMode === 'single_prod_multi_case'
      ? 'single_prod_to_multi_ref'
      : rawMatchMode === 'multi_prod_single_case'
        ? 'multi_prod_to_single_ref'
        : rawMatchMode;

  const enabledProdAssets = useMemo(
    () => filterEnabledProds(prodAssets, true),
    [prodAssets]
  );
  const enabledProdCount = useMemo(
    () => prodAssets.filter((p) => p.enabled !== false).length,
    [prodAssets]
  );

  // Compute expected replica tasks count based on match mode & enabled products
  const plannedPairCount = useMemo(() => {
    if (skuTasks.length > 0) return skuTasks.length;
    if (replicaMatchMode === 'single_prod_to_multi_ref') {
      return Math.max(1, caseAssets.length || 5);
    }
    return Math.max(1, enabledProdAssets.length);
  }, [
    skuTasks.length,
    replicaMatchMode,
    caseAssets.length,
    enabledProdAssets.length,
  ]);

  const completedTasksCount = useMemo(
    () =>
      skuTasks.filter(
        (t) => t.status === 'completed' && Boolean(t.resultImageUrl)
      ).length,
    [skuTasks]
  );

  const [inspectingPayloadTaskId, setInspectingPayloadTaskId] = useState<
    string | null
  >(null);

  const skuQualityMap = useMemo(() => {
    const map = new Map<string, ReturnType<typeof inspectSkuTaskQuality>>();
    for (const t of skuTasks) {
      map.set(t.id, inspectSkuTaskQuality(t, prodAssets, caseAssets));
    }
    return map;
  }, [skuTasks, prodAssets, caseAssets]);

  const tasksWithIssuesCount = useMemo(() => {
    let count = 0;
    for (const q of skuQualityMap.values()) {
      if (!q.passed) count += 1;
    }
    return count;
  }, [skuQualityMap]);

  const handleAutoFixAllSkuTasks = () => {
    let fixedCount = 0;
    for (const t of skuTasks) {
      const q = skuQualityMap.get(t.id);
      if (q && !q.passed) {
        const fixed = autoFixSkuTaskQuality(t, prodAssets, caseAssets);
        onUpdateSkuTask(t.id, {
          productRefIds: fixed.productRefIds,
          visualPrompt: fixed.visualPrompt,
          typographyPlan: fixed.typographyPlan,
          sellingPointBadge: fixed.sellingPointBadge,
        });
        fixedCount += 1;
      }
    }
    if (fixedCount > 0) {
      onShowToast(
        `已自动预检并修复 ${fixedCount} 张主图卡片的配图冲突、参考图姿态互补角与提示词内部编号！`,
        'success'
      );
    } else {
      onShowToast('当前全部主图卡片均已通过防变形质量预检！', 'info');
    }
  };

  // Import image from URL into Reference (#Case) pool
  const handleImportImageUrl = async () => {
    const cleanUrl = urlInputText.trim();
    if (!cleanUrl || !/^https?:\/\//i.test(cleanUrl)) {
      onShowToast('请输入有效的图片 HTTP/HTTPS 链接', 'error');
      return;
    }
    setIsImportingUrl(true);
    try {
      const resp = await fetch(cleanUrl);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const blob = await resp.blob();
      const ext = blob.type.split('/')[1] || 'jpg';
      const file = new File([blob], `ref_link_${Date.now()}.${ext}`, {
        type: blob.type || 'image/jpeg',
      });
      const dt = new DataTransfer();
      dt.items.add(file);
      onUploadFiles(dt.files, 'case');
      setUrlInputText('');
      setShowUrlInput(false);
      onShowToast('已成功从链接导入参考图', 'success');
    } catch {
      onShowToast(
        '链接跨域受限，请直接右键复制图片后在此页面 Ctrl+V 粘贴或本地上传',
        'error'
      );
    } finally {
      setIsImportingUrl(false);
    }
  };

  const handleBuildOrSyncReplicaCards = () => {
    if (caseAssets.length === 0 && prodAssets.length === 0) {
      onShowToast('请先上传至少 1 张参考图或产品原图', 'error');
      return;
    }
    if (onSyncReplicaPairsAndRun) {
      onSyncReplicaPairsAndRun(false);
    }
  };

  const handleOneClickReplicaGenerate = () => {
    if (caseAssets.length === 0 && prodAssets.length === 0) {
      onShowToast('请先在左侧上传参考图与产品原图', 'error');
      return;
    }
    if (onSyncReplicaPairsAndRun) {
      onSyncReplicaPairsAndRun(true);
    } else {
      onStartBatchGenerateSkus(false);
    }
  };

  const toggleExpandTaskPrompt = (taskId: string) => {
    setExpandedTaskPromptIds((prev) =>
      prev.includes(taskId)
        ? prev.filter((id) => id !== taskId)
        : [...prev, taskId]
    );
  };

  const toggleExpandPrint4D = (taskId: string) => {
    setExpandedPrint4DTaskIds((prev) =>
      prev.includes(taskId)
        ? prev.filter((id) => id !== taskId)
        : [...prev, taskId]
    );
  };

  // Cycle 4D Print Theme Inspiration for a specific card ("🎲 换灵感")
  const handleRollCardPrintInspiration = (
    task: SkuTask,
    boundProd?: ReferenceImageItem
  ) => {
    const hintText = `${task.skuTitle || ''} ${boundProd?.tag || ''} ${boundProd?.name || ''}`;
    const currentSeed = inspirationSeedMap[task.id] ?? -1;
    let nextIdx = (currentSeed + 1) % PRINT_THEME_INSPIRATION_POOL.length;
    if (currentSeed === -1) {
      const matchedIdx = PRINT_THEME_INSPIRATION_POOL.findIndex((p) =>
        p.keywords.test(hintText)
      );
      if (matchedIdx !== -1) nextIdx = matchedIdx;
    }
    const picked = PRINT_THEME_INSPIRATION_POOL[nextIdx];
    setInspirationSeedMap((prev) => ({ ...prev, [task.id]: nextIdx }));
    onUpdateSkuTask(task.id, {
      styleLinkageMode: 'print_4d',
      printThemeConfig: {
        enabled: true,
        printStory: picked.story,
        themePalette: picked.palette,
        themeStage: picked.stage,
        themeElements: picked.elements,
        themeUiStyle: picked.uiStyle,
      },
    });
    onShowToast(
      `已为 #${String(task.skuIndex).padStart(2, '0')} 切换印花联动灵感：「${picked.story}」`,
      'success'
    );
  };

  const openFissionModalForTask = (task: SkuTask) => {
    const candidatePool =
      enabledProdAssets.length > 1 ? enabledProdAssets : prodAssets;
    const unboundCandidates = candidatePool.filter(
      (p) => !task.productRefIds.includes(p.id)
    );
    // Prefer only hero_front colorway assets by default so structural angle shots (single earbud / bottom closeup) are not mistakenly fissioned as SKU colorways
    const heroFrontColorways = unboundCandidates
      .filter((p) => getEffectiveProdRole(p) === 'hero_front')
      .map((p) => p.id);
    const otherProds = unboundCandidates.map((p) => p.id);
    const defaultSelected =
      heroFrontColorways.length > 0
        ? heroFrontColorways
        : otherProds.length > 0
          ? otherProds
          : candidatePool.map((p) => p.id);
    setFissionModal({
      open: true,
      sourceTask: task,
      selectedProdIds: defaultSelected,
      useCompletedAsCase: Boolean(task.resultImageUrl),
    });
  };

  return (
    <div className="flex-1 flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden bg-[#F4F5F7]">
      {/* Hidden File Inputs */}
      <input
        ref={caseFileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          onUploadFiles(e.target.files, 'case');
          e.target.value = '';
        }}
      />
      <input
        ref={prodFileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          onUploadFiles(e.target.files, 'product');
          e.target.value = '';
        }}
      />

      {/* ================= LEFT SIDEBAR: STREAMLINED REPLICA CONTROL PANEL (395px) ================= */}
      <aside className="w-full lg:w-[395px] xl:w-[410px] shrink-0 lg:h-full bg-white border-b lg:border-b-0 lg:border-r border-slate-200/80 flex flex-col lg:overflow-hidden select-none">
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
          {/* 1. 对标参考图 (#Case) */}
          <section className="space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-[13px] font-bold text-slate-900">
                  1. 爆款参考图 (#Case)
                </span>
                <span className="text-[11px] text-slate-400 font-mono-tabular">
                  ({caseAssets.length}张)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowUrlInput((prev) => !prev)}
                  title="通过图片 URL 链接导入参考图"
                  className={`text-[11px] font-medium flex items-center gap-1 cursor-pointer ${
                    showUrlInput
                      ? 'text-slate-900 font-semibold'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Link2 className="w-3 h-3" />
                  <span>链接</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setAssetLibraryModal({
                      open: true,
                      category: 'case',
                      selectedIds: [],
                    })
                  }
                  className="text-[11px] font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer"
                >
                  <BookmarkCheck className="w-3 h-3" />
                  <span>资产库</span>
                </button>
                {caseAssets.length > 0 && (
                  <button
                    type="button"
                    onClick={() => onClearSkuCategoryAssets('case')}
                    className="text-[11px] text-slate-400 hover:text-rose-600 cursor-pointer"
                  >
                    清空
                  </button>
                )}
              </div>
            </div>

            {showUrlInput && (
              <div className="flex items-center gap-2">
                <input
                  type="url"
                  value={urlInputText}
                  onChange={(e) => setUrlInputText(e.target.value)}
                  placeholder="粘贴竞品主图 URL（或直接在页面按 Ctrl+V 粘贴截图）..."
                  className="flex-1 h-8 px-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:border-slate-900"
                />
                <button
                  type="button"
                  disabled={isImportingUrl}
                  onClick={handleImportImageUrl}
                  className="h-8 px-3 text-xs font-semibold bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:opacity-50 cursor-pointer shrink-0"
                >
                  {isImportingUrl ? '导入中' : '导入'}
                </button>
              </div>
            )}

            {/* Reference Thumbnail Row (图1, 图2, ... + Add Tile) */}
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                onUploadFiles(e.dataTransfer.files, 'case');
              }}
              className={`grid grid-cols-4 gap-2 ${
                !isCaseGridExpanded && caseAssets.length >= 8
                  ? 'max-h-[168px] overflow-y-auto pr-1'
                  : ''
              }`}
            >
              {caseAssets.map((ref, idx) => (
                <div
                  key={ref.id}
                  onClick={() =>
                    onPreviewImage(
                      ref.previewUrl,
                      `参考图 ${idx + 1}`,
                      ref.name
                    )
                  }
                  className="relative aspect-square rounded-xl overflow-hidden bg-slate-100 border border-slate-200/80 group cursor-zoom-in"
                >
                  <img
                    src={ref.previewUrl}
                    alt={ref.tag}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                  <span className="absolute bottom-1 left-1 bg-slate-900/80 text-white text-[10px] font-medium px-1.5 py-0.5 rounded-md font-mono-tabular">
                    参考{idx + 1}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveSkuAsset(ref.id);
                    }}
                    className="absolute top-1 right-1 w-5 h-5 rounded-full bg-slate-900/70 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-rose-600 transition-opacity cursor-pointer"
                    title="移除此参考图"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}

              <button
                type="button"
                onClick={() => caseFileInputRef.current?.click()}
                className="aspect-square rounded-xl border border-dashed border-slate-300 hover:border-slate-500 bg-slate-50/70 hover:bg-slate-100/70 flex flex-col items-center justify-center gap-1 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                title="点击、拖拽或 Ctrl+V 粘贴上传同行爆款主图（如5张套图）"
              >
                <Plus className="w-5 h-5" />
                <span className="text-[10px] font-medium">添加参考图</span>
              </button>
            </div>
            {caseAssets.length >= 8 && (
              <button
                type="button"
                onClick={() => setIsCaseGridExpanded((prev) => !prev)}
                className="w-full py-1 text-[11px] font-medium text-slate-500 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 rounded-lg flex items-center justify-center gap-1 cursor-pointer"
              >
                <span>
                  {isCaseGridExpanded
                    ? '收起参考图列表'
                    : `展开全部 ${caseAssets.length} 张参考图`}
                </span>
                {isCaseGridExpanded ? (
                  <ChevronUp className="w-3 h-3" />
                ) : (
                  <ChevronDown className="w-3 h-3" />
                )}
              </button>
            )}

            {/* Collapsible Per-Image Reference Requirements (单张参考要求) */}
            {caseAssets.length > 0 && (
              <div>
                <button
                  type="button"
                  onClick={() => setShowPerRefRules((prev) => !prev)}
                  className="flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-slate-900 cursor-pointer"
                >
                  <span>单张参考图微调要求 ({caseAssets.length})</span>
                  {showPerRefRules ? (
                    <ChevronUp className="w-3 h-3 text-slate-400" />
                  ) : (
                    <ChevronDown className="w-3 h-3 text-slate-400" />
                  )}
                </button>

                {showPerRefRules && (
                  <div className="mt-1.5 space-y-1.5 max-h-32 overflow-y-auto pr-0.5">
                    {caseAssets.map((ref, idx) => (
                      <div
                        key={`rule-${ref.id}`}
                        className="flex items-center bg-slate-50 border border-slate-200/70 rounded-lg px-2.5 h-7.5 focus-within:bg-white focus-within:border-slate-400 transition-colors"
                      >
                        <span className="text-[11px] font-medium text-slate-600 shrink-0 mr-2 font-mono-tabular">
                          图{idx + 1}:
                        </span>
                        <input
                          type="text"
                          value={ref.caseCustomRule || ''}
                          onChange={(e) =>
                            onUpdateCaseCustomRule?.(ref.id, e.target.value)
                          }
                          placeholder="选填：如去掉人手、文案改为蓝牙6.0..."
                          className="w-full text-xs text-slate-800 placeholder:text-slate-400 bg-transparent focus:outline-none"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>

          {/* 2. 产品原图 (#Prod) + 勾选参与开关 + AI 视角识别 + 套图/裂变双模式切换 */}
          <section className="space-y-2.5 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between gap-1.5">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-[13px] font-bold text-slate-900 whitespace-nowrap shrink-0">
                  2. 自有产品图 (#Prod)
                </span>
                <span
                  className="px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200/80 text-[10px] font-mono-tabular font-semibold whitespace-nowrap shrink-0"
                  title={`已勾选启用 ${enabledProdCount} 张 / 共 ${prodAssets.length} 张产品图`}
                >
                  {enabledProdCount}/{prodAssets.length}
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {prodAssets.length > 0 && (
                  <button
                    type="button"
                    disabled={isAnalyzingRefs}
                    onClick={onAutoAnalyzeRefs}
                    title="AI 自动识别每张产品图的拍摄视角（正面/开盖/单耳/多色）与花色名称"
                    className="h-5.5 px-1.5 rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200/80 text-[11px] font-semibold flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
                  >
                    {isAnalyzingRefs ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <ScanEye className="w-3 h-3" />
                    )}
                    <span>{isAnalyzingRefs ? '识图中' : 'AI识图'}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() =>
                    setAssetLibraryModal({
                      open: true,
                      category: 'product',
                      selectedIds: [],
                    })
                  }
                  className="text-[11px] font-medium text-blue-600 hover:text-blue-700 flex items-center gap-0.5 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <BookmarkCheck className="w-3 h-3 shrink-0" />
                  <span>资产库</span>
                </button>
                {prodAssets.length > 0 && (
                  <button
                    type="button"
                    onClick={() => onClearSkuCategoryAssets('product')}
                    className="text-[11px] text-slate-400 hover:text-rose-600 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    清空
                  </button>
                )}
              </div>
            </div>

            {/* Quick Participation Filter Bar (仅勾选素材参与当前套图或裂变生成) */}
            {prodAssets.length > 1 && onBatchSetSkuAssetsEnabled && (
              <div className="flex items-center justify-between gap-1 px-2 py-1 bg-slate-50 border border-slate-200/80 rounded-lg text-[10px]">
                <span className="text-slate-500 font-medium whitespace-nowrap shrink-0">
                  勾选生图:
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onBatchSetSkuAssetsEnabled('all')}
                    className="px-1.5 py-0.5 rounded bg-white hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200/90 font-medium whitespace-nowrap cursor-pointer"
                    title="全部勾选参与当前工作台排卡与生图"
                  >
                    全选
                  </button>
                  <button
                    type="button"
                    onClick={() => onBatchSetSkuAssetsEnabled('angles_only')}
                    className="px-1.5 py-0.5 rounded bg-white hover:bg-blue-50 text-blue-700 border border-blue-200 font-semibold whitespace-nowrap cursor-pointer"
                    title="仅保留第1张主推花色 + 全部结构角度图（开盖/单耳/微距/包装），最适合套图模式防花色打架"
                  >
                    仅1款+多角度
                  </button>
                  <button
                    type="button"
                    onClick={() => onBatchSetSkuAssetsEnabled('patterns_only')}
                    className="px-1.5 py-0.5 rounded bg-white hover:bg-purple-50 text-purple-700 border border-purple-200 font-medium whitespace-nowrap cursor-pointer"
                    title="仅勾选各款正面主视图，适合多花色SKU裂变"
                  >
                    仅各款花色
                  </button>
                  <button
                    type="button"
                    onClick={() => onBatchSetSkuAssetsEnabled('invert')}
                    className="px-1.5 py-0.5 rounded bg-white hover:bg-slate-100 text-slate-600 border border-slate-200/90 whitespace-nowrap cursor-pointer"
                    title="反向勾选"
                  >
                    反选
                  </button>
                </div>
              </div>
            )}

            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                onUploadFiles(e.dataTransfer.files, 'product');
              }}
              className={`grid grid-cols-4 gap-2 ${
                isProdGridExpanded && prodAssets.length > 12
                  ? 'max-h-[340px] overflow-y-auto pr-1'
                  : ''
              }`}
            >
              {(isProdGridExpanded || prodAssets.length <= 7
                ? prodAssets
                : prodAssets.slice(0, 7)
              ).map((prod, idx) => {
                const isEnabled = prod.enabled !== false;
                const roleVal = prod.prodAngleRole || 'hero_front';
                const isSpecialRole = roleVal !== 'hero_front';
                const roleBadgeColor =
                  roleVal === 'open_case'
                    ? 'bg-blue-600/90 text-white'
                    : roleVal === 'single_earbud'
                      ? 'bg-emerald-600/90 text-white'
                      : roleVal === 'detail_closeup'
                        ? 'bg-amber-600/90 text-white'
                        : roleVal === 'multi_sku'
                          ? 'bg-purple-600/90 text-white'
                          : roleVal === 'package_accessory'
                            ? 'bg-teal-600/90 text-white'
                            : 'bg-slate-900/85 text-white';

                return (
                  <div
                    key={prod.id}
                    className={`flex flex-col gap-1 transition-opacity ${
                      isEnabled ? 'opacity-100' : 'opacity-45 grayscale-[30%]'
                    }`}
                  >
                    <div
                      onClick={() =>
                        onPreviewImage(
                          prod.previewUrl,
                          `产品原图 #${prod.code || `P${idx + 1}`} (${prod.tag})`,
                          prod.name
                        )
                      }
                      className={`relative aspect-square rounded-xl overflow-hidden bg-slate-100 border group cursor-zoom-in ${
                        isEnabled
                          ? 'border-blue-500/70 ring-1 ring-blue-500/20'
                          : 'border-slate-200/80'
                      }`}
                    >
                      <img
                        src={prod.previewUrl}
                        alt={prod.tag}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                      {/* Top-left Compact Participation Checkbox + Short Index */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleSkuAssetEnabled?.(prod.id);
                        }}
                        title={
                          isEnabled
                            ? `已启用 #${prod.code || `Prod-${idx + 1}`}（点击暂停此图参与排卡生图）`
                            : `已暂停 #${prod.code || `Prod-${idx + 1}`}（点击重新启用）`
                        }
                        className={`absolute top-1 left-1 z-10 h-4 px-1 rounded flex items-center gap-0.5 text-[9px] font-mono-tabular font-bold transition-colors cursor-pointer ${
                          isEnabled
                            ? 'bg-blue-600/95 text-white shadow-2xs'
                            : 'bg-slate-900/70 text-slate-300 hover:bg-slate-900'
                        }`}
                      >
                        <span className="w-2.5 h-2.5 rounded-xs border border-white/80 flex items-center justify-center">
                          {isEnabled && <Check className="w-2 h-2 stroke-[3]" />}
                        </span>
                        <span>#{idx + 1}</span>
                      </button>

                      {/* Angle Role Selector: Hidden by default for standard 'hero_front' to avoid visual clutter; always visible when set to a special angle or on hover */}
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className={`absolute bottom-0 inset-x-0 z-10 transition-opacity ${
                          isSpecialRole
                            ? 'opacity-100'
                            : 'opacity-0 group-hover:opacity-100'
                        }`}
                      >
                        <select
                          value={roleVal}
                          onChange={(e) =>
                            onUpdateSkuProdRole?.(
                              prod.id,
                              e.target.value as ProductAngleRole
                            )
                          }
                          title="点击切换该产品图的拍摄视角角色（默认正面主视自动隐藏，悬停可改）"
                          className={`w-full py-0.5 px-1 text-[9px] text-center font-medium focus:outline-none cursor-pointer ${roleBadgeColor}`}
                        >
                          {PROD_ANGLE_ROLE_OPTIONS.map((opt) => (
                            <option
                              key={opt.value}
                              value={opt.value}
                              className="bg-slate-900 text-white"
                            >
                              {opt.shortLabel || opt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveSkuAsset(prod.id);
                        }}
                        className="absolute top-1 right-1 w-4 h-4 rounded-full bg-slate-900/70 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-rose-600 transition-opacity cursor-pointer"
                        title="移除此产品图"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </div>
                    <input
                      type="text"
                      value={prod.tag || ''}
                      onChange={(e) =>
                        onUpdateSkuAssetTag?.(prod.id, e.target.value)
                      }
                      placeholder={`款式/视角 ${idx + 1}`}
                      title="可编辑花色名或视角备注（如：太空芝士鼠·正面）"
                      className="w-full h-5 px-1 text-[10px] text-slate-700 bg-slate-50 border border-slate-200/80 rounded-md focus:bg-white focus:outline-none focus:border-slate-900 text-center truncate"
                    />
                  </div>
                );
              })}

              <button
                type="button"
                onClick={() => prodFileInputRef.current?.click()}
                className="aspect-square rounded-xl border border-dashed border-slate-300 hover:border-slate-500 bg-slate-50/70 hover:bg-slate-100/70 flex flex-col items-center justify-center gap-0.5 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                title="点击或拖拽上传多角度产品实拍图（正面/开盖/单耳/细节）或多花色产品图"
              >
                <Plus className="w-4 h-4" />
                <span className="text-[10px] font-medium">添加产品图</span>
              </button>
            </div>

            {prodAssets.length > 7 && (
              <button
                type="button"
                onClick={() => setIsProdGridExpanded((prev) => !prev)}
                className="w-full py-1 text-[11px] font-medium text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200/60 rounded-lg flex items-center justify-center gap-1 cursor-pointer transition-colors"
              >
                <span>
                  {isProdGridExpanded
                    ? '收起产品图网格 (仅显示前 2 行)'
                    : `展开全部 ${prodAssets.length} 张产品图 (其余 ${prodAssets.length - 7} 张已折叠)`}
                </span>
                {isProdGridExpanded ? (
                  <ChevronUp className="w-3 h-3" />
                ) : (
                  <ChevronDown className="w-3 h-3" />
                )}
              </button>
            )}

            {/* Upgraded Dual Pairing Mode Selector (同款多角度套图 vs 多花色SKU裂变) */}
            <div className="space-y-1.5 pt-0.5">
              <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-xl">
                <button
                  type="button"
                  onClick={() =>
                    onUpdateSkuBatchConfig({
                      replicaMatchMode: 'single_prod_to_multi_ref',
                    })
                  }
                  className={`py-1.5 px-2 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                    replicaMatchMode === 'single_prod_to_multi_ref'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  套图模式 · 多角度配场景
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onUpdateSkuBatchConfig({
                      replicaMatchMode: 'multi_prod_to_single_ref',
                    })
                  }
                  className={`py-1.5 px-2 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                    replicaMatchMode === 'multi_prod_to_single_ref'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  裂变模式 · 多花色套母版
                </button>
              </div>
              <p className="text-[11px] text-slate-500 leading-snug px-0.5">
                {replicaMatchMode === 'single_prod_to_multi_ref'
                  ? '💡 套图模式：按参考图张数排卡，AI 为每张场景自动从上方挑选最匹配的 1~5 个角度产品图（正面/开盖/单耳）组合陈列。'
                  : '💡 裂变模式：按产品花色张数排卡，每款花色套用同1张母版参考图并自动生成各自专属的印花4维联动背景。'}
              </p>
            </div>
          </section>

          {/* 3. 复刻程度 + 印花与色调联动模式 */}
          <section className="space-y-3 pt-2 border-t border-slate-100 relative">
            <div className="space-y-1.5">
              <span className="block text-[13px] font-bold text-slate-900">
                3. 复刻程度与印花联动
              </span>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    {
                      value: 'high_replica' as ReplicaFidelity,
                      label: '高度复刻 (锁构图版式)',
                    },
                    {
                      value: 'style_ref' as ReplicaFidelity,
                      label: '参考风格 (创意重排)',
                    },
                  ] as const
                ).map((item) => {
                  const active = replicaFidelity === item.value;
                  return (
                    <div
                      key={item.value}
                      onMouseEnter={() => setHoveredFidelity(item.value)}
                      onMouseLeave={() => setHoveredFidelity(null)}
                      onClick={() =>
                        onUpdateSkuBatchConfig({ replicaFidelity: item.value })
                      }
                      className={`h-8.5 px-2.5 rounded-xl border text-xs font-medium flex items-center justify-between transition-all cursor-pointer ${
                        active
                          ? 'border-slate-900 bg-slate-900 text-white font-semibold shadow-2xs'
                          : 'border-slate-200/90 bg-slate-50/60 text-slate-600 hover:border-slate-300 hover:bg-white'
                      }`}
                    >
                      <span className="truncate">{item.label}</span>
                      <Info
                        className={`w-3.5 h-3.5 shrink-0 ${
                          active ? 'text-slate-300' : 'text-slate-400'
                        }`}
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            {hoveredFidelity && (
              <div className="absolute left-0 right-0 bottom-full mb-2 p-3 bg-slate-900 text-white rounded-2xl shadow-2xl z-40 space-y-1.5 pointer-events-none border border-slate-700">
                <div className="text-xs font-bold text-amber-300">
                  {hoveredFidelity === 'high_replica'
                    ? '高度复刻 · 1:1锁定参考图构图机位与版式骨架'
                    : '参考风格 · 借鉴参考图色调光影，围绕产品重新布景'}
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  {hoveredFidelity === 'high_replica'
                    ? '严格保留参考图的镜头视角、主副标题区、Bento卖点宫格或子卡片结构，将商品100%替换为您的多角度产品图。'
                    : '提取参考图的美学光影与氛围，围绕您的产品原图与印花故事生成更具呼吸感的全新构图。'}
                </p>
              </div>
            )}

            {/* 印花与场景联动模式 */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-slate-700">
                    场景与壳面印花联动
                  </span>
                  <div
                    onMouseEnter={() => setShowConsistencyTooltip(true)}
                    onMouseLeave={() => setShowConsistencyTooltip(false)}
                    className="text-slate-400 hover:text-slate-700 cursor-help relative"
                  >
                    <Info className="w-3.5 h-3.5" />
                    {showConsistencyTooltip && (
                      <div className="absolute left-0 bottom-full mb-2 w-72 p-2.5 bg-slate-900 text-white text-[11px] leading-relaxed rounded-xl shadow-xl z-40 pointer-events-none font-normal">
                        <p className="font-bold text-amber-300 mb-1">
                          🎨 印花4维联动（卡通/多花色强烈推荐）：
                        </p>
                        根据产品壳面印花（如芝士鼠、美梦兔、露营刺猬），自动重塑：①60-30-10背景色板、②泡泡玛特风潮玩底座、③2~3个漂浮伴生小符号、④同色系圆角卖点胶囊，彻底告别死板黑棕框！
                      </div>
                    )}
                  </div>
                </div>
                <span className="text-[10px] text-slate-400">
                  {styleLinkageMode === 'print_4d'
                    ? '色板+底座+元素+胶囊4维联动'
                    : styleLinkageMode === 'color_sync'
                      ? '全图同色系顺应'
                      : '锁死参考图原背景色'}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-xl">
                {(
                  [
                    {
                      mode: 'print_4d' as StyleLinkageMode,
                      label: '🎨 印花4维联动',
                      consistent: true,
                    },
                    {
                      mode: 'color_sync' as StyleLinkageMode,
                      label: '✨ 同色系顺应',
                      consistent: true,
                    },
                    {
                      mode: 'lock_scene' as StyleLinkageMode,
                      label: '🔒 锁死原背景',
                      consistent: false,
                    },
                  ] as const
                ).map((opt) => {
                  const active = styleLinkageMode === opt.mode;
                  return (
                    <button
                      key={opt.mode}
                      type="button"
                      onClick={() =>
                        onUpdateSkuBatchConfig({
                          styleLinkageMode: opt.mode,
                          consistentOutputStyle: opt.consistent,
                          consistentStyle: opt.consistent,
                        })
                      }
                      className={`h-7 px-1.5 rounded-lg text-[11px] font-semibold transition-all cursor-pointer truncate ${
                        active
                          ? 'bg-white text-slate-900 shadow-2xs'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          {/* 4. 全局卖点文案与生成规格 */}
          <section className="space-y-2.5 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between gap-2 relative">
              <span className="block text-[13px] font-bold text-slate-900">
                4. 核心卖点与画幅规格
              </span>

              <div className="flex items-center gap-1.5">
                {effectivePresets.length > 0 && (
                  <div className="relative" data-preset-menu-root="true">
                    <button
                      type="button"
                      onClick={() =>
                        setShowGlobalPresetMenu((prev) => !prev)
                      }
                      className="h-6 px-2 rounded-md bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200/80 text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                      title="从防丢常用卖点库一键填入卖点文案与默认标题前缀"
                    >
                      <Zap className="w-3 h-3 text-amber-600" />
                      <span>常用卖点 ({effectivePresets.length})</span>
                      <ChevronDown className="w-3 h-3" />
                    </button>

                    {showGlobalPresetMenu && (
                      <div className="absolute right-0 top-full mt-1.5 w-72 bg-white border border-slate-200 rounded-xl shadow-xl p-2 z-40 space-y-1">
                        <div className="flex items-center justify-between px-2 py-1 border-b border-slate-100">
                          <span className="text-[11px] font-bold text-slate-800">
                            ⚡ 一键套用常用卖点方案
                          </span>
                          {onOpenPresetSettings && (
                            <button
                              type="button"
                              onClick={() => {
                                setShowGlobalPresetMenu(false);
                                onOpenPresetSettings();
                              }}
                              className="text-[10px] font-semibold text-blue-600 hover:underline flex items-center gap-0.5 cursor-pointer"
                            >
                              <Settings className="w-2.5 h-2.5" />
                              <span>管理方案库</span>
                            </button>
                          )}
                        </div>
                        <div className="max-h-52 overflow-y-auto space-y-1 py-0.5">
                          {effectivePresets.map((preset) => (
                            <button
                              key={preset.id}
                              type="button"
                              onClick={() => {
                                const combinedText = [
                                  preset.sellingPointBadge,
                                  preset.packageSpecNote,
                                ]
                                  .map((s) => (s || '').trim())
                                  .filter(Boolean)
                                  .join(' ｜ ');
                                onUpdateSkuBatchConfig({
                                  referenceInfoText: combinedText,
                                  ...(preset.titlePrefix
                                    ? { titlePrefix: preset.titlePrefix }
                                    : {}),
                                  ...(preset.subtitleText
                                    ? { subtitleText: preset.subtitleText }
                                    : {}),
                                });
                                setShowGlobalPresetMenu(false);
                                onShowToast(
                                  `已填入常用卖点方案「${preset.label}」`,
                                  'success'
                                );
                              }}
                              className="w-full text-left p-2 rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-200/80 transition-all cursor-pointer"
                            >
                              <div className="text-xs font-bold text-slate-900 truncate">
                                {preset.label}
                              </div>
                              <div className="text-[11px] text-slate-500 truncate mt-0.5">
                                {preset.sellingPointBadge}
                                {preset.packageSpecNote
                                  ? ` · ${preset.packageSpecNote}`
                                  : ''}
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {skuBatchConfig.referenceInfoText && (
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateSkuBatchConfig({ referenceInfoText: '' })
                    }
                    className="text-[11px] text-slate-400 hover:text-rose-600 cursor-pointer"
                  >
                    清空
                  </button>
                )}
              </div>
            </div>
            <textarea
              rows={2}
              value={skuBatchConfig.referenceInfoText}
              onChange={(e) =>
                onUpdateSkuBatchConfig({ referenceInfoText: e.target.value })
              }
              placeholder="选填：输入核心卖点（如：蓝牙V6.0｜ENC通话降噪｜3.4g无感佩戴｜50H续航），AI排卡时将自动替换到各张主图对应槽位..."
              className="w-full p-2.5 text-xs leading-relaxed bg-slate-100/80 border border-slate-200/70 rounded-xl focus:bg-white focus:outline-none focus:border-slate-900 text-slate-800 placeholder:text-slate-400 resize-none"
            />

            <div className="grid grid-cols-3 gap-2 pt-0.5">
              {/* Language Selector */}
              <div className="relative flex items-center bg-slate-100/90 border border-slate-200/70 rounded-xl px-2.5 h-9">
                <Globe className="w-3.5 h-3.5 text-slate-500 mr-1.5 shrink-0" />
                <select
                  value={replicaLanguage}
                  onChange={(e) => {
                    const lang = e.target.value as ReplicaLanguage;
                    onUpdateSkuBatchConfig({
                      replicaLanguage: lang,
                      textMode: lang === 'none' ? 'without_text' : 'with_text',
                    });
                  }}
                  className="w-full text-xs font-medium text-slate-800 bg-transparent focus:outline-none appearance-none cursor-pointer pr-3"
                >
                  {REPLICA_LANGUAGES.map((l) => (
                    <option key={l.value} value={l.value}>
                      {l.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3 h-3 text-slate-400 absolute right-2 pointer-events-none" />
              </div>

              {/* Aspect Ratio Selector */}
              <div className="relative flex items-center bg-slate-100/90 border border-slate-200/70 rounded-xl px-2.5 h-9">
                <Layers className="w-3.5 h-3.5 text-slate-500 mr-1.5 shrink-0" />
                <select
                  value={skuBatchConfig.defaultAspectRatio}
                  onChange={(e) =>
                    onUpdateSkuBatchConfig({
                      defaultAspectRatio: e.target.value as AspectRatioOption,
                    })
                  }
                  className="w-full text-xs font-mono-tabular font-semibold text-slate-800 bg-transparent focus:outline-none appearance-none cursor-pointer pr-3"
                >
                  {REPLICA_ASPECT_RATIOS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3 h-3 text-slate-400 absolute right-2 pointer-events-none" />
              </div>

              {/* Resolution Segmented Switcher (1K | 2K) */}
              <div className="grid grid-cols-2 p-0.5 bg-slate-100 border border-slate-200/70 rounded-xl h-9 items-center">
                {(['1K', '2K'] as ImageSizeOption[]).map((sz) => {
                  const active = skuBatchConfig.defaultImageSize === sz;
                  return (
                    <button
                      key={sz}
                      type="button"
                      onClick={() =>
                        onUpdateSkuBatchConfig({ defaultImageSize: sz })
                      }
                      className={`h-full rounded-lg text-xs font-mono-tabular font-semibold transition-all cursor-pointer ${
                        active
                          ? 'bg-white text-slate-900 shadow-2xs'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      {sz}
                    </button>
                  );
                })}
              </div>
            </div>
          </section>
        </div>

        {/* Bottom Sticky Action Footer */}
        <div className="p-4 border-t border-slate-200/80 bg-white space-y-2 shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleBuildOrSyncReplicaCards}
              disabled={isParsingSkuPlan || isSkuBatchRunning}
              title="先在右侧生成配对任务卡并由 AI 自动完成多角度配图与印花4维联动规划，可微调后再出图"
              className="h-10 px-3 rounded-xl border border-slate-200 hover:border-slate-300 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-700 flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 shrink-0"
            >
              {isParsingSkuPlan ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
              ) : (
                <SlidersHorizontal className="w-3.5 h-3.5 text-slate-600" />
              )}
              <span>先排卡微调</span>
            </button>

            {isSkuBatchRunning ? (
              <button
                type="button"
                onClick={onStopBatchGenerateSkus}
                className="flex-1 h-10 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-colors cursor-pointer"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>停止批量复刻</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleOneClickReplicaGenerate}
                disabled={isParsingSkuPlan}
                className="flex-1 h-10 rounded-xl bg-[#1F2329] hover:bg-black text-white text-[13px] font-bold flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>一键复刻爆款图 ({plannedPairCount}张)</span>
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* ================= RIGHT CANVAS: REPLICA WORKSPACE & 5-CARD GUIDE ================= */}
      <main className="flex-1 min-w-0 lg:h-full flex flex-col overflow-hidden">
        {/* Top Canvas Header Bar */}
        <div className="h-13 shrink-0 bg-white border-b border-slate-200/80 px-5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <h2 className="text-sm font-bold text-slate-900 truncate">
              主图 / SKU 爆款复刻画布
            </h2>
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-500">
              <span>
                {replicaFidelity === 'high_replica' ? '高度复刻' : '参考风格'}
              </span>
              <span aria-hidden="true">·</span>
              <span>
                {styleLinkageMode === 'print_4d'
                  ? '印花4维联动'
                  : styleLinkageMode === 'color_sync'
                    ? '同色系顺应'
                    : '锁死原场景'}
              </span>
              {skuTasks.length > 0 && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono-tabular font-semibold text-slate-800">
                    已完成 {completedTasksCount}/{skuTasks.length} 张
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Global Pre-Flight Quality Inspector & 1-Click Auto-Fix Button */}
            {skuTasks.length > 0 && (
              <button
                type="button"
                onClick={handleAutoFixAllSkuTasks}
                title={
                  tasksWithIssuesCount > 0
                    ? `检测到 ${tasksWithIssuesCount} 张卡片存在配图冲突或提示词编号泄漏，点击一键自动修复全部卡片`
                    : '全部主图卡片已通过防变形预检（点击可重新扫描并收敛视角配图）'
                }
                className={`h-8 px-2.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 border transition-all cursor-pointer ${
                  tasksWithIssuesCount > 0
                    ? 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-300 shadow-2xs'
                    : 'bg-emerald-50/80 hover:bg-emerald-100/80 text-emerald-700 border-emerald-200'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                <span>
                  {tasksWithIssuesCount > 0
                    ? `一键修复冲突 (${tasksWithIssuesCount})`
                    : '防变形预检通过'}
                </span>
              </button>
            )}

            {/* View Mode Segmented Switcher: 双栏精修 vs 5列橱窗总览 */}
            {skuTasks.length > 0 && (
              <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200/80">
                <button
                  type="button"
                  onClick={() => handleSelectCanvasViewMode('detailed_2col')}
                  title="双栏精修视图：展示左参考/产品配对图 + 右成图 + 完整印花4维参数"
                  className={`h-7 px-2.5 rounded-md text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                    canvasViewMode === 'detailed_2col'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  <Columns2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">双栏精修</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectCanvasViewMode('showcase_5col')}
                  title="5列橱窗总览：一屏横排审阅全套 5 张主图的色调统一感、历史版本切换与快捷锁图微调"
                  className={`h-7 px-2.5 rounded-md text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                    canvasViewMode === 'showcase_5col'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">5列橱窗</span>
                </button>
              </div>
            )}

            {(prodAssets.length > 0 || caseAssets.length > 0) &&
              onSaveSkuAssetsToLibrary && (
                <button
                  type="button"
                  onClick={() => onSaveSkuAssetsToLibrary()}
                  className="h-8 px-2.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/70 rounded-lg flex items-center gap-1.5 cursor-pointer"
                >
                  <BookmarkCheck className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">存至资产库</span>
                </button>
              )}

            {ossEnabled &&
              (prodAssets.length > 0 || caseAssets.length > 0) &&
              onUploadSkuRefsToOss && (
                <button
                  type="button"
                  disabled={isSyncingOss}
                  onClick={() =>
                    onUploadSkuRefsToOss([...prodAssets, ...caseAssets])
                  }
                  className="h-8 px-2.5 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isSyncingOss ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <CloudUpload className="w-3.5 h-3.5" />
                  )}
                  <span className="hidden md:inline">同步 {cloudShort}</span>
                </button>
              )}

            {skuTasks.length > 0 && onExtendReplicaToDetail && (
              <div className="flex items-center bg-slate-900 text-white rounded-lg p-0.5 shadow-2xs">
                <span className="px-2 text-[11px] font-semibold text-amber-300 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  <span>同源转详情页:</span>
                </span>
                <button
                  type="button"
                  onClick={() => onExtendReplicaToDetail('3:4', undefined, true)}
                  title="将当前整套主图卖点、印花4维配方与已出图画面一键流转为 3:4 详情页分屏模块"
                  className="h-7 px-2.5 text-xs font-semibold bg-white/10 hover:bg-white/20 rounded-md transition-colors cursor-pointer"
                >
                  转 3:4 详情
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onExtendReplicaToDetail('9:16', undefined, true)
                  }
                  title="将当前整套主图卖点、印花4维配方与已出图画面一键流转为 9:16 竖屏详情页模块"
                  className="h-7 px-2.5 text-xs font-semibold hover:bg-white/20 rounded-md transition-colors cursor-pointer"
                >
                  转 9:16 长屏
                </button>
              </div>
            )}

            {completedTasksCount > 0 && (
              <button
                type="button"
                disabled={isExportingSkuZip}
                onClick={onExportSkuZip}
                className="h-8 px-3.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center gap-1.5 shadow-2xs cursor-pointer disabled:opacity-50"
              >
                {isExportingSkuZip ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <FileArchive className="w-3.5 h-3.5" />
                )}
                <span>打包下载 ({completedTasksCount})</span>
              </button>
            )}
          </div>
        </div>

        {/* Main Canvas Content Area */}
        <div className="flex-1 overflow-y-auto p-5">
          {skuTasks.length === 0 ? (
            /* ================= EMPTY STATE: 5-CARD STANDARD MAIN IMAGE ARCHITECTURE GUIDE ================= */
            <div className="max-w-5xl mx-auto space-y-5 py-3">
              {/* Top Hero Quick Start Card */}
              <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-2xs flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5">
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-slate-500">
                    主图与详情页同源工作流 · 多角度配图 + 印花 4 维联动
                  </div>
                  <h3 className="text-lg font-bold text-slate-900">
                    先做出高转化 5 张主图套图，再一键纵向延展为 3:4 / 9:16 详情页
                  </h3>
                  <p className="text-xs text-slate-500 leading-relaxed max-w-2xl">
                    支持上传同一款产品的多个拍摄角度（正面印花/开盖双耳/单耳佩戴/多花色合集）。AI 排卡时将根据每张参考图的构图自动组合多角度产品，并根据壳面卡通印花联动重塑背景色板、潮玩底座、漂浮伴生元素与圆角卖点胶囊。
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => caseFileInputRef.current?.click()}
                    className="h-10 px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-xs font-bold text-slate-800 flex items-center gap-2 cursor-pointer shadow-2xs"
                  >
                    <Upload className="w-4 h-4 text-slate-600" />
                    <span>1. 上传参考图 ({caseAssets.length})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => prodFileInputRef.current?.click()}
                    className="h-10 px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-xs font-bold text-slate-800 flex items-center gap-2 cursor-pointer shadow-2xs"
                  >
                    <Upload className="w-4 h-4 text-blue-600" />
                    <span>2. 上传多角度产品图 ({prodAssets.length})</span>
                  </button>
                  {onBuildStandardFiveMainCards && (
                    <button
                      type="button"
                      onClick={onBuildStandardFiveMainCards}
                      className="h-10 px-4 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-bold flex items-center gap-2 cursor-pointer shadow-sm"
                    >
                      <Sparkles className="w-4 h-4 text-amber-300" />
                      <span>⚡ 一键创建标准 5 张主图槽位</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Standard 5-Card E-commerce Main Image Architecture Visual Guide */}
              <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-2xs space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">
                      标准 5 张高点击主图套图黄金结构（1:1 方图 / 3:4 竖图通用）
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      告别全套图只用单一死板正立面！点击下方任意案例可放大预览版式骨架与多角度配图逻辑：
                    </p>
                  </div>
                  <span className="text-xs text-slate-400 font-mono-tabular">
                    支持单花色出5张套图 · 或单张母版裂变N款花色
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                  {[
                    {
                      step: '主图 01',
                      title: '首焦 KV 视觉主图',
                      angle: '开盖充电仓 + 左右双耳',
                      desc: '传递第一眼高颜值与印花主题故事，搭配潮玩微缩底座与顶部大标题',
                      img: '/assets/aistudio/image_55e8a89d.png',
                    },
                    {
                      step: '主图 02',
                      title: '核心卖点 Bento 合集',
                      angle: '顶部多色一字排开 + 局部',
                      desc: '上1/3展示产品矩阵，下2/3采用圆角Bento宫格浓缩6大核心卖点',
                      img: '/assets/aistudio/image_4f2f807f.png',
                    },
                    {
                      step: '主图 03',
                      title: '单卖点深挖 · 音质/降噪',
                      angle: '中景多角度机身 + 悬浮双耳',
                      desc: '聚焦1~2个核心技术卖点（如双模式/声学结构），配底部双胶囊数据卡',
                      img: '/assets/aistudio/image_156527f9.png',
                    },
                    {
                      step: '主图 04',
                      title: '单卖点深挖 · 舒适佩戴',
                      angle: '单只耳机入耳特写 + 称重子卡',
                      desc: '突出人体工学无感佩戴与轻量克重，搭配底部左右双子卡建立信任',
                      img: '/assets/aistudio/image_38f99d04.png',
                    },
                    {
                      step: '主图 05',
                      title: '多花色 SKU 全家福矩阵',
                      angle: '全部印花/配色款式合集',
                      desc: '斜向色带或矩阵排列全部花色款式，直观促成多款式挑款下单',
                      img: '/assets/aistudio/image_30d75aca.png',
                    },
                  ].map((item) => (
                    <div
                      key={item.step}
                      onClick={() =>
                        onPreviewImage(
                          item.img,
                          `${item.step} · ${item.title}`,
                          `推荐绑定视角：${item.angle}`
                        )
                      }
                      className="rounded-xl border border-slate-200/90 hover:border-slate-900 bg-slate-50/50 hover:bg-white p-2.5 flex flex-col justify-between gap-2 transition-all cursor-zoom-in group"
                    >
                      <div className="space-y-1.5">
                        <div className="aspect-square rounded-lg overflow-hidden bg-white border border-slate-200/80">
                          <img
                            src={item.img}
                            alt={item.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono-tabular pt-0.5">
                          <span>{item.step}</span>
                          <span className="text-blue-600 font-medium truncate max-w-[110px]">
                            {item.angle}
                          </span>
                        </div>
                        <div className="text-xs font-bold text-slate-900">
                          {item.title}
                        </div>
                        <p className="text-[11px] text-slate-500 leading-relaxed line-clamp-3">
                          {item.desc}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : canvasViewMode === 'showcase_5col' ? (
            /* ================= 5-COLUMN SHOWCASE OVERVIEW GRID (5列橱窗总览视图) ================= */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3.5">
              {skuTasks.map((task, idx) => {
                const boundProds = prodAssets.filter((p) =>
                  task.productRefIds.includes(p.id)
                );
                const effectiveBoundProds =
                  boundProds.length > 0 ? boundProds : prodAssets.slice(0, 1);
                const boundProd = effectiveBoundProds[0];
                const boundCase =
                  caseAssets.find((c) => task.caseRefIds.includes(c.id)) ||
                  caseAssets[idx % Math.max(1, caseAssets.length)];
                const isGenerating =
                  task.status === 'generating' ||
                  generatingPromptSkuTaskId === task.id;
                const themeCfg: PrintThemeLinkageConfig =
                  task.printThemeConfig || {
                    printStory: '',
                    themePalette: '',
                    themeStage: '',
                    themeElements: '',
                    themeUiStyle: '',
                  };
                const hexSwatches = extractHexSwatches(
                  `${themeCfg.themePalette} ${themeCfg.themeUiStyle}`
                );
                const orderedHistory = [...(task.historyImages || [])].reverse();

                return (
                  <div
                    key={task.id}
                    className="bg-white border border-slate-200/90 hover:border-slate-300 rounded-2xl p-3 shadow-2xs flex flex-col justify-between gap-2.5 transition-all"
                  >
                    <div className="space-y-2">
                      {/* Compact Card Header: Index + Editable Title + Delete */}
                      <div className="flex items-center justify-between gap-1.5">
                        <div className="flex items-center gap-1.5 min-w-0 flex-1">
                          <span className="px-1.5 py-0.5 rounded bg-slate-900 text-white text-[10px] font-mono-tabular font-bold shrink-0">
                            #{String(task.skuIndex || idx + 1).padStart(2, '0')}
                          </span>
                          <input
                            type="text"
                            value={task.skuTitle}
                            onChange={(e) => {
                              const nextTitle = e.target.value;
                              const nextCopy = Array.from(
                                new Set(
                                  [
                                    nextTitle,
                                    task.sellingPointBadge,
                                    task.packageSpecNote,
                                  ]
                                    .map((s) => (s || '').trim())
                                    .filter(Boolean)
                                )
                              ).join('\n');
                              onUpdateSkuTask(task.id, {
                                skuTitle: nextTitle,
                                typographyPlan: nextCopy,
                              });
                            }}
                            placeholder="主标题/款式..."
                            className="w-full h-6 px-1.5 text-xs font-bold text-slate-900 bg-slate-50 border border-slate-200 rounded-md focus:bg-white focus:outline-none focus:border-slate-900 truncate"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => onDeleteSkuTask(task.id)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50 cursor-pointer shrink-0"
                          title="删除此卡"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>

                      {/* Large Showcase Preview Box */}
                      <div
                        className={`relative w-full ${getAspectBoxClass(
                          task.aspectRatio
                        )} rounded-xl overflow-hidden bg-slate-50 border border-slate-200 flex items-center justify-center group`}
                      >
                        {isGenerating ? (
                          <div className="flex flex-col items-center gap-1.5 text-xs text-slate-500">
                            <Loader2 className="w-5 h-5 animate-spin text-slate-900" />
                            <span className="text-[11px]">正在渲染...</span>
                          </div>
                        ) : task.resultImageUrl ? (
                          <>
                            <img
                              src={task.resultImageUrl}
                              alt={task.skuTitle}
                              onClick={() =>
                                onPreviewImage(
                                  task.resultImageUrl!,
                                  `复刻成图 #${task.skuIndex} · ${task.skuTitle}`,
                                  `${task.aspectRatio} · ${task.imageSize}`
                                )
                              }
                              className="w-full h-full object-contain cursor-zoom-in bg-white"
                            />
                            {/* Corner Source Mini Badges */}
                            <div className="absolute top-1.5 left-1.5 flex items-center gap-1 bg-slate-900/75 backdrop-blur-xs px-1.5 py-0.5 rounded-md text-[9px] text-white font-mono-tabular">
                              <span>{task.aspectRatio}</span>
                              {hexSwatches.length > 0 && (
                                <span className="flex items-center -space-x-0.5 ml-0.5">
                                  {hexSwatches.slice(0, 3).map((hex) => (
                                    <span
                                      key={hex}
                                      style={{ backgroundColor: hex }}
                                      className="w-2.5 h-2.5 rounded-full border border-white/80 inline-block"
                                    />
                                  ))}
                                </span>
                              )}
                            </div>

                            <div className="absolute bottom-1.5 right-1.5 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                type="button"
                                onClick={() =>
                                  onPreviewImage(
                                    task.resultImageUrl!,
                                    `复刻成图 #${task.skuIndex} · ${task.skuTitle}`
                                  )
                                }
                                className="p-1.5 bg-slate-900/80 hover:bg-slate-900 text-white rounded-md cursor-pointer"
                                title="放大预览"
                              >
                                <Maximize2 className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => downloadSingleSkuImage(task)}
                                className="p-1.5 bg-blue-600/90 hover:bg-blue-700 text-white rounded-md cursor-pointer"
                                title="下载单图"
                              >
                                <Download className="w-3 h-3" />
                              </button>
                            </div>
                          </>
                        ) : task.status === 'error' ? (
                          <div className="p-3 text-center space-y-1">
                            <AlertCircle className="w-4 h-4 text-rose-500 mx-auto" />
                            <p className="text-[10px] text-rose-600 line-clamp-2">
                              {task.errorMessage || '生图失败，请点击重绘'}
                            </p>
                          </div>
                        ) : (
                          <div className="p-3 flex flex-col items-center gap-2 text-center">
                            <div className="flex items-center gap-1.5">
                              {boundCase && (
                                <img
                                  src={boundCase.previewUrl}
                                  alt={boundCase.tag}
                                  referrerPolicy="no-referrer"
                                  className="w-10 h-10 rounded-lg object-cover border border-slate-200"
                                />
                              )}
                              {boundProd && (
                                <img
                                  src={boundProd.previewUrl}
                                  alt={boundProd.tag}
                                  referrerPolicy="no-referrer"
                                  className="w-10 h-10 rounded-lg object-cover border border-blue-200"
                                />
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => onGenerateSingleSkuImage(task)}
                              className="text-[11px] font-semibold text-slate-500 hover:text-slate-900 flex items-center gap-1 cursor-pointer"
                            >
                              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                              <span>点击立即出图</span>
                            </button>
                          </div>
                        )}
                      </div>

                      {/* History Version Strip (v1 / v2 / v3...) */}
                      {orderedHistory.length > 0 && (
                        <div className="flex items-center justify-between gap-1 px-1 py-1 rounded-lg bg-slate-50 border border-slate-200/70">
                          <span className="text-[10px] font-semibold text-slate-400 flex items-center gap-0.5 shrink-0">
                            <History className="w-2.5 h-2.5" />
                            <span>版本:</span>
                          </span>
                          <div className="flex items-center gap-1 overflow-x-auto">
                            {orderedHistory.map((hItem, vIdx) => {
                              const isCurrentVersion =
                                task.resultImageUrl === hItem.url;
                              return (
                                <button
                                  key={`${task.id}-v-${vIdx}-${hItem.timestamp}`}
                                  type="button"
                                  onClick={() => {
                                    onUpdateSkuTask(task.id, {
                                      resultImageUrl: hItem.url,
                                      resultOssUrl: hItem.ossUrl,
                                      resultCloudUrls: hItem.cloudUrls,
                                      status: 'completed',
                                    });
                                    onShowToast(
                                      `已切换至 v${vIdx + 1} 历史版本（${hItem.timestamp}）`,
                                      'info'
                                    );
                                  }}
                                  title={`切换至 v${vIdx + 1} (${hItem.timestamp})`}
                                  className={`h-5 px-1.5 rounded text-[10px] font-mono-tabular font-bold flex items-center gap-1 transition-all cursor-pointer shrink-0 ${
                                    isCurrentVersion
                                      ? 'bg-slate-900 text-white shadow-2xs'
                                      : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-400'
                                  }`}
                                >
                                  <span>v{vIdx + 1}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Single-line Selling Point Quick Edit */}
                      <input
                        type="text"
                        value={task.sellingPointBadge}
                        onChange={(e) => {
                          const nextBadge = e.target.value;
                          const nextCopy = Array.from(
                            new Set(
                              [
                                task.skuTitle,
                                nextBadge,
                                task.packageSpecNote,
                              ]
                                .map((s) => (s || '').trim())
                                .filter(Boolean)
                            )
                          ).join('\n');
                          onUpdateSkuTask(task.id, {
                            sellingPointBadge: nextBadge,
                            typographyPlan: nextCopy,
                          });
                        }}
                        placeholder="画面副标题 / 卖点胶囊..."
                        className="w-full h-6.5 px-2 text-[11px] bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:border-slate-900 text-slate-700 truncate"
                      />

                      {/* Lock Current Result Refinement Input (when locked) */}
                      {task.resultImageUrl && task.lockResultAsRef && (
                        <input
                          type="text"
                          value={task.refineInstruction || ''}
                          onChange={(e) =>
                            onUpdateSkuTask(task.id, {
                              refineInstruction: e.target.value,
                            })
                          }
                          placeholder="🔒 输入局部微调指令（如：大字改亮黄色）..."
                          className="w-full h-6.5 px-2 text-[11px] bg-amber-50/90 border border-amber-300 rounded-lg focus:bg-white focus:outline-none focus:border-amber-600 text-amber-950 placeholder:text-amber-600/70"
                        />
                      )}
                    </div>

                    {/* Showcase Card Bottom Action Bar */}
                    <div className="pt-1 border-t border-slate-100 flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1">
                        {task.resultImageUrl && (
                          <button
                            type="button"
                            onClick={() =>
                              onUpdateSkuTask(task.id, {
                                lockResultAsRef: !task.lockResultAsRef,
                              })
                            }
                            title="开启后将以当前满意成图为构图锚点，仅对文案或局部细节做微调重绘"
                            className={`h-7 px-2 rounded-lg text-[10px] font-semibold border flex items-center gap-1 transition-all cursor-pointer ${
                              task.lockResultAsRef
                                ? 'bg-amber-500 text-white border-amber-600 shadow-2xs'
                                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            {task.lockResultAsRef ? (
                              <Lock className="w-3 h-3" />
                            ) : (
                              <Unlock className="w-3 h-3" />
                            )}
                            <span>锁图微调</span>
                          </button>
                        )}

                        {prodAssets.length > 1 && onFissionTaskToOtherProds && (
                          <button
                            type="button"
                            onClick={() => openFissionModalForTask(task)}
                            title="拿此图一键裂变其他花色"
                            className="h-7 px-1.5 rounded-lg border border-blue-200 bg-blue-50/70 hover:bg-blue-100 text-[10px] font-semibold text-blue-700 flex items-center gap-0.5 cursor-pointer"
                          >
                            <CopyPlus className="w-3 h-3" />
                            <span>裂变</span>
                          </button>
                        )}

                        {onExtendReplicaToDetail && (
                          <div className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50 overflow-hidden">
                            <button
                              type="button"
                              onClick={() =>
                                onExtendReplicaToDetail('3:4', task, true)
                              }
                              title="将本张主图直接流转为 ② 详情页工作台的 3:4 竖版分屏"
                              className="h-7 px-1.5 hover:bg-slate-200/70 text-[10px] font-semibold text-slate-700 cursor-pointer border-r border-slate-200"
                            >
                              转3:4
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                onExtendReplicaToDetail('9:16', task, true)
                              }
                              title="将本张主图直接流转为 ② 详情页工作台的 9:16 手机全屏详情分屏"
                              className="h-7 px-1.5 hover:bg-slate-200/70 text-[10px] font-semibold text-slate-700 cursor-pointer"
                            >
                              转9:16
                            </button>
                          </div>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => onGenerateSingleSkuImage(task)}
                        disabled={isGenerating}
                        className={`h-7 px-2.5 rounded-lg text-white text-[11px] font-semibold flex items-center gap-1 cursor-pointer disabled:opacity-50 ${
                          task.lockResultAsRef && task.resultImageUrl
                            ? 'bg-amber-600 hover:bg-amber-700'
                            : 'bg-slate-900 hover:bg-black'
                        }`}
                      >
                        {isGenerating ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <RefreshCw className="w-3 h-3" />
                        )}
                        <span>
                          {task.resultImageUrl
                            ? task.lockResultAsRef
                              ? '微调重绘'
                              : '重绘'
                            : '出图'}
                        </span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* ================= POPULATED STATE: REPLICA TASK CARDS GRID (双栏精修视图) ================= */
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {skuTasks.map((task, idx) => {
                const boundProds = prodAssets.filter((p) =>
                  task.productRefIds.includes(p.id)
                );
                const effectiveBoundProds =
                  boundProds.length > 0 ? boundProds : prodAssets.slice(0, 1);
                const boundProd = effectiveBoundProds[0];
                const boundCase =
                  caseAssets.find((c) => task.caseRefIds.includes(c.id)) ||
                  caseAssets[idx % Math.max(1, caseAssets.length)];
                const isGenerating =
                  task.status === 'generating' ||
                  generatingPromptSkuTaskId === task.id;
                const isPromptExpanded = expandedTaskPromptIds.includes(
                  task.id
                );
                const isPrint4DExpanded = expandedPrint4DTaskIds.includes(
                  task.id
                );
                const cardLinkageMode =
                  task.styleLinkageMode || styleLinkageMode;
                const showPrint4DBar =
                  cardLinkageMode === 'print_4d' ||
                  Boolean(task.printThemeConfig);
                const themeCfg: PrintThemeLinkageConfig =
                  task.printThemeConfig || {
                    printStory: '',
                    themePalette: '',
                    themeStage: '',
                    themeElements: '',
                    themeUiStyle: '',
                  };
                const hexSwatches = extractHexSwatches(
                  `${themeCfg.themePalette} ${themeCfg.themeUiStyle}`
                );
                const hasThemeContent = Boolean(
                  themeCfg.printStory ||
                    themeCfg.themePalette ||
                    themeCfg.themeStage ||
                    themeCfg.themeElements
                );
                const orderedHistory = [...(task.historyImages || [])].reverse();

                const toggleCardProdRef = (prodId: string) => {
                  const currentIds =
                    task.productRefIds.length > 0
                      ? task.productRefIds
                      : boundProd
                        ? [boundProd.id]
                        : [];
                  const exists = currentIds.includes(prodId);
                  let nextIds: string[];
                  if (exists) {
                    nextIds =
                      currentIds.length > 1
                        ? currentIds.filter((id) => id !== prodId)
                        : [prodId];
                  } else {
                    nextIds = [...currentIds, prodId].slice(0, 5);
                  }
                  onUpdateSkuTask(task.id, { productRefIds: nextIds });
                };

                const updateCardPrintTheme = (
                  patch: Partial<PrintThemeLinkageConfig>
                ) => {
                  onUpdateSkuTask(task.id, {
                    printThemeConfig: {
                      enabled: true,
                      ...themeCfg,
                      ...patch,
                    },
                  });
                };

                return (
                  <div
                    key={task.id}
                    className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs flex flex-col gap-3.5 hover:border-slate-300 transition-all"
                  >
                    {/* Card Top Bar */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0 flex-wrap">
                        <span className="px-2 py-0.5 rounded-md bg-slate-900 text-white text-xs font-mono-tabular font-bold">
                          #{String(task.skuIndex || idx + 1).padStart(2, '0')}
                        </span>
                        <input
                          type="text"
                          value={task.skuTitle}
                          onChange={(e) => {
                            const nextTitle = e.target.value;
                            const nextCopy = Array.from(
                              new Set(
                                [
                                  nextTitle,
                                  task.sellingPointBadge,
                                  task.packageSpecNote,
                                ]
                                  .map((s) => (s || '').trim())
                                  .filter(Boolean)
                              )
                            ).join('\n');
                            onUpdateSkuTask(task.id, {
                              skuTitle: nextTitle,
                              typographyPlan: nextCopy,
                            });
                          }}
                          placeholder="输入本张主标题 / 款式名称..."
                          className="text-xs font-bold text-slate-900 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 focus:bg-white focus:outline-none focus:border-slate-900 min-w-[145px]"
                        />
                        <span className="text-[11px] font-mono-tabular text-slate-400">
                          {task.aspectRatio} · {task.imageSize}
                        </span>
                        {/* Per-Card Fidelity Quick Switcher */}
                        {(() => {
                          const cardFidelity =
                            task.replicaFidelity || replicaFidelity;
                          const isHigh = cardFidelity === 'high_replica';
                          return (
                            <button
                              type="button"
                              onClick={() => {
                                const nextFidelity = isHigh
                                  ? 'style_ref'
                                  : 'high_replica';
                                onUpdateSkuTask(task.id, {
                                  replicaFidelity: nextFidelity,
                                });
                              }}
                              title="点击切换此卡复刻程度（高度复刻：1:1锁机位姿态 ｜ 参考风格：借鉴色调光影重构场景）"
                              className={`h-6 px-2 rounded-md text-[10px] font-semibold border transition-all cursor-pointer ${
                                isHigh
                                  ? 'bg-slate-900 text-white border-slate-900'
                                  : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                              }`}
                            >
                              {isHigh ? '高度复刻' : '参考风格'}
                            </button>
                          );
                        })()}
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {task.resultImageUrl && (
                          <button
                            type="button"
                            onClick={() =>
                              onUpdateSkuTask(task.id, {
                                lockResultAsRef: !task.lockResultAsRef,
                              })
                            }
                            title="开启后将以本卡当前满意成图为构图基准，仅对局部元素或文字进行微调重绘，不再大幅改变构图"
                            className={`h-7 px-2 rounded-lg border text-[11px] font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                              task.lockResultAsRef
                                ? 'bg-amber-500 text-white border-amber-600 shadow-2xs'
                                : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700'
                            }`}
                          >
                            {task.lockResultAsRef ? (
                              <Lock className="w-3 h-3" />
                            ) : (
                              <Unlock className="w-3 h-3" />
                            )}
                            <span>锁图微调</span>
                          </button>
                        )}
                        {prodAssets.length > 1 && onFissionTaskToOtherProds && (
                          <button
                            type="button"
                            onClick={() => openFissionModalForTask(task)}
                            title="拿此图（或版式）一键裂变出其他印花/颜色款式的同构图任务卡"
                            className="h-7 px-2 rounded-lg border border-blue-200 bg-blue-50/70 hover:bg-blue-100 text-[11px] font-semibold text-blue-700 flex items-center gap-1 cursor-pointer"
                          >
                            <CopyPlus className="w-3 h-3" />
                            <span>裂变其他花色</span>
                          </button>
                        )}
                        {onExtendReplicaToDetail && (
                          <div
                            className={`inline-flex items-center rounded-lg border overflow-hidden ${
                              task.resultImageUrl
                                ? 'border-amber-300 bg-amber-50/90'
                                : 'border-slate-200 bg-slate-50'
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() =>
                                onExtendReplicaToDetail('3:4', task, true)
                              }
                              title={
                                task.resultImageUrl
                                  ? '以当前满意主图成图为视觉基准锚点，无缝延展为 ② 详情页工作台 3:4 首屏或分屏'
                                  : '将本张主图配方流转为 ② 详情页工作台的 3:4 竖版分屏'
                              }
                              className={`h-7 px-2 text-[11px] font-medium cursor-pointer border-r ${
                                task.resultImageUrl
                                  ? 'hover:bg-amber-100/80 text-amber-900 border-amber-200 font-semibold'
                                  : 'hover:bg-slate-200/70 text-slate-700 border-slate-200'
                              }`}
                            >
                              {task.resultImageUrl ? '🔗同源延展3:4' : '转3:4详情'}
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                onExtendReplicaToDetail('9:16', task, true)
                              }
                              title={
                                task.resultImageUrl
                                  ? '以当前满意主图成图为视觉基准锚点，无缝延展为 ② 详情页工作台 9:16 手机全屏首屏或分屏'
                                  : '将本张主图配方流转为 ② 详情页工作台的 9:16 手机全屏竖版分屏'
                              }
                              className={`h-7 px-2 text-[11px] font-medium cursor-pointer ${
                                task.resultImageUrl
                                  ? 'hover:bg-amber-100/80 text-amber-900 font-semibold'
                                  : 'hover:bg-slate-200/70 text-slate-700'
                              }`}
                            >
                              {task.resultImageUrl ? '9:16长屏' : '转9:16长屏'}
                            </button>
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => setInspectingPayloadTaskId(task.id)}
                          title="生图前真实投喂透视镜：查看实际传给生图模型的图片顺序、已过滤冗余图与防变形护栏指令"
                          className="h-7 px-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                        >
                          <ScanEye className="w-3.5 h-3.5 text-indigo-600" />
                          <span>透视</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onGenerateSingleSkuImage(task)}
                          disabled={isGenerating}
                          className={`h-7 px-3 rounded-lg text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 ${
                            task.lockResultAsRef && task.resultImageUrl
                              ? 'bg-amber-600 hover:bg-amber-700'
                              : 'bg-slate-900 hover:bg-black'
                          }`}
                        >
                          {isGenerating ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <RefreshCw className="w-3 h-3" />
                          )}
                          <span>
                            {task.resultImageUrl
                              ? task.lockResultAsRef
                                ? '🔒 锁图微调重绘'
                                : '重新复刻'
                              : '立即复刻'}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteSkuTask(task.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 cursor-pointer"
                          title="删除此卡"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Visual Comparison Row: [参考图 + 多角度产品原图] ---> [自适应比例复刻结果图 + 历史版本条] */}
                    <div className="grid grid-cols-12 gap-3 items-stretch bg-slate-50/80 border border-slate-200/60 rounded-xl p-3">
                      {/* Left 5 cols: Source Inputs (#Case + Multi-Angle #Prod) */}
                      <div className="col-span-5 flex flex-col justify-between gap-2">
                        <div className="grid grid-cols-2 gap-2">
                          {/* Bound Case */}
                          <div className="space-y-1">
                            <span className="block text-[10px] font-semibold text-slate-500 truncate">
                              参考图 {boundCase ? `(#${boundCase.code})` : ''}
                            </span>
                            {boundCase ? (
                              <div
                                onClick={() =>
                                  onPreviewImage(
                                    boundCase.previewUrl,
                                    `参考图 #${boundCase.code}`,
                                    boundCase.tag
                                  )
                                }
                                className="aspect-square rounded-lg overflow-hidden bg-white border border-slate-200 cursor-zoom-in"
                              >
                                <img
                                  src={boundCase.previewUrl}
                                  alt={boundCase.tag}
                                  referrerPolicy="no-referrer"
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            ) : (
                              <div className="aspect-square rounded-lg border border-dashed border-slate-300 flex items-center justify-center text-[10px] text-slate-400">
                                无参考图
                              </div>
                            )}
                          </div>

                          {/* Bound Prod(s) — Single or Multi-Angle Grid */}
                          <div className="space-y-1">
                            <span className="block text-[10px] font-semibold text-blue-600 truncate">
                              {effectiveBoundProds.length > 1
                                ? `已配 ${effectiveBoundProds.length} 个角度/款式`
                                : `产品原图 ${boundProd ? `(#${boundProd.code})` : ''}`}
                            </span>
                            {effectiveBoundProds.length > 1 ? (
                              <div className="aspect-square rounded-lg overflow-hidden bg-white border border-blue-200 p-1 grid grid-cols-2 gap-1">
                                {effectiveBoundProds.slice(0, 4).map((p) => (
                                  <div
                                    key={p.id}
                                    onClick={() =>
                                      onPreviewImage(
                                        p.previewUrl,
                                        `产品原图 #${p.code}`,
                                        p.tag
                                      )
                                    }
                                    className="relative rounded overflow-hidden bg-slate-100 cursor-zoom-in"
                                  >
                                    <img
                                      src={p.previewUrl}
                                      alt={p.tag}
                                      referrerPolicy="no-referrer"
                                      className="w-full h-full object-cover"
                                    />
                                  </div>
                                ))}
                              </div>
                            ) : boundProd ? (
                              <div
                                onClick={() =>
                                  onPreviewImage(
                                    boundProd.previewUrl,
                                    `产品原图 #${boundProd.code}`,
                                    boundProd.tag
                                  )
                                }
                                className="aspect-square rounded-lg overflow-hidden bg-white border border-blue-200 cursor-zoom-in"
                              >
                                <img
                                  src={boundProd.previewUrl}
                                  alt={boundProd.tag}
                                  referrerPolicy="no-referrer"
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            ) : (
                              <div className="aspect-square rounded-lg border border-dashed border-slate-300 flex items-center justify-center text-[10px] text-slate-400">
                                无产品图
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Quick Switchers for Bound Case & Multi-Select #Prod Buttons */}
                        <div className="flex-1 flex flex-col justify-end space-y-1.5 pt-0.5">
                          {caseAssets.length > 1 && (
                            <select
                              value={boundCase?.id || ''}
                              onChange={(e) =>
                                onUpdateSkuTask(task.id, {
                                  caseRefIds: e.target.value
                                    ? [e.target.value]
                                    : [],
                                })
                              }
                              className="w-full h-6.5 px-2 text-[11px] bg-white border border-slate-200 rounded-md text-slate-700"
                            >
                              {caseAssets.map((c, cIdx) => (
                                <option key={c.id} value={c.id}>
                                  切换参考：图{cIdx + 1} ({c.tag})
                                </option>
                              ))}
                            </select>
                          )}

                          {prodAssets.length > 1 && (
                            <div className="space-y-1">
                              <div className="flex items-center justify-between gap-1">
                                <div className="flex items-center gap-1 min-w-0">
                                  <span className="text-[10px] font-semibold text-slate-600 whitespace-nowrap">
                                    点选视角/款式
                                  </span>
                                  {skuQualityMap.get(task.id)?.passed && (
                                    <span
                                      className="px-1 py-0.2 rounded bg-emerald-50 border border-emerald-200/90 text-emerald-700 text-[9px] font-medium whitespace-nowrap"
                                      title="生图预检通过：无内部编号污染，无异款花色打架"
                                    >
                                      ✓预检通过
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const picked = smartPickComplementaryProds(
                                        {
                                          skuDiffMode: task.skuDiffMode,
                                          title: task.skuTitle,
                                          prompt: task.visualPrompt,
                                          refCaseTitle: boundCase?.tag,
                                          refCaseRule:
                                            boundCase?.caseCustomRule,
                                          enabledProds: enabledProdAssets,
                                          preferredPrimaryProdId:
                                            boundProd?.id,
                                        }
                                      );
                                      if (picked.length > 0) {
                                        onUpdateSkuTask(task.id, {
                                          productRefIds: picked.map(
                                            (p) => p.id
                                          ),
                                        });
                                        onShowToast(
                                          `已根据 #Case 参考姿态与主题智能匹配 ${picked.length} 张互补视角（防异款花色打架）`,
                                          'success'
                                        );
                                      }
                                    }}
                                    title="AI根据本卡 #Case 参考图姿态与主题，自动从已启用产品图中挑选1~2张互补角度（如正面+开盖/单耳），杜绝多花色打架变形"
                                    className="text-[10px] font-semibold text-emerald-700 hover:text-emerald-800 whitespace-nowrap cursor-pointer"
                                  >
                                    ✨AI配互补角
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const allSelected =
                                        effectiveBoundProds.length > 1;
                                      onUpdateSkuTask(task.id, {
                                        productRefIds: allSelected
                                          ? [
                                              (
                                                enabledProdAssets[0] ||
                                                prodAssets[0]
                                              ).id,
                                            ]
                                          : enabledProdAssets
                                              .slice(0, 5)
                                              .map((p) => p.id),
                                      });
                                    }}
                                    className="text-[10px] font-semibold text-blue-600 hover:text-blue-700 whitespace-nowrap cursor-pointer"
                                  >
                                    {effectiveBoundProds.length > 1
                                      ? '仅留首图'
                                      : '全家福'}
                                  </button>
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-1 max-h-[112px] overflow-y-auto p-1 bg-white/90 border border-slate-200/80 rounded-lg">
                                {prodAssets.map((p, pIdx) => {
                                  const isSelected = effectiveBoundProds.some(
                                    (bp) => bp.id === p.id
                                  );
                                  const isProdEnabled = p.enabled !== false;
                                  const roleOption =
                                    PROD_ANGLE_ROLE_OPTIONS.find(
                                      (o) => o.value === p.prodAngleRole
                                    );
                                  const isSpecialAngle =
                                    p.prodAngleRole &&
                                    p.prodAngleRole !== 'hero_front';
                                  const cleanTag = (p.tag || p.name || '')
                                    .replace(/\.(png|jpe?g|webp)$/i, '')
                                    .replace(/^(TWS\d+[-_]?)/i, '')
                                    .trim();
                                  const shortText =
                                    cleanTag ||
                                    (isSpecialAngle
                                      ? roleOption?.shortLabel
                                      : '') ||
                                    `产品${pIdx + 1}`;
                                  return (
                                    <button
                                      key={p.id}
                                      type="button"
                                      onClick={() => toggleCardProdRef(p.id)}
                                      title={`#${p.code || `P${pIdx + 1}`} ${p.tag || `商品${pIdx + 1}`}${roleOption ? ` · ${roleOption.label}` : ''}${!isProdEnabled ? ' (左侧未启用)' : ''}（点击可多选组合）`}
                                      className={`h-6.5 px-1.5 rounded-md border text-[10px] flex items-center gap-1 min-w-0 transition-all cursor-pointer ${
                                        isSelected
                                          ? 'border-blue-600 bg-blue-50 text-blue-700 font-semibold shadow-2xs'
                                          : isProdEnabled
                                            ? 'border-slate-200/90 bg-slate-50/60 text-slate-600 hover:bg-white hover:border-slate-300'
                                            : 'border-slate-200/50 bg-slate-100/50 text-slate-400 opacity-50 hover:opacity-85'
                                      }`}
                                    >
                                      <img
                                        src={p.previewUrl}
                                        alt={p.tag}
                                        referrerPolicy="no-referrer"
                                        className="w-4 h-4 rounded-xs object-cover shrink-0"
                                      />
                                      <span className="font-mono-tabular text-[9px] opacity-75 shrink-0">
                                        #{pIdx + 1}
                                      </span>
                                      <span className="truncate flex-1 text-left">
                                        {shortText}
                                      </span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Per-Card Pre-Flight Quality Warning & 1-Click Auto-Fix Bar (Only shown when conflict detected) */}
                          {(() => {
                            const q = skuQualityMap.get(task.id);
                            if (!q || q.passed) return null;
                            return (
                              <div className="px-2 py-1 rounded-md bg-amber-50 border border-amber-300/90 flex items-center justify-between gap-1">
                                <span className="text-[10px] font-bold text-amber-900 truncate">
                                  {q.issues.map((i) => i.label).join(' · ')}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const fixed = autoFixSkuTaskQuality(
                                      task,
                                      prodAssets,
                                      caseAssets
                                    );
                                    onUpdateSkuTask(task.id, {
                                      productRefIds: fixed.productRefIds,
                                      visualPrompt: fixed.visualPrompt,
                                      typographyPlan: fixed.typographyPlan,
                                      sellingPointBadge:
                                        fixed.sellingPointBadge,
                                    });
                                    onShowToast(
                                      `已自动修复 #${String(task.skuIndex).padStart(2, '0')} 的配图、参考姿态互补角与提示词冲突！`,
                                      'success'
                                    );
                                  }}
                                  className="px-1.5 py-0.5 rounded bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-semibold shrink-0 cursor-pointer"
                                >
                                  ⚡一键修复
                                </button>
                              </div>
                            );
                          })()}
                        </div>
                      </div>

                      {/* Center Arrow */}
                      <div className="col-span-1 flex items-center justify-center text-slate-400">
                        <ArrowRight className="w-4 h-4" />
                      </div>

                      {/* Right 6 cols: Generated Replica Output (Dynamic Aspect Ratio) + History Version Strip */}
                      <div className="col-span-6 flex flex-col gap-2">
                        <div
                          className={`relative w-full ${getAspectBoxClass(
                            task.aspectRatio
                          )} mx-auto rounded-xl overflow-hidden bg-white border ${
                            task.lockResultAsRef && task.resultImageUrl
                              ? 'border-amber-400 ring-2 ring-amber-400/25'
                              : 'border-slate-200'
                          } flex items-center justify-center group`}
                        >
                          {isGenerating ? (
                            <div className="flex flex-col items-center gap-2 text-xs text-slate-500">
                              <Loader2 className="w-6 h-6 animate-spin text-slate-900" />
                              <span>正在渲染 ({task.aspectRatio})...</span>
                            </div>
                          ) : task.resultImageUrl ? (
                            <>
                              <img
                                src={task.resultImageUrl}
                                alt={task.skuTitle}
                                onClick={() =>
                                  onPreviewImage(
                                    task.resultImageUrl!,
                                    `复刻成图 #${task.skuIndex} · ${task.skuTitle}`,
                                    `${task.aspectRatio} · ${task.imageSize}`
                                  )
                                }
                                className="w-full h-full object-contain cursor-zoom-in"
                              />
                              {task.lockResultAsRef && (
                                <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-amber-500 text-white text-[10px] font-bold flex items-center gap-1 shadow-xs">
                                  <Lock className="w-2.5 h-2.5" />
                                  <span>已锁定此成图为微调基准</span>
                                </span>
                              )}
                              <div className="absolute bottom-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  type="button"
                                  onClick={() =>
                                    onPreviewImage(
                                      task.resultImageUrl!,
                                      `复刻成图 #${task.skuIndex} · ${task.skuTitle}`
                                    )
                                  }
                                  className="p-1.5 bg-slate-900/80 hover:bg-slate-900 text-white rounded-lg cursor-pointer"
                                  title="放大预览"
                                >
                                  <Maximize2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => downloadSingleSkuImage(task)}
                                  className="p-1.5 bg-blue-600/90 hover:bg-blue-700 text-white rounded-lg cursor-pointer"
                                  title="下载单图"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                </button>
                                {ossEnabled && (
                                  <button
                                    type="button"
                                    onClick={() => onUploadSkuResultToOss(task)}
                                    className="p-1.5 bg-emerald-600/90 hover:bg-emerald-700 text-white rounded-lg cursor-pointer"
                                    title={`归档至 ${cloudShort}`}
                                  >
                                    <CloudUpload className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </>
                          ) : task.status === 'error' ? (
                            <div className="p-3 text-center space-y-1">
                              <AlertCircle className="w-5 h-5 text-rose-500 mx-auto" />
                              <p className="text-[11px] text-rose-600 line-clamp-3">
                                {task.errorMessage || '生图失败，请点击重试'}
                              </p>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => onGenerateSingleSkuImage(task)}
                              className="flex flex-col items-center gap-1.5 text-xs text-slate-400 hover:text-slate-800 cursor-pointer"
                            >
                              <Sparkles className="w-5 h-5" />
                              <span>点击立即复刻出图 ({task.aspectRatio})</span>
                            </button>
                          )}
                        </div>

                        {/* Non-destructive History Version Strip (v1 / v2 / v3...) */}
                        {orderedHistory.length > 0 && (
                          <div className="flex items-center justify-between gap-1.5 px-2 py-1 rounded-lg bg-white border border-slate-200/80">
                            <span className="text-[10px] font-semibold text-slate-500 flex items-center gap-1 shrink-0">
                              <History className="w-3 h-3 text-slate-400" />
                              <span>历史版本 ({orderedHistory.length}):</span>
                            </span>
                            <div className="flex items-center gap-1 overflow-x-auto">
                              {orderedHistory.map((hItem, vIdx) => {
                                const isCurrentVersion =
                                  task.resultImageUrl === hItem.url;
                                return (
                                  <button
                                    key={`${task.id}-hist-${vIdx}-${hItem.timestamp}`}
                                    type="button"
                                    onClick={() => {
                                      onUpdateSkuTask(task.id, {
                                        resultImageUrl: hItem.url,
                                        resultOssUrl: hItem.ossUrl,
                                        resultCloudUrls: hItem.cloudUrls,
                                        status: 'completed',
                                      });
                                      onShowToast(
                                        `已切换至第 v${vIdx + 1} 版成图（生成于 ${hItem.timestamp}）`,
                                        'info'
                                      );
                                    }}
                                    title={`点击切换至 v${vIdx + 1} (${hItem.timestamp})`}
                                    className={`h-6 pl-1 pr-1.5 rounded-md text-[10px] font-mono-tabular font-bold flex items-center gap-1 transition-all cursor-pointer shrink-0 ${
                                      isCurrentVersion
                                        ? 'bg-slate-900 text-white shadow-2xs ring-1 ring-slate-900'
                                        : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'
                                    }`}
                                  >
                                    <img
                                      src={hItem.url}
                                      alt={`v${vIdx + 1}`}
                                      className="w-4 h-4 rounded-xs object-cover"
                                    />
                                    <span>v{vIdx + 1}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 🔒 Lock Current Result for Local Refinement Input Bar + High-Weight Rescue Chips */}
                    {task.resultImageUrl && task.lockResultAsRef && (
                      <div className="rounded-xl bg-amber-50/90 border border-amber-300/90 p-2.5 space-y-2">
                        <div className="flex flex-wrap items-center gap-1">
                          <span className="text-[10px] font-bold text-amber-900 mr-0.5 shrink-0">
                            ⚡ 一键救图指令:
                          </span>
                          {QUICK_REFINE_RESCUE_CHIPS.map((chip) => {
                            const active = (
                              task.refineInstruction || ''
                            ).includes(chip.directive);
                            return (
                              <button
                                key={chip.id}
                                type="button"
                                onClick={() =>
                                  onUpdateSkuTask(task.id, {
                                    refineInstruction:
                                      toggleRefineChipInstruction(
                                        task.refineInstruction,
                                        chip.directive
                                      ),
                                  })
                                }
                                title={chip.directive}
                                className={`h-5.5 px-2 rounded-md border text-[10px] font-semibold transition-all cursor-pointer ${
                                  active
                                    ? 'bg-amber-600 text-white border-amber-700 shadow-2xs'
                                    : 'bg-white hover:bg-amber-100/80 text-amber-900 border-amber-200'
                                }`}
                              >
                                {chip.label}
                              </button>
                            );
                          })}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-bold text-amber-900 flex items-center gap-1 shrink-0">
                            <Lock className="w-3.5 h-3.5 text-amber-600" />
                            <span>锁成图微调:</span>
                          </span>
                          <input
                            type="text"
                            value={task.refineInstruction || ''}
                            onChange={(e) =>
                              onUpdateSkuTask(task.id, {
                                refineInstruction: e.target.value,
                              })
                            }
                            placeholder="点选上方一键救图指令，或输入局部修改要求（保持构图不变，仅改局部）..."
                            className="flex-1 h-7 px-2.5 text-xs bg-white border border-amber-300 rounded-lg focus:outline-none focus:border-amber-600 text-slate-900 placeholder:text-slate-400"
                          />
                          <button
                            type="button"
                            onClick={() => onGenerateSingleSkuImage(task)}
                            disabled={isGenerating}
                            className="h-7 px-2.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-semibold flex items-center gap-1 cursor-pointer shrink-0 disabled:opacity-50"
                          >
                            <Sparkles className="w-3 h-3" />
                            <span>执行微调</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Editable Copywriting, Compact Collapsible 4D Print Theme Bar & Prompt */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 relative">
                        <span className="text-[11px] font-semibold text-slate-500 shrink-0">
                          画面卖点文案:
                        </span>
                        <input
                          type="text"
                          value={task.sellingPointBadge}
                          onChange={(e) => {
                            const nextBadge = e.target.value;
                            const nextCopy = Array.from(
                              new Set(
                                [
                                  task.skuTitle,
                                  nextBadge,
                                  task.packageSpecNote,
                                ]
                                  .map((s) => (s || '').trim())
                                  .filter(Boolean)
                              )
                            ).join('\n');
                            onUpdateSkuTask(task.id, {
                              sellingPointBadge: nextBadge,
                              typographyPlan: nextCopy,
                            });
                          }}
                          placeholder="副标题与底部胶囊卖点（如：蓝牙V6.0 ｜ ENC智能降噪 ｜ 50H超长续航）..."
                          className="flex-1 h-7 px-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:border-slate-900"
                        />

                        {/* Per-Card Selling Point Preset Quick Picker */}
                        {effectivePresets.length > 0 && (
                          <div className="relative shrink-0" data-preset-menu-root="true">
                            <button
                              type="button"
                              onClick={() =>
                                setOpenCardPresetMenuId((prev) =>
                                  prev === task.id ? null : task.id
                                )
                              }
                              title="从常用卖点方案库一键填入本卡卖点文案"
                              className="h-7 px-2 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200/80 text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                            >
                              <Zap className="w-3 h-3 text-amber-600" />
                              <span>常用卖点</span>
                            </button>

                            {openCardPresetMenuId === task.id && (
                              <div className="absolute right-0 bottom-full mb-1.5 w-68 bg-white border border-slate-200 rounded-xl shadow-xl p-2 z-30 space-y-1">
                                <div className="flex items-center justify-between px-1.5 py-1 border-b border-slate-100">
                                  <span className="text-[10px] font-bold text-slate-700">
                                    填入本卡卖点文案
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setOpenCardPresetMenuId(null)
                                    }
                                    className="text-slate-400 hover:text-slate-700 cursor-pointer"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                                <div className="max-h-44 overflow-y-auto space-y-1">
                                  {effectivePresets.map((preset) => (
                                    <button
                                      key={preset.id}
                                      type="button"
                                      onClick={() => {
                                        const nextBadge =
                                          preset.sellingPointBadge.trim();
                                        const nextSpec =
                                          (preset.packageSpecNote || '').trim() ||
                                          task.packageSpecNote;
                                        const nextCopy = Array.from(
                                          new Set(
                                            [
                                              task.skuTitle,
                                              nextBadge,
                                              nextSpec,
                                            ]
                                              .map((s) => (s || '').trim())
                                              .filter(Boolean)
                                          )
                                        ).join('\n');
                                        onUpdateSkuTask(task.id, {
                                          sellingPointBadge: nextBadge,
                                          packageSpecNote: nextSpec,
                                          typographyPlan: nextCopy,
                                        });
                                        setOpenCardPresetMenuId(null);
                                        onShowToast(
                                          `已填入卖点「${preset.label}」`,
                                          'success'
                                        );
                                      }}
                                      className="w-full text-left p-1.5 rounded-lg hover:bg-slate-50 text-xs transition-colors cursor-pointer"
                                    >
                                      <div className="font-bold text-slate-800 truncate">
                                        {preset.label}
                                      </div>
                                      <div className="text-[10px] text-slate-500 truncate">
                                        {preset.sellingPointBadge}
                                      </div>
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={() => toggleExpandTaskPrompt(task.id)}
                          className="text-[11px] text-slate-500 hover:text-slate-900 flex items-center gap-0.5 cursor-pointer shrink-0"
                        >
                          <span>画面描述</span>
                          {isPromptExpanded ? (
                            <ChevronUp className="w-3 h-3" />
                          ) : (
                            <ChevronDown className="w-3 h-3" />
                          )}
                        </button>
                      </div>

                      {/* 🎨 印花4维深度联动配方 (Compact Summary Bar + 🎲 换灵感 + Collapsible Editor) */}
                      {showPrint4DBar && (
                        <div className="rounded-xl bg-slate-50/90 border border-slate-200/80 px-2.5 py-2 space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <div
                              onClick={() => toggleExpandPrint4D(task.id)}
                              className="flex items-center gap-1.5 min-w-0 flex-1 cursor-pointer"
                            >
                              <span className="text-[11px] font-bold text-slate-800 shrink-0">
                                🎨 印花4维联动:
                              </span>
                              {/* Visual Hex Swatches */}
                              {hexSwatches.length > 0 && (
                                <div className="flex items-center -space-x-1 shrink-0 mr-0.5">
                                  {hexSwatches.map((hex) => (
                                    <span
                                      key={hex}
                                      style={{ backgroundColor: hex }}
                                      title={`提取色号: ${hex}`}
                                      className="w-3.5 h-3.5 rounded-full border border-white shadow-2xs inline-block"
                                    />
                                  ))}
                                </div>
                              )}
                              {hasThemeContent ? (
                                <span className="text-[11px] text-slate-600 truncate">
                                  {themeCfg.printStory ? (
                                    <strong className="text-slate-900 mr-1">
                                      [{themeCfg.printStory}]
                                    </strong>
                                  ) : null}
                                  {[
                                    themeCfg.themeStage,
                                    themeCfg.themeElements,
                                    themeCfg.themePalette,
                                  ]
                                    .filter(Boolean)
                                    .join(' · ')
                                  }
                                </span>
                              ) : (
                                <span className="text-[11px] text-slate-400 truncate">
                                  点击右侧「换灵感」或左侧「先排卡微调」自动生成色板+潮玩底座+伴生元素
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() =>
                                  handleRollCardPrintInspiration(
                                    task,
                                    boundProd
                                  )
                                }
                                title="一键随机切换一套契合该产品花色的潮玩底座、背景色板与伴生漂浮元素"
                                className="h-6 px-2 rounded-md bg-white hover:bg-slate-100 border border-slate-200/90 text-[10px] font-semibold text-slate-700 flex items-center gap-1 cursor-pointer"
                              >
                                <Dices className="w-3 h-3 text-blue-600" />
                                <span>换灵感</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => toggleExpandPrint4D(task.id)}
                                className="h-6 px-1.5 rounded-md text-[10px] font-medium text-slate-500 hover:text-slate-900 flex items-center gap-0.5 cursor-pointer"
                              >
                                <span>{isPrint4DExpanded ? '收起' : '微调'}</span>
                                {isPrint4DExpanded ? (
                                  <ChevronUp className="w-3 h-3" />
                                ) : (
                                  <ChevronDown className="w-3 h-3" />
                                )}
                              </button>
                            </div>
                          </div>

                          {isPrint4DExpanded && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1 border-t border-slate-200/60">
                              <div className="sm:col-span-2 flex items-center bg-white border border-slate-200/80 rounded-lg px-2 h-7">
                                <span className="text-[10px] font-semibold text-slate-400 shrink-0 mr-1.5">
                                  母题故事:
                                </span>
                                <input
                                  type="text"
                                  value={themeCfg.printStory || ''}
                                  onChange={(e) =>
                                    updateCardPrintTheme({
                                      printStory: e.target.value,
                                    })
                                  }
                                  placeholder="如：太空芝士火箭小鼠 / 星月云朵美梦兔"
                                  className="w-full text-[11px] text-slate-800 bg-transparent focus:outline-none"
                                />
                              </div>
                              <div className="flex items-center bg-white border border-slate-200/80 rounded-lg px-2 h-7">
                                <span className="text-[10px] font-semibold text-slate-400 shrink-0 mr-1.5">
                                  ①色板:
                                </span>
                                <input
                                  type="text"
                                  value={themeCfg.themePalette}
                                  onChange={(e) =>
                                    updateCardPrintTheme({
                                      themePalette: e.target.value,
                                    })
                                  }
                                  placeholder="如：奶酪鹅黄(#FFF8DC)+焦糖暖棕渐变"
                                  className="w-full text-[11px] text-slate-800 bg-transparent focus:outline-none"
                                />
                              </div>
                              <div className="flex items-center bg-white border border-slate-200/80 rounded-lg px-2 h-7">
                                <span className="text-[10px] font-semibold text-slate-400 shrink-0 mr-1.5">
                                  ②底座:
                                </span>
                                <input
                                  type="text"
                                  value={themeCfg.themeStage}
                                  onChange={(e) =>
                                    updateCardPrintTheme({
                                      themeStage: e.target.value,
                                    })
                                  }
                                  placeholder="如：哑光多孔芝士圆盘潮玩展台"
                                  className="w-full text-[11px] text-slate-800 bg-transparent focus:outline-none"
                                />
                              </div>
                              <div className="flex items-center bg-white border border-slate-200/80 rounded-lg px-2 h-7">
                                <span className="text-[10px] font-semibold text-slate-400 shrink-0 mr-1.5">
                                  ③元素:
                                </span>
                                <input
                                  type="text"
                                  value={themeCfg.themeElements}
                                  onChange={(e) =>
                                    updateCardPrintTheme({
                                      themeElements: e.target.value,
                                    })
                                  }
                                  placeholder="如：2~3个3D芝士块与小火箭漂浮装饰"
                                  className="w-full text-[11px] text-slate-800 bg-transparent focus:outline-none"
                                />
                              </div>
                              <div className="flex items-center bg-white border border-slate-200/80 rounded-lg px-2 h-7">
                                <span className="text-[10px] font-semibold text-slate-400 shrink-0 mr-1.5">
                                  ④胶囊:
                                </span>
                                <input
                                  type="text"
                                  value={themeCfg.themeUiStyle}
                                  onChange={(e) =>
                                    updateCardPrintTheme({
                                      themeUiStyle: e.target.value,
                                    })
                                  }
                                  placeholder="如：焦糖棕标题+奶油黄圆角卖点胶囊"
                                  className="w-full text-[11px] text-slate-800 bg-transparent focus:outline-none"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {isPromptExpanded && (
                        <textarea
                          rows={2}
                          value={task.visualPrompt}
                          onChange={(e) =>
                            onUpdateSkuTask(task.id, {
                              visualPrompt: e.target.value,
                            })
                          }
                          placeholder="选填：自定义画面复刻指令（留空则自动执行高稳定 1:1 复刻协议）..."
                          className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:border-slate-900 resize-none"
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* ================= SINGLE-CARD MULTI-SKU PATTERN FISSION MODAL (拿此图裂变其他花色) ================= */}
      {fissionModal.open && fissionModal.sourceTask && (
        <div
          onClick={() =>
            setFissionModal((prev) => ({
              ...prev,
              open: false,
              sourceTask: null,
            }))
          }
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white border border-slate-200 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl flex flex-col"
          >
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  拿此图一键裂变其他花色 / 款式
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  基于卡片 #{String(fissionModal.sourceTask.skuIndex).padStart(2, '0')}「{fissionModal.sourceTask.skuTitle}」的版式，批量生成其他花色款并自动匹配各自专属的印花4维场景
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  setFissionModal((prev) => ({
                    ...prev,
                    open: false,
                    sourceTask: null,
                  }))
                }
                className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
              {fissionModal.sourceTask.resultImageUrl && (
                <div className="space-y-1.5">
                  <span className="text-xs font-semibold text-slate-700">
                    1. 选择构图对标基准：
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setFissionModal((prev) => ({
                          ...prev,
                          useCompletedAsCase: true,
                        }))
                      }
                      className={`p-2.5 rounded-xl border text-left text-xs transition-all cursor-pointer ${
                        fissionModal.useCompletedAsCase
                          ? 'border-slate-900 bg-slate-900 text-white font-semibold'
                          : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-white'
                      }`}
                    >
                      <div>锁定本卡已出成图作母版 (推荐)</div>
                      <div
                        className={`text-[10px] mt-0.5 ${
                          fissionModal.useCompletedAsCase
                            ? 'text-slate-300'
                            : 'text-slate-400'
                        }`}
                      >
                        以本卡刚生成的满意成图为参考基准，换上新花色并联动新背景
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setFissionModal((prev) => ({
                          ...prev,
                          useCompletedAsCase: false,
                        }))
                      }
                      className={`p-2.5 rounded-xl border text-left text-xs transition-all cursor-pointer ${
                        !fissionModal.useCompletedAsCase
                          ? 'border-slate-900 bg-slate-900 text-white font-semibold'
                          : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-white'
                      }`}
                    >
                      <div>沿用本卡原参考图 (#Case)</div>
                      <div
                        className={`text-[10px] mt-0.5 ${
                          !fissionModal.useCompletedAsCase
                            ? 'text-slate-300'
                            : 'text-slate-400'
                        }`}
                      >
                        保持原同行参考图不变，为每个新花色生成独立卡片
                      </div>
                    </button>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-700">
                    2. 勾选要裂变出的目标产品花色 ({fissionModal.selectedProdIds.length}/{prodAssets.length}，已自动过滤非花色特写图)：
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        const sourceBound =
                          fissionModal.sourceTask?.productRefIds || [];
                        const colorwayIds = prodAssets
                          .filter(
                            (p) =>
                              !sourceBound.includes(p.id) &&
                              getEffectiveProdRole(p) === 'hero_front'
                          )
                          .map((p) => p.id);
                        setFissionModal((prev) => ({
                          ...prev,
                          selectedProdIds: colorwayIds,
                        }));
                      }}
                      className="px-2 py-0.5 rounded bg-blue-50 hover:bg-blue-100 border border-blue-200 text-[11px] font-semibold text-blue-700 cursor-pointer"
                    >
                      仅选各款花色正面
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const sourceBound =
                          fissionModal.sourceTask?.productRefIds || [];
                        const enabledColorways = prodAssets
                          .filter(
                            (p) =>
                              p.enabled !== false &&
                              !sourceBound.includes(p.id) &&
                              getEffectiveProdRole(p) === 'hero_front'
                          )
                          .map((p) => p.id);
                        setFissionModal((prev) => ({
                          ...prev,
                          selectedProdIds: enabledColorways,
                        }));
                      }}
                      className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-[11px] font-semibold text-slate-700 cursor-pointer"
                    >
                      仅选左侧已启用花色
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const allIds = prodAssets.map((p) => p.id);
                        setFissionModal((prev) => ({
                          ...prev,
                          selectedProdIds:
                            prev.selectedProdIds.length === allIds.length
                              ? []
                              : allIds,
                        }));
                      }}
                      className="text-xs font-semibold text-slate-500 hover:text-slate-800 cursor-pointer"
                    >
                      {fissionModal.selectedProdIds.length === prodAssets.length
                        ? '清空'
                        : '全选'}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-2.5">
                  {prodAssets.map((prod, idx) => {
                    const selected = fissionModal.selectedProdIds.includes(
                      prod.id
                    );
                    const role = getEffectiveProdRole(prod);
                    const isColorwayFront = role === 'hero_front';
                    const roleMeta = PROD_ANGLE_ROLE_OPTIONS.find(
                      (o) => o.value === role
                    );
                    return (
                      <button
                        key={prod.id}
                        type="button"
                        onClick={() =>
                          setFissionModal((prev) => ({
                            ...prev,
                            selectedProdIds: selected
                              ? prev.selectedProdIds.filter(
                                  (id) => id !== prod.id
                                )
                              : [...prev.selectedProdIds, prod.id],
                          }))
                        }
                        className={`p-1.5 rounded-xl border text-left transition-all cursor-pointer ${
                          selected
                            ? 'border-blue-600 bg-blue-50/50 ring-1 ring-blue-600'
                            : isColorwayFront
                              ? 'border-slate-200 hover:border-slate-300 opacity-85'
                              : 'border-slate-200/60 bg-slate-50 opacity-50'
                        }`}
                      >
                        <div className="aspect-square rounded-lg overflow-hidden bg-slate-100 relative">
                          <img
                            src={prod.previewUrl}
                            alt={prod.tag}
                            className="w-full h-full object-cover"
                          />
                          <span
                            className={`absolute bottom-1 left-1 px-1 py-0.2 rounded text-[9px] font-semibold ${
                              isColorwayFront
                                ? 'bg-slate-900/75 text-white'
                                : 'bg-amber-600/85 text-white'
                            }`}
                          >
                            {roleMeta?.shortLabel || '正面花色'}
                          </span>
                          {selected && (
                            <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center">
                              <Check className="w-2.5 h-2.5" />
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] font-semibold text-slate-800 truncate mt-1">
                          {prod.tag || `花色 ${idx + 1}`}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="px-5 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() =>
                  setFissionModal((prev) => ({
                    ...prev,
                    open: false,
                    sourceTask: null,
                  }))
                }
                className="px-3.5 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                disabled={fissionModal.selectedProdIds.length === 0}
                onClick={() => {
                  if (fissionModal.sourceTask && onFissionTaskToOtherProds) {
                    onFissionTaskToOtherProds(
                      fissionModal.sourceTask,
                      fissionModal.selectedProdIds,
                      fissionModal.useCompletedAsCase,
                      false
                    );
                  }
                  setFissionModal((prev) => ({
                    ...prev,
                    open: false,
                    sourceTask: null,
                  }));
                }}
                className="h-9 px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-xs font-semibold text-slate-800 cursor-pointer disabled:opacity-50"
              >
                仅生成裂变卡片 ({fissionModal.selectedProdIds.length}张)
              </button>
              <button
                type="button"
                disabled={fissionModal.selectedProdIds.length === 0}
                onClick={() => {
                  if (fissionModal.sourceTask && onFissionTaskToOtherProds) {
                    onFissionTaskToOtherProds(
                      fissionModal.sourceTask,
                      fissionModal.selectedProdIds,
                      fissionModal.useCompletedAsCase,
                      true
                    );
                  }
                  setFissionModal((prev) => ({
                    ...prev,
                    open: false,
                    sourceTask: null,
                  }));
                }}
                className="h-9 px-4 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>裂变并立即批量出图 ({fissionModal.selectedProdIds.length}张)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= ASSET LIBRARY PICKER MODAL ================= */}
      {assetLibraryModal.open && (
        <div
          onClick={() =>
            setAssetLibraryModal((prev) => ({
              ...prev,
              open: false,
              selectedIds: [],
            }))
          }
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white border border-slate-200 rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden shadow-2xl"
          >
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
              <span className="text-sm font-bold text-slate-900">
                从资产库选择
                {assetLibraryModal.category === 'case'
                  ? '参考图 (#Case)'
                  : '产品原图 (#Prod)'}
              </span>
              <button
                type="button"
                onClick={() =>
                  setAssetLibraryModal((prev) => ({
                    ...prev,
                    open: false,
                    selectedIds: [],
                  }))
                }
                className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {commonAssets.filter(
                (a) => a.category === assetLibraryModal.category
              ).length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400">
                  资产库中暂无此类素材，请先在工作台上传后点击「存至资产库」
                </div>
              ) : (
                <div className="grid grid-cols-4 sm:grid-cols-5 gap-3">
                  {commonAssets
                    .filter((a) => a.category === assetLibraryModal.category)
                    .map((asset) => {
                      const selected = assetLibraryModal.selectedIds.includes(
                        asset.id
                      );
                      return (
                        <button
                          key={asset.id}
                          type="button"
                          onClick={() =>
                            setAssetLibraryModal((prev) => ({
                              ...prev,
                              selectedIds: selected
                                ? prev.selectedIds.filter(
                                    (id) => id !== asset.id
                                  )
                                : [...prev.selectedIds, asset.id],
                            }))
                          }
                          className={`p-1.5 rounded-xl border text-left transition-all cursor-pointer ${
                            selected
                              ? 'border-slate-900 bg-slate-900/5 ring-1 ring-slate-900'
                              : 'border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <div className="aspect-square rounded-lg overflow-hidden bg-slate-100 relative">
                            <img
                              src={asset.previewUrl}
                              alt={asset.tag}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover"
                            />
                            {selected && (
                              <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-slate-900 text-white flex items-center justify-center">
                                <Check className="w-2.5 h-2.5" />
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] font-medium text-slate-700 truncate mt-1">
                            {asset.tag}
                          </div>
                        </button>
                      );
                    })}
                </div>
              )}
            </div>

            <div className="px-5 py-3 border-t border-slate-200 flex items-center justify-end gap-2 bg-slate-50">
              <button
                type="button"
                onClick={() =>
                  setAssetLibraryModal((prev) => ({
                    ...prev,
                    open: false,
                    selectedIds: [],
                  }))
                }
                className="px-4 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                disabled={assetLibraryModal.selectedIds.length === 0}
                onClick={() => {
                  const chosen = commonAssets.filter((a) =>
                    assetLibraryModal.selectedIds.includes(a.id)
                  );
                  onSelectAssetsFromLibrary(chosen, assetLibraryModal.category);
                  setAssetLibraryModal((prev) => ({
                    ...prev,
                    open: false,
                    selectedIds: [],
                  }));
                }}
                className="px-4 py-1.5 text-xs font-semibold bg-slate-900 text-white rounded-lg hover:bg-black disabled:opacity-50 cursor-pointer"
              >
                确认导入 ({assetLibraryModal.selectedIds.length})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pre-Flight Payload & Prompt Inspector Modal */}
      {(() => {
        const targetTask = skuTasks.find(
          (t) => t.id === inspectingPayloadTaskId
        );
        if (!targetTask) return null;
        const preview = buildSkuPayloadPreview({
          task: targetTask,
          allProds: prodAssets,
          allCases: caseAssets,
          defaultFidelity: replicaFidelity,
          defaultStyleLinkageMode: styleLinkageMode,
        });
        const quality = skuQualityMap.get(targetTask.id);
        return (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-3xl max-h-[88vh] flex flex-col overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
                <div className="flex items-center gap-2 min-w-0">
                  <ScanEye className="w-4 h-4 text-indigo-600 shrink-0" />
                  <h3 className="text-sm font-bold text-slate-900 truncate">
                    生图前真实投喂透视镜 · 主图 #{String(targetTask.skuIndex).padStart(2, '0')} ({targetTask.skuTitle})
                  </h3>
                  {preview.filteredOutCount > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-semibold shrink-0">
                      已自动隔离 {preview.filteredOutCount} 张冗余产品图
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setInspectingPayloadTaskId(null)}
                  className="p-1 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-5 overflow-y-auto space-y-4 text-xs">
                {/* Quality Warning inside Inspector if any */}
                {quality && !quality.passed && (
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-300 flex items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <div className="font-bold text-amber-900 flex items-center gap-1.5">
                        <AlertCircle className="w-4 h-4 text-amber-600" />
                        <span>检测到 {quality.issues.length} 项生图前潜在冲突：</span>
                      </div>
                      <ul className="text-[11px] text-amber-800 list-disc list-inside">
                        {quality.issues.map((iss, idx) => (
                          <li key={idx}>
                            <span className="font-semibold">{iss.label}：</span>
                            {iss.detail}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const fixed = autoFixSkuTaskQuality(
                          targetTask,
                          prodAssets,
                          caseAssets
                        );
                        onUpdateSkuTask(targetTask.id, {
                          productRefIds: fixed.productRefIds,
                          visualPrompt: fixed.visualPrompt,
                          typographyPlan: fixed.typographyPlan,
                          sellingPointBadge: fixed.sellingPointBadge,
                        });
                        onShowToast('已完成一键修复，透视镜已实时更新！', 'success');
                      }}
                      className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold shrink-0 cursor-pointer"
                    >
                      ⚡ 一键修复冲突
                    </button>
                  </div>
                )}

                {/* 1. Ordered Image Slots Actually Sent to Image Model */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900">
                      1. 实际投喂给生图模型的图片序列（共 {preview.imageSlots.length} 张，按权重从高到低排序）
                    </span>
                    <span className="text-[11px] text-slate-500">
                      {preview.modeLabel}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {preview.imageSlots.map((slot) => (
                      <div
                        key={slot.order}
                        className="p-2.5 rounded-xl border border-slate-200 bg-slate-50/70 flex items-start gap-2.5"
                      >
                        <img
                          src={slot.previewUrl}
                          alt={slot.tag}
                          referrerPolicy="no-referrer"
                          onClick={() =>
                            onPreviewImage(
                              slot.previewUrl,
                              `投喂槽位 #${slot.order}: ${slot.roleBadge}`
                            )
                          }
                          className="w-14 h-14 rounded-lg object-cover border border-slate-200 shrink-0 cursor-zoom-in bg-white"
                        />
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center gap-1">
                            <span className="px-1.5 py-0.5 rounded bg-slate-900 text-white text-[10px] font-bold">
                              图#{slot.order}
                            </span>
                            <span className="text-[10px] font-semibold text-indigo-700 truncate">
                              {slot.angleRoleLabel || slot.code}
                            </span>
                          </div>
                          <div className="font-bold text-slate-800 truncate text-[11px]" title={slot.roleBadge}>
                            {slot.roleBadge}
                          </div>
                          <div className="text-[10px] text-slate-500 truncate" title={slot.ruleDesc}>
                            {slot.tag}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 2. Active Anti-Deformation & Style Guardrails */}
                <div className="space-y-1.5">
                  <div className="font-bold text-slate-900">
                    2. 已激活的底层防变形与色彩护栏（共 {preview.activeGuardrails.length} 项）
                  </div>
                  <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200/90 space-y-1">
                    {preview.activeGuardrails.map((g, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-1.5 text-[11px] text-emerald-950 font-medium"
                      >
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>{g}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 3. Sanitized Prompt & Copywriting */}
                <div className="space-y-1.5">
                  <div className="font-bold text-slate-900">
                    3. 净化后实际下发的画面描述与分层文案（已自动剥离 #Prod/#Case 内部编号与药丸禁用词）
                  </div>
                  <div className="p-3 rounded-xl bg-slate-900 text-slate-100 font-mono text-[11px] space-y-1.5 leading-relaxed">
                    <div>
                      <span className="text-amber-400 font-semibold">[主标题与卖点] </span>
                      {preview.sanitizedCopywriting || '（无标题）'}
                    </div>
                    <div>
                      <span className="text-emerald-400 font-semibold">[净化后画面指令] </span>
                      {preview.compiledPositivePrompt || '（按默认复刻规范执行）'}
                    </div>
                  </div>
                </div>
              </div>

              <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-2">
                <span className="text-[11px] text-slate-500">
                  确认上方投喂图槽位与净化指令无误后，可直接触发本卡生图
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setInspectingPayloadTaskId(null)}
                    className="px-3.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-100 cursor-pointer"
                  >
                    关闭
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const taskToRun = targetTask;
                      setInspectingPayloadTaskId(null);
                      onGenerateSingleSkuImage(taskToRun);
                    }}
                    className="px-4 py-1.5 rounded-lg bg-slate-900 hover:bg-black text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>立即按此投喂生图</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
