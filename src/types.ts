export type ChannelMode = 'official' | 'custom_gateway';

export type ApiProtocolMode = 'auto' | 'gemini-native' | 'openai-compatible';

// Unrestricted string model IDs so users can configure and switch to any model freely
export type AgentModelId = string;

export type ImageModelId = string;

export interface ModelPresetItem {
  id: string;
  label: string;
  category: 'agent' | 'image';
  protocolHint?: ApiProtocolMode;
  description?: string;
  isBuiltIn?: boolean;
}

export type AspectRatioOption =
  | '3:4'
  | '9:16'
  | '1:1'
  | '4:3'
  | '16:9'
  | '1:4'
  | '4:1';

export type ImageSizeOption = '1K' | '2K' | '4K';

// ==================== NEW SIMPLIFIED WORKSPACE TYPES ====================

/**
 * 8 Preset Detail Page Module Types (自由添加的详情页模块积木)
 */
export type DetailModuleType =
  | 'kv_hero' // 首屏主视觉海报
  | 'selling_point' // 核心卖点展示 (核心卖点1, 核心卖点2...)
  | 'spec_table' // 详细规格/参数表
  | 'series_matrix' // 系列展示图/多色或多SKU展示
  | 'package_contents' // 配件/赠品图 (明确收货的所有物品)
  | 'usage_tips' // 使用建议图 (商品使用的注意事项)
  | 'after_sales' // 售后保障图 (说明质保退换政策)
  | 'custom'; // 自定义模块

export interface DetailModulePresetMeta {
  type: DetailModuleType;
  label: string;
  shortTag: string;
  icon?: string;
  badge?: string;
  description: string;
  defaultTitle: string;
  defaultCopyHint: string;
  defaultPromptHint?: string;
  promptSkeleton: string;
}

export const DETAIL_MODULE_PRESETS: ReadonlyArray<DetailModulePresetMeta> = [
  {
    type: 'kv_hero',
    label: '首屏主视觉海报',
    shortTag: '首屏KV',
    icon: '✨',
    badge: '首屏核心',
    description: '奠定整页基调的高冲击力主视觉海报，突出产品核心颜值与头牌卖点',
    defaultTitle: '首屏主视觉海报',
    defaultCopyHint: '主标题：品牌旗舰核心主张\n副标题：三大核心亮点提炼',
    defaultPromptHint:
      '商业级电商首屏KV海报构图：上部22%为清晰的品牌主副标题留白区，中部58%为核心商品主视觉高光立体展台特写（100%还原#Prod商品外观细节），下部20%为3个规整的卖点图标/胶囊信息区，光影高级立体。',
    promptSkeleton:
      '商业级电商首屏KV海报构图：上部22%为清晰的品牌主副标题留白区，中部58%为核心商品主视觉高光立体展台特写（100%还原#Prod商品外观细节），下部20%为3个规整的卖点图标/胶囊信息区，光影高级立体。',
  },
  {
    type: 'selling_point',
    label: '核心卖点展示',
    shortTag: '核心卖点',
    icon: '🔥',
    badge: '功能痛点',
    description: '深度刻画单一核心功能、材质工艺、结构升级或痛点解决场景',
    defaultTitle: '核心卖点',
    defaultCopyHint: '主标题：核心功能/材质卖点\n副标题：量化支撑数据或体验提升说明',
    defaultPromptHint:
      '电商核心卖点深度解析构图：顶部为醒目的卖点大标题与副标题说明，画面中央聚焦#Prod商品的核心部位特写或功能痛点解决场景，辅以直观的视觉化光效/质感表现，底部配数据印证卡片。',
    promptSkeleton:
      '电商核心卖点深度解析构图：顶部为醒目的卖点大标题与副标题说明，画面中央聚焦#Prod商品的核心部位特写或功能痛点解决场景，辅以直观的视觉化光效/质感表现，底部配数据印证卡片。',
  },
  {
    type: 'series_matrix',
    label: '系列/多SKU展示图',
    shortTag: '多色/多SKU',
    icon: '🎨',
    badge: '多色多款',
    description: '展示全系列多花色、多颜色或多规格款式合集，吸引买家挑选',
    defaultTitle: '系列展示图 · 多色多款合集',
    defaultCopyHint: '主标题：多款高颜值色系 · 随心挑选\n副标题：总有一款契合你的专属风格',
    defaultPromptHint:
      '电商全系列多SKU陈列合集构图：顶部居中排布系列主题主副标题，画面中段采用对称几何阶梯展台或规整矩阵网格，整齐陈列所选的#Prod各款式商品，每款下方保留干净的款式名标签位，全图色调和谐统一。',
    promptSkeleton:
      '电商全系列多SKU陈列合集构图：顶部居中排布系列主题主副标题，画面中段采用对称几何阶梯展台或规整矩阵网格，整齐陈列所选的#Prod各款式商品，每款下方保留干净的款式名标签位，全图色调和谐统一。',
  },
  {
    type: 'spec_table',
    label: '详细规格/参数表',
    shortTag: '规格参数表',
    icon: '📋',
    badge: '参数规范',
    description: '清晰直观的产品尺寸标注图与核心规格参数对照表',
    defaultTitle: '详细规格与核心参数表',
    defaultCopyHint:
      '产品名称 / 型号 / 尺寸规格 / 核心材质 / 额定参数 / 适用场景（结构化表格呈现）',
    defaultPromptHint:
      '现代极简电商产品规格参数信息图（Infographic）：上部或左侧展示#Prod商品的干净正侧立面实物与尺寸比例视觉，下部或右侧为结构极其规整、对齐严谨的现代商业参数表格卡片，浅色清爽信息框，文字层级清晰易读。',
    promptSkeleton:
      '现代极简电商产品规格参数信息图（Infographic）：上部或左侧展示#Prod商品的干净正侧立面实物与尺寸比例视觉，下部或右侧为结构极其规整、对齐严谨的现代商业参数表格卡片，浅色清爽信息框，文字层级清晰易读。',
  },
  {
    type: 'package_contents',
    label: '配件/赠品清单图',
    shortTag: '收货清单',
    icon: '📦',
    badge: '收货清单',
    description: '明确展示买家收货包含的所有物品（主机+配件+包装盒+赠品）',
    defaultTitle: '包装清单 · 明确收货所有物品',
    defaultCopyHint: '主标题：全套贴心配置 · 开箱即用\n清单明细：主机×1、配件明细、说明书×1、精美礼盒×1',
    defaultPromptHint:
      '电商开箱全家福平铺陈列构图（Knolling Flat-lay / 阶梯陈列）：顶部为“包装清单/收货明细”标题，画面中央在纯净高级台面上整齐有序地陈列#Prod商品主机、配套附件、包装盒与赠品，每件物品旁配有清晰的文字名称与数量角标。',
    promptSkeleton:
      '电商开箱全家福平铺陈列构图（Knolling Flat-lay / 阶梯陈列）：顶部为“包装清单/收货明细”标题，画面中央在纯净高级台面上整齐有序地陈列#Prod商品主机、配套附件、包装盒与赠品，每件物品旁配有清晰的文字名称与数量角标。',
  },
  {
    type: 'usage_tips',
    label: '使用建议/注意事项',
    shortTag: '使用说明',
    icon: '💡',
    badge: '使用指南',
    description: '分步骤展示正确使用方法、保养技巧或日常使用注意事项',
    defaultTitle: '使用建议与日常注意事项',
    defaultCopyHint: '步骤1 / 步骤2 / 步骤3，以及日常清洁保养与使用温馨提示',
    defaultPromptHint:
      '电商商品使用指南与注意事项分栏排版图：顶部为“使用建议与温馨提示”主标题，画面中段采用清晰的1-2-3分步图文卡片或上下模块化指南框，结合#Prod商品局部示范与简洁图标，直观传达正确操作方式与注意要点。',
    promptSkeleton:
      '电商商品使用指南与注意事项分栏排版图：顶部为“使用建议与温馨提示”主标题，画面中段采用清晰的1-2-3分步图文卡片或上下模块化指南框，结合#Prod商品局部示范与简洁图标，直观传达正确操作方式与注意要点。',
  },
  {
    type: 'after_sales',
    label: '售后保障政策图',
    shortTag: '售后保障',
    icon: '🛡️',
    badge: '售后信任',
    description: '官方正品背书、质保期限、退换货政策与客服承诺，打消下单顾虑',
    defaultTitle: '官方售后保障 · 安心无忧购',
    defaultCopyHint:
      '官方正品保证 ｜ 7天无理由退换 ｜ 质保服务承诺 ｜ 极速响应售后客服',
    defaultPromptHint:
      '电商官方品质与售后保障信任背书版式：顶部为极具信赖感的品牌服务主标题，画面结合精致的#Prod商品品质感局部特写与4宫格/横排服务保障卡片（正品保障、无忧退换、质保承诺、贴心客服），版面庄重、清爽、高信任感。',
    promptSkeleton:
      '电商官方品质与售后保障信任背书版式：顶部为极具信赖感的品牌服务主标题，画面结合精致的#Prod商品品质感局部特写与4宫格/横排服务保障卡片（正品保障、无忧退换、质保承诺、贴心客服），版面庄重、清爽、高信任感。',
  },
  {
    type: 'custom',
    label: '自定义详情屏',
    shortTag: '自定义屏',
    icon: '✏️',
    badge: '自由定义',
    description: '自由定义本屏主题、特殊场景或品牌故事内容',
    defaultTitle: '自定义主题展示屏',
    defaultCopyHint: '输入本屏想要传达的主副标题与核心文案...',
    defaultPromptHint:
      '高质感商业电商详情页竖版构图：保持整页统一视觉规范，上部为清晰主副标题区，中部突出#Prod自有商品主体，下部为辅助信息说明，四周保留充足呼吸留白。',
    promptSkeleton:
      '高质感商业电商详情页竖版构图：保持整页统一视觉规范，上部为清晰主副标题区，中部突出#Prod自有商品主体，下部为辅助信息说明，四周保留充足呼吸留白。',
  },
];

/**
 * 主图 / SKU 复刻工作台 —— 6 大复刻类型 (对标用户截图4)
 */
export type ReplicaCategory =
  | 'ecommerce_product' // 电商商品图
  | 'ecom_product' // 别名
  | 'fashion_apparel' // 服饰电商图
  | 'marketing_poster' // 营销海报
  | 'social_media' // 社媒图文
  | 'creative_poster' // 创意海报
  | 'other'; // 其他

export const REPLICA_CATEGORY_OPTIONS: ReadonlyArray<{
  value: ReplicaCategory;
  label: string;
  promptHint: string;
}> = [
  {
    value: 'ecommerce_product',
    label: '电商商品图',
    promptHint: '高转化电商主图/SKU图，商品主体清晰突出，卖点角标与场景道具主次分明',
  },
  {
    value: 'fashion_apparel',
    label: '服饰电商图',
    promptHint: '服饰上身穿搭商业摄影，真实自然的人体姿态与面料垂坠肌理，高级质感布光',
  },
  {
    value: 'marketing_poster',
    label: '营销海报',
    promptHint: '强视觉张力商业促销/种草海报，标题字体设计感强，色彩鲜明吸睛',
  },
  {
    value: 'social_media',
    label: '社媒图文',
    promptHint: '小红书/Instagram高赞种草封面图文，生活化真实氛围与网感贴纸排版',
  },
  {
    value: 'creative_poster',
    label: '创意海报',
    promptHint: '先锋视觉创意合成海报，独特空间透视与超写实概念布景',
  },
  {
    value: 'other',
    label: '其他',
    promptHint: '高品质商业视觉摄影与专业平面排版设计',
  },
];

/**
 * 主图 / SKU 复刻工作台 —— 2 档核心复刻程度 (彻底取代原6标签)
 */
export type ReplicaFidelity =
  | 'style_reference' // 参考风格：参考整体风格和结构，自动调整色彩和重构场景
  | 'style_ref' // 别名
  | 'high_replica'; // 高度复刻：参照参考图视觉结构替换产品和文案，场景细节略有差异

export type ReplicaLanguage = 'zh' | 'en' | 'none';

export type ReplicaMatchMode =
  | 'single_prod_multi_case' // 1款产品 × N张参考图 (整套商品图批量复刻)
  | 'multi_prod_single_case' // N款产品 × 1张母版参考图 (多SKU批量裂变)
  | 'single_prod_to_multi_ref' // 别名
  | 'multi_prod_to_single_ref'; // 别名

/**
 * 产品原图 (#Prod) 拍摄视角与功能角色标签（用于多角度智能编排）
 */
export type ProductAngleRole =
  | 'hero_front' // 正面印花/主视图
  | 'open_case' // 开盖漏双耳/组合图
  | 'single_earbud' // 单耳佩戴/本体特写
  | 'detail_closeup' // 细节/充电/结构微距
  | 'multi_sku' // 多花色/多色全家福
  | 'package_accessory'; // 包装盒/配件清单

export const PROD_ANGLE_ROLE_OPTIONS: ReadonlyArray<{
  value: ProductAngleRole;
  label: string;
  shortLabel: string;
}> = [
  { value: 'hero_front', label: '正面印花/主视', shortLabel: '正面主视' },
  { value: 'open_case', label: '开盖含耳机/组合', shortLabel: '开盖双耳' },
  { value: 'single_earbud', label: '单耳/佩戴特写', shortLabel: '单耳特写' },
  { value: 'detail_closeup', label: '细节/充电微距', shortLabel: '细节微距' },
  { value: 'multi_sku', label: '多色/多款合集', shortLabel: '多款合集' },
  { value: 'package_accessory', label: '包装/配件图', shortLabel: '包装配件' },
];

/**
 * 色彩与印花主题联动策略 (3 档)
 */
export type StyleLinkageMode =
  | 'print_4d' // 印花主题4维深度联动 (潮玩/卡通印花专属：色板+潮玩底座+伴生悬浮物+胶囊/字色)
  | 'color_sync' // 同色系顺应 (提取产品主色调协调背景色温)
  | 'lock_scene'; // 锁死原场景 (保持参考图原有背景与灯光，仅替换产品)

/**
 * 卡通/潮玩印花 4 维主题深度联动配方 (Print Theme 4D Linkage)
 */
export interface PrintThemeLinkageConfig {
  enabled?: boolean; // 是否启用印花4维主题深度联动
  printStory?: string; // 识别到的壳面插画故事母题（如：太空芝士鼠、星月美梦兔、森系露营刺猬）
  themePalette: string; // ① 主题色板（60%背景主色 + 30%展台辅色 + 10%点缀色）
  themeStage: string; // ② 联动潮玩底座（盲盒级圆润磨砂微缩景观底座）
  themeElements: string; // ③ 印花伴生悬浮元素（从印花抠出的2~3个伴生符号，远中近景深排布）
  themeUiStyle: string; // ④ 标题与底部胶囊配色（彻底告别千篇一律的死板黑棕框）
}

export interface ReplicaTask {
  id: string;
  index: number;
  caseRefId: string;
  prodRefId: string;
  singleRequirement: string; // 单张参考图专属要求备注
  skuLabel?: string; // 多SKU裂变时的款式名称
  extractedCopy: string; // 复刻图内的标题/卖点文案（可手动微调）
  visualPrompt: string; // AI合成的精准复刻视觉指令（可手动微调）
  replicaCategory: ReplicaCategory;
  replicaFidelity: ReplicaFidelity;
  consistentStyle: boolean;
  unifiedRequirement: string;
  language: ReplicaLanguage;
  aspectRatio: AspectRatioOption;
  imageSize: ImageSizeOption;
  status: TaskStatus;
  errorMessage?: string;
  resultImageUrl?: string;
  resultOssUrl?: string;
  durationMs?: number;
  generatedAt?: string;
  historyImages: {
    url: string;
    ossUrl?: string;
    timestamp: string;
    promptSnapshot: string;
  }[];
}

// ==================== LEGACY COMPATIBILITY TYPES ====================

export type CaseRefDimension =
  | 'pose'
  | 'style'
  | 'structure'
  | 'content'
  | 'copy_text'
  | 'lighting';

export const CASE_DIMENSION_META: ReadonlyArray<{
  value: CaseRefDimension;
  label: string;
  shortDesc: string;
}> = [
  {
    value: 'pose',
    label: '主体姿态',
    shortDesc: '提取朝向、摆放及组合关系，不继承竞品身份和外形',
  },
  {
    value: 'style',
    label: '环境背景',
    shortDesc: '提取场景类型、材质与造型语言，具体布景重新设计',
  },
  {
    value: 'structure',
    label: '版式骨架',
    shortDesc: '提取信息分区、主次、图文占比和留白规律',
  },
  {
    value: 'content',
    label: '文案版式',
    shortDesc: '提取字体性格、字号层级、对齐和间距',
  },
  {
    value: 'copy_text',
    label: '文案内容',
    shortDesc: '提取卖点主题和表达结构，依据自有资料重写',
  },
  {
    value: 'lighting',
    label: '光影色调',
    shortDesc: '提取光向、软硬、反差及色彩关系',
  },
];

export const DEFAULT_CASE_DIMENSIONS: CaseRefDimension[] = [
  'style',
  'structure',
  'content',
  'lighting',
];

export const LOCK_ALL_SWAP_PATTERN_DIMENSIONS: CaseRefDimension[] = [
  'pose',
  'style',
  'structure',
  'content',
  'copy_text',
  'lighting',
];

export type DetailCaseDeliveryMode = 'none' | 'shared_style' | 'lock_base_swap';

export type TaskScopeOption = 'detail_only' | 'main_only' | 'both';

export type TextRenderMode = 'with_text' | 'without_text';

export type ScreenLayerType = 'dynamic' | 'static';

export type WorkspaceTopTab = 'detail_studio' | 'sku_studio' | 'master_library';

export interface ApiChannelProfile {
  id: string;
  name: string;
  mode: ChannelMode;
  baseUrl: string;
  apiKey?: string;
  customHeaders?: string;
  protocol?: ApiProtocolMode;
  concurrency: number;
  timeoutSec: number;
}

export interface OversizedImageCandidate {
  id: string;
  file: File;
  name: string;
  width: number;
  height: number;
  previewUrl: string;
  targetTag: 'product' | 'case';
  targetStudio?: 'detail_studio' | 'sku_studio';
  targetSkuTaskId?: string;
  recommendedSliceCount?: number;
}

export interface GenerationRequirements {
  taskScope: TaskScopeOption;
  mainImageCount: number;
  detailScreenCount: number;
  mainAspectRatio: AspectRatioOption;
  detailAspectRatio: AspectRatioOption;
  textMode: TextRenderMode;
  enableStaticLayering?: boolean;
  autoAlignCaseToScreens?: boolean;
  caseDeliveryMode?: DetailCaseDeliveryMode;
  sharedStyleCaseId?: string;
  unifiedVisualSpec?: string;
}

export type CloudStorageProvider = 'aliyun_oss' | 'cloudflare_r2';

export interface AliyunOssConfig {
  enabled: boolean;
  provider?: CloudStorageProvider;
  region: string;
  bucket: string;
  accessKeyId: string;
  accessKeySecret: string;
  customDomain?: string;
  pathPrefix: string;
  r2AccountId?: string;
  r2Endpoint?: string;
  r2Bucket?: string;
  r2AccessKeyId?: string;
  r2SecretAccessKey?: string;
  r2CustomDomain?: string;
  r2PathPrefix?: string;
  autoUploadRefs: boolean;
  autoArchiveResults: boolean;
  preferZeroBase64Transport: boolean;
}

export interface SkuDefaultFallbackConfig {
  skuDiffMode: SkuDifferenceMode;
  titlePrefix: string;
  subtitleText: string;
  swapTitleOrder: boolean;
  titleIndexMode: SkuTitleIndexMode;
  defaultAspectRatio: AspectRatioOption;
  defaultImageSize: ImageSizeOption;
  textMode: TextRenderMode;
}

export interface StudioConfig {
  activeChannelId: string;
  channels: ApiChannelProfile[];
  agentModel: AgentModelId;
  enableHighThinking: boolean;
  imageModel: ImageModelId;
  agentModelPresets?: ModelPresetItem[];
  imageModelPresets?: ModelPresetItem[];
  defaultSellingPointPresets?: SkuSellingPointPreset[];
  skuDefaultFallback?: SkuDefaultFallbackConfig;
  confirmBeforeReset?: boolean;
  preserveCopyOnReset?: boolean;
  defaultAspectRatio: AspectRatioOption;
  defaultImageSize: ImageSizeOption;
  globalStylePrefix: string;
  requirements: GenerationRequirements;
  ossConfig?: AliyunOssConfig;
}

export interface DetectedCaseSubScreen {
  subScreenIndex: number;
  subScreenTotal: number;
  regionLabel: string;
  title: string;
  sectionType?: string;
  extractedLayoutDna: string;
}

export interface FlattenedLogicalScreenItem {
  screenNumber: number;
  sourceCaseId: string;
  sourceCaseCode: string;
  subScreenIndex: number;
  subScreenTotal: number;
  regionLabel: string;
  title: string;
  sectionType?: string;
  extractedLayoutDna: string;
}

export interface ReferenceImageItem {
  id: string;
  code: string;
  category: 'product' | 'case';
  prodAngleRole?: ProductAngleRole;
  printThemeConfig?: PrintThemeLinkageConfig;
  isCommonAsset?: boolean;
  name: string;
  tag: string;
  width?: number;
  height?: number;
  caseDimensions?: CaseRefDimension[];
  caseCustomRule?: string;
  isLockBaseSwap?: boolean;
  isSharedStyleRef?: boolean;
  isLongPageSlice?: boolean;
  sliceIndex?: number;
  sliceTotal?: number;
  extractedLayoutDna?: string;
  detectedSubScreens?: DetectedCaseSubScreen[];
  mimeType: string;
  base64Data: string;
  previewUrl: string;
  ossUrl?: string;
  ossObjectKey?: string;
  ossUploading?: boolean;
  cloudUrls?: Partial<Record<CloudStorageProvider, string>>;
  cloudObjectKeys?: Partial<Record<CloudStorageProvider, string>>;
}

export type TaskStatus = 'idle' | 'generating' | 'completed' | 'error';

export interface ScreenTask {
  id: string;
  screenNumber: number;
  screenCategory: 'main' | 'detail';
  layerType: ScreenLayerType;
  moduleType?: DetailModuleType; // 预置详情页模块类型
  userNote?: string; // 本屏补充备注要求
  title: string;
  sectionType: string;
  benchmarkCase: string;
  copywriting: string;
  typographyPlan: string;
  visualPrompt: string;
  textMode: TextRenderMode;
  designNotes?: string;
  referenceImageIds: string[];
  sourceReplicaImageUrl?: string; // 主图同源转详情页时的 1:1 满意成图基准
  printThemeConfig?: PrintThemeLinkageConfig; // 同步过来的印花4维联动配方
  caseDeliveryOverride?: 'inherit' | DetailCaseDeliveryMode;
  aspectRatio: AspectRatioOption;
  imageSize: ImageSizeOption;
  status: TaskStatus;
  errorMessage?: string;
  resultImageUrl?: string;
  resultOssUrl?: string;
  resultCloudUrls?: Partial<Record<CloudStorageProvider, string>>;
  resultTextNote?: string;
  generatedAt?: string;
  durationMs?: number;
  lockResultAsRef?: boolean;
  refineInstruction?: string;
  historyImages: {
    url: string;
    ossUrl?: string;
    cloudUrls?: Partial<Record<CloudStorageProvider, string>>;
    timestamp: string;
    promptSnapshot: string;
    aspectRatio: AspectRatioOption;
    imageSize: ImageSizeOption;
  }[];
}

export type SkuDifferenceMode =
  | 'pattern_color'
  | 'model_spec'
  | 'package_bundle';

export type SkuTitleIndexMode = 'seq_1' | 'file_name' | 'custom_lines';

export interface SkuSellingPointPreset {
  id: string;
  label: string;
  sellingPointBadge: string;
  packageSpecNote?: string;
  titlePrefix?: string;
  subtitleText?: string;
}

export interface SkuBatchConfig {
  selectedProdIds: string[];
  globalCaseRefIds: string[];
  skuDiffMode: SkuDifferenceMode;
  titlePrefix?: string;
  subtitleText?: string;
  swapTitleOrder?: boolean;
  titleIndexMode?: SkuTitleIndexMode;
  customTitleLines?: string;
  referenceInfoText: string;
  unifiedLayoutRule: string;
  defaultAspectRatio: AspectRatioOption;
  defaultImageSize: ImageSizeOption;
  textMode: TextRenderMode;
  sellingPointPresets?: SkuSellingPointPreset[];
  // New simplified Replica Studio fields persisted alongside SkuBatchConfig
  replicaCategory?: ReplicaCategory;
  replicaFidelity?: ReplicaFidelity;
  consistentStyle?: boolean;
  consistentOutputStyle?: boolean;
  styleLinkageMode?: StyleLinkageMode;
  replicaMatchMode?: ReplicaMatchMode;
  replicaLanguage?: ReplicaLanguage;
  singleRequirementsMap?: Record<string, string>;
}

export interface SkuTask {
  id: string;
  skuIndex: number;
  skuDiffMode: SkuDifferenceMode;
  skuTitle: string;
  colorMaterialNote?: string;
  sellingPointBadge: string;
  packageSpecNote: string;
  typographyPlan: string;
  visualPrompt: string;
  textMode: TextRenderMode;
  productRefIds: string[];
  caseRefIds: string[];
  singleRequirement?: string;
  perRefRequirement?: string;
  replicaCategory?: ReplicaCategory;
  replicaFidelity?: ReplicaFidelity;
  consistentStyle?: boolean;
  consistentOutputStyle?: boolean;
  styleLinkageMode?: StyleLinkageMode;
  printThemeConfig?: PrintThemeLinkageConfig;
  replicaMatchMode?: ReplicaMatchMode;
  replicaLanguage?: ReplicaLanguage;
  aspectRatio: AspectRatioOption;
  imageSize: ImageSizeOption;
  status: TaskStatus;
  errorMessage?: string;
  resultImageUrl?: string;
  resultOssUrl?: string;
  resultCloudUrls?: Partial<Record<CloudStorageProvider, string>>;
  resultTextNote?: string;
  generatedAt?: string;
  durationMs?: number;
  lockResultAsRef?: boolean;
  refineInstruction?: string;
  historyImages: {
    url: string;
    ossUrl?: string;
    cloudUrls?: Partial<Record<CloudStorageProvider, string>>;
    timestamp: string;
    promptSnapshot: string;
    aspectRatio: AspectRatioOption;
    imageSize: ImageSizeOption;
  }[];
}

export type SampleRefKind =
  | 'cheese_case_front45'
  | 'cheese_earbud_front'
  | 'cheese_earbud_stem'
  | 'cheese_driver_exploded'
  | 'cheese_chip_bluetooth'
  | 'cheese_package_box'
  | 'case_disney_kv'
  | 'case_acs_exploded'
  | 'case_gaming_latency'
  | 'serum_front'
  | 'serum_angle45'
  | 'serum_macro_dropper'
  | 'serum_micro_capsules'
  | 'serum_texture_smear'
  | 'serum_kelp_ingredient'
  | 'serum_stone_podium'
  | 'serum_cap_detail'
  | 'serum_lab_flatlay'
  | 'serum_gift_box';

export interface PresetTemplate {
  id: string;
  name: string;
  category: string;
  summary: string;
  defaultRequirements: GenerationRequirements;
  globalStylePrefix: string;
  productInfoText: string;
  generatedFullPlanDoc: string;
  sampleRefs: {
    code: string;
    category: 'product' | 'case';
    isCommonAsset?: boolean;
    assetUrl?: string;
    name: string;
    tag: string;
    caseDimensions?: CaseRefDimension[];
    caseCustomRule?: string;
    kind: SampleRefKind;
  }[];
}

export type RuntimeLogStatus = 'running' | 'success' | 'error';

export type RuntimeLogWorkspace = 'detail' | 'sku' | 'oss' | 'system';

export interface RuntimeLogEntry {
  id: string;
  timestamp: string;
  startedAtMs: number;
  workspace: RuntimeLogWorkspace;
  title: string;
  model?: string;
  status: RuntimeLogStatus;
  durationMs?: number;
  summary?: string;
  errorDetail?: string;
  unreadError?: boolean;
}

export function inferUrlStorageProvider(
  url?: string
): CloudStorageProvider | null {
  if (!url || typeof url !== 'string') return null;
  if (/r2\.cloudflarestorage\.com|\.r2\.dev/i.test(url)) {
    return 'cloudflare_r2';
  }
  if (/\.aliyuncs\.com/i.test(url)) {
    return 'aliyun_oss';
  }
  return null;
}

export function getCloudUrlForProvider(
  ossUrl: string | undefined,
  cloudUrls: Partial<Record<CloudStorageProvider, string>> | undefined,
  provider: CloudStorageProvider = 'aliyun_oss'
): string | undefined {
  const direct = cloudUrls?.[provider]?.trim();
  if (direct) return direct;

  const trimmedOss = ossUrl?.trim();
  if (!trimmedOss) return undefined;

  const otherProvider: CloudStorageProvider =
    provider === 'cloudflare_r2' ? 'aliyun_oss' : 'cloudflare_r2';

  if (cloudUrls?.[otherProvider] && cloudUrls[otherProvider] === trimmedOss) {
    return undefined;
  }

  const inferred = inferUrlStorageProvider(trimmedOss);
  if (inferred && inferred !== provider) {
    return undefined;
  }

  return trimmedOss;
}

export function getCloudObjectKeyForProvider(
  ossObjectKey: string | undefined,
  ossUrl: string | undefined,
  cloudUrls: Partial<Record<CloudStorageProvider, string>> | undefined,
  cloudObjectKeys: Partial<Record<CloudStorageProvider, string>> | undefined,
  provider: CloudStorageProvider = 'aliyun_oss'
): string | undefined {
  const directKey = cloudObjectKeys?.[provider]?.trim();
  if (directKey) return directKey;
  if (getCloudUrlForProvider(ossUrl, cloudUrls, provider)) {
    return ossObjectKey;
  }
  return undefined;
}

export function isSyncedToProvider(
  ossUrl: string | undefined,
  cloudUrls: Partial<Record<CloudStorageProvider, string>> | undefined,
  provider: CloudStorageProvider = 'aliyun_oss'
): boolean {
  return Boolean(getCloudUrlForProvider(ossUrl, cloudUrls, provider));
}

export function mergeCloudUrlsForProvider(
  existingOssUrl: string | undefined,
  existingCloudUrls: Partial<Record<CloudStorageProvider, string>> | undefined,
  provider: CloudStorageProvider,
  newUrl: string
): Partial<Record<CloudStorageProvider, string>> {
  const next: Partial<Record<CloudStorageProvider, string>> = {
    ...(existingCloudUrls || {}),
  };
  if (existingOssUrl) {
    const inferredPrev = inferUrlStorageProvider(existingOssUrl);
    if (inferredPrev && !next[inferredPrev]) {
      next[inferredPrev] = existingOssUrl;
    }
  }
  next[provider] = newUrl;
  return next;
}
