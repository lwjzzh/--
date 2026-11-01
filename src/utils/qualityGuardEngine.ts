import {
  DetailModuleType,
  ProductAngleRole,
  ReferenceImageItem,
  ScreenTask,
  SkuTask,
} from '../types';

export function inferProdAngleRoleFromAsset(
  prod: Pick<ReferenceImageItem, 'name' | 'tag' | 'prodAngleRole'>
): ProductAngleRole {
  if (prod.prodAngleRole) return prod.prodAngleRole;
  const text = `${prod.tag || ''} ${prod.name || ''}`.toLowerCase();
  if (/全家福|多款|合集|矩阵|色卡|multi/.test(text)) return 'multi_sku';
  if (/包装|配件|清单|盒|充电线|说明书|package/.test(text))
    return 'package_accessory';
  if (/单耳|耳机主体|入耳|左耳|右耳|earbud|single/.test(text))
    return 'single_earbud';
  if (/开盖|打开|内舱|取出|open/.test(text)) return 'open_case';
  if (/特写|微距|细节|侧面|背面|底部|接口|转轴|closeup|detail/.test(text))
    return 'detail_closeup';
  return 'hero_front';
}

export type QuickAssetSelectMode =
  | 'all'
  | 'angles_only'
  | 'patterns_only'
  | 'single_sku_multi_angle'
  | 'multi_sku_front_only'
  | 'invert'
  | 'first_three';

export interface QualityIssueItem {
  code:
    | 'overbound_prods'
    | 'conflicting_sku_patterns'
    | 'angle_pose_mismatch'
    | 'prompt_code_leak'
    | 'pill_hallucination_risk'
    | 'unfilled_placeholder'
    | 'empty_bound_prods'
    | 'disabled_prod_bound';
  severity: 'error' | 'warn';
  label: string;
  detail: string;
}

export interface TaskQualityInspection {
  passed: boolean;
  hasErrors: boolean;
  boundProdCount: number;
  recommendedMaxCount: number;
  summaryBadge: string;
  issues: QualityIssueItem[];
}

export interface PayloadPreviewImageSlot {
  order: number;
  roleBadge: string;
  weightLevel: 'highest' | 'high' | 'medium';
  previewUrl: string;
  code: string;
  tag: string;
  angleRoleLabel?: string;
  ruleDesc: string;
}

export interface TaskPayloadInspection {
  taskId: string;
  taskTitle: string;
  modeLabel: string;
  aspectRatio: string;
  imageSize: string;
  imageSlots: PayloadPreviewImageSlot[];
  filteredOutCount: number;
  sanitizedCopywriting: string;
  compiledPositivePrompt: string;
  activeGuardrails: string[];
  qualityInspection: TaskQualityInspection;
}

/**
 * 从竞品参考图 (#Case) 标签/备注或卡片文案中推断画面急需的特殊结构视角（开盖/单耳/微距）
 */
export function inferRequiredAngleFromCaseOrText(
  text?: string
): ProductAngleRole | null {
  if (!text) return null;
  const t = text.toLowerCase();
  if (/单耳|入耳|佩戴|耳道|左右耳|主从切换|不区分主副|耳塞|轻若无物|久戴/.test(t)) {
    return 'single_earbud';
  }
  if (/开盖|打开|内舱|双耳在盒|取出|秒连|回连|霍尔/.test(t)) {
    return 'open_case';
  }
  if (/微距|特写|振膜|动圈|声学结构|接口|转轴/.test(t)) {
    return 'detail_closeup';
  }
  return null;
}

/**
 * 判断素材在左侧栏是否处于勾选启用状态（默认未定义时视为 true）
 */
export function isAssetEnabled(ref?: ReferenceImageItem | null): boolean {
  if (!ref) return false;
  return ref.enabled !== false;
}

/**
 * 获取当前已勾选启用的产品图列表；若用户全部取消勾选，则兜底返回第1张防空报错
 */
export function filterEnabledProds(
  prods: ReferenceImageItem[],
  fallbackToFirst = true
): ReferenceImageItem[] {
  const enabled = prods.filter((p) => p.enabled !== false);
  if (enabled.length > 0) return enabled;
  return fallbackToFirst && prods.length > 0 ? [prods[0]] : [];
}

/**
 * 获取素材的有效视角角色（优先读取显式标注，其次智能推断）
 */
export function getEffectiveProdRole(
  prod: ReferenceImageItem
): ProductAngleRole {
  return prod.prodAngleRole || inferProdAngleRoleFromAsset(prod);
}

/**
 * 左侧栏快捷筛选启用状态：
 * - 'all': 全部启用
 * - 'angles_only': 仅启用第1张主花色(hero_front) + 所有结构角度图(开盖/单耳/微距/包装)，适合单款多角度套图/详情页
 * - 'patterns_only': 仅启用正面主视图(hero_front/multi_sku)，适合多花色SKU裂变
 * - 'first_three': 仅启用前3张核心图
 * - 'invert': 反选
 */
export function applyQuickAssetSelectionMode(
  allItems: ReferenceImageItem[],
  mode: QuickAssetSelectMode
): ReferenceImageItem[] {
  let firstHeroKept = false;
  const prodList = allItems.filter((item) => item.category === 'product');
  const prodIndexMap = new Map<string, number>();
  prodList.forEach((p, idx) => prodIndexMap.set(p.id, idx));

  return allItems.map((item) => {
    if (item.category !== 'product') return item;
    const role = getEffectiveProdRole(item);
    const prodIdx = prodIndexMap.get(item.id) ?? 0;

    if (mode === 'all') {
      return { ...item, enabled: true };
    }
    if (mode === 'invert') {
      return { ...item, enabled: item.enabled === false };
    }
    if (mode === 'first_three') {
      return { ...item, enabled: prodIdx < 3 };
    }
    if (mode === 'angles_only' || mode === 'single_sku_multi_angle') {
      const isStructuralAngle =
        role === 'open_case' ||
        role === 'single_earbud' ||
        role === 'detail_closeup' ||
        role === 'package_accessory';
      if (isStructuralAngle) {
        return { ...item, enabled: true };
      }
      if (!firstHeroKept && role === 'hero_front') {
        firstHeroKept = true;
        return { ...item, enabled: true };
      }
      return { ...item, enabled: false };
    }
    if (mode === 'patterns_only' || mode === 'multi_sku_front_only') {
      const isPatternHero = role === 'hero_front' || role === 'multi_sku';
      return { ...item, enabled: isPatternHero };
    }
    return item;
  });
}

/**
 * 检测文本中是否残留 #Prod-1 / #Case-2 / #P1 等内部编号（生图模型会把它们当成真实文字印在产品或背景上）
 */
export function hasInternalCodeLeak(text?: string): boolean {
  if (!text) return false;
  return /#\s*(?:Prod|Case|P)\s*[-_]?\s*\d+/i.test(text);
}

/**
 * 检测文本中是否包含“胶囊”字样（生图模型极易画成3D医药胶囊颗粒）
 */
export function hasPillHallucinationRisk(text?: string): boolean {
  if (!text) return false;
  return /胶囊/.test(text);
}

/**
 * 检测文案中是否残留未填写的占位符（如 [核心卖点1]、[请填写]）
 */
export function hasUnfilledPlaceholder(text?: string): boolean {
  if (!text) return false;
  return /\[(?:核心卖点|卖点|请填写|待补充|品牌名|产品名|参数)[^\]]*\]/.test(
    text
  );
}

/**
 * 清洗生图画面提示词（visualPrompt / typographyPlan）：
 * 1. 彻底剥离 #Prod-1 / #Case-2 / #P1 等内部编号，替换为自然视觉指代，防止模型把 "#Prod-2" 印在耳机仓或海报上
 * 2. 将“胶囊”替换为“浅色圆角信息卡/圆角标签栏”，杜绝3D药丸/医药胶囊幻觉
 * 3. 将深棕/黑底死板框描述替换为通透浅色玻璃/果冻质感卡片
 */
export function sanitizeVisualPromptForRender(
  rawPrompt?: string,
  _prods?: ReferenceImageItem[]
): string {
  if (!rawPrompt) return '';
  let cleaned = rawPrompt;

  // 替换类似 "#Prod-2充电仓（正面印花）" 或 "以#Prod-1为核心"
  cleaned = cleaned.replace(
    /#\s*Prod\s*[-_]?\s*\d+\s*(?:（[^）]*）|\([^)]*\))?/gi,
    '我方自有产品主体'
  );
  cleaned = cleaned.replace(
    /#\s*Case\s*[-_]?\s*\d+\s*(?:（[^）]*）|\([^)]*\))?/gi,
    '参考版式构图'
  );
  cleaned = cleaned.replace(/#\s*P\s*\d+/gi, '我方产品主体');

  // 合并连续重复的“我方自有产品主体”
  cleaned = cleaned.replace(/(我方自有产品主体[\s、，,]*){2,}/g, '我方自有产品主体');

  // 替换“胶囊”防3D药丸幻觉
  cleaned = cleaned
    .replace(/卖点胶囊/g, '浅色圆角卖点信息卡')
    .replace(/胶囊条/g, '浅色圆角信息栏')
    .replace(/胶囊框/g, '浅色圆角矩形框')
    .replace(/胶囊标签/g, '圆角信息标签')
    .replace(/胶囊卡/g, '浅色圆角信息卡')
    .replace(/胶囊/g, '圆角信息卡');

  // 替换深棕/黑底死板色块描述
  cleaned = cleaned
    .replace(/深棕色?(?:底|背景|方框|色块)/g, '同色系浅色半透明圆角背景')
    .replace(/纯黑(?:底|方框|色块)/g, '通透浅色微磨砂圆角卡');

  return cleaned.trim();
}

/**
 * 清洗屏内上屏文案（copywriting / sellingPointBadge）：
 * 1. 移除 #Prod-X / #Case-X 编号
 * 2. 将“底部胶囊卡”等字段标签替换为“底部信息栏”
 * 3. 清理未填写的模板方括号占位符
 */
export function sanitizeCopywritingForRender(rawCopy?: string): string {
  if (!rawCopy) return '';
  let cleaned = rawCopy;
  cleaned = cleaned.replace(/#\s*(?:Prod|Case|P)\s*[-_]?\s*\d+/gi, '');
  cleaned = cleaned
    .replace(/底部胶囊(?:卡|条)?/g, '底部圆角信息栏')
    .replace(/卖点胶囊/g, '核心卖点栏')
    .replace(/胶囊/g, '圆角信息栏');
  cleaned = cleaned.replace(
    /\[(?:核心卖点|卖点|请填写|待补充|参数)\d*\]/g,
    ''
  );
  return cleaned.trim();
}

/**
 * 判断某屏任务是否为“全家福/多花色系列矩阵”模块
 */
export function isMultiSkuMatrixContext(options: {
  moduleType?: DetailModuleType;
  skuDiffMode?: string;
  title?: string;
  prompt?: string;
}): boolean {
  if (options.moduleType === 'series_matrix') return true;
  if (options.skuDiffMode === 'multi_sku') return true;
  const combined = `${options.title || ''} ${options.prompt || ''}`;
  return /全家福|系列矩阵|多花色|多色同框|全系配色|多款可选|色彩矩阵/.test(
    combined
  );
}

/**
 * 智能为单张卡片/单屏模块挑选最匹配的互补角度产品图：
 * - 普通单品主图/详情页模块：严格控制在 1~2 张（1张主花色正面 + 1张互补结构角度如开盖/单耳/微距），绝不混入第2种不同花色的 hero_front！
 * - 系列矩阵/全家福模块：允许挑選最多 6 张不同花色的 hero_front / multi_sku。
 */
export function smartPickComplementaryProds(
  arg1:
    | {
        moduleType?: DetailModuleType | string;
        skuDiffMode?: string;
        title?: string;
        prompt?: string;
        refCaseTitle?: string;
        refCaseRule?: string;
        enabledProds: ReferenceImageItem[];
        preferredPrimaryProdId?: string;
        maxCount?: number;
      }
    | ReferenceImageItem[],
  contextHint?: string,
  maxCountArg?: number
): ReferenceImageItem[] {
  const options = Array.isArray(arg1)
    ? {
        enabledProds: arg1,
        moduleType: contextHint || undefined,
        title: contextHint || '',
        prompt: contextHint || '',
        refCaseTitle: '',
        refCaseRule: '',
        maxCount: maxCountArg,
      }
    : arg1;
  const pool = filterEnabledProds(options.enabledProds, true);
  if (pool.length === 0) return [];

  const isMatrix = isMultiSkuMatrixContext({
    ...options,
    moduleType: options.moduleType as DetailModuleType | undefined,
  });
  if (isMatrix) {
    const cap = options.maxCount ?? 6;
    const heroOrMulti = pool.filter((p) => {
      const r = getEffectiveProdRole(p);
      return r === 'hero_front' || r === 'multi_sku';
    });
    const source = heroOrMulti.length >= 2 ? heroOrMulti : pool;
    return source.slice(0, cap);
  }

  const combinedText = `${options.title || ''} ${options.prompt || ''} ${options.refCaseTitle || ''} ${options.refCaseRule || ''}`;
  const byRole = (role: ProductAngleRole) =>
    pool.filter((p) => getEffectiveProdRole(p) === role);

  const heroFronts = byRole('hero_front');
  const openCases = byRole('open_case');
  const singleEarbuds = byRole('single_earbud');
  const closeups = byRole('detail_closeup');
  const packages = byRole('package_accessory');

  // 确定唯一的主花色正面图（防止多张不同花色的 hero_front 混入导致印花串色变形）
  const primaryHero =
    (options.preferredPrimaryProdId
      ? pool.find((p) => p.id === options.preferredPrimaryProdId)
      : undefined) ||
    heroFronts[0] ||
    pool[0];

  // 根据模块类型或文案关键词精准匹配 1~2 张互补视角
  if (
    options.moduleType === 'package_contents' ||
    options.moduleType === 'spec_table' ||
    /包装|配件|清单|全家福配件|充电线|说明书/.test(combinedText)
  ) {
    if (packages.length > 0) {
      return primaryHero && primaryHero.id !== packages[0].id
        ? [packages[0], primaryHero]
        : [packages[0]];
    }
  }

  if (
    options.moduleType === 'wearing_scene' ||
    options.moduleType === 'comfort_wear' ||
    /佩戴|入耳|轻盈|人体工学|舒适|单耳|通话|降噪|声学|音质|喇叭|振膜|芯片|延迟/.test(
      combinedText
    )
  ) {
    const structCandidate =
      singleEarbuds[0] || openCases[0] || closeups[0];
    if (structCandidate && primaryHero && structCandidate.id !== primaryHero.id) {
      // 主花色锚定外观 + 单耳/开盖提供内部结构参考（最多2张，绝不选第2个花色）
      return [primaryHero, structCandidate];
    }
    return [structCandidate || primaryHero];
  }

  if (
    options.moduleType === 'craft_material' ||
    /工艺|材质|微距|触感|涂层|细节|转轴|接口|指示灯/.test(combinedText)
  ) {
    const detailCandidate = closeups[0] || openCases[0] || singleEarbuds[0];
    if (detailCandidate && primaryHero && detailCandidate.id !== primaryHero.id) {
      return [primaryHero, detailCandidate];
    }
    return [detailCandidate || primaryHero];
  }

  // 默认首屏KV / 主图：1张正面主花色 + (可选1张开盖展示内部耳机结构)
  if (
    options.moduleType === 'kv_hero' ||
    /开盖|双耳|取出|配对|回连|秒连|弹窗/.test(combinedText)
  ) {
    const openOrEarbud = openCases[0] || singleEarbuds[0];
    if (openOrEarbud && primaryHero && openOrEarbud.id !== primaryHero.id) {
      return [primaryHero, openOrEarbud];
    }
  }

  return [primaryHero];
}

/**
 * 生图前严格收敛并排序投喂给模型的 #Prod 列表：
 * - 锁图微调模式 (`lockResultAsRef`): 最多仅保留 1 张主产品图辅助材质细节（原成图将作为第1高权重视觉锚点）
 * - 普通单品画面：最多保留 2 张互补视角，且最多只允许 1 张 `hero_front`（剔除多余冲突的异款花色正面图）
 * - 全家福/矩阵画面：最多保留 6 张
 */
export function limitAndOrderTaskProdsForRender(
  arg1:
    | {
        boundProds: ReferenceImageItem[];
        allEnabledProds: ReferenceImageItem[];
        moduleType?: DetailModuleType;
        skuDiffMode?: string;
        title?: string;
        prompt?: string;
        isLockRefineMode?: boolean;
      }
    | string[],
  allProdsArg?: ReferenceImageItem[],
  extraOpts?: {
    isLockedRefine?: boolean;
    moduleOrTitleHint?: string;
  }
): ReferenceImageItem[] {
  const resolved = Array.isArray(arg1)
    ? {
        boundProds: arg1
          .map((id) => (allProdsArg || []).find((p) => p.id === id))
          .filter((p): p is ReferenceImageItem => Boolean(p)),
        allEnabledProds: filterEnabledProds(allProdsArg || [], true),
        title: extraOpts?.moduleOrTitleHint || '',
        prompt: extraOpts?.moduleOrTitleHint || '',
        isLockRefineMode: extraOpts?.isLockedRefine,
      }
    : arg1;

  const {
    boundProds,
    allEnabledProds,
    moduleType,
    skuDiffMode,
    title,
    prompt,
    isLockRefineMode,
  } = resolved;

  const baseList =
    boundProds.length > 0
      ? boundProds
      : smartPickComplementaryProds({
          moduleType,
          skuDiffMode,
          title,
          prompt,
          enabledProds: allEnabledProds,
        });

  if (baseList.length === 0) return [];

  // 锁图微调模式下：只保留1张主产品图（优先保留 hero_front 正面花色权威图），避免多张原图拉扯已锁定的成图构图
  if (isLockRefineMode) {
    const primaryHero =
      baseList.find((p) => getEffectiveProdRole(p) === 'hero_front') ||
      baseList[0];
    return [primaryHero];
  }

  const isMatrix = isMultiSkuMatrixContext({
    moduleType,
    skuDiffMode,
    title,
    prompt,
  });

  if (isMatrix) {
    return baseList.slice(0, 6);
  }

  // 非矩阵单品模式：防止多张不同花色的 hero_front 同时投喂导致“两个不同图案充电仓打架/串色变形”
  const selected: ReferenceImageItem[] = [];
  let hasHeroFront = false;

  for (const prod of baseList) {
    const role = getEffectiveProdRole(prod);
    if (role === 'hero_front') {
      if (!hasHeroFront) {
        hasHeroFront = true;
        selected.push(prod);
      }
    } else {
      selected.push(prod);
    }
    if (selected.length >= 2) break;
  }

  // 如果用户绑的全是 hero_front，上面循环只会保留第1张 hero_front；
  // 若画面或参考图需要开盖/单耳而启用池里有对应结构图，智能补齐1张同姿态结构角度图
  const requiredAngle = inferRequiredAngleFromCaseOrText(
    `${title || ''} ${prompt || ''}`
  );
  if (selected.length === 1 && requiredAngle) {
    const exactMatch = allEnabledProds.find(
      (p) =>
        p.id !== selected[0].id && getEffectiveProdRole(p) === requiredAngle
    );
    const fallbackStruct =
      exactMatch ||
      allEnabledProds.find((p) => {
        const r = getEffectiveProdRole(p);
        return (
          p.id !== selected[0].id &&
          (r === 'open_case' || r === 'single_earbud' || r === 'detail_closeup')
        );
      });
    if (fallbackStruct) {
      selected.push(fallbackStruct);
    }
  }

  // 确保单品模式下 hero_front 正面花色图始终排在第1顺位（主视觉与印花权威源），互补结构图排在第2顺位
  selected.sort((a, b) => {
    const aIsHero = getEffectiveProdRole(a) === 'hero_front' ? 0 : 1;
    const bIsHero = getEffectiveProdRole(b) === 'hero_front' ? 0 : 1;
    return aIsHero - bIsHero;
  });

  return selected.slice(0, 2);
}

/**
 * 预检「① 主图/SKU工作台」单张卡片的生图质量风险
 */
export function inspectSkuTaskQuality(
  task: SkuTask,
  allProds: ReferenceImageItem[],
  allCases: ReferenceImageItem[] = []
): TaskQualityInspection {
  const issues: QualityIssueItem[] = [];
  const isMatrix = isMultiSkuMatrixContext({
    skuDiffMode: task.skuDiffMode,
    title: task.skuTitle,
    prompt: task.visualPrompt,
  });
  const recommendedMaxCount = isMatrix ? 6 : 2;

  const boundProds = task.productRefIds
    .map((id) => allProds.find((p) => p.id === id))
    .filter((p): p is ReferenceImageItem => Boolean(p));

  const boundCases = task.caseRefIds
    .map((id) => allCases.find((c) => c.id === id))
    .filter((c): c is ReferenceImageItem => Boolean(c));

  if (boundProds.length === 0 && allProds.length > 0) {
    issues.push({
      code: 'empty_bound_prods',
      severity: 'warn',
      label: '未绑定产品图',
      detail: '当前卡片未指定产品图，生图时将自动兜底取首张启用产品图',
    });
  }

  const disabledBound = boundProds.filter((p) => p.enabled === false);
  if (disabledBound.length > 0) {
    issues.push({
      code: 'disabled_prod_bound',
      severity: 'warn',
      label: `含 ${disabledBound.length} 张未启用素材`,
      detail: '绑定了左侧栏已取消勾选的素材，一键修复可自动替换为已启用素材',
    });
  }

  if (boundProds.length > recommendedMaxCount) {
    issues.push({
      code: 'overbound_prods',
      severity: 'error',
      label: `绑图过多 (${boundProds.length}张 > 建议${recommendedMaxCount}张)`,
      detail:
        '单张卡片同时投喂过多产品图会导致生图模型视角混乱、比例变形或印花串色',
    });
  }

  if (!isMatrix) {
    const heroFrontCount = boundProds.filter(
      (p) => getEffectiveProdRole(p) === 'hero_front'
    ).length;
    if (heroFrontCount > 1) {
      issues.push({
        code: 'conflicting_sku_patterns',
        severity: 'error',
        label: `混绑 ${heroFrontCount} 款正面花色`,
        detail:
          '单品画面同时绑定多张不同正面花色图，极易导致产品主体印花融合错乱或出现多余产品',
      });
    }

    // 检查参考图(#Case)或文案姿态是否需要开盖/单耳，但当前只绑了合盖正面图
    const caseContext = boundCases
      .map((c) => `${c.tag || ''} ${c.caseCustomRule || ''}`)
      .join(' ');
    const neededRole = inferRequiredAngleFromCaseOrText(
      `${caseContext} ${task.skuTitle || ''} ${task.sellingPointBadge || ''} ${task.visualPrompt || ''}`
    );
    if (
      neededRole &&
      (neededRole === 'single_earbud' || neededRole === 'open_case')
    ) {
      const enabledPool = filterEnabledProds(allProds, true);
      const hasRoleInPool = enabledPool.some(
        (p) => getEffectiveProdRole(p) === neededRole
      );
      const hasRoleBound = boundProds.some(
        (p) =>
          getEffectiveProdRole(p) === neededRole ||
          getEffectiveProdRole(p) === 'open_case'
      );
      if (hasRoleInPool && !hasRoleBound) {
        const roleName =
          neededRole === 'single_earbud' ? '单耳特写图' : '开盖展示图';
        issues.push({
          code: 'angle_pose_mismatch',
          severity: 'warn',
          label: `缺互补${roleName}`,
          detail: `参考图或文案涉及${roleName.replace('图', '')}，但当前仅绑定合盖图，一键修复可自动补齐${roleName}防模型臆造结构`,
        });
      }
    }
  }

  if (
    hasInternalCodeLeak(task.visualPrompt) ||
    hasInternalCodeLeak(task.typographyPlan) ||
    hasInternalCodeLeak(task.sellingPointBadge)
  ) {
    issues.push({
      code: 'prompt_code_leak',
      severity: 'error',
      label: '含 #Prod/#Case 内部编号',
      detail:
        '提示词或文案中含 #Prod-X 内部代号，生图模型容易将其当成真实文字印在产品或海报上',
    });
  }

  if (
    hasPillHallucinationRisk(task.visualPrompt) ||
    hasPillHallucinationRisk(task.typographyPlan)
  ) {
    issues.push({
      code: 'pill_hallucination_risk',
      severity: 'warn',
      label: '含“胶囊”易生药丸词',
      detail:
        '描述中含“胶囊”字样，容易触发模型生成3D医药胶囊颗粒，建议转为“浅色圆角信息卡”',
    });
  }

  if (
    hasUnfilledPlaceholder(task.sellingPointBadge) ||
    hasUnfilledPlaceholder(task.skuTitle)
  ) {
    issues.push({
      code: 'unfilled_placeholder',
      severity: 'warn',
      label: '含未填占位符',
      detail: '文案中存在 [核心卖点] 等未替换方括号占位词',
    });
  }

  const hasErrors = issues.some((i) => i.severity === 'error');
  const passed = issues.length === 0;
  const summaryBadge = passed
    ? `✓ 预检通过 · 投喂 ${Math.max(1, Math.min(boundProds.length || 1, recommendedMaxCount))} 张视角`
    : `⚠️ 发现 ${issues.length} 项质量风险`;

  return {
    passed,
    hasErrors,
    boundProdCount: boundProds.length,
    recommendedMaxCount,
    summaryBadge,
    issues,
  };
}

/**
 * 预检「② 详情页工作台」单屏模块的质量风险
 */
export function inspectDetailTaskQuality(
  task: ScreenTask,
  allProds: ReferenceImageItem[]
): TaskQualityInspection {
  const issues: QualityIssueItem[] = [];
  const isMatrix = isMultiSkuMatrixContext({
    moduleType: task.moduleType,
    title: task.title,
    prompt: task.visualPrompt,
  });
  const recommendedMaxCount = isMatrix ? 6 : 2;

  const prodIdSet = new Set(allProds.map((p) => p.id));
  const boundProds = task.referenceImageIds
    .filter((id) => prodIdSet.has(id))
    .map((id) => allProds.find((p) => p.id === id))
    .filter((p): p is ReferenceImageItem => Boolean(p));

  if (boundProds.length === 0 && allProds.length > 0) {
    issues.push({
      code: 'empty_bound_prods',
      severity: 'warn',
      label: '未显式绑定视角图',
      detail:
        '本屏未显式勾选绑定产品视角图，可点击一键配图自动匹配1~2张互补角度',
    });
  }

  const disabledBound = boundProds.filter((p) => p.enabled === false);
  if (disabledBound.length > 0) {
    issues.push({
      code: 'disabled_prod_bound',
      severity: 'warn',
      label: `含 ${disabledBound.length} 张未启用素材`,
      detail: '本屏绑定了左侧栏已取消勾选的素材，建议同步收敛为已启用素材',
    });
  }

  if (boundProds.length > recommendedMaxCount) {
    issues.push({
      code: 'overbound_prods',
      severity: 'error',
      label: `绑图过多 (${boundProds.length}张 > 建议${recommendedMaxCount}张)`,
      detail: `本屏同时绑定了 ${boundProds.length} 张产品图，极易引发多图打架、产品造型扭曲与文字乱码`,
    });
  }

  if (!isMatrix) {
    const heroFrontCount = boundProds.filter(
      (p) => getEffectiveProdRole(p) === 'hero_front'
    ).length;
    if (heroFrontCount > 1) {
      issues.push({
        code: 'conflicting_sku_patterns',
        severity: 'error',
        label: `混绑 ${heroFrontCount} 款正面花色`,
        detail:
          '非矩阵屏同时绑定多张不同花色正面图，会导致生图印花串色或画面出现重复充电仓',
      });
    }

    const neededRole = inferRequiredAngleFromCaseOrText(
      `${task.title || ''} ${task.copywriting || ''} ${task.visualPrompt || ''}`
    );
    if (
      neededRole &&
      (neededRole === 'single_earbud' || neededRole === 'open_case')
    ) {
      const enabledPool = filterEnabledProds(allProds, true);
      const hasRoleInPool = enabledPool.some(
        (p) => getEffectiveProdRole(p) === neededRole
      );
      const hasRoleBound = boundProds.some(
        (p) =>
          getEffectiveProdRole(p) === neededRole ||
          getEffectiveProdRole(p) === 'open_case'
      );
      if (hasRoleInPool && !hasRoleBound) {
        const roleName =
          neededRole === 'single_earbud' ? '单耳特写图' : '开盖展示图';
        issues.push({
          code: 'angle_pose_mismatch',
          severity: 'warn',
          label: `缺互补${roleName}`,
          detail: `本屏描述涉及${roleName.replace('图', '')}，建议补绑${roleName}防模型脑补结构变形`,
        });
      }
    }
  }

  if (
    hasInternalCodeLeak(task.visualPrompt) ||
    hasInternalCodeLeak(task.typographyPlan) ||
    hasInternalCodeLeak(task.copywriting)
  ) {
    issues.push({
      code: 'prompt_code_leak',
      severity: 'error',
      label: '含 #Prod/#Case 内部编号',
      detail:
        '画面描述中残留 #Prod-X 内部编号，会导致生图模型把 "#Prod-2" 直接印在耳机盒或背景上',
    });
  }

  if (
    hasPillHallucinationRisk(task.visualPrompt) ||
    hasPillHallucinationRisk(task.typographyPlan) ||
    hasPillHallucinationRisk(task.copywriting)
  ) {
    issues.push({
      code: 'pill_hallucination_risk',
      severity: 'warn',
      label: '含“胶囊”易生药丸词',
      detail: '含“胶囊”字样易使模型生成3D医药胶囊颗粒，建议净化为“圆角信息栏”',
    });
  }

  if (hasUnfilledPlaceholder(task.copywriting)) {
    issues.push({
      code: 'unfilled_placeholder',
      severity: 'warn',
      label: '含未填占位符',
      detail: '屏内文案含 [核心卖点] 等未替换模板占位词',
    });
  }

  const hasErrors = issues.some((i) => i.severity === 'error');
  const passed = issues.length === 0;
  const summaryBadge = passed
    ? `✓ 预检通过 · 投喂 ${Math.max(1, Math.min(boundProds.length || 1, recommendedMaxCount))} 张视角`
    : `⚠️ ${issues.length} 项冲突待修复`;

  return {
    passed,
    hasErrors,
    boundProdCount: boundProds.length,
    recommendedMaxCount,
    summaryBadge,
    issues,
  };
}

/**
 * 一键自动修复「① 主图/SKU工作台」单张卡片的配图冲突与提示词污染
 */
export function autoFixSkuTaskQuality(
  task: SkuTask,
  allProds: ReferenceImageItem[],
  allCases: ReferenceImageItem[] = []
): SkuTask {
  const enabledProds = filterEnabledProds(allProds, true);
  const currentBound = task.productRefIds
    .map((id) => allProds.find((p) => p.id === id))
    .filter((p): p is ReferenceImageItem => Boolean(p && p.enabled !== false));

  const caseHint = task.caseRefIds
    .map((id) => allCases.find((c) => c.id === id))
    .filter(Boolean)
    .map((c) => `${c?.tag || ''} ${c?.caseCustomRule || ''}`)
    .join(' ');

  const optimalProds = limitAndOrderTaskProdsForRender({
    boundProds: currentBound,
    allEnabledProds: enabledProds,
    skuDiffMode: task.skuDiffMode,
    title: `${task.skuTitle || ''} ${caseHint}`,
    prompt: `${task.visualPrompt || ''} ${task.sellingPointBadge || ''}`,
    isLockRefineMode: Boolean(task.lockResultAsRef && task.resultImageUrl),
  });

  const fallbackProds =
    optimalProds.length > 0
      ? optimalProds
      : smartPickComplementaryProds({
          skuDiffMode: task.skuDiffMode,
          title: `${task.skuTitle || ''} ${caseHint}`,
          prompt: `${task.visualPrompt || ''} ${task.sellingPointBadge || ''}`,
          enabledProds,
        });

  return {
    ...task,
    productRefIds: fallbackProds.map((p) => p.id),
    visualPrompt: sanitizeVisualPromptForRender(task.visualPrompt),
    typographyPlan: sanitizeVisualPromptForRender(task.typographyPlan),
    sellingPointBadge: sanitizeCopywritingForRender(task.sellingPointBadge),
  };
}

/**
 * 一键自动修复「② 详情页工作台」单屏模块的配图冲突与提示词污染
 */
export function autoFixDetailTaskQuality(
  task: ScreenTask,
  allProds: ReferenceImageItem[]
): ScreenTask {
  const enabledProds = filterEnabledProds(allProds, true);
  const prodIdSet = new Set(allProds.map((p) => p.id));
  const nonProdRefIds = task.referenceImageIds.filter(
    (id) => !prodIdSet.has(id)
  );

  const currentBoundProds = task.referenceImageIds
    .filter((id) => prodIdSet.has(id))
    .map((id) => allProds.find((p) => p.id === id))
    .filter((p): p is ReferenceImageItem => Boolean(p && p.enabled !== false));

  const optimalProds = limitAndOrderTaskProdsForRender({
    boundProds: currentBoundProds,
    allEnabledProds: enabledProds,
    moduleType: task.moduleType,
    title: task.title,
    prompt: `${task.visualPrompt || ''} ${task.copywriting || ''}`,
    isLockRefineMode: Boolean(task.lockResultAsRef && task.resultImageUrl),
  });

  const fallbackProds =
    optimalProds.length > 0
      ? optimalProds
      : smartPickComplementaryProds({
          moduleType: task.moduleType,
          title: task.title,
          prompt: `${task.visualPrompt || ''} ${task.copywriting || ''}`,
          enabledProds,
        });

  return {
    ...task,
    referenceImageIds: [...fallbackProds.map((p) => p.id), ...nonProdRefIds],
    visualPrompt: sanitizeVisualPromptForRender(task.visualPrompt),
    typographyPlan: sanitizeVisualPromptForRender(task.typographyPlan),
    copywriting: sanitizeCopywritingForRender(task.copywriting),
  };
}

const ROLE_DISPLAY_LABEL: Record<ProductAngleRole, string> = {
  hero_front: '正面印花/主视',
  open_case: '开盖展示',
  single_earbud: '单耳特写',
  detail_closeup: '细节微距',
  multi_sku: '多色全家福',
  package_accessory: '包装配件',
};

/**
 * 构建「① 主图/SKU工作台」单张卡片的【生图前真实投喂透视报告】
 */
export function buildSkuPayloadPreview(options: {
  task: SkuTask;
  allProds: ReferenceImageItem[];
  allCases: ReferenceImageItem[];
  globalReferenceInfoText?: string;
  defaultFidelity?: string;
  defaultStyleLinkageMode?: string;
}): TaskPayloadInspection {
  const {
    task,
    allProds,
    allCases,
    globalReferenceInfoText = '',
    defaultFidelity = 'high_replica',
    defaultStyleLinkageMode = 'print_4d',
  } = options;

  const isLockedRefine = Boolean(task.lockResultAsRef && task.resultImageUrl);
  const effectiveFidelity = task.replicaFidelity || defaultFidelity;
  const isStyleRef =
    effectiveFidelity === 'style_ref' ||
    effectiveFidelity === 'style_reference';
  const effectiveLinkage =
    task.styleLinkageMode || defaultStyleLinkageMode || 'print_4d';

  const matchedProds = allProds.filter((r) =>
    task.productRefIds.includes(r.id)
  );
  const rawEffectiveProds =
    matchedProds.length > 0
      ? matchedProds
      : filterEnabledProds(allProds, true).slice(0, 1);

  const primaryCase =
    allCases.find((r) => task.caseRefIds.includes(r.id)) ||
    allCases[
      Math.max(0, (task.skuIndex || 1) - 1) % Math.max(1, allCases.length)
    ];

  const effectiveProds = limitAndOrderTaskProdsForRender(
    rawEffectiveProds.map((p) => p.id),
    allProds,
    {
      isLockedRefine,
      moduleOrTitleHint: `${task.skuTitle || ''} ${task.sellingPointBadge || ''} ${primaryCase?.tag || ''} ${primaryCase?.caseCustomRule || ''} ${task.visualPrompt || ''}`,
    }
  );

  const imageSlots: PayloadPreviewImageSlot[] = [];

  if (isLockedRefine && task.resultImageUrl) {
    imageSlots.push({
      order: 1,
      roleBadge: '顺位 #1 · 锁定成图视觉基准 (最高权重)',
      weightLevel: 'highest',
      previewUrl: task.resultImageUrl,
      code: `Locked-#${String(task.skuIndex).padStart(2, '0')}`,
      tag: '当前已锁定的满意成图',
      angleRoleLabel: '构图与光影100%锚定',
      ruleDesc:
        '作为第1张基准图喂入，强制保持当前构图、机位与主色调95%以上不变，仅执行局部微调或改字指令，并自动屏蔽原竞品参考图防跑偏',
    });
  }

  effectiveProds.forEach((prod, idx) => {
    const role = getEffectiveProdRole(prod);
    const isPrimary = idx === 0;
    imageSlots.push({
      order: imageSlots.length + 1,
      roleBadge: isPrimary
        ? `顺位 #${imageSlots.length + 1} · 1:1产品几何与印花权威源`
        : `顺位 #${imageSlots.length + 1} · 互补结构角度防脑补参考`,
      weightLevel: isPrimary ? 'highest' : 'high',
      previewUrl: prod.previewUrl,
      code: prod.code || `Prod-${idx + 1}`,
      tag: prod.tag || prod.name,
      angleRoleLabel: ROLE_DISPLAY_LABEL[role] || '正面主视',
      ruleDesc: isPrimary
        ? '100% 锁定我方产品的真实盒型比例、圆角曲率、开合线与壳面印花图案，严禁生图模型重绘篡改'
        : '提供真实的开盖内舱或单耳结构参考，防止模型因看不见侧面/内部而胡乱脑补变形',
    });
  });

  if (!isLockedRefine && primaryCase) {
    imageSlots.push({
      order: imageSlots.length + 1,
      roleBadge: `顺位 #${imageSlots.length + 1} · ${
        isStyleRef ? '光影氛围与版式灵感参考' : '1:1构图机位与版式骨架参考'
      }`,
      weightLevel: 'medium',
      previewUrl: primaryCase.previewUrl,
      code: primaryCase.code || 'Case-1',
      tag: primaryCase.tag || primaryCase.name,
      angleRoleLabel: isStyleRef ? '仅参色调风格' : '参构图与版式',
      ruleDesc: isStyleRef
        ? '仅提取该参考图的光影质感与视觉层级，严禁照搬参考图内的竞品外观或旧文字'
        : '提取相机俯仰角、产品占比与标题排版骨架，将画面中的旧商品 100% 替换为我方产品原图',
    });
  }

  const sanitizedCopywriting = sanitizeCopywritingForRender(
    Array.from(
      new Set(
        [
          task.skuTitle?.trim(),
          task.sellingPointBadge?.trim(),
          task.packageSpecNote?.trim(),
        ].filter(Boolean)
      )
    ).join('\n')
  );

  const rawPrompt = (
    task.visualPrompt ||
    globalReferenceInfoText ||
    (isStyleRef
      ? '借鉴参考图的色彩调性、光影质感与版式风格，围绕我方产品原图构建高转化商业电商场景。'
      : '1:1高度复刻参考图的相机视角、构图布局与文字版式，将商品主体100%替换为我方产品原图并和谐全图色调。')
  ).trim();

  const sanitizedPrompt = sanitizeVisualPromptForRender(rawPrompt, allProds);
  const themeSummary =
    effectiveLinkage === 'print_4d' && task.printThemeConfig?.enabled !== false
      ? `\n【印花4维联动强约束】：色板=${task.printThemeConfig?.themePalette || '马卡龙浅色同色系'} ｜ 底座=${task.printThemeConfig?.themeStage || '圆润潮玩底座'} ｜ 装饰=${task.printThemeConfig?.themeElements || '呼应印花微缩元素'} ｜ 信息卡=${task.printThemeConfig?.themeUiStyle || '通透浅色圆角信息卡（严禁黑棕底框）'}`
      : '';
  const refineSummary =
    isLockedRefine && task.refineInstruction
      ? `\n【🔒 锁图局部微调最高指令】：${task.refineInstruction}`
      : '';

  const compiledPositivePrompt = `${sanitizedPrompt}${themeSummary}${refineSummary}`.trim();

  const activeGuardrails = [
    `✓ 单次投喂收敛保护：仅投喂 ${effectiveProds.length} 张互补产品图，自动隔离其余 ${Math.max(0, allProds.length - effectiveProds.length)} 张无关花色/角度图`,
    '✓ 工业几何与印花锁定：严禁改变耳机仓长宽比、指示灯孔位与壳面卡通印花细节',
    '✓ 净网防印字过滤：已自动剥离 #Prod-X / #Case-X 内部编号，杜绝模型把代号印在产品上',
    '✓ 浅色圆角卡与反药丸护栏：强制使用浅色圆角信息卡，严禁生成黑棕死板底框或3D医药胶囊颗粒',
  ];

  const qualityInspection = inspectSkuTaskQuality(task, allProds, allCases);

  return {
    taskId: task.id,
    taskTitle: task.skuTitle || `主图 #${String(task.skuIndex).padStart(2, '0')}`,
    modeLabel: isLockedRefine
      ? '🔒 锁图微调模式 (高权重成图锚定)'
      : isStyleRef
        ? '✨ 参考风格模式 (创意重排)'
        : '🎯 高度复刻模式 (锁构图版式)',
    aspectRatio: task.aspectRatio,
    imageSize: task.imageSize,
    imageSlots,
    filteredOutCount: Math.max(0, allProds.length - effectiveProds.length),
    sanitizedCopywriting,
    compiledPositivePrompt,
    activeGuardrails,
    qualityInspection,
  };
}

/**
 * 构建「② 详情页工作台」单屏模块的【生图前真实投喂透视报告】
 */
export function buildDetailPayloadPreview(options: {
  task: ScreenTask;
  allProds: ReferenceImageItem[];
  unifiedVisualSpec?: string;
}): TaskPayloadInspection {
  const { task, allProds, unifiedVisualSpec = '' } = options;
  const isLockedRefine = Boolean(task.lockResultAsRef && task.resultImageUrl);

  const prodIdSet = new Set(allProds.map((p) => p.id));
  const rawBoundIds = task.referenceImageIds.filter((id) => prodIdSet.has(id));
  const effectiveProds = limitAndOrderTaskProdsForRender(
    rawBoundIds,
    allProds,
    {
      isLockedRefine,
      moduleOrTitleHint: `${task.moduleType || ''} ${task.title || ''} ${task.visualPrompt || ''}`,
    }
  );

  const imageSlots: PayloadPreviewImageSlot[] = [];

  if (isLockedRefine && task.resultImageUrl) {
    imageSlots.push({
      order: 1,
      roleBadge: '顺位 #1 · 锁定本屏成图基准 (最高权重)',
      weightLevel: 'highest',
      previewUrl: task.resultImageUrl,
      code: `Locked-S${String(task.screenNumber).padStart(2, '0')}`,
      tag: '当前已锁定的本屏满意成图',
      angleRoleLabel: '构图与版式100%锚定',
      ruleDesc:
        '作为第1张最高权重参考图喂入，锁定本屏构图、产品姿态与光影，仅执行局部改字或微调指令',
    });
  } else if (task.sourceReplicaImageUrl) {
    imageSlots.push({
      order: 1,
      roleBadge: '顺位 #1 · 主图同源视觉基准锚点',
      weightLevel: 'high',
      previewUrl: task.sourceReplicaImageUrl,
      code: 'Hero-Anchor',
      tag: '来自主图工作台的满意成图',
      angleRoleLabel: '同源色调与展台延展',
      ruleDesc:
        '继承主图已验证的潮玩底座材质、背景色板与光影氛围，纵向延展为详情页竖屏版式',
    });
  }

  effectiveProds.forEach((prod, idx) => {
    const role = getEffectiveProdRole(prod);
    const isPrimary = idx === 0;
    imageSlots.push({
      order: imageSlots.length + 1,
      roleBadge: isPrimary
        ? `顺位 #${imageSlots.length + 1} · 1:1产品几何与印花权威源`
        : `顺位 #${imageSlots.length + 1} · 互补视角结构参考`,
      weightLevel: isPrimary ? 'highest' : 'high',
      previewUrl: prod.previewUrl,
      code: prod.code || `Prod-${idx + 1}`,
      tag: prod.tag || prod.name,
      angleRoleLabel: ROLE_DISPLAY_LABEL[role] || '正面主视',
      ruleDesc: isPrimary
        ? '严格锚定我方产品真实外观比例与壳面图案，0竞品原图干扰，杜绝产品变形'
        : '提供互补角度（开盖/单耳/微距）结构细节，防止模型脑补不存在的耳机部件',
    });
  });

  const sanitizedCopywriting = sanitizeCopywritingForRender(
    task.copywriting || task.typographyPlan || ''
  );
  const sanitizedPrompt = sanitizeVisualPromptForRender(
    task.visualPrompt || '',
    allProds
  );

  const specSummary = unifiedVisualSpec.trim()
    ? `\n【整页6锚点统一视觉规范】：${unifiedVisualSpec.trim().slice(0, 220)}${unifiedVisualSpec.trim().length > 220 ? '...' : ''}`
    : '';
  const themeSummary =
    task.printThemeConfig && task.printThemeConfig.enabled !== false
      ? `\n【本屏印花4维联动】：色板=${task.printThemeConfig.themePalette || ''} ｜ 底座=${task.printThemeConfig.themeStage || ''} ｜ 元素=${task.printThemeConfig.themeElements || ''} ｜ 信息卡=${task.printThemeConfig.themeUiStyle || '浅色圆角信息卡'}`
      : '';
  const userNoteSummary = task.userNote?.trim()
    ? `\n【补充微调要求】：${ sanitizeVisualPromptForRender(task.userNote.trim(), allProds) }`
    : '';
  const refineSummary =
    isLockedRefine && task.refineInstruction
      ? `\n【🔒 锁图局部微调最高指令】：${task.refineInstruction}`
      : '';

  const compiledPositivePrompt = `${sanitizedPrompt}${specSummary}${themeSummary}${userNoteSummary}${refineSummary}`.trim();

  const activeGuardrails = [
    `✓ 零竞品图干扰 + 严控张数：本屏仅投喂 ${effectiveProds.length} 张自有产品图，已自动过滤其余 ${Math.max(0, allProds.length - effectiveProds.length)} 张素材`,
    '✓ 净网防印字过滤：已自动清除 #Prod-X / #Case-X 内部代号，防止编号被印入画面',
    '✓ 反黑框与反药丸护栏：强制采用浅色半透明圆角信息卡，严禁生硬黑棕底框与3D医药胶囊',
    '✓ 三段式黄金版式护栏：上22%大标题呼吸区 + 中54%产品主体高光区 + 下24%圆角卖点卡',
  ];

  const qualityInspection = inspectDetailTaskQuality(task, allProds);

  return {
    taskId: task.id,
    taskTitle: `第 ${String(task.screenNumber).padStart(2, '0')} 屏 · ${task.title}`,
    modeLabel: isLockedRefine
      ? '🔒 锁图微调模式 (高权重成图锚定)'
      : task.sourceReplicaImageUrl
        ? '🔗 主图同源延展模式 (色调展台锁定)'
        : '📐 统一规范驱动模式 (0竞品图干扰)',
    aspectRatio: task.aspectRatio,
    imageSize: task.imageSize,
    imageSlots,
    filteredOutCount: Math.max(0, allProds.length - effectiveProds.length),
    sanitizedCopywriting,
    compiledPositivePrompt,
    activeGuardrails,
    qualityInspection,
  };
}

export interface QuickRefineRescueChip {
  id: string;
  label: string;
  directive: string;
}

export const QUICK_REFINE_RESCUE_CHIPS: QuickRefineRescueChip[] = [
  {
    id: 'fix_print_geometry',
    label: '🎯 强修印花与机身还原',
    directive:
      '保持当前构图、光影与背景100%不变，严格按第1张产品原图重新高精还原充电仓机身圆角比例与壳面卡通印花细节，消除印花模糊与形变',
  },
  {
    id: 'fix_typography_only',
    label: '📝 仅重绘标题文字清晰度',
    directive:
      '保持当前产品主体、底座与背景元素100%锁定不动，仅重新清晰渲染顶部主副标题与底部圆角信息卡文字，消除文字笔画粘连与乱码',
  },
  {
    id: 'remove_extra_clutter',
    label: '🚫 清除多余悬浮耳机/杂物',
    directive:
      '保持核心产品主体与主构图不变，彻底清除画面中多余悬浮的重复耳机、散落杂乱小零件与遮挡产品的碎屑光斑，让视觉焦点更干净纯粹',
  },
  {
    id: 'replace_dark_box_with_light_card',
    label: '🎨 换浅色通透圆角信息卡',
    directive:
      '保持产品主体与构图不变，将画面中生硬的深色/黑棕底色方框或3D药丸胶囊替换为与背景同色系的浅奶油色半透明磨砂圆角信息卡',
  },
  {
    id: 'boost_pastel_lighting',
    label: '✨ 提亮产品光影与通透感',
    directive:
      '保持产品造型与文字排版不变，去除画面暗沉灰雾感，提亮马卡龙浅色背景的通透果冻光泽与产品边缘商业柔光轮廓',
  },
];

export function toggleRefineChipInstruction(
  currentText: string | undefined,
  chipDirective: string
): string {
  const cur = (currentText || '').trim();
  if (!cur) return chipDirective;
  if (cur.includes(chipDirective)) {
    return cur
      .replace(chipDirective, '')
      .replace(/[；;，,\s]{2,}/g, '；')
      .replace(/^[；;，,\s]+|[；;，,\s]+$/g, '')
      .trim();
  }
  return `${cur}；${chipDirective}`;
}


