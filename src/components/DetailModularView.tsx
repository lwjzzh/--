import React, { useState, useRef, useEffect } from 'react';
import {
  Plus,
  Trash2,
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
  CloudUpload,
  ArrowUp,
  ArrowDown,
  Copy,
  Layers,
  BookmarkCheck,
  X,
  LayoutList,
  ScrollText,
  Globe,
  ShieldCheck,
  Palette,
  Dices,
  ChevronDown,
  ChevronUp,
  ArrowRightLeft,
  Lock,
  Unlock,
  History,
  Settings,
  Zap,
} from 'lucide-react';
import {
  ReferenceImageItem,
  AspectRatioOption,
  ImageSizeOption,
  CloudStorageProvider,
  ScreenTask,
  SkuSellingPointPreset,
  DetailModuleType,
  DETAIL_MODULE_PRESETS,
  TextRenderMode,
  PrintThemeLinkageConfig,
  PROD_ANGLE_ROLE_OPTIONS,
} from '../types';
import { SavedCommonAsset } from '../utils/assetLibraryDb';
import { downloadSingleScreenImage } from '../utils/exportHelpers';

const PROD_ANGLE_ROLES: { value: string; label: string }[] =
  PROD_ANGLE_ROLE_OPTIONS.map((o) => ({ value: o.value, label: o.label }));

function normalizeAngleRoleValue(role?: string): string {
  if (!role) return 'hero_front';
  const aliasMap: Record<string, string> = {
    single_wear: 'single_earbud',
    macro_detail: 'detail_closeup',
    multi_color: 'multi_sku',
    accessory: 'package_accessory',
  };
  return aliasMap[role] || role;
}

const QUICK_VISUAL_STYLE_PRESETS: {
  id: string;
  label: string;
  spec: string;
}[] = [
  {
    id: 'clean_flagship',
    label: '✨ 极简天猫旗舰风',
    spec: '【①60-30-10色板锚点】：60%冷调云朵白渐变背景(#F5F7FA) + 30%银白磨砂几何展台(#E4E8F0) + 10%冰川蓝高光点缀(#3B82F6)；【②展台与空间材质锚点】：极简双层微弧亚克力与细腻石膏圆柱台面，地平线位于下1/3处；【③布光方位与色温阴影】：5500K商业棚拍顶侧柔光箱，清晰冷白轮廓光与15%柔和接触阴影；【④字体层级与色号锚点】：顶部居中粗黑体主标题(#111827)，副标题采用冰川蓝胶囊反白字；【⑤UI容器与胶囊规范】：底部横排2~3个圆角16px半透明毛玻璃卖点胶囊卡(浅灰细描边)；【⑥画布边距与三段网格】：上22%标题区 + 中54%产品主体舞台 + 下24%卖点胶囊区，左右留白≥8%。',
  },
  {
    id: 'tech_studio',
    label: '⚡ 科技质感数码风',
    spec: '【①60-30-10色板锚点】：60%深空钛灰渐变背景(#181C24) + 30%拉丝暗金属展台(#262C36) + 10%流光青蓝科技光效(#38BDF8)；【②展台与空间材质锚点】：精密CNC阳极氧化铝斜切几何底座与微透光环形导光槽；【③布光方位与色温阴影】：6000K硬朗双侧轮廓冷光+精密金属镜面高光反射；【④字体层级与色号锚点】：顶部银白渐变几何无衬线大标题(#F8FAFC)，搭配冷青色高亮数据大字；【⑤UI容器与胶囊规范】：底部深灰磨砂玻璃圆角数据舱卡片，带1px高亮青色发光描边；【⑥画布边距与三段网格】：上22%标题区 + 中54%产品C位悬浮舞台 + 下24%参数矩阵卡，左右留白≥8%。',
  },
  {
    id: 'warm_lifestyle',
    label: '🌿 奶油原木生活风',
    spec: '【①60-30-10色板锚点】：60%暖调燕麦奶白背景(#FBF8F3) + 30%温润浅原木与微水泥台面(#E8DFD1) + 10%焦糖暖棕点缀(#8C6239)；【②展台与空间材质锚点】：自然肌理洞石与温润哑光奶油色圆盘底座；【③布光方位与色温阴影】：4500K清晨斜射自然窗光，柔和漫反射光影与自然落影；【④字体层级与色号锚点】：深咖啡棕圆润无衬线大标题(#3E2723)，副标题采用柔和莫兰迪暖灰(#795548)；【⑤UI容器与胶囊规范】：底部米杏色圆角16px磨砂信息卡片(#F4EFE6)，搭配精致极简线性图标；【⑥画布边距与三段网格】：上22%标题区 + 中54%产品生活美学舞台 + 下24%卖点胶囊区，左右留白≥8%。',
  },
  {
    id: 'vibrant_trendy',
    label: '🎨 潮玩盲盒马卡龙风',
    spec: '【①60-30-10色板锚点】：60%高明度马卡龙主题同色系渐变背景(#FFF0F5) + 30%潮玩盲盒质感PVC圆盘底座(#FCE7F3) + 10%高饱和糖果色点缀(#EC4899)；【②展台与空间材质锚点】：泡泡玛特风圆润软胶立体展台，搭配2~3个与机身印花呼应的3D漂浮小道具；【③布光方位与色温阴影】：5200K通透明亮高调棚拍柔光，温润细腻的漫反射高光与干净浅色阴影；【④字体层级与色号锚点】：活力圆体粗大标题(采用印花深色系)，副标题为糖果色圆角贴纸胶囊；【⑤UI容器与胶囊规范】：底部采用与印花同色系的浅奶油色圆角胶囊卡(严禁生硬黑棕色块)；【⑥画布边距与三段网格】：上22%标题区 + 中54%潮玩舞台区 + 下24%同色系胶囊区，左右留白≥8%。',
  },
];

function extractHexColors(text?: string, fallback: string[] = ['#F5F7FA', '#E4E8F0', '#3B82F6']): string[] {
  if (!text) return fallback;
  const matches = text.match(/#[0-9A-Fa-f]{6}\b/g);
  if (matches && matches.length > 0) {
    return Array.from(new Set(matches.map((m) => m.toUpperCase()))).slice(0, 5);
  }
  return fallback;
}

function buildCuratedPrintThemeVariation(
  tagHint: string,
  seedIndex: number
): PrintThemeLinkageConfig {
  const variations: PrintThemeLinkageConfig[] = [
    {
      enabled: true,
      printStory: `${tagHint || '萌趣潮玩款'} · 糖果盲盒治愈微缩世界`,
      themePalette: '60%奶油蜜桃粉(#FFF0F3) + 30%草莓牛奶粉(#FFD6E0) + 10%糖果玫红(#FF4D79)',
      themeStage: '泡泡玛特风圆润果冻亚克力与奶油云朵双层微缩展台',
      themeElements: '漂浮3D软胶小爱心、微缩透明气泡球与立体Q版小星星',
      themeUiStyle: '奶油草莓粉磨砂圆角胶囊信息卡(严禁黑棕色块)，配圆体柔光标题',
    },
    {
      enabled: true,
      printStory: `${tagHint || '清新自然款'} · 薄荷苏打假日森系乐园`,
      themePalette: '60%冰透薄荷绿(#ECFDF5) + 30%奶油开心果绿(#A7F3D0) + 10%活力柠檬黄(#FBBF24)',
      themeStage: '微缩森系奶油圆盘底座与半透明冰块质感亚克力阶梯',
      themeElements: '漂浮3D迷你幸运草、透明苏打水珠与Q版软胶小雏菊',
      themeUiStyle: '浅薄荷奶白圆角贴纸式卖点胶囊卡，清爽果绿图标与圆润字体',
    },
    {
      enabled: true,
      printStory: `${tagHint || '星际幻想款'} · 云端星梦奶油蓝微缩剧场`,
      themePalette: '60%奶盐冰川蓝(#F0F9FF) + 30%马卡龙天蓝(#BAE6FD) + 10%星芒奶黄(#FDE047)',
      themeStage: '蓬松云朵质感软胶底座与星轨环形微发光展台',
      themeElements: '漂浮3D微缩弯月、透明梦幻泡泡与圆润五角星挂饰',
      themeUiStyle: '冰川奶蓝毛玻璃圆角卖点胶囊卡，深海蓝圆体字与亮黄星标',
    },
    {
      enabled: true,
      printStory: `${tagHint || '芋泥甜心款'} · 梦幻香芋星云甜品屋`,
      themePalette: '60%奶霜香芋紫(#F5F3FF) + 30%马卡龙丁香紫(#DDD6FE) + 10%奶油蜜瓜黄(#FDE68A)',
      themeStage: '丝滑香芋奶油波浪圆台与半透明珠光亚克力托盘',
      themeElements: '漂浮3D马卡龙甜点、微缩紫色星芒与糖霜珍珠颗粒',
      themeUiStyle: '浅香芋奶油色圆角胶囊底栏，深紫罗兰圆润标题字与暖黄徽章',
    },
  ];
  return variations[Math.abs(seedIndex) % variations.length];
}

function parseStructuredCopy(rawText: string): {
  headline: string;
  subheadline: string;
  capsules: string;
} {
  if (!rawText) {
    return { headline: '', subheadline: '', capsules: '' };
  }
  const lines = rawText.split('\n');
  return {
    headline: lines[0] ?? '',
    subheadline: lines[1] ?? '',
    capsules: lines.slice(2).join('\n'),
  };
}

function composeStructuredCopy(
  headline: string,
  subheadline: string,
  capsules: string
): string {
  if (!headline && !subheadline && !capsules) return '';
  if (capsules) {
    return `${headline}\n${subheadline}\n${capsules}`;
  }
  if (subheadline) {
    return `${headline}\n${subheadline}`;
  }
  return headline;
}

export interface DetailModularViewProps {
  prodAssets: ReferenceImageItem[];
  caseAssets: ReferenceImageItem[];
  commonAssets: SavedCommonAsset[];
  tasks: ScreenTask[];
  productInfoText: string;
  unifiedVisualSpec: string;
  aspectRatio: AspectRatioOption;
  imageSize: ImageSizeOption;
  textMode: TextRenderMode;
  ossEnabled: boolean;
  storageProvider?: CloudStorageProvider;
  isSyncingOss?: boolean;
  isExtractingStyle: boolean;
  isPlanningModules: boolean;
  isBatchRunning: boolean;
  isStitching: boolean;
  isExportingZip: boolean;
  stitchedLongImageUrl: string | null;
  skuTasksCount?: number;
  skuProdCount?: number;
  onChangeProductInfoText: (val: string) => void;
  onChangeUnifiedVisualSpec: (val: string) => void;
  onChangeAspectRatio: (ratio: AspectRatioOption) => void;
  onChangeImageSize: (size: ImageSizeOption) => void;
  onChangeTextMode: (mode: TextRenderMode) => void;
  onAddModuleTask: (moduleType: DetailModuleType) => void;
  onApplyStandardPresetModules: () => void;
  onAppendTailModules?: () => void;
  onUpdateTask: (taskId: string, patch: Partial<ScreenTask>) => void;
  onMoveTask: (taskId: string, direction: 'up' | 'down') => void;
  onDuplicateTask: (task: ScreenTask) => void;
  onDeleteTask: (taskId: string) => void;
  onClearAllTasks: () => void;
  onExtractCompetitorStyle: () => void;
  onAiPlanAllModules: (autoStartBatchAfter?: boolean) => void;
  onGenerateSingleTask: (task: ScreenTask) => void;
  onStartBatchGenerate: (onlyUnfinished?: boolean) => void;
  onStopBatchGenerate: () => void;
  onStitchLongImage: () => void;
  onExportZip: () => void;
  onUploadFiles: (files: FileList | null, category: 'product' | 'case') => void;
  onSelectAssetsFromLibrary: (
    assets: SavedCommonAsset[],
    category: 'product' | 'case'
  ) => void;
  onSaveDetailAssetsToLibrary: () => void;
  onSyncAllRefsToOss: () => void;
  onRemoveAsset: (refId: string) => void;
  onClearCategoryAssets: (category: 'product' | 'case') => void;
  onPreviewImage: (url: string, title?: string, subtitle?: string) => void;
  onUpdateDetailProdRole?: (refId: string, role: string) => void;
  onUpdateDetailAssetTag?: (refId: string, newTag: string) => void;
  onAutoAnalyzeDetailRefs?: () => void;
  onSyncFromSkuStudio?: () => void;
  sellingPointPresets?: SkuSellingPointPreset[];
  onOpenPresetSettings?: () => void;
  onShowToast?: (text: string, type?: 'info' | 'success' | 'error') => void;
}

export const DetailModularView: React.FC<DetailModularViewProps> = ({
  prodAssets,
  caseAssets,
  commonAssets,
  tasks,
  productInfoText,
  unifiedVisualSpec,
  aspectRatio,
  imageSize,
  textMode,
  ossEnabled,
  storageProvider = 'aliyun_oss',
  isSyncingOss = false,
  isExtractingStyle,
  isPlanningModules,
  isBatchRunning,
  isStitching,
  isExportingZip,
  stitchedLongImageUrl,
  skuTasksCount = 0,
  skuProdCount = 0,
  onChangeProductInfoText,
  onChangeUnifiedVisualSpec,
  onChangeAspectRatio,
  onChangeImageSize,
  onChangeTextMode,
  onAddModuleTask,
  onApplyStandardPresetModules,
  onAppendTailModules,
  onUpdateTask,
  onMoveTask,
  onDuplicateTask,
  onDeleteTask,
  onClearAllTasks,
  onExtractCompetitorStyle,
  onAiPlanAllModules,
  onGenerateSingleTask,
  onStartBatchGenerate,
  onStopBatchGenerate,
  onStitchLongImage,
  onExportZip,
  onUploadFiles,
  onSelectAssetsFromLibrary,
  onSaveDetailAssetsToLibrary,
  onSyncAllRefsToOss,
  onRemoveAsset,
  onClearCategoryAssets,
  onPreviewImage,
  onUpdateDetailProdRole,
  onUpdateDetailAssetTag,
  onAutoAnalyzeDetailRefs,
  onSyncFromSkuStudio,
  sellingPointPresets = [],
  onOpenPresetSettings,
  onShowToast,
}) => {
  const isR2 = storageProvider === 'cloudflare_r2';
  const cloudShort = isR2 ? 'R2' : 'OSS';

  const [styleSourceTab, setStyleSourceTab] = useState<'preset' | 'competitor'>(
    caseAssets.length > 0 ? 'competitor' : 'preset'
  );
  const [rightViewMode, setRightViewMode] = useState<'cards' | 'long_preview'>(
    'cards'
  );
  const [showPresetMenu, setShowPresetMenu] = useState(false);

  useEffect(() => {
    if (!showPresetMenu) return;
    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && !target.closest('[data-detail-preset-menu-root="true"]')) {
        setShowPresetMenu(false);
      }
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [showPresetMenu]);
  const [expandedThemeTaskIds, setExpandedThemeTaskIds] = useState<string[]>(
    []
  );
  const [themeSeedCounter, setThemeSeedCounter] = useState<
    Record<string, number>
  >({});
  const [assetModal, setAssetModal] = useState<{
    open: boolean;
    category: 'product' | 'case';
    selectedIds: string[];
  }>({
    open: false,
    category: 'product',
    selectedIds: [],
  });

  const prodFileInputRef = useRef<HTMLInputElement | null>(null);
  const caseFileInputRef = useRef<HTMLInputElement | null>(null);

  const completedCount = tasks.filter(
    (t) => t.status === 'completed' && Boolean(t.resultImageUrl)
  ).length;

  const specSwatches = extractHexColors(unifiedVisualSpec);

  const getModuleMeta = (moduleType?: DetailModuleType) => {
    return (
      DETAIL_MODULE_PRESETS.find((m) => m.type === moduleType) ||
      DETAIL_MODULE_PRESETS[0]
    );
  };

  const toggleExpandTheme = (taskId: string) => {
    setExpandedThemeTaskIds((prev) =>
      prev.includes(taskId)
        ? prev.filter((id) => id !== taskId)
        : [...prev, taskId]
    );
  };

  const handleRollDetailTaskTheme = (task: ScreenTask) => {
    const boundProd = prodAssets.find((p) =>
      task.referenceImageIds.includes(p.id)
    );
    const nextSeed = (themeSeedCounter[task.id] || 0) + 1;
    setThemeSeedCounter((prev) => ({ ...prev, [task.id]: nextSeed }));
    const nextCfg = buildCuratedPrintThemeVariation(
      boundProd?.tag || task.title,
      nextSeed
    );
    onUpdateTask(task.id, { printThemeConfig: nextCfg });
  };

  const toggleTaskProdBinding = (task: ScreenTask, prodId: string) => {
    const prodIdSet = new Set(prodAssets.map((p) => p.id));
    const preservedOtherIds = task.referenceImageIds.filter(
      (id) => !prodIdSet.has(id)
    );
    const explicitProdIds = task.referenceImageIds.filter((id) =>
      prodIdSet.has(id)
    );
    const effectiveProdIds =
      explicitProdIds.length > 0
        ? explicitProdIds
        : prodAssets.map((p) => p.id);

    const exists = effectiveProdIds.includes(prodId);
    let nextProdIds: string[];
    if (exists) {
      if (effectiveProdIds.length > 1) {
        nextProdIds = effectiveProdIds.filter((id) => id !== prodId);
      } else {
        nextProdIds = [prodId];
      }
    } else {
      nextProdIds = [...effectiveProdIds, prodId];
    }
    onUpdateTask(task.id, {
      referenceImageIds: [...preservedOtherIds, ...nextProdIds],
    });
  };

  return (
    <div className="flex-1 flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden bg-[#F4F5F7]">
      {/* Hidden File Inputs */}
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
      <input
        ref={caseFileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          onUploadFiles(e.target.files, 'case');
          setStyleSourceTab('competitor');
          e.target.value = '';
        }}
      />

      {/* ================= LEFT SIDEBAR: MODULAR DETAIL CONFIG PANEL (405px) ================= */}
      <aside className="w-full lg:w-[405px] xl:w-[425px] shrink-0 lg:h-full bg-white border-b lg:border-b-0 lg:border-r border-slate-200/80 flex flex-col lg:overflow-hidden select-none">
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
          {/* 1. 自有产品图 (#Prod) 与 产品信息 */}
          <section className="space-y-2.5">
            <div className="flex items-center justify-between gap-1">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-[13px] font-bold text-slate-900 truncate">
                  1. 自有产品原图 (#Prod)
                </span>
                <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded font-semibold shrink-0">
                  纯产品锚定·零变形
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {onAutoAnalyzeDetailRefs && prodAssets.length > 0 && (
                  <button
                    type="button"
                    disabled={isExtractingStyle}
                    onClick={onAutoAnalyzeDetailRefs}
                    title="AI 自动识别每张产品图的拍摄视角与花色标签"
                    className="h-6 px-2 rounded-md bg-violet-50 hover:bg-violet-100 text-violet-700 text-[11px] font-semibold flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  >
                    {isExtractingStyle ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Wand2 className="w-3 h-3" />
                    )}
                    <span>AI识视角</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() =>
                    setAssetModal({
                      open: true,
                      category: 'product',
                      selectedIds: [],
                    })
                  }
                  className="text-[11px] font-medium text-blue-600 hover:text-blue-700 flex items-center gap-0.5 cursor-pointer"
                >
                  <BookmarkCheck className="w-3 h-3" />
                  <span>资产库</span>
                </button>
                {prodAssets.length > 0 && (
                  <button
                    type="button"
                    onClick={() => onClearCategoryAssets('product')}
                    className="text-[11px] text-slate-400 hover:text-rose-600 cursor-pointer"
                  >
                    清空
                  </button>
                )}
              </div>
            </div>

            {/* Secondary Asset Actions Bar (Moved from Top Toolbar to Left Asset Section) */}
            {(prodAssets.length > 0 ||
              caseAssets.length > 0 ||
              skuProdCount > 0 ||
              skuTasksCount > 0) && (
              <div className="flex flex-wrap items-center gap-1.5">
                {onSyncFromSkuStudio && (skuProdCount > 0 || skuTasksCount > 0) && (
                  <button
                    type="button"
                    onClick={onSyncFromSkuStudio}
                    className="h-6 px-2 rounded-md bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200/80 text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <ArrowRightLeft className="w-3 h-3" />
                    <span>同步主图台素材 ({skuProdCount}张)</span>
                  </button>
                )}
                {(prodAssets.length > 0 || caseAssets.length > 0) && (
                  <button
                    type="button"
                    onClick={onSaveDetailAssetsToLibrary}
                    className="h-6 px-2 rounded-md bg-slate-100 hover:bg-slate-200/80 text-slate-700 text-[11px] font-medium flex items-center gap-1 cursor-pointer"
                  >
                    <BookmarkCheck className="w-3 h-3" />
                    <span>存至资产库</span>
                  </button>
                )}
                {ossEnabled && (prodAssets.length > 0 || caseAssets.length > 0) && (
                  <button
                    type="button"
                    disabled={isSyncingOss}
                    onClick={onSyncAllRefsToOss}
                    className="h-6 px-2 rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-[11px] font-medium flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  >
                    {isSyncingOss ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <CloudUpload className="w-3 h-3" />
                    )}
                    <span>同步 {cloudShort}</span>
                  </button>
                )}
              </div>
            )}

            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                onUploadFiles(e.dataTransfer.files, 'product');
              }}
              className="grid grid-cols-4 gap-2"
            >
              {prodAssets.map((prod, idx) => (
                <div
                  key={prod.id}
                  className="flex flex-col gap-1 bg-slate-50/70 p-1 rounded-xl border border-slate-200/80"
                >
                  <div
                    onClick={() =>
                      onPreviewImage(
                        prod.previewUrl,
                        `产品图 #${prod.code} (${prod.tag})`,
                        prod.name
                      )
                    }
                    className="relative aspect-square rounded-lg overflow-hidden bg-slate-100 group cursor-zoom-in"
                  >
                    <img
                      src={prod.previewUrl}
                      alt={prod.tag}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                    <span className="absolute top-1 left-1 bg-slate-900/80 text-white text-[9px] font-mono-tabular px-1 py-0.5 rounded">
                      #{prod.code || `P${idx + 1}`}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveAsset(prod.id);
                      }}
                      className="absolute top-1 right-1 w-4 h-4 rounded-full bg-slate-900/70 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-rose-600 transition-opacity cursor-pointer"
                      title="移除此产品图"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>

                    {/* Angle Role Selector */}
                    {onUpdateDetailProdRole && (
                      <select
                        value={normalizeAngleRoleValue(prod.prodAngleRole)}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) =>
                          onUpdateDetailProdRole(prod.id, e.target.value)
                        }
                        className="absolute bottom-0 inset-x-0 bg-slate-900/80 text-white text-[9px] py-0.5 px-1 text-center font-medium focus:outline-none cursor-pointer"
                      >
                        {PROD_ANGLE_ROLES.map((r) => (
                          <option key={r.value} value={r.value}>
                            {r.label}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  {onUpdateDetailAssetTag ? (
                    <input
                      type="text"
                      value={prod.tag || ''}
                      onChange={(e) =>
                        onUpdateDetailAssetTag(prod.id, e.target.value)
                      }
                      placeholder="花色/视角..."
                      className="w-full text-[10px] text-slate-700 bg-white border border-slate-200/80 rounded px-1 py-0.5 text-center truncate focus:outline-none focus:border-slate-900"
                    />
                  ) : (
                    <span className="text-[10px] text-slate-600 text-center truncate px-0.5">
                      {prod.tag || `产品${idx + 1}`}
                    </span>
                  )}
                </div>
              ))}

              <button
                type="button"
                onClick={() => prodFileInputRef.current?.click()}
                className="aspect-square rounded-xl border border-dashed border-slate-300 hover:border-slate-500 bg-slate-50/70 hover:bg-slate-100/70 flex flex-col items-center justify-center gap-1 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
              >
                <Plus className="w-5 h-5" />
                <span className="text-[10px] font-medium">添加产品图</span>
              </button>
            </div>

            {/* Product Selling Points & Parameters Input */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between gap-1 relative">
                <span className="text-xs font-semibold text-slate-700">
                  产品卖点、规格参数与售后信息
                </span>
                <div className="flex items-center gap-1.5">
                  {sellingPointPresets.length > 0 && (
                    <div className="relative" data-detail-preset-menu-root="true">
                      <button
                        type="button"
                        onClick={() => setShowPresetMenu((prev) => !prev)}
                        className="h-6 px-2 rounded-md bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200/80 text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                        title="从防丢常用卖点库一键填入产品核心卖点与参数"
                      >
                        <Zap className="w-3 h-3 text-amber-600" />
                        <span>常用卖点 ({sellingPointPresets.length})</span>
                        <ChevronDown className="w-3 h-3" />
                      </button>

                      {showPresetMenu && (
                        <div className="absolute right-0 top-full mt-1.5 w-72 bg-white border border-slate-200 rounded-xl shadow-xl p-2 z-40 space-y-1">
                          <div className="flex items-center justify-between px-2 py-1 border-b border-slate-100">
                            <span className="text-[11px] font-bold text-slate-800">
                              ⚡ 一键填入常用卖点方案
                            </span>
                            {onOpenPresetSettings && (
                              <button
                                type="button"
                                onClick={() => {
                                  setShowPresetMenu(false);
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
                            {sellingPointPresets.map((preset) => (
                              <button
                                key={preset.id}
                                type="button"
                                onClick={() => {
                                  const lines = [
                                    preset.titlePrefix
                                      ? `产品系列：${preset.titlePrefix}${preset.subtitleText ? ` · ${preset.subtitleText}` : ''}`
                                      : '',
                                    `核心卖点：${preset.sellingPointBadge}`,
                                    preset.packageSpecNote
                                      ? `包装与参数：${preset.packageSpecNote}`
                                      : '',
                                  ]
                                    .filter(Boolean)
                                    .join('\n');
                                  const nextVal = productInfoText.trim()
                                    ? `${productInfoText.trim()}\n${lines}`
                                    : lines;
                                  onChangeProductInfoText(nextVal);
                                  setShowPresetMenu(false);
                                  onShowToast?.(
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

                  {productInfoText && (
                    <button
                      type="button"
                      onClick={() => onChangeProductInfoText('')}
                      className="text-[11px] text-slate-400 hover:text-rose-600 cursor-pointer"
                    >
                      清空
                    </button>
                  )}
                </div>
              </div>
              <textarea
                rows={3}
                value={productInfoText}
                onChange={(e) => onChangeProductInfoText(e.target.value)}
                placeholder="输入品牌型号、核心功能卖点、详细规格参数、包装清单、质保退换政策等（AI将自动分配到右侧对应的详情页模块中）..."
                className="w-full p-2.5 text-xs leading-relaxed bg-slate-100/80 border border-slate-200/70 rounded-xl focus:bg-white focus:outline-none focus:border-slate-900 text-slate-800 placeholder:text-slate-400 resize-none"
              />
            </div>
          </section>

          {/* 2. 整页统一视觉规范 (Preset Styles OR AI Competitor Extraction) */}
          <section className="space-y-2.5 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-bold text-slate-900">
                2. 整页统一视觉规范
              </span>
              <div className="flex items-center gap-1.5">
                {/* Visual HEX Swatch Dots */}
                <div className="flex items-center -space-x-1">
                  {specSwatches.map((hex, i) => (
                    <span
                      key={`${hex}-${i}`}
                      title={`色板锚点 ${hex}`}
                      style={{ backgroundColor: hex }}
                      className="w-3.5 h-3.5 rounded-full border border-slate-300 shadow-2xs inline-block"
                    />
                  ))}
                </div>
                <span className="text-[10px] font-mono-tabular text-slate-500">
                  6锚点色板
                </span>
              </div>
            </div>

            {/* Segmented Tab: 预设视觉风格 | 对标竞品提取规范 */}
            <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-xl">
              <button
                type="button"
                onClick={() => setStyleSourceTab('preset')}
                className={`h-8 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  styleSourceTab === 'preset'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                预设视觉调性
              </button>
              <button
                type="button"
                onClick={() => setStyleSourceTab('competitor')}
                className={`h-8 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  styleSourceTab === 'competitor'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                对标竞品提取规范 ({caseAssets.length})
              </button>
            </div>

            {styleSourceTab === 'preset' ? (
              <div className="grid grid-cols-2 gap-1.5">
                {QUICK_VISUAL_STYLE_PRESETS.map((preset) => {
                  const isSelected = unifiedVisualSpec.includes(
                    preset.spec.slice(0, 18)
                  );
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => onChangeUnifiedVisualSpec(preset.spec)}
                      className={`h-8 px-2.5 rounded-lg border text-xs font-medium text-left truncate transition-all cursor-pointer ${
                        isSelected
                          ? 'border-slate-900 bg-slate-900 text-white font-semibold'
                          : 'border-slate-200 bg-slate-50/60 text-slate-700 hover:bg-white hover:border-slate-300'
                      }`}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-2 p-2.5 bg-slate-50 rounded-xl border border-slate-200/70">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-600">
                    上传1~3张竞品详情图，AI仅提取配色/光影/版式规范（生图时不传竞品原图，彻底杜绝产品变形）
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {caseAssets.map((c, idx) => (
                    <div
                      key={c.id}
                      onClick={() =>
                        onPreviewImage(c.previewUrl, `竞品参考图 ${idx + 1}`)
                      }
                      className="relative aspect-square rounded-lg overflow-hidden bg-white border border-slate-200 group cursor-zoom-in"
                    >
                      <img
                        src={c.previewUrl}
                        alt={c.tag}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveAsset(c.id);
                        }}
                        className="absolute top-1 right-1 w-4 h-4 rounded-full bg-slate-900/75 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => caseFileInputRef.current?.click()}
                    className="aspect-square rounded-lg border border-dashed border-slate-300 hover:border-slate-500 bg-white flex flex-col items-center justify-center text-slate-400 hover:text-slate-700 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span className="text-[10px]">上传竞品</span>
                  </button>
                </div>
                <button
                  type="button"
                  disabled={isExtractingStyle || caseAssets.length === 0}
                  onClick={onExtractCompetitorStyle}
                  className="w-full h-8 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isExtractingStyle ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Wand2 className="w-3.5 h-3.5" />
                  )}
                  <span>
                    {isExtractingStyle
                      ? '正在提炼整页视觉规范...'
                      : 'AI 提取竞品配色与版式规范'}
                  </span>
                </button>
              </div>
            )}

            <textarea
              rows={3}
              value={unifiedVisualSpec}
              onChange={(e) => onChangeUnifiedVisualSpec(e.target.value)}
              placeholder="整页统一视觉规范（包含色彩体系、光影质感、标题与卡片字体层级、留白比例）..."
              className="w-full p-2.5 text-xs leading-relaxed bg-slate-100/80 border border-slate-200/70 rounded-xl focus:bg-white focus:outline-none focus:border-slate-900 text-slate-800 resize-none"
            />
          </section>

          {/* 3. 预置详情页模块库（点击自由添加组合） */}
          <section className="space-y-2.5 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-bold text-slate-900">
                3. 预置详情页模块（自由添加）
              </span>
              <div className="flex items-center gap-2">
                {onAppendTailModules && tasks.length > 0 && (
                  <button
                    type="button"
                    onClick={onAppendTailModules}
                    title="在当前主图延展分屏后一键追加：规格参数表 + 包装清单 + 售后保障，并继承前序花色4维配色"
                    className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 cursor-pointer"
                  >
                    + 追加收尾3屏
                  </button>
                )}
                <button
                  type="button"
                  onClick={onApplyStandardPresetModules}
                  className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 cursor-pointer"
                >
                  ⚡ 标准7屏模板
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              {DETAIL_MODULE_PRESETS.map((mod) => (
                <button
                  key={mod.type}
                  type="button"
                  onClick={() => onAddModuleTask(mod.type)}
                  title={mod.description}
                  className="p-2 rounded-xl border border-slate-200/90 hover:border-slate-900 bg-slate-50/50 hover:bg-white text-left transition-all flex items-center justify-between gap-1.5 group cursor-pointer"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-slate-800 group-hover:text-slate-950 truncate">
                      {mod.icon} {mod.label}
                    </div>
                    <div className="text-[10px] text-slate-400 truncate">
                      {mod.badge}
                    </div>
                  </div>
                  <Plus className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-900 shrink-0" />
                </button>
              ))}
            </div>
          </section>

          {/* 4. 生成设置 */}
          <section className="space-y-2 pt-2 border-t border-slate-100">
            <span className="block text-[13px] font-bold text-slate-900">
              4. 生成设置
            </span>
            <div className="grid grid-cols-3 gap-2">
              {/* Text Mode */}
              <div className="relative flex items-center bg-slate-100/90 border border-slate-200/70 rounded-xl px-2.5 h-9">
                <Globe className="w-3.5 h-3.5 text-slate-500 mr-1.5 shrink-0" />
                <select
                  value={textMode}
                  onChange={(e) =>
                    onChangeTextMode(e.target.value as TextRenderMode)
                  }
                  className="w-full text-xs font-medium text-slate-800 bg-transparent focus:outline-none appearance-none cursor-pointer"
                >
                  <option value="with_text">直出文字海报</option>
                  <option value="without_text">无文字留白底图</option>
                </select>
              </div>

              {/* Aspect Ratio */}
              <div className="relative flex items-center bg-slate-100/90 border border-slate-200/70 rounded-xl px-2.5 h-9">
                <Layers className="w-3.5 h-3.5 text-slate-500 mr-1.5 shrink-0" />
                <select
                  value={aspectRatio}
                  onChange={(e) =>
                    onChangeAspectRatio(e.target.value as AspectRatioOption)
                  }
                  className="w-full text-xs font-mono-tabular font-semibold text-slate-800 bg-transparent focus:outline-none appearance-none cursor-pointer"
                >
                  <option value="9:16">9:16 竖屏</option>
                  <option value="3:4">3:4 电商</option>
                  <option value="1:1">1:1 方图</option>
                </select>
              </div>

              {/* Resolution */}
              <div className="grid grid-cols-2 p-0.5 bg-slate-100 border border-slate-200/70 rounded-xl h-9 items-center">
                {(['1K', '2K'] as ImageSizeOption[]).map((sz) => {
                  const active = imageSize === sz;
                  return (
                    <button
                      key={sz}
                      type="button"
                      onClick={() => onChangeImageSize(sz)}
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
          <button
            type="button"
            disabled={isPlanningModules || isBatchRunning || tasks.length === 0}
            onClick={() => onAiPlanAllModules(false)}
            className="w-full h-9 rounded-xl border border-slate-200 hover:border-slate-300 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-800 flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
          >
            {isPlanningModules ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
            ) : (
              <Wand2 className="w-3.5 h-3.5 text-blue-600" />
            )}
            <span>
              {isPlanningModules
                ? 'AI 正在生成各模块文案与画面描述...'
                : `✨ AI 一键生成各模块文案与画面描述 (${tasks.length}屏)`}
            </span>
          </button>

          {isBatchRunning ? (
            <button
              type="button"
              onClick={onStopBatchGenerate}
              className="w-full h-10 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm cursor-pointer"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>停止批量生成详情页</span>
            </button>
          ) : (
            <button
              type="button"
              disabled={isPlanningModules || tasks.length === 0}
              onClick={() => {
                const hasEmptyPrompts = tasks.some(
                  (t) => !t.visualPrompt.trim()
                );
                if (hasEmptyPrompts) {
                  onAiPlanAllModules(true);
                } else {
                  onStartBatchGenerate(false);
                }
              }}
              className="w-full h-10 rounded-xl bg-[#1F2329] hover:bg-black text-white text-[13px] font-bold flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>一键生成全套详情页 ({tasks.length}屏)</span>
            </button>
          )}
        </div>
      </aside>

      {/* ================= RIGHT CANVAS: MODULAR DETAIL WORKSPACE ================= */}
      <main className="flex-1 min-w-0 lg:h-full flex flex-col overflow-hidden">
        {/* Top Canvas Toolbar (Focused purely on Canvas & Export Actions) */}
        <div className="h-13 shrink-0 bg-white border-b border-slate-200/80 px-5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setRightViewMode('cards')}
                className={`h-7 px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer ${
                  rightViewMode === 'cards'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <LayoutList className="w-3.5 h-3.5" />
                <span>分屏模块卡片 ({tasks.length}屏)</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  if (completedCount > 0 && !stitchedLongImageUrl) {
                    onStitchLongImage();
                  }
                  setRightViewMode('long_preview');
                }}
                className={`h-7 px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer ${
                  rightViewMode === 'long_preview'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <ScrollText className="w-3.5 h-3.5" />
                <span>竖版无缝长图预览</span>
              </button>
            </div>

            <span className="hidden xl:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[11px] font-medium">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>每屏仅传自有 #Prod + 统一规范 · 0竞品图干扰</span>
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {onAppendTailModules && tasks.length > 0 && (
              <button
                type="button"
                onClick={onAppendTailModules}
                className="h-8 px-3 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg flex items-center gap-1 cursor-pointer"
                title="追加规格参数表 + 包装清单 + 售后保障3屏，并自动继承前序印花4维配色"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>追加收尾3屏</span>
              </button>
            )}

            {completedCount > 0 && (
              <>
                <button
                  type="button"
                  disabled={isStitching}
                  onClick={() => {
                    onStitchLongImage();
                    setRightViewMode('long_preview');
                  }}
                  className="h-8 px-3 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isStitching ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <ScrollText className="w-3.5 h-3.5 text-blue-600" />
                  )}
                  <span>合成长图</span>
                </button>
                <button
                  type="button"
                  disabled={isExportingZip}
                  onClick={onExportZip}
                  className="h-8 px-3.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center gap-1.5 shadow-2xs cursor-pointer disabled:opacity-50"
                >
                  {isExportingZip ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <FileArchive className="w-3.5 h-3.5" />
                  )}
                  <span>打包下载 ({completedCount})</span>
                </button>
              </>
            )}

            {tasks.length > 0 && (
              <button
                type="button"
                onClick={onClearAllTasks}
                className="h-8 px-2.5 text-xs text-slate-400 hover:text-rose-600 cursor-pointer"
              >
                清空模块
              </button>
            )}
          </div>
        </div>

        {/* Main Scrollable Canvas */}
        <div className="flex-1 overflow-y-auto p-5">
          {tasks.length === 0 ? (
            /* Empty State: Quick Module Combo Builder */
            <div className="max-w-4xl mx-auto py-8 space-y-6">
              <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-2xs space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                  <div className="space-y-1">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-slate-900 text-white text-xs font-semibold">
                      模块化详情页工作台
                    </span>
                    <h3 className="text-lg font-bold text-slate-900">
                      像搭积木一样自由添加详情页分屏模块，全套共享统一视觉规范与印花4维联动
                    </h3>
                    <p className="text-xs text-slate-500">
                      生图阶段不再逐屏塞入竞品参考图，彻底解决产品变形与画面撕裂问题。可从「① 主图工作台」一键延展 5 张主图并追加收尾 3 屏，或直接加载标准 7 屏模板。
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {onSyncFromSkuStudio && skuTasksCount > 0 && (
                      <button
                        type="button"
                        onClick={onSyncFromSkuStudio}
                        className="h-10 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm"
                      >
                        <ArrowRightLeft className="w-4 h-4" />
                        <span>从主图台导入延展 ({skuTasksCount}屏)</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={onApplyStandardPresetModules}
                      className="h-10 px-4 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-bold flex items-center gap-2 cursor-pointer shadow-sm"
                    >
                      <Sparkles className="w-4 h-4 text-amber-300" />
                      <span>一键加载标准 7 屏详情模板</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {DETAIL_MODULE_PRESETS.map((mod) => (
                    <button
                      key={mod.type}
                      type="button"
                      onClick={() => onAddModuleTask(mod.type)}
                      className="p-3.5 rounded-xl border border-slate-200 hover:border-slate-900 bg-slate-50/50 hover:bg-white text-left space-y-1.5 transition-all group cursor-pointer"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-base">{mod.icon}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200/70 text-slate-600 font-medium">
                          + 添加
                        </span>
                      </div>
                      <div className="text-xs font-bold text-slate-900">
                        {mod.label}
                      </div>
                      <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                        {mod.description}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : rightViewMode === 'long_preview' ? (
            /* Seamless Long Detail Page Preview */
            <div className="max-w-xl mx-auto bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <span className="text-sm font-bold text-slate-900">
                  详情页竖版无缝长图预览 ({completedCount}/{tasks.length}屏已出图)
                </span>
                {stitchedLongImageUrl && (
                  <a
                    href={stitchedLongImageUrl}
                    download={`详情页无缝长图_${Date.now()}.png`}
                    className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>下载无缝长图 (PNG)</span>
                  </a>
                )}
              </div>

              {completedCount === 0 ? (
                <div className="py-16 text-center text-xs text-slate-400">
                  暂无已生成的分屏图片，请先生成分屏后查看无缝长图
                </div>
              ) : (
                <div className="flex flex-col rounded-xl overflow-hidden border border-slate-200 bg-slate-100">
                  {tasks
                    .filter((t) => Boolean(t.resultImageUrl))
                    .map((t) => (
                      <img
                        key={`long-${t.id}`}
                        src={t.resultImageUrl}
                        alt={t.title}
                        onClick={() =>
                          onPreviewImage(
                            t.resultImageUrl!,
                            `第 ${t.screenNumber} 屏 · ${t.title}`
                          )
                        }
                        className="w-full h-auto block cursor-zoom-in"
                      />
                    ))}
                </div>
              )}
            </div>
          ) : (
            /* Modular Screen Cards List */
            <div className="max-w-5xl mx-auto space-y-4">
              {tasks.map((task, idx) => {
                const modMeta = getModuleMeta(task.moduleType);
                const isGenerating = task.status === 'generating';
                const boundProdIds = task.referenceImageIds.filter((id) =>
                  prodAssets.some((p) => p.id === id)
                );
                const isThemeExpanded = expandedThemeTaskIds.includes(task.id);
                const isThemeEnabled =
                  task.printThemeConfig?.enabled !== false &&
                  Boolean(
                    task.printThemeConfig?.printStory ||
                      task.printThemeConfig?.themePalette ||
                      task.printThemeConfig?.themeStage ||
                      task.printThemeConfig?.themeElements
                  );
                const taskSwatches = extractHexColors(
                  task.printThemeConfig?.themePalette,
                  specSwatches
                );
                const structuredCopy = parseStructuredCopy(
                  task.typographyPlan || task.copywriting
                );

                return (
                  <div
                    key={task.id}
                    className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch hover:border-slate-300 transition-all"
                  >
                    {/* Left 8 Cols: Module Config, Bound #Prod, Print 4D Theme, Structured Copy & Visual Prompt */}
                    <div className="lg:col-span-8 flex flex-col justify-between gap-3">
                      {/* Header Row */}
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="px-2 py-0.5 rounded-md bg-slate-900 text-white text-xs font-mono-tabular font-bold">
                            第 {String(idx + 1).padStart(2, '0')} 屏
                          </span>
                          <select
                            value={task.moduleType || 'selling_point'}
                            onChange={(e) => {
                              const nextType = e.target
                                .value as DetailModuleType;
                              const meta = getModuleMeta(nextType);
                              const prodIdSet = new Set(
                                prodAssets.map((p) => p.id)
                              );
                              const preservedOtherIds =
                                task.referenceImageIds.filter(
                                  (id) => !prodIdSet.has(id)
                                );
                              const nextRefIds =
                                nextType === 'series_matrix' &&
                                prodAssets.length > 1
                                  ? [
                                      ...preservedOtherIds,
                                      ...prodAssets.map((p) => p.id),
                                    ]
                                  : task.referenceImageIds;
                              onUpdateTask(task.id, {
                                moduleType: nextType,
                                sectionType: meta.label,
                                referenceImageIds: nextRefIds,
                              });
                            }}
                            className="h-7 px-2 text-xs font-semibold bg-slate-100 border border-slate-200 rounded-lg text-slate-800 cursor-pointer"
                          >
                            {DETAIL_MODULE_PRESETS.map((m) => (
                              <option key={m.type} value={m.type}>
                                {m.icon} {m.label}
                              </option>
                            ))}
                          </select>
                          <input
                            type="text"
                            value={task.title}
                            onChange={(e) =>
                              onUpdateTask(task.id, { title: e.target.value })
                            }
                            placeholder="本屏模块标题..."
                            className="h-7 px-2.5 text-xs font-bold text-slate-900 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:border-slate-900 min-w-[160px]"
                          />
                        </div>

                        {/* Reorder / Duplicate / Delete Controls */}
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => onMoveTask(task.id, 'up')}
                            className="p-1.5 text-slate-400 hover:text-slate-800 disabled:opacity-30 rounded-lg hover:bg-slate-100 cursor-pointer"
                            title="上移一屏"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={idx === tasks.length - 1}
                            onClick={() => onMoveTask(task.id, 'down')}
                            className="p-1.5 text-slate-400 hover:text-slate-800 disabled:opacity-30 rounded-lg hover:bg-slate-100 cursor-pointer"
                            title="下移一屏"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDuplicateTask(task)}
                            className="p-1.5 text-slate-400 hover:text-slate-800 rounded-lg hover:bg-slate-100 cursor-pointer"
                            title="复制此模块"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteTask(task.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 cursor-pointer"
                            title="删除此模块"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Bound Product Image Selector Row, 1:1 Anchor & Interactive 4D Print Theme Bar */}
                      <div className="space-y-2">
                        {task.sourceReplicaImageUrl && (
                          <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-amber-50/80 border border-amber-200/80">
                            <div className="flex items-center gap-2 min-w-0">
                              <img
                                src={task.sourceReplicaImageUrl}
                                alt="1:1主图基准"
                                onClick={() =>
                                  onPreviewImage(
                                    task.sourceReplicaImageUrl!,
                                    `第 ${idx + 1} 屏绑定 1:1 主图基准`
                                  )
                                }
                                className="w-8 h-8 rounded-lg object-cover border border-amber-300 shrink-0 cursor-zoom-in"
                              />
                              <div className="min-w-0">
                                <div className="text-[11px] font-bold text-amber-900 truncate">
                                  🔗 已绑定 1:1 主图同源延展基准 ({task.aspectRatio} 竖版重构)
                                </div>
                                <div className="text-[10px] text-amber-700 truncate">
                                  生图时将以该 1:1 成图为视觉锚点纵向延展上下画布，保持主体与光影一致
                                </div>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                onUpdateTask(task.id, {
                                  sourceReplicaImageUrl: undefined,
                                  benchmarkCase: '主图同源配方重绘',
                                })
                              }
                              className="px-2 py-1 rounded-md bg-white hover:bg-amber-100 text-[10px] font-semibold text-amber-900 border border-amber-200 shrink-0 cursor-pointer"
                            >
                              改为纯配方重绘
                            </button>
                          </div>
                        )}

                        {/* Interactive 4D Print Theme Linkage Bar */}
                        <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 p-2 space-y-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <label className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-900 cursor-pointer shrink-0">
                                <input
                                  type="checkbox"
                                  checked={isThemeEnabled}
                                  onChange={(e) => {
                                    const checked = e.target.checked;
                                    if (
                                      checked &&
                                      !task.printThemeConfig?.printStory
                                    ) {
                                      const boundProd = prodAssets.find((p) =>
                                        task.referenceImageIds.includes(p.id)
                                      );
                                      onUpdateTask(task.id, {
                                        printThemeConfig:
                                          buildCuratedPrintThemeVariation(
                                            boundProd?.tag || task.title,
                                            idx
                                          ),
                                      });
                                    } else {
                                      onUpdateTask(task.id, {
                                        printThemeConfig: {
                                          ...(task.printThemeConfig ||
                                            buildCuratedPrintThemeVariation(
                                              task.title,
                                              idx
                                            )),
                                          enabled: checked,
                                        },
                                      });
                                    }
                                  }}
                                  className="rounded border-slate-300 text-slate-900 focus:ring-0"
                                />
                                <Palette className="w-3.5 h-3.5 text-pink-600" />
                                <span>印花4维联动</span>
                              </label>

                              {/* Visual Color Swatch Dots */}
                              <div className="flex items-center -space-x-1 shrink-0">
                                {taskSwatches.map((hex, i) => (
                                  <span
                                    key={`${task.id}-hex-${i}`}
                                    style={{ backgroundColor: hex }}
                                    title={hex}
                                    className="w-3.5 h-3.5 rounded-full border border-white shadow-2xs inline-block"
                                  />
                                ))}
                              </div>

                              <span className="text-[11px] text-slate-600 truncate">
                                {isThemeEnabled && task.printThemeConfig
                                  ? [
                                      task.printThemeConfig.printStory,
                                      task.printThemeConfig.themeStage,
                                      task.printThemeConfig.themeElements,
                                    ]
                                      .filter(Boolean)
                                      .join(' · ')
                                  : '开启后按产品印花定制同色系背景、盲盒底座、3D漂浮件与浅色胶囊底栏'}
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => handleRollDetailTaskTheme(task)}
                                className="h-6 px-2 rounded-md bg-white hover:bg-slate-100 border border-slate-200/90 text-[11px] font-semibold text-slate-700 flex items-center gap-1 cursor-pointer"
                                title="随机切换一套潮玩马卡龙主题配色与微缩道具"
                              >
                                <Dices className="w-3 h-3 text-pink-600" />
                                <span>换灵感</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => toggleExpandTheme(task.id)}
                                className="h-6 px-2 rounded-md bg-white hover:bg-slate-100 border border-slate-200/90 text-[11px] font-medium text-slate-600 flex items-center gap-0.5 cursor-pointer"
                              >
                                <span>微调</span>
                                {isThemeExpanded ? (
                                  <ChevronUp className="w-3 h-3" />
                                ) : (
                                  <ChevronDown className="w-3 h-3" />
                                )}
                              </button>
                            </div>
                          </div>

                          {isThemeExpanded && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1.5 border-t border-slate-200/70">
                              <input
                                type="text"
                                value={task.printThemeConfig?.printStory || ''}
                                onChange={(e) =>
                                  onUpdateTask(task.id, {
                                    printThemeConfig: {
                                      ...(task.printThemeConfig ||
                                        buildCuratedPrintThemeVariation(
                                          task.title,
                                          idx
                                        )),
                                      enabled: true,
                                      printStory: e.target.value,
                                    },
                                  })
                                }
                                placeholder="① 印花主题故事 (如: 草莓熊甜品乐园)"
                                className="h-7 px-2 text-[11px] bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-slate-900"
                              />
                              <input
                                type="text"
                                value={
                                  task.printThemeConfig?.themePalette || ''
                                }
                                onChange={(e) =>
                                  onUpdateTask(task.id, {
                                    printThemeConfig: {
                                      ...(task.printThemeConfig ||
                                        buildCuratedPrintThemeVariation(
                                          task.title,
                                          idx
                                        )),
                                      enabled: true,
                                      themePalette: e.target.value,
                                    },
                                  })
                                }
                                placeholder="② 60-30-10专属色板 (支持#HEX色号)"
                                className="h-7 px-2 text-[11px] bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-slate-900"
                              />
                              <input
                                type="text"
                                value={task.printThemeConfig?.themeStage || ''}
                                onChange={(e) =>
                                  onUpdateTask(task.id, {
                                    printThemeConfig: {
                                      ...(task.printThemeConfig ||
                                        buildCuratedPrintThemeVariation(
                                          task.title,
                                          idx
                                        )),
                                      enabled: true,
                                      themeStage: e.target.value,
                                    },
                                  })
                                }
                                placeholder="③ 主题微缩底座材质"
                                className="h-7 px-2 text-[11px] bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-slate-900"
                              />
                              <input
                                type="text"
                                value={
                                  task.printThemeConfig?.themeElements || ''
                                }
                                onChange={(e) =>
                                  onUpdateTask(task.id, {
                                    printThemeConfig: {
                                      ...(task.printThemeConfig ||
                                        buildCuratedPrintThemeVariation(
                                          task.title,
                                          idx
                                        )),
                                      enabled: true,
                                      themeElements: e.target.value,
                                    },
                                  })
                                }
                                placeholder="④ 漂浮3D互动小道具"
                                className="h-7 px-2 text-[11px] bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-slate-900"
                              />
                              <input
                                type="text"
                                value={
                                  task.printThemeConfig?.themeUiStyle || ''
                                }
                                onChange={(e) =>
                                  onUpdateTask(task.id, {
                                    printThemeConfig: {
                                      ...(task.printThemeConfig ||
                                        buildCuratedPrintThemeVariation(
                                          task.title,
                                          idx
                                        )),
                                      enabled: true,
                                      themeUiStyle: e.target.value,
                                    },
                                  })
                                }
                                placeholder="⑤ 同色系UI胶囊与字体风格 (禁黑棕色块)"
                                className="sm:col-span-2 h-7 px-2 text-[11px] bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-slate-900"
                              />
                            </div>
                          )}
                        </div>

                        {prodAssets.length > 0 && (
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[11px] font-semibold text-slate-500">
                              本屏绑定产品图 (#Prod，可多选组合):
                            </span>
                            {prodAssets.map((prod) => {
                              const selected =
                                boundProdIds.length === 0 ||
                                boundProdIds.includes(prod.id);
                              const roleInfo = PROD_ANGLE_ROLES.find(
                                (r) =>
                                  r.value ===
                                  normalizeAngleRoleValue(prod.prodAngleRole)
                              );
                              return (
                                <button
                                  key={prod.id}
                                  type="button"
                                  onClick={() =>
                                    toggleTaskProdBinding(task, prod.id)
                                  }
                                  className={`h-7 pl-1 pr-2 rounded-lg border text-[11px] flex items-center gap-1.5 transition-all cursor-pointer ${
                                    selected
                                      ? 'border-blue-600 bg-blue-50/80 text-blue-700 font-semibold'
                                      : 'border-slate-200 bg-white text-slate-500 opacity-60 hover:opacity-100'
                                  }`}
                                >
                                  <img
                                    src={prod.previewUrl}
                                    alt={prod.tag}
                                    referrerPolicy="no-referrer"
                                    className="w-5 h-5 rounded object-cover"
                                  />
                                  <span>#{prod.code}</span>
                                  {roleInfo && (
                                    <span className="text-[10px] opacity-75">
                                      ·{roleInfo.label}
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Two-Column Editable Area: Left = Structured 3-Part Copywriting | Right = Visual Prompt + Extra Note */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 flex-1">
                        {/* Left Column: Structured 3-Part Copywriting */}
                        <div className="flex flex-col gap-1.5 bg-slate-50/80 border border-slate-200/80 rounded-xl p-2.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-semibold text-slate-700">
                              屏内分层文案 ({modMeta.badge})
                            </span>
                            <span className="text-[10px] text-slate-400">
                              自动映射上/中/下三段版式
                            </span>
                          </div>

                          <div className="space-y-1.5">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-semibold text-slate-500 w-13 shrink-0">
                                主标题
                              </span>
                              <input
                                type="text"
                                value={structuredCopy.headline}
                                onChange={(e) => {
                                  const next = composeStructuredCopy(
                                    e.target.value,
                                    structuredCopy.subheadline,
                                    structuredCopy.capsules
                                  );
                                  onUpdateTask(task.id, {
                                    typographyPlan: next,
                                    copywriting: next,
                                  });
                                }}
                                placeholder="顶部大标题 (如: 旗舰舒适耳夹 · 久戴不痛)"
                                className="flex-1 h-7 px-2 text-xs font-semibold bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-slate-900 text-slate-900"
                              />
                            </div>

                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-semibold text-slate-500 w-13 shrink-0">
                                副标题
                              </span>
                              <input
                                type="text"
                                value={structuredCopy.subheadline}
                                onChange={(e) => {
                                  const next = composeStructuredCopy(
                                    structuredCopy.headline,
                                    e.target.value,
                                    structuredCopy.capsules
                                  );
                                  onUpdateTask(task.id, {
                                    typographyPlan: next,
                                    copywriting: next,
                                  });
                                }}
                                placeholder="副标题/痛点利益点 (如: 云朵气囊Air 2.0 · 仅3.4g)"
                                className="flex-1 h-7 px-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-slate-900 text-slate-800"
                              />
                            </div>

                            <div className="flex items-start gap-1.5">
                              <span className="text-[10px] font-semibold text-slate-500 w-13 pt-1.5 shrink-0">
                                胶囊/参数
                              </span>
                              <textarea
                                rows={2}
                                value={structuredCopy.capsules}
                                onChange={(e) => {
                                  const next = composeStructuredCopy(
                                    structuredCopy.headline,
                                    structuredCopy.subheadline,
                                    e.target.value
                                  );
                                  onUpdateTask(task.id, {
                                    typographyPlan: next,
                                    copywriting: next,
                                  });
                                }}
                                placeholder="底部圆角胶囊卡或参数表内容（多个卖点用 | 分隔）..."
                                className="flex-1 p-2 text-xs leading-relaxed bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-slate-900 text-slate-800 resize-none"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Right Column: Visual Scene Prompt + Supplemental Note */}
                        <div className="flex flex-col justify-between gap-1.5 bg-slate-50/80 border border-slate-200/80 rounded-xl p-2.5">
                          <div className="flex flex-col gap-1 flex-1">
                            <span className="text-[11px] font-semibold text-slate-700">
                              画面场景与构图描述
                            </span>
                            <textarea
                              rows={3}
                              value={task.visualPrompt}
                              onChange={(e) =>
                                onUpdateTask(task.id, {
                                  visualPrompt: e.target.value,
                                })
                              }
                              placeholder="描述本屏的产品摆放角度、环境道具、光影氛围与视觉构图..."
                              className="flex-1 w-full p-2 text-xs leading-relaxed bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-slate-900 text-slate-800 resize-none"
                            />
                          </div>

                          <div className="flex items-center gap-1.5 pt-1">
                            <span className="text-[10px] font-semibold text-slate-500 shrink-0">
                              补充微调:
                            </span>
                            <input
                              type="text"
                              value={task.userNote || ''}
                              onChange={(e) =>
                                onUpdateTask(task.id, {
                                  userNote: e.target.value,
                                })
                              }
                              placeholder="选填：如强调微距金属质感、增加水花飞溅等..."
                              className="flex-1 h-7 px-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-slate-900"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Right 4 Cols: Rendered Image Preview, History Version Strip & Lock-Result Refinement */}
                    <div className="lg:col-span-4 flex flex-col justify-between gap-2 bg-slate-50/80 border border-slate-200/70 rounded-xl p-3">
                      <div
                        className={`relative flex-1 min-h-[220px] rounded-lg overflow-hidden bg-white border ${
                          task.lockResultAsRef && task.resultImageUrl
                            ? 'border-amber-400 ring-2 ring-amber-400/25'
                            : 'border-slate-200'
                        } flex items-center justify-center group`}
                      >
                        {isGenerating ? (
                          <div className="flex flex-col items-center gap-2 text-xs text-slate-500">
                            <Loader2 className="w-6 h-6 animate-spin text-slate-900" />
                            <span>正在渲染第 {idx + 1} 屏...</span>
                          </div>
                        ) : task.resultImageUrl ? (
                          <>
                            <img
                              src={task.resultImageUrl}
                              alt={task.title}
                              onClick={() =>
                                onPreviewImage(
                                  task.resultImageUrl!,
                                  `第 ${idx + 1} 屏 · ${task.title}`,
                                  `${task.aspectRatio} · ${task.imageSize}`
                                )
                              }
                              className="w-full h-full max-h-[280px] object-contain cursor-zoom-in"
                            />
                            {task.lockResultAsRef && (
                              <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-amber-500 text-white text-[10px] font-bold flex items-center gap-1 shadow-xs">
                                <Lock className="w-2.5 h-2.5" />
                                <span>已锁此成图为微调基准</span>
                              </span>
                            )}
                            <div className="absolute bottom-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                type="button"
                                onClick={() =>
                                  onPreviewImage(
                                    task.resultImageUrl!,
                                    `第 ${idx + 1} 屏 · ${task.title}`
                                  )
                                }
                                className="p-1.5 bg-slate-900/80 hover:bg-slate-900 text-white rounded-lg cursor-pointer"
                                title="放大预览"
                              >
                                <Maximize2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => downloadSingleScreenImage(task)}
                                className="p-1.5 bg-blue-600/90 hover:bg-blue-700 text-white rounded-lg cursor-pointer"
                                title="下载单屏"
                              >
                                <Download className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </>
                        ) : task.status === 'error' ? (
                          <div className="p-3 text-center space-y-1">
                            <AlertCircle className="w-5 h-5 text-rose-500 mx-auto" />
                            <p className="text-[11px] text-rose-600 line-clamp-3">
                              {task.errorMessage || '生图失败，请点击重绘'}
                            </p>
                          </div>
                        ) : (
                          <div className="text-center p-4 space-y-1 text-slate-400">
                            <div className="text-lg">{modMeta.icon}</div>
                            <div className="text-xs font-medium">
                              待生成 · {modMeta.label}
                            </div>
                            <div className="text-[10px]">
                              {task.aspectRatio} · {task.imageSize}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Non-destructive History Version Strip (v1 / v2 / v3...) */}
                      {task.historyImages && task.historyImages.length > 0 && (
                        <div className="flex items-center justify-between gap-1.5 px-2 py-1 rounded-lg bg-white border border-slate-200/80">
                          <span className="text-[10px] font-semibold text-slate-500 flex items-center gap-1 shrink-0">
                            <History className="w-3 h-3 text-slate-400" />
                            <span>历史版 ({task.historyImages.length}):</span>
                          </span>
                          <div className="flex items-center gap-1 overflow-x-auto">
                            {[...task.historyImages]
                              .reverse()
                              .map((hItem, vIdx) => {
                                const isCurrentVersion =
                                  task.resultImageUrl === hItem.url;
                                return (
                                  <button
                                    key={`${task.id}-dhist-${vIdx}-${hItem.timestamp}`}
                                    type="button"
                                    onClick={() => {
                                      onUpdateTask(task.id, {
                                        resultImageUrl: hItem.url,
                                        resultOssUrl: hItem.ossUrl,
                                        resultCloudUrls: hItem.cloudUrls,
                                        status: 'completed',
                                      });
                                      onShowToast?.(
                                        `已切换第 ${idx + 1} 屏至 v${vIdx + 1} 版本（${hItem.timestamp}）`,
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

                      {/* 🔒 Lock Current Result for Local Refinement Input */}
                      {task.resultImageUrl && task.lockResultAsRef && (
                        <input
                          type="text"
                          value={task.refineInstruction || ''}
                          onChange={(e) =>
                            onUpdateTask(task.id, {
                              refineInstruction: e.target.value,
                            })
                          }
                          placeholder="🔒 局部微调指令（如：保持构图，把标题改成亮黄、减少底部小元素）..."
                          className="w-full h-7 px-2 text-[11px] bg-amber-50/90 border border-amber-300 rounded-lg focus:bg-white focus:outline-none focus:border-amber-600 text-slate-900 placeholder:text-amber-700/70"
                        />
                      )}

                      <div className="flex items-center gap-1.5">
                        {task.resultImageUrl && (
                          <button
                            type="button"
                            onClick={() =>
                              onUpdateTask(task.id, {
                                lockResultAsRef: !task.lockResultAsRef,
                              })
                            }
                            title="开启后将以当前满意成图为构图基准，仅对文案或局部元素做定点微调重绘"
                            className={`h-8 px-2.5 rounded-lg border text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer shrink-0 ${
                              task.lockResultAsRef
                                ? 'bg-amber-500 text-white border-amber-600 shadow-2xs'
                                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            {task.lockResultAsRef ? (
                              <Lock className="w-3.5 h-3.5" />
                            ) : (
                              <Unlock className="w-3.5 h-3.5" />
                            )}
                            <span>锁图微调</span>
                          </button>
                        )}

                        <button
                          type="button"
                          disabled={isGenerating}
                          onClick={() => onGenerateSingleTask(task)}
                          className={`flex-1 h-8 rounded-lg text-white text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 ${
                            task.lockResultAsRef && task.resultImageUrl
                              ? 'bg-amber-600 hover:bg-amber-700'
                              : 'bg-slate-900 hover:bg-black'
                          }`}
                        >
                          {isGenerating ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <RefreshCw className="w-3.5 h-3.5" />
                          )}
                          <span>
                            {task.resultImageUrl
                              ? task.lockResultAsRef
                                ? '🔒 锁图微调本屏'
                                : '重新生成本屏'
                              : '立即生成本屏'}
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Bottom Quick Add Module Bar */}
              <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-3 flex flex-wrap items-center justify-center gap-2">
                <span className="text-xs font-semibold text-slate-500 mr-1">
                  继续添加模块屏：
                </span>
                {DETAIL_MODULE_PRESETS.map((mod) => (
                  <button
                    key={`bottom-${mod.type}`}
                    type="button"
                    onClick={() => onAddModuleTask(mod.type)}
                    className="h-7 px-2.5 rounded-lg bg-slate-100 hover:bg-slate-900 text-slate-700 hover:text-white text-xs font-medium transition-colors cursor-pointer"
                  >
                    + {mod.icon} {mod.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* ================= ASSET LIBRARY PICKER MODAL ================= */}
      {assetModal.open && (
        <div
          onClick={() =>
            setAssetModal((prev) => ({ ...prev, open: false, selectedIds: [] }))
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
                {assetModal.category === 'product'
                  ? '产品原图 (#Prod)'
                  : '竞品参考图 (#Case)'}
              </span>
              <button
                type="button"
                onClick={() =>
                  setAssetModal((prev) => ({
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
              {commonAssets.filter((a) => a.category === assetModal.category)
                .length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400">
                  资产库中暂无此类素材
                </div>
              ) : (
                <div className="grid grid-cols-4 sm:grid-cols-5 gap-3">
                  {commonAssets
                    .filter((a) => a.category === assetModal.category)
                    .map((asset) => {
                      const selected = assetModal.selectedIds.includes(asset.id);
                      return (
                        <button
                          key={asset.id}
                          type="button"
                          onClick={() =>
                            setAssetModal((prev) => ({
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
                  setAssetModal((prev) => ({
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
                disabled={assetModal.selectedIds.length === 0}
                onClick={() => {
                  const chosen = commonAssets.filter((a) =>
                    assetModal.selectedIds.includes(a.id)
                  );
                  onSelectAssetsFromLibrary(chosen, assetModal.category);
                  setAssetModal((prev) => ({
                    ...prev,
                    open: false,
                    selectedIds: [],
                  }));
                }}
                className="px-4 py-1.5 text-xs font-semibold bg-slate-900 text-white rounded-lg hover:bg-black disabled:opacity-50 cursor-pointer"
              >
                确认导入 ({assetModal.selectedIds.length})
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
