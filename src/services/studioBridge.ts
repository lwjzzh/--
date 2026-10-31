import {
  ApiProtocolMode,
  ModelPresetItem,
  AliyunOssConfig,
  CloudStorageProvider,
  PrintThemeLinkageConfig,
  ProductAngleRole,
  StyleLinkageMode,
} from '../types';

export type RuntimeEnvironment = 'web' | 'electron' | 'tauri';

declare global {
  interface Window {
    electronAPI?: {
      invoke: (channel: string, payload?: any) => Promise<any>;
    };
    __TAURI__?: {
      core?: {
        invoke: (cmd: string, args?: any) => Promise<any>;
      };
    };
  }
}

/**
 * Detects whether the studio is running in standard Web browser,
 * Windows Electron (Renderer + Main IPC), or Windows Tauri (WebView2 + Rust Core).
 */
export function detectRuntimeEnvironment(): RuntimeEnvironment {
  if (typeof window !== 'undefined') {
    if (window.electronAPI && typeof window.electronAPI.invoke === 'function') {
      return 'electron';
    }
    if (
      window.__TAURI__?.core &&
      typeof window.__TAURI__.core.invoke === 'function'
    ) {
      return 'tauri';
    }
  }
  return 'web';
}

/**
 * Default configurable preset models for Agent orchestration (users can freely add/remove or input any custom model string).
 */
export const DEFAULT_AGENT_MODEL_PRESETS: ModelPresetItem[] = [
  {
    id: 'gemini-4-argon',
    label: 'gemini-4-argon (内置主力 · HIGH深度思考)',
    category: 'agent',
    protocolHint: 'auto',
    description: '深度思考视觉总监编排、多图识别与全案拆解首选',
    isBuiltIn: true,
  },
  {
    id: 'gemini-3.8-flash',
    label: 'gemini-3.8-flash (内置高速 · 极速解析)',
    category: 'agent',
    protocolHint: 'auto',
    description: '高并发快速识图、提示词润色与轻量级换款改写',
    isBuiltIn: true,
  },
  {
    id: 'gemini-2.5-pro',
    label: 'gemini-2.5-pro (通用 Gemini Pro)',
    category: 'agent',
    protocolHint: 'auto',
    description: '兼容第三方中转网关的 Gemini 2.5 Pro 旗舰多模态模型',
    isBuiltIn: true,
  },
  {
    id: 'gemini-2.5-flash',
    label: 'gemini-2.5-flash (通用 Gemini Flash)',
    category: 'agent',
    protocolHint: 'auto',
    description: '高性价比第三方中转网关常用多模态模型',
    isBuiltIn: true,
  },
  {
    id: 'gpt-4o',
    label: 'gpt-4o (OpenAI 兼容多模态)',
    category: 'agent',
    protocolHint: 'openai-compatible',
    description: '适用于 OneAPI / NewAPI / OpenRouter 等 OpenAI 协议网关',
    isBuiltIn: true,
  },
  {
    id: 'claude-3-7-sonnet-20250219',
    label: 'claude-3-7-sonnet (OpenAI 兼容中转)',
    category: 'agent',
    protocolHint: 'openai-compatible',
    description: '擅长细腻电商文案排版与视觉导演脚本编写',
    isBuiltIn: true,
  },
];

/**
 * Default configurable preset models for Image Generation (users can freely add/remove or input any custom model string).
 */
export const DEFAULT_IMAGE_MODEL_PRESETS: ModelPresetItem[] = [
  {
    id: 'gemini-nano-banana-2.1',
    label: 'gemini-nano-banana-2.1 (内置主力 · 支持1K/2K/4K与中文直出)',
    category: 'image',
    protocolHint: 'auto',
    description: '多参考图锁定商品外观 + 屏内中文排版直出主力模型',
    isBuiltIn: true,
  },
  {
    id: 'gemini-3-pro-image',
    label: 'gemini-3-pro-image (Pro 高精商业摄影渲染)',
    category: 'image',
    protocolHint: 'auto',
    description: '复杂爆炸拆解图、微距材质与高奢光影渲染',
    isBuiltIn: true,
  },
  {
    id: 'gemini-3.1-flash-lite-image',
    label: 'gemini-3.1-flash-lite-image (轻量极速出图)',
    category: 'image',
    protocolHint: 'auto',
    description: '适合快速草图验证与大批量多花色预览',
    isBuiltIn: true,
  },
  {
    id: 'gpt-image-1',
    label: 'gpt-image-1 (OpenAI 兼容生图端点)',
    category: 'image',
    protocolHint: 'openai-compatible',
    description: '通过 /v1/images/generations 或多模态对话生成图像',
    isBuiltIn: true,
  },
  {
    id: 'flux-1.1-pro',
    label: 'flux-1.1-pro (Flux 商业电商生图 · OpenAI 兼容)',
    category: 'image',
    protocolHint: 'openai-compatible',
    description: '适用于各类聚合中转网关的 Flux Pro 商业摄影模型',
    isBuiltIn: true,
  },
];

/**
 * Broad endpoint normalization preview helper so users can see how any URL they paste
 * is automatically adapted for both Gemini Native and OpenAI-Compatible gateways.
 */
export function normalizeEndpointPreview(
  rawUrl: string,
  protocol: ApiProtocolMode = 'auto',
  agentModel = 'gemini-4-argon',
  imageModel = 'gemini-nano-banana-2.1'
): {
  cleanRoot: string;
  geminiNativeEndpoint: string;
  openAiChatEndpoint: string;
  openAiImageEndpoint: string;
  effectiveProtocolLabel: string;
} {
  const trimmed = (rawUrl || '').trim();
  if (!trimmed) {
    return {
      cleanRoot: '内置服务端直连通道 (无需配置外部域名)',
      geminiNativeEndpoint:
        'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent',
      openAiChatEndpoint: '自动按需路由',
      openAiImageEndpoint: '自动按需路由',
      effectiveProtocolLabel: '内置官方 SDK 通道',
    };
  }

  // Strip common suffixes that users accidentally paste from API docs
  let root = trimmed
    .replace(/\/+$/, '')
    .replace(/\/v1\/chat\/completions$/i, '')
    .replace(/\/v1\/images\/generations$/i, '')
    .replace(/\/v1\/models.*$/i, '')
    .replace(/\/v1beta\/models.*$/i, '')
    .replace(/\/chat\/completions$/i, '')
    .replace(/\/images\/generations$/i, '')
    .replace(/\/v1beta$/i, '')
    .replace(/\/v1$/i, '')
    .replace(/\/+$/, '');

  if (!/^https?:\/\//i.test(root)) {
    root = `https://${root}`;
  }

  const isExplicitOpenAiPath = /\/(v1\/)?(chat\/completions|images\/generations)/i.test(
    trimmed
  );
  const isNonGeminiModel =
    !/^(gemini|imagen|veo|learnlm)/i.test(agentModel) ||
    !/^(gemini|imagen)/i.test(imageModel);

  let effectiveProtocolLabel = 'Auto 智能双栈 (优先 Gemini Native，失败或异构模型自动切换 OpenAI /v1)';
  if (protocol === 'gemini-native') {
    effectiveProtocolLabel = '强制 Google Gemini Native (v1beta)';
  } else if (protocol === 'openai-compatible') {
    effectiveProtocolLabel = '强制 OpenAI 兼容协议 (/v1/chat/completions & /v1/images/generations)';
  } else if (isExplicitOpenAiPath || isNonGeminiModel) {
    effectiveProtocolLabel = 'Auto 智能识别 → 已自动匹配 OpenAI /v1 兼容协议';
  }

  return {
    cleanRoot: root,
    geminiNativeEndpoint: `${root}/v1beta/models/${agentModel}:generateContent`,
    openAiChatEndpoint: `${root}/v1/chat/completions`,
    openAiImageEndpoint: `${root}/v1/images/generations`,
    effectiveProtocolLabel,
  };
}

/**
 * Detailed Windows Desktop (Electron / Tauri) Foreground vs Background Execution Specification.
 */
export interface ExecutionModuleSpec {
  id: string;
  layer: 'frontend' | 'backend';
  title: string;
  processName: string;
  summary: string;
  responsibilities: string[];
  desktopAdvantage: string;
}

export const DESKTOP_ARCHITECTURE_BOUNDARIES: ExecutionModuleSpec[] = [
  {
    id: 'fg-ui-canvas',
    layer: 'frontend',
    title: '1. 全屏工作台 UI 与故事板交互视图',
    processName: '前台渲染进程 (Electron Renderer / Tauri WebView2)',
    summary: '负责 100vw×100vh 响应式布局、3种卡片视图（横向网格/故事板横滑/单列详编）与浮窗绑定交互。',
    responsibilities: [
      '01.视觉素材池 (#Prod 产品图与 #Case 案例图) 的拖拽/剪贴板导入与实时标签编辑',
      '02.策划全案与分屏提示词、屏内文案排版规划 (typographyPlan) 的双栏联动编辑',
      '故事板横滑模式下的自适应高度分配、滚轮横向映射与浮窗素材绑定选择器',
      '3+7 同模极速换款弹窗交互、静态屏已出图保护锁 (lockCompletedStaticScreens) 状态控制',
    ],
    desktopAdvantage: '纯 React 声明式状态驱动，已通过 studioBridge 与底层网络/文件 IO 彻底解耦，可直接打包进桌面端静态资源。',
  },
  {
    id: 'fg-canvas-preproc',
    layer: 'frontend',
    title: '2. 轻量级图像预处理与预置母版水合',
    processName: '前台渲染进程 (HTML5 Canvas / Web Worker)',
    summary: '在图片进入任务队列前完成尺寸归一化与本地即时预览。',
    responsibilities: [
      '上传素材图的客户端缩略图生成与 1280px 归一化编码 (normalizeUploadedImageFile)',
      '内置 10 屏母版参考图的 Canvas 矢量绘制与实拍资产水合 (hydratePresetRealAssets)',
      '单屏多历史版本快照切换与全屏高清灯箱缩放预览',
    ],
    desktopAdvantage: '分担主进程 CPU 压力，保证拖拽上传 20+ 张实拍图时界面 60fps 零卡顿。',
  },
  {
    id: 'bg-ai-gateway',
    layer: 'backend',
    title: '3. 多协议 AI 网关路由与宽泛端点适配器',
    processName: '后台主进程 / 本地服务 (Electron Main / Tauri Rust Sidecar / server.ts)',
    summary: '统一接管所有大模型请求，支持 Gemini Native 与 OpenAI 兼容协议自动降级与宽泛 URL 归一化。',
    responsibilities: [
      '自动清洗用户输入的任意格式端点 (支持根域名、/v1、/v1beta、或完整 /v1/chat/completions 路径)',
      '双栈协议自适应：原生支持 Google v1beta 接口，同时兼容 OneAPI / NewAPI / OpenRouter 等 OpenAI 格式中转站',
      'API 密钥安全隔离：在 Windows 桌面端存储于系统凭据管理器 (Credential Manager) 或主进程安全配置，不在渲染层暴露',
      '无浏览器 CORS 跨域限制，支持自定义超长超时时间 (120s~300s) 与断线自动重试',
    ],
    desktopAdvantage: '任何第三方中转站、企业内网网关或本地代理 (如 127.0.0.1) 均可直接连通，彻底杜绝前端跨域报错。',
  },
  {
    id: 'bg-batch-engine',
    layer: 'backend',
    title: '4. 1000+ SKU 批量并发调度与本地磁盘直写引擎',
    processName: '后台主进程 / 文件系统服务 (Node fs / Rust std::fs)',
    summary: '突破浏览器 5MB 缓存限制与下载弹窗限制，实现工业级大批量详情页静默落盘。',
    responsibilities: [
      '多通道并发池控制 (1~8 路并发队列) 与任务中断信号控制',
      'Windows 本地目录直写：每生成完一屏高清大图自动按「SKU款式名/01_KV首屏.png」静默保存至本地硬盘文件夹',
      'SQLite / 本地 JSON 工程文件持久化：支持保存上千款 SKU 的历史工程与高清原图，不再受浏览器 localStorage 5MB 容量限制',
      '后台原生超长图无缝拼接与 ZIP 归档打包 (在桌面端可调用 sharp 或 Rust image 库，支持 4K×10屏 超大图零内存溢出合成)',
    ],
    desktopAdvantage: '适合淘宝/天猫视觉团队全天候挂机批量生产百款花色详情页。',
  },
];

/**
 * Compresses a single reference/SKU image in the browser before network transport
 * so that reverse proxies (Cloud Run / Nginx / Cloudflare) never reject the request
 * with HTTP 413 Payload Too Large.
 *
 * When Alibaba Cloud OSS is enabled and `ossUrl` is present on the item (with `preferZeroBase64Transport`),
 * it strips `base64Data` completely so the request payload is near 0 KB!
 */
async function compressSingleImageForTransport(
  item: Record<string, any>,
  maxEdge: number,
  quality: number,
  maxBase64Chars: number,
  preferZeroBase64Transport = true
): Promise<Record<string, any>> {
  if (!item || typeof item !== 'object') return item;

  // Strip redundant previewUrl from network payload after extracting fallback base64
  const { previewUrl, ...rest } = item;

  // Zero-Base64 OSS Transport Mode: If the image has already been uploaded to Alibaba Cloud OSS,
  // send only the ossUrl and metadata (0 KB Base64 overhead)
  if (
    preferZeroBase64Transport &&
    typeof rest.ossUrl === 'string' &&
    /^https?:\/\//i.test(rest.ossUrl.trim())
  ) {
    return {
      ...rest,
      ossUrl: rest.ossUrl.trim(),
      base64Data: '',
    };
  }

  let rawBase64: string =
    typeof rest.base64Data === 'string' && rest.base64Data.trim()
      ? rest.base64Data.trim()
      : typeof previewUrl === 'string' && previewUrl.trim()
        ? previewUrl.trim()
        : '';

  if (!rawBase64) {
    return rest;
  }

  let mimeType =
    typeof rest.mimeType === 'string' && rest.mimeType.startsWith('image/')
      ? rest.mimeType
      : 'image/jpeg';

  if (rawBase64.startsWith('data:')) {
    const commaIdx = rawBase64.indexOf(',');
    if (commaIdx !== -1) {
      const header = rawBase64.slice(0, commaIdx);
      const mimeMatch = header.match(/data:(image\/[a-zA-Z0-9.+-]+);base64/i);
      if (mimeMatch) mimeType = mimeMatch[1].toLowerCase();
      rawBase64 = rawBase64.slice(commaIdx + 1).trim();
    }
  }

  // If already under transport budget (including transparent PNG cutouts normalized by imagePreprocessor), return directly without lossy JPEG re-encoding
  if (rawBase64.length > 0 && rawBase64.length <= maxBase64Chars) {
    return {
      ...rest,
      mimeType,
      base64Data: rawBase64,
    };
  }

  if (typeof document === 'undefined' || typeof Image === 'undefined') {
    return {
      ...rest,
      mimeType,
      base64Data: rawBase64,
    };
  }

  // Fast fingerprint cache lookup to avoid re-running main-thread Canvas compression across batch requests
  const cacheFingerprint = `${rawBase64.length}:${rawBase64.slice(0, 48)}:${rawBase64.slice(-48)}:${maxEdge}:${quality}:${maxBase64Chars}:${mimeType}`;
  const cachedCompressed = readTransportCompressionCache(cacheFingerprint);
  if (cachedCompressed) {
    return {
      ...rest,
      mimeType: cachedCompressed.startsWith('iVBORw0KGgo') ? 'image/png' : 'image/jpeg',
      base64Data: cachedCompressed,
    };
  }

  try {
    const dataUrl = `data:${mimeType};base64,${rawBase64}`;
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Image decode failed'));
      image.src = dataUrl;
    });

    const isProdPng = mimeType === 'image/png' && rest?.category !== 'case';

    const renderAtScale = (
      edgeLimit: number,
      q: number,
      preservePngAlpha = false
    ): { b64: string; outMime: string } => {
      const scale = Math.min(1, edgeLimit / Math.max(img.width || 1, img.height || 1));
      const targetW = Math.max(1, Math.round((img.width || 1) * scale));
      const targetH = Math.max(1, Math.round((img.height || 1) * scale));
      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');
      if (!ctx) return { b64: rawBase64, outMime: mimeType };
      if (preservePngAlpha) {
        ctx.clearRect(0, 0, targetW, targetH);
        ctx.drawImage(img, 0, 0, targetW, targetH);
        const pngUrl = canvas.toDataURL('image/png');
        const pngB64 = pngUrl.split(',')[1] || '';
        if (pngB64 && pngB64.length <= maxBase64Chars) {
          return { b64: pngB64, outMime: 'image/png' };
        }
      }
      // Fill clean white background so transparent PNG cutouts render cleanly in JPEG when exceeding PNG budget
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, targetW, targetH);
      ctx.drawImage(img, 0, 0, targetW, targetH);
      const outUrl = canvas.toDataURL('image/jpeg', q);
      return {
        b64: outUrl.split(',')[1] || rawBase64,
        outMime: 'image/jpeg',
      };
    };

    let rendered = renderAtScale(maxEdge, quality, isProdPng);
    if (rendered.b64.length > maxBase64Chars) {
      rendered = renderAtScale(
        Math.round(maxEdge * 0.75),
        Math.max(0.55, quality - 0.14),
        isProdPng
      );
    }
    if (rendered.b64.length > maxBase64Chars) {
      rendered = renderAtScale(640, 0.58, false);
    }

    writeTransportCompressionCache(cacheFingerprint, rendered.b64);

    return {
      ...rest,
      mimeType: rendered.outMime,
      base64Data: rendered.b64,
    };
  } catch {
    return {
      ...rest,
      mimeType,
      base64Data: rawBase64,
    };
  }
}

const MAX_TRANSPORT_CACHE_ENTRIES = 80;
const transportCompressionCache = new Map<string, string>();

function readTransportCompressionCache(key: string): string | null {
  const val = transportCompressionCache.get(key);
  if (!val) return null;
  transportCompressionCache.delete(key);
  transportCompressionCache.set(key, val);
  return val;
}

function writeTransportCompressionCache(key: string, value: string): void {
  if (!value) return;
  if (transportCompressionCache.has(key)) {
    transportCompressionCache.delete(key);
  }
  transportCompressionCache.set(key, value);
  while (transportCompressionCache.size > MAX_TRANSPORT_CACHE_ENTRIES) {
    const oldest = transportCompressionCache.keys().next().value;
    if (!oldest) break;
    transportCompressionCache.delete(oldest);
  }
}

async function sanitizePayloadImagesForTransport(
  apiPath: string,
  payload: Record<string, any>
): Promise<Record<string, any>> {
  if (!payload || typeof payload !== 'object') return payload;
  if (apiPath.startsWith('/api/oss/')) return payload;

  const nextPayload: Record<string, any> = { ...payload };
  const preferZeroBase64 =
    Boolean(payload.ossConfig?.enabled) &&
    payload.ossConfig?.preferZeroBase64Transport !== false;

  // 分场景双轨预算：
  // 1. 单屏生图 (/api/image/generate)：通常仅绑定 1~3 张参考图，优先保障面料肌理与版式清晰度 (1536px / 0.88 高画质)
  // 2. 全局方案编排与批量打标 (/api/agent/*)：可能一次传入 8~15 张素材，侧重语义与版式结构识别 (1024px~1280px 动态配额)
  const isImageGeneration = apiPath.includes('/api/image/generate');
  const TOTAL_BASE64_BUDGET = isImageGeneration ? 2_400_000 : 2_000_000;

  for (const key of [
    'referenceImages',
    'skuPatternImages',
    'productImages',
    'caseImages',
  ] as const) {
    const list = nextPayload[key];
    if (Array.isArray(list) && list.length > 0) {
      // Only count items that do NOT already have an ossUrl towards the Base64 budget
      const nonOssCount = Math.max(
        1,
        list.filter(
          (item) =>
            !(
              preferZeroBase64 &&
              typeof item?.ossUrl === 'string' &&
              /^https?:\/\//i.test(item.ossUrl.trim())
            )
        ).length
      );

      const perImageMaxChars = isImageGeneration
        ? Math.min(760_000, Math.max(240_000, Math.floor(TOTAL_BASE64_BUDGET / nonOssCount)))
        : Math.min(480_000, Math.max(150_000, Math.floor(TOTAL_BASE64_BUDGET / nonOssCount)));

      const maxEdge = isImageGeneration
        ? nonOssCount <= 2
          ? 1536
          : nonOssCount <= 4
            ? 1280
            : 1024
        : nonOssCount <= 3
          ? 1280
          : nonOssCount <= 6
            ? 1024
            : 860;

      const quality = isImageGeneration
        ? nonOssCount <= 2
          ? 0.88
          : 0.84
        : nonOssCount <= 4
          ? 0.84
          : 0.78;

      nextPayload[key] = await Promise.all(
        list.map((item) =>
          compressSingleImageForTransport(
            item,
            maxEdge,
            quality,
            perImageMaxChars,
            preferZeroBase64
          )
        )
      );
    }
  }

  return nextPayload;
}

/**
 * Unified Bridge Request helper:
 * - In Electron: invokes `window.electronAPI.invoke(channel, payload)`
 * - In Tauri: invokes `window.__TAURI__.core.invoke(cmd, payload)`
 * - In Web / Sidecar mode: calls Express `/api/*` endpoints
 */
async function callStudioBackend<T>(
  apiPath: string,
  ipcChannel: string,
  payload: Record<string, any>
): Promise<T> {
  const safePayload = await sanitizePayloadImagesForTransport(apiPath, payload);
  const runtime = detectRuntimeEnvironment();

  if (runtime === 'electron' && window.electronAPI) {
    return window.electronAPI.invoke(ipcChannel, safePayload) as Promise<T>;
  }

  if (runtime === 'tauri' && window.__TAURI__?.core) {
    return window.__TAURI__.core.invoke(ipcChannel, { payload: safePayload }) as Promise<T>;
  }

  const res = await fetch(apiPath, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(safePayload),
  });

  const rawText = await res.text();
  let data: any = {};
  try {
    data = rawText ? JSON.parse(rawText) : {};
  } catch {
    throw new Error(
      `接口返回异常响应 (${res.status})，请检查通道地址或稍后重试`
    );
  }

  if (!res.ok) {
    throw new Error(data.error || `请求失败 (${res.status})`);
  }
  return data as T;
}

export const studioBridge = {
  getRuntime: detectRuntimeEnvironment,

  getOssStatus: (payload: { ossConfig?: Partial<AliyunOssConfig> }) =>
    callStudioBackend<{
      provider: CloudStorageProvider;
      configured: boolean;
      envConfigured: boolean;
      ossEnvConfigured?: boolean;
      r2EnvConfigured?: boolean;
      source: 'client_config' | 'env_vars' | null;
      region: string;
      bucket: string;
      pathPrefix: string;
      r2AccountId?: string;
      r2Bucket?: string;
      r2PathPrefix?: string;
    }>('/api/oss/status', 'studio:oss-status', payload),

  testOssConnection: (payload: { ossConfig?: Partial<AliyunOssConfig> }) =>
    callStudioBackend<{
      ok: boolean;
      provider?: CloudStorageProvider;
      latencyMs: number;
      bucket: string;
      region: string;
      source: string;
      sampleUrl: string;
      message: string;
      error?: string;
    }>('/api/oss/test', 'studio:oss-test', payload),

  uploadToOss: (payload: {
    items: {
      id: string;
      name?: string;
      mimeType?: string;
      base64Data?: string;
      dataUrl?: string;
    }[];
    folder?: 'refs' | 'results';
    ossConfig?: Partial<AliyunOssConfig>;
  }) =>
    callStudioBackend<{
      ok: boolean;
      uploaded: {
        id: string;
        ossUrl: string;
        objectKey: string;
        sizeBytes: number;
      }[];
      failed?: {
        id: string;
        error: string;
      }[];
      error?: string;
    }>('/api/oss/upload', 'studio:oss-upload', payload),

  testChannel: (payload: {
    customBaseUrl?: string;
    customApiKey?: string;
    customHeaders?: string;
    protocol?: ApiProtocolMode;
    agentModel?: string;
  }) =>
    callStudioBackend<{
      ok: boolean;
      latencyMs: number;
      model: string;
      protocolUsed?: string;
      normalizedEndpoint?: string;
      reply: string;
      error?: string;
    }>('/api/channel/test', 'studio:channel-test', payload),

  analyzeRefs: (payload: {
    referenceImages: any[];
    agentModel: string;
    customBaseUrl?: string;
    customApiKey?: string;
    customHeaders?: string;
    protocol?: ApiProtocolMode;
    ossConfig?: Partial<AliyunOssConfig>;
  }) =>
    callStudioBackend<{
      tags: {
        id: string;
        tag: string;
        prodAngleRole?: string;
        caseDimensions?: string[];
      }[];
    }>('/api/agent/analyze-refs', 'studio:agent-analyze-refs', payload),

  analyzeCaseScreens: (payload: {
    caseImages: any[];
    expectedTotalScreens?: number;
    agentModel: string;
    customBaseUrl?: string;
    customApiKey?: string;
    customHeaders?: string;
    protocol?: ApiProtocolMode;
    ossConfig?: Partial<AliyunOssConfig>;
  }) =>
    callStudioBackend<{
      unifiedVisualSpec?: string;
      screens: {
        id: string;
        screenIndex: number;
        tag: string;
        extractedLayoutDna: string;
        caseDimensions?: string[];
        subScreens?: {
          subScreenIndex: number;
          subScreenTotal: number;
          regionLabel: string;
          title: string;
          sectionType?: string;
          extractedLayoutDna: string;
        }[];
      }[];
    }>('/api/agent/analyze-case-screens', 'studio:agent-analyze-case-screens', payload),

  parsePlan: (payload: {
    productInfoText: string;
    existingFullPlanText: string;
    referenceImages: any[];
    agentModel: string;
    enableHighThinking: boolean;
    defaultImageSize: string;
    globalStylePrefix: string;
    requirements: any;
    customBaseUrl?: string;
    customApiKey?: string;
    customHeaders?: string;
    protocol?: ApiProtocolMode;
    ossConfig?: Partial<AliyunOssConfig>;
  }) =>
    callStudioBackend<{
      campaignSummary: string;
      generatedFullPlanDoc: string;
      unifiedVisualSpec?: string;
      tasks: any[];
    }>('/api/agent/parse-plan', 'studio:agent-parse-plan', payload),

  adaptNewSku: (payload: {
    skuNameHint: string;
    productInfoText?: string;
    skuPatternImages: any[];
    dynamicTasks: any[];
    agentModel: string;
    customBaseUrl?: string;
    customApiKey?: string;
    customHeaders?: string;
    protocol?: ApiProtocolMode;
    ossConfig?: Partial<AliyunOssConfig>;
  }) =>
    callStudioBackend<{
      detectedSkuTheme: string;
      updatedTasks: any[];
    }>('/api/agent/adapt-new-sku', 'studio:agent-adapt-sku', payload),

  parseSkuPlan: (payload: {
    productImages: any[];
    caseImages: any[];
    referenceInfoText: string;
    unifiedLayoutRule: string;
    skuDiffMode: 'pattern_color' | 'model_spec' | 'package_bundle';
    defaultAspectRatio: string;
    defaultImageSize: string;
    textMode: 'with_text' | 'without_text';
    globalStylePrefix?: string;
    agentModel: string;
    enableHighThinking?: boolean;
    customBaseUrl?: string;
    customApiKey?: string;
    customHeaders?: string;
    protocol?: ApiProtocolMode;
    ossConfig?: Partial<AliyunOssConfig>;
  }) =>
    callStudioBackend<{
      skuBatchSummary: string;
      skuTasks: any[];
    }>('/api/agent/parse-sku-plan', 'studio:agent-parse-sku-plan', payload),

  extractCaseLayout: (payload: {
    caseImages: any[];
    skuDiffMode: 'pattern_color' | 'model_spec' | 'package_bundle';
    agentModel: string;
    customBaseUrl?: string;
    customApiKey?: string;
    customHeaders?: string;
    protocol?: ApiProtocolMode;
    ossConfig?: Partial<AliyunOssConfig>;
  }) =>
    callStudioBackend<{
      extractedLayoutRule: string;
    }>(
      '/api/agent/extract-case-layout',
      'studio:agent-extract-case-layout',
      payload
    ),

  polishPrompt: (payload: {
    title: string;
    benchmarkCase: string;
    typographyPlan: string;
    currentPrompt: string;
    textMode: string;
    layerType?: 'dynamic' | 'static';
    productInfoText?: string;
    boundRefSummary?: string;
    globalStylePrefix: string;
    agentModel: string;
    customBaseUrl?: string;
    customApiKey?: string;
    customHeaders?: string;
    protocol?: ApiProtocolMode;
  }) =>
    callStudioBackend<{
      polishedPrompt: string;
    }>('/api/agent/polish-prompt', 'studio:agent-polish-prompt', payload),

  extractDetailStyle: (payload: {
    caseImages?: any[];
    competitorImages?: any[];
    productImages?: any[];
    productInfoText?: string;
    agentModel: string;
    customBaseUrl?: string;
    customApiKey?: string;
    customHeaders?: string;
    protocol?: ApiProtocolMode;
    ossConfig?: Partial<AliyunOssConfig>;
  }) =>
    callStudioBackend<{
      unifiedVisualSpec: string;
      dominantPalette?: string;
    }>('/api/detail/extract-style', 'studio:detail-extract-style', {
      ...payload,
      caseImages: payload.caseImages || payload.competitorImages || [],
    }),

  planDetailModules: (payload: {
    productImages: any[];
    productInfoText: string;
    unifiedVisualSpec: string;
    modules: {
      id: string;
      screenNumber: number;
      moduleType: string;
      title: string;
      userNote?: string;
      referenceImageIds?: string[];
      boundProductIds?: string[];
    }[];
    textMode: 'with_text' | 'without_text';
    aspectRatio: string;
    imageSize?: string;
    agentModel: string;
    enableHighThinking?: boolean;
    customBaseUrl?: string;
    customApiKey?: string;
    customHeaders?: string;
    protocol?: ApiProtocolMode;
    ossConfig?: Partial<AliyunOssConfig>;
  }) =>
    callStudioBackend<{
      unifiedVisualSpec: string;
      plannedModules: {
        id: string;
        screenNumber: number;
        title: string;
        sectionType?: string;
        copywriting: string;
        typographyPlan: string;
        visualPrompt: string;
        referenceImageIds?: string[];
        boundProductIds?: string[];
      }[];
    }>('/api/detail/plan-modules', 'studio:detail-plan-modules', payload),

  planReplicaTasks: (payload: {
    caseImages?: any[];
    referenceImages?: any[];
    productImages: any[];
    tasks?: {
      id: string;
      index: number;
      caseRefId: string;
      prodRefId: string;
      singleRequirement?: string;
      skuLabel?: string;
    }[];
    matchMode?: any;
    replicaCategory: string;
    replicaFidelity: 'style_reference' | 'style_ref' | 'high_replica';
    consistentStyle?: boolean;
    consistentOutputStyle?: boolean;
    styleLinkageMode?: StyleLinkageMode;
    unifiedRequirement?: string;
    globalRequirement?: string;
    language: 'zh' | 'en' | 'none';
    aspectRatio?: string;
    imageSize?: string;
    agentModel: string;
    customBaseUrl?: string;
    customApiKey?: string;
    customHeaders?: string;
    protocol?: ApiProtocolMode;
    ossConfig?: Partial<AliyunOssConfig>;
  }) =>
    callStudioBackend<{
      productColorTheme?: string;
      detectedProdRoles?: Record<string, ProductAngleRole>;
      plannedTasks: {
        id: string;
        extractedCopy: string;
        visualPrompt: string;
        boundProductIds?: string[];
        printThemeConfig?: PrintThemeLinkageConfig;
      }[];
      replicaTasks?: {
        id?: string;
        title?: string;
        copywriting?: string;
        typographyPlan?: string;
        visualPrompt?: string;
        extractedCopy?: string;
        boundProductIds?: string[];
        printThemeConfig?: PrintThemeLinkageConfig;
      }[];
    }>('/api/replica/plan-tasks', 'studio:replica-plan-tasks', {
      ...payload,
      caseImages: payload.caseImages || payload.referenceImages || [],
      consistentStyle:
        payload.consistentStyle ?? payload.consistentOutputStyle ?? true,
      unifiedRequirement:
        payload.unifiedRequirement || payload.globalRequirement || '',
    }),

  generateImage: (payload: {
    prompt: string;
    copywriting?: string;
    typographyPlan?: string;
    benchmarkCase?: string;
    unifiedVisualSpec?: string;
    caseDeliveryMode?: 'none' | 'shared_style' | 'lock_base_swap';
    customConstraints?: string[];
    studioContext?: 'detail' | 'sku' | 'replica';
    moduleType?: string;
    userNote?: string;
    replicaCategory?: string;
    replicaFidelity?: 'style_reference' | 'style_ref' | 'high_replica';
    consistentStyle?: boolean;
    consistentOutputStyle?: boolean;
    styleLinkageMode?: StyleLinkageMode;
    printThemeConfig?: PrintThemeLinkageConfig;
    sourceReplicaImageUrl?: string;
    lockedResultImageUrl?: string;
    refineInstruction?: string;
    singleRequirement?: string;
    perRefRequirement?: string;
    unifiedRequirement?: string;
    globalRequirement?: string;
    replicaLanguage?: 'zh' | 'en' | 'none';
    textMode?: string;
    layerType?: 'dynamic' | 'static';
    title?: string;
    referenceImages?: any[];
    imageModel: string;
    aspectRatio: string;
    imageSize: string;
    customBaseUrl?: string;
    customApiKey?: string;
    customHeaders?: string;
    protocol?: ApiProtocolMode;
    ossConfig?: Partial<AliyunOssConfig>;
  }) =>
    callStudioBackend<{
      imageUrl: string;
      ossUrl?: string;
      textNote: string;
      durationMs: number;
      modelUsed: string;
      protocolUsed?: string;
      aspectRatio: string;
      imageSize: string;
    }>('/api/image/generate', 'studio:image-generate', {
      ...payload,
      replicaFidelity:
        payload.replicaFidelity === 'style_ref'
          ? 'style_reference'
          : payload.replicaFidelity,
      consistentStyle:
        payload.consistentStyle ?? payload.consistentOutputStyle ?? true,
      singleRequirement:
        payload.singleRequirement || payload.perRefRequirement || '',
      unifiedRequirement:
        payload.unifiedRequirement || payload.globalRequirement || '',
    }),
};

