import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Upload,
  Sparkles,
  Play,
  Square,
  RefreshCw,
  Download,
  FileArchive,
  Layers,
  Check,
  Trash2,
  Plus,
  Image as ImageIcon,
  Maximize2,
  X,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Wand2,
  ArrowDownToLine,
  LayoutList,
  Globe,
  ScanEye,
  Type as TypeIcon,
  FileText,
  Copy,
  Settings2,
  Lock,
  Zap,
  Columns2,
  LayoutGrid,
  Columns3,
  RotateCcw,
  Cpu,
  Server,
  Monitor,
  Cloud,
  CloudUpload,
  Link2,
  KeyRound,
  Eye,
  EyeOff,
  Palette,
  BookmarkCheck,
  ShieldCheck,
  SlidersHorizontal,
  ArrowUp,
  ArrowDown,
  ChevronDown,
  ChevronRight,
  Star,
} from 'lucide-react';
import {
  StudioConfig,
  AliyunOssConfig,
  CloudStorageProvider,
  ReferenceImageItem,
  ScreenTask,
  AspectRatioOption,
  ImageSizeOption,
  AgentModelId,
  ImageModelId,
  ApiProtocolMode,
  ModelPresetItem,
  CASE_DIMENSION_META,
  DEFAULT_CASE_DIMENSIONS,
  LOCK_ALL_SWAP_PATTERN_DIMENSIONS,
  CaseRefDimension,
  DetailCaseDeliveryMode,
  TaskScopeOption,
  TextRenderMode,
  ScreenLayerType,
  WorkspaceTopTab,
  OversizedImageCandidate,
  SkuBatchConfig,
  SkuDefaultFallbackConfig,
  QualityGuardGlobalConfig,
  SkuDifferenceMode,
  SkuTitleIndexMode,
  SkuSellingPointPreset,
  SkuTask,
  RuntimeLogEntry,
  RuntimeLogWorkspace,
  getCloudUrlForProvider,
  getCloudObjectKeyForProvider,
  isSyncedToProvider,
  mergeCloudUrlsForProvider,
  inferUrlStorageProvider,
  DetailModuleType,
  DETAIL_MODULE_PRESETS,
  ReplicaMatchMode,
  ReplicaCategory,
  ReplicaFidelity,
  StyleLinkageMode,
  ReplicaLanguage,
} from './types';
import { PRESET_TEMPLATES } from './presets';
import {
  downloadSingleScreenImage,
  exportTasksAsZip,
  exportSkuTasksAsZip,
  stitchLongDetailPageImage,
  triggerReliableImageDownload,
} from './utils/exportHelpers';
import {
  QuickAssetSelectMode,
  applyQuickAssetSelectionMode,
  filterEnabledProds,
  inferProdAngleRoleFromAsset,
  limitAndOrderTaskProdsForRender,
  sanitizeVisualPromptForRender,
  sanitizeCopywritingForRender,
  smartPickComplementaryProds,
} from './utils/qualityGuardEngine';
import {
  studioBridge,
  DEFAULT_AGENT_MODEL_PRESETS,
  DEFAULT_IMAGE_MODEL_PRESETS,
  normalizeEndpointPreview,
  DESKTOP_ARCHITECTURE_BOUNDARIES,
} from './services/studioBridge';
import {
  ConfirmedMasterTemplate,
  loadConfirmedTemplatesFromDb,
  saveConfirmedTemplateToDb,
  deleteConfirmedTemplateFromDb,
  saveWorkspaceSnapshotToDb,
  loadWorkspaceSnapshotFromDb,
  clearWorkspaceSnapshotInDb,
  exportMasterTemplateToJsonFile,
  importMasterTemplateFromJsonFile,
} from './utils/masterTemplateDb';
import {
  SavedCommonAsset,
  GenerationRecordItem,
  loadCommonAssetsFromDb,
  saveCommonAssetsToDb,
  deleteCommonAssetsFromDb,
  loadGenerationRecordsFromDb,
  saveGenerationRecordToDb,
  updateGenerationRecordsInDb,
  deleteGenerationRecordsFromDb,
  convertRefItemToCommonAsset,
} from './utils/assetLibraryDb';
import {
  inspectOversizedImageFile,
  normalizeUploadedImageHighRes,
  extractMimeAndExtFromDataUrl,
} from './utils/imagePreprocessor';
import { LongImageHelperModal } from './components/LongImageHelperModal';
import { CaseScreenConfirmModal } from './components/CaseScreenConfirmModal';
import { MasterLibraryView } from './components/MasterLibraryView';
import {
  AdaptNewSkuModal,
  ImageLightboxModal,
} from './components/AdaptNewSkuModal';
import { SkuStudioView } from './components/SkuStudioView';
import { DetailModularView } from './components/DetailModularView';
import { DetailAssetPickerModal } from './components/DetailAssetPickerModal';
import { CaseDimensionHelpPopover } from './components/CaseDimensionHelpPopover';
import {
  buildClientCaseDimensionDirective,
  stripLeadingSubtitleSlash,
  buildUnifiedMasterLockPrompt,
  synthesizeScreenFromCaseAndPlan,
  isTaskPollutedByPlaceholdersOrSkeleton,
  selectBestProdRefsForScreen,
  deriveUnifiedVisualSpecFromCases,
  extractIndependentCaseCustomRules,
  isExplicitLockBaseSwapCase,
  flattenCaseLogicalScreens,
  syncFlattenedScreensBackToCases,
  refreshTaskOnCaseDimensionChange,
  buildRenderStageBenchmarkSummary,
  syncPlanDocToExistingTasks,
  syncUnifiedVisualSpecToTask,
  splitSkuTitleTwoLines,
  syncSkuTitleInText,
  syncSellingPointsIntoTypographyAndPrompt,
} from './utils/casePromptEngine';
import {
  StudioTopHeader,
  GlobalSettingsTab,
} from './components/StudioTopHeader';
import {
  DetectedCaseSubScreen,
  FlattenedLogicalScreenItem,
} from './types';

const INITIAL_CONFIG: StudioConfig = {
  activeChannelId: 'official-gemini',
  channels: [
    {
      id: 'official-gemini',
      name: '内置官方直连通道 (默认推荐)',
      mode: 'official',
      baseUrl: '',
      protocol: 'auto',
      concurrency: 2,
      timeoutSec: 120,
    },
    {
      id: 'custom-gateway-1',
      name: '自定义中转网关通道 A (支持双栈自动兼容)',
      mode: 'custom_gateway',
      baseUrl: 'https://generativelanguage.googleapis.com',
      protocol: 'auto',
      concurrency: 2,
      timeoutSec: 120,
    },
    {
      id: 'custom-openai-gateway',
      name: 'OpenAI / OneAPI / NewAPI 聚合网关通道 B',
      mode: 'custom_gateway',
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
      protocol: 'openai-compatible',
      concurrency: 3,
      timeoutSec: 120,
    },
    {
      id: 'local-codex-cli',
      name: '本地 Codex CLI 通道 (支持内置模型对话与生图)',
      mode: 'codex_cli',
      baseUrl: 'codex://local',
      cliCommand: 'codex',
      protocol: 'codex-cli',
      concurrency: 2,
      timeoutSec: 120,
    },
  ],
  agentModel: 'gemini-4-argon',
  enableHighThinking: true,
  imageModel: 'gemini-nano-banana-2.1',
  agentModelPresets: DEFAULT_AGENT_MODEL_PRESETS,
  imageModelPresets: DEFAULT_IMAGE_MODEL_PRESETS,
  defaultSellingPointPresets: [
    {
      id: 'sp-preset-audio',
      label: '🎧 声学高配版',
      sellingPointBadge: '蓝牙6.0 ｜ 13mm鲸腔动圈 ｜ 36h超长续航',
      packageSpecNote: '含充电仓+双耳主机+Type-C快充线+说明书',
    },
    {
      id: 'sp-preset-ip',
      label: '✨ 潮玩印花款',
      sellingPointBadge: '原创IP定制印花 ｜ 亲肤防刮涂层 ｜ 轻巧便携',
      packageSpecNote: '官方正品定制款 · 独立防尘礼盒包装',
    },
    {
      id: 'sp-preset-gift',
      label: '🎁 豪华礼盒装',
      sellingPointBadge: '限定礼盒装 ｜ 赠定制公仔挂件 ｜ 顺丰速发',
      packageSpecNote: '含主机+全包保护套+定制挂绳公仔+高定礼盒礼袋',
    },
    {
      id: 'sp-preset-flagship',
      label: '⚡ 旗舰数显版',
      sellingPointBadge: 'LED智能数显屏 ｜ 双麦ENC降噪 ｜ 开盖闪连',
      packageSpecNote: '旗舰顶配版 · 含主机+闪充线+三副抗菌耳帽',
    },
    {
      id: 'sp-preset-standard',
      label: '🛡️ 官方标配款',
      sellingPointBadge: '官方正品保障 ｜ 7天无理由 ｜ 365天只换不修',
      packageSpecNote: '标准单机装 · 严选品质全检发货',
    },
  ],
  skuDefaultFallback: {
    skuDiffMode: 'pattern_color',
    titlePrefix: '',
    subtitleText: '',
    swapTitleOrder: false,
    titleIndexMode: 'seq_1',
    defaultAspectRatio: '1:1',
    defaultImageSize: '1K',
    textMode: 'with_text',
    replicaFidelity: 'style_reference',
    styleLinkageMode: 'print_4d',
    replicaLanguage: 'zh',
  },
  qualityGuardConfig: {
    autoSanitizePromptCodes: true,
    strictSingleSkuProdCap: true,
    enforceLightRoundedCards: true,
    lockRefineHighWeightAnchor: true,
    customNegativePrompt:
      '严禁出现有线耳机线、严禁改变充电仓指示灯孔位与合页结构、严禁同一展台并排出现两个重复充电仓、严禁绘制3D医药胶囊颗粒与深棕黑底框、严禁乱码错别字与半截文字',
  },
  confirmBeforeReset: true,
  preserveCopyOnReset: false,
  defaultAspectRatio: '9:16',
  defaultImageSize: '1K',
  globalStylePrefix: PRESET_TEMPLATES[0].globalStylePrefix,
  requirements: {
    ...PRESET_TEMPLATES[0].defaultRequirements,
    taskScope: 'detail_only',
    caseDeliveryMode: 'none',
  },
  ossConfig: {
    enabled: false,
    provider: 'aliyun_oss',
    region: 'oss-cn-hangzhou',
    bucket: '',
    accessKeyId: '',
    accessKeySecret: '',
    customDomain: '',
    pathPrefix: 'ecom-studio-assets',
    r2AccountId: '',
    r2Endpoint: '',
    r2Bucket: '',
    r2AccessKeyId: '',
    r2SecretAccessKey: '',
    r2CustomDomain: '',
    r2PathPrefix: 'ecom-studio-assets',
    autoUploadRefs: true,
    autoArchiveResults: true,
    preferZeroBase64Transport: true,
  },
};

export const DEFAULT_SKU_SELLING_POINT_PRESETS: SkuSellingPointPreset[] =
  INITIAL_CONFIG.defaultSellingPointPresets!;

export const DEFAULT_SKU_FALLBACK_CONFIG: SkuDefaultFallbackConfig =
  INITIAL_CONFIG.skuDefaultFallback!;

export const DEFAULT_QUALITY_GUARD_CONFIG: QualityGuardGlobalConfig =
  INITIAL_CONFIG.qualityGuardConfig!;

const LEGACY_CONFLICTING_LAYOUT_RULES = new Set([
  '电商标准高质感极简展台背景，严锁全套相同相机焦段、相同产品45°黄金摆放视角与相同尺寸占比；顶部或右上角统一摆放款式花色名称与色卡胶囊，底部预留12%防遮挡安全区。',
  '电商标准高质感极简展台背景，严锁全套相同相机焦段、相同产品45°黄金摆放视角与相同尺寸占比；顶部或右上角统一摆放款式花色名称与卖点胶囊，底部预留12%防遮挡安全区。',
]);

function mergeOssConfigPreservingCredentials(
  ...sources: Array<Partial<AliyunOssConfig> | undefined>
): AliyunOssConfig {
  const merged: AliyunOssConfig = {
    ...INITIAL_CONFIG.ossConfig!,
  };
  for (const src of sources) {
    if (!src || typeof src !== 'object') continue;
    if (typeof src.enabled === 'boolean') merged.enabled = src.enabled;
    if (src.provider === 'aliyun_oss' || src.provider === 'cloudflare_r2') {
      merged.provider = src.provider;
    }
    if (typeof src.autoUploadRefs === 'boolean') {
      merged.autoUploadRefs = src.autoUploadRefs;
    }
    if (typeof src.autoArchiveResults === 'boolean') {
      merged.autoArchiveResults = src.autoArchiveResults;
    }
    if (typeof src.preferZeroBase64Transport === 'boolean') {
      merged.preferZeroBase64Transport = src.preferZeroBase64Transport;
    }
    const strFields: Array<
      | 'region'
      | 'bucket'
      | 'accessKeyId'
      | 'accessKeySecret'
      | 'customDomain'
      | 'pathPrefix'
      | 'r2AccountId'
      | 'r2Endpoint'
      | 'r2Bucket'
      | 'r2AccessKeyId'
      | 'r2SecretAccessKey'
      | 'r2CustomDomain'
      | 'r2PathPrefix'
    > = [
      'region',
      'bucket',
      'accessKeyId',
      'accessKeySecret',
      'customDomain',
      'pathPrefix',
      'r2AccountId',
      'r2Endpoint',
      'r2Bucket',
      'r2AccessKeyId',
      'r2SecretAccessKey',
      'r2CustomDomain',
      'r2PathPrefix',
    ];
    for (const key of strFields) {
      const val = src[key];
      if (typeof val === 'string' && (val.trim() !== '' || !merged[key])) {
        merged[key] = val;
      }
    }
  }
  return merged;
}

const INITIAL_SKU_BATCH_CONFIG: SkuBatchConfig = {
  selectedProdIds: [],
  globalCaseRefIds: [],
  skuDiffMode: 'pattern_color',
  titlePrefix: '',
  subtitleText: '',
  titleIndexMode: 'seq_1',
  customTitleLines: '',
  referenceInfoText: '',
  unifiedLayoutRule: '',
  defaultAspectRatio: '1:1',
  defaultImageSize: '1K',
  textMode: 'with_text',
  replicaCategory: 'ecommerce_product',
  replicaFidelity: 'high_replica',
  consistentOutputStyle: true,
  styleLinkageMode: 'print_4d',
  replicaLanguage: 'zh',
  replicaMatchMode: 'single_prod_to_multi_ref',
  sellingPointPresets: DEFAULT_SKU_SELLING_POINT_PRESETS,
};

const ALIYUN_OSS_REGIONS: { value: string; label: string }[] = [
  { value: 'oss-cn-hangzhou', label: '华东1（杭州）oss-cn-hangzhou' },
  { value: 'oss-cn-shanghai', label: '华东2（上海）oss-cn-shanghai' },
  { value: 'oss-cn-shenzhen', label: '华南1（深圳）oss-cn-shenzhen' },
  { value: 'oss-cn-guangzhou', label: '华南3（广州）oss-cn-guangzhou' },
  { value: 'oss-cn-beijing', label: '华北2（北京）oss-cn-beijing' },
  { value: 'oss-cn-qingdao', label: '华北1（青岛）oss-cn-qingdao' },
  { value: 'oss-cn-zhangjiakou', label: '华北3（张家口）oss-cn-zhangjiakou' },
  { value: 'oss-cn-chengdu', label: '西南1（成都）oss-cn-chengdu' },
  { value: 'oss-cn-hongkong', label: '中国香港 oss-cn-hongkong' },
  { value: 'oss-ap-southeast-1', label: '新加坡 oss-ap-southeast-1' },
  { value: 'oss-us-west-1', label: '美国（硅谷）oss-us-west-1' },
];

const ASPECT_RATIO_OPTIONS: { value: AspectRatioOption; label: string }[] = [
  { value: '9:16', label: '9:16 竖屏详情 (1080×1920)' },
  { value: '3:4', label: '3:4 电商海报竖屏' },
  { value: '1:1', label: '1:1 商品主图方图' },
  { value: '4:3', label: '4:3 横版展示卡' },
  { value: '16:9', label: '16:9 宽屏横版KV' },
  { value: '1:4', label: '1:4 超长条屏' },
  { value: '4:1', label: '4:1 横幅Banner' },
];

const IMAGE_SIZE_OPTIONS: { value: ImageSizeOption; label: string }[] = [
  { value: '1K', label: '1K 标准高清 (快速)' },
  { value: '2K', label: '2K 超清商业级' },
  { value: '4K', label: '4K 印刷级原图' },
];

const CASE_DIMENSION_OPTIONS: { value: CaseRefDimension; label: string }[] =
  CASE_DIMENSION_META.map((d) => ({ value: d.value, label: d.label }));


function reindexReferenceCodes(
  items: ReferenceImageItem[]
): ReferenceImageItem[] {
  let prodIdx = 1;
  let caseIdx = 1;
  return items.map((item) => {
    if (item.category === 'case') {
      return { ...item, code: `Case-${caseIdx++}` };
    }
    return { ...item, code: `Prod-${prodIdx++}` };
  });
}

export default function App() {
  const [activeTopTab, setActiveTopTab] = useState<WorkspaceTopTab>(() => {
    try {
      const saved = localStorage.getItem('ecom_studio_last_active_tab_v1');
      if (
        saved === 'sku_studio' ||
        saved === 'detail_studio' ||
        saved === 'master_library'
      ) {
        return saved;
      }
    } catch {
      // Ignore storage error
    }
    return 'sku_studio';
  });

  useEffect(() => {
    try {
      localStorage.setItem('ecom_studio_last_active_tab_v1', activeTopTab);
    } catch {
      // Ignore storage error
    }
  }, [activeTopTab]);
  const [oversizedQueue, setOversizedQueue] = useState<
    OversizedImageCandidate[]
  >([]);
  const [lastSlicedCaseCandidate, setLastSlicedCaseCandidate] = useState<{
    candidate: OversizedImageCandidate;
    sliceRefIds: string[];
  } | null>(null);
  const [caseScreenConfirmModal, setCaseScreenConfirmModal] = useState<{
    isOpen: boolean;
    initialScreens: FlattenedLogicalScreenItem[];
    initialUnifiedVisualSpec: string;
  }>({
    isOpen: false,
    initialScreens: [],
    initialUnifiedVisualSpec: '',
  });
  const [showChannelApiKey, setShowChannelApiKey] = useState(false);

  const [config, setConfig] = useState<StudioConfig>(INITIAL_CONFIG);
  const [selectedPresetId, setSelectedPresetId] = useState<string>(
    PRESET_TEMPLATES[0].id
  );
  const [confirmedTemplates, setConfirmedTemplates] = useState<
    ConfirmedMasterTemplate[]
  >([]);
  const [showSaveMasterModal, setShowSaveMasterModal] = useState(false);
  const [newMasterNameInput, setNewMasterNameInput] = useState('');

  const [productInfoText, setProductInfoText] = useState<string>('');
  const [fullPlanDoc, setFullPlanDoc] = useState<string>('');
  const [campaignSummary, setCampaignSummary] = useState<string>(
    '纯净生产工作台就绪：已清除全部模拟数据与未确认母版。请上传真实素材并生成分屏方案，确认后可一键存为正式母版。'
  );
  const [referenceImages, setReferenceImages] = useState<ReferenceImageItem[]>(
    []
  );
  const [tasks, setTasks] = useState<ScreenTask[]>([]);

  // SKU Studio Batch states (independent reference image pool decoupled from Detail Studio)
  const [skuReferenceImages, setSkuReferenceImages] = useState<
    ReferenceImageItem[]
  >([]);
  const [skuBatchConfig, setSkuBatchConfig] = useState<SkuBatchConfig>(
    INITIAL_SKU_BATCH_CONFIG
  );
  const [skuTasks, setSkuTasks] = useState<SkuTask[]>([]);
  const [skuBatchSummary, setSkuBatchSummary] = useState<string>('');
  const [detailAssetPickerModal, setDetailAssetPickerModal] = useState<{
    open: boolean;
    category: 'product' | 'case';
    selectedIds: string[];
  }>({
    open: false,
    category: 'product',
    selectedIds: [],
  });
  const [isParsingSkuPlan, setIsParsingSkuPlan] = useState(false);
  const [isSkuBatchRunning, setIsSkuBatchRunning] = useState(false);
  const [polishingSkuTaskId, setPolishingSkuTaskId] = useState<string | null>(
    null
  );
  const [generatingPromptSkuTaskId, setGeneratingPromptSkuTaskId] = useState<
    string | null
  >(null);
  const [isExtractingCaseLayout, setIsExtractingCaseLayout] = useState(false);
  const [isExportingSkuZip, setIsExportingSkuZip] = useState(false);

  // Left Column UI states
  const [leftActiveModule, setLeftActiveModule] = useState<
    'assets' | 'plan' | 'specs'
  >('assets');
  const [activeAssetTab, setActiveAssetTab] = useState<'product' | 'case'>(
    'product'
  );
  const [leftTextTab, setLeftTextTab] = useState<
    'info' | 'plan' | 'visual_spec'
  >('plan');
  const [isAnalyzingRefs, setIsAnalyzingRefs] = useState(false);
  const [expandedDetailRuleCaseIds, setExpandedDetailRuleCaseIds] = useState<
    string[]
  >([]);

  // Right Column & Card Editor states
  const [viewMode, setViewMode] = useState<
    'cards' | 'plan_doc' | 'long_preview'
  >('cards');
  const [cardLayout, setCardLayout] = useState<'storyboard' | 'grid'>(
    'storyboard'
  );
  const [confirmClearTasks, setConfirmClearTasks] = useState(false);
  const [layerFilter, setLayerFilter] = useState<'all' | 'dynamic' | 'static'>(
    'all'
  );
  const [statusFilter, setStatusFilter] = useState<
    'all' | 'idle' | 'completed' | 'error'
  >('all');
  const [cardEditorTabMap, setCardEditorTabMap] = useState<
    Record<string, 'visual' | 'typography'>
  >({});
  const [expandedRefPickerTaskId, setExpandedRefPickerTaskId] = useState<
    string | null
  >(null);

  // Modals & Popovers
  const [showApiModal, setShowApiModal] = useState(false);
  const [apiConfigTab, setApiConfigTab] =
    useState<GlobalSettingsTab>('presets_fallback');
  const [newGlobalSpForm, setNewGlobalSpForm] = useState<{
    label: string;
    sellingPointBadge: string;
    packageSpecNote: string;
    titlePrefix: string;
    subtitleText: string;
  }>({
    label: '',
    sellingPointBadge: '',
    packageSpecNote: '',
    titlePrefix: '',
    subtitleText: '',
  });
  const globalConfigFileInputRef = useRef<HTMLInputElement>(null);
  const [ossTestStatus, setOssTestStatus] = useState<{
    loading: boolean;
    ok?: boolean;
    message?: string;
    sampleUrl?: string;
  }>({ loading: false });
  const [envOssDetected, setEnvOssDetected] = useState<{
    envConfigured: boolean;
    ossEnvConfigured?: boolean;
    r2EnvConfigured?: boolean;
    region?: string;
    bucket?: string;
    r2AccountId?: string;
    r2Bucket?: string;
  }>({ envConfigured: false });
  const [isSyncingAllRefsToOss, setIsSyncingAllRefsToOss] = useState(false);
  const [showNewChannelForm, setShowNewChannelForm] = useState(false);
  const [newChannelForm, setNewChannelForm] = useState<{
    name: string;
    baseUrl: string;
    apiKey: string;
    customHeaders: string;
    protocol: ApiProtocolMode;
    concurrency: number;
  }>({
    name: '',
    baseUrl: '',
    apiKey: '',
    customHeaders: '',
    protocol: 'auto',
    concurrency: 2,
  });
  const [newModelPresetForm, setNewModelPresetForm] = useState<{
    category: 'agent' | 'image';
    id: string;
    label: string;
    protocolHint: ApiProtocolMode;
  }>({
    category: 'agent',
    id: '',
    label: '',
    protocolHint: 'auto',
  });

  // Adapt to New SKU Modal & Static Screen Lock Protection states
  const [showAdaptSkuModal, setShowAdaptSkuModal] = useState(false);
  const [skuNameHintInput, setSkuNameHintInput] = useState('');
  const [selectedSkuImageIds, setSelectedSkuImageIds] = useState<string[]>([]);
  const [autoReplaceDynamicRefs, setAutoReplaceDynamicRefs] = useState(true);
  const [lockCompletedStaticScreens, setLockCompletedStaticScreens] =
    useState(true);
  const [hasLoadedStorage, setHasLoadedStorage] = useState(false);

  // Async workflow states
  const [isParsingPlan, setIsParsingPlan] = useState(false);
  const [isAdaptingSku, setIsAdaptingSku] = useState(false);
  const [isBatchRunning, setIsBatchRunning] = useState(false);
  const [polishingTaskId, setPolishingTaskId] = useState<string | null>(null);
  const [channelTestStatus, setChannelTestStatus] = useState<{
    loading: boolean;
    message?: string;
    ok?: boolean;
  }>({ loading: false });
  const [imageTestStatus, setImageTestStatus] = useState<{
    loading: boolean;
    message?: string;
    ok?: boolean;
    previewUrl?: string;
  }>({ loading: false });
  const [codexCliStatus, setCodexCliStatus] = useState<{
    loading: boolean;
    checked?: boolean;
    cliInstalled?: boolean;
    cliVersion?: string;
    configPath?: string;
    configBaseUrl?: string;
    configModel?: string;
    hasAuthKey?: boolean;
    hasBuiltInKey?: boolean;
    builtInAgentModels?: string[];
    builtInImageModels?: string[];
    message?: string;
  }>({ loading: false });

  const [lightboxImage, setLightboxImage] = useState<{
    url: string;
    title: string;
    subtitle: string;
  } | null>(null);
  const [stitchedLongImageUrl, setStitchedLongImageUrl] = useState<
    string | null
  >(null);
  const [isStitching, setIsStitching] = useState(false);
  const [isExportingZip, setIsExportingZip] = useState(false);
  const [toastMessage, setToastMessage] = useState<{
    type: 'info' | 'success' | 'error';
    text: string;
  } | null>(null);

  const abortBatchRef = useRef(false);
  const abortSkuBatchRef = useRef(false);
  const activeDetailBatchIdRef = useRef<{ id: string; title: string } | null>(
    null
  );
  const activeSkuBatchIdRef = useRef<{ id: string; title: string } | null>(
    null
  );
  const dirtySkuCasePromptTaskIdsRef = useRef<Set<string>>(new Set());
  const prodFileInputRef = useRef<HTMLInputElement>(null);
  const caseFileInputRef = useRef<HTMLInputElement>(null);
  const masterTemplateFileInputRef = useRef<HTMLInputElement>(null);

  // Keep live refs to tasks, skuTasks, reference pools, and ossConfig so concurrent batch workers & delayed auto-upload timers always read the freshest state
  const tasksRef = useRef<ScreenTask[]>(tasks);
  tasksRef.current = tasks;
  const skuTasksRef = useRef<SkuTask[]>(skuTasks);
  skuTasksRef.current = skuTasks;
  const referenceImagesRef = useRef<ReferenceImageItem[]>(referenceImages);
  referenceImagesRef.current = referenceImages;
  const skuReferenceImagesRef = useRef<ReferenceImageItem[]>(skuReferenceImages);
  skuReferenceImagesRef.current = skuReferenceImages;
  const ossConfigRef = useRef<AliyunOssConfig | undefined>(config.ossConfig);
  ossConfigRef.current = config.ossConfig;

  /**
   * Detects whether an existing SKU visualPrompt conflicts with the current multi-#Case dimension split
   * (for example, if #Case-2 has 'style' unchecked, yet the old prompt still says "复刻 #Case-2 的暖棕色调" or omits #Case-1).
   */
  const isSkuPromptConflictingWithCaseDims = (
    promptText: string,
    boundCases: ReferenceImageItem[]
  ): boolean => {
    const trimmed = (promptText || '').trim();
    if (!trimmed || boundCases.length === 0) return false;

    const styleCases = boundCases.filter((c) =>
      (c.caseDimensions || ['style', 'structure']).includes('style')
    );
    const nonStyleCases = boundCases.filter(
      (c) => !(c.caseDimensions || ['style', 'structure']).includes('style')
    );

    // Case A: Multiple #Case images are bound with split style vs structure roles,
    // and the existing prompt mentions the structure-only #Case (e.g. #Case-2) without mentioning the style #Case (#Case-1)
    if (styleCases.length > 0 && nonStyleCases.length > 0) {
      const mentionsNonStyleCode = nonStyleCases.some(
        (c) => c.code && new RegExp(`#?${c.code}\\b`, 'i').test(trimmed)
      );
      const mentionsStyleCode = styleCases.some(
        (c) => c.code && new RegExp(`#?${c.code}\\b`, 'i').test(trimmed)
      );
      if (mentionsNonStyleCode && !mentionsStyleCode) {
        return true;
      }
    }

    // Case B: A #Case without 'style' is bound, and the prompt explicitly attributes color/background/warm-brown tone to it
    for (const nsCase of nonStyleCases) {
      if (!nsCase.code) continue;
      const codePattern = new RegExp(
        `#?${nsCase.code}[^。；\\n]{0,28}(?:色调|暖棕|米色|背景|光影|质感|鹅卵石|木纹)`,
        'i'
      );
      if (codePattern.test(trimmed)) {
        return true;
      }
    }

    return false;
  };

  // Asset Library States (Common Assets + Generation Records)
  const [commonAssets, setCommonAssets] = useState<SavedCommonAsset[]>([]);
  const [generationRecords, setGenerationRecords] = useState<
    GenerationRecordItem[]
  >([]);

  // Runtime Logs State (Top Header Log Popover)
  const [runtimeLogs, setRuntimeLogs] = useState<RuntimeLogEntry[]>([]);

  const startRuntimeLog = (params: {
    workspace: RuntimeLogWorkspace;
    title: string;
    model?: string;
    summary?: string;
  }): { id: string; startedAtMs: number } => {
    const now = new Date();
    const id = `rtlog-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const startedAtMs = Date.now();
    const timestamp = now.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    const newEntry: RuntimeLogEntry = {
      id,
      timestamp,
      startedAtMs,
      workspace: params.workspace,
      title: params.title,
      model: params.model,
      status: 'running',
      summary: params.summary,
    };
    setRuntimeLogs((prev) => [newEntry, ...prev].slice(0, 60));
    return { id, startedAtMs };
  };

  const finishRuntimeLogSuccess = (
    handle: { id: string; startedAtMs: number },
    summary?: string,
    overrideDurationMs?: number
  ) => {
    const durationMs =
      typeof overrideDurationMs === 'number'
        ? overrideDurationMs
        : Math.max(0, Date.now() - handle.startedAtMs);
    setRuntimeLogs((prev) =>
      prev.map((item) =>
        item.id === handle.id
          ? {
              ...item,
              status: 'success',
              durationMs,
              summary: summary ?? item.summary,
              unreadError: false,
            }
          : item
      )
    );
  };

  const finishRuntimeLogError = (
    handle: { id: string; startedAtMs: number },
    errorDetail: string,
    summary?: string
  ) => {
    const durationMs = Math.max(0, Date.now() - handle.startedAtMs);
    setRuntimeLogs((prev) =>
      prev.map((item) =>
        item.id === handle.id
          ? {
              ...item,
              status: 'error',
              durationMs,
              summary: summary || '任务执行中断或接口返回异常',
              errorDetail,
              unreadError: true,
            }
          : item
      )
    );
  };

  const clearRuntimeLogs = () => {
    setRuntimeLogs([]);
  };

  const markRuntimeLogsRead = () => {
    setRuntimeLogs((prev) =>
      prev.some((l) => l.unreadError)
        ? prev.map((l) => (l.unreadError ? { ...l, unreadError: false } : l))
        : prev
    );
  };

  const showToast = (
    text: string,
    type: 'info' | 'success' | 'error' = 'info'
  ) => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage((prev) => (prev?.text === text ? null : prev));
    }, 4500);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Remove legacy unconfirmed mock state cache from previous versions
        localStorage.removeItem('ecom_studio_batch_v2_state');

        // 1. Load confirmed Master Templates from IndexedDB (unlimited Base64 capacity)
        //    and migrate any legacy localStorage templates into IndexedDB automatically.
        let idbTemplates = await loadConfirmedTemplatesFromDb();
        const rawLegacyTemplates = localStorage.getItem(
          'ecom_studio_confirmed_templates_v1'
        );
        if (rawLegacyTemplates) {
          try {
            const parsedLegacy: ConfirmedMasterTemplate[] =
              JSON.parse(rawLegacyTemplates);
            if (Array.isArray(parsedLegacy) && parsedLegacy.length > 0) {
              const existingIds = new Set(idbTemplates.map((t) => t.id));
              for (const legacyTpl of parsedLegacy) {
                if (!existingIds.has(legacyTpl.id)) {
                  await saveConfirmedTemplateToDb(legacyTpl);
                  idbTemplates.push(legacyTpl);
                }
              }
            }
          } catch {
            // Ignore malformed legacy storage
          }
        }
        if (!cancelled && idbTemplates.length > 0) {
          setConfirmedTemplates(idbTemplates);
        }

        // 1b. Load Common Assets & Generation Records from Asset Library IndexedDB
        const [loadedAssets, loadedRecords] = await Promise.all([
          loadCommonAssetsFromDb(),
          loadGenerationRecordsFromDb(),
        ]);
        if (!cancelled) {
          setCommonAssets(loadedAssets);
          setGenerationRecords(loadedRecords);
        }

        // 2. Load active workspace snapshot from IndexedDB first (falls back to localStorage)
        const idbWorkspace = await loadWorkspaceSnapshotFromDb();
        let parsed: Record<string, unknown> | null = idbWorkspace as unknown as Record<string, unknown> | null;
        if (!parsed) {
          const rawSaved = localStorage.getItem(
            'ecom_studio_batch_v3_clean_state'
          );
          if (rawSaved) {
            parsed = JSON.parse(rawSaved);
          }
        }

        if (!cancelled && parsed) {
          if (typeof parsed.selectedPresetId === 'string') {
            setSelectedPresetId(parsed.selectedPresetId);
          }
          if (typeof parsed.productInfoText === 'string') {
            setProductInfoText(parsed.productInfoText);
          }
          if (typeof parsed.fullPlanDoc === 'string') {
            setFullPlanDoc(parsed.fullPlanDoc);
          }
          if (typeof parsed.campaignSummary === 'string') {
            setCampaignSummary(parsed.campaignSummary);
          }
          // Load dedicated Reset-Proof Global Defaults from localStorage (survives workspace resets)
          let savedGlobalDefaults: Partial<StudioConfig> = {};
          try {
            const rawGlobalDefaults = localStorage.getItem(
              'ecom_studio_global_defaults_v1'
            );
            if (rawGlobalDefaults) {
              savedGlobalDefaults = JSON.parse(rawGlobalDefaults);
            }
          } catch {
            // Ignore malformed JSON
          }

          const loadedSkuCfg =
            parsed.skuBatchConfig && typeof parsed.skuBatchConfig === 'object'
              ? (parsed.skuBatchConfig as Partial<SkuBatchConfig>)
              : {};
          const cfgFromSnapshot =
            parsed.config && typeof parsed.config === 'object'
              ? (parsed.config as Partial<StudioConfig>)
              : {};

          const resolvedSpPresets =
            Array.isArray(savedGlobalDefaults.defaultSellingPointPresets) &&
            savedGlobalDefaults.defaultSellingPointPresets.length > 0
              ? savedGlobalDefaults.defaultSellingPointPresets
              : Array.isArray(cfgFromSnapshot.defaultSellingPointPresets) &&
                  cfgFromSnapshot.defaultSellingPointPresets.length > 0
                ? cfgFromSnapshot.defaultSellingPointPresets
                : Array.isArray(loadedSkuCfg.sellingPointPresets) &&
                    loadedSkuCfg.sellingPointPresets.length > 0
                  ? loadedSkuCfg.sellingPointPresets
                  : DEFAULT_SKU_SELLING_POINT_PRESETS;

          const resolvedSkuFallback: SkuDefaultFallbackConfig = {
            ...DEFAULT_SKU_FALLBACK_CONFIG,
            ...(cfgFromSnapshot.skuDefaultFallback || {}),
            ...(savedGlobalDefaults.skuDefaultFallback || {}),
          };

          const resolvedQualityGuard: QualityGuardGlobalConfig = {
            ...DEFAULT_QUALITY_GUARD_CONFIG,
            ...(cfgFromSnapshot.qualityGuardConfig || {}),
            ...(savedGlobalDefaults.qualityGuardConfig || {}),
          };

          if (parsed.config && typeof parsed.config === 'object') {
            const cfg = parsed.config as Partial<StudioConfig>;
            const sanitizedImageModel =
              cfg.imageModel &&
              cfg.imageModel.includes('2.5-flash-image')
                ? 'gemini-nano-banana-2.1'
                : cfg.imageModel;
            const rawSanitizedChannels = Array.isArray(cfg.channels)
              ? cfg.channels.map((ch) =>
                  /api\.openai-proxy\.org/i.test(ch.baseUrl || '')
                    ? {
                        ...ch,
                        baseUrl:
                          'https://generativelanguage.googleapis.com/v1beta/openai',
                      }
                    : ch
                )
              : undefined;
            const builtInCodexChannel = INITIAL_CONFIG.channels.find(
              (c) => c.id === 'local-codex-cli'
            );
            const sanitizedChannels =
              rawSanitizedChannels && builtInCodexChannel
                ? rawSanitizedChannels.some(
                    (c) =>
                      c.id === 'local-codex-cli' ||
                      c.mode === 'codex_cli' ||
                      c.protocol === 'codex-cli'
                  )
                  ? rawSanitizedChannels
                  : [...rawSanitizedChannels, builtInCodexChannel]
                : rawSanitizedChannels;

            setConfig((prev) => ({
              ...prev,
              ...cfg,
              imageModel: sanitizedImageModel || prev.imageModel,
              channels: sanitizedChannels || prev.channels,
              agentModelPresets:
                Array.isArray(cfg.agentModelPresets) &&
                cfg.agentModelPresets.length > 0
                  ? cfg.agentModelPresets.some(
                      (m) => m.id === 'codex-mini-latest'
                    )
                    ? cfg.agentModelPresets
                    : [
                        ...cfg.agentModelPresets,
                        ...DEFAULT_AGENT_MODEL_PRESETS.filter(
                          (m) => m.id === 'codex-mini-latest'
                        ),
                      ]
                  : prev.agentModelPresets,
              imageModelPresets:
                Array.isArray(cfg.imageModelPresets) &&
                cfg.imageModelPresets.length > 0
                  ? cfg.imageModelPresets.filter(
                      (m) => !m.id.includes('2.5-flash-image')
                    )
                  : prev.imageModelPresets,
              defaultSellingPointPresets: resolvedSpPresets,
              skuDefaultFallback: resolvedSkuFallback,
              qualityGuardConfig: resolvedQualityGuard,
              confirmBeforeReset:
                typeof savedGlobalDefaults.confirmBeforeReset === 'boolean'
                  ? savedGlobalDefaults.confirmBeforeReset
                  : typeof cfg.confirmBeforeReset === 'boolean'
                    ? cfg.confirmBeforeReset
                    : true,
              preserveCopyOnReset:
                typeof savedGlobalDefaults.preserveCopyOnReset === 'boolean'
                  ? savedGlobalDefaults.preserveCopyOnReset
                  : typeof cfg.preserveCopyOnReset === 'boolean'
                    ? cfg.preserveCopyOnReset
                    : false,
              requirements: {
                ...prev.requirements,
                ...(cfg.requirements || {}),
                taskScope: 'detail_only',
              },
              ossConfig: mergeOssConfigPreservingCredentials(
                prev.ossConfig,
                savedGlobalDefaults.ossConfig,
                cfg.ossConfig
              ),
            }));
          } else {
            setConfig((prev) => ({
              ...prev,
              defaultSellingPointPresets: resolvedSpPresets,
              skuDefaultFallback: resolvedSkuFallback,
              qualityGuardConfig: resolvedQualityGuard,
            }));
          }
          setCardLayout('storyboard');
          if (typeof parsed.lockCompletedStaticScreens === 'boolean') {
            setLockCompletedStaticScreens(parsed.lockCompletedStaticScreens);
          }
          if (Array.isArray(parsed.referenceImages)) {
            setReferenceImages(
              (parsed.referenceImages as ReferenceImageItem[]).map((r) => ({
                ...r,
                ossUploading: false,
              }))
            );
          }
          if (Array.isArray(parsed.skuReferenceImages)) {
            setSkuReferenceImages(
              reindexReferenceCodes(
                (parsed.skuReferenceImages as ReferenceImageItem[]).map((r) => ({
                  ...r,
                  ossUploading: false,
                }))
              )
            );
          } else if (Array.isArray(parsed.referenceImages)) {
            // Backward-compatible migration: extract only SKU-bound items into skuReferenceImages
            // so Detail Studio uploads are no longer mixed into SKU Studio
            const legacyCfg = (parsed.skuBatchConfig ||
              {}) as Partial<SkuBatchConfig>;
            const legacySkuTasks = Array.isArray(parsed.skuTasks)
              ? (parsed.skuTasks as SkuTask[])
              : [];
            const skuReferencedIds = new Set<string>([
              ...(Array.isArray(legacyCfg.selectedProdIds)
                ? legacyCfg.selectedProdIds
                : []),
              ...(Array.isArray(legacyCfg.globalCaseRefIds)
                ? legacyCfg.globalCaseRefIds
                : []),
              ...legacySkuTasks.flatMap((st) => [
                ...(Array.isArray(st.productRefIds) ? st.productRefIds : []),
                ...(Array.isArray(st.caseRefIds) ? st.caseRefIds : []),
              ]),
            ]);
            const migratedSkuRefs = reindexReferenceCodes(
              (parsed.referenceImages as ReferenceImageItem[])
                .filter((r) => skuReferencedIds.has(r.id))
                .map((r) => ({ ...r, ossUploading: false }))
            );
            setSkuReferenceImages(migratedSkuRefs);
          }
          if (Array.isArray(parsed.tasks)) {
            const loadedDetailRatio: AspectRatioOption =
              ((parsed.config as any)?.requirements
                ?.detailAspectRatio as AspectRatioOption) || '9:16';
            const loadedEnableStatic =
              (parsed.config as any)?.requirements?.enableStaticLayering !==
              false;
            const loadedTextMode: TextRenderMode =
              ((parsed.config as any)?.requirements
                ?.textMode as TextRenderMode) || 'with_text';
            const loadedDefaultSize: ImageSizeOption =
              ((parsed.config as any)?.defaultImageSize as ImageSizeOption) ||
              '1K';
            const loadedRefs: ReferenceImageItem[] = Array.isArray(
              parsed.referenceImages
            )
              ? (parsed.referenceImages as ReferenceImageItem[])
              : [];
            const loadedProds = loadedRefs.filter((r) => r.category !== 'case');
            const loadedCases = loadedRefs.filter((r) => r.category === 'case');
            const loadedProductInfo =
              typeof parsed.productInfoText === 'string'
                ? parsed.productInfoText
                : '';
            const loadedPlanDoc =
              typeof parsed.fullPlanDoc === 'string' ? parsed.fullPlanDoc : '';

            setTasks(
              (parsed.tasks as ScreenTask[]).map((t: ScreenTask, idx: number) => {
                const screenNum =
                  typeof t.screenNumber === 'number' ? t.screenNumber : idx + 1;
                const matchedCase =
                  loadedCases.length > 0
                    ? loadedCases[Math.min(idx, loadedCases.length - 1)]
                    : undefined;

                // Auto-repair tasks that were polluted by dummy placeholders ("Brand Header", "[核心亮点1]")
                // or layout skeleton tags ("拱门双展台首焦KV+居中大字") leaked into headlines
                if (isTaskPollutedByPlaceholdersOrSkeleton(t, matchedCase)) {
                  const synthesized = synthesizeScreenFromCaseAndPlan({
                    screenNum,
                    matchedCase,
                    prodRefs: loadedProds,
                    productInfoText: loadedProductInfo,
                    fullPlanDoc: loadedPlanDoc,
                    enableStaticLayering: loadedEnableStatic,
                    aspectRatio:
                      t.aspectRatio && t.aspectRatio !== '1:1'
                        ? t.aspectRatio
                        : loadedDetailRatio,
                    imageSize: t.imageSize || loadedDefaultSize,
                    textMode: t.textMode || loadedTextMode,
                    existingTaskId: t.id,
                  });
                  return {
                    ...synthesized,
                    resultImageUrl: t.resultImageUrl,
                    resultOssUrl: t.resultOssUrl,
                    resultCloudUrls: t.resultCloudUrls,
                    resultTextNote: t.resultTextNote,
                    durationMs: t.durationMs,
                    generatedAt: t.generatedAt,
                    status: t.status === 'generating' ? 'idle' : t.status,
                    historyImages: Array.isArray(t.historyImages)
                      ? t.historyImages
                      : [],
                  };
                }

                const hadLegacyMainResidue =
                  t.screenCategory === 'main' ||
                  /主图\s*\d+/.test(t.title || '');
                const cleanedTitle = (t.title || '')
                  .replace(
                    /^(第\s*\d+\s*屏\s*[·•-]\s*)?主图\s*\d+\s*[·•-]?\s*/i,
                    `第${screenNum}屏·`
                  )
                  .trim();
                return {
                  ...t,
                  screenNumber: screenNum,
                  screenCategory: 'detail',
                  title: cleanedTitle || t.title,
                  aspectRatio:
                    hadLegacyMainResidue && t.aspectRatio === '1:1'
                      ? loadedDetailRatio
                      : t.aspectRatio || loadedDetailRatio,
                  referenceImageIds: Array.isArray(t.referenceImageIds)
                    ? t.referenceImageIds
                    : [],
                  status: t.status === 'generating' ? 'idle' : t.status,
                  historyImages: Array.isArray(t.historyImages)
                    ? t.historyImages
                    : [],
                };
              })
            );
          }
          if (
            parsed.skuBatchConfig &&
            typeof parsed.skuBatchConfig === 'object'
          ) {
            const loadedCfg = parsed.skuBatchConfig as Partial<SkuBatchConfig>;
            const cleanedRule =
              loadedCfg.unifiedLayoutRule &&
              LEGACY_CONFLICTING_LAYOUT_RULES.has(
                loadedCfg.unifiedLayoutRule.trim()
              )
                ? ''
                : loadedCfg.unifiedLayoutRule ?? '';
            setSkuBatchConfig((prev) => ({
              ...prev,
              ...loadedCfg,
              unifiedLayoutRule: cleanedRule,
              sellingPointPresets: resolvedSpPresets,
            }));
          } else {
            setSkuBatchConfig((prev) => ({
              ...prev,
              skuDiffMode: resolvedSkuFallback.skuDiffMode,
              titlePrefix: resolvedSkuFallback.titlePrefix,
              subtitleText: resolvedSkuFallback.subtitleText,
              swapTitleOrder: resolvedSkuFallback.swapTitleOrder,
              titleIndexMode: resolvedSkuFallback.titleIndexMode,
              defaultAspectRatio: resolvedSkuFallback.defaultAspectRatio,
              defaultImageSize: resolvedSkuFallback.defaultImageSize,
              textMode: resolvedSkuFallback.textMode,
              sellingPointPresets: resolvedSpPresets,
            }));
          }
          if (Array.isArray(parsed.skuTasks)) {
            setSkuTasks(
              (parsed.skuTasks as SkuTask[]).map((st: SkuTask) => ({
                ...st,
                productRefIds: Array.isArray(st.productRefIds)
                  ? st.productRefIds
                  : [],
                caseRefIds: Array.isArray(st.caseRefIds) ? st.caseRefIds : [],
                status: st.status === 'generating' ? 'idle' : st.status,
                historyImages: Array.isArray(st.historyImages)
                  ? st.historyImages
                  : [],
              }))
            );
          }
        }
          if (!parsed) {
            // Even when workspace snapshot was cleared via Reset, load Reset-Proof Global Defaults
            try {
              const rawGlobalDefaults = localStorage.getItem(
                'ecom_studio_global_defaults_v1'
              );
              if (rawGlobalDefaults) {
                const savedGlobalDefaults = JSON.parse(
                  rawGlobalDefaults
                ) as Partial<StudioConfig>;
                const sp =
                  Array.isArray(
                    savedGlobalDefaults.defaultSellingPointPresets
                  ) &&
                  savedGlobalDefaults.defaultSellingPointPresets.length > 0
                    ? savedGlobalDefaults.defaultSellingPointPresets
                    : DEFAULT_SKU_SELLING_POINT_PRESETS;
                const fb: SkuDefaultFallbackConfig = {
                  ...DEFAULT_SKU_FALLBACK_CONFIG,
                  ...(savedGlobalDefaults.skuDefaultFallback || {}),
                };
                const qg: QualityGuardGlobalConfig = {
                  ...DEFAULT_QUALITY_GUARD_CONFIG,
                  ...(savedGlobalDefaults.qualityGuardConfig || {}),
                };
                setConfig((prev) => {
                  const baseChannels = Array.isArray(savedGlobalDefaults.channels)
                    ? savedGlobalDefaults.channels
                    : prev.channels;
                  const builtInCodex = INITIAL_CONFIG.channels.find(
                    (c) => c.id === 'local-codex-cli'
                  );
                  const mergedChannels =
                    builtInCodex &&
                    !baseChannels.some(
                      (c) =>
                        c.id === 'local-codex-cli' ||
                        c.mode === 'codex_cli' ||
                        c.protocol === 'codex-cli'
                    )
                      ? [...baseChannels, builtInCodex]
                      : baseChannels;
                  return {
                    ...prev,
                    ...savedGlobalDefaults,
                    channels: mergedChannels,
                    defaultSellingPointPresets: sp,
                    skuDefaultFallback: fb,
                    qualityGuardConfig: qg,
                    ossConfig: mergeOssConfigPreservingCredentials(
                      prev.ossConfig,
                      savedGlobalDefaults.ossConfig
                    ),
                  };
                });
                setSkuBatchConfig((prev) => ({
                  ...prev,
                  skuDiffMode: fb.skuDiffMode,
                  titlePrefix: fb.titlePrefix,
                  subtitleText: fb.subtitleText,
                  swapTitleOrder: fb.swapTitleOrder,
                  titleIndexMode: fb.titleIndexMode,
                  defaultAspectRatio: fb.defaultAspectRatio,
                  defaultImageSize: fb.defaultImageSize,
                  textMode: fb.textMode,
                  replicaFidelity: fb.replicaFidelity || 'style_reference',
                  styleLinkageMode: fb.styleLinkageMode || 'print_4d',
                  replicaLanguage: fb.replicaLanguage || 'zh',
                  sellingPointPresets: sp,
                }));
              }
            } catch {
              // Ignore
            }
          }
        } catch {
          // Ignore storage read errors
        } finally {
          if (!cancelled) {
            setHasLoadedStorage(true);
          }
        }
      })();
      return () => {
        cancelled = true;
      };
    }, []);

    // Persist Reset-Proof Global Defaults separately so workspace resets never wipe user presets or channels
    useEffect(() => {
      if (!hasLoadedStorage) return;
      try {
        localStorage.setItem(
          'ecom_studio_global_defaults_v1',
          JSON.stringify({
            activeChannelId: config.activeChannelId,
            channels: config.channels,
            agentModel: config.agentModel,
            enableHighThinking: config.enableHighThinking,
            imageModel: config.imageModel,
            agentModelPresets: config.agentModelPresets,
            imageModelPresets: config.imageModelPresets,
            defaultSellingPointPresets: config.defaultSellingPointPresets,
            skuDefaultFallback: config.skuDefaultFallback,
            qualityGuardConfig: config.qualityGuardConfig,
            confirmBeforeReset: config.confirmBeforeReset,
            preserveCopyOnReset: config.preserveCopyOnReset,
            defaultAspectRatio: config.defaultAspectRatio,
            defaultImageSize: config.defaultImageSize,
            requirements: config.requirements,
            ossConfig: config.ossConfig,
          })
        );
      } catch {
        // Ignore
      }
    }, [hasLoadedStorage, config]);

  // Probe server environment OSS / Cloudflare R2 status on mount so if secrets are configured in env, we auto-enable cloud storage
  useEffect(() => {
    studioBridge
      .getOssStatus({})
      .then((status) => {
        const ossEnv = Boolean(status.ossEnvConfigured ?? status.envConfigured);
        const r2Env = Boolean(status.r2EnvConfigured);
        if (ossEnv || r2Env) {
          setEnvOssDetected({
            envConfigured: ossEnv || r2Env,
            ossEnvConfigured: ossEnv,
            r2EnvConfigured: r2Env,
            region: status.region,
            bucket: status.bucket,
            r2AccountId: status.r2AccountId,
            r2Bucket: status.r2Bucket,
          });
          setConfig((prev) => {
            const hasClientOssKeys = Boolean(
              prev.ossConfig?.accessKeyId?.trim() &&
                prev.ossConfig?.accessKeySecret?.trim()
            );
            const hasClientR2Keys = Boolean(
              prev.ossConfig?.r2AccessKeyId?.trim() &&
                prev.ossConfig?.r2SecretAccessKey?.trim()
            );
            const nextProvider: CloudStorageProvider =
              prev.ossConfig?.provider ||
              (!ossEnv && r2Env ? 'cloudflare_r2' : 'aliyun_oss');
            return {
              ...prev,
              ossConfig: {
                ...(prev.ossConfig || INITIAL_CONFIG.ossConfig!),
                enabled: true,
                provider: nextProvider,
                region: hasClientOssKeys
                  ? prev.ossConfig?.region || status.region || 'oss-cn-hangzhou'
                  : status.region || prev.ossConfig?.region || 'oss-cn-hangzhou',
                bucket: hasClientOssKeys
                  ? prev.ossConfig?.bucket || status.bucket || ''
                  : status.bucket || prev.ossConfig?.bucket || '',
                pathPrefix: hasClientOssKeys
                  ? prev.ossConfig?.pathPrefix || status.pathPrefix || 'ecom-studio-assets'
                  : status.pathPrefix || prev.ossConfig?.pathPrefix || 'ecom-studio-assets',
                r2AccountId: hasClientR2Keys
                  ? prev.ossConfig?.r2AccountId || status.r2AccountId || ''
                  : status.r2AccountId || prev.ossConfig?.r2AccountId || '',
                r2Bucket: hasClientR2Keys
                  ? prev.ossConfig?.r2Bucket || status.r2Bucket || ''
                  : status.r2Bucket || prev.ossConfig?.r2Bucket || '',
                r2PathPrefix: hasClientR2Keys
                  ? prev.ossConfig?.r2PathPrefix || status.r2PathPrefix || 'ecom-studio-assets'
                  : status.r2PathPrefix || prev.ossConfig?.r2PathPrefix || 'ecom-studio-assets',
              },
            };
          });
        }
      })
      .catch(() => {});
  }, []);

  // Auto-persist workspace (including full referenceImages, per-screen referenceImageIds, prompts, and result images) to IndexedDB + lightweight metadata to localStorage
  // Uses a 350ms debounce + beforeunload flush so rapid typing in prompt/title fields never blocks the UI thread with heavy serialization.
  useEffect(() => {
    if (!hasLoadedStorage) return;

    const persistNow = () => {
      const normalizedTasks = tasks.map((t) => ({
        ...t,
        referenceImageIds: Array.isArray(t.referenceImageIds)
          ? t.referenceImageIds
          : [],
        status:
          t.status === 'generating'
            ? 'idle'
            : t.resultImageUrl
              ? t.status
              : 'idle',
        historyImages: Array.isArray(t.historyImages)
          ? t.historyImages.slice(0, 4)
          : [],
      }));
      const normalizedSkuTasks = skuTasks.map((st) => ({
        ...st,
        caseRefIds: Array.isArray(st.caseRefIds) ? st.caseRefIds : [],
        status:
          st.status === 'generating'
            ? 'idle'
            : st.resultImageUrl
              ? st.status
              : 'idle',
        historyImages: Array.isArray(st.historyImages)
          ? st.historyImages.slice(0, 4)
          : [],
      }));
      const fullSnapshot = {
        selectedPresetId,
        productInfoText,
        fullPlanDoc,
        campaignSummary,
        config,
        cardLayout,
        lockCompletedStaticScreens,
        referenceImages: referenceImages.map((r) => ({
          ...r,
          ossUploading: false,
        })),
        skuReferenceImages: skuReferenceImages.map((r) => ({
          ...r,
          ossUploading: false,
        })),
        tasks: normalizedTasks,
        skuBatchConfig,
        skuTasks: normalizedSkuTasks,
      };

      // Save 100% intact snapshot (including all Base64 reference images & generated images) to IndexedDB
      saveWorkspaceSnapshotToDb(fullSnapshot);

      // Also keep a lightweight metadata backup in localStorage (strip large Base64 result & history images)
      try {
        const ultraLightTasks = normalizedTasks.map((t) => ({
          ...t,
          resultImageUrl: undefined,
          historyImages: [],
        }));
        const ultraLightSkuTasks = normalizedSkuTasks.map((st) => ({
          ...st,
          resultImageUrl: undefined,
          historyImages: [],
        }));
        localStorage.setItem(
          'ecom_studio_batch_v3_clean_state',
          JSON.stringify({
            ...fullSnapshot,
            referenceImages: [],
            skuReferenceImages: [],
            tasks: ultraLightTasks,
            skuTasks: ultraLightSkuTasks,
          })
        );
      } catch {
        // Ignore localStorage quota errors (IndexedDB holds the full data)
      }
    };

    const debounceMs = isBatchRunning || isSkuBatchRunning ? 1800 : 600;
    const timer = window.setTimeout(persistNow, debounceMs);
    const handleBeforeUnload = () => {
      window.clearTimeout(timer);
      persistNow();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [
    hasLoadedStorage,
    isBatchRunning,
    isSkuBatchRunning,
    selectedPresetId,
    productInfoText,
    fullPlanDoc,
    campaignSummary,
    config,
    cardLayout,
    lockCompletedStaticScreens,
    referenceImages,
    skuReferenceImages,
    tasks,
    skuBatchConfig,
    skuTasks,
  ]);

  // Global Escape key listener to dismiss the topmost active modal
  useEffect(() => {
    const handleGlobalEsc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (lightboxImage) {
        setLightboxImage(null);
        return;
      }
      if (caseScreenConfirmModal.isOpen) {
        setCaseScreenConfirmModal((prev) => ({ ...prev, isOpen: false }));
        return;
      }
      if (detailAssetPickerModal.open) {
        setDetailAssetPickerModal((prev) => ({
          ...prev,
          open: false,
          selectedIds: [],
        }));
        return;
      }
      if (confirmClearTasks) {
        setConfirmClearTasks(false);
        return;
      }
      if (showAdaptSkuModal && !isAdaptingSku) {
        setShowAdaptSkuModal(false);
        return;
      }
      if (showSaveMasterModal) {
        setShowSaveMasterModal(false);
        return;
      }
      if (showApiModal) {
        setShowApiModal(false);
      }
    };
    window.addEventListener('keydown', handleGlobalEsc);
    return () => window.removeEventListener('keydown', handleGlobalEsc);
  }, [
    lightboxImage,
    caseScreenConfirmModal.isOpen,
    detailAssetPickerModal.open,
    confirmClearTasks,
    showAdaptSkuModal,
    isAdaptingSku,
    showSaveMasterModal,
    showApiModal,
  ]);

  // Close reference picker floating popover on outside click or Escape key
  useEffect(() => {
    if (!expandedRefPickerTaskId) return;
    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && target.closest('[data-ref-picker-root]')) {
        return;
      }
      setExpandedRefPickerTaskId(null);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setExpandedRefPickerTaskId(null);
      }
    };
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [expandedRefPickerTaskId]);

  const activeChannel =
    config.channels.find((c) => c.id === config.activeChannelId) ||
    config.channels[0];

  const getActiveChannelBridgeParams = () => ({
    customBaseUrl:
      activeChannel.mode === 'custom_gateway'
        ? activeChannel.baseUrl
        : activeChannel.mode === 'codex_cli'
          ? activeChannel.baseUrl || 'codex://local'
          : '',
    customApiKey:
      activeChannel.mode === 'custom_gateway' ||
      activeChannel.mode === 'codex_cli'
        ? activeChannel.apiKey
        : undefined,
    customHeaders:
      activeChannel.mode === 'custom_gateway' ||
      activeChannel.mode === 'codex_cli'
        ? activeChannel.customHeaders
        : undefined,
    protocol:
      activeChannel.mode === 'codex_cli'
        ? ('codex-cli' as ApiProtocolMode)
        : activeChannel.protocol || 'auto',
  });

  // Global clipboard paste (Ctrl+V) adds to the active studio's asset pool without re-binding on every render
  const pasteHandlerRef = useRef<(e: ClipboardEvent) => void>(() => {});
  pasteHandlerRef.current = (e: ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const imageFiles: File[] = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const f = items[i].getAsFile();
        if (f) imageFiles.push(f);
      }
    }
    if (imageFiles.length > 0) {
      const dt = new DataTransfer();
      imageFiles.forEach((f) => dt.items.add(f));
      if (activeTopTab === 'sku_studio') {
        handleUploadFiles(dt.files, 'product', undefined, 'sku_studio');
      } else if (activeTopTab === 'detail_studio') {
        handleUploadFiles(dt.files, activeAssetTab, undefined, 'detail_studio');
      }
    }
  };
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => pasteHandlerRef.current(e);
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, []);

  // Clear workspace to blank production project while 100% preserving Reset-Proof Selling Point Presets & Fallback Defaults
  const handleClearWorkspaceToBlank = (options?: {
    preserveCopy?: boolean;
  }) => {
    const preserveCopy = Boolean(options?.preserveCopy);
    const protectedPresets =
      config.defaultSellingPointPresets &&
      config.defaultSellingPointPresets.length > 0
        ? config.defaultSellingPointPresets
        : skuBatchConfig.sellingPointPresets &&
            skuBatchConfig.sellingPointPresets.length > 0
          ? skuBatchConfig.sellingPointPresets
          : DEFAULT_SKU_SELLING_POINT_PRESETS;
    const fb: SkuDefaultFallbackConfig = {
      ...DEFAULT_SKU_FALLBACK_CONFIG,
      ...(config.skuDefaultFallback || {}),
    };

    setSelectedPresetId('blank-workspace');
    if (!preserveCopy) {
      setProductInfoText('');
      setFullPlanDoc('');
    }
    setReferenceImages([]);
    setSkuReferenceImages([]);
    setTasks([]);
    setSkuBatchConfig((prev) => ({
      ...INITIAL_SKU_BATCH_CONFIG,
      selectedProdIds: [],
      globalCaseRefIds: [],
      skuDiffMode: fb.skuDiffMode,
      titlePrefix: preserveCopy ? prev.titlePrefix : fb.titlePrefix,
      subtitleText: preserveCopy ? prev.subtitleText : fb.subtitleText,
      swapTitleOrder: preserveCopy ? prev.swapTitleOrder : fb.swapTitleOrder,
      titleIndexMode: preserveCopy ? prev.titleIndexMode : fb.titleIndexMode,
      customTitleLines: preserveCopy ? prev.customTitleLines : '',
      referenceInfoText: preserveCopy ? prev.referenceInfoText : '',
      unifiedLayoutRule: preserveCopy ? prev.unifiedLayoutRule : '',
      defaultAspectRatio: fb.defaultAspectRatio,
      defaultImageSize: fb.defaultImageSize,
      textMode:
        fb.replicaLanguage === 'none'
          ? 'without_text'
          : fb.textMode || 'with_text',
      replicaFidelity: fb.replicaFidelity || 'style_reference',
      styleLinkageMode: fb.styleLinkageMode || 'print_4d',
      consistentOutputStyle: (fb.styleLinkageMode || 'print_4d') !== 'lock_scene',
      replicaLanguage: fb.replicaLanguage || 'zh',
      sellingPointPresets: protectedPresets,
    }));
    setSkuTasks([]);
    setSkuBatchSummary('');
    setStitchedLongImageUrl(null);
    setCampaignSummary(
      '已重置工作台画布：您的「SKU 常用卖点方案库」与默认兜底设置已受保护并自动保留。'
    );
    clearWorkspaceSnapshotInDb();
    try {
      localStorage.removeItem('ecom_studio_batch_v2_state');
      localStorage.removeItem('ecom_studio_batch_v3_clean_state');
    } catch {
      // Ignore
    }
    showToast(
      preserveCopy
        ? '已清空参考图与生成卡片（已为您保留企划文案、标题公式与全部常用卖点方案）'
        : '已重置工作台画布（您的常用卖点方案库与默认兜底配置已自动保留）',
      'success'
    );
  };

  // Switch between Blank Workspace or User-Confirmed Master Templates
  const handleSelectPreset = (presetId: string) => {
    if (presetId === 'blank-workspace') {
      handleClearWorkspaceToBlank({
        preserveCopy: Boolean(config.preserveCopyOnReset),
      });
      return;
    }
    const foundCustom = confirmedTemplates.find((t) => t.id === presetId);
    if (!foundCustom) return;

    setSelectedPresetId(foundCustom.id);
    setProductInfoText(foundCustom.productInfoText);
    setFullPlanDoc(foundCustom.fullPlanDoc);
    setConfig((prev) => ({
      ...prev,
      defaultAspectRatio: foundCustom.requirements.detailAspectRatio,
      globalStylePrefix: foundCustom.globalStylePrefix,
      requirements: { ...foundCustom.requirements },
    }));
    setReferenceImages(
      (foundCustom.referenceImages || []).map((img) => ({
        ...img,
        ossUploading: false,
      }))
    );
    setSkuReferenceImages(
      (foundCustom.skuReferenceImages || []).map((img) => ({
        ...img,
        ossUploading: false,
      }))
    );
    const tplDetailRatio: AspectRatioOption =
      foundCustom.requirements?.detailAspectRatio || '9:16';
    setTasks(
      (foundCustom.tasks || []).map((t, idx) => {
        const screenNum =
          typeof t.screenNumber === 'number' ? t.screenNumber : idx + 1;
        const hadLegacyMainResidue =
          t.screenCategory === 'main' || /主图\s*\d+/.test(t.title || '');
        const cleanedTitle = (t.title || '')
          .replace(
            /^(第\s*\d+\s*屏\s*[·•-]\s*)?主图\s*\d+\s*[·•-]?\s*/i,
            `第${screenNum}屏·`
          )
          .trim();
        return {
          ...t,
          screenNumber: screenNum,
          screenCategory: 'detail',
          title: cleanedTitle || t.title,
          aspectRatio:
            hadLegacyMainResidue && t.aspectRatio === '1:1'
              ? tplDetailRatio
              : t.aspectRatio || tplDetailRatio,
          referenceImageIds: Array.isArray(t.referenceImageIds)
            ? t.referenceImageIds
            : [],
        };
      })
    );
    if (foundCustom.skuBatchConfig) {
      const globalSp =
        config.defaultSellingPointPresets &&
        config.defaultSellingPointPresets.length > 0
          ? config.defaultSellingPointPresets
          : DEFAULT_SKU_SELLING_POINT_PRESETS;
      const tplSp = Array.isArray(foundCustom.skuBatchConfig.sellingPointPresets)
        ? foundCustom.skuBatchConfig.sellingPointPresets
        : [];
      const mergedSpMap = new Map<string, SkuSellingPointPreset>();
      globalSp.forEach((p) => mergedSpMap.set(p.id, p));
      tplSp.forEach((p) => {
        if (!mergedSpMap.has(p.id)) {
          mergedSpMap.set(p.id, p);
        }
      });
      setSkuBatchConfig({
        ...foundCustom.skuBatchConfig,
        sellingPointPresets: Array.from(mergedSpMap.values()),
      });
    }
    if (Array.isArray(foundCustom.skuTasks)) {
      setSkuTasks(foundCustom.skuTasks);
    }
    const totalBoundRefs = (foundCustom.tasks || []).reduce(
      (sum, t) =>
        sum + (Array.isArray(t.referenceImageIds) ? t.referenceImageIds.length : 0),
      0
    );
    setCampaignSummary(
      `已载入正式确认母版「${foundCustom.name}」：共 ${
        (foundCustom.tasks || []).length
      } 屏详情任务、${(foundCustom.skuTasks || []).length} 款 SKU 任务、${
        (foundCustom.referenceImages || []).length
      } 张详情参考图、${totalBoundRefs} 处分屏参考图绑定关系已完整恢复。`
    );
    showToast(
      `已载入正式母版「${foundCustom.name}」（含详情分屏与 SKU 套图配置）`,
      'success'
    );
  };

  // Save current workspace as a User-Confirmed Master Template (persisted to IndexedDB with 100% intact images + bindings + prompts)
  const handleSaveCurrentAsMasterTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = newMasterNameInput.trim();
    if (!cleanName) {
      showToast('请输入正式母版名称', 'error');
      return;
    }
    const newId = `master-${Date.now()}`;
    const templateToSave: ConfirmedMasterTemplate = {
      id: newId,
      name: cleanName,
      createdAt: new Date().toLocaleDateString('zh-CN'),
      productInfoText,
      fullPlanDoc,
      globalStylePrefix: config.globalStylePrefix,
      requirements: { ...config.requirements },
      referenceImages: referenceImages.map((img) => ({
        ...img,
        ossUploading: false,
      })),
      skuReferenceImages: skuReferenceImages.map((img) => ({
        ...img,
        ossUploading: false,
      })),
      tasks: tasks.map((t) => ({
        ...t,
        referenceImageIds: Array.isArray(t.referenceImageIds)
          ? [...t.referenceImageIds]
          : [],
        status: t.resultImageUrl ? 'completed' : 'idle',
        historyImages: Array.isArray(t.historyImages)
          ? t.historyImages.slice(0, 6)
          : [],
      })),
      skuBatchConfig: { ...skuBatchConfig },
      skuTasks: skuTasks.map((st) => ({
        ...st,
        caseRefIds: Array.isArray(st.caseRefIds) ? [...st.caseRefIds] : [],
        status: st.resultImageUrl ? 'completed' : 'idle',
        historyImages: Array.isArray(st.historyImages)
          ? st.historyImages.slice(0, 6)
          : [],
      })),
    };
    const nextList = [templateToSave, ...confirmedTemplates];
    setConfirmedTemplates(nextList);
    setSelectedPresetId(newId);
    setShowSaveMasterModal(false);
    setNewMasterNameInput('');

    try {
      await saveConfirmedTemplateToDb(templateToSave);
    } catch {
      // Fallback to localStorage if IndexedDB is blocked in private mode
      try {
        localStorage.setItem(
          'ecom_studio_confirmed_templates_v1',
          JSON.stringify(nextList)
        );
      } catch {
        // Ignore
      }
    }

    showToast(
      `已保存正式母版「${cleanName}」：含 ${templateToSave.tasks.length} 屏详情任务与 ${
        templateToSave.skuTasks?.length || 0
      } 款 SKU 任务`,
      'success'
    );
  };

  const handleDeleteConfirmedTemplate = async (templateId: string) => {
    const target = confirmedTemplates.find((t) => t.id === templateId);
    const nextList = confirmedTemplates.filter((t) => t.id !== templateId);
    setConfirmedTemplates(nextList);
    await deleteConfirmedTemplateFromDb(templateId);
    try {
      localStorage.setItem(
        'ecom_studio_confirmed_templates_v1',
        JSON.stringify(nextList)
      );
    } catch {
      // Ignore
    }
    if (selectedPresetId === templateId) {
      setSelectedPresetId('blank-workspace');
    }
    showToast(`已删除母版「${target?.name || templateId}」`, 'info');
  };

  // Export either the currently selected confirmed template or a snapshot of the current workspace as a .json Master Template file
  const handleExportCurrentMasterTemplateFile = () => {
    const activeTpl = confirmedTemplates.find((t) => t.id === selectedPresetId);
    const tplToExport: ConfirmedMasterTemplate = activeTpl || {
      id: `master-${Date.now()}`,
      name: newMasterNameInput.trim() || '当前工作台母版备份',
      createdAt: new Date().toLocaleDateString('zh-CN'),
      productInfoText,
      fullPlanDoc,
      globalStylePrefix: config.globalStylePrefix,
      requirements: { ...config.requirements },
      referenceImages: referenceImages.map((img) => ({
        ...img,
        ossUploading: false,
      })),
      skuReferenceImages: skuReferenceImages.map((img) => ({
        ...img,
        ossUploading: false,
      })),
      tasks: tasks.map((t) => ({
        ...t,
        referenceImageIds: Array.isArray(t.referenceImageIds)
          ? [...t.referenceImageIds]
          : [],
        status: t.resultImageUrl ? 'completed' : 'idle',
        historyImages: Array.isArray(t.historyImages)
          ? t.historyImages.slice(0, 6)
          : [],
      })),
      skuBatchConfig: { ...skuBatchConfig },
      skuTasks: skuTasks.map((st) => ({
        ...st,
        caseRefIds: Array.isArray(st.caseRefIds) ? [...st.caseRefIds] : [],
        status: st.resultImageUrl ? 'completed' : 'idle',
        historyImages: Array.isArray(st.historyImages)
          ? st.historyImages.slice(0, 6)
          : [],
      })),
    };
    exportMasterTemplateToJsonFile(tplToExport);
    showToast(
      `已导出母版文件「${tplToExport.name}.json」（含详情与 SKU 全套参考图、绑定关系与提示词）`,
      'success'
    );
  };

  // Import a .json Master Template file from local disk into IndexedDB and load it into the workspace
  const handleImportMasterTemplateFile = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const imported = await importMasterTemplateFromJsonFile(file);
      await saveConfirmedTemplateToDb(imported);
      const nextList = [imported, ...confirmedTemplates];
      setConfirmedTemplates(nextList);
      setSelectedPresetId(imported.id);
      setProductInfoText(imported.productInfoText);
      setFullPlanDoc(imported.fullPlanDoc);
      if (imported.requirements) {
        setConfig((prev) => ({
          ...prev,
          defaultAspectRatio:
            imported.requirements.detailAspectRatio || prev.defaultAspectRatio,
          globalStylePrefix:
            imported.globalStylePrefix || prev.globalStylePrefix,
          requirements: {
            ...prev.requirements,
            ...imported.requirements,
          },
        }));
      }
      setReferenceImages(
        (imported.referenceImages || []).map((img) => ({
          ...img,
          ossUploading: false,
        }))
      );
      setSkuReferenceImages(
        (imported.skuReferenceImages || []).map((img) => ({
          ...img,
          ossUploading: false,
        }))
      );
      const importedDetailRatio: AspectRatioOption =
        imported.requirements?.detailAspectRatio ||
        config.requirements.detailAspectRatio ||
        '9:16';
      setTasks(
        (imported.tasks || []).map((t, idx) => {
          const screenNum =
            typeof t.screenNumber === 'number' ? t.screenNumber : idx + 1;
          const hadLegacyMainResidue =
            t.screenCategory === 'main' || /主图\s*\d+/.test(t.title || '');
          const cleanedTitle = (t.title || '')
            .replace(
              /^(第\s*\d+\s*屏\s*[·•-]\s*)?主图\s*\d+\s*[·•-]?\s*/i,
              `第${screenNum}屏·`
            )
            .trim();
          return {
            ...t,
            screenNumber: screenNum,
            screenCategory: 'detail',
            title: cleanedTitle || t.title,
            aspectRatio:
              hadLegacyMainResidue && t.aspectRatio === '1:1'
                ? importedDetailRatio
                : t.aspectRatio || importedDetailRatio,
            referenceImageIds: Array.isArray(t.referenceImageIds)
              ? t.referenceImageIds
              : [],
          };
        })
      );
      if (imported.skuBatchConfig) {
        const globalSp =
          config.defaultSellingPointPresets &&
          config.defaultSellingPointPresets.length > 0
            ? config.defaultSellingPointPresets
            : DEFAULT_SKU_SELLING_POINT_PRESETS;
        const tplSp = Array.isArray(imported.skuBatchConfig.sellingPointPresets)
          ? imported.skuBatchConfig.sellingPointPresets
          : [];
        const mergedSpMap = new Map<string, SkuSellingPointPreset>();
        globalSp.forEach((p) => mergedSpMap.set(p.id, p));
        tplSp.forEach((p) => {
          if (!mergedSpMap.has(p.id)) {
            mergedSpMap.set(p.id, p);
          }
        });
        setSkuBatchConfig({
          ...imported.skuBatchConfig,
          sellingPointPresets: Array.from(mergedSpMap.values()),
        });
      }
      if (Array.isArray(imported.skuTasks)) {
        setSkuTasks(imported.skuTasks);
      }
      setShowSaveMasterModal(false);
      showToast(
        `成功导入母版「${imported.name}」：已恢复 ${imported.tasks.length} 屏详情任务与 ${
          imported.skuTasks?.length || 0
        } 款 SKU 任务`,
        'success'
      );
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : '导入母版文件失败，请检查文件格式',
        'error'
      );
    }
  };

  // Probe local Codex CLI & built-in model bridge status
  const handleProbeCodexCliStatus = async (silent = false) => {
    setCodexCliStatus((prev) => ({ ...prev, loading: true }));
    try {
      const res = await studioBridge.getCodexCliStatus({
        cliCommand: activeChannel.cliCommand,
        customBaseUrl: activeChannel.baseUrl,
        customApiKey: activeChannel.apiKey,
      });
      setCodexCliStatus({
        loading: false,
        checked: true,
        cliInstalled: res.cliInstalled,
        cliVersion: res.cliVersion,
        configPath: res.configPath || undefined,
        configBaseUrl: res.detectedBaseUrl,
        hasAuthKey: res.authConfigured,
        hasBuiltInKey: res.builtInBridgeReady,
        builtInAgentModels: res.builtInAgentModels,
        builtInImageModels: res.builtInImageModels,
        message: res.message,
      });
      if (!silent) {
        showToast(res.message || '本地 Codex CLI 通道环境检测完成', 'success');
      }
    } catch (err: any) {
      setCodexCliStatus({
        loading: false,
        checked: true,
        message: err?.message || '检测本地 Codex CLI 状态失败',
      });
      if (!silent) {
        showToast(err?.message || '检测本地 Codex CLI 状态失败', 'error');
      }
    }
  };

  useEffect(() => {
    if (
      showApiModal &&
      apiConfigTab === 'channel_model' &&
      !codexCliStatus.checked &&
      !codexCliStatus.loading
    ) {
      void handleProbeCodexCliStatus(true);
    }
  }, [showApiModal, apiConfigTab]);

  // Test API channel connectivity via studioBridge (Web / Electron IPC / Tauri Core)
  const handleTestChannel = async () => {
    setChannelTestStatus({ loading: true });
    try {
      const data = await studioBridge.testChannel({
        ...getActiveChannelBridgeParams(),
        cliCommand: activeChannel.cliCommand,
        cliExtraArgs: activeChannel.cliExtraArgs,
        agentModel: config.agentModel,
      });
      if (!data.ok) {
        throw new Error(data.error || '连通性测试未通过');
      }
      const protoTag = data.protocolUsed ? ` [${data.protocolUsed}]` : '';
      const endpointSuffix = data.normalizedEndpoint
        ? ` · ${data.normalizedEndpoint}`
        : '';
      setChannelTestStatus({
        loading: false,
        ok: true,
        message: `连接正常${protoTag} · 模型 ${data.model} · 耗时 ${data.latencyMs}ms${endpointSuffix}`,
      });
      showToast(
        `通道「${activeChannel.name}」连接正常 (${data.latencyMs}ms${protoTag})`,
        'success'
      );
    } catch (err: any) {
      setChannelTestStatus({
        loading: false,
        ok: false,
        message: err?.message || '连接失败',
      });
      showToast(err?.message || '通道测试失败', 'error');
    }
  };

  // Test Image Generation Model connectivity & output directly
  const handleTestImageGeneration = async () => {
    setImageTestStatus({ loading: true });
    try {
      const data = await studioBridge.generateImage({
        prompt:
          '高质感商业电商摄影，纯白极简几何石膏展台上的无线蓝牙耳机充电仓，柔和棚拍光影，8K超清细节',
        textMode: 'without_text',
        imageModel: config.imageModel,
        aspectRatio: '1:1',
        imageSize: '1K',
        ...getActiveChannelBridgeParams(),
      });

      if (!data.imageUrl) {
        throw new Error('生图测试未返回有效图片');
      }

      const protoTag = data.protocolUsed ? ` [${data.protocolUsed}]` : '';
      setImageTestStatus({
        loading: false,
        ok: true,
        previewUrl: data.imageUrl,
        message: `生图测试成功${protoTag} · 实际调用模型 ${data.modelUsed || config.imageModel} · 耗时 ${data.durationMs}ms`,
      });
      showToast(
        `生图模型「${data.modelUsed || config.imageModel}」测试出图成功 (${data.durationMs}ms)`,
        'success'
      );
    } catch (err: any) {
      setImageTestStatus({
        loading: false,
        ok: false,
        message: err?.message || '生图测试失败',
      });
      showToast(err?.message || '生图测试失败', 'error');
    }
  };

  // Active Cloud Storage Provider ('aliyun_oss' | 'cloudflare_r2')
  const activeStorageProvider: CloudStorageProvider =
    config.ossConfig?.provider === 'cloudflare_r2'
      ? 'cloudflare_r2'
      : 'aliyun_oss';
  const activeStorageShort =
    activeStorageProvider === 'cloudflare_r2' ? 'R2' : 'OSS';
  const activeStorageLabel =
    activeStorageProvider === 'cloudflare_r2' ? 'Cloudflare R2' : '阿里云 OSS';

  // Helper: Check if active Cloud Storage (Aliyun OSS or Cloudflare R2) is ready (either via user config or server env)
  const isAliyunOssConfigured = Boolean(
    (config.ossConfig?.bucket?.trim() &&
      config.ossConfig?.accessKeyId?.trim() &&
      config.ossConfig?.accessKeySecret?.trim()) ||
      envOssDetected.ossEnvConfigured
  );
  const isCloudflareR2Configured = Boolean(
    ((config.ossConfig?.r2AccountId?.trim() ||
      config.ossConfig?.r2Endpoint?.trim()) &&
      config.ossConfig?.r2Bucket?.trim() &&
      config.ossConfig?.r2AccessKeyId?.trim() &&
      config.ossConfig?.r2SecretAccessKey?.trim()) ||
      envOssDetected.r2EnvConfigured
  );
  const isOssReady = Boolean(
    config.ossConfig?.enabled &&
      (activeStorageProvider === 'cloudflare_r2'
        ? isCloudflareR2Configured
        : isAliyunOssConfigured)
  );

  const updateOssConfig = (patch: Partial<AliyunOssConfig>) => {
    setConfig((prev) => ({
      ...prev,
      ossConfig: {
        ...(prev.ossConfig || INITIAL_CONFIG.ossConfig!),
        ...patch,
      },
    }));
  };

  // Switch global Cloud Storage Provider and synchronize all asset/task URL references to the target provider
  const handleSwitchStorageProvider = (nextProvider: CloudStorageProvider) => {
    const nextLabel =
      nextProvider === 'cloudflare_r2' ? 'Cloudflare R2' : '阿里云 OSS';
    setOssTestStatus({ loading: false });
    updateOssConfig({ provider: nextProvider });

    // Helper to preserve existing provider URL in cloudUrls map and switch active ossUrl to nextProvider
    const switchItemCloudRef = <
      T extends {
        ossUrl?: string;
        ossObjectKey?: string;
        cloudUrls?: Partial<Record<CloudStorageProvider, string>>;
        cloudObjectKeys?: Partial<Record<CloudStorageProvider, string>>;
      },
    >(
      item: T
    ): T => {
      const nextCloudUrls: Partial<Record<CloudStorageProvider, string>> = {
        ...(item.cloudUrls || {}),
      };
      const nextCloudKeys: Partial<Record<CloudStorageProvider, string>> = {
        ...(item.cloudObjectKeys || {}),
      };
      if (item.ossUrl) {
        const inferred =
          inferUrlStorageProvider(item.ossUrl) || activeStorageProvider;
        if (!nextCloudUrls[inferred]) {
          nextCloudUrls[inferred] = item.ossUrl;
        }
        if (item.ossObjectKey && !nextCloudKeys[inferred]) {
          nextCloudKeys[inferred] = item.ossObjectKey;
        }
      }
      const resolvedUrl = getCloudUrlForProvider(
        item.ossUrl,
        nextCloudUrls,
        nextProvider
      );
      const resolvedKey = getCloudObjectKeyForProvider(
        item.ossObjectKey,
        item.ossUrl,
        nextCloudUrls,
        nextCloudKeys,
        nextProvider
      );
      return {
        ...item,
        ossUrl: resolvedUrl,
        ossObjectKey: resolvedKey,
        cloudUrls:
          Object.keys(nextCloudUrls).length > 0 ? nextCloudUrls : undefined,
        cloudObjectKeys:
          Object.keys(nextCloudKeys).length > 0 ? nextCloudKeys : undefined,
      };
    };

    setReferenceImages((prev) => prev.map((r) => switchItemCloudRef(r)));
    setSkuReferenceImages((prev) => prev.map((r) => switchItemCloudRef(r)));

    setCommonAssets((prev) => {
      const nextAssets = prev.map((a) => switchItemCloudRef(a));
      if (nextAssets.length > 0) {
        void saveCommonAssetsToDb(nextAssets).catch(() => {});
      }
      return nextAssets;
    });

    setGenerationRecords((prev) => {
      const nextRecords = prev.map((rec) => switchItemCloudRef(rec));
      if (nextRecords.length > 0) {
        void updateGenerationRecordsInDb(nextRecords).catch(() => {});
      }
      return nextRecords;
    });

    setTasks((prev) =>
      prev.map((t) => {
        const nextResultUrls: Partial<Record<CloudStorageProvider, string>> = {
          ...(t.resultCloudUrls || {}),
        };
        if (t.resultOssUrl) {
          const inferred =
            inferUrlStorageProvider(t.resultOssUrl) || activeStorageProvider;
          if (!nextResultUrls[inferred]) {
            nextResultUrls[inferred] = t.resultOssUrl;
          }
        }
        return {
          ...t,
          resultOssUrl: getCloudUrlForProvider(
            t.resultOssUrl,
            nextResultUrls,
            nextProvider
          ),
          resultCloudUrls:
            Object.keys(nextResultUrls).length > 0 ? nextResultUrls : undefined,
        };
      })
    );

    setSkuTasks((prev) =>
      prev.map((t) => {
        const nextResultUrls: Partial<Record<CloudStorageProvider, string>> = {
          ...(t.resultCloudUrls || {}),
        };
        if (t.resultOssUrl) {
          const inferred =
            inferUrlStorageProvider(t.resultOssUrl) || activeStorageProvider;
          if (!nextResultUrls[inferred]) {
            nextResultUrls[inferred] = t.resultOssUrl;
          }
        }
        return {
          ...t,
          resultOssUrl: getCloudUrlForProvider(
            t.resultOssUrl,
            nextResultUrls,
            nextProvider
          ),
          resultCloudUrls:
            Object.keys(nextResultUrls).length > 0 ? nextResultUrls : undefined,
        };
      })
    );

    showToast(
      `已切换云端存储引擎为「${nextLabel}」，全站素材与各工作台图片云端引用已同步切换`,
      'success'
    );
  };

  // Test active Cloud Storage (Aliyun OSS or Cloudflare R2) connectivity
  const handleTestOssConnection = async () => {
    setOssTestStatus({ loading: true });
    try {
      const res = await studioBridge.testOssConnection({
        ossConfig: config.ossConfig,
      });
      if (!res.ok) {
        throw new Error(res.error || `${activeStorageLabel} 连接测试未通过`);
      }
      setOssTestStatus({
        loading: false,
        ok: true,
        sampleUrl: res.sampleUrl,
        message: `${res.message} · 耗时 ${res.latencyMs}ms`,
      });
      updateOssConfig({ enabled: true });
      showToast(
        `${activeStorageLabel} 连通成功：Bucket [${res.bucket}] (${res.latencyMs}ms)`,
        'success'
      );
    } catch (err: any) {
      setOssTestStatus({
        loading: false,
        ok: false,
        message: err?.message || `${activeStorageLabel} 连接失败`,
      });
      showToast(err?.message || `${activeStorageLabel} 连接失败`, 'error');
    }
  };

  // Upload specific ReferenceImageItems to Alibaba Cloud OSS in small chunks (avoids 413 Payload Too Large & stuck ossUploading state)
  const uploadReferenceItemsToOss = async (
    itemsToUpload: ReferenceImageItem[],
    silent = false
  ) => {
    if (itemsToUpload.length === 0) return;
    const allTargetIds = new Set(itemsToUpload.map((i) => i.id));

    setReferenceImages((prev) =>
      prev.map((item) =>
        allTargetIds.has(item.id) ? { ...item, ossUploading: true } : item
      )
    );
    setSkuReferenceImages((prev) =>
      prev.map((item) =>
        allTargetIds.has(item.id) ? { ...item, ossUploading: true } : item
      )
    );

    // Helper to extract a single clean payload without duplicating base64Data + dataUrl
    const buildSingleUploadPayload = async (item: ReferenceImageItem) => {
      let cleanBase64 = (item.base64Data || '').trim();
      let cleanMime = item.mimeType || 'image/jpeg';

      if (cleanBase64.startsWith('data:')) {
        const commaIdx = cleanBase64.indexOf(',');
        if (commaIdx !== -1) {
          const header = cleanBase64.slice(5, commaIdx);
          const mimeMatch = header.match(/^([^;]+)/);
          if (mimeMatch?.[1]) cleanMime = mimeMatch[1];
          cleanBase64 = cleanBase64.slice(commaIdx + 1).trim();
        }
      }

      if (!cleanBase64 && item.previewUrl) {
        const preview = item.previewUrl.trim();
        if (preview.startsWith('data:')) {
          const commaIdx = preview.indexOf(',');
          if (commaIdx !== -1) {
            const header = preview.slice(5, commaIdx);
            const mimeMatch = header.match(/^([^;]+)/);
            if (mimeMatch?.[1]) cleanMime = mimeMatch[1];
            cleanBase64 = preview.slice(commaIdx + 1).trim();
          }
        } else if (preview.startsWith('blob:') || preview.startsWith('/')) {
          try {
            const resp = await fetch(preview);
            const blob = await resp.blob();
            if (blob.type) cleanMime = blob.type;
            const dataUrl = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onloadend = () =>
                typeof reader.result === 'string'
                  ? resolve(reader.result)
                  : reject(new Error('FileReader failed'));
              reader.onerror = reject;
              reader.readAsDataURL(blob);
            });
            const commaIdx = dataUrl.indexOf(',');
            if (commaIdx !== -1) {
              cleanBase64 = dataUrl.slice(commaIdx + 1).trim();
            }
          } catch {
            // Fallback to server-side URL fetch if applicable
          }
        }
      }

      return {
        id: item.id,
        name: `${item.code || item.category}_${item.tag || item.name}`,
        mimeType: cleanMime,
        // Send ONLY base64Data when available so we don't double the HTTP payload size
        base64Data: cleanBase64 || undefined,
        dataUrl: !cleanBase64 ? item.previewUrl : undefined,
      };
    };

    const CHUNK_SIZE = 2;
    let totalUploadedCount = 0;
    let lastErrorMsg = '';

    try {
      for (let i = 0; i < itemsToUpload.length; i += CHUNK_SIZE) {
        const chunk = itemsToUpload.slice(i, i + CHUNK_SIZE);
        const chunkIds = new Set(chunk.map((c) => c.id));

        try {
          const payloadItems = await Promise.all(
            chunk.map((item) => buildSingleUploadPayload(item))
          );

          const res = await studioBridge.uploadToOss({
            items: payloadItems,
            folder: 'refs',
            ossConfig: ossConfigRef.current || config.ossConfig,
          });

          const uploadedMap = new Map<
            string,
            { ossUrl: string; objectKey: string }
          >();
          for (const u of res.uploaded || []) {
            uploadedMap.set(u.id, { ossUrl: u.ossUrl, objectKey: u.objectKey });
          }
          totalUploadedCount += uploadedMap.size;

          if (res.failed && res.failed.length > 0) {
            lastErrorMsg = res.failed[0].error || '部分图片上传失败';
          }

          const applyChunkResult = (prev: ReferenceImageItem[]) =>
            prev.map((item) => {
              if (!chunkIds.has(item.id)) return item;
              const match = uploadedMap.get(item.id);
              if (!match) {
                return { ...item, ossUploading: false };
              }
              return {
                ...item,
                ossUploading: false,
                ossUrl: match.ossUrl,
                ossObjectKey: match.objectKey,
                cloudUrls: mergeCloudUrlsForProvider(
                  item.ossUrl,
                  item.cloudUrls,
                  activeStorageProvider,
                  match.ossUrl
                ),
                cloudObjectKeys: {
                  ...(item.cloudObjectKeys || {}),
                  [activeStorageProvider]: match.objectKey,
                },
              };
            });

          setReferenceImages(applyChunkResult);
          setSkuReferenceImages(applyChunkResult);

          // Also back-propagate ossUrl, ossObjectKey & cloudUrls to any matching items in Common Assets Library
          if (uploadedMap.size > 0) {
            const uploadedNameKeyMap = new Map<
              string,
              { ossUrl: string; objectKey: string }
            >();
            for (const c of chunk) {
              const m = uploadedMap.get(c.id);
              if (m) {
                uploadedNameKeyMap.set(`${c.category}:${c.name}`, m);
              }
            }
            if (uploadedNameKeyMap.size > 0) {
              const updatedCommonToPersist: SavedCommonAsset[] = [];
              setCommonAssets((prevCommon) =>
                prevCommon.map((asset) => {
                  const matched = uploadedNameKeyMap.get(
                    `${asset.category}:${asset.name}`
                  );
                  if (!matched) return asset;
                  const nextAsset: SavedCommonAsset = {
                    ...asset,
                    ossUrl: matched.ossUrl,
                    ossObjectKey: matched.objectKey,
                    cloudUrls: mergeCloudUrlsForProvider(
                      asset.ossUrl,
                      asset.cloudUrls,
                      activeStorageProvider,
                      matched.ossUrl
                    ),
                    cloudObjectKeys: {
                      ...(asset.cloudObjectKeys || {}),
                      [activeStorageProvider]: matched.objectKey,
                    },
                  };
                  updatedCommonToPersist.push(nextAsset);
                  return nextAsset;
                })
              );
              setTimeout(() => {
                if (updatedCommonToPersist.length > 0) {
                  saveCommonAssetsToDb(updatedCommonToPersist).catch(() => {});
                }
              }, 20);
            }
          }
        } catch (chunkErr: any) {
          lastErrorMsg =
            chunkErr?.message || `上传素材至 ${activeStorageLabel} 失败`;
          const clearChunkUploading = (prev: ReferenceImageItem[]) =>
            prev.map((item) =>
              chunkIds.has(item.id) ? { ...item, ossUploading: false } : item
            );
          setReferenceImages(clearChunkUploading);
          setSkuReferenceImages(clearChunkUploading);
        }
      }

      if (!silent) {
        if (totalUploadedCount > 0 && totalUploadedCount === itemsToUpload.length) {
          showToast(
            `已同步 ${totalUploadedCount} 张素材图至 ${activeStorageLabel}（已启用 0-Base64 云端直链传输）`,
            'success'
          );
        } else if (totalUploadedCount > 0) {
          showToast(
            `已同步 ${totalUploadedCount}/${itemsToUpload.length} 张素材至 ${activeStorageLabel}（部分失败：${lastErrorMsg}）`,
            'info'
          );
        } else {
          showToast(
            lastErrorMsg ||
              `上传素材至 ${activeStorageLabel} 失败，请检查云存储配置或网络`,
            'error'
          );
        }
      }
    } finally {
      // Guarantee ossUploading is cleared for all target items
      const ensureCleared = (prev: ReferenceImageItem[]) =>
        prev.map((item) =>
          allTargetIds.has(item.id) ? { ...item, ossUploading: false } : item
        );
      setReferenceImages(ensureCleared);
      setSkuReferenceImages(ensureCleared);
    }
  };

  // Helper: Build lightweight reference image payload for AI/Image endpoints.
  // When active provider cloud URL is present (OSS✓ / R2✓), omits base64Data & previewUrl for true 0-Base64 transfer.
  // When active provider cloud URL is absent, sends base64Data without duplicating previewUrl.
  const toLightweightRefPayload = (r: ReferenceImageItem) => {
    const activeUrl = getCloudUrlForProvider(
      r.ossUrl,
      r.cloudUrls,
      activeStorageProvider
    );
    const activeKey = getCloudObjectKeyForProvider(
      r.ossObjectKey,
      r.ossUrl,
      r.cloudUrls,
      r.cloudObjectKeys,
      activeStorageProvider
    );
    const hasOss = Boolean(activeUrl && /^https?:\/\//i.test(activeUrl));
    const fallbackBase64 =
      r.base64Data ||
      (r.previewUrl &&
      r.previewUrl.startsWith('data:') &&
      r.previewUrl.includes(',')
        ? r.previewUrl.split(',')[1]
        : '');
    return {
      id: r.id,
      code: r.code,
      category: r.category,
      isCommonAsset: r.isCommonAsset,
      name: r.name,
      tag: r.tag,
      prodAngleRole: r.prodAngleRole,
      width: r.width,
      height: r.height,
      caseDimensions: r.caseDimensions,
      caseCustomRule: r.caseCustomRule,
      isLockBaseSwap: r.isLockBaseSwap,
      isSharedStyleRef: r.isSharedStyleRef,
      extractedLayoutDna: r.extractedLayoutDna,
      detectedSubScreens: r.detectedSubScreens,
      isLongPageSlice: r.isLongPageSlice,
      sliceIndex: r.sliceIndex,
      sliceTotal: r.sliceTotal,
      mimeType: r.mimeType,
      ossUrl: activeUrl,
      ossObjectKey: activeKey,
      base64Data: hasOss ? undefined : fallbackBase64,
      previewUrl:
        hasOss || fallbackBase64 ? undefined : r.previewUrl || undefined,
    };
  };

  // Batch sync reference images in both pools to active Cloud Storage (Aliyun OSS or Cloudflare R2)
  const handleSyncAllReferencesToOss = async () => {
    const allRefs = [...referenceImages, ...skuReferenceImages];
    const unsynced = allRefs.filter(
      (r) => !isSyncedToProvider(r.ossUrl, r.cloudUrls, activeStorageProvider)
    );
    const targets = unsynced.length > 0 ? unsynced : allRefs;
    if (targets.length === 0) {
      showToast('素材池暂无图片可上传', 'info');
      return;
    }
    setIsSyncingAllRefsToOss(true);
    try {
      await uploadReferenceItemsToOss(targets, false);
    } finally {
      setIsSyncingAllRefsToOss(false);
    }
  };

  // Upload single completed screen result image to active Cloud Storage (OSS / R2) manually
  const handleUploadTaskResultToOss = async (task: ScreenTask) => {
    if (!task.resultImageUrl) return;
    try {
      showToast(
        `正在归档第 ${task.screenNumber} 屏成品图至 ${activeStorageLabel}...`,
        'info'
      );
      const res = await studioBridge.uploadToOss({
        items: [
          {
            id: task.id,
            name: `Screen_${String(task.screenNumber).padStart(2, '0')}_${task.title}`,
            mimeType: 'image/png',
            dataUrl: task.resultImageUrl,
          },
        ],
        folder: 'results',
        ossConfig: config.ossConfig,
      });
      const first = res.uploaded?.[0];
      if (first?.ossUrl) {
        updateTask(task.id, {
          resultOssUrl: first.ossUrl,
          resultCloudUrls: mergeCloudUrlsForProvider(
            task.resultOssUrl,
            task.resultCloudUrls,
            activeStorageProvider,
            first.ossUrl
          ),
        });
        const matchedRecords: GenerationRecordItem[] = [];
        setGenerationRecords((prev) =>
          prev.map((rec) => {
            if (rec.imageUrl === task.resultImageUrl) {
              const updated: GenerationRecordItem = {
                ...rec,
                ossUrl: first.ossUrl,
                ossObjectKey: first.objectKey,
                cloudUrls: mergeCloudUrlsForProvider(
                  rec.ossUrl,
                  rec.cloudUrls,
                  activeStorageProvider,
                  first.ossUrl
                ),
                cloudObjectKeys: {
                  ...(rec.cloudObjectKeys || {}),
                  [activeStorageProvider]: first.objectKey,
                },
              };
              matchedRecords.push(updated);
              return updated;
            }
            return rec;
          })
        );
        if (matchedRecords.length > 0) {
          void updateGenerationRecordsInDb(matchedRecords);
        }
        await navigator.clipboard.writeText(first.ossUrl).catch(() => {});
        showToast(
          `第 ${task.screenNumber} 屏已归档至 ${activeStorageLabel}，直链已复制到剪贴板！`,
          'success'
        );
      }
    } catch (err: any) {
      showToast(
        err?.message || `上传成品图至 ${activeStorageLabel} 失败`,
        'error'
      );
    }
  };

  // Helper to append processed image segments (from normal upload or LongImageHelperModal) into the target studio's independent pool
  const appendProcessedSegmentsToPool = (
    segments: Array<{
      name: string;
      dataUrl: string;
      width?: number;
      height?: number;
      mimeType?: string;
      customTag?: string;
      sliceIndex?: number;
      sliceTotal?: number;
    }>,
    category: 'product' | 'case',
    targetSkuTaskId?: string,
    targetStudio: 'detail_studio' | 'sku_studio' = 'detail_studio',
    sliceOptions?: {
      isLongPageSlice?: boolean;
      autoSyncScreenCount?: boolean;
      replaceRefIds?: string[];
    }
  ): string[] => {
    const categoryLabel =
      category === 'case' ? '参考案例图 (#Case)' : '产品图片 (#Prod)';
    const isLongSlice = Boolean(
      sliceOptions?.isLongPageSlice && segments.length >= 2
    );
    const createdItems: ReferenceImageItem[] = segments.map((seg, i) => {
      const cleanName = seg.name.replace(/\.[^/.]+$/, '');
      const base64Data = seg.dataUrl.includes(',')
        ? seg.dataUrl.split(',')[1]
        : seg.dataUrl;
      const { mimeType: resolvedMime, ext: resolvedExt } =
        extractMimeAndExtFromDataUrl(seg.dataUrl, seg.mimeType || 'image/jpeg');
      return {
        id: `ref-${targetStudio === 'sku_studio' ? 'sku-' : ''}${category}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}-${i}`,
        code: '',
        category,
        isCommonAsset: false,
        name: `${cleanName}.${resolvedExt}`,
        tag:
          seg.customTag?.trim() ||
          cleanName ||
          (category === 'case' ? '对标参考案例图' : '产品实拍参考图'),
        width: seg.width,
        height: seg.height,
        caseDimensions:
          category === 'case'
            ? isLongSlice
              ? (['style', 'structure', 'content', 'lighting'] as CaseRefDimension[])
              : (['style', 'structure'] as CaseRefDimension[])
            : undefined,
        isLongPageSlice: isLongSlice,
        sliceIndex: seg.sliceIndex ?? (isLongSlice ? i + 1 : undefined),
        sliceTotal:
          seg.sliceTotal ?? (isLongSlice ? segments.length : undefined),
        mimeType: resolvedMime,
        base64Data,
        previewUrl: seg.dataUrl,
      };
    });

    const newIds = createdItems.map((item) => item.id);

    if (targetStudio === 'sku_studio') {
      const nextSkuList = reindexReferenceCodes([
        ...skuReferenceImagesRef.current,
        ...createdItems,
      ]);
      skuReferenceImagesRef.current = nextSkuList;
      setSkuReferenceImages(nextSkuList);

      if (isOssReady && config.ossConfig?.autoUploadRefs !== false) {
        const newlyIndexed = nextSkuList.filter((item) =>
          createdItems.some((p) => p.id === item.id)
        );
        setTimeout(() => {
          uploadReferenceItemsToOss(newlyIndexed, false);
        }, 30);
      }

      if (category === 'product') {
        setSkuBatchConfig((prev) => ({
          ...prev,
          selectedProdIds: Array.from(
            new Set([...prev.selectedProdIds, ...newIds])
          ),
        }));
        if (targetSkuTaskId) {
          setSkuTasks((prev) =>
            prev.map((t) =>
              t.id === targetSkuTaskId
                ? {
                    ...t,
                    productRefIds: [newIds[0], ...newIds.slice(1)],
                    skuTitle:
                      t.skuTitle.trim() ||
                      createdItems[0]?.tag ||
                      createdItems[0]?.name.replace(/\.[^/.]+$/, '') ||
                      t.skuTitle,
                  }
                : t
            )
          );
        } else {
          // Automatically append corresponding SKU cards for newly uploaded #Prod images in SKU Studio using freshest #Case pool
          const existingCaseIds =
            skuBatchConfig.globalCaseRefIds.length > 0
              ? [...skuBatchConfig.globalCaseRefIds]
              : nextSkuList
                  .filter((r) => r.category === 'case')
                  .map((c) => c.id);

          setSkuTasks((prev) => {
            const boundProdIdSet = new Set(
              prev.flatMap((t) => t.productRefIds)
            );
            const unmappedItems = createdItems.filter(
              (item) => !boundProdIdSet.has(item.id)
            );
            if (unmappedItems.length === 0) return prev;

            const startIdx =
              prev.length > 0
                ? Math.max(...prev.map((t) => t.skuIndex)) + 1
                : 1;

            const autoCards: SkuTask[] = unmappedItems.map((item, idx) => {
              const cardIdx0 = startIdx - 1 + idx;
              return {
                id: `sku-auto-${Date.now()}-${idx}`,
                skuIndex: startIdx + idx,
                skuDiffMode: skuBatchConfig.skuDiffMode,
                skuTitle: formatSkuTitleFromConfig(cardIdx0, item),
                sellingPointBadge:
                  skuBatchConfig.referenceInfoText.trim() || '',
                packageSpecNote: '',
                typographyPlan: '',
                visualPrompt: '',
                textMode: skuBatchConfig.textMode,
                productRefIds: [item.id],
                caseRefIds: [...existingCaseIds],
                aspectRatio: skuBatchConfig.defaultAspectRatio,
                imageSize: skuBatchConfig.defaultImageSize,
                status: 'idle',
                historyImages: [],
              };
            });

            return [...prev, ...autoCards];
          });
        }
      } else if (category === 'case') {
        setSkuBatchConfig((prev) => ({
          ...prev,
          globalCaseRefIds: Array.from(
            new Set([...prev.globalCaseRefIds, ...newIds])
          ),
        }));
        if (targetSkuTaskId) {
          setSkuTasks((prev) =>
            prev.map((t) =>
              t.id === targetSkuTaskId
                ? {
                    ...t,
                    caseRefIds: Array.from(
                      new Set([...t.caseRefIds, ...newIds])
                    ),
                  }
                : t
            )
          );
        } else {
          // Auto-bind newly uploaded global #Case images to all existing SKU cards and mark prompts for refresh
          setSkuTasks((prev) =>
            prev.map((t) => {
              dirtySkuCasePromptTaskIdsRef.current.add(t.id);
              return {
                ...t,
                caseRefIds: Array.from(new Set([...t.caseRefIds, ...newIds])),
              };
            })
          );
        }
      }

      if (!isOssReady || config.ossConfig?.autoUploadRefs === false) {
        showToast(
          `已向「② SKU图工作台」导入 ${createdItems.length} 张高清${categoryLabel}${
            targetSkuTaskId
              ? ' 并自动绑定至当前 SKU 卡片'
              : category === 'product'
                ? ' 并已自动生成对应 SKU 卡片'
                : ''
          }`,
          'success'
        );
      }
      return newIds;
    }

    // Default: Detail Studio independent reference image pool
    const replaceSet = new Set(sliceOptions?.replaceRefIds || []);
    const filteredPrev =
      replaceSet.size > 0
        ? referenceImagesRef.current.filter((item) => !replaceSet.has(item.id))
        : referenceImagesRef.current;
    const nextDetailList = reindexReferenceCodes([
      ...filteredPrev,
      ...createdItems,
    ]);
    referenceImagesRef.current = nextDetailList;
    setReferenceImages(nextDetailList);

    if (isOssReady && config.ossConfig?.autoUploadRefs !== false) {
      const newlyIndexed = nextDetailList.filter((item) =>
        createdItems.some((p) => p.id === item.id)
      );
      setTimeout(() => {
        uploadReferenceItemsToOss(newlyIndexed, false);
      }, 30);
    }

    if (category === 'product') {
      setSelectedSkuImageIds(newIds);
    }

    // If user imported sliced long-page #Case screens in Detail Studio with autoSyncScreenCount enabled:
    // 1) Sync detailScreenCount to the number of sliced screens
    // 2) If tasks already exist, bind the newly sliced #Case items 1-to-1 by screen order
    if (
      category === 'case' &&
      targetStudio === 'detail_studio' &&
      sliceOptions?.autoSyncScreenCount &&
      createdItems.length >= 2
    ) {
      const targetScreenCount = Math.max(
        1,
        Math.min(20, createdItems.length)
      );
      setConfig((prev) => ({
        ...prev,
        requirements: {
          ...prev.requirements,
          taskScope: 'detail_only',
          detailScreenCount: targetScreenCount,
          autoAlignCaseToScreens: true,
        },
      }));

      setTasks((prevTasks) => {
        if (prevTasks.length === 0) return prevTasks;
        const prodIdSet = new Set(
          referenceImages
            .filter((r) => r.category !== 'case')
            .map((r) => r.id)
        );
        return prevTasks.map((t, idx) => {
          const keptProdIds = t.referenceImageIds.filter((id) =>
            prodIdSet.has(id)
          );
          const matchedCase =
            createdItems[Math.min(idx, createdItems.length - 1)];
          const nextRefs = matchedCase
            ? [...keptProdIds, matchedCase.id]
            : keptProdIds;
          return {
            ...t,
            screenCategory: 'detail',
            aspectRatio: config.requirements.detailAspectRatio,
            referenceImageIds: nextRefs,
            benchmarkCase: matchedCase
              ? `【1:1 对标分屏 #Case-${idx + 1} (${matchedCase.tag})】锁定该屏版式骨架与全局统一色调`
              : t.benchmarkCase,
          };
        });
      });

      showToast(
        `已导入 ${createdItems.length} 屏竞品切片，并自动将「详情页屏数」同步为 ${targetScreenCount} 屏（已开启逐屏 1:1 对标）！`,
        'success'
      );
      return newIds;
    }

    if (!isOssReady || config.ossConfig?.autoUploadRefs === false) {
      showToast(
        `已向「① 详情页工作台」导入 ${createdItems.length} 张高清${categoryLabel}${
          category === 'case' && isLongSlice
            ? '（可点击「逐屏逆向版式」识别各切片内的逻辑子屏并确认总屏数）'
            : ''
        }`,
        'success'
      );
    }
    return newIds;
  };

  // Upload Product Images (#Prod) or Case Reference Images (#Case)
  // Checks for >4096px oversized/ultra-long images and pops up LongImageHelperModal;
  // For <=4096px images, uses OSS-relaxed high-res compression (up to 2560px @ 0.92 quality when OSS is enabled)
  const handleUploadFiles = async (
    files: FileList | null,
    category: 'product' | 'case',
    targetSkuTaskId?: string,
    targetStudio: 'detail_studio' | 'sku_studio' = 'detail_studio'
  ) => {
    if (!files || files.length === 0) return;
    const fileArray = Array.from(files).filter((f) =>
      f.type.startsWith('image/')
    );
    if (fileArray.length === 0) return;

    const categoryLabel =
      category === 'case' ? '参考案例图 (#Case)' : '产品图片 (#Prod)';

    try {
      const normalFiles: File[] = [];
      const foundOversized: OversizedImageCandidate[] = [];

      for (const file of fileArray) {
        const candidate = await inspectOversizedImageFile(file, category);
        if (candidate) {
          foundOversized.push({
            ...candidate,
            targetStudio,
            targetSkuTaskId,
          });
        } else {
          normalFiles.push(file);
        }
      }

      if (foundOversized.length > 0) {
        setOversizedQueue((prev) => [...prev, ...foundOversized]);
        showToast(
          `检测到 ${foundOversized.length} 张超长详情/超大参考图，已打开智能寻缝切屏助手`,
          'info'
        );
      }

      if (normalFiles.length > 0) {
        showToast(
          `正在高清导入 ${normalFiles.length} 张${categoryLabel}（${
            isOssReady ? 'OSS 2560px 原画锐度模式' : '1600px 高清模式'
          }）...`,
          'info'
        );
        const processedSegments = await Promise.all(
          normalFiles.map(async (file) => {
            const norm = await normalizeUploadedImageHighRes(file, {
              ossEnabled: isOssReady,
              maxDimensionOverride: isOssReady ? 2560 : 1600,
              qualityOverride: isOssReady ? 0.92 : 0.85,
            });
            return {
              name: file.name.replace(/\.[^/.]+$/, ''),
              dataUrl: norm.dataUrl,
              width: norm.width,
              height: norm.height,
              mimeType: norm.mimeType || 'image/jpeg',
            };
          })
        );
        appendProcessedSegmentsToPool(
          processedSegments,
          category,
          targetSkuTaskId,
          targetStudio
        );
      }
    } catch (err: any) {
      showToast(err?.message || '部分图片读取失败', 'error');
    }
  };

  const handleCompleteOversizedSegments = async (
    segments: Array<{
      name: string;
      dataUrl: string;
      width: number;
      height: number;
      customTag?: string;
      sliceIndex?: number;
      sliceTotal?: number;
    }>,
    candidate: OversizedImageCandidate,
    options?: {
      isLongPageSlice?: boolean;
      autoSyncScreenCount?: boolean;
    }
  ) => {
    const isDetailCaseSlice =
      candidate.targetTag === 'case' &&
      (candidate.targetStudio || 'detail_studio') === 'detail_studio';

    const replaceRefIds =
      isDetailCaseSlice &&
      lastSlicedCaseCandidate &&
      lastSlicedCaseCandidate.candidate.previewUrl === candidate.previewUrl
        ? lastSlicedCaseCandidate.sliceRefIds
        : undefined;

    const createdIds = appendProcessedSegmentsToPool(
      segments.map((s) => ({
        name: s.name,
        dataUrl: s.dataUrl,
        width: s.width,
        height: s.height,
        mimeType: 'image/jpeg',
        customTag: s.customTag,
        sliceIndex: s.sliceIndex,
        sliceTotal: s.sliceTotal,
      })),
      candidate.targetTag,
      candidate.targetSkuTaskId,
      candidate.targetStudio || 'detail_studio',
      {
        ...options,
        replaceRefIds,
      }
    );

    if (isDetailCaseSlice) {
      if (
        lastSlicedCaseCandidate &&
        lastSlicedCaseCandidate.candidate.previewUrl !== candidate.previewUrl
      ) {
        URL.revokeObjectURL(lastSlicedCaseCandidate.candidate.previewUrl);
      }
      setLastSlicedCaseCandidate({
        candidate,
        sliceRefIds: createdIds,
      });
    } else {
      URL.revokeObjectURL(candidate.previewUrl);
    }

    setOversizedQueue((prev) => prev.filter((item) => item.id !== candidate.id));
  };

  const handleSkipOversizedCandidate = (candidate: OversizedImageCandidate) => {
    if (
      !lastSlicedCaseCandidate ||
      lastSlicedCaseCandidate.candidate.previewUrl !== candidate.previewUrl
    ) {
      URL.revokeObjectURL(candidate.previewUrl);
    }
    setOversizedQueue((prev) => prev.filter((item) => item.id !== candidate.id));
    showToast(`已跳过导入超长图片「${candidate.name}」`, 'info');
  };

  const toggleCaseDimension = (refId: string, dim: CaseRefDimension) => {
    const nextReferenceImages: ReferenceImageItem[] = referenceImages.map(
      (item) => {
        if (item.id !== refId) return item;
        const current: CaseRefDimension[] = item.caseDimensions || [
          'style',
          'structure',
        ];
        const exists = current.includes(dim);
        const next: CaseRefDimension[] = exists
          ? current.filter((d) => d !== dim)
          : [...current, dim];
        return {
          ...item,
          caseDimensions: next.length > 0 ? next : (['style'] as CaseRefDimension[]),
        };
      }
    );
    setReferenceImages(nextReferenceImages);

    const detailCases = nextReferenceImages.filter((r) => r.category === 'case');
    const detailProds = nextReferenceImages.filter((r) => r.category !== 'case');
    const nextUnifiedSpec = deriveUnifiedVisualSpecFromCases(
      detailCases,
      config.globalStylePrefix,
      productInfoText
    );
    setConfig((prev) => ({
      ...prev,
      requirements: {
        ...prev.requirements,
        unifiedVisualSpec: nextUnifiedSpec,
      },
    }));

    // Sync updated #Case dimension extraction directive into any Detail Studio screen task bound to this #Case
    // (preserving existing AI-parsed or user-edited title, copywriting, and typographyPlan!)
    setTasks((prevTasks) =>
      prevTasks.map((t, idx) => {
        if (!t.referenceImageIds.includes(refId)) return t;
        const boundCaseItems = nextReferenceImages.filter(
          (r) => t.referenceImageIds.includes(r.id) && r.category === 'case'
        );
        if (boundCaseItems.length === 0) return t;
        if (boundCaseItems.length === 1) {
          const screenNum =
            typeof t.screenNumber === 'number' ? t.screenNumber : idx + 1;
          return refreshTaskOnCaseDimensionChange({
            task: t,
            screenNum,
            matchedCase: boundCaseItems[0],
            prodRefs: detailProds,
            productInfoText,
            fullPlanDoc,
            enableStaticLayering:
              config.requirements.enableStaticLayering !== false,
            defaultAspectRatio: config.requirements.detailAspectRatio,
            defaultImageSize: config.defaultImageSize,
            defaultTextMode: config.requirements.textMode,
            unifiedVisualSpec: nextUnifiedSpec,
          });
        }
        return {
          ...t,
          benchmarkCase: buildClientCaseDimensionDirective(
            boundCaseItems,
            nextUnifiedSpec,
            'detail'
          ),
        };
      })
    );
  };

  const toggleSkuCaseDimension = (refId: string, dim: CaseRefDimension) => {
    setSkuReferenceImages((prev) =>
      prev.map((item) => {
        if (item.id !== refId) return item;
        const current = item.caseDimensions || ['style', 'structure'];
        const exists = current.includes(dim);
        const next = exists
          ? current.filter((d) => d !== dim)
          : [...current, dim];
        return {
          ...item,
          caseDimensions: next.length > 0 ? next : ['style'],
        };
      })
    );
    // Mark all SKU tasks bound to this #Case image so their prompts auto-regenerate with the new dimension split on next draw
    skuTasks.forEach((t) => {
      if (t.caseRefIds.includes(refId)) {
        dirtySkuCasePromptTaskIdsRef.current.add(t.id);
      }
    });
  };

  const toggleProductAssetScope = (refId: string) => {
    const nextRefs = referenceImages.map((item) =>
      item.id === refId
        ? { ...item, isCommonAsset: !item.isCommonAsset }
        : item
    );
    setReferenceImages(nextRefs);

    if (config.requirements.enableStaticLayering !== false && tasks.length > 0) {
      const allProds = nextRefs.filter((r) => r.category !== 'case');
      const hasCommon = allProds.some((p) => Boolean(p.isCommonAsset));
      const hasDynamic = allProds.some((p) => !p.isCommonAsset);

      setTasks((prevTasks) =>
        prevTasks.map((t) => {
          const boundProds = nextRefs.filter(
            (r) => t.referenceImageIds.includes(r.id) && r.category !== 'case'
          );
          const boundCases = nextRefs.filter(
            (r) => t.referenceImageIds.includes(r.id) && r.category === 'case'
          );
          const needsRebind =
            boundProds.length === 0 ||
            boundProds.some((p) => p.id === refId) ||
            (t.layerType === 'static' &&
              hasCommon &&
              boundProds.every((p) => !p.isCommonAsset)) ||
            (t.layerType === 'dynamic' &&
              hasDynamic &&
              boundProds.every((p) => Boolean(p.isCommonAsset)));

          if (!needsRebind) return t;

          const bestProds = selectBestProdRefsForScreen(
            t.screenNumber,
            `${t.title} ${t.copywriting}`,
            allProds,
            t.layerType
          );
          const newRefIds = [
            ...bestProds.map((p) => p.id),
            ...boundCases.map((c) => c.id),
          ];
          const prodCodesDesc =
            bestProds.length > 0
              ? bestProds
                  .map((p) => `#${p.code}（${p.tag || p.name}）`)
                  .join(' 与 ')
              : '自有产品实拍图 #Prod';
          const updatedPrompt = (t.visualPrompt || '').replace(
            /（(?:产品身份唯一权威源|唯一产品身份权威源)：[^）]+）/,
            (m) =>
              m.startsWith('（唯一')
                ? `（唯一产品身份权威源：${prodCodesDesc}）`
                : `（产品身份唯一权威源：${prodCodesDesc}）`
          );
          return {
            ...t,
            referenceImageIds: newRefIds,
            visualPrompt: updatedPrompt,
          };
        })
      );
    }
  };

  const handleUpdateSkuAssetTag = (refId: string, newTag: string) => {
    setSkuReferenceImages((prev) =>
      prev.map((item) => (item.id === refId ? { ...item, tag: newTag } : item))
    );
  };

  const handleAutoAnalyzeReferenceTags = async () => {
    if (referenceImages.length === 0) {
      showToast('请先上传产品图片或参考案例图', 'error');
      return;
    }
    setIsAnalyzingRefs(true);
    const logHandle = startRuntimeLog({
      workspace: 'detail',
      title: `AI 识图打标 (${referenceImages.length}张参考图)`,
      model: config.agentModel,
      summary: '正在分析详情工作台产品图视角与对标图维度...',
    });
    try {
      const data = await studioBridge.analyzeRefs({
        referenceImages: referenceImages.map((r) => toLightweightRefPayload(r)),
        agentModel: config.agentModel,
        ...getActiveChannelBridgeParams(),
        ossConfig: config.ossConfig,
      });

      const tagMap = new Map<string, string>();
      const roleMap = new Map<string, string>();
      const dimMap = new Map<string, CaseRefDimension[]>();
      for (const item of data.tags || []) {
        if (item.id && item.tag) {
          tagMap.set(item.id, item.tag);
        }
        if (item.id && item.prodAngleRole) {
          roleMap.set(item.id, item.prodAngleRole);
        }
        if (
          item.id &&
          Array.isArray(item.caseDimensions) &&
          item.caseDimensions.length > 0
        ) {
          dimMap.set(item.id, item.caseDimensions as CaseRefDimension[]);
        }
      }

      const updatedReferenceImages = referenceImages.map((ref) => {
        // Protect #Case tag if reverse-engineering DNA already exists
        const hasDnaOrSubScreens =
          ref.category === 'case' &&
          (Boolean(ref.extractedLayoutDna) || (Array.isArray(ref.detectedSubScreens) && ref.detectedSubScreens.length > 0));
        const safeTag = hasDnaOrSubScreens ? ref.tag : tagMap.get(ref.id) || ref.tag;

        // Never overwrite existing user-selected caseDimensions
        const safeDimensions =
          ref.category === 'case'
            ? ref.caseDimensions && ref.caseDimensions.length > 0
              ? ref.caseDimensions
              : dimMap.get(ref.id) || ref.caseDimensions
            : ref.caseDimensions;

        const detectedRole = roleMap.get(ref.id);

        return {
          ...ref,
          tag: safeTag,
          prodAngleRole:
            ref.category !== 'case' && detectedRole
              ? (detectedRole as any)
              : ref.prodAngleRole,
          caseDimensions: safeDimensions,
        };
      });
      setReferenceImages(updatedReferenceImages);
      setTasks((prevTasks) =>
        prevTasks.map((t) => {
          const boundCaseItems = updatedReferenceImages.filter(
            (r) => t.referenceImageIds.includes(r.id) && r.category === 'case'
          );
          if (boundCaseItems.length === 0) return t;

          const directive = buildClientCaseDimensionDirective(
            boundCaseItems,
            config.requirements.unifiedVisualSpec,
            'detail'
          );
          const prefixMatch = t.benchmarkCase.match(/^【对标来源：[^】]+】/);
          return {
            ...t,
            benchmarkCase: prefixMatch ? `${prefixMatch[0]}${directive}` : directive,
          };
        })
      );
      finishRuntimeLogSuccess(
        logHandle,
        `已完成详情工作台 ${referenceImages.length} 张素材图的视觉特征与对标维度自动标注`
      );
      showToast(
        `已完成详情工作台全部 ${referenceImages.length} 张素材图的视觉特征与对标维度自动标注`,
        'success'
      );
    } catch (err: any) {
      const msg = err?.message || 'AI 识别素材标签失败';
      finishRuntimeLogError(logHandle, msg);
      showToast(msg, 'error');
    } finally {
      setIsAnalyzingRefs(false);
    }
  };

  // Per-Screen & Multi-SubScreen Independent Layout Reverse-Engineering for Sliced Long-Page Competitor Case Images
  const handleAnalyzeDetailCaseScreens = async () => {
    const detailCases = referenceImages.filter((r) => r.category === 'case');
    if (detailCases.length === 0) {
      showToast('请先上传竞品详情页参考案例图 (#Case)', 'error');
      return;
    }

    setIsAnalyzingRefs(true);
    const logHandle = startRuntimeLog({
      workspace: 'detail',
      title: `逐屏逆向拆解竞品版式 (${detailCases.length}张 #Case 切片)`,
      model: config.agentModel,
      summary: '正在扫描每张切片内包含的多个逻辑子屏模块、内容标题与整页统一视觉规范...',
    });

    try {
      const res = await studioBridge.analyzeCaseScreens({
        caseImages: detailCases.map((c) => toLightweightRefPayload(c)),
        expectedTotalScreens: config.requirements.detailScreenCount,
        agentModel: config.agentModel,
        ...getActiveChannelBridgeParams(),
        ossConfig: config.ossConfig,
      });

      const screenMap = new Map(
        (res.screens || []).map((s) => [s.id, s])
      );

      const updatedRefs = referenceImages.map((r) => {
        const hit = screenMap.get(r.id);
        if (!hit) return r;
        const detectedSubScreens: DetectedCaseSubScreen[] | undefined =
          Array.isArray(hit.subScreens) && hit.subScreens.length > 0
            ? hit.subScreens.map((sub, sIdx) => ({
                subScreenIndex: sub.subScreenIndex || sIdx + 1,
                subScreenTotal: sub.subScreenTotal || hit.subScreens!.length,
                regionLabel: sub.regionLabel || '整屏',
                title: sub.title || hit.tag || r.tag,
                sectionType: sub.sectionType,
                extractedLayoutDna:
                  sub.extractedLayoutDna ||
                  hit.extractedLayoutDna ||
                  r.extractedLayoutDna ||
                  '',
              }))
            : undefined;
        return {
          ...r,
          tag: hit.tag || r.tag,
          extractedLayoutDna: hit.extractedLayoutDna || r.extractedLayoutDna,
          detectedSubScreens: detectedSubScreens || r.detectedSubScreens,
          caseDimensions:
            Array.isArray(hit.caseDimensions) && hit.caseDimensions.length > 0
              ? (hit.caseDimensions as CaseRefDimension[])
              : r.caseDimensions,
        };
      });

      setReferenceImages(updatedRefs);

      const updatedCases = updatedRefs.filter((r) => r.category === 'case');
      const extractedUnifiedSpec =
        res.unifiedVisualSpec?.trim() ||
        deriveUnifiedVisualSpecFromCases(
          updatedCases,
          config.globalStylePrefix,
          productInfoText
        );

      const flattenedLogicalScreens = flattenCaseLogicalScreens(
        updatedCases,
        config.requirements.detailScreenCount
      );

      setConfig((prev) => ({
        ...prev,
        requirements: {
          ...prev.requirements,
          taskScope: 'detail_only',
          autoAlignCaseToScreens: true,
          unifiedVisualSpec: extractedUnifiedSpec,
        },
      }));

      // Open the interactive confirmation modal so user can verify the detected screen list & count,
      // edit titles, or click to re-slice manually by actual screen boundaries!
      setCaseScreenConfirmModal({
        isOpen: true,
        initialScreens: flattenedLogicalScreens,
        initialUnifiedVisualSpec: extractedUnifiedSpec,
      });

      finishRuntimeLogSuccess(
        logHandle,
        `已从 ${detailCases.length} 张长图切片中识别拆解出 ${flattenedLogicalScreens.length} 个逻辑分屏模块，等待确认`
      );
      showToast(
        `已从 ${detailCases.length} 张切片中识别出 ${flattenedLogicalScreens.length} 屏内容结构，请在弹窗中确认或调整屏数！`,
        'success'
      );
    } catch (err: any) {
      const msg = err?.message || '逐屏逆向拆解竞品版式失败';
      finishRuntimeLogError(logHandle, msg);
      showToast(msg, 'error');
    } finally {
      setIsAnalyzingRefs(false);
    }
  };

  // Helper to construct 1..targetCount detail screen tasks directly from #Prod + #Case sub-screen pool + real product/plan copy
  const buildDetailTasksFromCasePool = (
    targetCount: number,
    sourceRefs: ReferenceImageItem[] = referenceImages,
    overrideUnifiedSpec?: string,
    explicitLogicalScreens?: FlattenedLogicalScreenItem[]
  ): ScreenTask[] => {
    const enableStatic = config.requirements.enableStaticLayering !== false;
    const prodRefs = sourceRefs.filter((r) => r.category !== 'case');
    const caseRefs = sourceRefs.filter((r) => r.category === 'case');
    const count = Math.max(1, Math.min(20, targetCount));
    const unifiedSpec =
      overrideUnifiedSpec?.trim() ||
      config.requirements.unifiedVisualSpec?.trim() ||
      deriveUnifiedVisualSpecFromCases(
        caseRefs,
        config.globalStylePrefix,
        productInfoText
      );

    const logicalScreens =
      explicitLogicalScreens && explicitLogicalScreens.length > 0
        ? explicitLogicalScreens
        : flattenCaseLogicalScreens(caseRefs, count);

    const caseMap = new Map<string, ReferenceImageItem>();
    for (const c of caseRefs) {
      caseMap.set(c.id, c);
    }

    return Array.from({ length: count }, (_, idx) => {
      const screenNum = idx + 1;
      const matchedLogical =
        logicalScreens.length > 0
          ? logicalScreens[
              Math.min(
                logicalScreens.length - 1,
                Math.floor((idx * logicalScreens.length) / Math.max(1, count))
              )
            ]
          : undefined;
      const matchedCase = matchedLogical
        ? caseMap.get(matchedLogical.sourceCaseId) ||
          caseRefs[
            Math.min(
              caseRefs.length - 1,
              Math.floor((idx * caseRefs.length) / Math.max(1, count))
            )
          ]
        : caseRefs.length > 0
          ? caseRefs[
              Math.min(
                caseRefs.length - 1,
                Math.floor((idx * caseRefs.length) / Math.max(1, count))
              )
            ]
          : undefined;

      return synthesizeScreenFromCaseAndPlan({
        screenNum,
        matchedCase,
        matchedSubScreen: matchedLogical,
        prodRefs,
        productInfoText,
        fullPlanDoc,
        enableStaticLayering: enableStatic,
        aspectRatio: config.requirements.detailAspectRatio,
        imageSize: config.defaultImageSize,
        textMode: config.requirements.textMode,
        unifiedVisualSpec: unifiedSpec,
        isLockBaseSwap: Boolean(matchedCase?.isLockBaseSwap),
      });
    });
  };

  // Handler when user confirms the screen list & count in CaseScreenConfirmModal
  const handleConfirmCaseScreensModal = (payload: {
    confirmedScreens: FlattenedLogicalScreenItem[];
    confirmedUnifiedSpec: string;
  }) => {
    const { confirmedScreens, confirmedUnifiedSpec } = payload;
    const targetCount = Math.max(
      1,
      Math.min(20, confirmedScreens.length || config.requirements.detailScreenCount)
    );
    const syncedRefs = syncFlattenedScreensBackToCases(
      referenceImages,
      confirmedScreens
    );
    setReferenceImages(syncedRefs);

    setConfig((prev) => ({
      ...prev,
      requirements: {
        ...prev.requirements,
        taskScope: 'detail_only',
        detailScreenCount: targetCount,
        autoAlignCaseToScreens: true,
        unifiedVisualSpec: confirmedUnifiedSpec,
      },
    }));

    const newTasks = buildDetailTasksFromCasePool(
      targetCount,
      syncedRefs,
      confirmedUnifiedSpec,
      confirmedScreens
    );
    setTasks(newTasks);
    setViewMode('cards');
    setLayerFilter('all');
    setStatusFilter('all');
    setCaseScreenConfirmModal((prev) => ({ ...prev, isOpen: false }));

    showToast(
      `已确认 ${targetCount} 屏结构并按序生成 ${newTasks.length} 张详情页任务卡！`,
      'success'
    );
  };

  // Handler when user clicks "重新手动精细切分长图" inside CaseScreenConfirmModal
  const handleRequestManualResliceFromConfirm = async (
    desiredSliceCount: number
  ) => {
    setCaseScreenConfirmModal((prev) => ({ ...prev, isOpen: false }));
    const clampedCount = Math.max(2, Math.min(20, desiredSliceCount || 10));

    if (lastSlicedCaseCandidate) {
      setOversizedQueue([
        {
          ...lastSlicedCaseCandidate.candidate,
          recommendedSliceCount: clampedCount,
        },
      ]);
      showToast(
        `已重新载入原始长图「${lastSlicedCaseCandidate.candidate.name}」并预设为 ${clampedCount} 屏，请拖拽切线精细切分！`,
        'info'
      );
      return;
    }

    // Fallback: if no cached original candidate exists, convert the first/tallest #Case slice into a candidate for slicing
    const detailCases = referenceImages.filter((r) => r.category === 'case');
    if (detailCases.length === 0) {
      caseFileInputRef.current?.click();
      return;
    }

    try {
      const targetRef = detailCases[0];
      const resp = await fetch(targetRef.previewUrl);
      const blob = await resp.blob();
      const file = new File([blob], targetRef.name || 'case_long.jpg', {
        type: targetRef.mimeType || 'image/jpeg',
      });
      const objectUrl = URL.createObjectURL(file);
      const dims = await new Promise<{ width: number; height: number }>(
        (resolve) => {
          const img = new Image();
          img.onload = () =>
            resolve({
              width: img.naturalWidth || 800,
              height: img.naturalHeight || 2400,
            });
          img.onerror = () => resolve({ width: 800, height: 2400 });
          img.src = objectUrl;
        }
      );

      const fallbackCandidate: OversizedImageCandidate = {
        id: `reslice-${Date.now()}`,
        file,
        name: targetRef.name || '竞品详情图.jpg',
        width: dims.width,
        height: dims.height,
        previewUrl: objectUrl,
        targetTag: 'case',
        targetStudio: 'detail_studio',
        recommendedSliceCount: clampedCount,
      };
      setLastSlicedCaseCandidate({
        candidate: fallbackCandidate,
        sliceRefIds: [targetRef.id],
      });
      setOversizedQueue([fallbackCandidate]);
      showToast(
        `已打开切屏助手并预设为 ${clampedCount} 屏，可手动拖拽切线精细切分！`,
        'info'
      );
    } catch {
      caseFileInputRef.current?.click();
    }
  };

  // 1-Click Sequential Binding of #Case sub-screens to Screen 1..N (respects detectedSubScreens & detailScreenCount!)
  const handleBindCasesOneToOneToTasks = () => {
    const detailCases = referenceImages.filter((r) => r.category === 'case');
    const detailProds = referenceImages.filter((r) => r.category !== 'case');
    if (detailCases.length === 0) {
      showToast('请先上传参考案例图 (#Case)', 'error');
      return;
    }

    const logicalScreens = flattenCaseLogicalScreens(
      detailCases,
      config.requirements.detailScreenCount
    );
    const targetCount = Math.max(
      1,
      Math.min(
        20,
        logicalScreens.length >= config.requirements.detailScreenCount
          ? logicalScreens.length
          : config.requirements.detailScreenCount || logicalScreens.length
      )
    );

    setConfig((prev) => ({
      ...prev,
      requirements: {
        ...prev.requirements,
        taskScope: 'detail_only',
        detailScreenCount: targetCount,
        autoAlignCaseToScreens: true,
      },
    }));

    if (tasks.length === 0) {
      const createdTasks = buildDetailTasksFromCasePool(
        targetCount,
        referenceImages,
        undefined,
        logicalScreens
      );
      setTasks(createdTasks);
      showToast(
        `已将 ${detailCases.length} 张切片拆解出的 ${createdTasks.length} 个逻辑分屏按序映射到右侧任务卡！`,
        'success'
      );
      return;
    }

    const prodIdsSet = new Set(detailProds.map((r) => r.id));
    const caseMap = new Map(detailCases.map((c) => [c.id, c]));

    setTasks((prevTasks) => {
      const updatedExisting = prevTasks.map((t, idx) => {
        const screenNum =
          typeof t.screenNumber === 'number' ? t.screenNumber : idx + 1;
        const matchedLogical =
          logicalScreens[
            Math.min(
              logicalScreens.length - 1,
              Math.floor((idx * logicalScreens.length) / Math.max(1, targetCount))
            )
          ];
        const matchedCase = matchedLogical
          ? caseMap.get(matchedLogical.sourceCaseId) ||
            detailCases[
              Math.min(
                detailCases.length - 1,
                Math.floor((idx * detailCases.length) / Math.max(1, targetCount))
              )
            ]
          : detailCases[
              Math.min(
                detailCases.length - 1,
                Math.floor((idx * detailCases.length) / Math.max(1, targetCount))
              )
            ];

        if (isTaskPollutedByPlaceholdersOrSkeleton(t, matchedCase)) {
          const synthesized = synthesizeScreenFromCaseAndPlan({
            screenNum,
            matchedCase,
            matchedSubScreen: matchedLogical,
            prodRefs: detailProds,
            productInfoText,
            fullPlanDoc,
            enableStaticLayering:
              config.requirements.enableStaticLayering !== false,
            aspectRatio: config.requirements.detailAspectRatio,
            imageSize: t.imageSize || config.defaultImageSize,
            textMode: config.requirements.textMode,
            existingTaskId: t.id,
          });
          return {
            ...synthesized,
            resultImageUrl: t.resultImageUrl,
            resultOssUrl: t.resultOssUrl,
            resultCloudUrls: t.resultCloudUrls,
            resultTextNote: t.resultTextNote,
            durationMs: t.durationMs,
            generatedAt: t.generatedAt,
            status: t.status,
            historyImages: t.historyImages,
          };
        }

        const smartProds = selectBestProdRefsForScreen(
          screenNum,
          `${t.title} ${matchedLogical?.title || matchedCase?.tag || ''} ${matchedLogical?.extractedLayoutDna || matchedCase?.extractedLayoutDna || ''}`,
          detailProds
        );
        const keptProds = t.referenceImageIds.filter((id) =>
          prodIdsSet.has(id)
        );
        const onlyBoundInnerCloseup =
          keptProds.length === 1 &&
          /内侧特写|出音网孔|LR标识/.test(
            detailProds.find((p) => p.id === keptProds[0])?.tag || ''
          ) &&
          smartProds.some((sp) => sp.id !== keptProds[0]);

        const prodList =
          keptProds.length > 0 && !onlyBoundInnerCloseup
            ? keptProds
            : smartProds.map((p) => p.id);

        return {
          ...t,
          screenCategory: 'detail' as const,
          aspectRatio: config.requirements.detailAspectRatio,
          referenceImageIds: matchedCase
            ? Array.from(new Set([...prodList, matchedCase.id]))
            : prodList,
          benchmarkCase: matchedCase
            ? buildClientCaseDimensionDirective([matchedCase])
            : t.benchmarkCase,
        };
      });

      if (updatedExisting.length < targetCount) {
        const fullPool = buildDetailTasksFromCasePool(
          targetCount,
          referenceImages,
          undefined,
          logicalScreens
        );
        return [
          ...updatedExisting,
          ...fullPool.slice(updatedExisting.length),
        ];
      }
      return updatedExisting;
    });

    showToast(
      `已将 ${detailCases.length} 张切片按序绑定并对齐至 ${targetCount} 屏任务卡！`,
      'success'
    );
  };

  const handleAutoAnalyzeSkuReferenceTags = async () => {
    if (skuReferenceImages.length === 0) {
      showToast('请先在 SKU 工作台上传或选择产品图/对标案例图', 'error');
      return;
    }
    setIsAnalyzingRefs(true);
    const logHandle = startRuntimeLog({
      workspace: 'sku',
      title: `AI 识图打标 (${skuReferenceImages.length}张SKU素材)`,
      model: config.agentModel,
      summary: '正在识别 SKU 产品图款式特征与对标案例维度...',
    });
    try {
      const data = await studioBridge.analyzeRefs({
        referenceImages: skuReferenceImages.map((r) =>
          toLightweightRefPayload(r)
        ),
        agentModel: config.agentModel,
        customBaseUrl:
          activeChannel.mode === 'custom_gateway'
            ? activeChannel.baseUrl
            : '',
        customApiKey:
          activeChannel.mode === 'custom_gateway'
            ? activeChannel.apiKey
            : undefined,
        customHeaders:
          activeChannel.mode === 'custom_gateway'
            ? activeChannel.customHeaders
            : undefined,
        protocol: activeChannel.protocol || 'auto',
        ossConfig: config.ossConfig,
      });

      const tagMap = new Map<string, string>();
      const roleMap = new Map<string, string>();
      const dimMap = new Map<string, CaseRefDimension[]>();
      for (const item of data.tags || []) {
        if (item.id && item.tag) {
          tagMap.set(item.id, item.tag);
        }
        if (item.id && item.prodAngleRole) {
          roleMap.set(item.id, item.prodAngleRole);
        }
        if (
          item.id &&
          Array.isArray(item.caseDimensions) &&
          item.caseDimensions.length > 0
        ) {
          dimMap.set(item.id, item.caseDimensions as CaseRefDimension[]);
        }
      }

      setSkuReferenceImages((prev) =>
        prev.map((ref) => {
          const detectedRole = roleMap.get(ref.id);
          return {
            ...ref,
            tag: tagMap.get(ref.id) || ref.tag,
            prodAngleRole:
              ref.category !== 'case' && detectedRole
                ? (detectedRole as any)
                : ref.prodAngleRole,
            caseDimensions:
              ref.category === 'case'
                ? ref.caseDimensions && ref.caseDimensions.length >= 5
                  ? ref.caseDimensions
                  : dimMap.get(ref.id) || ref.caseDimensions
                : ref.caseDimensions,
          };
        })
      );
      skuTasks.forEach((t) => {
        if (t.caseRefIds.some((id) => dimMap.has(id))) {
          dirtySkuCasePromptTaskIdsRef.current.add(t.id);
        }
      });
      finishRuntimeLogSuccess(
        logHandle,
        `已完成 SKU 工作台 ${skuReferenceImages.length} 张素材图的视觉特征与对标维度自动标注`
      );
      showToast(
        `已完成 SKU 工作台全部 ${skuReferenceImages.length} 张素材图的视觉特征与对标维度自动标注`,
        'success'
      );
    } catch (err: any) {
      const msg = err?.message || 'AI 识别素材标签失败';
      finishRuntimeLogError(logHandle, msg);
      showToast(msg, 'error');
    } finally {
      setIsAnalyzingRefs(false);
    }
  };

  const handleRemoveReference = (refId: string) => {
    const remaining = referenceImages.filter((r) => r.id !== refId);
    const remainingCases = remaining.filter((r) => r.category === 'case');
    setReferenceImages(reindexReferenceCodes(remaining));
    if (config.requirements.sharedStyleCaseId === refId) {
      setConfig((prev) => ({
        ...prev,
        requirements: {
          ...prev.requirements,
          sharedStyleCaseId: remainingCases[0]?.id || '',
          caseDeliveryMode:
            remainingCases.length === 0 &&
            prev.requirements.caseDeliveryMode === 'shared_style'
              ? 'none'
              : prev.requirements.caseDeliveryMode,
        },
      }));
    }
    setTasks((prev) =>
      prev.map((t) => ({
        ...t,
        referenceImageIds: t.referenceImageIds.filter((id) => id !== refId),
      }))
    );
  };

  const handleClearCategoryReferences = (category: 'product' | 'case') => {
    const removedIds = new Set(
      referenceImages.filter((r) => r.category === category).map((r) => r.id)
    );
    setReferenceImages((prev) =>
      reindexReferenceCodes(prev.filter((r) => r.category !== category))
    );
    if (category === 'case') {
      setConfig((prev) => ({
        ...prev,
        requirements: {
          ...prev.requirements,
          sharedStyleCaseId: '',
          caseDeliveryMode:
            prev.requirements.caseDeliveryMode === 'shared_style'
              ? 'none'
              : prev.requirements.caseDeliveryMode,
        },
      }));
    }
    setTasks((prev) =>
      prev.map((t) => ({
        ...t,
        referenceImageIds: t.referenceImageIds.filter(
          (id) => !removedIds.has(id)
        ),
      }))
    );
    showToast(
      `已清空详情页工作台全部${category === 'case' ? '参考案例图' : '产品图片'}`,
      'info'
    );
  };

  const handleRemoveSkuReference = (refId: string) => {
    setSkuReferenceImages((prev) =>
      reindexReferenceCodes(prev.filter((r) => r.id !== refId))
    );
    setSkuBatchConfig((prev) => ({
      ...prev,
      selectedProdIds: prev.selectedProdIds.filter((id) => id !== refId),
      globalCaseRefIds: prev.globalCaseRefIds.filter((id) => id !== refId),
    }));
    setSkuTasks((prev) =>
      prev.map((t) => ({
        ...t,
        productRefIds: t.productRefIds.filter((id) => id !== refId),
        caseRefIds: t.caseRefIds.filter((id) => id !== refId),
      }))
    );
  };

  const handleClearSkuCategoryReferences = (category: 'product' | 'case') => {
    const removedIds = new Set(
      skuReferenceImages.filter((r) => r.category === category).map((r) => r.id)
    );
    setSkuReferenceImages((prev) =>
      reindexReferenceCodes(prev.filter((r) => r.category !== category))
    );
    setSkuBatchConfig((prev) => ({
      ...prev,
      selectedProdIds:
        category === 'product'
          ? prev.selectedProdIds.filter((id) => !removedIds.has(id))
          : prev.selectedProdIds,
      globalCaseRefIds:
        category === 'case'
          ? prev.globalCaseRefIds.filter((id) => !removedIds.has(id))
          : prev.globalCaseRefIds,
    }));
    setSkuTasks((prev) =>
      prev.map((t) => ({
        ...t,
        productRefIds: t.productRefIds.filter((id) => !removedIds.has(id)),
        caseRefIds: t.caseRefIds.filter((id) => !removedIds.has(id)),
      }))
    );
    showToast(
      `已清空 SKU 工作台全部${category === 'case' ? '对标参考案例图 (#Case)' : '产品实拍图 (#Prod)'}`,
      'info'
    );
  };

  // Unified Agent Orchestration via studioBridge
  const handleAgentGeneratePlanAndTasks = async (
    overrideProductInfoText?: string | React.MouseEvent<HTMLButtonElement>
  ) => {
    const isMainOnly = config.requirements.taskScope === 'main_only';
    const detailProds = referenceImages.filter((r) => r.category !== 'case');
    let effectiveProductInfoText =
      typeof overrideProductInfoText === 'string'
        ? overrideProductInfoText
        : productInfoText;

    if (
      !effectiveProductInfoText.trim() &&
      !fullPlanDoc.trim() &&
      detailProds.length > 0
    ) {
      effectiveProductInfoText = `品牌与产品：${detailProds
        .map((p) => p.tag || p.name)
        .filter(Boolean)
        .join('、')} 官方正品旗舰\n核心卖点：采用自有产品真实外观造型与设计，官方严选品质保证`;
      setProductInfoText(effectiveProductInfoText);
    }

    if (
      !effectiveProductInfoText.trim() &&
      !fullPlanDoc.trim() &&
      (!isMainOnly || referenceImages.length === 0)
    ) {
      showToast(
        isMainOnly
          ? '请至少填写【产品功能卖点说明】或上传至少 1 张产品图片 (#Prod)'
          : '请至少填写【产品卖点说明】或【多屏详情页设计方案】',
        'error'
      );
      return;
    }

    const scopeLabel =
      config.requirements.taskScope === 'main_only'
        ? `仅商品主图 (${config.requirements.mainImageCount}张 · ${config.requirements.mainAspectRatio})`
        : config.requirements.taskScope === 'both'
          ? `主图+详情全套 (${config.requirements.mainImageCount}主图+${config.requirements.detailScreenCount}详情)`
          : `仅详情分屏 (${config.requirements.detailScreenCount}屏 · ${config.requirements.detailAspectRatio})`;

    setIsParsingPlan(true);
    const logHandle = startRuntimeLog({
      workspace: 'detail',
      title: `Agent 方案拆解 · ${scopeLabel}`,
      model: `${config.agentModel}${config.enableHighThinking ? ' (High)' : ''}`,
      summary: `输入参考图 ${referenceImages.length} 张，正在生成提示词、排版规划与绑定关系...`,
    });
    try {
      const data = await studioBridge.parsePlan({
        productInfoText: effectiveProductInfoText,
        existingFullPlanText: fullPlanDoc,
        referenceImages: referenceImages.map((r) => toLightweightRefPayload(r)),
        agentModel: config.agentModel,
        enableHighThinking: config.enableHighThinking,
        defaultImageSize: config.defaultImageSize,
        globalStylePrefix: config.globalStylePrefix,
        requirements: config.requirements,
        ...getActiveChannelBridgeParams(),
        ossConfig: config.ossConfig,
      });

      // Only overwrite fullPlanDoc when NOT in main_only mode (or if fullPlanDoc was completely empty),
      // so generating main images never wipes an existing 10-screen detail page document!
      if (
        data.generatedFullPlanDoc &&
        (config.requirements.taskScope !== 'main_only' || !fullPlanDoc.trim())
      ) {
        setFullPlanDoc(data.generatedFullPlanDoc);
      }

      if (Array.isArray(data.tasks) && data.tasks.length > 0) {
        if (Array.isArray((data as any).analyzedCaseScreens)) {
          const dnaMap = new Map<string, any>(
            ((data as any).analyzedCaseScreens as any[]).map((s) => [s.id, s])
          );
          setReferenceImages((prev) =>
            prev.map((r) => {
              const hit = dnaMap.get(r.id);
              if (!hit) return r;
              return {
                ...r,
                tag: hit.tag || r.tag,
                extractedLayoutDna:
                  hit.extractedLayoutDna || r.extractedLayoutDna,
                detectedSubScreens:
                  Array.isArray(hit.subScreens) && hit.subScreens.length > 0
                    ? hit.subScreens
                    : r.detectedSubScreens,
              };
            })
          );
        }
        const detailCases = referenceImages.filter((r) => r.category === 'case');
        const nextUnifiedSpec =
          data.unifiedVisualSpec?.trim() ||
          deriveUnifiedVisualSpecFromCases(
            detailCases,
            config.globalStylePrefix,
            effectiveProductInfoText
          );
        if (nextUnifiedSpec) {
          setConfig((prev) => ({
            ...prev,
            requirements: {
              ...prev.requirements,
              unifiedVisualSpec: nextUnifiedSpec,
            },
          }));
        }
        setTasks(data.tasks);
        // Reset view mode and filters so newly generated main_only or detail tasks are immediately visible
        setViewMode('cards');
        setLayerFilter('all');
        setStatusFilter('all');
        const summaryMsg =
          data.campaignSummary ||
          (isMainOnly
            ? `已生成 ${data.tasks.length} 张高点击商品主图方案（含排版规划与参考图绑定）。`
            : `已生成完整设计方案并拆解出 ${data.tasks.length} 张生图任务（含完整文案排版规划与产品图/案例图分配）。`);
        setCampaignSummary(summaryMsg);
        finishRuntimeLogSuccess(
          logHandle,
          `成功拆解 ${data.tasks.length} 个任务卡片 · ${summaryMsg}`
        );
        showToast(
          isMainOnly
            ? `Agent 编排完成：共生成 ${data.tasks.length} 张商品主图任务`
            : `Agent 编排完成：共生成 ${data.tasks.length} 个分屏任务`,
          'success'
        );
      } else {
        throw new Error('未能从方案中生成有效任务列表，请检查输入内容或模型响应格式');
      }
    } catch (err: any) {
      const errMsg = err?.message || 'Agent 生成设计方案失败';
      finishRuntimeLogError(
        logHandle,
        errMsg,
        `执行「${scopeLabel}」拆解失败`
      );
      showToast(`${errMsg}（可点击顶栏「日志」查看完整原因）`, 'error');
    } finally {
      setIsParsingPlan(false);
    }
  };

  // Helper to adapt a task's visualPrompt and referenceImageIds when switching between 'static' and 'dynamic'
  const adaptTaskForLayerType = (
    task: ScreenTask,
    targetLayer: ScreenLayerType
  ): ScreenTask => {
    const allProds = referenceImages.filter((r) => r.category !== 'case');
    const skuProds = allProds.filter((r) => r.isCommonAsset === false);
    const commonProds = allProds.filter((r) => r.isCommonAsset === true);
    const primarySkuProd = skuProds[0] || allProds[0];

    let nextRefIds = [...task.referenceImageIds];
    let nextPrompt = (task.visualPrompt || '').trim();

    if (targetLayer === 'dynamic') {
      // 1. Ensure primary SKU pattern image (#Prod-1) is bound so redraw renders the actual pattern
      if (primarySkuProd && !nextRefIds.includes(primarySkuProd.id)) {
        nextRefIds = [primarySkuProd.id, ...nextRefIds];
      }

      // 2. Strip static "neutral shell / no front pattern" restrictions and inject dynamic SKU pattern instruction
      nextPrompt = nextPrompt
        .replace(/【🔒静态通用公模规范[^】]*】/g, '')
        .replace(
          /[，,、。；;\s]*(?:采用纯白单耳或中性白壳侧背视角|采用中性纯白\/基础公模侧背视角|中性白壳侧背视角|不露具体正面图案|不露出具体正面图案|不露出具体正面定制印花图案|不露出特定款式正面定制印花|不露任何特定款式印花|去印花通用公模)[，,、。；;\s]*/gi,
          '，正面清晰展现当前主推款商品的真实配色与专属定制印花图案，'
        )
        .replace(/，+/g, '，')
        .trim();

      if (!nextPrompt.includes('⚡动态款式专属表现')) {
        const refHint = primarySkuProd
          ? `（严格参考 #${primarySkuProd.code} ${primarySkuProd.tag}）`
          : '';
        nextPrompt = `${nextPrompt}\n【⚡动态款式专属表现：画面中的产品本体须正面或黄金视角清晰展示当前款式专属配色与定制印花图案${refHint}，严禁画成空白无印花的普通公模】`.trim();
      }
    } else {
      // Switching to 'static' universal screen
      if (commonProds.length > 0 && skuProds.length > 0) {
        const skuIdSet = new Set(skuProds.map((r) => r.id));
        const filtered = nextRefIds.filter((id) => !skuIdSet.has(id));
        nextRefIds = Array.from(new Set([commonProds[0].id, ...filtered]));
      }

      nextPrompt = nextPrompt
        .replace(/【⚡动态款式专属表现[^】]*】/g, '')
        .replace(
          /，?正面清晰展现当前主推款商品的真实配色与专属定制印花图案，?/g,
          ''
        )
        .trim();

      if (!nextPrompt.includes('🔒静态通用公模规范')) {
        nextPrompt = `${nextPrompt}\n【🔒静态通用公模规范：采用中性纯白/基础公模侧背视角或内部结构特写，不露出具体正面定制印花图案，确保多款式100%通用】`.trim();
      }
    }

    return {
      ...task,
      layerType: targetLayer,
      referenceImageIds: nextRefIds,
      visualPrompt: nextPrompt,
    };
  };

  const handleToggleTaskLayerType = (task: ScreenTask) => {
    const nextLayer: ScreenLayerType =
      task.layerType === 'dynamic' ? 'static' : 'dynamic';
    const adapted = adaptTaskForLayerType(task, nextLayer);
    updateTask(task.id, {
      layerType: adapted.layerType,
      referenceImageIds: adapted.referenceImageIds,
      visualPrompt: adapted.visualPrompt,
    });

    if (nextLayer === 'dynamic') {
      showToast(
        `第 ${task.screenNumber} 屏已解锁切换为「⚡动态款式屏」：已自动移除“去印花公模”限制并补绑主推产品图，现在点「重绘」或「AI润色」即按动态款式生成！`,
        'success'
      );
    } else {
      showToast(
        `第 ${task.screenNumber} 屏已切换为「🔒静态通用屏」：已注入“去印花中性公模视角”规范，点「重绘」将生成多款通用画面。`,
        'info'
      );
    }
  };

  // Polish single screen prompt via studioBridge (aware of current layerType: dynamic vs static & bound #Case dimensions)
  const handlePolishPrompt = async (task: ScreenTask) => {
    setPolishingTaskId(task.id);
    try {
      const boundProds = referenceImages.filter(
        (r) => task.referenceImageIds.includes(r.id) && r.category !== 'case'
      );
      const boundCases = referenceImages.filter(
        (r) => task.referenceImageIds.includes(r.id) && r.category === 'case'
      );
      const boundRefSummary = [
        ...boundProds.map((r) => `产品图 #${r.code}(${r.tag})`),
        ...boundCases.map(
          (c) =>
            `参考案例 #${c.code}(${c.tag}${c.isLockBaseSwap ? ' · 🔒锁底换款' : ''} · 提取维度:${(
              c.caseDimensions || ['style', 'structure']
            ).join('/')}${c.caseCustomRule?.trim() ? ` · +约束:${c.caseCustomRule.trim()}` : ''})`
        ),
      ]
        .filter(Boolean)
        .join('；');

      const dynamicBenchmarkCase =
        boundCases.length > 0
          ? buildClientCaseDimensionDirective(
              boundCases,
              config.requirements.unifiedVisualSpec,
              'detail'
            )
          : task.benchmarkCase;

      const data = await studioBridge.polishPrompt({
        title: task.title,
        benchmarkCase: dynamicBenchmarkCase,
        typographyPlan: task.typographyPlan,
        currentPrompt: task.visualPrompt,
        textMode: task.textMode,
        layerType: task.layerType,
        productInfoText,
        boundRefSummary,
        globalStylePrefix: config.globalStylePrefix,
        agentModel: config.agentModel,
        ...getActiveChannelBridgeParams(),
      });

      if (data.polishedPrompt) {
        updateTask(task.id, {
          visualPrompt: data.polishedPrompt,
          benchmarkCase: dynamicBenchmarkCase,
        });
        showToast(
          `第 ${task.screenNumber} 屏已按「${
            task.layerType === 'dynamic' ? '⚡动态款式屏' : '🔒静态通用屏'
          }」及当前对标图锁定维度完成 AI 提示词润色`,
          'success'
        );
      }
    } catch (err: any) {
      showToast(err?.message || '提示词润色失败', 'error');
    } finally {
      setPolishingTaskId(null);
    }
  };

  const updateTask = (taskId: string, patch: Partial<ScreenTask>) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, ...patch } : t))
    );
  };

  const toggleTaskReferenceImage = (taskId: string, refId: string) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== taskId) return t;
        const exists = t.referenceImageIds.includes(refId);
        const nextRefs = exists
          ? t.referenceImageIds.filter((id) => id !== refId)
          : [...t.referenceImageIds, refId];
        const boundCaseItems = referenceImages.filter(
          (r) => nextRefs.includes(r.id) && r.category === 'case'
        );
        const subScreenPrefixMatch = (t.benchmarkCase || '').match(
          /^【对标来源：[^】]+】\s*/
        );
        const subScreenPrefix = subScreenPrefixMatch
          ? subScreenPrefixMatch[0]
          : '';
        return {
          ...t,
          referenceImageIds: nextRefs,
          benchmarkCase:
            boundCaseItems.length > 0
              ? `${subScreenPrefix}${buildClientCaseDimensionDirective(
                  boundCaseItems,
                  config.requirements.unifiedVisualSpec,
                  'detail'
                )}`
              : t.benchmarkCase,
        };
      })
    );
  };

  const generateSingleTaskImage = async (task: ScreenTask): Promise<boolean> => {
    updateTask(task.id, { status: 'generating', errorMessage: undefined });

    const allDetailProds = referenceImages.filter((r) => r.category !== 'case');
    const enabledDetailProds = filterEnabledProds(allDetailProds);
    const activeDetailProdPool =
      enabledDetailProds.length > 0 ? enabledDetailProds : allDetailProds;
    const allDetailCases = referenceImages.filter((r) => r.category === 'case');

    // Bound #Prod items (always included as sole authority for product identity & appearance, capped by qualityGuardEngine)
    const boundProdItems = referenceImages.filter(
      (r) => task.referenceImageIds.includes(r.id) && r.category !== 'case'
    );
    const rawEffectiveProdItems =
      boundProdItems.length > 0
        ? boundProdItems
        : smartPickComplementaryProds(
            activeDetailProdPool,
            task.moduleType || `${task.title} ${task.visualPrompt}`,
            task.moduleType === 'series_matrix' ? 4 : 2
          );
    const qg: QualityGuardGlobalConfig = {
      ...DEFAULT_QUALITY_GUARD_CONFIG,
      ...(config.qualityGuardConfig || {}),
    };

    const effectiveProdItems =
      qg.strictSingleSkuProdCap !== false
        ? limitAndOrderTaskProdsForRender(
            rawEffectiveProdItems.map((p) => p.id),
            allDetailProds,
            {
              isLockedRefine: Boolean(
                qg.lockRefineHighWeightAnchor !== false &&
                  task.lockResultAsRef &&
                  task.resultImageUrl
              ),
              moduleOrTitleHint: `${task.moduleType || ''} ${task.title} ${task.visualPrompt}`,
            }
          )
        : rawEffectiveProdItems.slice(0, 6);

    // Bound #Case items (used for dimension analysis directive & lock-base swap if explicitly requested)
    const boundCaseItems = referenceImages.filter(
      (r) => task.referenceImageIds.includes(r.id) && r.category === 'case'
    );
    const fallbackScreenCase =
      allDetailCases.length > 0
        ? allDetailCases[
            Math.min(
              Math.max(0, (task.screenNumber || 1) - 1),
              allDetailCases.length - 1
            )
          ]
        : undefined;
    const analysisCases =
      boundCaseItems.length > 0
        ? boundCaseItems
        : fallbackScreenCase
          ? [fallbackScreenCase]
          : [];

    // Resolve Detail Studio 3-State Case Delivery Mode:
    // 1. Task-level override ('none' | 'shared_style' | 'lock_base_swap')
    // 2. Explicit lock-base swap toggle on the bound #Case item
    // 3. Global config.requirements.caseDeliveryMode (default: 'none' -> do NOT pass competitor #Case images!)
    const globalDeliveryMode: DetailCaseDeliveryMode =
      config.requirements.caseDeliveryMode || 'none';
    const effectiveDeliveryMode: DetailCaseDeliveryMode =
      qg.lockRefineHighWeightAnchor !== false &&
      task.lockResultAsRef &&
      task.resultImageUrl
        ? 'none'
        : task.caseDeliveryOverride && task.caseDeliveryOverride !== 'inherit'
          ? task.caseDeliveryOverride
          : boundCaseItems.some((c) => isExplicitLockBaseSwapCase(c))
            ? 'lock_base_swap'
            : globalDeliveryMode;

    // Assemble referenceImages to pass to the image generation model
    const prodPayloads = effectiveProdItems.map((r) =>
      toLightweightRefPayload(r)
    );
    let casePayloads: ReturnType<typeof toLightweightRefPayload>[] = [];

    if (effectiveDeliveryMode === 'shared_style') {
      const sharedStyleCase =
        allDetailCases.find(
          (c) => c.id === config.requirements.sharedStyleCaseId
        ) ||
        allDetailCases.find((c) => c.isSharedStyleRef) ||
        allDetailCases[0];
      if (sharedStyleCase) {
        casePayloads = [
          {
            ...toLightweightRefPayload(sharedStyleCase),
            isSharedStyleRef: true,
            isLockBaseSwap: false,
          },
        ];
      }
    } else if (effectiveDeliveryMode === 'lock_base_swap') {
      const lockCases =
        boundCaseItems.length > 0
          ? boundCaseItems
          : fallbackScreenCase
            ? [fallbackScreenCase]
            : [];
      casePayloads = lockCases.map((c) => ({
        ...toLightweightRefPayload(c),
        isLockBaseSwap: true,
        isSharedStyleRef: false,
      }));
    } else {
      // 'none' (default): Do NOT pass per-screen competitor #Case original images to the image model!
      casePayloads = [];
    }

    const refsToSend = [...prodPayloads, ...casePayloads];

    const effectiveUnifiedSpec =
      config.requirements.unifiedVisualSpec?.trim() ||
      deriveUnifiedVisualSpecFromCases(
        allDetailCases,
        config.globalStylePrefix,
        productInfoText
      );

    const customConstraints = extractIndependentCaseCustomRules(analysisCases);

    const deliveryModeLabel =
      effectiveDeliveryMode === 'lock_base_swap'
        ? '逐屏锁底换款(传本屏#Case)'
        : effectiveDeliveryMode === 'shared_style'
          ? '共用单张风格图(仅参风格/色调/质感)'
          : '不传案例原图(默认重策划)';

    const taskLabel =
      task.screenCategory === 'main'
        ? `主图 #${task.screenNumber} (${task.title})`
        : `第 ${task.screenNumber} 屏 (${task.title})`;

    const logHandle = startRuntimeLog({
      workspace: 'detail',
      title: `生图渲染 · ${taskLabel}`,
      model: config.imageModel,
      summary: `比例 ${task.aspectRatio} · ${task.imageSize} · 传图策略:${deliveryModeLabel} · 传入素材 ${refsToSend.length} 张 (#Prod:${prodPayloads.length}, #Case:${casePayloads.length})`,
    });

    const rawEffectivePrompt = (
      task.visualPrompt ||
      task.copywriting ||
      task.title ||
      '高质感商业电商产品摄影，主体突出，光影自然柔和，8K超清细节'
    ).trim();
    const effectivePrompt =
      qg.autoSanitizePromptCodes !== false
        ? sanitizeVisualPromptForRender(rawEffectivePrompt, allDetailProds)
        : rawEffectivePrompt;
    const sanitizedCopywriting =
      qg.autoSanitizePromptCodes !== false
        ? sanitizeCopywritingForRender(task.copywriting || '')
        : task.copywriting || '';
    const sanitizedTypographyPlan =
      qg.autoSanitizePromptCodes !== false
        ? sanitizeCopywritingForRender(
            task.typographyPlan || task.copywriting || ''
          )
        : task.typographyPlan || task.copywriting || '';

    const dynamicBenchmarkCase =
      analysisCases.length > 0
        ? buildRenderStageBenchmarkSummary({
            analysisCases,
            existingBenchmarkCase: task.benchmarkCase,
            unifiedVisualSpec: effectiveUnifiedSpec,
            deliveryMode: effectiveDeliveryMode,
          })
        : task.benchmarkCase;

    const basePromptWithPrefix =
      config.globalStylePrefix &&
      !effectivePrompt.includes(config.globalStylePrefix.trim()) &&
      !(
        effectiveUnifiedSpec &&
        effectiveUnifiedSpec.includes(config.globalStylePrefix.trim())
      )
        ? `${config.globalStylePrefix}\n${effectivePrompt}`
        : effectivePrompt;

    const globalGuardDirectives: string[] = [];
    if (qg.enforceLightRoundedCards !== false) {
      globalGuardDirectives.push(
        '【全局UI信息卡护栏】：画面内卖点标签统一使用浅色半透明毛玻璃圆角矩形信息卡，严禁生硬黑框/深棕底框，严禁绘制3D医药胶囊颗粒。'
      );
    }
    if (qg.customNegativePrompt?.trim()) {
      globalGuardDirectives.push(
        `【全局负向禁用词（严禁出现）】：${qg.customNegativePrompt.trim()}`
      );
    }
    const promptWithStylePrefix =
      globalGuardDirectives.length > 0
        ? `${basePromptWithPrefix}\n${globalGuardDirectives.join('\n')}`
        : basePromptWithPrefix;

    try {
      const data = await studioBridge.generateImage({
        prompt: promptWithStylePrefix,
        copywriting: sanitizedCopywriting,
        typographyPlan: sanitizedTypographyPlan,
        benchmarkCase: dynamicBenchmarkCase,
        unifiedVisualSpec: effectiveUnifiedSpec,
        caseDeliveryMode: effectiveDeliveryMode,
        moduleType: task.moduleType || 'selling_point',
        userNote: task.userNote || '',
        sourceReplicaImageUrl: task.sourceReplicaImageUrl,
        lockedResultImageUrl:
          task.lockResultAsRef && task.resultImageUrl
            ? task.resultImageUrl
            : undefined,
        refineInstruction:
          task.lockResultAsRef && task.refineInstruction
            ? task.refineInstruction
            : undefined,
        printThemeConfig: task.printThemeConfig,
        customConstraints,
        studioContext: 'detail',
        textMode: task.textMode || config.requirements.textMode,
        layerType: task.layerType,
        title: task.title,
        referenceImages:
          effectiveDeliveryMode === 'none' ? prodPayloads : refsToSend,
        imageModel: config.imageModel,
        aspectRatio: task.aspectRatio || config.requirements.detailAspectRatio,
        imageSize: task.imageSize || config.defaultImageSize,
        ...getActiveChannelBridgeParams(),
        ossConfig: config.ossConfig,
      });

      if (!data.imageUrl) {
        throw new Error('生图接口未返回有效图片');
      }

      const nowDate = new Date();
      const nowStr = nowDate.toLocaleTimeString('zh-CN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      const fullDateStr = `${nowDate.toLocaleDateString('zh-CN')} ${nowStr}`;

      setTasks((prev) =>
        prev.map((t) => {
          if (t.id !== task.id) return t;
          const seededHistory =
            t.historyImages.length === 0 && t.resultImageUrl
              ? [
                  {
                    url: t.resultImageUrl,
                    ossUrl: t.resultOssUrl,
                    cloudUrls: t.resultCloudUrls,
                    timestamp: t.generatedAt || '初版',
                    promptSnapshot: t.visualPrompt,
                    aspectRatio: t.aspectRatio,
                    imageSize: t.imageSize,
                  },
                ]
              : t.historyImages;
          const nextHistory = [
            {
              url: data.imageUrl,
              ossUrl: data.ossUrl,
              cloudUrls: data.ossUrl
                ? { [activeStorageProvider]: data.ossUrl }
                : undefined,
              timestamp: nowStr,
              promptSnapshot: t.visualPrompt,
              aspectRatio: t.aspectRatio,
              imageSize: t.imageSize,
            },
            ...seededHistory.filter((h) => h.url !== data.imageUrl),
          ].slice(0, 8);

          return {
            ...t,
            status: 'completed',
            resultImageUrl: data.imageUrl,
            resultOssUrl: data.ossUrl,
            resultCloudUrls: data.ossUrl
              ? mergeCloudUrlsForProvider(
                  t.resultOssUrl,
                  t.resultCloudUrls,
                  activeStorageProvider,
                  data.ossUrl
                )
              : t.resultCloudUrls,
            resultTextNote: data.textNote,
            durationMs: data.durationMs,
            generatedAt: nowStr,
            errorMessage: undefined,
            historyImages: nextHistory,
          };
        })
      );

      // Automatically record into Asset Library Generation Records
      const activeBatch = activeDetailBatchIdRef.current;
      const productShortName =
        productInfoText.trim().split(/[\n，,。]/)[0]?.slice(0, 18) ||
        '详情页分屏';
      const newRecord: GenerationRecordItem = {
        id: `gen-detail-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        batchId: activeBatch?.id || `detail-single-${Date.now()}`,
        batchTitle:
          activeBatch?.title ||
          `详情页单屏生成 · 第${task.screenNumber}屏 (${productShortName})`,
        sourceStudio: 'detail_studio',
        itemIndex: task.screenNumber,
        title: `第${task.screenNumber}屏 · ${task.title}`,
        promptSnapshot: task.visualPrompt,
        copywriting: task.copywriting,
        aspectRatio: task.aspectRatio,
        imageSize: task.imageSize,
        imageUrl: data.imageUrl,
        ossUrl: data.ossUrl,
        cloudUrls: data.ossUrl
          ? { [activeStorageProvider]: data.ossUrl }
          : undefined,
        createdAt: fullDateStr,
        timestamp: Date.now(),
        isViewed: false,
      };
      setGenerationRecords((prev) => [newRecord, ...prev]);
      saveGenerationRecordToDb(newRecord);

      finishRuntimeLogSuccess(
        logHandle,
        `成图已生成 (${task.aspectRatio} · ${task.imageSize})${data.ossUrl ? ` · 已同步 ${activeStorageShort}` : ''}`,
        data.durationMs
      );
      return true;
    } catch (err: any) {
      const msg = err?.message || '生成失败';
      updateTask(task.id, {
        status: 'error',
        errorMessage: msg,
      });
      finishRuntimeLogError(logHandle, msg, `${taskLabel} 生图失败`);
      showToast(`第 ${task.screenNumber} 屏生图异常：${msg}`, 'error');
      return false;
    }
  };

  // Batch generate images with concurrency control (supports custom task list & static screen lock protection)
  const handleStartBatchGenerate = async (
    onlyUnfinished = false,
    onlyDynamic = false,
    customTargetTasks?: ScreenTask[]
  ) => {
    if (!customTargetTasks && tasks.length === 0) {
      showToast(
        '当前暂无分屏生图任务，请先在左侧点击「生成方案与分屏任务」或点击「+ 新增详情屏」。',
        'info'
      );
      return;
    }
    let skippedLockedStaticCount = 0;
    const targetTasks =
      customTargetTasks ||
      tasks.filter((t) => {
        if (onlyDynamic && t.layerType !== 'dynamic') return false;
        if (onlyUnfinished && t.status === 'completed') return false;
        if (
          !onlyDynamic &&
          !onlyUnfinished &&
          lockCompletedStaticScreens &&
          t.layerType === 'static' &&
          t.status === 'completed'
        ) {
          skippedLockedStaticCount += 1;
          return false;
        }
        return true;
      });

    if (targetTasks.length === 0) {
      showToast(
        onlyDynamic
          ? '当前没有待生成的【动态款式屏】任务。'
          : skippedLockedStaticCount > 0
            ? `静态通用屏 (${skippedLockedStaticCount}屏) 已开启锁定保护无需重复生成；如需重绘请先关闭右上角「静态已出图保护」或单屏点击重绘。`
            : '所有分屏均已生成完毕，如需重绘可点击「全部重新生成」或单屏重绘。',
        'info'
      );
      return;
    }

    setIsBatchRunning(true);
    abortBatchRef.current = false;
    const productShortName =
      productInfoText.trim().split(/[\n，,。]/)[0]?.slice(0, 18) ||
      '详情页批次';
    activeDetailBatchIdRef.current = {
      id: `detail-batch-${Date.now()}`,
      title: `详情页批量生图 (${targetTasks.length}屏) · ${productShortName}`,
    };

    const concurrency = Math.max(
      1,
      Math.min(6, activeChannel.concurrency || 2)
    );
    const queue = [...targetTasks];
    let successCount = 0;

    const worker = async () => {
      while (queue.length > 0 && !abortBatchRef.current) {
        const queuedItem = queue.shift();
        if (!queuedItem) break;
        // Read latest state from tasksRef in case user edited prompts/bindings while task was queued
        const latestTask =
          tasksRef.current.find((t) => t.id === queuedItem.id) || queuedItem;
        const ok = await generateSingleTaskImage(latestTask);
        if (ok) successCount += 1;
      }
    };

    const workers = Array.from(
      { length: Math.min(concurrency, queue.length) },
      () => worker()
    );
    await Promise.all(workers);

    activeDetailBatchIdRef.current = null;
    setIsBatchRunning(false);
    if (abortBatchRef.current) {
      showToast(`已停止批量生图队列，已完成 ${successCount} 屏`, 'info');
    } else {
      const skipNote =
        skippedLockedStaticCount > 0
          ? `（已自动保护跳过 ${skippedLockedStaticCount} 屏已生成的静态通用屏）`
          : '';
      showToast(
        `批量生图执行完毕：成功生成 ${successCount} / ${targetTasks.length} 张高清成品图${skipNote}`,
        successCount > 0 ? 'success' : 'error'
      );
    }
  };

  const handleStopBatch = () => {
    abortBatchRef.current = true;
  };

  // Open Interactive "Adapt to New SKU" Modal
  const handleOpenAdaptSkuModal = () => {
    const prodImgs = referenceImages.filter((r) => r.category === 'product');
    const skuPatternImgs = prodImgs.filter((r) => r.isCommonAsset === false);
    const defaultSelected =
      skuPatternImgs.length > 0
        ? skuPatternImgs.map((r) => r.id)
        : prodImgs.slice(0, 1).map((r) => r.id);
    setSelectedSkuImageIds(defaultSelected);
    setShowAdaptSkuModal(true);
  };

  const toggleSelectSkuModalImage = (refId: string) => {
    setSelectedSkuImageIds((prev) =>
      prev.includes(refId)
        ? prev.filter((id) => id !== refId)
        : [...prev, refId]
    );
  };

  // Execute 1-Click Adapt Dynamic Screens (Screens 1~3) to a Newly Selected SKU Pattern Image
  const handleExecuteAdaptNewSku = async (autoGenerateDynamic = false) => {
    const prodImgs = referenceImages.filter((r) => r.category === 'product');
    const chosenImgs = prodImgs.filter((r) =>
      selectedSkuImageIds.includes(r.id)
    );
    const imagesToInspect =
      chosenImgs.length > 0 ? chosenImgs : prodImgs.slice(0, 2);

    const dynamicTasks = tasks.filter((t) => t.layerType === 'dynamic');
    if (imagesToInspect.length === 0 || dynamicTasks.length === 0) {
      showToast(
        '请至少勾选 1 张代表新款图案的产品图，且确保存在动态款式屏任务',
        'error'
      );
      return;
    }

    setIsAdaptingSku(true);
    try {
      const data = await studioBridge.adaptNewSku({
        skuNameHint: skuNameHintInput.trim(),
        productInfoText,
        skuPatternImages: imagesToInspect.map((img) =>
          toLightweightRefPayload(img)
        ),
        dynamicTasks: dynamicTasks.map((t) => ({
          id: t.id,
          screenNumber: t.screenNumber,
          title: t.title,
          sectionType: t.sectionType,
          copywriting: t.copywriting,
          typographyPlan: t.typographyPlan,
          visualPrompt: t.visualPrompt,
        })),
        agentModel: config.agentModel,
        ...getActiveChannelBridgeParams(),
        ossConfig: config.ossConfig,
      });

      const updateMap = new Map<string, any>();
      for (const u of data.updatedTasks || []) {
        if (u.id) updateMap.set(u.id, u);
      }

      const caseRefIdsSet = new Set(
        referenceImages.filter((r) => r.category === 'case').map((r) => r.id)
      );
      const selectedSkuIds = imagesToInspect.map((r) => r.id);

      const nextTasks = tasks.map((t) => {
        const patch = updateMap.get(t.id);
        if (!patch) return t;

        // If autoReplaceDynamicRefs is enabled, update dynamic product refs to the newly selected SKU image(s) while keeping #Case refs intact, skipping multi-sku overview screens
        let nextRefIds = t.referenceImageIds;
        const isMultiSkuOverview = /多款|合集|矩阵|全家福|多色|款式合集/.test(
          `${t.title} ${t.sectionType} ${t.visualPrompt}`
        );
        if (autoReplaceDynamicRefs && !isMultiSkuOverview) {
          const existingCaseRefs = t.referenceImageIds.filter((id) =>
            caseRefIdsSet.has(id)
          );
          nextRefIds = Array.from(
            new Set([...selectedSkuIds, ...existingCaseRefs])
          );
        }

        return {
          ...t,
          title: patch.title || t.title,
          copywriting: patch.copywriting || t.copywriting,
          typographyPlan: patch.typographyPlan || t.typographyPlan,
          visualPrompt: patch.visualPrompt || t.visualPrompt,
          referenceImageIds: nextRefIds,
        };
      });

      setTasks(nextTasks);

      if (data.detectedSkuTheme) {
        setCampaignSummary(
          `【同模换款裂变完成】${data.detectedSkuTheme}（仅更新前 ${dynamicTasks.length} 屏动态屏，第 4~10 屏静态公模屏保持 100% 锁定复用）`
        );
      }
      setShowAdaptSkuModal(false);
      setViewMode('cards');
      setLayerFilter('dynamic');

      if (autoGenerateDynamic) {
        showToast(
          `已完成 ${dynamicTasks.length} 个动态屏提示词改写，正在自动批量生成新款动态屏...`,
          'info'
        );
        const updatedDynamicTasks = nextTasks.filter(
          (t) => t.layerType === 'dynamic'
        );
        await handleStartBatchGenerate(false, true, updatedDynamicTasks);
      } else {
        showToast(
          `已根据新款式自动改写 ${dynamicTasks.length} 个动态屏提示词，静态屏保持复用！`,
          'success'
        );
      }
    } catch (err: any) {
      showToast(err?.message || '换款动态屏改写失败', 'error');
    } finally {
      setIsAdaptingSku(false);
    }
  };

  // Sync requirements to all tasks in Detail Studio (always enforcing detailAspectRatio, screen count resize, textMode, and dynamic/static prods)
  const handleSyncRequirementsToTasks = () => {
    const enableStatic = config.requirements.enableStaticLayering !== false;
    const targetRatio = config.requirements.detailAspectRatio;
    const targetCount = Math.max(
      1,
      Math.min(20, config.requirements.detailScreenCount || 10)
    );
    const detailProds = referenceImages.filter((r) => r.category !== 'case');

    if (tasks.length === 0) {
      const created = buildDetailTasksFromCasePool(
        targetCount,
        referenceImages,
        config.requirements.unifiedVisualSpec
      );
      setTasks(created);
      showToast(
        `已在右侧新建 ${created.length} 个详情分屏任务卡（比例 ${targetRatio} · ${config.defaultImageSize}）`,
        'success'
      );
      return;
    }

    let baseTasks = [...tasks];
    if (baseTasks.length < targetCount) {
      const neededPool = buildDetailTasksFromCasePool(
        targetCount,
        referenceImages,
        config.requirements.unifiedVisualSpec
      );
      baseTasks = [...baseTasks, ...neededPool.slice(baseTasks.length)];
    } else if (baseTasks.length > targetCount) {
      baseTasks = baseTasks.slice(0, targetCount);
    }

    const synced = baseTasks.map((t, idx) => {
      const screenNum = idx + 1;
      const targetLayer: ScreenLayerType = !enableStatic
        ? 'dynamic'
        : screenNum <= 3
          ? 'dynamic'
          : 'static';
      const didLayerTypeChange = t.layerType !== targetLayer;

      const normalizedTask: ScreenTask = {
        ...t,
        screenNumber: screenNum,
        screenCategory: 'detail' as const,
        title:
          (t.title || '')
            .replace(
              /^(第\s*\d+\s*屏\s*[·•-]\s*)?主图\s*\d+\s*[·•-]?\s*/i,
              `第${screenNum}屏·`
            )
            .trim() || t.title,
      };

      const adapted = didLayerTypeChange
        ? adaptTaskForLayerType(normalizedTask, targetLayer)
        : normalizedTask;

      // Only re-select #Prod if layerType changed, or if existing bound #Prod is empty / conflicts with targetLayer
      let nextRefs = adapted.referenceImageIds;
      let boundProds = referenceImages.filter(
        (r) => adapted.referenceImageIds.includes(r.id) && r.category !== 'case'
      );
      const hasConflictingScope =
        targetLayer === 'static'
          ? boundProds.some((p) => !p.isCommonAsset) &&
            detailProds.some((p) => Boolean(p.isCommonAsset))
          : boundProds.length > 0 &&
            boundProds.every((p) => Boolean(p.isCommonAsset)) &&
            detailProds.some((p) => !p.isCommonAsset);

      if (
        detailProds.length > 0 &&
        (didLayerTypeChange || boundProds.length === 0 || hasConflictingScope)
      ) {
        const boundCases = referenceImages.filter(
          (r) => adapted.referenceImageIds.includes(r.id) && r.category === 'case'
        );
        const bestProds = selectBestProdRefsForScreen(
          screenNum,
          `${adapted.title} ${adapted.copywriting}`,
          detailProds,
          targetLayer
        );
        boundProds = bestProds;
        nextRefs = [...bestProds.map((p) => p.id), ...boundCases.map((c) => c.id)];
      }

      // Synchronize aspect ratio, prodTagSummary, and text mode in visualPrompt
      let updatedPrompt = adapted.visualPrompt || '';
      updatedPrompt = updatedPrompt
        .replace(/（\d+:\d+）/g, `（${targetRatio}）`)
        .replace(/竖版完整海报\([^\)]+\)/g, `竖版完整海报（${targetRatio}）`);

      if (boundProds.length > 0) {
        const prodTagSummary = boundProds
          .map((p) => `#${p.code}(${p.tag || p.name})`)
          .join('、');
        updatedPrompt = updatedPrompt.replace(
          /（产品身份唯一权威源：[^）]+）/,
          `（产品身份唯一权威源：${prodTagSummary}）`
        );
      }

      if (config.requirements.textMode === 'without_text') {
        const noTextNotice =
          '【纯视觉留白底图模式】：按上述信息分区预留干净的顶部标题留白区与底部卖点留白区，画面中不生成任何文字或UI线框。';
        if (
          /【(?:屏内中文排版直出指令|🔒锁底换款排版指令|画面文案排版)[^】]*】：[^\n]+/.test(
            updatedPrompt
          )
        ) {
          updatedPrompt = updatedPrompt.replace(
            /【(?:屏内中文排版直出指令|🔒锁底换款排版指令|画面文案排版)[^】]*】：[^\n]+/,
            noTextNotice
          );
        } else if (!updatedPrompt.includes('【纯视觉留白底图模式】')) {
          updatedPrompt = `${updatedPrompt}\n${noTextNotice}`;
        }
      } else if (config.requirements.textMode === 'with_text') {
        if (/【纯视觉留白底图模式】：[^\n]+/.test(updatedPrompt)) {
          const copyLines = (adapted.copywriting || '')
            .split('\n')
            .map((l) => l.trim())
            .filter(Boolean);
          const headline = copyLines[0] || adapted.title || '核心爆款卖点';
          const subtitle = copyLines.slice(1).join(' | ');
          const textNotice = subtitle
            ? `【屏内中文排版直出指令（文案与参数以自有资料为准，绝不印刷构图术语）】：顶部印制官方品牌标头；核心大字印制主标「${headline}」；副标与卖点条印制「${subtitle}」。`
            : `【屏内中文排版直出指令（文案与参数以自有资料为准，绝不印刷构图术语）】：顶部印制官方品牌标头；核心大字印制主标「${headline}」；副标印制卖点说明。`;
          updatedPrompt = updatedPrompt.replace(
            /【纯视觉留白底图模式】：[^\n]+/,
            textNotice
          );
        }
      }

      return {
        ...adapted,
        screenCategory: 'detail' as const,
        aspectRatio: targetRatio,
        imageSize: config.defaultImageSize,
        textMode: config.requirements.textMode,
        referenceImageIds: nextRefs,
        visualPrompt: updatedPrompt,
      };
    });

    setTasks(synced);
    showToast(
      `已将屏数 (${targetCount}屏)、比例 (${targetRatio})、分辨率 (${config.defaultImageSize})、「${
        config.requirements.textMode === 'with_text'
          ? '有文字海报'
          : '无文字留白底图'
      }」及「${
        enableStatic ? '动静分层公模' : '全屏专属款式(无静态屏)'
      }」同步至全部 ${synced.length} 个分屏任务`,
      'success'
    );
  };

  // Synchronize Tab 02 planning document / copywriting non-destructively to existing ScreenTasks
  const handleSyncPlanDocToExistingTasks = () => {
    if (tasks.length === 0) {
      showToast(
        '右侧画布暂无分屏任务卡，请先点击底部「Agent 生成/拆解」生成任务',
        'info'
      );
      return;
    }
    const updated = syncPlanDocToExistingTasks(
      tasks,
      productInfoText,
      fullPlanDoc,
      referenceImages,
      config.requirements.unifiedVisualSpec
    );
    setTasks(updated);
    showToast(
      `已将策划方案与卖点文案无损同步至右侧 ${tasks.length} 张任务卡`,
      'success'
    );
  };

  const handleAddBlankTask = (
    category: 'main' | 'detail' = 'detail',
    layerType: ScreenLayerType = 'dynamic'
  ) => {
    const nextNum =
      tasks.length > 0
        ? Math.max(...tasks.map((t) => t.screenNumber)) + 1
        : 1;
    const prodRefs = referenceImages.filter((r) => r.category === 'product');
    const newTask: ScreenTask = {
      id: `screen-custom-${Date.now()}`,
      screenNumber: nextNum,
      screenCategory: category,
      layerType,
      title:
        category === 'main'
          ? `主图 ${nextNum}：【高点击商品主图】`
          : `第 ${nextNum} 屏：【自定义新增详情分屏】`,
      sectionType: category === 'main' ? '商品主图' : '自定义分屏',
      benchmarkCase: '旗舰店视觉基准',
      copywriting: '在此输入核心主标题卖点摘要',
      typographyPlan: `顶部标头：Brand Header
主标题：核心卖点大标题
副标题 / 卖点标签：核心卖点1 ｜ 核心卖点2 ｜ 核心卖点3
底部胶囊卡片：[参数亮点1] 说明文字 ｜ [参数亮点2] 说明文字`,
      visualPrompt:
        '高质感商业电商产品摄影，产品主体清晰突出，光影自然柔和，8K超清细节。',
      textMode: config.requirements.textMode,
      designNotes: '手动新增任务',
      referenceImageIds: prodRefs[0] ? [prodRefs[0].id] : [],
      aspectRatio:
        category === 'main'
          ? config.requirements.mainAspectRatio
          : config.requirements.detailAspectRatio,
      imageSize: config.defaultImageSize,
      status: 'idle',
      historyImages: [],
    };
    setTasks((prev) => [...prev, newTask]);
  };

  const handleDeleteTask = (taskId: string) => {
    setTasks((prev) =>
      prev
        .filter((t) => t.id !== taskId)
        .map((t, idx) => ({ ...t, screenNumber: idx + 1 }))
    );
  };

  const handleExportZip = async () => {
    setIsExportingZip(true);
    try {
      const presetName =
        PRESET_TEMPLATES.find((p) => p.id === selectedPresetId)?.name.split(
          ' · '
        )[0] || '电商详情页成片';
      await exportTasksAsZip(tasks, presetName, fullPlanDoc);
      showToast('ZIP 高清成片压缩包（含完整设计方案清单）已开始下载', 'success');
    } catch (err: any) {
      showToast(err?.message || '导出 ZIP 失败', 'error');
    } finally {
      setIsExportingZip(false);
    }
  };

  // ================= SKU STUDIO BATCH WORKBENCH HANDLERS =================
  const updateSkuBatchConfig = (patch: Partial<SkuBatchConfig>) => {
    setSkuBatchConfig((prev) => ({ ...prev, ...patch }));
    // Bidirectional Sync: Whenever user edits/adds/deletes sellingPointPresets in SKU Studio,
    // automatically persist them to Global Reset-Proof Defaults (config.defaultSellingPointPresets)
    if (Array.isArray(patch.sellingPointPresets)) {
      const syncedPresets = patch.sellingPointPresets;
      setConfig((prev) => ({
        ...prev,
        defaultSellingPointPresets: syncedPresets,
      }));
    }
    if (Array.isArray(patch.globalCaseRefIds)) {
      const nextGlobalCases = patch.globalCaseRefIds;
      setSkuTasks((prev) =>
        prev.map((t) => {
          dirtySkuCasePromptTaskIdsRef.current.add(t.id);
          return {
            ...t,
            caseRefIds: [...nextGlobalCases],
          };
        })
      );
    }
    if (patch.replicaFidelity) {
      setSkuTasks((prev) =>
        prev.map((t) => ({
          ...t,
          replicaFidelity: patch.replicaFidelity,
        }))
      );
    }
    if (patch.consistentOutputStyle !== undefined || (patch as any).consistentStyle !== undefined || patch.styleLinkageMode !== undefined) {
      const val = patch.consistentOutputStyle ?? (patch as any).consistentStyle ?? (patch.styleLinkageMode ? patch.styleLinkageMode !== 'lock_scene' : undefined);
      setSkuTasks((prev) =>
        prev.map((t) => ({
          ...t,
          ...(val !== undefined ? { consistentOutputStyle: val } : {}),
          ...(patch.styleLinkageMode ? { styleLinkageMode: patch.styleLinkageMode } : {}),
        }))
      );
    }
    if (patch.defaultAspectRatio) {
      const nextRatio = patch.defaultAspectRatio;
      setSkuTasks((prev) =>
        prev.map((t) => ({
          ...t,
          aspectRatio: nextRatio,
        }))
      );
    }
    if (patch.defaultImageSize) {
      const nextSize = patch.defaultImageSize;
      setSkuTasks((prev) =>
        prev.map((t) => ({
          ...t,
          imageSize: nextSize,
        }))
      );
    }
    if (patch.replicaLanguage) {
      setSkuTasks((prev) =>
        prev.map((t) => ({
          ...t,
          replicaLanguage: patch.replicaLanguage,
          textMode: patch.replicaLanguage === 'none' ? 'without_text' : 'with_text',
        }))
      );
    }
  };

  const updateSkuTask = (taskId: string, patch: Partial<SkuTask>) => {
    if (typeof patch.visualPrompt === 'string') {
      dirtySkuCasePromptTaskIdsRef.current.delete(taskId);
    } else if (Array.isArray(patch.caseRefIds)) {
      dirtySkuCasePromptTaskIdsRef.current.add(taskId);
    }
    setSkuTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, ...patch } : t))
    );
  };

  const handleDeleteSkuTask = (taskId: string) => {
    setSkuTasks((prev) =>
      prev
        .filter((t) => t.id !== taskId)
        .map((t, idx) => ({ ...t, skuIndex: idx + 1 }))
    );
  };

  // Helper to compute formatted SKU title ("主标题 / 副标题") from skuBatchConfig
  const formatSkuTitleFromConfig = (
    idx0: number,
    prod?: { name?: string; tag?: string },
    fallbackExisting = ''
  ): string => {
    const mode = skuBatchConfig.titleIndexMode || 'seq_1';
    const rawPrefix = (skuBatchConfig.titlePrefix || '')
      .replace(/[\s/｜|]+$/, '')
      .trim();
    const rawSub = (skuBatchConfig.subtitleText || '')
      .replace(/^[\s/｜|]+/, '')
      .trim();
    const isSwapped = Boolean(skuBatchConfig.swapTitleOrder);
    const hasFormula = Boolean(
      rawPrefix ||
        rawSub ||
        (mode === 'custom_lines' &&
          (skuBatchConfig.customTitleLines || '').trim())
    );
    const defaultSystemTags = new Set([
      '产品实拍参考图',
      '常用产品参考图',
      '对标参考图',
      '未命名素材',
    ]);
    const rawTag = (prod?.tag || '').trim();
    const cleanTag = rawTag.replace(/\.[^/.]+$/, '').trim();
    const prodClean = prod
      ? cleanTag && !defaultSystemTags.has(cleanTag)
        ? cleanTag
        : (prod.name || '').replace(/\.[^/.]+$/, '').trim() || cleanTag
      : '';
    const existingParts = fallbackExisting
      .split(/\s*[/｜|]\s*/)
      .map((s) => s.trim())
      .filter(Boolean);
    const existingVariant =
      (rawSub
        ? existingParts.find((p) => p !== rawSub)
        : existingParts[0]) || '';

    if (!hasFormula) {
      return fallbackExisting.trim() || prodClean || `款式 ${idx0 + 1}`;
    }

    let seqPart = '';
    if (mode === 'custom_lines') {
      const lines = (skuBatchConfig.customTitleLines || '')
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);
      if (lines[idx0]) {
        seqPart = lines[idx0];
      }
    }

    if (!seqPart) {
      if (mode === 'file_name') {
        const fileBase = prodClean || existingVariant || `C${idx0 + 1}`;
        seqPart =
          rawPrefix &&
          !fileBase.toLowerCase().startsWith(rawPrefix.toLowerCase())
            ? `${rawPrefix}${fileBase}`
            : fileBase;
      } else {
        if (rawPrefix) {
          const trailingNumMatch = rawPrefix.match(/^(.*?)(\d+)$/);
          if (trailingNumMatch) {
            const stem = trailingNumMatch[1];
            const startNum = parseInt(trailingNumMatch[2], 10);
            const padLen = trailingNumMatch[2].length;
            const nextNumStr = String(startNum + idx0).padStart(
              padLen > 1 ? padLen : 1,
              '0'
            );
            seqPart = `${stem}${nextNumStr}`;
          } else {
            seqPart = `${rawPrefix}${idx0 + 1}`;
          }
        } else {
          seqPart = existingVariant || prodClean || `款式 ${idx0 + 1}`;
        }
      }
    }

    if (rawSub && !seqPart.includes(rawSub)) {
      return isSwapped ? `${rawSub} / ${seqPart}` : `${seqPart} / ${rawSub}`;
    }
    return seqPart;
  };

  const handleAddBlankSkuTask = () => {
    const prodImgs = skuReferenceImages.filter((r) => r.category === 'product');
    const caseImgs = skuReferenceImages.filter((r) => r.category === 'case');
    const nextNum =
      skuTasks.length > 0
        ? Math.max(...skuTasks.map((t) => t.skuIndex)) + 1
        : 1;
    const defaultProd =
      prodImgs.find((p) => skuBatchConfig.selectedProdIds.includes(p.id)) ||
      prodImgs[0];
    const defaultCaseIds =
      skuBatchConfig.globalCaseRefIds.length > 0
        ? [...skuBatchConfig.globalCaseRefIds]
        : caseImgs.map((c) => c.id);

    const hasTitleFormula = Boolean(
      skuBatchConfig.titlePrefix?.trim() ||
        skuBatchConfig.subtitleText?.trim() ||
        (skuBatchConfig.titleIndexMode === 'custom_lines' &&
          skuBatchConfig.customTitleLines?.trim())
    );

    const newSkuTask: SkuTask = {
      id: `sku-custom-${Date.now()}`,
      skuIndex: nextNum,
      skuDiffMode: skuBatchConfig.skuDiffMode,
      skuTitle: hasTitleFormula
        ? formatSkuTitleFromConfig(nextNum - 1, defaultProd)
        : '',
      sellingPointBadge: skuBatchConfig.referenceInfoText.trim() || '',
      packageSpecNote: '',
      typographyPlan: '',
      visualPrompt: '',
      textMode: skuBatchConfig.textMode,
      productRefIds: defaultProd ? [defaultProd.id] : [],
      caseRefIds: defaultCaseIds,
      aspectRatio: skuBatchConfig.defaultAspectRatio,
      imageSize: skuBatchConfig.defaultImageSize,
      status: 'idle',
      historyImages: [],
    };
    setSkuTasks((prev) => [...prev, newSkuTask]);
    showToast(
      `已新建 SKU #${String(nextNum).padStart(2, '0')} 卡片：请选好产品图与对标图并填写文案，再点击「Agent 识图生成本卡提示词」`,
      'success'
    );
  };

  // Quick-sync 1 SKU task per selected #Prod image (preserves existing cards & pre-fills skuTitle from formula or tag/name)
  const handleQuickCreateTasksFromSelectedProds = () => {
    const rawProdImgs = skuReferenceImages.filter((r) => r.category === 'product');
    const prodImgs = filterEnabledProds(rawProdImgs, true);
    const chosenProds = prodImgs.filter((p) =>
      skuBatchConfig.selectedProdIds.includes(p.id)
    );
    const targets = chosenProds.length > 0 ? chosenProds : prodImgs;
    if (targets.length === 0) {
      showToast('请先在左侧上传或从资产库选择至少 1 张产品参考图 (#Prod)', 'error');
      return;
    }
    const caseImgs = skuReferenceImages.filter((r) => r.category === 'case');
    const globalCases =
      skuBatchConfig.globalCaseRefIds.length > 0
        ? skuBatchConfig.globalCaseRefIds
        : caseImgs.map((c) => c.id);

    const existingByPrimaryProd = new Map<string, SkuTask>();
    for (const t of skuTasks) {
      if (t.productRefIds[0] && !existingByPrimaryProd.has(t.productRefIds[0])) {
        existingByPrimaryProd.set(t.productRefIds[0], t);
      }
    }

    const hasTitleFormula = Boolean(
      skuBatchConfig.titlePrefix?.trim() ||
        skuBatchConfig.subtitleText?.trim() ||
        (skuBatchConfig.titleIndexMode === 'custom_lines' &&
          skuBatchConfig.customTitleLines?.trim())
    );

    let addedCount = 0;
    const synced: SkuTask[] = targets.map((prod, idx) => {
      const skuNum = idx + 1;
      const formulaOrDefaultTitle = formatSkuTitleFromConfig(idx, prod);
      const existing = existingByPrimaryProd.get(prod.id);
      if (existing) {
        return {
          ...existing,
          skuIndex: skuNum,
          skuTitle: hasTitleFormula
            ? formatSkuTitleFromConfig(idx, prod, existing.skuTitle)
            : existing.skuTitle.trim() || formulaOrDefaultTitle,
          sellingPointBadge:
            existing.sellingPointBadge.trim() ||
            skuBatchConfig.referenceInfoText.trim() ||
            '',
          caseRefIds:
            existing.caseRefIds.length > 0
              ? existing.caseRefIds
              : [...globalCases],
        };
      }
      addedCount += 1;
      return {
        id: `sku-quick-${Date.now()}-${idx}`,
        skuIndex: skuNum,
        skuDiffMode: skuBatchConfig.skuDiffMode,
        skuTitle: formulaOrDefaultTitle,
        sellingPointBadge: skuBatchConfig.referenceInfoText.trim() || '',
        packageSpecNote: '',
        typographyPlan: '',
        visualPrompt: '',
        textMode: skuBatchConfig.textMode,
        productRefIds: [prod.id],
        caseRefIds: [...globalCases],
        aspectRatio: skuBatchConfig.defaultAspectRatio,
        imageSize: skuBatchConfig.defaultImageSize,
        status: 'idle',
        historyImages: [],
      };
    });

    setSkuTasks(synced);
    setSkuBatchSummary(
      `已同步 ${synced.length} 张 SKU 卡片（新增 ${addedCount} 张，保留已有卡片文案与成图），并自动继承 ${globalCases.length} 张对标案例图 (#Case)。可直接点击卡片「智能生图」或左侧「批量生成提示词」。`
    );
    showToast(
      addedCount > 0
        ? `已按勾选产品图同步 ${synced.length} 张 SKU 卡片（已自动带入款式名与对标图）`
        : `已刷新全部 ${synced.length} 张 SKU 卡片的对标图与主副标题`,
      'success'
    );
  };

  // Single-Card Vision Agent Prompt & Typography Plan Generation (Product Ref + Case Ref + Copywriting -> Prompt)
  const handleAgentGenerateSingleSkuPrompt = async (
    task: SkuTask,
    autoGenerateImageAfter = false
  ) => {
    const boundProds = skuReferenceImages.filter((r) =>
      task.productRefIds.includes(r.id)
    );
    const boundCases = skuReferenceImages.filter((r) =>
      task.caseRefIds.includes(r.id)
    );

    const [singleMain = '', singleSub = ''] = splitSkuTitleTwoLines(
      task.skuTitle
    );
    const singleTitleDirective =
      singleMain && singleSub
        ? `本款SKU指定第1行主标题：“${singleMain}”，正下方第2行副标题：“${singleSub}”（上下两行排布）`
        : task.skuTitle.trim()
          ? `本款SKU指定款式/规格名称：${task.skuTitle.trim()}`
          : '';

    const combinedRefText = [
      singleTitleDirective,
      task.sellingPointBadge.trim()
        ? `本款核心卖点/功能角标文案：${task.sellingPointBadge.trim()}`
        : '',
      task.packageSpecNote.trim()
        ? `本款外观机型/包装配件补充说明（底部/辅助小字）：${task.packageSpecNote.trim()}`
        : '',
      task.typographyPlan.trim()
        ? `本款已同步的母版文字排版结构基准（请严格保持相同的胶囊数量、底部小字与图标栏结构，仅替换本款主副标题）：\n${task.typographyPlan.trim()}`
        : '',
      skuBatchConfig.referenceInfoText.trim()
        ? `全局共用卖点与规格背景信息：${skuBatchConfig.referenceInfoText.trim()}`
        : '',
      productInfoText.trim() ? `商品基础信息：${productInfoText.trim()}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    if (boundProds.length === 0 && !combinedRefText) {
      showToast(
        '请至少为本张 SKU 卡片绑定 1 张产品参考图 (#Prod) 或填写卖点文案信息',
        'error'
      );
      return;
    }

    setGeneratingPromptSkuTaskId(task.id);
    const logHandle = startRuntimeLog({
      workspace: 'sku',
      title: `SKU #${String(task.skuIndex).padStart(2, '0')} 提示词生成`,
      model: `${config.agentModel}${config.enableHighThinking ? ' (High)' : ''}`,
      summary: `款式「${task.skuTitle || '未命名'}」· 绑定产品图 ${boundProds.length} 张 / 对标图 ${boundCases.length} 张`,
    });
    try {
      const data = await studioBridge.parseSkuPlan({
        productImages: boundProds.map((r) => toLightweightRefPayload(r)),
        caseImages: boundCases.map((c) => ({
          ...toLightweightRefPayload(c),
          caseDimensions: c.caseDimensions || ['style', 'structure'],
        })),
        referenceInfoText: combinedRefText,
        unifiedLayoutRule: skuBatchConfig.unifiedLayoutRule,
        skuDiffMode: task.skuDiffMode || skuBatchConfig.skuDiffMode,
        defaultAspectRatio: task.aspectRatio,
        defaultImageSize: task.imageSize,
        textMode: task.textMode,
        globalStylePrefix: config.globalStylePrefix,
        agentModel: config.agentModel,
        enableHighThinking: config.enableHighThinking,
        ...getActiveChannelBridgeParams(),
        ossConfig: config.ossConfig,
      });

      const firstGenerated = data.skuTasks?.[0];
      if (!firstGenerated) {
        throw new Error('Agent 未返回有效的 SKU 提示词');
      }

      const cleanedTypo = (
        firstGenerated.typographyPlan || task.typographyPlan
      )
        .replace(/(副标题[：:\s]*[“"「『]?)\s*[/｜|]\s*/g, '$1')
        .replace(/([“"「『])\s*[/｜|]\s*(?=[\u4e00-\u9fa5A-Za-z0-9])/g, '$1');
      const cleanedPrompt = (
        firstGenerated.visualPrompt || task.visualPrompt
      )
        .replace(/(副标题[：:\s]*[“"「『]?)\s*[/｜|]\s*/g, '$1')
        .replace(/([“"「『])\s*[/｜|]\s*(?=[\u4e00-\u9fa5A-Za-z0-9])/g, '$1');

      const updatedTask: SkuTask = {
        ...task,
        skuTitle: task.skuTitle.trim() || firstGenerated.skuTitle || task.skuTitle,
        sellingPointBadge:
          task.sellingPointBadge.trim() ||
          firstGenerated.sellingPointBadge ||
          task.sellingPointBadge,
        packageSpecNote:
          task.packageSpecNote.trim() ||
          firstGenerated.packageSpecNote ||
          task.packageSpecNote,
        typographyPlan: cleanedTypo,
        visualPrompt: cleanedPrompt,
      };

      dirtySkuCasePromptTaskIdsRef.current.delete(task.id);
      updateSkuTask(task.id, {
        skuTitle: updatedTask.skuTitle,
        sellingPointBadge: updatedTask.sellingPointBadge,
        packageSpecNote: updatedTask.packageSpecNote,
        typographyPlan: updatedTask.typographyPlan,
        visualPrompt: updatedTask.visualPrompt,
      });

      finishRuntimeLogSuccess(
        logHandle,
        `SKU #${String(task.skuIndex).padStart(2, '0')} (${updatedTask.skuTitle}) 提示词与排版规划已生成`
      );
      showToast(
        `SKU #${String(task.skuIndex).padStart(2, '0')} 已按各对标图锁定维度正交生成提示词与排版方案！`,
        'success'
      );

      if (autoGenerateImageAfter) {
        await generateSingleSkuTaskImage(updatedTask);
      }
    } catch (err: any) {
      const msg = err?.message || 'Agent 生成本卡提示词失败';
      finishRuntimeLogError(logHandle, msg);
      showToast(msg, 'error');
    } finally {
      setGeneratingPromptSkuTaskId(null);
    }
  };

  // AI Vision Batch Orchestration for SKU Studio (Non-destructive: merges with existing card copywriting & history)
  const handleAgentGenerateSkuPlan = async () => {
    const rawProdImgs = skuReferenceImages.filter((r) => r.category === 'product');
    const prodImgs = filterEnabledProds(rawProdImgs, true);
    const chosenProds = prodImgs.filter((p) =>
      skuBatchConfig.selectedProdIds.includes(p.id)
    );
    const targetProds = chosenProds.length > 0 ? chosenProds : prodImgs;
    if (targetProds.length === 0) {
      showToast('请先上传或从资产库选择并勾选至少 1 张产品图 (#Prod)', 'error');
      return;
    }

    const caseImgs = skuReferenceImages.filter((r) => r.category === 'case');
    const chosenCases = caseImgs.filter((c) =>
      skuBatchConfig.globalCaseRefIds.includes(c.id)
    );

    // Map existing cards by primary productRefId so user-edited titles & selling points are sent to AI and preserved
    const existingByPrimaryProd = new Map<string, SkuTask>();
    for (const t of skuTasks) {
      if (t.productRefIds[0] && !existingByPrimaryProd.has(t.productRefIds[0])) {
        existingByPrimaryProd.set(t.productRefIds[0], t);
      }
    }

    const hasTitleFormulaInConfig = Boolean(
      skuBatchConfig.titlePrefix?.trim() ||
        skuBatchConfig.subtitleText?.trim() ||
        (skuBatchConfig.titleIndexMode === 'custom_lines' &&
          skuBatchConfig.customTitleLines?.trim())
    );

    const isUnformattedCardTitle = (
      rawTitle: string | undefined,
      prod: { name?: string; tag?: string } | undefined,
      idx: number
    ): boolean => {
      const t = (rawTitle || '').trim();
      if (!t) return true;
      const cleanName = (prod?.name || '').replace(/\.[^/.]+$/, '').trim();
      const cleanTag = (prod?.tag || '').replace(/\.[^/.]+$/, '').trim();
      return (
        t === `款式 ${idx + 1}` ||
        t === cleanName ||
        t === cleanTag ||
        t === (prod?.tag || '').trim()
      );
    };

    const perCardNotes = targetProds
      .map((prod, idx) => {
        const existing = existingByPrimaryProd.get(prod.id);
        const resolvedTitle =
          existing && !isUnformattedCardTitle(existing.skuTitle, prod, idx)
            ? existing.skuTitle.trim()
            : hasTitleFormulaInConfig
              ? formatSkuTitleFromConfig(idx, prod, existing?.skuTitle || '')
              : existing?.skuTitle.trim() || '';
        const parts: string[] = [];
        if (resolvedTitle) {
          const [mainPart = '', subPart = ''] =
            splitSkuTitleTwoLines(resolvedTitle);
          if (mainPart && subPart) {
            parts.push(
              `指定第1行主标题="${mainPart}"，正下方第2行副标题="${subPart}"（主副标题上下两行排布）`
            );
          } else {
            parts.push(`指定款式名称="${resolvedTitle}"`);
          }
        }
        if (existing?.sellingPointBadge.trim()) {
          parts.push(`指定卖点文案="${existing.sellingPointBadge.trim()}"`);
        }
        if (existing?.packageSpecNote.trim()) {
          parts.push(`配置/包装补充="${existing.packageSpecNote.trim()}"`);
        }
        return parts.length > 0
          ? `- 第 ${idx + 1} 款 (#${prod.code || `Prod-${idx + 1}`})：${parts.join('，')}`
          : '';
      })
      .filter(Boolean)
      .join('\n');

    const combinedBatchRefText = [
      skuBatchConfig.referenceInfoText.trim() || productInfoText.trim(),
      perCardNotes ? `【各款式卡片已填写的专属文案要求】：\n${perCardNotes}` : '',
    ]
      .filter(Boolean)
      .join('\n\n');

    setIsParsingSkuPlan(true);
    const logHandle = startRuntimeLog({
      workspace: 'sku',
      title: `Agent 批量规划 SKU 提示词 (${targetProds.length}款)`,
      model: `${config.agentModel}${config.enableHighThinking ? ' (High)' : ''}`,
      summary: `勾选产品图 ${targetProds.length} 张 · 全局对标图 ${chosenCases.length} 张`,
    });
    try {
      const data = await studioBridge.parseSkuPlan({
        productImages: targetProds.map((r) => toLightweightRefPayload(r)),
        caseImages: chosenCases.map((c) => ({
          ...toLightweightRefPayload(c),
          caseDimensions: c.caseDimensions || ['style', 'structure'],
        })),
        referenceInfoText: combinedBatchRefText,
        unifiedLayoutRule: skuBatchConfig.unifiedLayoutRule,
        skuDiffMode: skuBatchConfig.skuDiffMode,
        defaultAspectRatio: skuBatchConfig.defaultAspectRatio,
        defaultImageSize: skuBatchConfig.defaultImageSize,
        textMode: skuBatchConfig.textMode,
        globalStylePrefix: config.globalStylePrefix,
        agentModel: config.agentModel,
        enableHighThinking: config.enableHighThinking,
        ...getActiveChannelBridgeParams(),
        ossConfig: config.ossConfig,
      });

      if (data.skuBatchSummary) {
        setSkuBatchSummary(data.skuBatchSummary);
      }
      if (Array.isArray(data.skuTasks) && data.skuTasks.length > 0) {
        const cleanSubSlash = (txt: string | undefined): string =>
          (txt || '')
            .replace(/(副标题[：:\s]*[“"「『]?)\s*[/｜|]\s*/g, '$1')
            .replace(/([“"「『])\s*[/｜|]\s*(?=[\u4e00-\u9fa5A-Za-z0-9])/g, '$1');

        const mergedTasks: SkuTask[] = data.skuTasks.map((genTask, idx) => {
          const primaryProdId =
            genTask.productRefIds?.[0] || targetProds[idx]?.id;
          const matchedProd =
            targetProds.find((p) => p.id === primaryProdId) || targetProds[idx];
          const existing =
            (primaryProdId ? existingByPrimaryProd.get(primaryProdId) : undefined) ||
            skuTasks[idx];
          const resolvedCardTitle =
            existing && !isUnformattedCardTitle(existing.skuTitle, matchedProd, idx)
              ? existing.skuTitle.trim()
              : hasTitleFormulaInConfig
                ? formatSkuTitleFromConfig(idx, matchedProd, existing?.skuTitle || '')
                : existing?.skuTitle.trim() || '';
          const sanitizedGenTask: SkuTask = {
            ...genTask,
            typographyPlan: cleanSubSlash(genTask.typographyPlan),
            visualPrompt: cleanSubSlash(genTask.visualPrompt),
          };
          const finalTitle = resolvedCardTitle || sanitizedGenTask.skuTitle;
          const finalBadge =
            existing?.sellingPointBadge.trim() ||
            sanitizedGenTask.sellingPointBadge;
          const finalNote =
            existing?.packageSpecNote.trim() || sanitizedGenTask.packageSpecNote;

          const titleSynced = syncSkuTitleInText(
            sanitizedGenTask.skuTitle,
            finalTitle,
            sanitizedGenTask.typographyPlan,
            sanitizedGenTask.visualPrompt
          );
          const copySynced = syncSellingPointsIntoTypographyAndPrompt(
            sanitizedGenTask.sellingPointBadge,
            finalBadge,
            sanitizedGenTask.packageSpecNote,
            finalNote,
            titleSynced.typographyPlan,
            titleSynced.visualPrompt
          );

          if (!existing) {
            return {
              ...sanitizedGenTask,
              skuTitle: finalTitle,
              sellingPointBadge: finalBadge,
              packageSpecNote: finalNote,
              typographyPlan: copySynced.typographyPlan,
              visualPrompt: copySynced.visualPrompt,
            };
          }
          return {
            ...sanitizedGenTask,
            id: existing.id,
            skuIndex: idx + 1,
            skuTitle: finalTitle,
            sellingPointBadge: finalBadge,
            packageSpecNote: finalNote,
            typographyPlan: copySynced.typographyPlan,
            visualPrompt: copySynced.visualPrompt,
            productRefIds:
              existing.productRefIds.length > 0
                ? existing.productRefIds
                : sanitizedGenTask.productRefIds,
            caseRefIds:
              existing.caseRefIds.length > 0
                ? existing.caseRefIds
                : chosenCases.length > 0
                  ? chosenCases.map((c) => c.id)
                  : sanitizedGenTask.caseRefIds,
            aspectRatio: existing.aspectRatio || sanitizedGenTask.aspectRatio,
            imageSize: existing.imageSize || sanitizedGenTask.imageSize,
            textMode: existing.textMode || sanitizedGenTask.textMode,
            status: existing.resultImageUrl ? 'completed' : 'idle',
            resultImageUrl: existing.resultImageUrl,
            resultOssUrl: existing.resultOssUrl,
            resultTextNote: existing.resultTextNote,
            durationMs: existing.durationMs,
            generatedAt: existing.generatedAt,
            historyImages: existing.historyImages || [],
          };
        });
        const mergedIds = new Set(mergedTasks.map((t) => t.id));
        const untouchedTasks = skuTasks
          .filter((t) => !mergedIds.has(t.id))
          .map((t, extraIdx) => ({
            ...t,
            skuIndex: mergedTasks.length + extraIdx + 1,
          }));
        const allUpdatedTasks = [...mergedTasks, ...untouchedTasks];
        dirtySkuCasePromptTaskIdsRef.current.clear();
        setSkuTasks(allUpdatedTasks);
        finishRuntimeLogSuccess(
          logHandle,
          `成功生成 ${mergedTasks.length} 款 SKU 提示词与排版规划`
        );
        showToast(
          `AI 已按对标图锁定维度完成 ${mergedTasks.length} 款 SKU 提示词正交编排（已保留卡片文案与历史成图）`,
          'success'
        );
      } else {
        throw new Error('AI 未返回有效的 SKU 任务列表');
      }
    } catch (err: any) {
      const msg = err?.message || 'AI 批量规划 SKU 方案失败';
      finishRuntimeLogError(logHandle, msg);
      showToast(msg, 'error');
    } finally {
      setIsParsingSkuPlan(false);
    }
  };

  // Auto-clean existing SKU tasks in state: strip any leading "/" inside subtitle quotes and upgrade single-line main+subtitle headers to 2-line stacked format
  useEffect(() => {
    const slashOrSingleLineHeaderRegex =
      /(?:副标题[：:\s]*[“"「『]?\s*[/｜|])|(?:[“"「『]\s*[/｜|]\s*[\u4e00-\u9fa5A-Za-z0-9])|(?:顶部主副标题：主标题[“"][^”"]+[”"]\s+副标题[“"][^”"]+[”"])/;
    const needsClean = skuTasks.some(
      (t) =>
        slashOrSingleLineHeaderRegex.test(t.typographyPlan || '') ||
        slashOrSingleLineHeaderRegex.test(t.visualPrompt || '')
    );
    if (!needsClean) return;

    setSkuTasks((prev) =>
      prev.map((t) => ({
        ...t,
        typographyPlan: (t.typographyPlan || '')
          .replace(/(副标题[：:\s]*[“"「『]?)\s*[/｜|]\s*/g, '$1')
          .replace(/([“"「『])\s*[/｜|]\s*(?=[\u4e00-\u9fa5A-Za-z0-9])/g, '$1')
          .replace(
            /^顶部主副标题：主标题([“"][^”"]+[”"])\s+副标题([“"][^”"]+[”"])/m,
            '顶部主副标题（上下两行）：第1行大字主标题$1，正下方第2行副标题$2'
          ),
        visualPrompt: (t.visualPrompt || '')
          .replace(/(副标题[：:\s]*[“"「『]?)\s*[/｜|]\s*/g, '$1')
          .replace(/([“"「『])\s*[/｜|]\s*(?=[\u4e00-\u9fa5A-Za-z0-9])/g, '$1'),
      }))
    );
  }, [skuTasks]);

  // Polish a single SKU task's visual prompt
  const handlePolishSkuPrompt = async (task: SkuTask) => {
    setPolishingSkuTaskId(task.id);
    try {
      const boundProds = skuReferenceImages.filter((r) =>
        task.productRefIds.includes(r.id)
      );
      const boundCases = skuReferenceImages.filter((r) =>
        task.caseRefIds.includes(r.id)
      );
      const refSummary = [
        ...boundProds.map((p) => `本款产品图 #${p.code}(${p.tag})`),
        ...boundCases.map(
          (c) =>
            `对标案例图 #${c.code}(${c.tag} · 参考维度:${(
              c.caseDimensions || ['style', 'structure']
            ).join('/')}${c.caseCustomRule?.trim() ? ` · 附加约束:${c.caseCustomRule.trim()}` : ''})`
        ),
      ]
        .filter(Boolean)
        .join('；');

      const cardProductInfo = [
        task.skuTitle.trim() ? `款式名称：${task.skuTitle.trim()}` : '',
        task.sellingPointBadge.trim()
          ? `核心卖点角标：${task.sellingPointBadge.trim()}`
          : '',
        task.packageSpecNote.trim()
          ? `包装/配件说明：${task.packageSpecNote.trim()}`
          : '',
        skuBatchConfig.referenceInfoText.trim(),
        productInfoText.trim(),
      ]
        .filter(Boolean)
        .join(' ｜ ');

      const data = await studioBridge.polishPrompt({
        title: `SKU-${task.skuIndex} 【${task.skuTitle}】`,
        benchmarkCase: buildClientCaseDimensionDirective(
          boundCases,
          skuBatchConfig.unifiedLayoutRule,
          'sku'
        ),
        typographyPlan: task.typographyPlan,
        currentPrompt: task.visualPrompt,
        textMode: task.textMode,
        layerType: 'dynamic',
        productInfoText: cardProductInfo,
        boundRefSummary: refSummary,
        globalStylePrefix: config.globalStylePrefix,
        agentModel: config.agentModel,
        ...getActiveChannelBridgeParams(),
      });

      if (data.polishedPrompt) {
        const cleanedPolished = data.polishedPrompt
          .replace(/(副标题[：:\s]*[“"「『]?)\s*[/｜|]\s*/g, '$1')
          .replace(/([“"「『])\s*[/｜|]\s*(?=[\u4e00-\u9fa5A-Za-z0-9])/g, '$1');
        updateSkuTask(task.id, { visualPrompt: cleanedPolished });
        showToast(`SKU-${task.skuIndex} 画面提示词已完成 AI 润色`, 'success');
      }
    } catch (err: any) {
      showToast(err?.message || 'SKU 提示词润色失败', 'error');
    } finally {
      setPolishingSkuTaskId(null);
    }
  };

  // Generate a single Main Image / SKU Replica task image via studioBridge.generateImage (1-to-1 High-Stability Replica Pipeline)
  const generateSingleSkuTaskImage = async (
    skuTask: SkuTask,
    overrideRefPool?: ReferenceImageItem[]
  ): Promise<boolean> => {
    const activeTask: SkuTask = {
      ...skuTask,
      aspectRatio: skuTask.aspectRatio || skuBatchConfig.defaultAspectRatio,
      imageSize: skuTask.imageSize || skuBatchConfig.defaultImageSize,
      textMode:
        skuBatchConfig.replicaLanguage === 'none'
          ? 'without_text'
          : skuTask.textMode || skuBatchConfig.textMode,
    };

    updateSkuTask(activeTask.id, {
      status: 'generating',
      errorMessage: undefined,
    });

    const effectiveFidelity =
      activeTask.replicaFidelity ||
      skuBatchConfig.replicaFidelity ||
      'high_replica';
    const isStyleRef =
      effectiveFidelity === 'style_ref' ||
      effectiveFidelity === 'style_reference';

    const skuLogHandle = startRuntimeLog({
      workspace: 'sku',
      title: `主图/SKU复刻 #${String(activeTask.skuIndex).padStart(2, '0')} (${activeTask.skuTitle || '复刻任务'})`,
      model: config.imageModel,
      summary: `${isStyleRef ? '参考风格' : '高度复刻'} · ${activeTask.aspectRatio} · ${activeTask.imageSize}`,
    });

    try {
      const refPool = overrideRefPool || skuReferenceImages;
      const allSkuProds = refPool.filter(
        (r) => r.category !== 'case'
      );
      const allSkuCases = refPool.filter(
        (r) => r.category === 'case'
      );

      const matchedProds = allSkuProds.filter((r) =>
        activeTask.productRefIds.includes(r.id)
      );
      const rawEffectiveProds =
        matchedProds.length > 0
          ? matchedProds
          : filterEnabledProds(allSkuProds).slice(0, 1).length > 0
            ? filterEnabledProds(allSkuProds).slice(0, 1)
            : allSkuProds.slice(0, 1);
      const primaryCase =
        allSkuCases.find((r) => activeTask.caseRefIds.includes(r.id)) ||
        allSkuCases[
          Math.max(0, (activeTask.skuIndex || 1) - 1) %
            Math.max(1, allSkuCases.length)
        ];
      const qg: QualityGuardGlobalConfig = {
        ...DEFAULT_QUALITY_GUARD_CONFIG,
        ...(config.qualityGuardConfig || {}),
      };
      const isLockedRefineMode = Boolean(
        qg.lockRefineHighWeightAnchor !== false &&
          activeTask.lockResultAsRef &&
          activeTask.resultImageUrl
      );

      const effectiveProds =
        qg.strictSingleSkuProdCap !== false
          ? limitAndOrderTaskProdsForRender(
              rawEffectiveProds.map((p) => p.id),
              allSkuProds,
              {
                isLockedRefine: isLockedRefineMode,
                moduleOrTitleHint: `${activeTask.skuTitle || ''} ${activeTask.sellingPointBadge || ''} ${primaryCase?.tag || ''} ${primaryCase?.caseCustomRule || ''} ${activeTask.visualPrompt || ''}`,
              }
            )
          : rawEffectiveProds.slice(0, 5);

      // Support strictly capped multi-angle #Prod images + 1 #Case reference image (omit #Case if locked refine high-weight anchor is active)
      const boundRefs = [
        ...effectiveProds.map((p) => ({
          ...toLightweightRefPayload(p),
          isCommonAsset: false,
        })),
        ...(primaryCase && !isLockedRefineMode
          ? [{ ...toLightweightRefPayload(primaryCase), isCommonAsset: false }]
          : []),
      ];

      const perRefRule =
        primaryCase?.caseCustomRule?.trim() ||
        (activeTask.singleRequirement || (activeTask as any).perRefRequirement)?.trim() ||
        '';

      const rawCopyJoined = Array.from(
        new Set(
          [
            activeTask.skuTitle?.trim(),
            activeTask.sellingPointBadge?.trim(),
            activeTask.packageSpecNote?.trim(),
          ].filter(Boolean)
        )
      ).join('\n');
      const copywritingForRender =
        qg.autoSanitizePromptCodes !== false
          ? sanitizeCopywritingForRender(rawCopyJoined)
          : rawCopyJoined;

      const rawEffectivePrompt = (
        activeTask.visualPrompt ||
        skuBatchConfig.referenceInfoText ||
        (isStyleRef
          ? '借鉴参考图的色彩调性、光影质感与版式风格，围绕产品原图构建高转化商业电商场景。'
          : '1:1高度复刻参考图的相机视角、构图布局、人物姿态与文字版式，将商品主体100%替换为产品原图并自动和谐全图色调。')
      ).trim();
      const sanitizedPromptBase =
        qg.autoSanitizePromptCodes !== false
          ? sanitizeVisualPromptForRender(rawEffectivePrompt, allSkuProds)
          : rawEffectivePrompt;

      const skuGuardDirectives: string[] = [];
      if (qg.enforceLightRoundedCards !== false) {
        skuGuardDirectives.push(
          '【全局UI信息卡护栏】：画面内卖点标签统一采用浅色半透明圆角信息卡，严禁生硬黑框/深棕底框，严禁绘制3D医药胶囊颗粒。'
        );
      }
      if (qg.customNegativePrompt?.trim()) {
        skuGuardDirectives.push(
          `【全局负向禁用词（严禁出现）】：${qg.customNegativePrompt.trim()}`
        );
      }
      const effectivePrompt =
        skuGuardDirectives.length > 0
          ? `${sanitizedPromptBase}\n${skuGuardDirectives.join('\n')}`
          : sanitizedPromptBase;

      const rawCat =
        activeTask.replicaCategory ||
        skuBatchConfig.replicaCategory ||
        'ecommerce_product';
      const normalizedReplicaCategory =
        rawCat === 'ecom_product' ? 'ecommerce_product' : rawCat;

      const effectiveLinkageMode =
        activeTask.styleLinkageMode ||
        skuBatchConfig.styleLinkageMode ||
        (activeTask.consistentOutputStyle === false ? 'lock_scene' : 'print_4d');

      const data = await studioBridge.generateImage({
        prompt: effectivePrompt,
        copywriting:
          copywritingForRender ||
          (qg.autoSanitizePromptCodes !== false
            ? sanitizeCopywritingForRender(activeTask.typographyPlan || '')
            : activeTask.typographyPlan || ''),
        typographyPlan:
          copywritingForRender ||
          (qg.autoSanitizePromptCodes !== false
            ? sanitizeCopywritingForRender(activeTask.typographyPlan || '')
            : activeTask.typographyPlan || ''),
        studioContext: 'replica',
        replicaCategory: normalizedReplicaCategory,
        replicaFidelity: isStyleRef ? 'style_reference' : 'high_replica',
        consistentOutputStyle:
          activeTask.consistentOutputStyle ??
          (skuBatchConfig.consistentOutputStyle !== false),
        styleLinkageMode: effectiveLinkageMode,
        printThemeConfig: activeTask.printThemeConfig,
        lockedResultImageUrl:
          activeTask.lockResultAsRef && activeTask.resultImageUrl
            ? activeTask.resultImageUrl
            : undefined,
        refineInstruction:
          activeTask.lockResultAsRef && activeTask.refineInstruction
            ? activeTask.refineInstruction
            : undefined,
        replicaLanguage:
          activeTask.replicaLanguage || skuBatchConfig.replicaLanguage || 'zh',
        globalRequirement: skuBatchConfig.referenceInfoText,
        perRefRequirement: perRefRule,
        textMode: activeTask.textMode,
        layerType: 'dynamic',
        title:
          activeTask.skuTitle || `复刻图 #${String(activeTask.skuIndex).padStart(2, '0')}`,
        referenceImages: boundRefs,
        imageModel: config.imageModel,
        aspectRatio: activeTask.aspectRatio,
        imageSize: activeTask.imageSize,
        ...getActiveChannelBridgeParams(),
        ossConfig: config.ossConfig,
      });

      if (!data.imageUrl) {
        throw new Error('生图接口未返回有效图片');
      }

      const nowDate = new Date();
      const nowStr = nowDate.toLocaleTimeString('zh-CN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      const fullDateStr = `${nowDate.toLocaleDateString('zh-CN')} ${nowStr}`;

      setSkuTasks((prev) =>
        prev.map((t) => {
          if (t.id !== activeTask.id) return t;
          const seededHistory =
            t.historyImages.length === 0 && t.resultImageUrl
              ? [
                  {
                    url: t.resultImageUrl,
                    ossUrl: t.resultOssUrl,
                    cloudUrls: t.resultCloudUrls,
                    timestamp: t.generatedAt || '初版',
                    promptSnapshot: t.visualPrompt,
                    aspectRatio: t.aspectRatio,
                    imageSize: t.imageSize,
                  },
                ]
              : t.historyImages;
          const nextHistory = [
            {
              url: data.imageUrl,
              ossUrl: data.ossUrl,
              cloudUrls: data.ossUrl
                ? { [activeStorageProvider]: data.ossUrl }
                : undefined,
              timestamp: nowStr,
              promptSnapshot: activeTask.visualPrompt || t.visualPrompt,
              aspectRatio: t.aspectRatio,
              imageSize: t.imageSize,
            },
            ...seededHistory.filter((h) => h.url !== data.imageUrl),
          ].slice(0, 8);

          return {
            ...t,
            status: 'completed',
            resultImageUrl: data.imageUrl,
            resultOssUrl: data.ossUrl,
            resultCloudUrls: data.ossUrl
              ? mergeCloudUrlsForProvider(
                  t.resultOssUrl,
                  t.resultCloudUrls,
                  activeStorageProvider,
                  data.ossUrl
                )
              : t.resultCloudUrls,
            resultTextNote: data.textNote,
            durationMs: data.durationMs,
            generatedAt: nowStr,
            errorMessage: undefined,
            historyImages: nextHistory,
          };
        })
      );

      // Automatically record into Asset Library Generation Records
      const activeSkuBatch = activeSkuBatchIdRef.current;
      const skuDisplayTitle =
        activeTask.skuTitle ||
        `复刻图 #${String(activeTask.skuIndex).padStart(2, '0')}`;
      const newSkuRecord: GenerationRecordItem = {
        id: `gen-sku-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        batchId: activeSkuBatch?.id || `sku-single-${Date.now()}`,
        batchTitle:
          activeSkuBatch?.title || `主图/SKU复刻 · ${skuDisplayTitle}`,
        sourceStudio: 'sku_studio',
        itemIndex: activeTask.skuIndex,
        title: `复刻 #${String(activeTask.skuIndex).padStart(2, '0')} · ${
          activeTask.skuTitle || '未命名款式'
        }`,
        promptSnapshot: activeTask.visualPrompt || effectivePrompt,
        copywriting: activeTask.sellingPointBadge,
        aspectRatio: activeTask.aspectRatio,
        imageSize: activeTask.imageSize,
        imageUrl: data.imageUrl,
        ossUrl: data.ossUrl,
        cloudUrls: data.ossUrl
          ? { [activeStorageProvider]: data.ossUrl }
          : undefined,
        createdAt: fullDateStr,
        timestamp: Date.now(),
        isViewed: false,
      };
      setGenerationRecords((prev) => [newSkuRecord, ...prev]);
      saveGenerationRecordToDb(newSkuRecord);

      finishRuntimeLogSuccess(
        skuLogHandle,
        `SKU #${String(activeTask.skuIndex).padStart(2, '0')} 成图渲染完成 (${activeTask.aspectRatio} · ${activeTask.imageSize})`,
        data.durationMs
      );
      return true;
    } catch (err: any) {
      const msg = err?.message || 'SKU 生图失败';
      updateSkuTask(activeTask.id, {
        status: 'error',
        errorMessage: msg,
      });
      finishRuntimeLogError(
        skuLogHandle,
        msg,
        `SKU #${String(activeTask.skuIndex).padStart(2, '0')} 生图失败`
      );
      showToast(`SKU-${activeTask.skuIndex} 生图异常：${msg}`, 'error');
      return false;
    }
  };

  // Batch concurrent generation for SKU / Replica tasks (accepts optional explicit list & reference pool override)
  const handleStartBatchGenerateSkus = async (
    onlyUnfinished = false,
    customTaskList?: SkuTask[],
    overrideRefPool?: ReferenceImageItem[]
  ) => {
    const baseList = customTaskList || skuTasks;
    if (baseList.length === 0) {
      showToast('请先上传参考图或产品原图', 'info');
      return;
    }
    const targetList = baseList.filter((t) =>
      onlyUnfinished ? t.status !== 'completed' : true
    );
    if (targetList.length === 0) {
      showToast('全部复刻卡片均已生成完毕', 'info');
      return;
    }

    setIsSkuBatchRunning(true);
    abortSkuBatchRef.current = false;
    activeSkuBatchIdRef.current = {
      id: `sku-batch-${Date.now()}`,
      title: `主图/SKU批量复刻 (${targetList.length}张)`,
    };

    const concurrency = Math.max(
      1,
      Math.min(6, activeChannel.concurrency || 2)
    );
    const queue = [...targetList];
    let successCount = 0;

    const worker = async () => {
      while (queue.length > 0 && !abortSkuBatchRef.current) {
        const queuedItem = queue.shift();
        if (!queuedItem) break;
        const latestSkuTask =
          skuTasksRef.current.find((t) => t.id === queuedItem.id) || queuedItem;
        const ok = await generateSingleSkuTaskImage(
          latestSkuTask,
          overrideRefPool
        );
        if (ok) successCount += 1;
      }
    };

    const workers = Array.from(
      { length: Math.min(concurrency, queue.length) },
      () => worker()
    );
    await Promise.all(workers);

    activeSkuBatchIdRef.current = null;
    setIsSkuBatchRunning(false);
    if (abortSkuBatchRef.current) {
      showToast(`已停止批量复刻队列，已完成 ${successCount} 张`, 'info');
    } else {
      showToast(
        `批量复刻完成：成功生成 ${successCount} / ${targetList.length} 张高清图`,
        successCount > 0 ? 'success' : 'error'
      );
    }
  };

  const handleStopBatchGenerateSkus = () => {
    abortSkuBatchRef.current = true;
  };

  // Build 1-to-1 paired Replica SkuTasks and either pre-plan copywriting or start batch rendering immediately
  const handleSyncReplicaPairsAndRun = async (autoStartRender: boolean) => {
    const allProdImgs = skuReferenceImages.filter((r) => r.category !== 'case');
    const enabledProds = filterEnabledProds(allProdImgs);
    const prodImgs = enabledProds.length > 0 ? enabledProds : allProdImgs;
    const caseImgs = skuReferenceImages.filter((r) => r.category === 'case');

    if (prodImgs.length === 0 && caseImgs.length === 0) {
      showToast('请先上传参考图与产品原图', 'error');
      return;
    }

    const rawMatchMode =
      skuBatchConfig.replicaMatchMode ||
      (prodImgs.length > 1 && caseImgs.length <= 1
        ? 'multi_prod_to_single_ref'
        : 'single_prod_to_multi_ref');
    const isSingleProdMultiCase =
      rawMatchMode === 'single_prod_to_multi_ref' ||
      rawMatchMode === 'single_prod_multi_case';
    const matchMode: ReplicaMatchMode = isSingleProdMultiCase
      ? 'single_prod_to_multi_ref'
      : 'multi_prod_to_single_ref';

    const pairCount = isSingleProdMultiCase
      ? Math.max(1, caseImgs.length)
      : Math.max(1, prodImgs.length);

    const textModeForReplica: TextRenderMode =
      skuBatchConfig.replicaLanguage === 'none' ? 'without_text' : 'with_text';

    const rawCat = skuBatchConfig.replicaCategory || 'ecommerce_product';
    const normalizedCategory: ReplicaCategory =
      rawCat === 'ecom_product' ? 'ecommerce_product' : rawCat;

    const builtTasks: SkuTask[] = Array.from({ length: pairCount }).map(
      (_, idx) => {
        const prod = isSingleProdMultiCase
          ? prodImgs[0]
          : prodImgs[idx % Math.max(1, prodImgs.length)];
        const refCase = isSingleProdMultiCase
          ? caseImgs[idx % Math.max(1, caseImgs.length)]
          : caseImgs[0];

        const existing = skuTasks[idx];
        const defaultTitle = isSingleProdMultiCase
          ? `复刻场景 ${idx + 1}${prod?.tag ? ` · ${prod.tag}` : ''}`
          : prod?.tag || `款式 ${idx + 1}`;

        // 智能姿态对位：套图模式下根据参考图 (#Case) 的标签/要求自动从已启用产品图中配对互补角度（如开盖/单耳）
        const smartAlignedProdIds = isSingleProdMultiCase
          ? smartPickComplementaryProds({
              skuDiffMode: skuBatchConfig.skuDiffMode,
              title: `${refCase?.tag || ''} ${refCase?.caseCustomRule || ''} ${ existing?.skuTitle || defaultTitle }`,
              prompt: existing?.visualPrompt || '',
              enabledProds: prodImgs,
              preferredPrimaryProdId: prod?.id,
            }).map((p) => p.id)
          : prod
            ? [prod.id]
            : [];

        return {
          id: existing?.id || `replica-task-${Date.now()}-${idx}`,
          skuIndex: idx + 1,
          skuDiffMode: skuBatchConfig.skuDiffMode,
          skuTitle: existing?.skuTitle?.trim() || defaultTitle,
          sellingPointBadge:
            existing?.sellingPointBadge ||
            refCase?.caseCustomRule ||
            skuBatchConfig.referenceInfoText ||
            '',
          packageSpecNote: existing?.packageSpecNote || '',
          typographyPlan: existing?.typographyPlan || '',
          visualPrompt: existing?.visualPrompt || '',
          textMode: textModeForReplica,
          productRefIds:
            existing?.productRefIds && existing.productRefIds.length > 0
              ? existing.productRefIds
              : smartAlignedProdIds,
          caseRefIds: refCase ? [refCase.id] : [],
          aspectRatio: skuBatchConfig.defaultAspectRatio,
          imageSize: skuBatchConfig.defaultImageSize,
          replicaCategory: normalizedCategory,
          replicaFidelity: skuBatchConfig.replicaFidelity || 'high_replica',
          consistentOutputStyle:
            skuBatchConfig.consistentOutputStyle !== false,
          styleLinkageMode: skuBatchConfig.styleLinkageMode || 'print_4d',
          printThemeConfig: existing?.printThemeConfig,
          replicaLanguage: skuBatchConfig.replicaLanguage || 'zh',
          singleRequirement: refCase?.caseCustomRule || '',
          perRefRequirement: refCase?.caseCustomRule || '',
          status: existing?.resultImageUrl && !autoStartRender ? 'completed' : 'idle',
          resultImageUrl: existing?.resultImageUrl,
          resultOssUrl: existing?.resultOssUrl,
          resultCloudUrls: existing?.resultCloudUrls,
          lockResultAsRef: existing?.lockResultAsRef,
          refineInstruction: existing?.refineInstruction,
          historyImages: existing?.historyImages || [],
        };
      }
    );

    setSkuTasks(builtTasks);
    skuTasksRef.current = builtTasks;

    const needsAiPlanFirst =
      !autoStartRender ||
      builtTasks.some(
        (t) => !t.visualPrompt?.trim() || !t.printThemeConfig?.themePalette
      );

    let finalTasksToRun = builtTasks;

    if (needsAiPlanFirst) {
      setIsParsingSkuPlan(true);
      try {
        const planRes = await studioBridge.planReplicaTasks({
          productImages: prodImgs.map((r) => toLightweightRefPayload(r)),
          referenceImages: caseImgs.map((c) => ({
            ...toLightweightRefPayload(c),
            perRefRequirement: c.caseCustomRule || '',
          })),
          matchMode,
          replicaCategory: normalizedCategory,
          replicaFidelity: skuBatchConfig.replicaFidelity || 'high_replica',
          consistentOutputStyle: skuBatchConfig.consistentOutputStyle !== false,
          styleLinkageMode: skuBatchConfig.styleLinkageMode || 'print_4d',
          globalRequirement: skuBatchConfig.referenceInfoText,
          language: skuBatchConfig.replicaLanguage || 'zh',
          aspectRatio: skuBatchConfig.defaultAspectRatio,
          imageSize: skuBatchConfig.defaultImageSize,
          agentModel: config.agentModel,
          ...getActiveChannelBridgeParams(),
          ossConfig: config.ossConfig,
        });

        if (
          Array.isArray(planRes.detectedProdRoles) &&
          planRes.detectedProdRoles.length > 0
        ) {
          const roleMap = new Map(
            planRes.detectedProdRoles.map((r) => [r.id, r])
          );
          setSkuReferenceImages((prev) =>
            prev.map((img) => {
              const matched = roleMap.get(img.id);
              if (!matched) return img;
              return {
                ...img,
                prodAngleRole:
                  (matched.prodAngleRole as any) || img.prodAngleRole,
                tag: matched.tag || img.tag,
              };
            })
          );
        }

        const returnedList = planRes.replicaTasks;
        if (Array.isArray(returnedList) && returnedList.length > 0) {
          const validProdIdSet = new Set(prodImgs.map((p) => p.id));
          const updated = builtTasks.map((t, i) => {
            const planned = returnedList[i];
            if (!planned) return t;
            const nextTitle = sanitizeCopywritingForRender(
              planned.title || t.skuTitle
            );
            const nextBadge = sanitizeCopywritingForRender(
              planned.copywriting || t.sellingPointBadge
            );
            const rawAiProdIds = (planned.boundProductIds || []).filter((id) =>
              validProdIdSet.has(id)
            );
            const caseForCard = caseImgs.find((c) =>
              t.caseRefIds.includes(c.id)
            );
            const sanitizedPromptText = sanitizeVisualPromptForRender(
              planned.visualPrompt || t.visualPrompt,
              prodImgs
            );
            const alignedProds = limitAndOrderTaskProdsForRender(
              rawAiProdIds.length > 0 ? rawAiProdIds : t.productRefIds,
              prodImgs,
              {
                moduleOrTitleHint: `${nextTitle} ${nextBadge} ${caseForCard?.tag || ''} ${caseForCard?.caseCustomRule || ''} ${sanitizedPromptText}`,
              }
            );
            return {
              ...t,
              skuTitle: nextTitle,
              sellingPointBadge: nextBadge,
              typographyPlan:
                Array.from(
                  new Set(
                    [nextTitle, nextBadge, t.packageSpecNote]
                      .map((s) => (s || '').trim())
                      .filter(Boolean)
                  )
                ).join('\n') ||
                sanitizeCopywritingForRender(
                  planned.typographyPlan || t.typographyPlan
                ),
              visualPrompt: sanitizedPromptText,
              productRefIds:
                alignedProds.length > 0
                  ? alignedProds.map((p) => p.id)
                  : t.productRefIds.slice(0, 2),
              printThemeConfig: planned.printThemeConfig || t.printThemeConfig,
            };
          });
          finalTasksToRun = updated;
          setSkuTasks(updated);
          skuTasksRef.current = updated;
          if (!autoStartRender) {
            showToast(
              `已基于左侧勾选的 ${prodImgs.length} 张产品图排布 ${updated.length} 张复刻卡片（含互补角度配图与印花4维联动配方），可微调后出图`,
              'success'
            );
          }
        }
      } catch (err: any) {
        if (!autoStartRender) {
          showToast(
            err?.message || '已生成复刻配对卡片，可直接点击一键复刻出图',
            'info'
          );
        }
      } finally {
        setIsParsingSkuPlan(false);
      }
    }

    if (autoStartRender) {
      await handleStartBatchGenerateSkus(false, finalTasksToRun);
    }
  };

  // ================= MODULAR DETAIL STUDIO HANDLERS =================
  const handleAddDetailModuleTask = (moduleType: DetailModuleType) => {
    const meta =
      DETAIL_MODULE_PRESETS.find((m) => m.type === moduleType) ||
      DETAIL_MODULE_PRESETS[0];
    const allDetailProds = referenceImages.filter((r) => r.category !== 'case');
    const enabledProds = filterEnabledProds(allDetailProds);
    const detailProds = enabledProds.length > 0 ? enabledProds : allDetailProds;

    setTasks((prev) => {
      const nextNum = prev.length + 1;
      const sameTypeCount =
        prev.filter((t) => t.moduleType === moduleType).length + 1;
      const resolvedTitle =
        moduleType === 'selling_point'
          ? `核心卖点 ${sameTypeCount}`
          : meta.label;

      const defaultProds = smartPickComplementaryProds(
        detailProds,
        moduleType === 'selling_point'
          ? `${resolvedTitle} ${meta.defaultPromptHint || ''}`
          : moduleType,
        moduleType === 'series_matrix' ? 4 : 2
      ).map((p) => p.id);

      const created: ScreenTask = {
        id: `detail-mod-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        screenNumber: nextNum,
        screenCategory: 'detail',
        moduleType,
        layerType: 'dynamic',
        title: resolvedTitle,
        sectionType: meta.label,
        copywriting: '',
        typographyPlan: '',
        benchmarkCase: '整页统一视觉规范驱动 · 0竞品原图干扰',
        visualPrompt: meta.defaultPromptHint || meta.promptSkeleton || '',
        textMode: config.requirements.textMode,
        referenceImageIds: defaultProds,
        caseDeliveryOverride: 'none',
        aspectRatio: config.requirements.detailAspectRatio,
        imageSize: config.defaultImageSize,
        status: 'idle',
        historyImages: [],
      };
      const next = [...prev, created];
      tasksRef.current = next;
      return next;
    });
  };

  const handleApplyStandardPresetModules = () => {
    const standardSequence: DetailModuleType[] = [
      'kv_hero',
      'selling_point',
      'selling_point',
      'series_matrix',
      'spec_table',
      'package_contents',
      'after_sales',
    ];
    const allDetailProds = referenceImages.filter((r) => r.category !== 'case');
    const enabledProds = filterEnabledProds(allDetailProds);
    const detailProds = enabledProds.length > 0 ? enabledProds : allDetailProds;
    let spCounter = 0;

    const createdList: ScreenTask[] = standardSequence.map((modType, idx) => {
      const meta =
        DETAIL_MODULE_PRESETS.find((m) => m.type === modType) ||
        DETAIL_MODULE_PRESETS[0];
      if (modType === 'selling_point') spCounter += 1;
      const title =
        modType === 'selling_point' ? `核心卖点 ${spCounter}` : meta.label;
      const boundIds = smartPickComplementaryProds(
        detailProds,
        modType === 'selling_point' && spCounter === 2
          ? 'comfort_wear'
          : modType,
        modType === 'series_matrix' ? 4 : 2
      ).map((p) => p.id);

      return {
        id: `detail-std-${Date.now()}-${idx}`,
        screenNumber: idx + 1,
        screenCategory: 'detail',
        moduleType: modType,
        layerType: 'dynamic',
        title,
        sectionType: meta.label,
        copywriting: '',
        typographyPlan: '',
        benchmarkCase: '整页统一视觉规范驱动 · 0竞品原图干扰',
        visualPrompt: meta.defaultPromptHint || meta.promptSkeleton || '',
        textMode: config.requirements.textMode,
        referenceImageIds: boundIds,
        caseDeliveryOverride: 'none',
        aspectRatio: config.requirements.detailAspectRatio,
        imageSize: config.defaultImageSize,
        status: 'idle',
        historyImages: [],
      };
    });

    setTasks(createdList);
    tasksRef.current = createdList;
    showToast('已加载标准 7 屏电商详情页模块，点击左下角可由 AI 一键生成各屏文案与描述', 'success');
  };

  const handleMoveDetailTask = (taskId: string, direction: 'up' | 'down') => {
    setTasks((prev) => {
      const idx = prev.findIndex((t) => t.id === taskId);
      if (idx === -1) return prev;
      const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= prev.length) return prev;
      const copy = [...prev];
      [copy[idx], copy[targetIdx]] = [copy[targetIdx], copy[idx]];
      const next = copy.map((t, i) => ({ ...t, screenNumber: i + 1 }));
      tasksRef.current = next;
      return next;
    });
  };

  const handleDuplicateDetailTask = (task: ScreenTask) => {
    setTasks((prev) => {
      const idx = prev.findIndex((t) => t.id === task.id);
      const clone: ScreenTask = {
        ...task,
        id: `detail-dup-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        title: `${task.title} (副本)`,
        status: 'idle',
        resultImageUrl: undefined,
        resultOssUrl: undefined,
        resultCloudUrls: undefined,
        lockResultAsRef: false,
        refineInstruction: '',
        historyImages: [],
      };
      const next = [...prev];
      next.splice(idx + 1, 0, clone);
      const reindexed = next.map((t, i) => ({ ...t, screenNumber: i + 1 }));
      tasksRef.current = reindexed;
      return reindexed;
    });
  };

  const handleDeleteDetailTask = (taskId: string) => {
    setTasks((prev) => {
      const next = prev
        .filter((t) => t.id !== taskId)
        .map((t, i) => ({ ...t, screenNumber: i + 1 }));
      tasksRef.current = next;
      return next;
    });
  };

  const handleExtractCompetitorDetailStyle = async () => {
    const compCases = referenceImages.filter((r) => r.category === 'case');
    if (compCases.length === 0) {
      showToast('请先上传至少 1 张竞品详情图', 'error');
      return;
    }
    const detailProds = referenceImages.filter((r) => r.category !== 'case');
    setIsAnalyzingRefs(true);
    try {
      const res = await studioBridge.extractDetailStyle({
        competitorImages: compCases.map((c) => toLightweightRefPayload(c)),
        productImages: detailProds.map((p) => toLightweightRefPayload(p)),
        productInfoText,
        agentModel: config.agentModel,
        ...getActiveChannelBridgeParams(),
        ossConfig: config.ossConfig,
      });
      if (res.unifiedVisualSpec) {
        setConfig((prev) => ({
          ...prev,
          requirements: {
            ...prev.requirements,
            unifiedVisualSpec: res.unifiedVisualSpec,
            caseDeliveryMode: 'none',
          },
        }));
        const extractedHexes = Array.from(
          new Set(
            (res.unifiedVisualSpec.match(/#[0-9A-Fa-f]{6}\b/g) || []).map((m) =>
              m.toUpperCase()
            )
          )
        );
        if (extractedHexes.length >= 2) {
          const syncedPalette = `60%主背景(${extractedHexes[0]}) + 30%同色系展台(${extractedHexes[1]}) + 10%高光点缀(${extractedHexes[2] || extractedHexes[1]})`;
          setTasks((prev) => {
            const next = prev.map((t) =>
              t.printThemeConfig
                ? {
                    ...t,
                    printThemeConfig: {
                      ...t.printThemeConfig,
                      themePalette: syncedPalette,
                    },
                  }
                : t
            );
            tasksRef.current = next;
            return next;
          });
        }
        showToast(
          '已成功提取《整页6锚点统一视觉规范》并同步全页色板！生图时将仅传自有产品图+该规范，杜绝竞品原图干扰',
          'success'
        );
      }
    } catch (err: any) {
      showToast(err?.message || '提取竞品视觉规范失败', 'error');
    } finally {
      setIsAnalyzingRefs(false);
    }
  };

  // Update #Prod angle role in SKU Studio
  const handleUpdateSkuProdRole = (refId: string, role: string) => {
    setSkuReferenceImages((prev) =>
      prev.map((item) =>
        item.id === refId ? { ...item, prodAngleRole: role as any } : item
      )
    );
  };

  // Update #Prod angle role in Detail Studio
  const handleUpdateDetailProdRole = (refId: string, role: string) => {
    setReferenceImages((prev) =>
      prev.map((item) =>
        item.id === refId ? { ...item, prodAngleRole: role as any } : item
      )
    );
  };

  const handleUpdateDetailAssetTag = (refId: string, newTag: string) => {
    setReferenceImages((prev) =>
      prev.map((item) => (item.id === refId ? { ...item, tag: newTag } : item))
    );
  };

  // Toggle & Batch-set #Prod participation in SKU Studio
  const handleToggleSkuAssetEnabled = (refId: string) => {
    setSkuReferenceImages((prev) =>
      prev.map((item) =>
        item.id === refId
          ? { ...item, enabled: item.enabled === false ? true : false }
          : item
      )
    );
  };

  const handleBatchSetSkuAssetsEnabled = (mode: QuickAssetSelectMode) => {
    setSkuReferenceImages((prev) => applyQuickAssetSelectionMode(prev, mode));
    const modeLabel =
      mode === 'all'
        ? '已全选所有产品图参与生图'
        : mode === 'single_sku_multi_angle'
          ? '已智选「1款主推花色 + 多角度特写」，防止多花色混投变形'
          : mode === 'multi_sku_front_only'
            ? '已智选「各款不同花色正面图」，适合全家福与多花色裂变'
            : '已反选产品图参与状态';
    showToast(modeLabel, 'success');
  };

  // Toggle & Batch-set #Prod participation in Detail Studio
  const handleToggleDetailAssetEnabled = (refId: string) => {
    setReferenceImages((prev) =>
      prev.map((item) =>
        item.id === refId
          ? { ...item, enabled: item.enabled === false ? true : false }
          : item
      )
    );
  };

  const handleBatchSetDetailAssetsEnabled = (mode: QuickAssetSelectMode) => {
    setReferenceImages((prev) => applyQuickAssetSelectionMode(prev, mode));
    const modeLabel =
      mode === 'all'
        ? '已全选所有产品图参与详情页生成'
        : mode === 'single_sku_multi_angle'
          ? '已智选「1款主推花色 + 多角度特写」，防止详情页多花色打架变形'
          : mode === 'multi_sku_front_only'
            ? '已智选「各款不同花色正面图」，适合多花色矩阵屏'
            : '已反选产品图参与状态';
    showToast(modeLabel, 'success');
  };

  // Build Standard 5 Main Image Cards (KV首焦 + Bento全卖点 + 单卖点深挖1 + 单卖点深挖2 + 多花色全家福)
  const handleBuildStandardFiveMainCards = () => {
    const allSkuProds = skuReferenceImages.filter((r) => r.category !== 'case');
    const enabledSkuProds = filterEnabledProds(allSkuProds);
    const skuProds = enabledSkuProds.length > 0 ? enabledSkuProds : allSkuProds;
    const skuCases = skuReferenceImages.filter((r) => r.category === 'case');

    const primaryHeroProd =
      skuProds.find(
        (p) => inferProdAngleRoleFromAsset(p) === 'hero_front'
      ) || skuProds[0];

    const pickSlotProdIds = (
      slotTitle: string,
      slotPrompt: string,
      isMatrixSlot = false
    ) => {
      const picked = smartPickComplementaryProds({
        skuDiffMode: isMatrixSlot ? 'multi_sku' : skuBatchConfig.skuDiffMode,
        title: slotTitle,
        prompt: slotPrompt,
        enabledProds: skuProds,
        preferredPrimaryProdId: primaryHeroProd?.id,
        maxCount: isMatrixSlot ? 6 : 2,
      });
      return picked.map((p) => p.id);
    };

    const fiveSlots = [
      {
        title: '主图1 · 旗舰首焦KV视觉',
        badge: '旗舰新品 · 高颜值潮玩声学体验',
        spec: '蓝牙V6.0 | ENC通话降噪 | 舒适久戴',
        prompt:
          '电商主图首焦KV构图：居中偏下打造圆润潮玩主题微缩底座，产品开盖或正面高光C位展示，上方预留呼吸感大标题视觉区，底部搭配同色系浅色圆角卖点信息栏。',
        prodIds: pickSlotProdIds(
          '主图1 · 旗舰首焦KV视觉',
          '产品开盖与正面高光C位展示'
        ),
      },
      {
        title: '主图2 · 核心卖点Bento宫格合集',
        badge: '全能配置 · 六大核心科技一图看懂',
        spec: '复合振膜声学 | 双模式低延迟 | 超长续航',
        prompt:
          '电商主图Bento模块化信息宫格构图：上方展示产品多角度高光主体，下方划分为4~6个圆角磨砂信息宫格卡片，清晰呈现声学振膜、蓝牙芯片、续航与降噪核心卖点。',
        prodIds: pickSlotProdIds(
          '主图2 · 核心卖点Bento宫格合集',
          '产品正面与开盖细节展示'
        ),
      },
      {
        title: '主图3 · 声学音质/降噪单卖点深挖',
        badge: '殿堂级HIFI声学 · 沉浸式纯净听感',
        spec: '13mm大动圈单元 | 智能自适应ENC降噪',
        prompt:
          '单卖点特写深挖构图：微距高光呈现产品声学结构与腔体细节，背景环绕同色系半透明声波能量环与漂浮3D音符装饰，底部并列双圆角浅色信息卡对比音乐/游戏模式。',
        prodIds: pickSlotProdIds(
          '主图3 · 声学音质/降噪单卖点深挖',
          '单耳声学腔体与微距结构细节'
        ),
      },
      {
        title: '主图4 · 云感舒适佩戴体验深挖',
        badge: '人体工学云感贴合 · 轻若无物久戴不痛',
        spec: '羽量级机身 | 亲肤柔韧材质 | 狂甩不掉',
        prompt:
          '舒适佩戴与轻量质感特写构图：单耳/侧面优雅悬浮于蓬松云朵与羽毛质感微缩舞台上，直观传递轻盈零压迫感，底部配置双圆角浅色参数信息卡。',
        prodIds: pickSlotProdIds(
          '主图4 · 云感舒适佩戴体验深挖',
          '单耳入耳舒适佩戴特写'
        ),
      },
      {
        title: '主图5 · 多彩印花SKU全家福矩阵',
        badge: '多款潮玩印花 · 每一款都有专属个性',
        spec: '全系花色集结 · 百搭潮酷出街',
        prompt:
          '多花色SKU全家福阵列构图：采用对角线阶梯或扇形色块阵列排布多款不同印花/配色的产品主体，每款下方对应同色系丝滑色带与光影，展现丰富潮玩系列感。',
        prodIds: pickSlotProdIds(
          '主图5 · 多彩印花SKU全家福矩阵',
          '多花色SKU全家福阵列',
          true
        ),
      },
    ];

    const createdTasks: SkuTask[] = fiveSlots.map((slot, idx) => {
      const matchedCase =
        skuCases.length > 0 ? [skuCases[idx % skuCases.length].id] : [];
      const firstProd = skuProds.find((p) => slot.prodIds.includes(p.id));
      const tagHint = firstProd?.tag || slot.title;
      return {
        id: `sku-std5-${Date.now()}-${idx}`,
        skuIndex: idx + 1,
        skuDiffMode: skuBatchConfig.skuDiffMode,
        skuTitle: slot.title,
        colorMaterialNote: firstProd?.tag || '严格还原产品实拍图外观与印花',
        sellingPointBadge: slot.badge,
        packageSpecNote: slot.spec,
        typographyPlan: `${slot.title}\n${slot.badge}\n${slot.spec}`,
        visualPrompt: slot.prompt,
        productRefIds: slot.prodIds,
        caseRefIds: matchedCase,
        textMode:
          skuBatchConfig.replicaLanguage === 'none'
            ? 'without_text'
            : skuBatchConfig.textMode,
        aspectRatio: skuBatchConfig.defaultAspectRatio,
        imageSize: skuBatchConfig.defaultImageSize,
        replicaCategory: skuBatchConfig.replicaCategory || 'ecommerce_product',
        replicaFidelity: skuBatchConfig.replicaFidelity || 'high_replica',
        consistentOutputStyle: skuBatchConfig.consistentOutputStyle !== false,
        styleLinkageMode: skuBatchConfig.styleLinkageMode || 'print_4d',
        replicaLanguage: skuBatchConfig.replicaLanguage || 'zh',
        printThemeConfig: {
          enabled: true,
          printStory: `${tagHint} · 潮玩主题联动视觉`,
          themePalette:
            '60%高明度马卡龙同色系渐变背景(#FFF0F5) + 30%奶油果冻质感圆台(#FCE7F3) + 10%糖果色高光点缀(#EC4899)',
          themeStage: '泡泡玛特风圆润软胶与亚克力双层微缩底座',
          themeElements: '2~3个与机身印花呼应的3D漂浮软胶小道具与透明气泡',
          themeUiStyle:
            '与印花同色系的浅奶油色圆角矩形信息卡(严禁生硬黑棕色块)',
        },
        status: 'idle',
        historyImages: [],
      };
    });

    setSkuTasks(createdTasks);
    skuTasksRef.current = createdTasks;
    showToast(
      '已创建标准 5 张高转化电商主图槽位（首焦KV + Bento全卖点 + 双卖点深挖 + 多花色全家福）！',
      'success'
    );
  };

  // Fission a single SkuTask across multiple other #Prod patterns/colorways
  const handleFissionTaskToOtherProds = async (
    sourceTask: SkuTask,
    targetProdIds: string[],
    useResultAsCase: boolean,
    autoRunAfter = false
  ) => {
    if (targetProdIds.length === 0) {
      showToast('请至少勾选 1 个目标花色产品图 (#Prod)', 'error');
      return;
    }

    let promotedCaseId: string | null = null;
    let nextRefPool = skuReferenceImages;
    if (useResultAsCase && sourceTask.resultImageUrl) {
      const newCaseId = `case-fission-${Date.now()}`;
      promotedCaseId = newCaseId;
      const rawUrl = sourceTask.resultImageUrl;
      const extractedBase64 = rawUrl.startsWith('data:') && rawUrl.includes(',')
        ? rawUrl.split(',')[1]
        : '';
      const newCaseItem: ReferenceImageItem = {
        id: newCaseId,
        code: `C${skuReferenceImages.filter((r) => r.category === 'case').length + 1}`,
        name: `裂变母版_${sourceTask.skuTitle}.png`,
        tag: `裂变母版·${sourceTask.skuTitle}`,
        category: 'case',
        mimeType: 'image/png',
        base64Data: extractedBase64,
        previewUrl: rawUrl,
        ossUrl: sourceTask.resultOssUrl,
        isLockBaseSwap: true,
        caseDimensions: ['pose', 'style', 'structure', 'lighting'],
      };
      nextRefPool = reindexReferenceCodes([...skuReferenceImages, newCaseItem]);
      setSkuReferenceImages(nextRefPool);
    }

    const palettePool = [
      {
        keywords: ['钓鱼', '鱼', '海', '浪', '企鹅', '冲浪', '冰', '鲸', 'blue'],
        palette:
          '60%奶盐海浪蓝(#F0F9FF) + 30%马卡龙天蓝(#BAE6FD) + 10%活力柠檬黄(#FDE047)',
        stage: '微缩清透果冻海浪圆盘与奶油沙滩浮标双层展台',
        elements: '漂浮3D迷你幸运鱼罐头、透明水珠泡泡与Q版小海星',
        ui: '冰川奶蓝毛玻璃圆角卖点信息卡(严禁黑棕色块)，深海蓝圆体字与亮黄星标',
      },
      {
        keywords: ['芝士', '奶酪', '黄', '鼠', '火箭', '星', '鸭', '花洒', 'cheese'],
        palette:
          '60%奶油起司黄(#FEF9C3) + 30%暖杏仁奶白(#FEF3C7) + 10%焦糖芝士橙(#F59E0B)',
        stage: '多孔切达奶酪块微缩底座与奶油环形柔光跑道展台',
        elements: '漂浮3D迷你三角芝士块、小星球光环与Q版立体音符',
        ui: '浅奶油黄磨砂圆角矩形信息卡(严禁黑棕色块)，暖棕圆体字与亮黄星标',
      },
      {
        keywords: ['水豚', '温泉', '橘', '橙', '松鼠', '烘焙', '面包', '拉面', '茶'],
        palette:
          '60%暖杏奶茶米(#FFFBEB) + 30%蜜柑果冻橙(#FFEDD5) + 10%焦糖肉桂橘(#F97316)',
        stage: '日式暖木汤屋圆润微缩托盘与奶油蒸汽云朵展台',
        elements: '漂浮3D迷你小柑橘、暖白温泉水汽团与圆润治愈小木牌',
        ui: '暖杏奶油色磨砂圆角卖点信息卡(严禁黑棕色块)，焦糖深棕圆体字',
      },
      {
        keywords: ['兔', '梦', '紫', '月', '云', '船', '夜', 'dream'],
        palette:
          '60%梦幻薰衣草紫(#F3E8FF) + 30%雾面婴儿蓝(#E0F2FE) + 10%暖金星芒黄(#FDE047)',
        stage: '软糯棉花糖云朵微缩托盘与半透明弯月星轨底座',
        elements: '漂浮3D微笑云朵、金色小十字星芒与奶油睡眠泡泡',
        ui: '浅丁香紫毛玻璃圆角卖点信息卡，深紫罗兰圆润字体与暖金细边框',
      },
      {
        keywords: ['刺猬', '梨', '露营', '绿', '森', '花', '蘑菇', 'camp'],
        palette:
          '60%牛油果奶绿(#ECFDF5) + 30%燕麦奶油白(#FEFCE8) + 10%阳光雏菊黄(#FACC15)',
        stage: '微缩森系奶油花朵圆盘底座与果冻质感阶梯舞台',
        elements: '漂浮3D软胶小雏菊、微缩立体洋梨与露营小星火',
        ui: '浅抹茶奶白圆角贴纸式卖点信息卡，森系深绿圆体字与鹅黄微标',
      },
      {
        keywords: ['粉', '桃', '猫', '爱', '草', '苺', '气球', 'pink'],
        palette:
          '60%奶油蜜桃粉(#FFF0F3) + 30%草莓牛奶粉(#FFD6E0) + 10%糖果玫红(#FF4D79)',
        stage: '泡泡玛特风圆润果冻亚克力与奶油云朵双层微缩展台',
        elements: '漂浮3D软胶小爱心、微缩透明气泡球与立体Q版小星星',
        ui: '奶油草莓粉磨砂圆角矩形信息卡(严禁黑棕色块)，配圆体柔光标题',
      },
    ];

    // Preserve any structural complementary angle (open_case / single_earbud / detail_closeup) from the master card so open-case or earbud poses don't lose internal structure reference
    const sourceComplementaryAngleIds = sourceTask.productRefIds.filter((id) => {
      const item = nextRefPool.find((r) => r.id === id);
      if (!item) return false;
      const role = item.prodAngleRole || inferProdAngleRoleFromAsset(item);
      return (
        role === 'open_case' ||
        role === 'single_earbud' ||
        role === 'detail_closeup'
      );
    });

    const startIdx = skuTasksRef.current.length;
    const fissioned: SkuTask[] = targetProdIds.map((prodId, idx) => {
      const prod = nextRefPool.find((r) => r.id === prodId);
      const prodLabel = (prod?.tag || `花色款式 ${idx + 1}`)
        .replace(/[-_·]*(?:闭盖|合盖)?正立面|正面印花/g, '')
        .trim();
      const matchedPreset =
        palettePool.find((p) =>
          p.keywords.some((kw) => prodLabel.toLowerCase().includes(kw))
        ) || palettePool[idx % palettePool.length];
      const baseTitle = sourceTask.skuTitle.replace(/·.*$/, '').trim();
      const nextTitle = `${baseTitle} · ${prodLabel}`;
      const combinedProdIds = Array.from(
        new Set([prodId, ...sourceComplementaryAngleIds])
      ).slice(0, 2);

      return {
        ...sourceTask,
        id: `sku-fission-${Date.now()}-${idx}`,
        skuIndex: startIdx + idx + 1,
        skuTitle: nextTitle,
        colorMaterialNote: `严格还原「${prodLabel}」机身印花与材质配色`,
        typographyPlan: sanitizeCopywritingForRender(
          [
            nextTitle,
            sourceTask.sellingPointBadge,
            sourceTask.packageSpecNote,
          ]
            .map((s) => (s || '').trim())
            .filter(Boolean)
            .join('\n')
        ),
        visualPrompt: sanitizeVisualPromptForRender(sourceTask.visualPrompt),
        productRefIds: combinedProdIds,
        caseRefIds: promotedCaseId
          ? [promotedCaseId]
          : sourceTask.caseRefIds,
        printThemeConfig: {
          enabled: sourceTask.styleLinkageMode !== 'lock_scene',
          printStory: `${prodLabel} · 专属印花4维联动微缩场景`,
          themePalette: matchedPreset.palette,
          themeStage:
            useResultAsCase && sourceTask.printThemeConfig?.themeStage
              ? sourceTask.printThemeConfig.themeStage
              : matchedPreset.stage,
          themeElements: `围绕「${prodLabel}」衍生：${matchedPreset.elements}`,
          themeUiStyle: matchedPreset.ui,
        },
        status: 'idle',
        resultImageUrl: undefined,
        resultOssUrl: undefined,
        errorMessage: undefined,
        historyImages: [],
      };
    });

    const nextAllTasks = [...skuTasksRef.current, ...fissioned];
    skuTasksRef.current = nextAllTasks;
    setSkuTasks(nextAllTasks);

    showToast(
      `已按「${sourceTask.skuTitle}」母版裂变创建 ${targetProdIds.length} 张新花色卡片${sourceComplementaryAngleIds.length > 0 ? '（已自动继承互补结构视角）' : ''}！`,
      'success'
    );

    if (autoRunAfter && fissioned.length > 0) {
      await handleStartBatchGenerateSkus(false, fissioned, nextRefPool);
    }
  };

  // Sync #Prod assets (and optionally tasks if Detail Studio is empty or targetRatio is explicitly passed) from SKU Studio to Detail Studio
  const handleSyncFromSkuStudioToDetail = (targetRatio?: AspectRatioOption) => {
    const skuProds = skuReferenceImages.filter((r) => r.category !== 'case');
    if (skuProds.length === 0 && skuTasks.length === 0) {
      showToast('主图工作台暂无可同步的产品图或主图卡片', 'error');
      return;
    }

    if (skuTasks.length > 0 && (targetRatio || tasks.length === 0)) {
      handleExtendReplicaToDetail(
        targetRatio || config.requirements.detailAspectRatio
      );
      return;
    }

    // Sync both missing assets AND updated enabled/prodAngleRole/tag states from SKU Studio
    const skuByKey = new Map<string, ReferenceImageItem>();
    for (const sp of skuProds) {
      skuByKey.set(sp.id, sp);
      if (sp.name) skuByKey.set(`name:${sp.name}`, sp);
    }

    const existingIds = new Set(referenceImages.map((r) => r.id));
    const missingProds = skuProds.filter((p) => !existingIds.has(p.id));

    setReferenceImages((prev) => {
      const updatedExisting = prev.map((r) => {
        if (r.category === 'case') return r;
        const match = skuByKey.get(r.id) || (r.name ? skuByKey.get(`name:${r.name}`) : undefined);
        if (!match) return r;
        return {
          ...r,
          enabled: match.enabled,
          prodAngleRole: match.prodAngleRole || r.prodAngleRole,
          tag: match.tag || r.tag,
        };
      });
      return reindexReferenceCodes([...updatedExisting, ...missingProds]);
    });

    showToast(
      missingProds.length > 0
        ? `已从主图工作台同步 ${missingProds.length} 张产品原图及全部勾选/视角标签至详情页工作台！`
        : '已将主图工作台的产品勾选启用状态与视角标签同步至详情页！',
      'success'
    );
  };

  // Append tail 3 standard detail modules (规格参数表 + 包装清单 + 售后保障) with 4D Print Theme inheritance
  const handleAppendTailDetailModules = () => {
    const tailTypes: DetailModuleType[] = [
      'spec_table',
      'package_contents',
      'after_sales',
    ];
    const detailProds = referenceImages.filter((r) => r.category !== 'case');
    setTasks((prev) => {
      const startNum = prev.length;
      const inheritedTheme =
        prev.find(
          (t) =>
            t.printThemeConfig?.enabled !== false &&
            Boolean(
              t.printThemeConfig?.themePalette || t.printThemeConfig?.printStory
            )
        )?.printThemeConfig ||
        skuTasks.find(
          (t) =>
            t.printThemeConfig?.enabled !== false &&
            Boolean(
              t.printThemeConfig?.themePalette || t.printThemeConfig?.printStory
            )
        )?.printThemeConfig;

      const appended: ScreenTask[] = tailTypes.map((modType, idx) => {
        const meta =
          DETAIL_MODULE_PRESETS.find((m) => m.type === modType) ||
          DETAIL_MODULE_PRESETS[0];
        return {
          id: `detail-tail-${Date.now()}-${idx}`,
          screenNumber: startNum + idx + 1,
          screenCategory: 'detail',
          moduleType: modType,
          layerType: 'static',
          title: meta.label,
          sectionType: meta.label,
          copywriting: '',
          typographyPlan: '',
          benchmarkCase: '整页统一视觉规范驱动 · 0竞品原图干扰',
          visualPrompt: meta.defaultPromptHint || meta.promptSkeleton || '',
          textMode: config.requirements.textMode,
          referenceImageIds: detailProds.slice(0, 1).map((p) => p.id),
          caseDeliveryOverride: 'none',
          printThemeConfig: inheritedTheme
            ? {
                ...inheritedTheme,
                enabled: true,
                themeElements:
                  modType === 'after_sales'
                    ? '同色系圆润3D盾牌徽章与正品保障微标'
                    : inheritedTheme.themeElements,
              }
            : undefined,
          aspectRatio: config.requirements.detailAspectRatio,
          imageSize: config.defaultImageSize,
          status: 'idle',
          historyImages: [],
        };
      });
      const next = [...prev, ...appended];
      tasksRef.current = next;
      return next;
    });
    showToast(
      '已追加收尾 3 屏（规格参数表 + 包装清单 + 售后保障），并自动继承前序印花4维配色体系！',
      'success'
    );
  };

  // Extend 1:1 / 3:4 Main Image Replica Card(s) directly into Detail Page Studio (3:4 or 9:16)
  const handleExtendReplicaToDetail = (
    targetRatio: AspectRatioOption,
    singleTask?: SkuTask,
    useResultAsAnchor = true
  ) => {
    const sourceList = singleTask ? [singleTask] : skuTasks;
    if (sourceList.length === 0) {
      showToast('请先在主图复刻工作台排卡或生成主图', 'error');
      return;
    }

    // 1. Sync any #Prod assets from SKU Studio into Detail Studio referenceImages (including enabled & prodAngleRole) & build canonical ID mapping
    const skuProds = skuReferenceImages.filter((r) => r.category !== 'case');
    const skuIdToDetailIdMap = new Map<string, string>();
    const missingProds: ReferenceImageItem[] = [];
    const matchedUpdates = new Map<string, Partial<ReferenceImageItem>>();

    for (const sp of skuProds) {
      const existingMatch = referenceImages.find(
        (r) =>
          r.category !== 'case' &&
          (r.id === sp.id ||
            (r.ossUrl && sp.ossUrl && r.ossUrl === sp.ossUrl) ||
            (r.name && sp.name && r.name === sp.name))
      );
      if (existingMatch) {
        skuIdToDetailIdMap.set(sp.id, existingMatch.id);
        matchedUpdates.set(existingMatch.id, {
          enabled: sp.enabled,
          prodAngleRole: sp.prodAngleRole || existingMatch.prodAngleRole,
          tag: sp.tag || existingMatch.tag,
        });
      } else {
        skuIdToDetailIdMap.set(sp.id, sp.id);
        missingProds.push(sp);
      }
    }

    const updatedExistingRefs = referenceImages.map((r) => {
      const patch = matchedUpdates.get(r.id);
      return patch ? { ...r, ...patch } : r;
    });
    const mergedDetailRefs = reindexReferenceCodes([
      ...updatedExistingRefs,
      ...missingProds,
    ]);
    setReferenceImages(mergedDetailRefs);

    const detailProds = mergedDetailRefs.filter((r) => r.category !== 'case');
    const validDetailProdIds = new Set(detailProds.map((p) => p.id));

    // 2. Map each SkuTask into a Detail ScreenTask
    const convertedScreens: ScreenTask[] = sourceList.map((st, idx) => {
      const mappedProdIds = Array.from(
        new Set(
          (st.productRefIds || [])
            .map((id) => skuIdToDetailIdMap.get(id) || id)
            .filter((id) => validDetailProdIds.has(id))
        )
      );
      const moduleType: DetailModuleType =
        idx === 0 && !singleTask
          ? 'kv_hero'
          : mappedProdIds.length > 2
            ? 'series_matrix'
            : 'selling_point';
      const meta =
        DETAIL_MODULE_PRESETS.find((m) => m.type === moduleType) ||
        DETAIL_MODULE_PRESETS[0];

      const copyText = [
        (st.skuTitle || '').trim(),
        (st.sellingPointBadge || '').trim(),
        (st.packageSpecNote || '').trim(),
      ]
        .filter((line, i, arr) => line.length > 0 || arr.slice(i + 1).some(Boolean))
        .join('\n');

      const anchorUrl =
        useResultAsAnchor && st.resultImageUrl ? st.resultImageUrl : undefined;

      const reframingHint = anchorUrl
        ? `【主图转${targetRatio}竖版延展】：基于已生成的1:1主图同源画面，保持产品主体、潮玩底座与核心光影一致，将上下画布纵向延展为${targetRatio}电商详情分屏（上22%大标题区 + 中54%产品主体舞台 + 下24%浅色圆角卖点信息卡区）。\n`
        : '';

      const cleanCopy = sanitizeCopywritingForRender(
        copyText || st.typographyPlan || st.skuTitle
      );
      const cleanPrompt = sanitizeVisualPromptForRender(
        `${reframingHint}${st.visualPrompt || ''}`.trim()
      );
      const cappedRefIds = limitAndOrderTaskProdsForRender(
        mappedProdIds.length > 0
          ? mappedProdIds
          : detailProds.slice(0, 1).map((p) => p.id),
        detailProds,
        {
          moduleOrTitleHint: `${moduleType} ${st.skuTitle || ''}`,
        }
      ).map((p) => p.id);

      return {
        id: `detail-from-main-${Date.now()}-${idx}`,
        screenNumber: singleTask ? tasks.length + 1 : idx + 1,
        screenCategory: 'detail',
        moduleType,
        layerType: 'dynamic',
        title: sanitizeCopywritingForRender(
          st.skuTitle || `主图延展第 ${idx + 1} 屏`
        ),
        sectionType: meta.label,
        copywriting: cleanCopy,
        typographyPlan: cleanCopy,
        benchmarkCase: anchorUrl
          ? `1:1主图同源延展 (${targetRatio})`
          : '主图同源配方重绘',
        visualPrompt: cleanPrompt,
        textMode: st.textMode || config.requirements.textMode,
        referenceImageIds: cappedRefIds,
        caseDeliveryOverride: 'none',
        sourceReplicaImageUrl: anchorUrl,
        printThemeConfig: st.printThemeConfig
          ? {
              ...st.printThemeConfig,
              enabled: st.printThemeConfig.enabled !== false,
            }
          : undefined,
        aspectRatio: targetRatio,
        imageSize: st.imageSize || config.defaultImageSize,
        status: 'idle',
        historyImages: [],
      };
    });

    const primaryTheme = sourceList.find(
      (s) => s.printThemeConfig?.themePalette
    )?.printThemeConfig;

    setConfig((prev) => {
      const existingSpec = prev.requirements.unifiedVisualSpec?.trim() || '';
      const autoSpec =
        !existingSpec && primaryTheme
          ? `【①60-30-10色板锚点】：${primaryTheme.themePalette}；【②展台与空间材质锚点】：${primaryTheme.themeStage || '圆润潮玩微缩展台'}，搭配${primaryTheme.themeElements || '同色系3D漂浮装饰'}；【③三段式留白与浅色信息卡】：${primaryTheme.themeUiStyle || '通透浅色圆角信息卡（严禁黑棕色块）'}。`
          : existingSpec;
      return {
        ...prev,
        requirements: {
          ...prev.requirements,
          detailAspectRatio: targetRatio,
          unifiedVisualSpec: autoSpec,
        },
      };
    });

    if (singleTask) {
      setTasks((prev) => {
        const firstConverted = convertedScreens[0];
        if (!firstConverted) return prev;
        // 若当前详情页为空，或第1屏是尚未生成成图的首屏KV且用户传的是已出成图的主图卡，则直接作为首屏KV视觉基准并同步全页色板
        if (
          prev.length > 0 &&
          firstConverted.sourceReplicaImageUrl &&
          prev[0].moduleType === 'kv_hero' &&
          !prev[0].resultImageUrl
        ) {
          const updatedFirst: ScreenTask = {
            ...firstConverted,
            id: prev[0].id,
            screenNumber: 1,
            moduleType: 'kv_hero',
            sectionType: '首屏主视觉海报',
          };
          const rest = prev.slice(1).map((t, idx) => ({
            ...t,
            screenNumber: idx + 2,
            printThemeConfig:
              primaryTheme && (!t.printThemeConfig || !t.printThemeConfig.themePalette)
                ? { ...primaryTheme, enabled: true }
                : t.printThemeConfig,
          }));
          const next = [updatedFirst, ...rest];
          tasksRef.current = next;
          return next;
        }
        const next = [...prev, ...convertedScreens].map((t, i) => ({
          ...t,
          screenNumber: i + 1,
        }));
        tasksRef.current = next;
        return next;
      });
    } else {
      setTasks(convertedScreens);
      tasksRef.current = convertedScreens;
    }

    setActiveTopTab('detail_studio');
    showToast(
      singleTask
        ? singleTask.resultImageUrl && useResultAsAnchor
          ? `已将「${singleTask.skuTitle}」满意成图作为同源视觉基准延展至 ② 详情页工作台 (${targetRatio})，并同步4维色板！`
          : `已将「${singleTask.skuTitle}」转为 ${targetRatio} 详情页分屏模块并加入 ② 详情页工作台！`
        : `已将全套 ${convertedScreens.length} 张主图一键流转为 ${targetRatio} 详情页分屏！可继续追加收尾参数屏或直接生成`,
      'success'
    );
  };

  const handleAiPlanDetailModules = async (autoStartBatchAfter = false) => {
    const allDetailProds = referenceImages.filter((r) => r.category !== 'case');
    const enabledDetailProds = filterEnabledProds(allDetailProds);
    const detailProds =
      enabledDetailProds.length > 0 ? enabledDetailProds : allDetailProds;
    if (detailProds.length === 0 && !productInfoText.trim()) {
      showToast('请先上传至少 1 张自有产品图 (#Prod) 或填写产品卖点信息', 'error');
      return;
    }

    let currentModules = tasks;
    if (currentModules.length === 0) {
      handleApplyStandardPresetModules();
      currentModules = tasksRef.current;
    }

    setIsParsingPlan(true);
    try {
      const enabledProdIdSet = new Set(detailProds.map((p) => p.id));
      const res = await studioBridge.planDetailModules({
        productImages: detailProds.map((p) => toLightweightRefPayload(p)),
        productInfoText,
        unifiedVisualSpec: config.requirements.unifiedVisualSpec || '',
        modules: currentModules.map((t, idx) => ({
          id: t.id,
          screenNumber: idx + 1,
          moduleType: t.moduleType || 'selling_point',
          title: t.title,
          userNote: t.userNote || '',
          boundProductIds: t.referenceImageIds.filter((id) =>
            enabledProdIdSet.has(id)
          ),
        })),
        aspectRatio: config.requirements.detailAspectRatio,
        imageSize: config.defaultImageSize,
        textMode: config.requirements.textMode,
        agentModel: config.agentModel,
        enableHighThinking: config.enableHighThinking,
        ...getActiveChannelBridgeParams(),
        ossConfig: config.ossConfig,
      });

      if (res.unifiedVisualSpec && !config.requirements.unifiedVisualSpec?.trim()) {
        setConfig((prev) => ({
          ...prev,
          requirements: {
            ...prev.requirements,
            unifiedVisualSpec: res.unifiedVisualSpec,
          },
        }));
      }

      if (
        Array.isArray(res.detectedProdRoles) &&
        res.detectedProdRoles.length > 0
      ) {
        const roleMap = new Map(
          res.detectedProdRoles.map((item) => [item.id, item])
        );
        setReferenceImages((prev) =>
          prev.map((ref) => {
            const matched = roleMap.get(ref.id);
            if (!matched) return ref;
            return {
              ...ref,
              prodAngleRole:
                (matched.prodAngleRole as any) || ref.prodAngleRole,
              tag: matched.tag || ref.tag,
            };
          })
        );
      }

      if (Array.isArray(res.plannedModules) && res.plannedModules.length > 0) {
        const updatedTasks: ScreenTask[] = currentModules.map((t, idx) => {
          const planned =
            res.plannedModules.find((pm) => pm.id === t.id) ||
            res.plannedModules[idx];
          if (!planned) return t;
          const cleanCopy = sanitizeCopywritingForRender(
            planned.copywriting || t.copywriting
          );
          const cleanPrompt = sanitizeVisualPromptForRender(
            planned.visualPrompt || t.visualPrompt,
            detailProds
          );
          const plannedProdIds = Array.isArray(planned.boundProductIds)
            ? planned.boundProductIds.filter((id) => enabledProdIdSet.has(id))
            : [];
          const cappedProdIds =
            plannedProdIds.length > 0
              ? limitAndOrderTaskProdsForRender(plannedProdIds, detailProds, {
                  moduleOrTitleHint: `${t.moduleType || ''} ${planned.title || t.title}`,
                }).map((p) => p.id)
              : smartPickComplementaryProds(
                  detailProds,
                  t.moduleType || t.title,
                  t.moduleType === 'series_matrix' ? 4 : 2
                ).map((p) => p.id);
          return {
            ...t,
            screenNumber: idx + 1,
            title: sanitizeCopywritingForRender(planned.title || t.title),
            sectionType: planned.sectionType || t.sectionType,
            copywriting: cleanCopy,
            typographyPlan: sanitizeCopywritingForRender(
              planned.typographyPlan || cleanCopy || t.typographyPlan
            ),
            visualPrompt: cleanPrompt,
            referenceImageIds: cappedProdIds,
            printThemeConfig: planned.printThemeConfig
              ? {
                  ...planned.printThemeConfig,
                  enabled:
                    t.printThemeConfig?.enabled !== undefined
                      ? t.printThemeConfig.enabled
                      : true,
                }
              : t.printThemeConfig,
            caseDeliveryOverride: 'none',
          };
        });

        setTasks(updatedTasks);
        tasksRef.current = updatedTasks;
        showToast(
          `AI 已完成 ${updatedTasks.length} 个详情页模块的文案、自动分镜绑定与整页同色规划`,
          'success'
        );

        if (autoStartBatchAfter) {
          await handleStartBatchGenerate(false, false, updatedTasks);
        }
      }
    } catch (err: any) {
      showToast(err?.message || 'AI 规划详情页模块文案失败', 'error');
    } finally {
      setIsParsingPlan(false);
    }
  };

  const handleSyncGlobalConfigToAllSkuTasks = () => {
    setSkuTasks((prev) =>
      prev.map((t) => ({
        ...t,
        skuDiffMode: skuBatchConfig.skuDiffMode,
        aspectRatio: skuBatchConfig.defaultAspectRatio,
        imageSize: skuBatchConfig.defaultImageSize,
        textMode: skuBatchConfig.textMode,
        caseRefIds: [...skuBatchConfig.globalCaseRefIds],
      }))
    );
    showToast(
      `已将全局画幅比例 (${skuBatchConfig.defaultAspectRatio})、分辨率 (${skuBatchConfig.defaultImageSize})、文字模式与全局案例图同步至全部 ${skuTasks.length} 个 SKU 任务`,
      'success'
    );
  };

  // Reverse-extract authentic layout rule from bound #Case benchmark images
  const handleExtractCaseLayout = async () => {
    const caseImgs = skuReferenceImages.filter((r) => r.category === 'case');
    const chosenCases = caseImgs.filter((c) =>
      skuBatchConfig.globalCaseRefIds.includes(c.id)
    );
    const targetCases = chosenCases.length > 0 ? chosenCases : caseImgs;
    if (targetCases.length === 0) {
      showToast(
        '请先在「01. 核心对标 #Case」上传或从资产库选择至少 1 张对标参考图',
        'error'
      );
      return;
    }

    setIsExtractingCaseLayout(true);
    try {
      const res = await studioBridge.extractCaseLayout({
        caseImages: targetCases.map((c) => ({
          ...toLightweightRefPayload(c),
          caseDimensions: c.caseDimensions || ['style', 'structure'],
        })),
        skuDiffMode: skuBatchConfig.skuDiffMode,
        agentModel: config.agentModel,
        ...getActiveChannelBridgeParams(),
        ossConfig: config.ossConfig,
      });

      if (res.extractedLayoutRule) {
        updateSkuBatchConfig({
          unifiedLayoutRule: res.extractedLayoutRule,
        });
        showToast(
          '已从 #Case 对标图提取真实版式描述！您可直接在此基础上微调局部要求（如改背景色或删减角标）',
          'success'
        );
      }
    } catch (err: any) {
      showToast(
        err?.message || '从对标案例图提取版式失败，请稍后重试',
        'error'
      );
    } finally {
      setIsExtractingCaseLayout(false);
    }
  };

  // Promote a completed SKU card's generated image (e.g. Card #01 prototype) to be the global #Case master template for all SKU cards
  const handlePromoteTaskResultToGlobalCase = (task: SkuTask) => {
    if (!task.resultImageUrl) {
      showToast('请先生成本卡成图，再将其设为全套对标母版', 'info');
      return;
    }

    const paddedNum = String(task.skuIndex).padStart(2, '0');
    const rawUrl = task.resultImageUrl;
    let mimeType = 'image/png';
    let base64Data = '';
    if (rawUrl.startsWith('data:image/')) {
      const commaIdx = rawUrl.indexOf(',');
      if (commaIdx !== -1) {
        const header = rawUrl.slice(5, commaIdx);
        mimeType = header.split(';')[0] || 'image/png';
        base64Data = rawUrl.slice(commaIdx + 1);
      }
    }

    const newCaseId = `ref-sku-case-master-${Date.now()}`;
    const newMasterCase: ReferenceImageItem = {
      id: newCaseId,
      code: '',
      category: 'case',
      isCommonAsset: false,
      name: `SKU_${paddedNum}_首卡母版.png`,
      tag: `首卡定标母版(#${paddedNum} ${task.skuTitle || '样板卡'})`,
      caseDimensions: [...LOCK_ALL_SWAP_PATTERN_DIMENSIONS],
      isLockBaseSwap: true,
      mimeType,
      base64Data,
      previewUrl: rawUrl,
      ossUrl:
        task.resultOssUrl || (/^https?:\/\//i.test(rawUrl) ? rawUrl : undefined),
    };

    setSkuReferenceImages((prev) =>
      reindexReferenceCodes([newMasterCase, ...prev])
    );
    setSkuBatchConfig((prev) => ({
      ...prev,
      globalCaseRefIds: [newCaseId],
      defaultAspectRatio: task.aspectRatio,
      defaultImageSize: task.imageSize,
      textMode: task.textMode,
    }));
    setSkuTasks((prev) =>
      prev.map((t, idx) => {
        dirtySkuCasePromptTaskIdsRef.current.delete(t.id);
        const primaryProd = skuReferenceImages.find(
          (r) => r.id === t.productRefIds[0]
        );
        const prodCode = primaryProd?.code || `Prod-${idx + 1}`;
        const prodTag = primaryProd?.tag || primaryProd?.name || prodCode;

        const { syncedTypographyPlan, unifiedMasterPrompt } =
          buildUnifiedMasterLockPrompt({
            masterTask: task,
            targetTask: t,
            prodCode,
            prodTag,
            masterCaseCode: '#Case-1',
          });

        return {
          ...t,
          caseRefIds: [newCaseId],
          aspectRatio: task.aspectRatio,
          imageSize: task.imageSize,
          textMode: task.textMode,
          sellingPointBadge:
            t.sellingPointBadge.trim() || task.sellingPointBadge,
          packageSpecNote:
            t.packageSpecNote.trim() || task.packageSpecNote,
          typographyPlan: syncedTypographyPlan,
          visualPrompt: unifiedMasterPrompt,
        };
      })
    );

    if (isOssReady && !newMasterCase.ossUrl) {
      void uploadReferenceItemsToOss([newMasterCase], true);
    }

    showToast(
      `已将 SKU #${paddedNum} 成片设为全套唯一对标母版 (#Case-1)，并已将 100% 锁底背景提示词、卖点小字与排版同步至全部 ${skuTasks.length} 张卡片！`,
      'success'
    );
  };

  const handleUploadSkuResultToOss = async (task: SkuTask) => {
    if (!task.resultImageUrl) return;
    try {
      showToast(
        `正在归档 SKU-${task.skuIndex} 成品图至 ${activeStorageLabel}...`,
        'info'
      );
      const res = await studioBridge.uploadToOss({
        items: [
          {
            id: task.id,
            name: `SKU_${String(task.skuIndex).padStart(2, '0')}_${task.skuTitle}`,
            mimeType: 'image/png',
            dataUrl: task.resultImageUrl,
          },
        ],
        folder: 'results',
        ossConfig: config.ossConfig,
      });
      const first = res.uploaded?.[0];
      if (first?.ossUrl) {
        updateSkuTask(task.id, {
          resultOssUrl: first.ossUrl,
          resultCloudUrls: mergeCloudUrlsForProvider(
            task.resultOssUrl,
            task.resultCloudUrls,
            activeStorageProvider,
            first.ossUrl
          ),
        });
        const matchedRecords: GenerationRecordItem[] = [];
        setGenerationRecords((prev) =>
          prev.map((rec) => {
            if (rec.imageUrl === task.resultImageUrl) {
              const updated: GenerationRecordItem = {
                ...rec,
                ossUrl: first.ossUrl,
                ossObjectKey: first.objectKey,
                cloudUrls: mergeCloudUrlsForProvider(
                  rec.ossUrl,
                  rec.cloudUrls,
                  activeStorageProvider,
                  first.ossUrl
                ),
                cloudObjectKeys: {
                  ...(rec.cloudObjectKeys || {}),
                  [activeStorageProvider]: first.objectKey,
                },
              };
              matchedRecords.push(updated);
              return updated;
            }
            return rec;
          })
        );
        if (matchedRecords.length > 0) {
          void updateGenerationRecordsInDb(matchedRecords);
        }
        await navigator.clipboard.writeText(first.ossUrl).catch(() => {});
        showToast(
          `SKU-${task.skuIndex} 已归档至 ${activeStorageLabel}，直链已复制到剪贴板！`,
          'success'
        );
      }
    } catch (err: any) {
      showToast(
        err?.message || `上传 SKU 成品图至 ${activeStorageLabel} 失败`,
        'error'
      );
    }
  };

  const handleExportSkuZip = async () => {
    setIsExportingSkuZip(true);
    try {
      await exportSkuTasksAsZip(
        skuTasks,
        '电商SKU套图成片',
        skuBatchSummary || skuBatchConfig.referenceInfoText || productInfoText
      );
      showToast('SKU 高清套图 ZIP 压缩包（含 SKU 企划汇总表）已开始下载', 'success');
    } catch (err: any) {
      showToast(err?.message || '导出 SKU ZIP 失败', 'error');
    } finally {
      setIsExportingSkuZip(false);
    }
  };

  const handleStitchLongImage = async () => {
    setIsStitching(true);
    try {
      const dataUrl = await stitchLongDetailPageImage(tasks, 1080);
      setStitchedLongImageUrl(dataUrl);
      setViewMode('long_preview');
      showToast('已合成无缝详情页长图，可预览或一键下载', 'success');
    } catch (err: any) {
      showToast(err?.message || '合成长图失败，请先生成至少1屏图片', 'error');
    } finally {
      setIsStitching(false);
    }
  };

  // ================= ASSET LIBRARY (COMMON ASSETS + GENERATION RECORDS) HANDLERS =================
  const handleUploadCommonAssetFiles = async (
    files: FileList | null,
    category: 'product' | 'case',
    isCommonAsset = false
  ) => {
    if (!files || files.length === 0) return;
    const fileArray = Array.from(files).filter((f) =>
      f.type.startsWith('image/')
    );
    if (fileArray.length === 0) return;

    const categoryLabel =
      category === 'case'
        ? '对标案例图 (#Case)'
        : isCommonAsset
          ? '通用公模图 (公模)'
          : '常用产品图 (#Prod)';
    try {
      showToast(
        `正在导入 ${fileArray.length} 张${categoryLabel}至常用素材库...`,
        'info'
      );
      const now = new Date();
      const createdAtStr = `${now.toLocaleDateString('zh-CN')} ${now.toLocaleTimeString(
        'zh-CN',
        { hour: '2-digit', minute: '2-digit' }
      )}`;

      const createdAssets: SavedCommonAsset[] = await Promise.all(
        fileArray.map(async (file, i) => {
          const norm = await normalizeUploadedImageHighRes(file, {
            ossEnabled: isOssReady,
            maxDimensionOverride: isOssReady ? 2560 : 1600,
            qualityOverride: isOssReady ? 0.92 : 0.85,
          });
          const cleanName = file.name.replace(/\.[^/.]+$/, '');
          const base64Data = norm.dataUrl.includes(',')
            ? norm.dataUrl.split(',')[1]
            : norm.dataUrl;
          const { mimeType: resolvedMime, ext: resolvedExt } =
            extractMimeAndExtFromDataUrl(
              norm.dataUrl,
              norm.mimeType || 'image/jpeg'
            );
          return {
            id: `asset-${category}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}-${i}`,
            category,
            isCommonAsset: category === 'product' ? Boolean(isCommonAsset) : false,
            name: `${cleanName}.${resolvedExt}`,
            tag:
              cleanName ||
              (category === 'case'
                ? '常用对标案例图'
                : isCommonAsset
                  ? '通用公模参考图'
                  : '常用产品参考图'),
            caseDimensions:
              category === 'case' ? ['style', 'structure'] : undefined,
            mimeType: resolvedMime,
            base64Data,
            previewUrl: norm.dataUrl,
            createdAt: createdAtStr,
            timestamp: Date.now() + i,
          };
        })
      );

      setCommonAssets((prev) => [...createdAssets, ...prev]);
      await saveCommonAssetsToDb(createdAssets);
      showToast(
        `已成功沉淀 ${createdAssets.length} 张${categoryLabel}至资产库`,
        'success'
      );
    } catch (err: any) {
      showToast(err?.message || '上传常用素材失败', 'error');
    }
  };

  // Sync or import ReferenceImageItems into Common Assets Library without creating duplicates
  const syncReferenceItemsIntoCommonAssets = async (
    sourceItems: ReferenceImageItem[],
    sourceLabel: string
  ) => {
    if (sourceItems.length === 0) {
      showToast(`${sourceLabel}暂无图片可沉淀至资产库`, 'info');
      return;
    }

    const existingByKey = new Map<string, SavedCommonAsset>();
    for (const a of commonAssets) {
      existingByKey.set(`${a.category}:${a.name}`, a);
    }

    const newlyCreated: SavedCommonAsset[] = [];
    const updatedExisting: SavedCommonAsset[] = [];
    const updatedMap = new Map<string, SavedCommonAsset>();

    sourceItems.forEach((r) => {
      const key = `${r.category}:${r.name}`;
      const existing = existingByKey.get(key);
      if (!existing) {
        const created = convertRefItemToCommonAsset(r);
        newlyCreated.push(created);
        existingByKey.set(key, created);
      } else {
        const patched: SavedCommonAsset = {
          ...existing,
          tag: r.tag || existing.tag,
          isCommonAsset:
            r.category === 'product'
              ? r.isCommonAsset ?? existing.isCommonAsset
              : false,
          caseDimensions:
            r.category === 'case'
              ? r.caseDimensions || existing.caseDimensions
              : existing.caseDimensions,
          caseCustomRule:
            r.category === 'case'
              ? r.caseCustomRule !== undefined
                ? r.caseCustomRule
                : existing.caseCustomRule
              : existing.caseCustomRule,
          extractedLayoutDna:
            r.category === 'case'
              ? r.extractedLayoutDna ?? existing.extractedLayoutDna
              : undefined,
          detectedSubScreens:
            r.category === 'case'
              ? r.detectedSubScreens ?? existing.detectedSubScreens
              : undefined,
          isLockBaseSwap:
            r.category === 'case'
              ? r.isLockBaseSwap ?? existing.isLockBaseSwap
              : undefined,
          ossUrl: r.ossUrl || existing.ossUrl,
          ossObjectKey: r.ossObjectKey || existing.ossObjectKey,
          cloudUrls: {
            ...(existing.cloudUrls || {}),
            ...(r.cloudUrls || {}),
          },
          cloudObjectKeys: {
            ...(existing.cloudObjectKeys || {}),
            ...(r.cloudObjectKeys || {}),
          },
        };
        updatedExisting.push(patched);
        updatedMap.set(existing.id, patched);
      }
    });

    if (newlyCreated.length > 0 || updatedExisting.length > 0) {
      setCommonAssets((prev) => [
        ...newlyCreated,
        ...prev.map((item) => updatedMap.get(item.id) || item),
      ]);
      await saveCommonAssetsToDb([...newlyCreated, ...updatedExisting]);
    }

    if (newlyCreated.length > 0 && updatedExisting.length > 0) {
      showToast(
        `已向「③ 资产库」新增 ${newlyCreated.length} 张素材，并同步更新 ${updatedExisting.length} 张已有素材的标签/对标维度`,
        'success'
      );
    } else if (newlyCreated.length > 0) {
      showToast(
        `已将 ${sourceLabel} ${newlyCreated.length} 张素材存入「③ 资产库 · 常用素材」，后续各工作台可直接选用`,
        'success'
      );
    } else {
      showToast(
        `已同步更新「③ 资产库」中 ${updatedExisting.length} 张对应素材的最新标签、对标维度与 ${activeStorageShort} 状态`,
        'success'
      );
    }
  };

  const handleImportFromCurrentWorkspace = async () => {
    const combinedRefs =
      referenceImages.length > 0 ? referenceImages : skuReferenceImages;
    await syncReferenceItemsIntoCommonAssets(combinedRefs, '当前工作台');
  };

  const handleSetDetailCaseDimensions = (
    refId: string,
    dims: CaseRefDimension[]
  ) => {
    const safeDims: CaseRefDimension[] =
      dims.length > 0 ? dims : [...DEFAULT_CASE_DIMENSIONS];
    const nextReferenceImages: ReferenceImageItem[] = referenceImages.map(
      (item) =>
        item.id === refId ? { ...item, caseDimensions: safeDims } : item
    );
    setReferenceImages(nextReferenceImages);
    const detailCases = nextReferenceImages.filter((r) => r.category === 'case');
    const detailProds = nextReferenceImages.filter((r) => r.category !== 'case');
    const nextUnifiedSpec = deriveUnifiedVisualSpecFromCases(
      detailCases,
      config.globalStylePrefix,
      productInfoText
    );
    setConfig((prev) => ({
      ...prev,
      requirements: {
        ...prev.requirements,
        unifiedVisualSpec: nextUnifiedSpec,
      },
    }));
    setTasks((prevTasks) =>
      prevTasks.map((t, idx) => {
        if (!t.referenceImageIds.includes(refId)) return t;
        const boundCaseItems = nextReferenceImages.filter(
          (r) => t.referenceImageIds.includes(r.id) && r.category === 'case'
        );
        if (boundCaseItems.length === 0) return t;
        if (boundCaseItems.length === 1) {
          const screenNum =
            typeof t.screenNumber === 'number' ? t.screenNumber : idx + 1;
          return refreshTaskOnCaseDimensionChange({
            task: t,
            screenNum,
            matchedCase: boundCaseItems[0],
            prodRefs: detailProds,
            productInfoText,
            fullPlanDoc,
            enableStaticLayering:
              config.requirements.enableStaticLayering !== false,
            defaultAspectRatio: config.requirements.detailAspectRatio,
            defaultImageSize: config.defaultImageSize,
            defaultTextMode: config.requirements.textMode,
            unifiedVisualSpec: nextUnifiedSpec,
          });
        }
        return {
          ...t,
          benchmarkCase: buildClientCaseDimensionDirective(
            boundCaseItems,
            nextUnifiedSpec,
            'detail'
          ),
        };
      })
    );
  };

  // Explicit toggle for '锁底换款' (isLockBaseSwap) on a Detail Studio #Case item (independent from the 6 analysis dimension tags)
  const handleToggleDetailCaseLockBaseSwap = (refId: string) => {
    let nextLockState = false;
    const nextReferenceImages: ReferenceImageItem[] = referenceImages.map(
      (item) => {
        if (item.id !== refId) return item;
        nextLockState = !item.isLockBaseSwap;
        return {
          ...item,
          isLockBaseSwap: nextLockState,
        };
      }
    );
    setReferenceImages(nextReferenceImages);

    // Mutual exclusion: if enabling lock base swap, clear sharedStyleCaseId if it was set to this ref
    if (nextLockState && config.requirements.sharedStyleCaseId === refId) {
      setConfig((prev) => ({
        ...prev,
        requirements: {
          ...prev.requirements,
          caseDeliveryMode: 'none',
          sharedStyleCaseId: '',
        },
      }));
    }

    const detailCases = nextReferenceImages.filter((r) => r.category === 'case');
    const detailProds = nextReferenceImages.filter((r) => r.category !== 'case');
    const nextUnifiedSpec = deriveUnifiedVisualSpecFromCases(
      detailCases,
      config.globalStylePrefix,
      productInfoText
    );
    setConfig((prev) => ({
      ...prev,
      requirements: {
        ...prev.requirements,
        unifiedVisualSpec: nextUnifiedSpec,
      },
    }));
    setTasks((prevTasks) =>
      prevTasks.map((t, idx) => {
        if (!t.referenceImageIds.includes(refId)) return t;
        const boundCaseItems = nextReferenceImages.filter(
          (r) => t.referenceImageIds.includes(r.id) && r.category === 'case'
        );
        if (boundCaseItems.length === 0) return t;
        const screenNum =
          typeof t.screenNumber === 'number' ? t.screenNumber : idx + 1;
        const refreshed = refreshTaskOnCaseDimensionChange({
          task: t,
          screenNum,
          matchedCase: boundCaseItems[0],
          prodRefs: detailProds,
          productInfoText,
          fullPlanDoc,
          enableStaticLayering:
            config.requirements.enableStaticLayering !== false,
          defaultAspectRatio: config.requirements.detailAspectRatio,
          defaultImageSize: config.defaultImageSize,
          defaultTextMode: config.requirements.textMode,
          unifiedVisualSpec: nextUnifiedSpec,
        });
        return {
          ...refreshed,
          caseDeliveryOverride: nextLockState ? 'lock_base_swap' : 'inherit',
        };
      })
    );
    showToast(
      nextLockState
        ? '已对该案例开启「🔒锁底换款」：绑定该案例的任务生图时将传入该案例原图，除替换 #Prod 产品主体外其余 100% 锁定'
        : '已关闭该案例的「锁底换款」：恢复按所选六维标签提取抽象规范并重新设计背景与排版',
      'info'
    );
  };

  // Toggle a Detail Studio #Case item as the shared style reference image (★ 共用风格)
  const handleToggleDetailSharedStyleCase = (refId: string) => {
    const detailCases = referenceImages.filter((r) => r.category === 'case');
    const targetCase = detailCases.find((r) => r.id === refId);
    const effectiveSharedId =
      config.requirements.sharedStyleCaseId || detailCases[0]?.id || '';
    const isCurrentlyActive =
      config.requirements.caseDeliveryMode === 'shared_style' &&
      effectiveSharedId === refId;

    if (isCurrentlyActive) {
      setConfig((prev) => ({
        ...prev,
        requirements: {
          ...prev.requirements,
          caseDeliveryMode: 'none',
          sharedStyleCaseId: '',
        },
      }));
      showToast(
        `已取消 #${targetCase?.code || 'Case'} 的「共用风格参考图」绑定，恢复默认不传案例图模式`,
        'info'
      );
    } else {
      // Mutual exclusion: turning on shared style turns off isLockBaseSwap on this case and updates any tasks bound to it
      const wasLocked = Boolean(targetCase?.isLockBaseSwap);
      const nextReferenceImages = referenceImages.map((r) =>
        r.id === refId && r.isLockBaseSwap ? { ...r, isLockBaseSwap: false } : r
      );
      setReferenceImages(nextReferenceImages);
      const nextCases = nextReferenceImages.filter(
        (r) => r.category === 'case'
      );
      const detailProds = nextReferenceImages.filter(
        (r) => r.category !== 'case'
      );
      const nextUnifiedSpec = deriveUnifiedVisualSpecFromCases(
        nextCases,
        config.globalStylePrefix,
        productInfoText
      );
      setConfig((prev) => ({
        ...prev,
        requirements: {
          ...prev.requirements,
          caseDeliveryMode: 'shared_style',
          sharedStyleCaseId: refId,
          unifiedVisualSpec: nextUnifiedSpec,
        },
      }));
      if (wasLocked) {
        setTasks((prevTasks) =>
          prevTasks.map((t, idx) => {
            if (!t.referenceImageIds.includes(refId)) return t;
            const boundCaseItems = nextReferenceImages.filter(
              (r) => t.referenceImageIds.includes(r.id) && r.category === 'case'
            );
            if (boundCaseItems.length === 0) return t;
            const screenNum =
              typeof t.screenNumber === 'number' ? t.screenNumber : idx + 1;
            const refreshed = refreshTaskOnCaseDimensionChange({
              task: t,
              screenNum,
              matchedCase: boundCaseItems[0],
              prodRefs: detailProds,
              productInfoText,
              fullPlanDoc,
              enableStaticLayering:
                config.requirements.enableStaticLayering !== false,
              defaultAspectRatio: config.requirements.detailAspectRatio,
              defaultImageSize: config.defaultImageSize,
              defaultTextMode: config.requirements.textMode,
              unifiedVisualSpec: nextUnifiedSpec,
            });
            return {
              ...refreshed,
              caseDeliveryOverride: 'inherit',
            };
          })
        );
      }
      showToast(
        `已将 #${targetCase?.code || 'Case'} 设为「★ 各屏共用风格参考图」（生图仅参考其风格、色调与质感）`,
        'success'
      );
    }
  };

  // Clear all screen task cards on the right canvas while preserving left dock assets and copy
  const handleClearAllDetailTasks = () => {
    setTasks([]);
    setStitchedLongImageUrl(null);
    setConfirmClearTasks(false);
    setExpandedRefPickerTaskId(null);
    showToast(
      '已清空右侧全部分屏任务卡（左侧素材池与策划方案已完整保留）',
      'info'
    );
  };

  // Map task aspect ratio to strict Tailwind aspect ratio utility (default 9:16)
  const getTaskAspectClass = (ratio?: AspectRatioOption): string => {
    switch (ratio || '9:16') {
      case '9:16':
        return 'aspect-[9/16]';
      case '3:4':
        return 'aspect-[3/4]';
      case '1:1':
        return 'aspect-square';
      case '4:3':
        return 'aspect-[4/3]';
      case '16:9':
        return 'aspect-video';
      case '1:4':
        return 'aspect-[1/4]';
      case '4:1':
        return 'aspect-[4/1]';
      default:
        return 'aspect-[9/16]';
    }
  };

  // Explicit toggle for '锁底换款' (isLockBaseSwap) on a SKU Studio #Case item
  const handleToggleSkuCaseLockBaseSwap = (refId: string) => {
    let nextLockState = false;
    setSkuReferenceImages((prev) =>
      prev.map((item) => {
        if (item.id !== refId) return item;
        nextLockState = !item.isLockBaseSwap;
        return {
          ...item,
          isLockBaseSwap: nextLockState,
        };
      })
    );
    setSkuTasks((prev) =>
      prev.map((t) => {
        if (t.caseRefIds.includes(refId)) {
          dirtySkuCasePromptTaskIdsRef.current.add(t.id);
        }
        return t;
      })
    );
    showToast(
      nextLockState
        ? '已开启「🔒锁底换款」：生图时除替换 #Prod 产品主体外，背景/版式/文字 100% 锁定该案例原图'
        : '已关闭「锁底换款」：恢复按六个分析标签控制信息提取范围',
      'info'
    );
  };

  const handleUpdateDetailCaseCustomRule = (
    refId: string,
    customRule: string
  ) => {
    const nextReferenceImages: ReferenceImageItem[] = referenceImages.map(
      (item) =>
        item.id === refId ? { ...item, caseCustomRule: customRule } : item
    );
    setReferenceImages(nextReferenceImages);
    const detailCases = nextReferenceImages.filter((r) => r.category === 'case');
    const nextUnifiedSpec = deriveUnifiedVisualSpecFromCases(
      detailCases,
      config.globalStylePrefix,
      productInfoText
    );
    setConfig((prev) => ({
      ...prev,
      requirements: {
        ...prev.requirements,
        unifiedVisualSpec: nextUnifiedSpec,
      },
    }));
    setTasks((prevTasks) =>
      prevTasks.map((t) => {
        if (!t.referenceImageIds.includes(refId)) return t;
        const boundCaseItems = nextReferenceImages.filter(
          (r) => t.referenceImageIds.includes(r.id) && r.category === 'case'
        );
        if (boundCaseItems.length === 0) return t;

        const combinedRulesText = extractIndependentCaseCustomRules(
          boundCaseItems
        ).join('；');
        let nextPrompt = t.visualPrompt;
        const ruleLine = combinedRulesText.trim()
          ? `【⚡独立补充约束（最高优先级）】：${combinedRulesText.trim()}`
          : '';
        if (/【⚡独立补充约束[^】]*】：[^\n]+/.test(nextPrompt)) {
          nextPrompt = ruleLine
            ? nextPrompt.replace(/【⚡独立补充约束[^】]*】：[^\n]+/, ruleLine)
            : nextPrompt.replace(/\n?【⚡独立补充约束[^】]*】：[^\n]+/, '');
        } else if (ruleLine) {
          nextPrompt = `${nextPrompt}\n${ruleLine}`;
        }

        const subScreenPrefixMatch = (t.benchmarkCase || '').match(
          /^【对标来源：[^】]+】\s*/
        );
        const subScreenPrefix = subScreenPrefixMatch
          ? subScreenPrefixMatch[0]
          : '';

        return {
          ...t,
          visualPrompt: nextPrompt,
          benchmarkCase: `${subScreenPrefix}${buildClientCaseDimensionDirective(
            boundCaseItems,
            nextUnifiedSpec,
            'detail'
          )}`,
        };
      })
    );
  };

  const handleSetSkuCaseDimensions = (
    refId: string,
    dims: CaseRefDimension[]
  ) => {
    const safeDims: CaseRefDimension[] =
      dims.length > 0 ? dims : [...DEFAULT_CASE_DIMENSIONS];
    setSkuReferenceImages((prev) =>
      prev.map((item) =>
        item.id === refId ? { ...item, caseDimensions: safeDims } : item
      )
    );
    setSkuTasks((prev) =>
      prev.map((t) => {
        if (t.caseRefIds.includes(refId)) {
          dirtySkuCasePromptTaskIdsRef.current.add(t.id);
        }
        return t;
      })
    );
  };

  const handleUpdateSkuCaseCustomRule = (
    refId: string,
    customRule: string
  ) => {
    setSkuReferenceImages((prev) =>
      prev.map((item) =>
        item.id === refId ? { ...item, caseCustomRule: customRule } : item
      )
    );
    setSkuTasks((prev) =>
      prev.map((t) => {
        if (t.caseRefIds.includes(refId)) {
          dirtySkuCasePromptTaskIdsRef.current.add(t.id);
        }
        return t;
      })
    );
  };

  const handleUpdateCommonAsset = async (
    id: string,
    patch: Partial<SavedCommonAsset>
  ) => {
    const targetAsset = commonAssets.find((item) => item.id === id);
    if (!targetAsset) return;
    const updatedItem: SavedCommonAsset = { ...targetAsset, ...patch };
    setCommonAssets((prev) =>
      prev.map((item) => (item.id === id ? updatedItem : item))
    );

    // Sync updated tag / caseDimensions / caseCustomRule / isCommonAsset to matching reference images already loaded in Detail Studio and SKU Studio
    const matchesRef = (r: ReferenceImageItem) =>
      r.category === targetAsset.category &&
      ((targetAsset.ossUrl && r.ossUrl === targetAsset.ossUrl) ||
        r.name === targetAsset.name);

    const applyRefPatch = (r: ReferenceImageItem): ReferenceImageItem =>
      matchesRef(r)
        ? {
            ...r,
            tag: typeof patch.tag === 'string' ? patch.tag : r.tag,
            isCommonAsset:
              typeof patch.isCommonAsset === 'boolean'
                ? patch.isCommonAsset
                : r.isCommonAsset,
            caseDimensions:
              patch.caseDimensions !== undefined
                ? patch.caseDimensions
                : r.caseDimensions,
            caseCustomRule:
              patch.caseCustomRule !== undefined
                ? patch.caseCustomRule
                : r.caseCustomRule,
          }
        : r;

    setReferenceImages((prev) =>
      prev.some(matchesRef) ? prev.map(applyRefPatch) : prev
    );
    setSkuReferenceImages((prev) =>
      prev.some(matchesRef) ? prev.map(applyRefPatch) : prev
    );

    await saveCommonAssetsToDb([updatedItem]);
  };

  const handleDeleteCommonAssets = async (ids: string[]) => {
    const idSet = new Set(ids);
    setCommonAssets((prev) => prev.filter((item) => !idSet.has(item.id)));
    await deleteCommonAssetsFromDb(ids);
    showToast(`已从常用素材库移除 ${ids.length} 张素材`, 'info');
  };

  // Save SKU Studio reference items (either by category 'product' | 'case' or an explicit array) to Asset Library
  const handleSaveSkuRefsToCommonAssets = async (
    categoryOrItems?: 'product' | 'case' | ReferenceImageItem[]
  ) => {
    const targetItems = Array.isArray(categoryOrItems)
      ? categoryOrItems
      : categoryOrItems
        ? skuReferenceImages.filter((r) => r.category === categoryOrItems)
        : skuReferenceImages;
    const label =
      categoryOrItems === 'case'
        ? 'SKU 对标参考图 (#Case)'
        : categoryOrItems === 'product'
          ? 'SKU 产品参考图 (#Prod)'
          : 'SKU 工作台';
    await syncReferenceItemsIntoCommonAssets(targetItems, label);
  };

  // Select assets from Asset Library (or Detail Studio pool) into SKU Studio's independent pool
  const handleSelectAssetsFromLibraryForSku = (
    selectedItems: Array<SavedCommonAsset | ReferenceImageItem>,
    category: 'product' | 'case',
    targetSkuTaskId?: string
  ) => {
    if (selectedItems.length === 0) return;

    const newRefs: ReferenceImageItem[] = selectedItems.map((asset, idx) => ({
      id: `ref-sku-${category}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}-${idx}`,
      code: '',
      category,
      isCommonAsset:
        category === 'product' ? Boolean(asset.isCommonAsset) : false,
      name: asset.name,
      tag: asset.tag,
      caseDimensions:
        category === 'case'
          ? asset.caseDimensions || ['style', 'structure']
          : undefined,
      caseCustomRule: category === 'case' ? asset.caseCustomRule : undefined,
      extractedLayoutDna:
        category === 'case' ? asset.extractedLayoutDna : undefined,
      detectedSubScreens:
        category === 'case' &&
        Array.isArray(asset.detectedSubScreens) &&
        asset.detectedSubScreens.length > 0
          ? asset.detectedSubScreens.map((s) => ({ ...s }))
          : undefined,
      isLockBaseSwap:
        category === 'case' ? Boolean(asset.isLockBaseSwap) : undefined,
      mimeType: asset.mimeType,
      base64Data: asset.base64Data,
      previewUrl: asset.previewUrl,
      ossUrl: getCloudUrlForProvider(
        asset.ossUrl,
        asset.cloudUrls,
        activeStorageProvider
      ),
      ossObjectKey: getCloudObjectKeyForProvider(
        asset.ossObjectKey,
        asset.ossUrl,
        asset.cloudUrls,
        asset.cloudObjectKeys,
        activeStorageProvider
      ),
      cloudUrls: asset.cloudUrls ? { ...asset.cloudUrls } : undefined,
      cloudObjectKeys: asset.cloudObjectKeys
        ? { ...asset.cloudObjectKeys }
        : undefined,
    }));

    setSkuReferenceImages((prev) => {
      const nextList = reindexReferenceCodes([...prev, ...newRefs]);
      if (isOssReady && config.ossConfig?.autoUploadRefs !== false) {
        const unsyncedNew = nextList.filter(
          (item) =>
            !isSyncedToProvider(
              item.ossUrl,
              item.cloudUrls,
              activeStorageProvider
            ) && newRefs.some((n) => n.id === item.id)
        );
        if (unsyncedNew.length > 0) {
          setTimeout(() => {
            uploadReferenceItemsToOss(unsyncedNew, true);
          }, 30);
        }
      }
      return nextList;
    });

    const newIds = newRefs.map((r) => r.id);

    if (category === 'product') {
      setSkuBatchConfig((prev) => ({
        ...prev,
        selectedProdIds: Array.from(
          new Set([...prev.selectedProdIds, ...newIds])
        ),
      }));
      if (targetSkuTaskId) {
        setSkuTasks((prev) =>
          prev.map((t) =>
            t.id === targetSkuTaskId
              ? {
                  ...t,
                  productRefIds: [newIds[0], ...newIds.slice(1)],
                  skuTitle:
                    t.skuTitle.trim() ||
                    newRefs[0]?.tag ||
                    newRefs[0]?.name.replace(/\.[^/.]+$/, '') ||
                    t.skuTitle,
                }
              : t
          )
        );
      } else {
        const existingCaseIds =
          skuBatchConfig.globalCaseRefIds.length > 0
            ? [...skuBatchConfig.globalCaseRefIds]
            : skuReferenceImages
                .filter((r) => r.category === 'case')
                .map((c) => c.id);

        setSkuTasks((prev) => {
          const startIdx =
            prev.length > 0
              ? Math.max(...prev.map((t) => t.skuIndex)) + 1
              : 1;
          const autoCards: SkuTask[] = newRefs.map((item, idx) => {
            const cardIdx0 = startIdx - 1 + idx;
            return {
              id: `sku-lib-${Date.now()}-${idx}`,
              skuIndex: startIdx + idx,
              skuDiffMode: skuBatchConfig.skuDiffMode,
              skuTitle: formatSkuTitleFromConfig(cardIdx0, item),
              sellingPointBadge:
                skuBatchConfig.referenceInfoText.trim() || '',
              packageSpecNote: '',
              typographyPlan: '',
              visualPrompt: '',
              textMode: skuBatchConfig.textMode,
              productRefIds: [item.id],
              caseRefIds: [...existingCaseIds],
              aspectRatio: skuBatchConfig.defaultAspectRatio,
              imageSize: skuBatchConfig.defaultImageSize,
              status: 'idle',
              historyImages: [],
            };
          });
          return [...prev, ...autoCards];
        });
      }
    } else {
      setSkuBatchConfig((prev) => ({
        ...prev,
        globalCaseRefIds: Array.from(
          new Set([...prev.globalCaseRefIds, ...newIds])
        ),
      }));
      if (targetSkuTaskId) {
        setSkuTasks((prev) =>
          prev.map((t) =>
            t.id === targetSkuTaskId
              ? {
                  ...t,
                  caseRefIds: Array.from(new Set([...t.caseRefIds, ...newIds])),
                }
              : t
          )
        );
      } else {
        setSkuTasks((prev) =>
          prev.map((t) => {
            dirtySkuCasePromptTaskIdsRef.current.add(t.id);
            return {
              ...t,
              caseRefIds: Array.from(new Set([...t.caseRefIds, ...newIds])),
            };
          })
        );
      }
    }

    showToast(
      `已从资产库导入 ${newRefs.length} 张${
        category === 'case' ? '对标参考图 (#Case)' : '产品图 (#Prod)'
      }至 SKU 工作台${
        targetSkuTaskId
          ? ' 并绑定到当前卡片'
          : category === 'product'
            ? ' 并自动生成对应 SKU 卡片'
            : ''
      }`,
      'success'
    );
  };

  // Select assets from Asset Library into Detail Studio's independent pool
  const handleSelectAssetsFromLibraryForDetail = (
    selectedItems: SavedCommonAsset[],
    category: 'product' | 'case'
  ) => {
    if (selectedItems.length === 0) return;
    const newRefs: ReferenceImageItem[] = selectedItems.map((asset, idx) => ({
      id: `ref-detail-${category}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}-${idx}`,
      code: '',
      category,
      isCommonAsset:
        category === 'product' ? Boolean(asset.isCommonAsset) : false,
      name: asset.name,
      tag: asset.tag,
      caseDimensions:
        category === 'case'
          ? asset.caseDimensions || ['style', 'structure']
          : undefined,
      caseCustomRule: category === 'case' ? asset.caseCustomRule : undefined,
      extractedLayoutDna:
        category === 'case' ? asset.extractedLayoutDna : undefined,
      detectedSubScreens:
        category === 'case' ? asset.detectedSubScreens : undefined,
      isLockBaseSwap:
        category === 'case' ? Boolean(asset.isLockBaseSwap) : false,
      mimeType: asset.mimeType,
      base64Data: asset.base64Data,
      previewUrl: asset.previewUrl,
      ossUrl: getCloudUrlForProvider(
        asset.ossUrl,
        asset.cloudUrls,
        activeStorageProvider
      ),
      ossObjectKey: getCloudObjectKeyForProvider(
        asset.ossObjectKey,
        asset.ossUrl,
        asset.cloudUrls,
        asset.cloudObjectKeys,
        activeStorageProvider
      ),
      cloudUrls: asset.cloudUrls ? { ...asset.cloudUrls } : undefined,
      cloudObjectKeys: asset.cloudObjectKeys
        ? { ...asset.cloudObjectKeys }
        : undefined,
    }));
    setReferenceImages((prev) => {
      const nextList = reindexReferenceCodes([...prev, ...newRefs]);
      if (isOssReady && config.ossConfig?.autoUploadRefs !== false) {
        const unsyncedNew = nextList.filter(
          (item) =>
            !isSyncedToProvider(
              item.ossUrl,
              item.cloudUrls,
              activeStorageProvider
            ) && newRefs.some((n) => n.id === item.id)
        );
        if (unsyncedNew.length > 0) {
          setTimeout(() => {
            uploadReferenceItemsToOss(unsyncedNew, true);
          }, 30);
        }
      }
      return nextList;
    });
    if (category === 'product') {
      setSelectedSkuImageIds((prev) =>
        Array.from(new Set([...prev, ...newRefs.map((r) => r.id)]))
      );
    }
    showToast(
      `已从资产库导入 ${newRefs.length} 张${
        category === 'case' ? '参考案例图 (#Case)' : '产品图片 (#Prod)'
      }至「② 详情页工作台」`,
      'success'
    );
  };

  const handlePushAssetsToStudio = (
    assetsToPush: SavedCommonAsset[],
    targetStudio: 'detail_studio' | 'sku_studio'
  ) => {
    if (assetsToPush.length === 0) return;

    const newRefs: ReferenceImageItem[] = assetsToPush.map((asset, idx) => ({
      id: `ref-${targetStudio === 'sku_studio' ? 'sku-' : ''}${asset.category}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}-${idx}`,
      code: '',
      category: asset.category,
      isCommonAsset:
        asset.category === 'product' ? Boolean(asset.isCommonAsset) : false,
      name: asset.name,
      tag: asset.tag,
      caseDimensions:
        asset.category === 'case'
          ? asset.caseDimensions || ['style', 'structure']
          : undefined,
      caseCustomRule:
        asset.category === 'case' ? asset.caseCustomRule : undefined,
      extractedLayoutDna:
        asset.category === 'case' ? asset.extractedLayoutDna : undefined,
      detectedSubScreens:
        asset.category === 'case' ? asset.detectedSubScreens : undefined,
      isLockBaseSwap:
        asset.category === 'case' ? Boolean(asset.isLockBaseSwap) : false,
      mimeType: asset.mimeType,
      base64Data: asset.base64Data,
      previewUrl: asset.previewUrl,
      ossUrl: getCloudUrlForProvider(
        asset.ossUrl,
        asset.cloudUrls,
        activeStorageProvider
      ),
      ossObjectKey: getCloudObjectKeyForProvider(
        asset.ossObjectKey,
        asset.ossUrl,
        asset.cloudUrls,
        asset.cloudObjectKeys,
        activeStorageProvider
      ),
      cloudUrls: asset.cloudUrls ? { ...asset.cloudUrls } : undefined,
      cloudObjectKeys: asset.cloudObjectKeys
        ? { ...asset.cloudObjectKeys }
        : undefined,
    }));

    const prodRefs = newRefs.filter((r) => r.category === 'product');
    const prodIds = prodRefs.map((r) => r.id);
    const caseIds = newRefs
      .filter((r) => r.category === 'case')
      .map((r) => r.id);

    if (targetStudio === 'sku_studio') {
      setSkuReferenceImages((prev) =>
        reindexReferenceCodes([...prev, ...newRefs])
      );
      if (prodIds.length > 0) {
        setSkuBatchConfig((prev) => ({
          ...prev,
          selectedProdIds: Array.from(
            new Set([...prev.selectedProdIds, ...prodIds])
          ),
        }));
      }
      if (caseIds.length > 0) {
        setSkuBatchConfig((prev) => ({
          ...prev,
          globalCaseRefIds: Array.from(
            new Set([...prev.globalCaseRefIds, ...caseIds])
          ),
        }));
      }

      const effectiveCases = Array.from(
        new Set([
          ...skuBatchConfig.globalCaseRefIds,
          ...caseIds,
          ...skuReferenceImages
            .filter((r) => r.category === 'case')
            .map((c) => c.id),
        ])
      );

      if (prodRefs.length > 0 || caseIds.length > 0) {
        setSkuTasks((prev) => {
          const updatedExisting =
            caseIds.length > 0
              ? prev.map((t) =>
                  t.caseRefIds.length === 0
                    ? { ...t, caseRefIds: [...effectiveCases] }
                    : t
                )
              : prev;
          if (prodRefs.length === 0) return updatedExisting;

          const startIdx =
            updatedExisting.length > 0
              ? Math.max(...updatedExisting.map((t) => t.skuIndex)) + 1
              : 1;
          const autoCards: SkuTask[] = prodRefs.map((item, idx) => ({
            id: `sku-push-${Date.now()}-${idx}`,
            skuIndex: startIdx + idx,
            skuDiffMode: skuBatchConfig.skuDiffMode,
            skuTitle: formatSkuTitleFromConfig(startIdx - 1 + idx, item),
            sellingPointBadge: skuBatchConfig.referenceInfoText.trim() || '',
            packageSpecNote: '',
            typographyPlan: '',
            visualPrompt: '',
            textMode: skuBatchConfig.textMode,
            productRefIds: [item.id],
            caseRefIds: [...effectiveCases],
            aspectRatio: skuBatchConfig.defaultAspectRatio,
            imageSize: skuBatchConfig.defaultImageSize,
            status: 'idle',
            historyImages: [],
          }));
          return [...updatedExisting, ...autoCards];
        });
      }
    } else {
      // Detail Studio independent pool
      setReferenceImages((prev) => reindexReferenceCodes([...prev, ...newRefs]));
      if (prodIds.length > 0) {
        setSelectedSkuImageIds((prev) =>
          Array.from(new Set([...prev, ...prodIds]))
        );
      }
    }

    setActiveTopTab(targetStudio);
    showToast(
      `已将 ${newRefs.length} 张常用素材推送至「${
        targetStudio === 'sku_studio' ? '① 主图/SKU工作台' : '② 详情页工作台'
      }」独立素材池`,
      'success'
    );
  };

  const handleMarkRecordsViewed = async (ids: string[], isViewed: boolean) => {
    const idSet = new Set(ids);
    const updatedRecords: GenerationRecordItem[] = [];
    setGenerationRecords((prev) =>
      prev.map((rec) => {
        if (!idSet.has(rec.id)) return rec;
        const next = { ...rec, isViewed };
        updatedRecords.push(next);
        return next;
      })
    );
    if (updatedRecords.length > 0) {
      await updateGenerationRecordsInDb(updatedRecords);
    }
  };

  const handleDeleteGenerationRecords = async (ids: string[]) => {
    const idSet = new Set(ids);
    setGenerationRecords((prev) => prev.filter((rec) => !idSet.has(rec.id)));
    await deleteGenerationRecordsFromDb(ids);
    showToast(`已删除 ${ids.length} 条图片生成记录`, 'info');
  };

  const handleClearViewedGenerationRecords = async () => {
    const viewedIds = generationRecords
      .filter((rec) => rec.isViewed)
      .map((rec) => rec.id);
    if (viewedIds.length === 0) return;
    await handleDeleteGenerationRecords(viewedIds);
    showToast(`已清理全部 ${viewedIds.length} 条已查看的生成记录`, 'success');
  };

  const handleSaveRecordsToCommonAssets = async (
    recordsToSave: GenerationRecordItem[],
    category: 'case' | 'product' = 'case'
  ) => {
    if (recordsToSave.length === 0) return;
    const nowStr = new Date().toLocaleString('zh-CN', { hour12: false });
    const createdAssets: SavedCommonAsset[] = recordsToSave.map((rec, idx) => {
      const rawUrl = rec.imageUrl || '';
      let mimeType = 'image/png';
      let base64Data = '';
      if (rawUrl.startsWith('data:image/')) {
        const commaIdx = rawUrl.indexOf(',');
        if (commaIdx !== -1) {
          const header = rawUrl.slice(5, commaIdx);
          mimeType = header.split(';')[0] || 'image/png';
          base64Data = rawUrl.slice(commaIdx + 1);
        }
      }
      const resolvedUrl = getCloudUrlForProvider(
        rec.ossUrl,
        rec.cloudUrls,
        activeStorageProvider
      );
      return {
        id: `asset-${category}-from-rec-${Date.now()}-${idx}`,
        category,
        isCommonAsset: category === 'product',
        name: `${(rec.title || '归档成图').replace(/[\\/:*?"<>|]/g, '_')}.png`,
        tag: rec.title || (category === 'case' ? '生成归档对标图' : '生成归档产品图'),
        caseDimensions:
          category === 'case'
            ? [...LOCK_ALL_SWAP_PATTERN_DIMENSIONS]
            : undefined,
        mimeType,
        base64Data,
        previewUrl: rawUrl,
        ossUrl: resolvedUrl,
        cloudUrls: rec.cloudUrls ? { ...rec.cloudUrls } : undefined,
        cloudObjectKeys: rec.cloudObjectKeys
          ? { ...rec.cloudObjectKeys }
          : undefined,
        createdAt: nowStr,
        timestamp: Date.now() + idx,
      };
    });

    setCommonAssets((prev) => [...createdAssets, ...prev]);
    await saveCommonAssetsToDb(createdAssets);
    showToast(
      `已将 ${createdAssets.length} 张成图转存至左侧「常用素材库 (${
        category === 'case' ? '#Case 对标图' : '#Prod 产品图'
      })」`,
      'success'
    );
  };

  // Upload one or more Common Assets Library items to the active Cloud Storage (Aliyun OSS or Cloudflare R2)
  // and synchronize the resulting cloud URL across Common Assets, Detail Studio, and SKU Studio!
  const handleBatchUploadCommonAssetsToOss = async (
    assetsToUpload: SavedCommonAsset[],
    singleMode = false
  ) => {
    if (assetsToUpload.length === 0) return;
    if (!isOssReady) {
      setApiConfigTab('oss_storage');
      setShowApiModal(true);
      showToast(`请先配置并开启 ${activeStorageLabel} 云端存储`, 'info');
      return;
    }

    const targetIds = new Set(assetsToUpload.map((a) => a.id));
    setCommonAssets((prev) =>
      prev.map((a) => (targetIds.has(a.id) ? { ...a, ossUploading: true } : a))
    );

    const CHUNK_SIZE = 2;
    let uploadedTotal = 0;
    let lastError = '';
    let lastUploadedUrl = '';

    try {
      for (let i = 0; i < assetsToUpload.length; i += CHUNK_SIZE) {
        const chunk = assetsToUpload.slice(i, i + CHUNK_SIZE);
        const chunkIds = new Set(chunk.map((c) => c.id));
        try {
          const payloadItems = chunk.map((asset) => {
            const cleanBase64 = (asset.base64Data || '').trim();
            return {
              id: asset.id,
              name: `${asset.category}_${asset.tag || asset.name}`.replace(
                /[\\/:*?"<>|]/g,
                '_'
              ),
              mimeType: asset.mimeType || 'image/jpeg',
              base64Data: cleanBase64 || undefined,
              dataUrl: !cleanBase64
                ? asset.previewUrl || asset.ossUrl
                : undefined,
            };
          });

          const res = await studioBridge.uploadToOss({
            items: payloadItems,
            folder: 'refs',
            ossConfig: ossConfigRef.current || config.ossConfig,
          });

          const uploadedMap = new Map<
            string,
            { ossUrl: string; objectKey: string }
          >();
          for (const u of res.uploaded || []) {
            uploadedMap.set(u.id, { ossUrl: u.ossUrl, objectKey: u.objectKey });
            lastUploadedUrl = u.ossUrl;
          }
          uploadedTotal += uploadedMap.size;

          if (res.failed && res.failed.length > 0) {
            lastError = res.failed[0].error || '部分素材上传失败';
          }

          if (uploadedMap.size > 0) {
            const updatedToPersist: SavedCommonAsset[] = [];
            const nameKeyMap = new Map<
              string,
              { ossUrl: string; objectKey: string }
            >();
            for (const c of chunk) {
              const m = uploadedMap.get(c.id);
              if (m) {
                nameKeyMap.set(`${c.category}:${c.name}`, m);
              }
            }

            setCommonAssets((prev) =>
              prev.map((item) => {
                if (!chunkIds.has(item.id)) return item;
                const match = uploadedMap.get(item.id);
                if (!match) return { ...item, ossUploading: false };
                const updated: SavedCommonAsset = {
                  ...item,
                  ossUploading: false,
                  ossUrl: match.ossUrl,
                  ossObjectKey: match.objectKey,
                  cloudUrls: mergeCloudUrlsForProvider(
                    item.ossUrl,
                    item.cloudUrls,
                    activeStorageProvider,
                    match.ossUrl
                  ),
                  cloudObjectKeys: {
                    ...(item.cloudObjectKeys || {}),
                    [activeStorageProvider]: match.objectKey,
                  },
                };
                updatedToPersist.push(updated);
                return updated;
              })
            );

            if (updatedToPersist.length > 0) {
              await saveCommonAssetsToDb(updatedToPersist);
            }

            // Propagate newly uploaded cloud URL to matching items in Detail Studio and SKU Studio
            if (nameKeyMap.size > 0) {
              const syncWorkspaceRefs = (prev: ReferenceImageItem[]) =>
                prev.map((ref) => {
                  const matched = nameKeyMap.get(`${ref.category}:${ref.name}`);
                  if (!matched) return ref;
                  return {
                    ...ref,
                    ossUrl: matched.ossUrl,
                    ossObjectKey: matched.objectKey,
                    cloudUrls: mergeCloudUrlsForProvider(
                      ref.ossUrl,
                      ref.cloudUrls,
                      activeStorageProvider,
                      matched.ossUrl
                    ),
                    cloudObjectKeys: {
                      ...(ref.cloudObjectKeys || {}),
                      [activeStorageProvider]: matched.objectKey,
                    },
                  };
                });
              setReferenceImages(syncWorkspaceRefs);
              setSkuReferenceImages(syncWorkspaceRefs);
            }
          }
        } catch (err: any) {
          lastError = err?.message || `上传至 ${activeStorageLabel} 失败`;
        }
      }

      if (uploadedTotal > 0) {
        if (singleMode && lastUploadedUrl) {
          await navigator.clipboard.writeText(lastUploadedUrl).catch(() => {});
          showToast(
            `已上传素材至 ${activeStorageLabel} 并复制云端直链，各工作台引用已同步更新！`,
            'success'
          );
        } else {
          showToast(
            `已批量同步 ${uploadedTotal}/${assetsToUpload.length} 张常用素材至 ${activeStorageLabel}，各工作台引用已同步更新！`,
            'success'
          );
        }
      } else {
        showToast(
          lastError || `上传素材至 ${activeStorageLabel} 失败`,
          'error'
        );
      }
    } finally {
      setCommonAssets((prev) =>
        prev.map((a) =>
          targetIds.has(a.id) ? { ...a, ossUploading: false } : a
        )
      );
    }
  };

  const handleUploadCommonAssetToOss = async (asset: SavedCommonAsset) => {
    const activeUrl = getCloudUrlForProvider(
      asset.ossUrl,
      asset.cloudUrls,
      activeStorageProvider
    );
    if (activeUrl) {
      navigator.clipboard.writeText(activeUrl).catch(() => {});
      showToast(
        `已复制「${asset.tag || asset.name}」的 ${activeStorageLabel} 云端直链`,
        'success'
      );
      return;
    }
    await handleBatchUploadCommonAssetsToOss([asset], true);
  };

  const handleUploadGenerationRecordToOss = async (
    record: GenerationRecordItem
  ) => {
    const activeUrl = getCloudUrlForProvider(
      record.ossUrl,
      record.cloudUrls,
      activeStorageProvider
    );
    if (activeUrl) {
      navigator.clipboard.writeText(activeUrl).catch(() => {});
      showToast(`已复制该成图的 ${activeStorageLabel} 云端直链`, 'success');
      return;
    }
    if (!isOssReady) {
      setApiConfigTab('oss_storage');
      setShowApiModal(true);
      showToast(`请先配置并开启 ${activeStorageLabel} 对象存储`, 'info');
      return;
    }
    try {
      showToast(
        `正在上传「${record.title}」至 ${activeStorageLabel}...`,
        'info'
      );
      const res = await studioBridge.uploadToOss({
        items: [
          {
            id: record.id,
            name: (record.title || '归档成图').replace(/[\\/:*?"<>|]/g, '_'),
            mimeType: 'image/png',
            dataUrl: record.imageUrl,
          },
        ],
        folder: 'results',
        ossConfig: config.ossConfig,
      });
      const first = res.uploaded?.[0];
      if (!first?.ossUrl) {
        throw new Error(`${activeStorageLabel} 未返回有效直链`);
      }
      const updatedRecord: GenerationRecordItem = {
        ...record,
        ossUrl: first.ossUrl,
        ossObjectKey: first.objectKey,
        cloudUrls: mergeCloudUrlsForProvider(
          record.ossUrl,
          record.cloudUrls,
          activeStorageProvider,
          first.ossUrl
        ),
        cloudObjectKeys: {
          ...(record.cloudObjectKeys || {}),
          [activeStorageProvider]: first.objectKey,
        },
      };
      setGenerationRecords((prev) =>
        prev.map((r) => (r.id === record.id ? updatedRecord : r))
      );
      await updateGenerationRecordsInDb([updatedRecord]);
      // Sync cloud URL back to matching Detail Studio or SKU Studio tasks
      setTasks((prev) =>
        prev.map((t) =>
          t.resultImageUrl === record.imageUrl
            ? {
                ...t,
                resultOssUrl: first.ossUrl,
                resultCloudUrls: mergeCloudUrlsForProvider(
                  t.resultOssUrl,
                  t.resultCloudUrls,
                  activeStorageProvider,
                  first.ossUrl
                ),
              }
            : t
        )
      );
      setSkuTasks((prev) =>
        prev.map((t) =>
          t.resultImageUrl === record.imageUrl
            ? {
                ...t,
                resultOssUrl: first.ossUrl,
                resultCloudUrls: mergeCloudUrlsForProvider(
                  t.resultOssUrl,
                  t.resultCloudUrls,
                  activeStorageProvider,
                  first.ossUrl
                ),
              }
            : t
        )
      );
      await navigator.clipboard.writeText(first.ossUrl).catch(() => {});
      showToast(
        `已成功上传「${record.title}」至 ${activeStorageLabel} 并复制直链！`,
        'success'
      );
    } catch (err: any) {
      showToast(
        err?.message || `上传生成记录至 ${activeStorageLabel} 失败`,
        'error'
      );
    }
  };

  const handleBatchUploadRecordsToOss = async (
    recordsToUpload: GenerationRecordItem[]
  ) => {
    if (recordsToUpload.length === 0) return;
    if (!isOssReady) {
      setApiConfigTab('oss_storage');
      setShowApiModal(true);
      showToast(`请先配置并开启 ${activeStorageLabel} 对象存储`, 'info');
      return;
    }
    const unsynced = recordsToUpload.filter(
      (r) => !isSyncedToProvider(r.ossUrl, r.cloudUrls, activeStorageProvider)
    );
    const targets = unsynced.length > 0 ? unsynced : recordsToUpload;
    let successCount = 0;
    for (const rec of targets) {
      try {
        await handleUploadGenerationRecordToOss({
          ...rec,
          ossUrl: undefined,
          cloudUrls: {
            ...(rec.cloudUrls || {}),
            [activeStorageProvider]: undefined,
          },
        });
        successCount += 1;
      } catch {
        // Ignore individual failure
      }
    }
    if (successCount > 0) {
      showToast(
        `已批量同步 ${successCount}/${targets.length} 张归档成图至 ${activeStorageLabel}`,
        'success'
      );
    }
  };

  const handleAddCustomChannel = (e: React.FormEvent) => {
    e.preventDefault();
    const isCodexProto = newChannelForm.protocol === 'codex-cli';
    if (
      !newChannelForm.name.trim() ||
      (!newChannelForm.baseUrl.trim() && !isCodexProto)
    ) {
      showToast('请填写自定义通道名称与接口 Base URL', 'error');
      return;
    }
    const newId = `channel-${Date.now()}`;
    setConfig((prev) => ({
      ...prev,
      activeChannelId: newId,
      channels: [
        ...prev.channels,
        {
          id: newId,
          name: newChannelForm.name.trim(),
          mode: isCodexProto ? 'codex_cli' : 'custom_gateway',
          baseUrl:
            newChannelForm.baseUrl.trim() ||
            (isCodexProto ? 'codex://local' : ''),
          cliCommand: isCodexProto ? 'codex' : undefined,
          apiKey: newChannelForm.apiKey.trim() || undefined,
          customHeaders: newChannelForm.customHeaders.trim() || undefined,
          protocol: newChannelForm.protocol,
          concurrency: newChannelForm.concurrency,
          timeoutSec: 120,
        },
      ],
    }));
    setNewChannelForm({
      name: '',
      baseUrl: '',
      apiKey: '',
      customHeaders: '',
      protocol: 'auto',
      concurrency: 2,
    });
    setShowNewChannelForm(false);
    showToast(
      isCodexProto
        ? '已添加并切换至本地 Codex CLI 通道'
        : '已添加并切换至新的自定义接口通道（含独立密钥配置）',
      'success'
    );
  };

  const handleDeleteCustomChannel = (channelId: string) => {
    setConfig((prev) => {
      const remaining = prev.channels.filter((c) => c.id !== channelId);
      const nextActive =
        prev.activeChannelId === channelId
          ? remaining[0]?.id || 'official-gemini'
          : prev.activeChannelId;
      return {
        ...prev,
        activeChannelId: nextActive,
        channels: remaining,
      };
    });
    showToast('已删除自定义接口通道', 'info');
  };

  // Dynamic Model Preset Pool Management
  const agentPresetList =
    config.agentModelPresets && config.agentModelPresets.length > 0
      ? config.agentModelPresets
      : DEFAULT_AGENT_MODEL_PRESETS;
  const imagePresetList =
    config.imageModelPresets && config.imageModelPresets.length > 0
      ? config.imageModelPresets
      : DEFAULT_IMAGE_MODEL_PRESETS;

  const handleQuickSaveCurrentModelToPresets = (category: 'agent' | 'image') => {
    const modelId = (
      category === 'agent' ? config.agentModel : config.imageModel
    ).trim();
    if (!modelId) {
      showToast('模型名称不能为空', 'error');
      return;
    }
    const list = category === 'agent' ? agentPresetList : imagePresetList;
    if (list.some((m) => m.id === modelId)) {
      showToast(`模型「${modelId}」已在常用模型池中`, 'info');
      return;
    }
    const newItem: ModelPresetItem = {
      id: modelId,
      label: `${modelId} (自定义常用)`,
      category,
      protocolHint: activeChannel.protocol || 'auto',
      description: '用户自定义添加的常用模型',
      isBuiltIn: false,
    };
    setConfig((prev) => ({
      ...prev,
      agentModelPresets:
        category === 'agent'
          ? [...(prev.agentModelPresets || DEFAULT_AGENT_MODEL_PRESETS), newItem]
          : prev.agentModelPresets,
      imageModelPresets:
        category === 'image'
          ? [...(prev.imageModelPresets || DEFAULT_IMAGE_MODEL_PRESETS), newItem]
          : prev.imageModelPresets,
    }));
    showToast(`已将「${modelId}」存入常用模型池`, 'success');
  };

  const handleAddModelPreset = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = newModelPresetForm.id.trim();
    const cleanLabel = newModelPresetForm.label.trim() || cleanId;
    if (!cleanId) {
      showToast('请填写要添加的模型 ID (例如 gpt-4o 或 flux-1.1-pro)', 'error');
      return;
    }
    const newItem: ModelPresetItem = {
      id: cleanId,
      label: `${cleanId} (${cleanLabel})`,
      category: newModelPresetForm.category,
      protocolHint: newModelPresetForm.protocolHint,
      description: cleanLabel,
      isBuiltIn: false,
    };
    setConfig((prev) => {
      if (newModelPresetForm.category === 'agent') {
        const filtered = (
          prev.agentModelPresets || DEFAULT_AGENT_MODEL_PRESETS
        ).filter((m) => m.id !== cleanId);
        return {
          ...prev,
          agentModel: cleanId,
          agentModelPresets: [...filtered, newItem],
        };
      } else {
        const filtered = (
          prev.imageModelPresets || DEFAULT_IMAGE_MODEL_PRESETS
        ).filter((m) => m.id !== cleanId);
        return {
          ...prev,
          imageModel: cleanId,
          imageModelPresets: [...filtered, newItem],
        };
      }
    });
    setNewModelPresetForm((prev) => ({ ...prev, id: '', label: '' }));
    showToast(`已添加常用模型「${cleanId}」并设为当前激活模型`, 'success');
  };

  const handleRemoveModelPreset = (
    category: 'agent' | 'image',
    modelId: string
  ) => {
    setConfig((prev) => ({
      ...prev,
      agentModelPresets:
        category === 'agent'
          ? (prev.agentModelPresets || DEFAULT_AGENT_MODEL_PRESETS).filter(
              (m) => m.id !== modelId
            )
          : prev.agentModelPresets,
      imageModelPresets:
        category === 'image'
          ? (prev.imageModelPresets || DEFAULT_IMAGE_MODEL_PRESETS).filter(
              (m) => m.id !== modelId
            )
          : prev.imageModelPresets,
    }));
    showToast(`已从常用池移除模型「${modelId}」`, 'info');
  };

  const handleResetModelPresets = () => {
    setConfig((prev) => ({
      ...prev,
      agentModelPresets: DEFAULT_AGENT_MODEL_PRESETS,
      imageModelPresets: DEFAULT_IMAGE_MODEL_PRESETS,
    }));
    showToast('已恢复默认常用模型预设池', 'success');
  };

  const productImages = useMemo(
    () => referenceImages.filter((r) => r.category === 'product'),
    [referenceImages]
  );
  const caseImages = useMemo(
    () => referenceImages.filter((r) => r.category === 'case'),
    [referenceImages]
  );
  const skuProductImages = useMemo(
    () => skuReferenceImages.filter((r) => r.category === 'product'),
    [skuReferenceImages]
  );
  const skuCaseImages = useMemo(
    () => skuReferenceImages.filter((r) => r.category === 'case'),
    [skuReferenceImages]
  );

  const completedCount = useMemo(
    () => tasks.filter((t) => t.status === 'completed').length,
    [tasks]
  );
  const dynamicCount = useMemo(
    () => tasks.filter((t) => t.layerType === 'dynamic').length,
    [tasks]
  );

  const filteredTasks = tasks.filter((t) => {
    if (layerFilter !== 'all' && t.layerType !== layerFilter) return false;
    if (statusFilter !== 'all' && t.status !== statusFilter) return false;
    return true;
  });

  const shortAgentLabel =
    config.agentModel === 'gemini-4-argon'
      ? config.enableHighThinking
        ? 'Argon(High)'
        : 'Argon'
      : config.agentModel === 'gemini-3.8-flash'
        ? config.enableHighThinking
          ? '3.8 Flash(High)'
          : '3.8 Flash'
        : config.agentModel.length > 15
          ? `${config.agentModel.slice(0, 14)}…${
              config.enableHighThinking ? '(High)' : ''
            }`
          : `${config.agentModel}${config.enableHighThinking ? '(High)' : ''}`;
  const shortImageLabel =
    config.imageModel === 'gemini-nano-banana-2.1'
      ? 'Banana 2.1'
      : config.imageModel === 'gemini-3-pro-image'
        ? '3 Pro Image'
        : config.imageModel === 'gemini-3.1-flash-lite-image'
          ? 'Flash Lite'
          : config.imageModel.length > 16
            ? `${config.imageModel.slice(0, 15)}…`
            : config.imageModel;

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col bg-[#F4F5F7] text-[#0F172A]">
      {/* ================= TOP GLOBAL STUDIO NAVIGATION BAR ================= */}
      <StudioTopHeader
        activeTopTab={activeTopTab}
        onSelectTopTab={setActiveTopTab}
        selectedPresetId={selectedPresetId}
        confirmedTemplates={confirmedTemplates}
        onSelectPreset={handleSelectPreset}
        showSaveMasterModal={showSaveMasterModal}
        setShowSaveMasterModal={setShowSaveMasterModal}
        newMasterNameInput={newMasterNameInput}
        setNewMasterNameInput={setNewMasterNameInput}
        onSaveCurrentAsMasterTemplate={handleSaveCurrentAsMasterTemplate}
        onDeleteConfirmedTemplate={handleDeleteConfirmedTemplate}
        onClearWorkspaceToBlank={handleClearWorkspaceToBlank}
        confirmBeforeReset={config.confirmBeforeReset !== false}
        defaultPreserveCopyOnReset={Boolean(config.preserveCopyOnReset)}
        masterTemplateFileInputRef={masterTemplateFileInputRef}
        onImportMasterTemplateFile={handleImportMasterTemplateFile}
        onExportCurrentMasterTemplateFile={handleExportCurrentMasterTemplateFile}
        tasks={tasks}
        skuTasks={skuTasks}
        referenceImages={referenceImages}
        skuReferenceImages={skuReferenceImages}
        fullPlanDoc={fullPlanDoc}
        commonAssetsCount={commonAssets.length}
        generationRecordsCount={generationRecords.length}
        isOssReady={isOssReady}
        storageProvider={activeStorageProvider}
        onSwitchStorageProvider={handleSwitchStorageProvider}
        isSyncingAllRefsToOss={isSyncingAllRefsToOss}
        onSyncAllReferencesToOss={handleSyncAllReferencesToOss}
        activeChannelMode={activeChannel.mode}
        activeChannelId={config.activeChannelId}
        channels={config.channels}
        agentModel={config.agentModel}
        enableHighThinking={config.enableHighThinking}
        imageModel={config.imageModel}
        agentModelPresets={agentPresetList}
        imageModelPresets={imagePresetList}
        shortAgentLabel={shortAgentLabel}
        shortImageLabel={shortImageLabel}
        onQuickSelectChannel={(channelId) => {
          const ch = config.channels.find((c) => c.id === channelId);
          setConfig((prev) => ({ ...prev, activeChannelId: channelId }));
          if (ch) {
            showToast(`已切换至通道「${ch.name}」`, 'success');
          }
        }}
        onQuickSelectAgentModel={(modelId) => {
          setConfig((prev) => ({ ...prev, agentModel: modelId }));
          showToast(`已切换策划模型为「${modelId}」`, 'success');
        }}
        onQuickToggleHighThinking={() => {
          setConfig((prev) => {
            const next = !prev.enableHighThinking;
            showToast(
              next ? '已开启 High 深度思考模式' : '已切换为标准响应模式',
              'info'
            );
            return { ...prev, enableHighThinking: next };
          });
        }}
        onQuickSelectImageModel={(modelId) => {
          setConfig((prev) => ({ ...prev, imageModel: modelId }));
          showToast(`已切换生图模型为「${modelId}」`, 'success');
        }}
        onOpenApiModal={(tab) => {
          setApiConfigTab(tab);
          setShowApiModal(true);
        }}
        runtimeLogs={runtimeLogs}
        onClearRuntimeLogs={clearRuntimeLogs}
        onMarkRuntimeLogsRead={markRuntimeLogsRead}
        onCopyLogText={(txt) => {
          navigator.clipboard.writeText(txt).catch(() => {});
          showToast('已复制运行日志报错详情', 'success');
        }}
      />

      {/* ================= FLOATING TOAST NOTIFICATION ================= */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 max-w-md bg-slate-900 text-white px-4 py-3 rounded-lg shadow-lg border border-slate-700 flex items-center gap-3 text-xs">
          {toastMessage.type === 'error' ? (
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          ) : toastMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <Sparkles className="w-4 h-4 text-blue-400 shrink-0" />
          )}
          <span className="leading-snug">{toastMessage.text}</span>
          <button
            onClick={() => setToastMessage(null)}
            className="text-slate-400 hover:text-white ml-2 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ================= TOP-LEVEL WORKSPACE ROUTER ================= */}
      {activeTopTab === 'sku_studio' ? (
        <SkuStudioView
          prodAssets={skuProductImages}
          caseAssets={skuCaseImages}
          commonAssets={commonAssets}
          detailWorkspaceAssets={referenceImages}
          skuBatchConfig={skuBatchConfig}
          skuTasks={skuTasks}
          skuBatchSummary={skuBatchSummary}
          detailProductInfoText={productInfoText}
          ossEnabled={isOssReady}
          storageProvider={activeStorageProvider}
          isAnalyzingRefs={isAnalyzingRefs}
          isParsingSkuPlan={isParsingSkuPlan}
          isSkuBatchRunning={isSkuBatchRunning}
          polishingSkuTaskId={polishingSkuTaskId}
          generatingPromptSkuTaskId={generatingPromptSkuTaskId}
          isExtractingCaseLayout={isExtractingCaseLayout}
          isExportingSkuZip={isExportingSkuZip}
          onUpdateSkuBatchConfig={updateSkuBatchConfig}
          onUpdateSkuTask={updateSkuTask}
          onDeleteSkuTask={handleDeleteSkuTask}
          onAddBlankSkuTask={handleAddBlankSkuTask}
          onQuickCreateTasksFromSelectedProds={
            handleQuickCreateTasksFromSelectedProds
          }
          onAgentGenerateSkuPlan={handleAgentGenerateSkuPlan}
          onAgentGenerateSingleSkuPrompt={handleAgentGenerateSingleSkuPrompt}
          onPolishSkuPrompt={handlePolishSkuPrompt}
          onGenerateSingleSkuImage={(t) => {
            generateSingleSkuTaskImage(t);
          }}
          onStartBatchGenerateSkus={handleStartBatchGenerateSkus}
          onStopBatchGenerateSkus={handleStopBatchGenerateSkus}
          onSyncGlobalConfigToAllSkuTasks={handleSyncGlobalConfigToAllSkuTasks}
          onExtractCaseLayout={handleExtractCaseLayout}
          onPromoteTaskResultToGlobalCase={handlePromoteTaskResultToGlobalCase}
          onExportSkuZip={handleExportSkuZip}
          onUploadFiles={(files, category, targetSkuTaskId) =>
            handleUploadFiles(files, category, targetSkuTaskId, 'sku_studio')
          }
          onSelectAssetsFromLibrary={handleSelectAssetsFromLibraryForSku}
          onUploadCommonAssetFiles={handleUploadCommonAssetFiles}
          onSaveSkuAssetsToLibrary={handleSaveSkuRefsToCommonAssets}
          onUpdateSkuAssetTag={handleUpdateSkuAssetTag}
          onUploadSkuRefsToOss={(items) => uploadReferenceItemsToOss(items, false)}
          isSyncingOss={isSyncingAllRefsToOss}
          onRemoveSkuAsset={handleRemoveSkuReference}
          onClearSkuCategoryAssets={handleClearSkuCategoryReferences}
          onToggleCaseDimension={toggleSkuCaseDimension}
          onSetCaseDimensions={handleSetSkuCaseDimensions}
          onToggleCaseLockBaseSwap={handleToggleSkuCaseLockBaseSwap}
          onUpdateCaseCustomRule={handleUpdateSkuCaseCustomRule}
          onAutoAnalyzeRefs={handleAutoAnalyzeSkuReferenceTags}
          onUploadSkuResultToOss={handleUploadSkuResultToOss}
          onPreviewImage={(url, title, subtitle) =>
            setLightboxImage({
              url,
              title: title || '主图/SKU参考图或成图预览',
              subtitle: subtitle || '① 主图/SKU工作台',
            })
          }
          onShowToast={showToast}
          onSyncReplicaPairsAndRun={handleSyncReplicaPairsAndRun}
          onExtendReplicaToDetail={handleExtendReplicaToDetail}
          onUpdateSkuProdRole={handleUpdateSkuProdRole}
          onToggleSkuAssetEnabled={handleToggleSkuAssetEnabled}
          onBatchSetSkuAssetsEnabled={handleBatchSetSkuAssetsEnabled}
          onFissionTaskToOtherProds={handleFissionTaskToOtherProds}
          onBuildStandardFiveMainCards={handleBuildStandardFiveMainCards}
          sellingPointPresets={
            config.defaultSellingPointPresets &&
            config.defaultSellingPointPresets.length > 0
              ? config.defaultSellingPointPresets
              : DEFAULT_SKU_SELLING_POINT_PRESETS
          }
          onOpenPresetSettings={() => {
            setApiConfigTab('presets_fallback');
            setShowApiModal(true);
          }}
        />
      ) : activeTopTab === 'master_library' ? (
        <MasterLibraryView
          templates={confirmedTemplates}
          activeMasterId={
            selectedPresetId !== 'blank-workspace' ? selectedPresetId : null
          }
          canSaveCurrentWorkspace={
            tasks.length > 0 ||
            skuTasks.length > 0 ||
            referenceImages.length > 0 ||
            skuReferenceImages.length > 0 ||
            Boolean(fullPlanDoc.trim())
          }
          commonAssets={commonAssets}
          workspaceReferenceImages={
            referenceImages.length > 0 ? referenceImages : skuReferenceImages
          }
          generationRecords={generationRecords}
          onLoadTemplate={(tpl, switchToStudio) => {
            handleSelectPreset(tpl.id);
            if (switchToStudio) {
              if (tpl.tasks.length === 0 && (tpl.skuTasks?.length || 0) > 0) {
                setActiveTopTab('sku_studio');
              } else {
                setActiveTopTab('detail_studio');
              }
            }
          }}
          onDeleteTemplate={handleDeleteConfirmedTemplate}
          onExportSingleTemplate={(tpl) => {
            exportMasterTemplateToJsonFile(tpl);
            showToast(`已导出母版「${tpl.name}.json」`, 'success');
          }}
          onTriggerImportJson={() => masterTemplateFileInputRef.current?.click()}
          onOpenSaveCurrentModal={() => setShowSaveMasterModal(true)}
          onSwitchToDetailStudio={() => setActiveTopTab('detail_studio')}
          onSwitchToSkuStudio={() => setActiveTopTab('sku_studio')}
          onUploadCommonAssetFiles={handleUploadCommonAssetFiles}
          onImportFromCurrentWorkspace={handleImportFromCurrentWorkspace}
          onUpdateCommonAsset={handleUpdateCommonAsset}
          onDeleteCommonAssets={handleDeleteCommonAssets}
          onPushAssetsToStudio={handlePushAssetsToStudio}
          onUploadCommonAssetToOss={handleUploadCommonAssetToOss}
          onBatchUploadCommonAssetsToOss={(assets) =>
            handleBatchUploadCommonAssetsToOss(assets, false)
          }
          onDeleteGenerationRecords={handleDeleteGenerationRecords}
          onSaveRecordsToCommonAssets={handleSaveRecordsToCommonAssets}
          onUploadRecordToOss={handleUploadGenerationRecordToOss}
          onBatchUploadRecordsToOss={handleBatchUploadRecordsToOss}
          ossEnabled={isOssReady}
          storageProvider={activeStorageProvider}
          onPreviewImage={(url, title, subtitle) =>
            setLightboxImage({
              url,
              title: title || '资产库大图预览',
              subtitle: subtitle || '③ 资产库',
            })
          }
          onShowToast={showToast}
        />
      ) : (
        <DetailModularView
          prodAssets={productImages}
          caseAssets={caseImages}
          commonAssets={commonAssets}
          tasks={tasks}
          productInfoText={productInfoText}
          unifiedVisualSpec={config.requirements.unifiedVisualSpec || ''}
          aspectRatio={config.requirements.detailAspectRatio}
          imageSize={config.defaultImageSize}
          textMode={config.requirements.textMode}
          ossEnabled={isOssReady}
          storageProvider={activeStorageProvider}
          isSyncingOss={isSyncingAllRefsToOss}
          isExtractingStyle={isAnalyzingRefs}
          isPlanningModules={isParsingPlan}
          isBatchRunning={isBatchRunning}
          isStitching={isStitching}
          isExportingZip={isExportingZip}
          stitchedLongImageUrl={stitchedLongImageUrl}
          skuTasksCount={skuTasks.length}
          skuProdCount={skuProductImages.length}
          onChangeProductInfoText={setProductInfoText}
          onChangeUnifiedVisualSpec={(spec) =>
            setConfig((prev) => ({
              ...prev,
              requirements: {
                ...prev.requirements,
                unifiedVisualSpec: spec,
              },
            }))
          }
          onChangeAspectRatio={(ratio) => {
            setConfig((prev) => ({
              ...prev,
              requirements: {
                ...prev.requirements,
                detailAspectRatio: ratio,
              },
            }));
            setTasks((prev) => {
              const next = prev.map((t) => ({
                ...t,
                aspectRatio: ratio,
                benchmarkCase: (t.benchmarkCase || '').replace(
                  /\b(3:4|9:16)\b/g,
                  ratio
                ),
                visualPrompt: (t.visualPrompt || '').replace(
                  /转(3:4|9:16)竖版/g,
                  `转${ratio}竖版`
                ).replace(
                  /延展为(3:4|9:16)电商/g,
                  `延展为${ratio}电商`
                ),
              }));
              tasksRef.current = next;
              return next;
            });
          }}
          onChangeImageSize={(size) => {
            setConfig((prev) => ({ ...prev, defaultImageSize: size }));
            setTasks((prev) => prev.map((t) => ({ ...t, imageSize: size })));
          }}
          onChangeTextMode={(mode) => {
            setConfig((prev) => ({
              ...prev,
              requirements: {
                ...prev.requirements,
                textMode: mode,
              },
            }));
            setTasks((prev) => prev.map((t) => ({ ...t, textMode: mode })));
          }}
          onAddModuleTask={handleAddDetailModuleTask}
          onApplyStandardPresetModules={handleApplyStandardPresetModules}
          onAppendTailModules={handleAppendTailDetailModules}
          onUpdateTask={updateTask}
          onMoveTask={handleMoveDetailTask}
          onDuplicateTask={handleDuplicateDetailTask}
          onDeleteTask={handleDeleteDetailTask}
          onClearAllTasks={() => {
            setTasks([]);
            tasksRef.current = [];
            showToast('已清空全部分屏模块', 'info');
          }}
          onExtractCompetitorStyle={handleExtractCompetitorDetailStyle}
          onAiPlanAllModules={handleAiPlanDetailModules}
          onGenerateSingleTask={(t) => {
            void generateSingleTaskImage(t);
          }}
          onStartBatchGenerate={(onlyUnfinished) => {
            void handleStartBatchGenerate(Boolean(onlyUnfinished), false);
          }}
          onStopBatchGenerate={handleStopBatch}
          onStitchLongImage={handleStitchLongImage}
          onExportZip={handleExportZip}
          onUploadFiles={(files, category) =>
            handleUploadFiles(files, category, undefined, 'detail_studio')
          }
          onSelectAssetsFromLibrary={handleSelectAssetsFromLibraryForDetail}
          onSaveDetailAssetsToLibrary={handleImportFromCurrentWorkspace}
          onSyncAllRefsToOss={handleSyncAllReferencesToOss}
          onRemoveAsset={handleRemoveReference}
          onClearCategoryAssets={handleClearCategoryReferences}
          onPreviewImage={(url, title, subtitle) =>
            setLightboxImage({
              url,
              title: title || '详情页模块预览',
              subtitle: subtitle || '② 详情页工作台',
            })
          }
          onUpdateDetailProdRole={handleUpdateDetailProdRole}
          onToggleDetailAssetEnabled={handleToggleDetailAssetEnabled}
          onBatchSetDetailAssetsEnabled={handleBatchSetDetailAssetsEnabled}
          onUpdateDetailAssetTag={handleUpdateDetailAssetTag}
          onAutoAnalyzeDetailRefs={handleAutoAnalyzeReferenceTags}
          onSyncFromSkuStudio={handleSyncFromSkuStudioToDetail}
          sellingPointPresets={
            config.defaultSellingPointPresets &&
            config.defaultSellingPointPresets.length > 0
              ? config.defaultSellingPointPresets
              : DEFAULT_SKU_SELLING_POINT_PRESETS
          }
          onOpenPresetSettings={() => {
            setApiConfigTab('presets_fallback');
            setShowApiModal(true);
          }}
          onShowToast={showToast}
        />
      )}

      {/* Hidden File Inputs for Modal/Global Product & Case Upload Triggers */}
      <input
        ref={prodFileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          setLeftActiveModule('assets');
          setActiveAssetTab('product');
          handleUploadFiles(e.target.files, 'product');
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
          setLeftActiveModule('assets');
          setActiveAssetTab('case');
          handleUploadFiles(e.target.files, 'case');
          e.target.value = '';
        }}
      />

      {/* ================= >4096PX OVERSIZED / LONG REFERENCE IMAGE HELPER MODAL ================= */}
      {oversizedQueue.length > 0 && (
        <LongImageHelperModal
          candidate={oversizedQueue[0]}
          remainingCount={oversizedQueue.length}
          ossEnabled={isOssReady}
          onCompleteSegments={handleCompleteOversizedSegments}
          onSkip={handleSkipOversizedCandidate}
        />
      )}

      {/* ================= GLOBAL SETTINGS CENTER MODAL (PRESETS FALLBACK, API CHANNELS, MODEL POOL, OSS, DESKTOP ARCH) ================= */}
      {showApiModal && (
        <div
          onClick={() => {
            setShowChannelApiKey(false);
            setShowApiModal(false);
          }}
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white border border-slate-200 rounded-2xl w-[95vw] max-w-[1240px] h-[88vh] min-h-[680px] max-h-[920px] flex flex-col overflow-hidden shadow-2xl"
          >
            {/* Modal Top Header */}
            <div className="px-7 pt-5 pb-4 border-b border-slate-200/80 flex items-center justify-between gap-4 shrink-0 bg-white">
              <div className="space-y-1">
                <div className="flex items-center gap-2.5">
                  <span className="px-2.5 py-0.5 text-xs font-bold bg-slate-900 text-white rounded-md font-mono-tabular">
                    全局设置中心
                  </span>
                  <h3 className="text-lg font-bold text-slate-900">
                    双工作台预置兜底、生图防变形护栏、模型通道池与云存储设置
                  </h3>
                </div>
                <p className="text-xs text-slate-500">
                  在此设定的「通用卖点方案库」、「双工作台默认参数」与「防变形全局护栏」受持久化保护，点击顶栏重置后自动作为兜底方案恢复
                </p>
              </div>

              <button
                onClick={() => {
                  setShowChannelApiKey(false);
                  setShowApiModal(false);
                }}
                className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
                title="关闭设置中心"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Dedicated 5-Tab Navigation Bar */}
            <div className="px-7 py-2.5 bg-slate-50 border-b border-slate-200/80 flex items-center gap-2 overflow-x-auto shrink-0">
              <button
                type="button"
                onClick={() => setApiConfigTab('presets_fallback')}
                className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
                  apiConfigTab === 'presets_fallback'
                    ? 'bg-white text-blue-600 shadow-xs border border-slate-200/80 font-bold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                }`}
              >
                <SlidersHorizontal className="w-4 h-4" />
                <span>
                  1. 预置与重置兜底 (
                  {(
                    config.defaultSellingPointPresets ||
                    skuBatchConfig.sellingPointPresets ||
                    DEFAULT_SKU_SELLING_POINT_PRESETS
                  ).length}
                  )
                </span>
              </button>

              <button
                type="button"
                onClick={() => setApiConfigTab('channel_model')}
                className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
                  apiConfigTab === 'channel_model'
                    ? 'bg-white text-blue-600 shadow-xs border border-slate-200/80 font-bold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                }`}
              >
                <Globe className="w-4 h-4" />
                <span>2. 端点与模型配置</span>
              </button>

              <button
                type="button"
                onClick={() => setApiConfigTab('model_presets')}
                className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
                  apiConfigTab === 'model_presets'
                    ? 'bg-white text-blue-600 shadow-xs border border-slate-200/80 font-bold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                }`}
              >
                <Cpu className="w-4 h-4" />
                <span>
                  3. 常用模型池 ({agentPresetList.length + imagePresetList.length})
                </span>
              </button>

              <button
                type="button"
                onClick={() => setApiConfigTab('oss_storage')}
                className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
                  apiConfigTab === 'oss_storage'
                    ? activeStorageProvider === 'cloudflare_r2'
                      ? 'bg-white text-orange-700 shadow-xs border border-slate-200/80 font-bold'
                      : 'bg-white text-emerald-700 shadow-xs border border-slate-200/80 font-bold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                }`}
              >
                <Cloud className="w-4 h-4" />
                <span>
                  4. 云存储 OSS / R2 (
                  {isOssReady
                    ? activeStorageProvider === 'cloudflare_r2'
                      ? 'R2 已启用'
                      : 'OSS 已启用'
                    : '可切换'}
                  )
                </span>
              </button>

              <button
                type="button"
                onClick={() => setApiConfigTab('desktop_arch')}
                className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
                  apiConfigTab === 'desktop_arch'
                    ? 'bg-white text-blue-600 shadow-xs border border-slate-200/80 font-bold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                }`}
              >
                <Monitor className="w-4 h-4" />
                <span>5. 本地缓存 & 桌面架构</span>
              </button>
            </div>

            {/* Modal Scrollable Body (Unified Height Viewport) */}
            <div className="flex-1 overflow-y-auto px-7 py-6 space-y-6 bg-slate-50/40">
              {/* ================= TAB 0: DUAL-WORKBENCH PRESETS, FALLBACK DEFAULTS & QUALITY GUARD ENGINE ================= */}
              {apiConfigTab === 'presets_fallback' && (() => {
                const activeSpPresets =
                  config.defaultSellingPointPresets &&
                  config.defaultSellingPointPresets.length > 0
                    ? config.defaultSellingPointPresets
                    : skuBatchConfig.sellingPointPresets &&
                        skuBatchConfig.sellingPointPresets.length > 0
                      ? skuBatchConfig.sellingPointPresets
                      : DEFAULT_SKU_SELLING_POINT_PRESETS;

                const fb: SkuDefaultFallbackConfig = {
                  ...DEFAULT_SKU_FALLBACK_CONFIG,
                  ...(config.skuDefaultFallback || {}),
                };

                const qg: QualityGuardGlobalConfig = {
                  ...DEFAULT_QUALITY_GUARD_CONFIG,
                  ...(config.qualityGuardConfig || {}),
                };

                const syncGlobalSellingPointPresets = (
                  nextList: SkuSellingPointPreset[]
                ) => {
                  setConfig((prev) => ({
                    ...prev,
                    defaultSellingPointPresets: nextList,
                  }));
                  setSkuBatchConfig((prev) => ({
                    ...prev,
                    sellingPointPresets: nextList,
                  }));
                };

                const updateSkuFallbackPatch = (
                  patch: Partial<SkuDefaultFallbackConfig>
                ) => {
                  setConfig((prev) => ({
                    ...prev,
                    skuDefaultFallback: {
                      ...DEFAULT_SKU_FALLBACK_CONFIG,
                      ...(prev.skuDefaultFallback || {}),
                      ...patch,
                    },
                  }));
                };

                const updateQualityGuardPatch = (
                  patch: Partial<QualityGuardGlobalConfig>
                ) => {
                  setConfig((prev) => ({
                    ...prev,
                    qualityGuardConfig: {
                      ...DEFAULT_QUALITY_GUARD_CONFIG,
                      ...(prev.qualityGuardConfig || {}),
                      ...patch,
                    },
                  }));
                };

                const handleAddGlobalSpPreset = (e: React.FormEvent) => {
                  e.preventDefault();
                  const cleanLabel = newGlobalSpForm.label.trim();
                  const cleanBadge = newGlobalSpForm.sellingPointBadge.trim();
                  if (!cleanLabel || !cleanBadge) {
                    showToast('请填写方案名称与核心卖点文案', 'error');
                    return;
                  }
                  const created: SkuSellingPointPreset = {
                    id: `sp-global-${Date.now()}`,
                    label: cleanLabel,
                    sellingPointBadge: cleanBadge,
                    packageSpecNote:
                      newGlobalSpForm.packageSpecNote.trim() || undefined,
                  };
                  const nextList = [...activeSpPresets, created];
                  syncGlobalSellingPointPresets(nextList);
                  setNewGlobalSpForm({
                    label: '',
                    sellingPointBadge: '',
                    packageSpecNote: '',
                    titlePrefix: '',
                    subtitleText: '',
                  });
                  showToast(
                    `已新增通用卖点方案「${cleanLabel}」，主图与详情页双工作台可一键调用`,
                    'success'
                  );
                };

                const handleApplyPresetToMainStudio = (
                  preset: SkuSellingPointPreset
                ) => {
                  const combined = [
                    preset.sellingPointBadge.trim(),
                    preset.packageSpecNote?.trim(),
                  ]
                    .filter(Boolean)
                    .join(' ｜ ');
                  updateSkuBatchConfig({
                    referenceInfoText: combined,
                  });
                  setSkuTasks((prev) =>
                    prev.map((st) => {
                      const nextSpecNote =
                        preset.packageSpecNote || st.packageSpecNote || '';
                      const synced = syncSellingPointsIntoTypographyAndPrompt(
                        st.typographyPlan,
                        st.visualPrompt,
                        st.sellingPointBadge,
                        preset.sellingPointBadge,
                        st.packageSpecNote || '',
                        nextSpecNote
                      );
                      return {
                        ...st,
                        sellingPointBadge: preset.sellingPointBadge,
                        packageSpecNote: nextSpecNote,
                        typographyPlan: synced.typographyPlan,
                        visualPrompt: synced.visualPrompt,
                      };
                    })
                  );
                  showToast(
                    `已将「${preset.label}」应用至 ① 主图/SKU工作台`,
                    'success'
                  );
                };

                const handleApplyPresetToDetailStudio = (
                  preset: SkuSellingPointPreset
                ) => {
                  const lineToInsert = [
                    preset.sellingPointBadge.trim(),
                    preset.packageSpecNote?.trim(),
                  ]
                    .filter(Boolean)
                    .join('；');
                  setProductInfoText((prev) => {
                    const cleanPrev = prev.trim();
                    if (!cleanPrev) return lineToInsert;
                    if (cleanPrev.includes(preset.sellingPointBadge.trim())) {
                      return cleanPrev;
                    }
                    return `${cleanPrev}\n${lineToInsert}`;
                  });
                  showToast(
                    `已将「${preset.label}」填入 ② 详情页工作台卖点栏`,
                    'success'
                  );
                };

                const handleExportGlobalSettingsJson = () => {
                  const payload = {
                    version: 'ecom_studio_global_settings_v2',
                    exportedAt: new Date().toISOString(),
                    config: {
                      ...config,
                      defaultSellingPointPresets: activeSpPresets,
                      skuDefaultFallback: fb,
                      qualityGuardConfig: qg,
                    },
                  };
                  const blob = new Blob([JSON.stringify(payload, null, 2)], {
                    type: 'application/json',
                  });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `EComStudio_全局设置与卖点预置备份_${new Date()
                    .toISOString()
                    .slice(0, 10)}.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                  showToast(
                    '已导出全局设置与常用卖点方案备份文件 (.json)',
                    'success'
                  );
                };

                const handleImportGlobalSettingsJson = async (
                  e: React.ChangeEvent<HTMLInputElement>
                ) => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (!file) return;
                  try {
                    const text = await file.text();
                    const parsedJson = JSON.parse(text);
                    const importedCfg = (parsedJson.config ||
                      parsedJson) as Partial<StudioConfig>;
                    const importedSp = Array.isArray(
                      importedCfg.defaultSellingPointPresets
                    )
                      ? importedCfg.defaultSellingPointPresets
                      : undefined;
                    const importedFb = importedCfg.skuDefaultFallback;
                    const importedQg = importedCfg.qualityGuardConfig;

                    setConfig((prev) => ({
                      ...prev,
                      ...importedCfg,
                      defaultSellingPointPresets:
                        importedSp || prev.defaultSellingPointPresets,
                      skuDefaultFallback: importedFb
                        ? { ...DEFAULT_SKU_FALLBACK_CONFIG, ...importedFb }
                        : prev.skuDefaultFallback,
                      qualityGuardConfig: importedQg
                        ? { ...DEFAULT_QUALITY_GUARD_CONFIG, ...importedQg }
                        : prev.qualityGuardConfig,
                      ossConfig: mergeOssConfigPreservingCredentials(
                        prev.ossConfig,
                        importedCfg.ossConfig
                      ),
                    }));
                    if (importedSp && importedSp.length > 0) {
                      setSkuBatchConfig((prev) => ({
                        ...prev,
                        sellingPointPresets: importedSp,
                      }));
                    }
                    showToast(
                      `已成功导入并恢复全局设置（含 ${
                        importedSp?.length || 0
                      } 套常用卖点方案）`,
                      'success'
                    );
                  } catch (err: any) {
                    showToast(
                      err?.message || '导入全局设置 JSON 文件失败，请检查文件格式',
                      'error'
                    );
                  }
                };

                return (
                  <div className="space-y-6">
                    {/* Top Protection Banner */}
                    <div className="p-5 bg-slate-900 text-white rounded-2xl flex flex-wrap items-center justify-between gap-4">
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2.5">
                          <span className="px-2.5 py-0.5 text-[11px] font-bold bg-emerald-500 text-slate-950 rounded-md flex items-center gap-1">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span>双工作台互通 · 重置防丢保护</span>
                          </span>
                          <h4 className="text-sm font-bold">
                            双工作台卖点预置库、真实默认参数兜底 & 生图防变形护栏
                          </h4>
                        </div>
                        <p className="text-xs text-slate-300 leading-relaxed">
                          「常用卖点方案库」同时服务 ① 主图/SKU工作台 与 ② 详情页工作台；点击顶栏「重置」时仅清空临时画布，100% 保留以下兜底参数与防变形护栏。
                        </p>
                      </div>

                      <div className="flex items-center gap-2.5 shrink-0">
                        <input
                          ref={globalConfigFileInputRef}
                          type="file"
                          accept=".json,application/json"
                          className="hidden"
                          onChange={handleImportGlobalSettingsJson}
                        />
                        <button
                          type="button"
                          onClick={() =>
                            globalConfigFileInputRef.current?.click()
                          }
                          className="px-3.5 py-2 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl flex items-center gap-1.5 cursor-pointer"
                        >
                          <Upload className="w-3.5 h-3.5 text-blue-400" />
                          <span>导入设置备份</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleExportGlobalSettingsJson}
                          className="px-3.5 py-2 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-xl flex items-center gap-1.5 cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>导出全局设置备份 (.json)</span>
                        </button>
                      </div>
                    </div>

                    {/* SECTION 1: Dual-Workbench Selling Point Presets Library */}
                    <div className="p-6 bg-white border border-slate-200 rounded-2xl space-y-5 shadow-2xs">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                            <Palette className="w-4 h-4 text-blue-600" />
                            <span>
                              一、双工作台通用卖点预置方案库（共{' '}
                              <span className="font-mono-tabular text-blue-600">
                                {activeSpPresets.length}
                              </span>{' '}
                              套 · ① 主图工作台 & ② 详情页工作台共享）
                            </span>
                          </h4>
                          <p className="text-xs text-slate-500 mt-1">
                            直接编辑方案名称、核心卖点文案（建议用「｜」分隔）与包装配件说明；支持在此一键推入主图或详情页工作台
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            syncGlobalSellingPointPresets(
                              DEFAULT_SKU_SELLING_POINT_PRESETS
                            );
                            showToast('已恢复系统出厂示例卖点方案', 'info');
                          }}
                          className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-rose-600 bg-slate-50 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 rounded-lg transition-colors cursor-pointer"
                        >
                          恢复系统示例方案
                        </button>
                      </div>

                      {/* Add New Selling Point Preset Form (Clean single-row 12-col grid without legacy prefix clutter) */}
                      <form
                        onSubmit={handleAddGlobalSpPreset}
                        className="p-4 bg-slate-50/80 border border-blue-200/80 rounded-xl space-y-3"
                      >
                        <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                          <Plus className="w-3.5 h-3.5 text-blue-600" />
                          <span>新增双工作台通用卖点方案</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                          <input
                            type="text"
                            value={newGlobalSpForm.label}
                            onChange={(e) =>
                              setNewGlobalSpForm((prev) => ({
                                ...prev,
                                label: e.target.value,
                              }))
                            }
                            placeholder="方案名称 (如: 🎧 声学高配版)"
                            className="md:col-span-3 px-3.5 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
                          />
                          <input
                            type="text"
                            value={newGlobalSpForm.sellingPointBadge}
                            onChange={(e) =>
                              setNewGlobalSpForm((prev) => ({
                                ...prev,
                                sellingPointBadge: e.target.value,
                              }))
                            }
                            placeholder="核心卖点文案 (如: 蓝牙6.0 ｜ 13mm动圈 ｜ 36h超长续航)"
                            className="md:col-span-5 px-3.5 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
                          />
                          <input
                            type="text"
                            value={newGlobalSpForm.packageSpecNote}
                            onChange={(e) =>
                              setNewGlobalSpForm((prev) => ({
                                ...prev,
                                packageSpecNote: e.target.value,
                              }))
                            }
                            placeholder="包装/配件补充说明 (可选)"
                            className="md:col-span-2 px-3.5 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
                          />
                          <button
                            type="submit"
                            className="md:col-span-2 py-2 px-3.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg cursor-pointer"
                          >
                            + 添加至方案库
                          </button>
                        </div>
                      </form>

                      {/* Editable Presets List */}
                      <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                        {activeSpPresets.map((preset, idx) => (
                          <div
                            key={preset.id}
                            className="p-3.5 bg-slate-50/60 border border-slate-200/90 rounded-xl hover:border-slate-300 transition-colors"
                          >
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 items-center">
                              <div className="md:col-span-2 flex items-center gap-2">
                                <span className="text-xs font-mono-tabular font-bold text-slate-400 w-5 shrink-0">
                                  #{idx + 1}
                                </span>
                                <input
                                  type="text"
                                  value={preset.label}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    syncGlobalSellingPointPresets(
                                      activeSpPresets.map((p) =>
                                        p.id === preset.id
                                          ? { ...p, label: val }
                                          : p
                                      )
                                    );
                                  }}
                                  className="w-full px-2.5 py-1.5 text-xs font-semibold text-slate-900 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
                                  placeholder="方案名称"
                                />
                              </div>

                              <div className="md:col-span-4">
                                <input
                                  type="text"
                                  value={preset.sellingPointBadge}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    syncGlobalSellingPointPresets(
                                      activeSpPresets.map((p) =>
                                        p.id === preset.id
                                          ? { ...p, sellingPointBadge: val }
                                          : p
                                      )
                                    );
                                  }}
                                  className="w-full px-3 py-1.5 text-xs text-slate-800 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
                                  placeholder="核心卖点文案（用｜分隔）"
                                />
                              </div>

                              <div className="md:col-span-3">
                                <input
                                  type="text"
                                  value={preset.packageSpecNote || ''}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    syncGlobalSellingPointPresets(
                                      activeSpPresets.map((p) =>
                                        p.id === preset.id
                                          ? { ...p, packageSpecNote: val }
                                          : p
                                      )
                                    );
                                  }}
                                  className="w-full px-3 py-1.5 text-xs text-slate-600 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
                                  placeholder="包装/规格补充说明 (可选)"
                                />
                              </div>

                              <div className="md:col-span-3 flex items-center justify-end gap-1 flex-wrap">
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleApplyPresetToMainStudio(preset)
                                  }
                                  title="将此方案应用至 ① 主图/SKU工作台"
                                  className="px-2 py-1 text-[11px] font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-md cursor-pointer"
                                >
                                  填入①主图
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleApplyPresetToDetailStudio(preset)
                                  }
                                  title="将此方案追加至 ② 详情页工作台产品卖点栏"
                                  className="px-2 py-1 text-[11px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-md cursor-pointer"
                                >
                                  填入②详情
                                </button>
                                <button
                                  type="button"
                                  disabled={idx === 0}
                                  onClick={() => {
                                    if (idx === 0) return;
                                    const next = [...activeSpPresets];
                                    [next[idx - 1], next[idx]] = [
                                      next[idx],
                                      next[idx - 1],
                                    ];
                                    syncGlobalSellingPointPresets(next);
                                  }}
                                  title="上移"
                                  className="p-1.5 text-slate-400 hover:text-slate-700 disabled:opacity-30 rounded-lg hover:bg-slate-200/60 cursor-pointer"
                                >
                                  <ArrowUp className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  disabled={idx === activeSpPresets.length - 1}
                                  onClick={() => {
                                    if (idx === activeSpPresets.length - 1)
                                      return;
                                    const next = [...activeSpPresets];
                                    [next[idx + 1], next[idx]] = [
                                      next[idx],
                                      next[idx + 1],
                                    ];
                                    syncGlobalSellingPointPresets(next);
                                  }}
                                  title="下移"
                                  className="p-1.5 text-slate-400 hover:text-slate-700 disabled:opacity-30 rounded-lg hover:bg-slate-200/60 cursor-pointer"
                                >
                                  <ArrowDown className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (activeSpPresets.length <= 1) {
                                      showToast(
                                        '请至少保留 1 套兜底卖点方案',
                                        'info'
                                      );
                                      return;
                                    }
                                    syncGlobalSellingPointPresets(
                                      activeSpPresets.filter(
                                        (p) => p.id !== preset.id
                                      )
                                    );
                                    showToast(
                                      `已移除卖点方案「${preset.label}」`,
                                      'info'
                                    );
                                  }}
                                  title="删除此方案"
                                  className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* SECTION 2: Dual-Workbench Real Default Fallback Parameters */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Left: ① Main / SKU Studio Default Fallbacks */}
                      <div className="p-6 bg-white border border-slate-200 rounded-2xl space-y-4 shadow-2xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-bold text-slate-900">
                            二、① 主图/SKU工作台默认参数兜底
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              const resolvedReplicaLang =
                                fb.replicaLanguage || 'zh';
                              const resolvedTextMode: TextRenderMode =
                                resolvedReplicaLang === 'none'
                                  ? 'without_text'
                                  : 'with_text';
                              updateSkuBatchConfig({
                                replicaFidelity:
                                  fb.replicaFidelity || 'style_reference',
                                styleLinkageMode:
                                  fb.styleLinkageMode || 'print_4d',
                                consistentOutputStyle:
                                  (fb.styleLinkageMode || 'print_4d') !==
                                  'lock_scene',
                                replicaLanguage: resolvedReplicaLang,
                                textMode: resolvedTextMode,
                                defaultAspectRatio: fb.defaultAspectRatio,
                                defaultImageSize: fb.defaultImageSize,
                              });
                              setSkuTasks((prev) =>
                                prev.map((st) => ({
                                  ...st,
                                  replicaFidelity:
                                    fb.replicaFidelity || 'style_reference',
                                  styleLinkageMode:
                                    fb.styleLinkageMode || 'print_4d',
                                  consistentOutputStyle:
                                    (fb.styleLinkageMode || 'print_4d') !==
                                    'lock_scene',
                                  replicaLanguage: resolvedReplicaLang,
                                  textMode: resolvedTextMode,
                                  aspectRatio: fb.defaultAspectRatio,
                                  imageSize: fb.defaultImageSize,
                                }))
                              );
                              showToast(
                                '已将主图工作台默认复刻参数与画幅规格同步至当前 ① 主图工作台',
                                'success'
                              );
                            }}
                            className="text-xs font-semibold text-blue-600 hover:underline cursor-pointer shrink-0"
                          >
                            立即同步至①主图工作台 →
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                              默认复刻模式 (重置后默认档位)
                            </label>
                            <select
                              value={fb.replicaFidelity || 'style_reference'}
                              onChange={(e) =>
                                updateSkuFallbackPatch({
                                  replicaFidelity: e.target
                                    .value as ReplicaFidelity,
                                })
                              }
                              className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:border-blue-600"
                            >
                              <option value="style_reference">
                                参考风格 (创意重排 · 防背景克隆推荐)
                              </option>
                              <option value="high_replica">
                                高度复刻 (1:1 锁死构图与版式)
                              </option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                              默认场景与壳面印花联动策略
                            </label>
                            <select
                              value={fb.styleLinkageMode || 'print_4d'}
                              onChange={(e) =>
                                updateSkuFallbackPatch({
                                  styleLinkageMode: e.target
                                    .value as StyleLinkageMode,
                                })
                              }
                              className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:border-blue-600"
                            >
                              <option value="print_4d">
                                🎨 印花4维深度联动 (色板+底座+微缩道具+浅色卡)
                              </option>
                              <option value="harmonize_color">
                                ✨ 同色系顺应 (顺应产品主色调协调背景)
                              </option>
                              <option value="lock_scene">
                                🔒 锁死原场景 (保留参考图原有背景色温)
                              </option>
                            </select>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                              默认画面海报语言
                            </label>
                            <select
                              value={fb.replicaLanguage || 'zh'}
                              onChange={(e) => {
                                const lang = e.target.value as ReplicaLanguage;
                                updateSkuFallbackPatch({
                                  replicaLanguage: lang,
                                  textMode:
                                    lang === 'none'
                                      ? 'without_text'
                                      : 'with_text',
                                });
                              }}
                              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:border-blue-600"
                            >
                              <option value="zh">中文海报 (含主副标题)</option>
                              <option value="en">英文跨境海报 (English)</option>
                              <option value="none">纯产品底图 (无文字)</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                              主图/SKU默认画幅比例
                            </label>
                            <select
                              value={fb.defaultAspectRatio}
                              onChange={(e) =>
                                updateSkuFallbackPatch({
                                  defaultAspectRatio: e.target
                                    .value as AspectRatioOption,
                                })
                              }
                              className="w-full px-3 py-2 text-xs font-mono-tabular bg-slate-50 border border-slate-200 rounded-lg focus:bg-white"
                            >
                              <option value="1:1">1:1 (标准方图)</option>
                              <option value="3:4">3:4 (竖版主图)</option>
                              <option value="4:3">4:3 (横版规格图)</option>
                              <option value="9:16">9:16 (全屏竖版)</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                              主图默认输出分辨率
                            </label>
                            <select
                              value={fb.defaultImageSize}
                              onChange={(e) => {
                                const sz = e.target.value as ImageSizeOption;
                                updateSkuFallbackPatch({
                                  defaultImageSize: sz,
                                });
                              }}
                              className="w-full px-3 py-2 text-xs font-mono-tabular bg-slate-50 border border-slate-200 rounded-lg focus:bg-white"
                            >
                              {IMAGE_SIZE_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.value}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <p className="text-[11px] text-slate-500 leading-relaxed pt-1">
                          说明：主图/SKU工作台卡片标题现已直接取自产品图语义名称（如「C9小猫钓鱼印花」或策划主标题），无需配置旧版递增编码前缀。
                        </p>
                      </div>

                      {/* Right: ② Detail Studio Default Fallbacks & Reset Protection */}
                      <div className="p-6 bg-white border border-slate-200 rounded-2xl space-y-4 shadow-2xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-bold text-slate-900">
                            三、② 详情页工作台默认参数与重置保护
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setTasks((prev) =>
                                prev.map((t) => ({
                                  ...t,
                                  aspectRatio:
                                    config.requirements.detailAspectRatio,
                                  imageSize: config.defaultImageSize,
                                  textMode: config.requirements.textMode,
                                }))
                              );
                              showToast(
                                `已将详情页默认比例 (${config.requirements.detailAspectRatio}) 与分辨率 (${config.defaultImageSize}) 同步至当前详情页所有分屏`,
                                'success'
                              );
                            }}
                            className="text-xs font-semibold text-blue-600 hover:underline cursor-pointer shrink-0"
                          >
                            立即同步至②详情页工作台 →
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                              详情页默认比例
                            </label>
                            <select
                              value={config.requirements.detailAspectRatio}
                              onChange={(e) => {
                                const ratio = e.target
                                  .value as AspectRatioOption;
                                setConfig((prev) => ({
                                  ...prev,
                                  defaultAspectRatio: ratio,
                                  requirements: {
                                    ...prev.requirements,
                                    detailAspectRatio: ratio,
                                  },
                                }));
                              }}
                              className="w-full px-3 py-2 text-xs font-mono-tabular bg-slate-50 border border-slate-200 rounded-lg focus:bg-white"
                            >
                              <option value="9:16">9:16 (手机全屏竖版)</option>
                              <option value="3:4">3:4 (经典电商竖版)</option>
                              <option value="1:1">1:1 (方形分屏)</option>
                              <option value="4:3">4:3 (横版分屏)</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                              详情页默认文字模式
                            </label>
                            <select
                              value={config.requirements.textMode}
                              onChange={(e) => {
                                const tm = e.target.value as TextRenderMode;
                                setConfig((prev) => ({
                                  ...prev,
                                  requirements: {
                                    ...prev.requirements,
                                    textMode: tm,
                                  },
                                }));
                              }}
                              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white"
                            >
                              <option value="with_text">
                                含屏内分层标题与卖点卡
                              </option>
                              <option value="without_text">
                                纯视觉底图 (不含文字)
                              </option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                              详情页默认输出分辨率
                            </label>
                            <select
                              value={config.defaultImageSize}
                              onChange={(e) => {
                                const sz = e.target.value as ImageSizeOption;
                                setConfig((prev) => ({
                                  ...prev,
                                  defaultImageSize: sz,
                                }));
                              }}
                              className="w-full px-3 py-2 text-xs font-mono-tabular bg-slate-50 border border-slate-200 rounded-lg focus:bg-white"
                            >
                              {IMAGE_SIZE_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.value}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div className="space-y-2.5 pt-1">
                          <label className="flex items-center gap-2.5 p-3 bg-slate-50 border border-slate-200/80 rounded-xl cursor-pointer">
                            <input
                              type="checkbox"
                              checked={config.confirmBeforeReset !== false}
                              onChange={(e) =>
                                setConfig((prev) => ({
                                  ...prev,
                                  confirmBeforeReset: e.target.checked,
                                }))
                              }
                              className="w-4 h-4 rounded border-slate-300 text-blue-600"
                            />
                            <span className="text-xs font-medium text-slate-800">
                              点击顶栏「重置」按钮时弹出二次防误触确认框（推荐开启）
                            </span>
                          </label>

                          <label className="flex items-center gap-2.5 p-3 bg-slate-50 border border-slate-200/80 rounded-xl cursor-pointer">
                            <input
                              type="checkbox"
                              checked={Boolean(config.preserveCopyOnReset)}
                              onChange={(e) =>
                                setConfig((prev) => ({
                                  ...prev,
                                  preserveCopyOnReset: e.target.checked,
                                }))
                              }
                              className="w-4 h-4 rounded border-slate-300 text-blue-600"
                            />
                            <span className="text-xs font-medium text-slate-800">
                              重置工作台时默认勾选「保留已填写的商品卖点与整页视觉规范文案」
                            </span>
                          </label>
                        </div>
                      </div>
                    </div>

                    {/* SECTION 3: Global Image Quality Guard & Anti-Deformation Engine */}
                    <div className="p-6 bg-white border border-slate-200 rounded-2xl space-y-4 shadow-2xs">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                            <ShieldCheck className="w-4 h-4 text-emerald-600" />
                            <span>
                              四、生图质量与防变形全局护栏（Quality Guard Engine · 双工作台实时生效）
                            </span>
                          </h4>
                          <p className="text-xs text-slate-500 mt-1">
                            从源头拦截「单屏乱塞多角度导致主体变形、异款正面花色混绑、画面印出 #Prod-1 乱码、把“胶囊”画成3D药丸」等常见翻车问题
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            updateQualityGuardPatch(
                              DEFAULT_QUALITY_GUARD_CONFIG
                            );
                            showToast(
                              '已恢复推荐的防变形护栏开关与默认全局负向禁用词',
                              'info'
                            );
                          }}
                          className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg cursor-pointer"
                        >
                          恢复默认防变形护栏
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                        <label className="flex items-start gap-3 p-3.5 bg-slate-50/70 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50">
                          <input
                            type="checkbox"
                            checked={qg.autoSanitizePromptCodes !== false}
                            onChange={(e) =>
                              updateQualityGuardPatch({
                                autoSanitizePromptCodes: e.target.checked,
                              })
                            }
                            className="mt-0.5 w-4 h-4 rounded border-slate-300 text-blue-600"
                          />
                          <div className="text-xs">
                            <div className="font-bold text-slate-800">
                              自动净网过滤 #Prod/#Case 内部编号与“胶囊”药丸词
                            </div>
                            <p className="text-slate-500 mt-0.5 leading-relaxed">
                              生图前自动将提示词中的 #Prod-2 替换为自然视觉语义，并将“卖点胶囊”替换为“浅色圆角信息卡”，杜绝画面印出编号文字。
                            </p>
                          </div>
                        </label>

                        <label className="flex items-start gap-3 p-3.5 bg-slate-50/70 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50">
                          <input
                            type="checkbox"
                            checked={qg.strictSingleSkuProdCap !== false}
                            onChange={(e) =>
                              updateQualityGuardPatch({
                                strictSingleSkuProdCap: e.target.checked,
                              })
                            }
                            className="mt-0.5 w-4 h-4 rounded border-slate-300 text-blue-600"
                          />
                          <div className="text-xs">
                            <div className="font-bold text-slate-800">
                              单品画面严格限制 1~2 张互补视角 & 拦截异款正面花色混绑
                            </div>
                            <p className="text-slate-500 mt-0.5 leading-relaxed">
                              非多款全家福合集屏自动限制传入 1~2 张互补角度（正面主图永远作为 Slot #1 权威锚点），防止多张不同花色正面图相互打架。
                            </p>
                          </div>
                        </label>

                        <label className="flex items-start gap-3 p-3.5 bg-slate-50/70 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50">
                          <input
                            type="checkbox"
                            checked={qg.enforceLightRoundedCards !== false}
                            onChange={(e) =>
                              updateQualityGuardPatch({
                                enforceLightRoundedCards: e.target.checked,
                              })
                            }
                            className="mt-0.5 w-4 h-4 rounded border-slate-300 text-blue-600"
                          />
                          <div className="text-xs">
                            <div className="font-bold text-slate-800">
                              强制浅色半透明圆角信息卡（严禁生硬黑框与 3D 医药胶囊）
                            </div>
                            <p className="text-slate-500 mt-0.5 leading-relaxed">
                              自动注入浅色毛玻璃圆角矩形 UI 规范，严禁生图模型生成压抑的深棕/纯黑底框或立体红蓝药丸颗粒。
                            </p>
                          </div>
                        </label>

                        <label className="flex items-start gap-3 p-3.5 bg-slate-50/70 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50">
                          <input
                            type="checkbox"
                            checked={qg.lockRefineHighWeightAnchor !== false}
                            onChange={(e) =>
                              updateQualityGuardPatch({
                                lockRefineHighWeightAnchor: e.target.checked,
                              })
                            }
                            className="mt-0.5 w-4 h-4 rounded border-slate-300 text-blue-600"
                          />
                          <div className="text-xs">
                            <div className="font-bold text-slate-800">
                              锁图微调模式强制 95% 构图权重锚定并自动屏蔽竞品图
                            </div>
                            <p className="text-slate-500 mt-0.5 leading-relaxed">
                              开启卡片「锁图微调」时，将当前结果图置顶为第 1 张参考图并剥离竞品 #Case 图，仅执行局部指令精修，不重绘整张背景。
                            </p>
                          </div>
                        </label>
                      </div>

                      <div className="space-y-2 pt-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <label className="text-xs font-bold text-slate-800">
                            全局自定义负向禁用词（自动注入 ① 主图工作台 与 ② 详情页工作台每次生图指令）
                          </label>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {[
                              '严禁出现有线耳机线',
                              '严禁改变充电仓指示灯孔位',
                              '严禁同一展台并排出现两个重复充电仓',
                              '严禁绘制3D医药胶囊颗粒与深棕黑框',
                              '严禁印出#Prod/#Case内部编号',
                            ].map((tag) => (
                              <button
                                key={tag}
                                type="button"
                                onClick={() => {
                                  const curr = (
                                    qg.customNegativePrompt || ''
                                  ).trim();
                                  if (curr.includes(tag)) return;
                                  updateQualityGuardPatch({
                                    customNegativePrompt: curr
                                      ? `${curr}、${tag}`
                                      : tag,
                                  });
                                }}
                                className="px-2 py-0.5 text-[11px] font-medium text-slate-600 hover:text-blue-700 bg-slate-100 hover:bg-blue-50 border border-slate-200/80 rounded-md cursor-pointer"
                              >
                                + {tag}
                              </button>
                            ))}
                          </div>
                        </div>
                        <textarea
                          rows={2}
                          value={qg.customNegativePrompt || ''}
                          onChange={(e) =>
                            updateQualityGuardPatch({
                              customNegativePrompt: e.target.value,
                            })
                          }
                          placeholder="输入全局禁止在生图画面中出现的元素（用顿号或逗号分隔），留空则不额外追加..."
                          className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-blue-600 text-slate-800 leading-relaxed"
                        />
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* ================= TAB 1: CHANNEL ENDPOINT & DYNAMIC MODEL SWITCHER ================= */}
              {apiConfigTab === 'channel_model' && (
                <div className="space-y-6">
                  {/* Section A: Channel Selection & Broad Endpoint Compatibility */}
                  <div className="p-6 bg-white border border-slate-200 rounded-2xl space-y-4 shadow-2xs">
                    <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                      <label className="font-bold text-slate-900 flex items-center gap-2">
                        <Server className="w-4 h-4 text-blue-600" />
                        <span>一、API 网关通道选择（支持宽泛端点自动清洗与多协议自适应）</span>
                      </label>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={handleTestChannel}
                          disabled={channelTestStatus.loading}
                          className="px-3 py-1.5 text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                          {channelTestStatus.loading ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Globe className="w-3.5 h-3.5" />
                          )}
                          <span>测试对话通道</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleTestImageGeneration}
                          disabled={imageTestStatus.loading}
                          className="px-3 py-1.5 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                          {imageTestStatus.loading ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <ImageIcon className="w-3.5 h-3.5" />
                          )}
                          <span>测试生图模型</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowNewChannelForm((prev) => !prev)}
                          className="px-3 py-1.5 text-slate-700 bg-slate-100 hover:bg-slate-200/80 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>新增自定义通道</span>
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3.5">
                      {config.channels.map((ch) => {
                        const isSelected = ch.id === config.activeChannelId;
                        const isCodexChannel =
                          ch.mode === 'codex_cli' ||
                          ch.protocol === 'codex-cli';
                        const protoBadge = isCodexChannel
                          ? '本地 Codex CLI 桥接'
                          : ch.protocol === 'openai-compatible'
                            ? 'OpenAI /v1 协议'
                            : ch.protocol === 'gemini-native'
                              ? 'Gemini v1beta'
                              : 'Auto 双栈兼容';
                        return (
                          <div
                            key={ch.id}
                            onClick={() => {
                              setShowChannelApiKey(false);
                              setConfig((prev) => ({
                                ...prev,
                                activeChannelId: ch.id,
                              }));
                              if (isCodexChannel) {
                                void handleProbeCodexCliStatus(true);
                              }
                            }}
                            className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                              isSelected
                                ? 'border-blue-600 bg-blue-50/50 ring-1 ring-blue-600/50'
                                : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="text-xs font-bold text-slate-900 line-clamp-1">
                                {ch.name}
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                {(ch.mode === 'custom_gateway' ||
                                  (isCodexChannel &&
                                    ch.id !== 'local-codex-cli')) &&
                                  config.channels.length > 2 && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteCustomChannel(ch.id);
                                      }}
                                      title="删除此通道"
                                      className="p-1 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                <div
                                  className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                                    isSelected
                                      ? 'border-blue-600 bg-blue-600 text-white'
                                      : 'border-slate-300'
                                  }`}
                                >
                                  {isSelected && <Check className="w-2.5 h-2.5" />}
                                </div>
                              </div>
                            </div>

                            <div className="text-xs text-slate-500 font-mono-tabular truncate">
                              {ch.mode === 'official'
                                ? '系统内置官方直连通道'
                                : isCodexChannel
                                  ? `${ch.cliCommand || 'codex'} exec + 内置模型桥接`
                                  : ch.baseUrl || '未填写端点'}
                            </div>

                            <div className="flex items-center justify-between text-[11px] pt-2 border-t border-slate-200/60">
                              <span
                                className={`px-2 py-0.5 rounded font-medium ${
                                  isCodexChannel
                                    ? 'bg-indigo-100 text-indigo-800 font-semibold'
                                    : 'bg-slate-200/70 text-slate-700'
                                }`}
                              >
                                {protoBadge}
                              </span>
                              <div className="flex items-center gap-1.5">
                                {isCodexChannel ? (
                                  <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-semibold font-mono-tabular">
                                    对话+生图就绪
                                  </span>
                                ) : (
                                  ch.mode === 'custom_gateway' && (
                                    <span
                                      className={`px-2 py-0.5 rounded font-mono-tabular ${
                                        ch.apiKey && ch.apiKey.trim()
                                          ? 'bg-emerald-100 text-emerald-800 font-semibold'
                                          : 'bg-amber-100 text-amber-800'
                                      }`}
                                    >
                                      {ch.apiKey && ch.apiKey.trim()
                                        ? '已配密钥'
                                        : '待填API Key'}
                                    </span>
                                  )
                                )}
                                <span className="text-slate-500 font-mono-tabular">
                                  并发 {ch.concurrency} 路
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Active Local Codex CLI Channel Configuration & Built-in Model Bridge Panel */}
                    {(activeChannel.mode === 'codex_cli' ||
                      activeChannel.protocol === 'codex-cli') && (
                      <div className="p-5 bg-indigo-50/40 border border-indigo-200/90 rounded-xl space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="space-y-0.5">
                            <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
                              <span className="px-2 py-0.5 rounded bg-indigo-600 text-white text-[11px] font-mono-tabular">
                                Codex CLI Bridge
                              </span>
                              <span>
                                本地 Codex CLI 通道接入（支持调用本机 CLI 与内置模型进行多模态对话规划和高清生图）
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-600">
                              自动探测本机 <code className="font-mono-tabular bg-white px-1 py-0.5 rounded border border-slate-200">codex</code> 命令行与 <code className="font-mono-tabular bg-white px-1 py-0.5 rounded border border-slate-200">~/.codex/config.toml</code>，并无缝桥接内置策划模型（如 <code className="font-mono-tabular">gemini-4-argon</code> / <code className="font-mono-tabular">gemini-3.8-flash</code>）与生图模型（如 <code className="font-mono-tabular">gemini-nano-banana-2.1</code> / <code className="font-mono-tabular">gemini-3-pro-image</code>）。
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleProbeCodexCliStatus(false)}
                            disabled={codexCliStatus.loading}
                            className="px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-white hover:bg-indigo-50 border border-indigo-200 rounded-lg flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                          >
                            {codexCliStatus.loading ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <RefreshCw className="w-3.5 h-3.5" />
                            )}
                            <span>检测本地 Codex CLI 环境</span>
                          </button>
                        </div>

                        {/* Status Inspector Badges */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div className="p-3 bg-white border border-slate-200/80 rounded-xl space-y-1">
                            <div className="text-[11px] text-slate-500 font-medium">
                              1. 本机 Codex CLI 二进制状态
                            </div>
                            <div className="text-xs font-bold font-mono-tabular text-slate-800 flex items-center gap-1.5">
                              <span
                                className={`w-2 h-2 rounded-full ${
                                  codexCliStatus.cliInstalled
                                    ? 'bg-emerald-500'
                                    : 'bg-blue-500'
                                }`}
                              />
                              <span>
                                {codexCliStatus.cliInstalled
                                  ? `已安装 (${codexCliStatus.cliVersion || 'codex'})`
                                  : '内置 Codex 桥接模式 (免装二进制直通)'}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-500 truncate">
                              {codexCliStatus.configPath
                                ? `已读取配置: ${codexCliStatus.configPath}`
                                : '未检出 ~/.codex 配置文件，自动使用内置通道凭证'}
                            </div>
                          </div>

                          <div className="p-3 bg-white border border-slate-200/80 rounded-xl space-y-1">
                            <div className="text-[11px] text-slate-500 font-medium">
                              2. 内置对话/策划模型桥接 (Agent)
                            </div>
                            <div className="text-xs font-bold font-mono-tabular text-emerald-700 flex items-center gap-1.5">
                              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                              <span className="truncate">
                                当前激活: {config.agentModel}
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-1 pt-0.5">
                              {[
                                'gemini-4-argon',
                                'gemini-3.8-flash',
                                'codex-mini-latest',
                              ].map((mId) => (
                                <button
                                  key={mId}
                                  type="button"
                                  onClick={() => {
                                    setConfig((prev) => ({
                                      ...prev,
                                      agentModel: mId,
                                    }));
                                    showToast(
                                      `已切换 Codex 通道对话模型为 ${mId}`,
                                      'success'
                                    );
                                  }}
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono-tabular border cursor-pointer ${
                                    config.agentModel === mId
                                      ? 'bg-indigo-600 text-white border-indigo-600 font-semibold'
                                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-indigo-300'
                                  }`}
                                >
                                  {mId}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="p-3 bg-white border border-slate-200/80 rounded-xl space-y-1">
                            <div className="text-[11px] text-slate-500 font-medium">
                              3. 内置视觉生图模型桥接 (Image)
                            </div>
                            <div className="text-xs font-bold font-mono-tabular text-emerald-700 flex items-center gap-1.5">
                              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                              <span className="truncate">
                                当前激活: {config.imageModel}
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-1 pt-0.5">
                              {[
                                'gemini-nano-banana-2.1',
                                'gemini-3-pro-image',
                                'gemini-3.1-flash-lite-image',
                              ].map((mId) => (
                                <button
                                  key={mId}
                                  type="button"
                                  onClick={() => {
                                    setConfig((prev) => ({
                                      ...prev,
                                      imageModel: mId,
                                    }));
                                    showToast(
                                      `已切换 Codex 通道生图模型为 ${mId}`,
                                      'success'
                                    );
                                  }}
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono-tabular border cursor-pointer ${
                                    config.imageModel === mId
                                      ? 'bg-emerald-600 text-white border-emerald-600 font-semibold'
                                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-emerald-300'
                                  }`}
                                >
                                  {mId}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* CLI Command & Optional Endpoint/Key Override */}
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                          <div className="md:col-span-3">
                            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                              本地 CLI 命令 / 可执行路径
                            </label>
                            <input
                              type="text"
                              value={activeChannel.cliCommand || 'codex'}
                              onChange={(e) => {
                                const val = e.target.value;
                                setConfig((prev) => ({
                                  ...prev,
                                  channels: prev.channels.map((c) =>
                                    c.id === activeChannel.id
                                      ? { ...c, cliCommand: val }
                                      : c
                                  ),
                                }));
                              }}
                              placeholder="codex 或 /usr/local/bin/codex"
                              className="w-full px-3 py-2 text-xs font-mono-tabular bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-600"
                            />
                          </div>

                          <div className="md:col-span-4">
                            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                              桥接地址或覆盖网关 URL（默认 codex://local）
                            </label>
                            <input
                              type="text"
                              value={activeChannel.baseUrl || 'codex://local'}
                              onChange={(e) => {
                                const val = e.target.value;
                                setConfig((prev) => ({
                                  ...prev,
                                  channels: prev.channels.map((c) =>
                                    c.id === activeChannel.id
                                      ? { ...c, baseUrl: val }
                                      : c
                                  ),
                                }));
                              }}
                              placeholder="codex://local 或自定义网关地址"
                              className="w-full px-3 py-2 text-xs font-mono-tabular bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-600"
                            />
                          </div>

                          <div className="md:col-span-3">
                            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                              可选覆盖 API Key（留空自动读取 ~/.codex 或内置密钥）
                            </label>
                            <input
                              type={showChannelApiKey ? 'text' : 'password'}
                              value={activeChannel.apiKey || ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                setConfig((prev) => ({
                                  ...prev,
                                  channels: prev.channels.map((c) =>
                                    c.id === activeChannel.id
                                      ? { ...c, apiKey: val }
                                      : c
                                  ),
                                }));
                              }}
                              placeholder="留空则直接调用内置模型凭证"
                              className="w-full px-3 py-2 text-xs font-mono-tabular bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-600"
                            />
                          </div>

                          <div className="md:col-span-2">
                            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                              批量并发路数
                            </label>
                            <input
                              type="number"
                              min={1}
                              max={6}
                              value={activeChannel.concurrency}
                              onChange={(e) => {
                                const num = Math.max(
                                  1,
                                  Math.min(6, Number(e.target.value) || 2)
                                );
                                setConfig((prev) => ({
                                  ...prev,
                                  channels: prev.channels.map((c) =>
                                    c.id === activeChannel.id
                                      ? { ...c, concurrency: num }
                                      : c
                                  ),
                                }));
                              }}
                              className="w-full px-3 py-2 text-xs font-mono-tabular bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-600"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Active Custom Gateway Endpoint Editor & Real-time Broad Endpoint Preview */}
                    {activeChannel.mode === 'custom_gateway' && (
                      <div className="p-5 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                          <div className="md:col-span-6">
                            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                              自定义端点 Base URL（支持根域名、/v1、/v1beta 或完整路径）
                            </label>
                            <input
                              type="text"
                              value={activeChannel.baseUrl}
                              onChange={(e) => {
                                const val = e.target.value;
                                setConfig((prev) => ({
                                  ...prev,
                                  channels: prev.channels.map((c) =>
                                    c.id === activeChannel.id
                                      ? { ...c, baseUrl: val }
                                      : c
                                  ),
                                }));
                              }}
                              placeholder="如 https://api.your-proxy.com 或 https://api.your-proxy.com/v1"
                              className="w-full px-3.5 py-2 text-xs font-mono-tabular bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
                            />
                          </div>

                          <div className="md:col-span-4">
                            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                              端点协议兼容模式
                            </label>
                            <select
                              value={activeChannel.protocol || 'auto'}
                              onChange={(e) => {
                                const proto = e.target.value as ApiProtocolMode;
                                setConfig((prev) => ({
                                  ...prev,
                                  channels: prev.channels.map((c) =>
                                    c.id === activeChannel.id
                                      ? { ...c, protocol: proto }
                                      : c
                                  ),
                                }));
                              }}
                              className="w-full px-3.5 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600 font-medium text-slate-800"
                            >
                              <option value="auto">
                                Auto 智能双栈 (自动识别 Gemini / OpenAI 兼容)
                              </option>
                              <option value="gemini-native">
                                Google Gemini Native (v1beta 原生协议)
                              </option>
                              <option value="openai-compatible">
                                OpenAI 兼容协议 (/v1/chat & /v1/images)
                              </option>
                              <option value="codex-cli">
                                本地 Codex CLI 桥接协议 (codex exec + 内置模型)
                              </option>
                            </select>
                          </div>

                          <div className="md:col-span-2">
                            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                              批量并发路数
                            </label>
                            <input
                              type="number"
                              min={1}
                              max={6}
                              value={activeChannel.concurrency}
                              onChange={(e) => {
                                const num = Math.max(
                                  1,
                                  Math.min(6, Number(e.target.value) || 2)
                                );
                                setConfig((prev) => ({
                                  ...prev,
                                  channels: prev.channels.map((c) =>
                                    c.id === activeChannel.id
                                      ? { ...c, concurrency: num }
                                      : c
                                  ),
                                }));
                              }}
                              className="w-full px-3.5 py-2 text-xs font-mono-tabular bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
                            />
                          </div>
                        </div>

                        {/* Per-Channel Dedicated API Key & Custom Headers Inputs */}
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                          <div className="md:col-span-7">
                            <label className="flex items-center justify-between text-xs font-semibold text-slate-700 mb-1.5">
                              <span className="flex items-center gap-1.5">
                                <KeyRound className="w-3.5 h-3.5 text-blue-600" />
                                <span>
                                  当前通道专属 API Key / Bearer Token（独立保存在本通道配置中）
                                </span>
                              </span>
                              <span className="text-[11px] font-normal text-slate-400">
                                留空则回退使用服务端默认密钥
                              </span>
                            </label>
                            <div className="relative flex items-center">
                              <input
                                type={showChannelApiKey ? 'text' : 'password'}
                                value={activeChannel.apiKey || ''}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setConfig((prev) => ({
                                    ...prev,
                                    channels: prev.channels.map((c) =>
                                      c.id === activeChannel.id
                                        ? { ...c, apiKey: val }
                                        : c
                                    ),
                                  }));
                                }}
                                placeholder="sk-... 或 AIzaSy...（自动注入 Authorization: Bearer 与 x-goog-api-key）"
                                className="w-full pl-3.5 pr-9 py-2 text-xs font-mono-tabular bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  setShowChannelApiKey((prev) => !prev)
                                }
                                className="absolute right-2.5 text-slate-400 hover:text-slate-700 cursor-pointer"
                                title={
                                  showChannelApiKey
                                    ? '隐藏 API Key'
                                    : '显示 API Key'
                                }
                              >
                                {showChannelApiKey ? (
                                  <EyeOff className="w-4 h-4" />
                                ) : (
                                  <Eye className="w-4 h-4" />
                                )}
                              </button>
                            </div>
                          </div>

                          <div className="md:col-span-5">
                            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                              自定义请求头 Custom Headers（选填，支持 JSON 或 Key: Value）
                            </label>
                            <input
                              type="text"
                              value={activeChannel.customHeaders || ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                setConfig((prev) => ({
                                  ...prev,
                                  channels: prev.channels.map((c) =>
                                    c.id === activeChannel.id
                                      ? { ...c, customHeaders: val }
                                      : c
                                  ),
                                }));
                              }}
                              placeholder='如 {"X-Custom-Auth": "token"}'
                              className="w-full px-3.5 py-2 text-xs font-mono-tabular bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
                            />
                          </div>
                        </div>

                        {/* Real-time Broad Endpoint Normalization Preview */}
                        {(() => {
                          const preview = normalizeEndpointPreview(
                            activeChannel.baseUrl,
                            activeChannel.protocol || 'auto',
                            config.agentModel,
                            config.imageModel
                          );
                          return (
                            <div className="p-3.5 bg-white border border-slate-200/80 rounded-xl text-xs space-y-1.5 font-mono-tabular text-slate-600">
                              <div className="flex items-center justify-between text-slate-800 font-sans font-semibold">
                                <span>宽泛端点自动归一化解析预览（防 /v1/v1 重复拼接）：</span>
                                <span className="text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-md">
                                  {preview.effectiveProtocolLabel}
                                </span>
                              </div>
                              <div className="truncate">
                                <span className="text-slate-400">Gemini 原生路由：</span>
                                {preview.geminiNativeEndpoint}
                              </div>
                              <div className="truncate">
                                <span className="text-slate-400">OpenAI 对话路由：</span>
                                {preview.openAiChatEndpoint}
                              </div>
                              <div className="truncate">
                                <span className="text-slate-400">OpenAI 生图路由：</span>
                                {preview.openAiImageEndpoint}
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    )}

                    {/* Add New Custom Channel Form */}
                    {showNewChannelForm && (
                      <form
                        onSubmit={handleAddCustomChannel}
                        className="p-5 bg-blue-50/40 border border-blue-200 rounded-xl space-y-3.5"
                      >
                        <div className="text-xs font-bold text-slate-800">
                          添加新的自定义 API 网关或本地 Codex CLI 通道（支持 OneAPI / NewAPI / OpenRouter / 本地 Codex CLI，独立保存密钥）
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                          <input
                            type="text"
                            value={newChannelForm.name}
                            onChange={(e) =>
                              setNewChannelForm((prev) => ({
                                ...prev,
                                name: e.target.value,
                              }))
                            }
                            placeholder="通道名称 (如: 本地Codex / NewAPI)"
                            className="sm:col-span-3 px-3.5 py-2 text-xs bg-white border border-slate-200 rounded-lg"
                          />
                          <input
                            type="text"
                            value={newChannelForm.baseUrl}
                            onChange={(e) =>
                              setNewChannelForm((prev) => ({
                                ...prev,
                                baseUrl: e.target.value,
                              }))
                            }
                            placeholder="Base URL (如 codex://local 或 https://your-gateway.com/v1)"
                            className="sm:col-span-4 px-3.5 py-2 text-xs font-mono-tabular bg-white border border-slate-200 rounded-lg"
                          />
                          <input
                            type="password"
                            value={newChannelForm.apiKey}
                            onChange={(e) =>
                              setNewChannelForm((prev) => ({
                                ...prev,
                                apiKey: e.target.value,
                              }))
                            }
                            placeholder="专属 API Key (选填，Codex可留空)"
                            className="sm:col-span-3 px-3.5 py-2 text-xs font-mono-tabular bg-white border border-slate-200 rounded-lg"
                          />
                          <select
                            value={newChannelForm.protocol}
                            onChange={(e) => {
                              const nextProto = e.target
                                .value as ApiProtocolMode;
                              setNewChannelForm((prev) => ({
                                ...prev,
                                protocol: nextProto,
                                baseUrl:
                                  nextProto === 'codex-cli' && !prev.baseUrl
                                    ? 'codex://local'
                                    : prev.baseUrl,
                              }));
                            }}
                            className="sm:col-span-2 px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg"
                          >
                            <option value="auto">Auto 智能双栈</option>
                            <option value="openai-compatible">OpenAI /v1 兼容</option>
                            <option value="gemini-native">Gemini v1beta</option>
                            <option value="codex-cli">本地 Codex CLI</option>
                          </select>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <input
                            type="text"
                            value={newChannelForm.customHeaders}
                            onChange={(e) =>
                              setNewChannelForm((prev) => ({
                                ...prev,
                                customHeaders: e.target.value,
                              }))
                            }
                            placeholder='可选自定义请求头，如 {"X-Custom-Header": "value"}'
                            className="flex-1 px-3.5 py-2 text-xs font-mono-tabular bg-white border border-slate-200 rounded-lg"
                          />
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => setShowNewChannelForm(false)}
                              className="px-3.5 py-2 text-xs text-slate-600 cursor-pointer"
                            >
                              取消
                            </button>
                            <button
                              type="submit"
                              className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg cursor-pointer"
                            >
                              保存并启用通道
                            </button>
                          </div>
                        </div>
                      </form>
                    )}

                    {channelTestStatus.message && (
                      <div
                        className={`text-xs flex items-center gap-1.5 pt-1 ${
                          channelTestStatus.ok
                            ? 'text-emerald-700'
                            : 'text-rose-600'
                        }`}
                      >
                        {channelTestStatus.ok ? (
                          <CheckCircle2 className="w-4 h-4 shrink-0" />
                        ) : (
                          <AlertCircle className="w-4 h-4 shrink-0" />
                        )}
                        <span className="font-mono-tabular">
                          {channelTestStatus.message}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Section B: Integrated Dynamic Agent & Image Model Switcher + Inline Preset Pool */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Agent Model Card */}
                    <div className="p-6 bg-white border border-slate-200 rounded-2xl space-y-4 shadow-2xs">
                      <div className="flex items-center justify-between gap-2">
                        <label className="text-sm font-bold text-slate-900">
                          二、对话编排与多模态识图 Agent 模型
                        </label>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              handleQuickSaveCurrentModelToPresets('agent')
                            }
                            className="px-2.5 py-1 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg cursor-pointer"
                          >
                            + 存入常用池
                          </button>
                          <button
                            type="button"
                            onClick={() => setApiConfigTab('model_presets')}
                            className="px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/70 rounded-lg cursor-pointer"
                          >
                            管理池 ({agentPresetList.length})
                          </button>
                        </div>
                      </div>

                      {/* Inline Quick Model Pool Chips (One-Click Switch & Remove on the same tab) */}
                      <div className="space-y-1.5">
                        <span className="block text-xs font-medium text-slate-600">
                          常用 Agent 模型池（点击一键切换，点击 × 移除）：
                        </span>
                        <div className="flex flex-wrap gap-1.5 max-h-[112px] overflow-y-auto p-2 bg-slate-50 border border-slate-200/80 rounded-xl">
                          {agentPresetList.map((m) => {
                            const isCurrent = config.agentModel === m.id;
                            return (
                              <div
                                key={m.id}
                                className={`inline-flex items-center gap-1 pl-2.5 pr-1.5 py-1 rounded-lg text-xs border transition-all ${
                                  isCurrent
                                    ? 'bg-blue-600 text-white border-blue-600 font-bold shadow-2xs'
                                    : 'bg-white text-slate-700 border-slate-200 hover:border-blue-300'
                                }`}
                              >
                                <button
                                  type="button"
                                  onClick={() =>
                                    setConfig((prev) => ({
                                      ...prev,
                                      agentModel: m.id,
                                    }))
                                  }
                                  className="font-mono-tabular cursor-pointer truncate max-w-[180px]"
                                  title={m.label || m.id}
                                >
                                  {m.id}
                                </button>
                                {agentPresetList.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleRemoveModelPreset('agent', m.id);
                                    }}
                                    title="从常用池移除"
                                    className={`p-0.5 rounded cursor-pointer ${
                                      isCurrent
                                        ? 'text-blue-200 hover:text-white hover:bg-blue-700'
                                        : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                                    }`}
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div>
                        <span className="block text-xs font-medium text-slate-600 mb-1.5">
                          当前激活模型 ID（支持直接输入任意模型 ID，点击右上角「+ 存入常用池」即可保存）
                        </span>
                        <input
                          type="text"
                          value={config.agentModel}
                          onChange={(e) =>
                            setConfig((prev) => ({
                              ...prev,
                              agentModel: e.target.value,
                            }))
                          }
                          placeholder="如 gemini-4-argon, gemini-2.5-pro, gpt-4o, claude-3-7-sonnet..."
                          className="w-full px-3.5 py-2 text-xs font-mono-tabular bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:border-blue-600 text-slate-900"
                        />
                      </div>

                      <label className="flex items-center gap-2.5 p-3 bg-slate-50 border border-slate-200/80 rounded-xl cursor-pointer">
                        <input
                          type="checkbox"
                          checked={config.enableHighThinking}
                          onChange={(e) =>
                            setConfig((prev) => ({
                              ...prev,
                              enableHighThinking: e.target.checked,
                            }))
                          }
                          className="w-4 h-4 rounded border-slate-300 text-blue-600"
                        />
                        <span className="text-xs text-slate-700">
                          开启 HIGH 深度思考模式（支持深度思考的模型自动启用，不支持的模型自动忽略）
                        </span>
                      </label>
                    </div>

                    {/* Image Generation Model Card */}
                    <div className="p-6 bg-white border border-slate-200 rounded-2xl space-y-4 shadow-2xs">
                      <div className="flex items-center justify-between gap-2">
                        <label className="text-sm font-bold text-slate-900">
                          三、视觉分屏生图模型
                        </label>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              handleQuickSaveCurrentModelToPresets('image')
                            }
                            className="px-2.5 py-1 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg cursor-pointer"
                          >
                            + 存入常用池
                          </button>
                          <button
                            type="button"
                            onClick={() => setApiConfigTab('model_presets')}
                            className="px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/70 rounded-lg cursor-pointer"
                          >
                            管理池 ({imagePresetList.length})
                          </button>
                        </div>
                      </div>

                      {/* Inline Quick Image Model Pool Chips */}
                      <div className="space-y-1.5">
                        <span className="block text-xs font-medium text-slate-600">
                          常用生图模型池（点击一键切换，点击 × 移除）：
                        </span>
                        <div className="flex flex-wrap gap-1.5 max-h-[112px] overflow-y-auto p-2 bg-slate-50 border border-slate-200/80 rounded-xl">
                          {imagePresetList.map((m) => {
                            const isCurrent = config.imageModel === m.id;
                            return (
                              <div
                                key={m.id}
                                className={`inline-flex items-center gap-1 pl-2.5 pr-1.5 py-1 rounded-lg text-xs border transition-all ${
                                  isCurrent
                                    ? 'bg-blue-600 text-white border-blue-600 font-bold shadow-2xs'
                                    : 'bg-white text-slate-700 border-slate-200 hover:border-blue-300'
                                }`}
                              >
                                <button
                                  type="button"
                                  onClick={() =>
                                    setConfig((prev) => ({
                                      ...prev,
                                      imageModel: m.id,
                                    }))
                                  }
                                  className="font-mono-tabular cursor-pointer truncate max-w-[180px]"
                                  title={m.label || m.id}
                                >
                                  {m.id}
                                </button>
                                {imagePresetList.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleRemoveModelPreset('image', m.id);
                                    }}
                                    title="从常用池移除"
                                    className={`p-0.5 rounded cursor-pointer ${
                                      isCurrent
                                        ? 'text-blue-200 hover:text-white hover:bg-blue-700'
                                        : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                                    }`}
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div>
                        <span className="block text-xs font-medium text-slate-600 mb-1.5">
                          当前激活生图模型 ID（支持 Gemini / Flux / GPT-Image / Seedream 等）
                        </span>
                        <input
                          type="text"
                          value={config.imageModel}
                          onChange={(e) =>
                            setConfig((prev) => ({
                              ...prev,
                              imageModel: e.target.value,
                            }))
                          }
                          placeholder="如 gemini-nano-banana-2.1, gemini-3-pro-image, gpt-image-1, flux-1.1-pro..."
                          className="w-full px-3.5 py-2 text-xs font-mono-tabular bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:border-blue-600 text-slate-900"
                        />
                      </div>

                      <div className="flex items-center justify-between gap-3 pt-1">
                        <span className="text-xs text-slate-500 leading-relaxed">
                          支持多参考图与屏内中文直出；若主模型繁忙将自动无感降级至备用生图模型。
                        </span>
                        <button
                          type="button"
                          onClick={handleTestImageGeneration}
                          disabled={imageTestStatus.loading}
                          className="px-3.5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl flex items-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-50"
                        >
                          {imageTestStatus.loading ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Sparkles className="w-3.5 h-3.5" />
                          )}
                          <span>立即测试生图</span>
                        </button>
                      </div>

                      {imageTestStatus.message && (
                        <div
                          className={`p-3 rounded-xl border text-xs flex items-center justify-between gap-3 ${
                            imageTestStatus.ok
                              ? 'bg-emerald-50/70 border-emerald-200 text-emerald-800'
                              : 'bg-rose-50/70 border-rose-200 text-rose-700'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            {imageTestStatus.ok ? (
                              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                            ) : (
                              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                            )}
                            <span className="font-mono-tabular truncate">
                              {imageTestStatus.message}
                            </span>
                          </div>
                          {imageTestStatus.previewUrl && (
                            <img
                              src={imageTestStatus.previewUrl}
                              alt="生图测试预览"
                              onClick={() =>
                                setLightboxImage({
                                  url: imageTestStatus.previewUrl!,
                                  title: '生图模型连通性测试样张',
                                  subtitle: imageTestStatus.message || '',
                                })
                              }
                              className="w-11 h-11 rounded-lg object-cover border border-emerald-300 cursor-pointer shrink-0 hover:scale-105 transition-transform"
                            />
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Global Style Prefix */}
                  <div className="p-6 bg-white border border-slate-200 rounded-2xl space-y-2.5 shadow-2xs">
                    <label className="block text-sm font-bold text-slate-900">
                      四、全局画风前缀 (自动注入每屏生图指令)
                    </label>
                    <input
                      type="text"
                      value={config.globalStylePrefix}
                      onChange={(e) =>
                        setConfig((prev) => ({
                          ...prev,
                          globalStylePrefix: e.target.value,
                        }))
                      }
                      className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-blue-600 text-slate-800"
                    />
                  </div>
                </div>
              )}

              {/* ================= TAB 2: CONFIGURABLE COMMON MODEL PRESET POOL ================= */}
              {apiConfigTab === 'model_presets' && (
                <div className="space-y-6">
                  {/* Add Custom Model to Pool Form */}
                  <form
                    onSubmit={handleAddModelPreset}
                    className="p-6 bg-white border border-blue-200/80 rounded-2xl space-y-4 shadow-2xs"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-bold text-slate-900">
                        新增自定义常用模型（保存在本地配置，支持在顶栏点击模型名称一键快速切换）
                      </span>
                      <button
                        type="button"
                        onClick={handleResetModelPresets}
                        className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg cursor-pointer"
                      >
                        恢复系统默认常用模型池
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5">
                      <select
                        value={newModelPresetForm.category}
                        onChange={(e) =>
                          setNewModelPresetForm((prev) => ({
                            ...prev,
                            category: e.target.value as 'agent' | 'image',
                          }))
                        }
                        className="sm:col-span-3 px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg font-medium focus:bg-white"
                      >
                        <option value="agent">对话编排 Agent 模型</option>
                        <option value="image">视觉生图模型</option>
                      </select>

                      <input
                        type="text"
                        value={newModelPresetForm.id}
                        onChange={(e) =>
                          setNewModelPresetForm((prev) => ({
                            ...prev,
                            id: e.target.value,
                          }))
                        }
                        placeholder="模型 ID (如: deepseek-v3 / doubao-seedream-3.0)"
                        className="sm:col-span-4 px-3.5 py-2 text-xs font-mono-tabular bg-slate-50 border border-slate-200 rounded-lg focus:bg-white"
                      />

                      <input
                        type="text"
                        value={newModelPresetForm.label}
                        onChange={(e) =>
                          setNewModelPresetForm((prev) => ({
                            ...prev,
                            label: e.target.value,
                          }))
                        }
                        placeholder="备注名称 (如: 豆包即梦3.0电商精绘)"
                        className="sm:col-span-3 px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white"
                      />

                      <button
                        type="submit"
                        className="sm:col-span-2 px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg cursor-pointer"
                      >
                        + 添加至常用池
                      </button>
                    </div>
                  </form>

                  {/* Two Columns: Agent Presets & Image Presets */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Agent Model Presets List */}
                    <div className="p-6 bg-white border border-slate-200 rounded-2xl space-y-4 shadow-2xs">
                      <div className="text-sm font-bold text-slate-900 flex items-center justify-between">
                        <span>对话编排 Agent 常用模型池 ({agentPresetList.length})</span>
                        <span className="text-xs font-mono-tabular text-blue-600">
                          当前: {config.agentModel}
                        </span>
                      </div>
                      <div className="space-y-2.5 max-h-[440px] overflow-y-auto pr-1">
                        {agentPresetList.map((item) => {
                          const active = config.agentModel === item.id;
                          return (
                            <div
                              key={item.id}
                              onClick={() =>
                                setConfig((prev) => ({
                                  ...prev,
                                  agentModel: item.id,
                                }))
                              }
                              className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                                active
                                  ? 'border-blue-600 bg-blue-50/60'
                                  : 'border-slate-200 bg-slate-50/50 hover:border-slate-300 hover:bg-white'
                              }`}
                            >
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-bold font-mono-tabular text-slate-900 truncate">
                                    {item.id}
                                  </span>
                                  {active && (
                                    <span className="px-2 py-0.5 text-[10px] font-bold bg-blue-600 text-white rounded">
                                      当前使用
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs text-slate-500 truncate mt-1">
                                  {item.description || item.label}
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRemoveModelPreset('agent', item.id);
                                }}
                                title="从常用池移除"
                                className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 cursor-pointer shrink-0"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Image Model Presets List */}
                    <div className="p-6 bg-white border border-slate-200 rounded-2xl space-y-4 shadow-2xs">
                      <div className="text-sm font-bold text-slate-900 flex items-center justify-between">
                        <span>视觉生图常用模型池 ({imagePresetList.length})</span>
                        <span className="text-xs font-mono-tabular text-blue-600">
                          当前: {config.imageModel}
                        </span>
                      </div>
                      <div className="space-y-2.5 max-h-[440px] overflow-y-auto pr-1">
                        {imagePresetList.map((item) => {
                          const active = config.imageModel === item.id;
                          return (
                            <div
                              key={item.id}
                              onClick={() =>
                                setConfig((prev) => ({
                                  ...prev,
                                  imageModel: item.id,
                                }))
                              }
                              className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                                active
                                  ? 'border-blue-600 bg-blue-50/60'
                                  : 'border-slate-200 bg-slate-50/50 hover:border-slate-300 hover:bg-white'
                              }`}
                            >
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-bold font-mono-tabular text-slate-900 truncate">
                                    {item.id}
                                  </span>
                                  {active && (
                                    <span className="px-2 py-0.5 text-[10px] font-bold bg-blue-600 text-white rounded">
                                      当前使用
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs text-slate-500 truncate mt-1">
                                  {item.description || item.label}
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRemoveModelPreset('image', item.id);
                                }}
                                title="从常用池移除"
                                className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 cursor-pointer shrink-0"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ================= TAB 4: DUAL CLOUD ASSET STORAGE (ALIYUN OSS & CLOUDFLARE R2) & ZERO-BASE64 TRANSPORT ================= */}
              {apiConfigTab === 'oss_storage' && (
                <div className="space-y-6">
                  {/* Top Banner */}
                  <div className="p-5 bg-slate-900 text-white rounded-2xl flex flex-wrap items-center justify-between gap-4">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span
                          className={`px-2.5 py-0.5 text-[11px] font-bold rounded-md ${
                            isOssReady
                              ? activeStorageProvider === 'cloudflare_r2'
                                ? 'bg-orange-400 text-slate-950'
                                : 'bg-emerald-500 text-slate-950'
                              : 'bg-amber-400 text-slate-950'
                          }`}
                        >
                          {isOssReady
                            ? `${activeStorageLabel} · 0-Base64 直链已激活`
                            : '待配置 / 待启用'}
                        </span>
                        <h4 className="text-sm font-bold">
                          双擎云端对象存储 (阿里云 OSS / Cloudflare R2) · 自由切换与 0-Base64 极速传输
                        </h4>
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        支持在{' '}
                        <strong className="text-emerald-300">阿里云 OSS</strong> 与{' '}
                        <strong className="text-orange-300">Cloudflare R2 (免出口流量费)</strong>{' '}
                        之间一键无损切换（双方密钥独立保存，切换不丢失）。接入后产品图（#Prod）与案例图（#Case）自动上传云端生成{' '}
                        <code className="text-emerald-300 font-mono-tabular">
                          ossUrl
                        </code>
                        ，彻底归零前端 Base64 传输体积。
                      </p>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
                      {/* Dual-Provider Pill Switcher */}
                      <div className="p-1 bg-slate-800 border border-slate-700 rounded-xl flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleSwitchStorageProvider('aliyun_oss')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                            activeStorageProvider === 'aliyun_oss'
                              ? 'bg-emerald-500 text-slate-950 font-bold shadow-xs'
                              : 'text-slate-300 hover:text-white'
                          }`}
                        >
                          阿里云 OSS
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            handleSwitchStorageProvider('cloudflare_r2')
                          }
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                            activeStorageProvider === 'cloudflare_r2'
                              ? 'bg-orange-400 text-slate-950 font-bold shadow-xs'
                              : 'text-slate-300 hover:text-white'
                          }`}
                        >
                          Cloudflare R2
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={handleTestOssConnection}
                        disabled={ossTestStatus.loading}
                        className={`px-4 py-2 text-xs font-semibold text-slate-950 rounded-xl flex items-center gap-1.5 cursor-pointer disabled:opacity-50 ${
                          activeStorageProvider === 'cloudflare_r2'
                            ? 'bg-orange-400 hover:bg-orange-300'
                            : 'bg-emerald-400 hover:bg-emerald-300'
                        }`}
                      >
                        {ossTestStatus.loading ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Cloud className="w-3.5 h-3.5" />
                        )}
                        <span>
                          测试 {activeStorageProvider === 'cloudflare_r2' ? 'R2' : 'OSS'} 读写连通性
                        </span>
                      </button>

                      {(referenceImages.length > 0 ||
                        skuReferenceImages.length > 0) && (
                        <button
                          type="button"
                          onClick={handleSyncAllReferencesToOss}
                          disabled={isSyncingAllRefsToOss || !isOssReady}
                          className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-400 rounded-xl flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
                        >
                          {isSyncingAllRefsToOss ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <CloudUpload className="w-3.5 h-3.5" />
                          )}
                          <span>
                            一键同步当前素材池 (
                            {referenceImages.filter((r) => Boolean(r.ossUrl))
                              .length +
                              skuReferenceImages.filter((r) =>
                                Boolean(r.ossUrl)
                              ).length}
                            /{referenceImages.length + skuReferenceImages.length}
                            )
                          </span>
                        </button>
                      )}
                    </div>
                  </div>

                  {activeStorageProvider === 'aliyun_oss' &&
                    envOssDetected.ossEnvConfigured && (
                      <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center justify-between">
                        <span>
                          ✓ 已检测到服务端环境变量已预置阿里云 OSS 密钥（Bucket:{' '}
                          <strong className="font-mono-tabular">
                            {envOssDetected.bucket}
                          </strong>{' '}
                          / Region:{' '}
                          <strong className="font-mono-tabular">
                            {envOssDetected.region}
                          </strong>
                          ），您可直接开启使用，或在下方填入自定义 Bucket 覆盖。
                        </span>
                      </div>
                    )}

                  {activeStorageProvider === 'cloudflare_r2' &&
                    envOssDetected.r2EnvConfigured && (
                      <div className="p-4 bg-orange-50 border border-orange-200 rounded-xl text-xs text-orange-800 flex items-center justify-between">
                        <span>
                          ✓ 已检测到服务端环境变量已预置 Cloudflare R2 密钥（Bucket:{' '}
                          <strong className="font-mono-tabular">
                            {envOssDetected.r2Bucket}
                          </strong>{' '}
                          / Account:{' '}
                          <strong className="font-mono-tabular">
                            {envOssDetected.r2AccountId}
                          </strong>
                          ），您可直接开启使用，或在下方填入自定义 R2 凭据覆盖。
                        </span>
                      </div>
                    )}

                  {ossTestStatus.message && (
                    <div
                      className={`p-4 rounded-xl border text-xs flex flex-wrap items-center justify-between gap-2 ${
                        ossTestStatus.ok
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                          : 'bg-rose-50 border-rose-200 text-rose-700'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {ossTestStatus.ok ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                        )}
                        <span className="font-mono-tabular font-medium">
                          {ossTestStatus.message}
                        </span>
                      </div>
                      {ossTestStatus.sampleUrl && (
                        <span className="text-[11px] font-mono-tabular text-emerald-700 truncate max-w-md">
                          写入验证地址: {ossTestStatus.sampleUrl}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Form Grid */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Left: Credentials & Bucket (Switches cleanly between Aliyun OSS and Cloudflare R2 while preserving both configs) */}
                    <div className="p-6 bg-white border border-slate-200 rounded-2xl space-y-4 shadow-2xs">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <span className="text-sm font-bold text-slate-900">
                          {activeStorageProvider === 'cloudflare_r2'
                            ? '一、Cloudflare R2 存储桶 (Bucket) 与 S3 API 密钥配置'
                            : '一、阿里云 OSS 存储空间 (Bucket) 与密钥配置'}
                        </span>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={Boolean(config.ossConfig?.enabled)}
                            onChange={(e) =>
                              updateOssConfig({ enabled: e.target.checked })
                            }
                            className="w-4 h-4 rounded border-slate-300 text-emerald-600"
                          />
                          <span
                            className={`text-xs font-bold ${
                              activeStorageProvider === 'cloudflare_r2'
                                ? 'text-orange-700'
                                : 'text-emerald-700'
                            }`}
                          >
                            启用 {activeStorageLabel}
                          </span>
                        </label>
                      </div>

                      {/* Provider Selector Cards inside Form */}
                      <div className="grid grid-cols-2 gap-2.5 p-1.5 bg-slate-100 rounded-xl border border-slate-200/80">
                        <button
                          type="button"
                          onClick={() => handleSwitchStorageProvider('aliyun_oss')}
                          className={`py-2 px-3 rounded-lg text-xs flex items-center justify-between transition-all cursor-pointer ${
                            activeStorageProvider === 'aliyun_oss'
                              ? 'bg-white text-emerald-800 font-bold shadow-xs border border-emerald-200'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          <span>阿里云 OSS</span>
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded ${
                              isAliyunOssConfigured
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-slate-200/70 text-slate-500'
                            }`}
                          >
                            {isAliyunOssConfigured ? '已填密钥' : '未配置'}
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            handleSwitchStorageProvider('cloudflare_r2')
                          }
                          className={`py-2 px-3 rounded-lg text-xs flex items-center justify-between transition-all cursor-pointer ${
                            activeStorageProvider === 'cloudflare_r2'
                              ? 'bg-white text-orange-800 font-bold shadow-xs border border-orange-200'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          <span>Cloudflare R2</span>
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded ${
                              isCloudflareR2Configured
                                ? 'bg-orange-50 text-orange-700'
                                : 'bg-slate-200/70 text-slate-500'
                            }`}
                          >
                            {isCloudflareR2Configured ? '已填密钥' : '未配置'}
                          </span>
                        </button>
                      </div>

                      {activeStorageProvider === 'aliyun_oss' ? (
                        <>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                            <div>
                              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                                地域节点 (Region)
                              </label>
                              <select
                                value={
                                  ALIYUN_OSS_REGIONS.some(
                                    (r) => r.value === config.ossConfig?.region
                                  )
                                    ? config.ossConfig?.region
                                    : '__custom__'
                                }
                                onChange={(e) => {
                                  if (e.target.value !== '__custom__') {
                                    updateOssConfig({ region: e.target.value });
                                  }
                                }}
                                className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:border-blue-600"
                              >
                                {ALIYUN_OSS_REGIONS.map((reg) => (
                                  <option key={reg.value} value={reg.value}>
                                    {reg.label}
                                  </option>
                                ))}
                                <option value="__custom__">
                                  手动输入其他地域...
                                </option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                                Region ID (可直接编辑)
                              </label>
                              <input
                                type="text"
                                value={config.ossConfig?.region || ''}
                                onChange={(e) =>
                                  updateOssConfig({ region: e.target.value })
                                }
                                placeholder="如 oss-cn-hangzhou"
                                className="w-full px-3.5 py-2 text-xs font-mono-tabular bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:border-blue-600"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                              Bucket 名称 (存储空间名称)
                            </label>
                            <input
                              type="text"
                              value={config.ossConfig?.bucket || ''}
                              onChange={(e) =>
                                updateOssConfig({ bucket: e.target.value })
                              }
                              placeholder="如 my-ecom-studio-bucket"
                              className="w-full px-3.5 py-2 text-xs font-mono-tabular bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:border-blue-600"
                            />
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                            <div>
                              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                                AccessKey ID
                              </label>
                              <input
                                type="text"
                                value={config.ossConfig?.accessKeyId || ''}
                                onChange={(e) =>
                                  updateOssConfig({
                                    accessKeyId: e.target.value,
                                  })
                                }
                                placeholder="LTAI5t..."
                                className="w-full px-3.5 py-2 text-xs font-mono-tabular bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:border-blue-600"
                              />
                            </div>

                            <div>
                              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                                AccessKey Secret
                              </label>
                              <input
                                type="password"
                                value={config.ossConfig?.accessKeySecret || ''}
                                onChange={(e) =>
                                  updateOssConfig({
                                    accessKeySecret: e.target.value,
                                  })
                                }
                                placeholder="输入阿里云 RAM AccessKey Secret"
                                className="w-full px-3.5 py-2 text-xs font-mono-tabular bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:border-blue-600"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                            <div>
                              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                                存储目录前缀 (Path Prefix)
                              </label>
                              <input
                                type="text"
                                value={config.ossConfig?.pathPrefix || ''}
                                onChange={(e) =>
                                  updateOssConfig({
                                    pathPrefix: e.target.value,
                                  })
                                }
                                placeholder="ecom-studio-assets"
                                className="w-full px-3.5 py-2 text-xs font-mono-tabular bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:border-blue-600"
                              />
                            </div>

                            <div>
                              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                                自定义 CDN 加速域名 (可选)
                              </label>
                              <input
                                type="text"
                                value={config.ossConfig?.customDomain || ''}
                                onChange={(e) =>
                                  updateOssConfig({
                                    customDomain: e.target.value,
                                  })
                                }
                                placeholder="如 https://cdn.yourdomain.com"
                                className="w-full px-3.5 py-2 text-xs font-mono-tabular bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:border-blue-600"
                              />
                            </div>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                            <div>
                              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                                Cloudflare Account ID (账户 ID)
                              </label>
                              <input
                                type="text"
                                value={config.ossConfig?.r2AccountId || ''}
                                onChange={(e) =>
                                  updateOssConfig({
                                    r2AccountId: e.target.value,
                                  })
                                }
                                placeholder="如 8f9a2b3c4d5e6f7a8b9c0d1e2f3a4b5c"
                                className="w-full px-3.5 py-2 text-xs font-mono-tabular bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:border-orange-500"
                              />
                            </div>

                            <div>
                              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                                R2 Bucket 名称 (存储桶名称)
                              </label>
                              <input
                                type="text"
                                value={config.ossConfig?.r2Bucket || ''}
                                onChange={(e) =>
                                  updateOssConfig({ r2Bucket: e.target.value })
                                }
                                placeholder="如 ecom-studio-r2"
                                className="w-full px-3.5 py-2 text-xs font-mono-tabular bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:border-orange-500"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                            <div>
                              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                                R2 S3 Access Key ID
                              </label>
                              <input
                                type="text"
                                value={config.ossConfig?.r2AccessKeyId || ''}
                                onChange={(e) =>
                                  updateOssConfig({
                                    r2AccessKeyId: e.target.value,
                                  })
                                }
                                placeholder="R2 API 令牌 Access Key ID"
                                className="w-full px-3.5 py-2 text-xs font-mono-tabular bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:border-orange-500"
                              />
                            </div>

                            <div>
                              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                                R2 S3 Secret Access Key
                              </label>
                              <input
                                type="password"
                                value={config.ossConfig?.r2SecretAccessKey || ''}
                                onChange={(e) =>
                                  updateOssConfig({
                                    r2SecretAccessKey: e.target.value,
                                  })
                                }
                                placeholder="R2 API 令牌 Secret Access Key"
                                className="w-full px-3.5 py-2 text-xs font-mono-tabular bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:border-orange-500"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                            <div>
                              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                                公开访问域名 / R2.dev 域名 (可选)
                              </label>
                              <input
                                type="text"
                                value={config.ossConfig?.r2CustomDomain || ''}
                                onChange={(e) =>
                                  updateOssConfig({
                                    r2CustomDomain: e.target.value,
                                  })
                                }
                                placeholder="如 https://pub-xxx.r2.dev 或自定义CDN域名"
                                className="w-full px-3.5 py-2 text-xs font-mono-tabular bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:border-orange-500"
                              />
                            </div>

                            <div>
                              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                                存储目录前缀 (Path Prefix)
                              </label>
                              <input
                                type="text"
                                value={
                                  config.ossConfig?.r2PathPrefix ??
                                  config.ossConfig?.pathPrefix ??
                                  'ecom-studio-assets'
                                }
                                onChange={(e) =>
                                  updateOssConfig({
                                    r2PathPrefix: e.target.value,
                                  })
                                }
                                placeholder="ecom-studio-assets"
                                className="w-full px-3.5 py-2 text-xs font-mono-tabular bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:border-orange-500"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                              自定义 S3 Endpoint 节点地址 (可选，留空自动按 Account ID 拼接)
                            </label>
                            <input
                              type="text"
                              value={config.ossConfig?.r2Endpoint || ''}
                              onChange={(e) =>
                                updateOssConfig({ r2Endpoint: e.target.value })
                              }
                              placeholder={
                                config.ossConfig?.r2AccountId
                                  ? `https://${config.ossConfig.r2AccountId}.r2.cloudflarestorage.com`
                                  : 'https://<account_id>.r2.cloudflarestorage.com'
                              }
                              className="w-full px-3.5 py-2 text-xs font-mono-tabular bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:border-orange-500"
                            />
                            <p className="text-[11px] text-slate-400 mt-1">
                              提示：若未绑定公开域名，系统将自动使用 AWS S3 Signature V4 生成 7 天有效期的预签名直链，私有 R2 桶亦可直接生图与预览。
                            </p>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Right: Automation switches & Asset Status */}
                    <div className="p-6 bg-white border border-slate-200 rounded-2xl flex flex-col justify-between gap-4 shadow-2xs">
                      <div className="space-y-3.5">
                        <span className="text-sm font-bold text-slate-900 block">
                          二、自动化云存储与零 Base64 传输策略（OSS / R2 通用）
                        </span>

                        <label className="flex items-start gap-3 p-3.5 bg-slate-50/70 border border-slate-200 rounded-xl cursor-pointer">
                          <input
                            type="checkbox"
                            checked={
                              config.ossConfig?.autoUploadRefs !== false
                            }
                            onChange={(e) =>
                              updateOssConfig({
                                autoUploadRefs: e.target.checked,
                              })
                            }
                            className="mt-0.5 w-4 h-4 rounded border-slate-300 text-blue-600"
                          />
                          <div className="text-xs">
                            <div className="font-bold text-slate-800">
                              导入参考图时自动上传至 {activeStorageLabel}
                            </div>
                            <p className="text-slate-500 mt-1 leading-relaxed">
                              拖拽或粘贴上传产品图 (#Prod) 与案例图 (#Case) 时，自动同步至{' '}
                              <code className="font-mono-tabular">
                                {(activeStorageProvider === 'cloudflare_r2'
                                  ? config.ossConfig?.r2PathPrefix
                                  : config.ossConfig?.pathPrefix) ||
                                  'ecom-studio-assets'}
                                /refs/
                              </code>{' '}
                              并绑定云端直链。
                            </p>
                          </div>
                        </label>

                        <label className="flex items-start gap-3 p-3.5 bg-slate-50/70 border border-slate-200 rounded-xl cursor-pointer">
                          <input
                            type="checkbox"
                            checked={
                              config.ossConfig?.preferZeroBase64Transport !==
                              false
                            }
                            onChange={(e) =>
                              updateOssConfig({
                                preferZeroBase64Transport: e.target.checked,
                              })
                            }
                            className="mt-0.5 w-4 h-4 rounded border-slate-300 text-blue-600"
                          />
                          <div className="text-xs">
                            <div className="font-bold text-slate-800">
                              开启「0-Base64 云端直链传输模式」(推荐)
                            </div>
                            <p className="text-slate-500 mt-1 leading-relaxed">
                              已拥有 <code className="font-mono-tabular">ossUrl</code>{' '}
                              的素材图在发起全案拆解与批量生图时不再携带前端 Base64 字符串，由服务端高速拉取并带内存 LRU 缓存，彻底杜绝 HTTP 413 报错。
                            </p>
                          </div>
                        </label>

                        <label className="flex items-start gap-3 p-3.5 bg-slate-50/70 border border-slate-200 rounded-xl cursor-pointer">
                          <input
                            type="checkbox"
                            checked={
                              config.ossConfig?.autoArchiveResults !== false
                            }
                            onChange={(e) =>
                              updateOssConfig({
                                autoArchiveResults: e.target.checked,
                              })
                            }
                            className="mt-0.5 w-4 h-4 rounded border-slate-300 text-blue-600"
                          />
                          <div className="text-xs">
                            <div className="font-bold text-slate-800">
                              生图完成后自动将高清成品图归档至 {activeStorageLabel}
                            </div>
                            <p className="text-slate-500 mt-1 leading-relaxed">
                              每屏渲染出图后由服务端自动写入{' '}
                              <code className="font-mono-tabular">
                                {(activeStorageProvider === 'cloudflare_r2'
                                  ? config.ossConfig?.r2PathPrefix
                                  : config.ossConfig?.pathPrefix) ||
                                  'ecom-studio-assets'}
                                /results/
                              </code>
                              ，在分屏卡片右上角生成一键可复制的永久云直链，并自动写入导出清单。
                            </p>
                          </div>
                        </label>
                      </div>

                      {/* Real-time Pool Cloud Sync Summary */}
                      <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
                        <div className="flex items-center justify-between font-semibold text-slate-800">
                          <span>
                            当前云存储引擎：{activeStorageLabel}
                          </span>
                          <span className="font-mono-tabular text-emerald-700">
                            {referenceImages.filter((r) => Boolean(r.ossUrl))
                              .length +
                              skuReferenceImages.filter((r) =>
                                Boolean(r.ossUrl)
                              ).length}{' '}
                            / {referenceImages.length + skuReferenceImages.length}{' '}
                            张参考素材已上云
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-xs text-slate-500">
                          <span>已归档至云存储的生成成品图</span>
                          <span className="font-mono-tabular text-blue-600 font-semibold">
                            {tasks.filter((t) => Boolean(t.resultOssUrl))
                              .length +
                              skuTasks.filter((st) => Boolean(st.resultOssUrl))
                                .length}{' '}
                            /{' '}
                            {completedCount +
                              skuTasks.filter(
                                (st) =>
                                  st.status === 'completed' &&
                                  Boolean(st.resultImageUrl)
                              ).length}{' '}
                            张成品图
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ================= TAB 4: LOCAL CACHE DIAGNOSTICS & WINDOWS DESKTOP ARCHITECTURE ================= */}
              {apiConfigTab === 'desktop_arch' && (() => {
                const allWorkspaceRefs = [
                  ...referenceImages,
                  ...skuReferenceImages,
                ];
                const cloudSyncedRefsWithBase64 = allWorkspaceRefs.filter(
                  (r) =>
                    Boolean(r.ossUrl && /^https?:\/\//i.test(r.ossUrl)) &&
                    Boolean(r.base64Data && r.base64Data.length > 256)
                );
                const approxBase64Bytes = allWorkspaceRefs.reduce(
                  (sum, r) => sum + (r.base64Data ? r.base64Data.length * 0.75 : 0),
                  0
                );
                const approxBase64Mb = (
                  approxBase64Bytes /
                  (1024 * 1024)
                ).toFixed(2);

                const handleReleaseCloudSyncedBase64Cache = () => {
                  if (cloudSyncedRefsWithBase64.length === 0) {
                    showToast(
                      '当前没有需要释放的冗余 Base64 缓存（已处于最优轻量状态）',
                      'info'
                    );
                    return;
                  }
                  const stripRedundantBase64 = (list: ReferenceImageItem[]) =>
                    list.map((r) => {
                      const hasValidCloudUrl = Boolean(
                        r.ossUrl && /^https?:\/\//i.test(r.ossUrl)
                      );
                      if (!hasValidCloudUrl || !r.base64Data) return r;
                      return {
                        ...r,
                        base64Data: '',
                        previewUrl:
                          r.previewUrl && r.previewUrl.startsWith('data:')
                            ? r.ossUrl!
                            : r.previewUrl || r.ossUrl!,
                      };
                    });
                  setReferenceImages(stripRedundantBase64);
                  setSkuReferenceImages(stripRedundantBase64);
                  showToast(
                    `已释放 ${cloudSyncedRefsWithBase64.length} 张已上云素材的本地冗余 Base64 内存（保留云端直链无损预览）`,
                    'success'
                  );
                };

                const handleClearAllGenerationHistory = async () => {
                  if (generationRecords.length === 0) {
                    showToast('当前生图历史记录已为空', 'info');
                    return;
                  }
                  const count = generationRecords.length;
                  const ids = generationRecords.map((r) => r.id);
                  setGenerationRecords([]);
                  try {
                    await deleteGenerationRecordsFromDb(ids);
                  } catch {
                    // Ignore
                  }
                  showToast(`已清空全部 ${count} 条本地生图历史记录`, 'success');
                };

                return (
                  <div className="space-y-6">
                    {/* Section 1: Local Storage Footprint Diagnostics & One-Click Cache Cleanup */}
                    <div className="p-6 bg-white border border-slate-200 rounded-2xl space-y-4 shadow-2xs">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                            <Layers className="w-4 h-4 text-blue-600" />
                            <span>
                              一、本地存储占用统计与历史缓存一键清理（IndexedDB & LocalStorage）
                            </span>
                          </h4>
                          <p className="text-xs text-slate-500 mt-1">
                            实时监控双工作台内存、公共资产库与生图历史记录体积；支持一键释放已上云素材的冗余 Base64 缓存
                          </p>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            type="button"
                            onClick={handleReleaseCloudSyncedBase64Cache}
                            className="px-3.5 py-2 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl cursor-pointer"
                          >
                            释放已上云素材 Base64 缓存 ({cloudSyncedRefsWithBase64.length}张)
                          </button>
                          <button
                            type="button"
                            onClick={handleClearAllGenerationHistory}
                            disabled={generationRecords.length === 0}
                            className="px-3.5 py-2 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl cursor-pointer disabled:opacity-40"
                          >
                            清空生图历史记录 ({generationRecords.length}条)
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              clearRuntimeLogs();
                              showToast('已清空当前会话运行日志', 'info');
                            }}
                            disabled={runtimeLogs.length === 0}
                            className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200/80 rounded-xl cursor-pointer disabled:opacity-40"
                          >
                            清空运行日志 ({runtimeLogs.length}条)
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                        <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-xl space-y-1">
                          <div className="text-xs text-slate-500">
                            双工作台在途素材
                          </div>
                          <div className="text-lg font-bold font-mono-tabular text-slate-900">
                            {allWorkspaceRefs.length} 张
                          </div>
                          <div className="text-[11px] font-mono-tabular text-slate-500">
                            本地 Base64 约 {approxBase64Mb} MB
                          </div>
                        </div>

                        <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-xl space-y-1">
                          <div className="text-xs text-slate-500">
                            ③ 公共资产库 (IndexedDB)
                          </div>
                          <div className="text-lg font-bold font-mono-tabular text-blue-600">
                            {commonAssets.length} 张
                          </div>
                          <div className="text-[11px] font-mono-tabular text-slate-500">
                            已上云 {commonAssets.filter((a) => Boolean(a.ossUrl)).length} 张
                          </div>
                        </div>

                        <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-xl space-y-1">
                          <div className="text-xs text-slate-500">
                            生图历史归档 (IndexedDB)
                          </div>
                          <div className="text-lg font-bold font-mono-tabular text-emerald-700">
                            {generationRecords.length} 条
                          </div>
                          <div className="text-[11px] font-mono-tabular text-slate-500">
                            主图 {generationRecords.filter((r) => r.sourceStudio === 'sku_studio').length} · 详情 {generationRecords.filter((r) => r.sourceStudio === 'detail_studio').length}
                          </div>
                        </div>

                        <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-xl space-y-1">
                          <div className="text-xs text-slate-500">
                            已存全案母版 & 日志
                          </div>
                          <div className="text-lg font-bold font-mono-tabular text-slate-900">
                            {confirmedTemplates.length} 套母版
                          </div>
                          <div className="text-[11px] font-mono-tabular text-slate-500">
                            运行日志 {runtimeLogs.length} 条
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Section 2: Windows Desktop (Electron / Tauri) Foreground vs Background Architecture */}
                    <div className="p-5 bg-slate-900 text-white rounded-2xl flex flex-wrap items-center justify-between gap-4">
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2.5">
                          <span className="px-2.5 py-0.5 text-[11px] font-bold bg-emerald-500 text-slate-950 rounded-md">
                            IPC 桥接层已就绪
                          </span>
                          <h4 className="text-sm font-bold">
                            二、Windows 桌面端 (Electron / Tauri) 前后台职责分离架构
                          </h4>
                        </div>
                        <p className="text-xs text-slate-300 leading-relaxed">
                          前端所有网络与 AI 调用已全部收拢至{' '}
                          <code className="text-amber-300 font-mono-tabular">
                            src/services/studioBridge.ts
                          </code>
                          ，打包 Windows 桌面端时可直接通过 Electron{' '}
                          <code className="text-amber-300 font-mono-tabular">
                            ipcMain.handle
                          </code>{' '}
                          或 Tauri{' '}
                          <code className="text-amber-300 font-mono-tabular">
                            #[tauri::command]
                          </code>{' '}
                          无缝接管。
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {DESKTOP_ARCHITECTURE_BOUNDARIES.map((spec) => {
                        const isFrontend = spec.layer === 'frontend';
                        return (
                          <div
                            key={spec.id}
                            className={`p-6 rounded-2xl border space-y-3.5 bg-white shadow-2xs ${
                              isFrontend
                                ? 'border-blue-200/90'
                                : 'border-emerald-200/90'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span
                                className={`px-2.5 py-1 text-xs font-bold rounded-md ${
                                  isFrontend
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-emerald-700 text-white'
                                }`}
                              >
                                {isFrontend
                                  ? '前台执行 (Renderer)'
                                  : '后台执行 (Main / Core)'}
                              </span>
                              <span className="text-xs font-mono-tabular text-slate-500 truncate">
                                {spec.processName}
                              </span>
                            </div>

                            <div className="text-base font-bold text-slate-900">
                              {spec.title}
                            </div>
                            <p className="text-xs text-slate-600 leading-relaxed">
                              {spec.summary}
                            </p>

                            <ul className="space-y-1.5 text-xs text-slate-700 list-disc pl-4 leading-relaxed">
                              {spec.responsibilities.map((r, i) => (
                                <li key={i}>{r}</li>
                              ))}
                            </ul>

                            <div className="pt-2.5 border-t border-slate-100 text-xs text-slate-500 leading-relaxed">
                              <strong className="text-slate-700">
                                桌面化优势：
                              </strong>
                              {spec.desktopAdvantage}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Modal Footer */}
            <div className="px-7 py-4 border-t border-slate-200/80 bg-white flex items-center justify-between shrink-0">
              <div className="text-xs text-slate-500 font-mono-tabular truncate">
                当前激活：{activeChannel.name} · Agent[{config.agentModel}] · Image[
                {config.imageModel}]
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowChannelApiKey(false);
                  setShowApiModal(false);
                }}
                className="px-6 py-2.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              >
                完成并保存配置
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= INTERACTIVE "ADAPT TO NEW SKU" MODAL ================= */}
      <AdaptNewSkuModal
        open={showAdaptSkuModal}
        isAdaptingSku={isAdaptingSku}
        dynamicCount={dynamicCount}
        productImages={productImages}
        selectedSkuImageIds={selectedSkuImageIds}
        skuNameHintInput={skuNameHintInput}
        autoReplaceDynamicRefs={autoReplaceDynamicRefs}
        onClose={() => setShowAdaptSkuModal(false)}
        onTriggerUploadProduct={() => prodFileInputRef.current?.click()}
        onToggleSelectSkuModalImage={toggleSelectSkuModalImage}
        onChangeSkuNameHint={setSkuNameHintInput}
        onChangeAutoReplaceDynamicRefs={setAutoReplaceDynamicRefs}
        onExecuteAdaptNewSku={handleExecuteAdaptNewSku}
      />

      {/* ================= DETAIL STUDIO ASSET LIBRARY PICKER MODAL ================= */}
      <DetailAssetPickerModal
        open={detailAssetPickerModal.open}
        category={detailAssetPickerModal.category}
        selectedIds={detailAssetPickerModal.selectedIds}
        commonAssets={commonAssets}
        onClose={() =>
          setDetailAssetPickerModal((prev) => ({
            ...prev,
            open: false,
            selectedIds: [],
          }))
        }
        onChangeCategory={(category) =>
          setDetailAssetPickerModal((prev) => ({
            ...prev,
            category,
            selectedIds: [],
          }))
        }
        onToggleSelectId={(id) =>
          setDetailAssetPickerModal((prev) => ({
            ...prev,
            selectedIds: prev.selectedIds.includes(id)
              ? prev.selectedIds.filter((item) => item !== id)
              : [...prev.selectedIds, id],
          }))
        }
        onConfirmSelection={(chosen, category) => {
          handleSelectAssetsFromLibraryForDetail(chosen, category);
          setDetailAssetPickerModal((prev) => ({
            ...prev,
            open: false,
            selectedIds: [],
          }));
        }}
      />

      {/* ================= CASE SCREEN RECOGNITION & PLANNING CONFIRMATION MODAL ================= */}
      {caseScreenConfirmModal.isOpen && (
        <CaseScreenConfirmModal
          key={`case-confirm-${caseScreenConfirmModal.initialScreens.length}-${caseImages.length}`}
          isOpen={caseScreenConfirmModal.isOpen}
          caseRefs={caseImages}
          initialScreens={caseScreenConfirmModal.initialScreens}
          initialUnifiedVisualSpec={
            caseScreenConfirmModal.initialUnifiedVisualSpec
          }
          defaultTargetScreenCount={config.requirements.detailScreenCount}
          canResliceOriginal={Boolean(lastSlicedCaseCandidate)}
          originalCandidateName={lastSlicedCaseCandidate?.candidate.name}
          onClose={() =>
            setCaseScreenConfirmModal((prev) => ({ ...prev, isOpen: false }))
          }
          onConfirmGenerateTasks={handleConfirmCaseScreensModal}
          onRequestManualReslice={handleRequestManualResliceFromConfirm}
        />
      )}

      {/* ================= HIGH-RES LIGHTBOX MODAL ================= */}
      <ImageLightboxModal
        lightboxImage={lightboxImage}
        onClose={() => setLightboxImage(null)}
      />
    </div>
  );
}
