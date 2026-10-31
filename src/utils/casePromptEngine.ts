import {
  AspectRatioOption,
  CaseRefDimension,
  DetectedCaseSubScreen,
  FlattenedLogicalScreenItem,
  ImageSizeOption,
  ReferenceImageItem,
  ScreenLayerType,
  ScreenTask,
  SkuTask,
  TextRenderMode,
} from '../types';

export function formatSubScreenRegionLabel(
  subScreenIndex: number,
  subScreenTotal: number
): string {
  if (subScreenTotal <= 1) return '整屏';
  if (subScreenTotal === 2) {
    return subScreenIndex === 1 ? '上半屏 (1/2)' : '下半屏 (2/2)';
  }
  if (subScreenTotal === 3) {
    if (subScreenIndex === 1) return '上段 (1/3)';
    if (subScreenIndex === 2) return '中段 (2/3)';
    return '下段 (3/3)';
  }
  return `子屏 ${subScreenIndex}/${subScreenTotal}`;
}

const DEFAULT_SUBSCREEN_TITLES = [
  'KV爆款首屏·品牌视觉旗舰登场',
  '核心结构拆解·匠心材质与内里解析',
  '王牌性能实测·沉浸式功能体验',
  '人体工学设计·舒适贴合使用体验',
  '旗舰技术加持·高效稳定核心表现',
  '持久耐用表现·全天候安心相伴',
  '多款高颜值花色·专属定制款式合集',
  '贴心细节设计·多场景随心适配',
  '匠心工艺品质·多角度实拍特写',
  '官方核心参数表与包装清单',
];

/**
 * Splits a multi-part extractedLayoutDna or tag into K sub-screen items when expanding a single #Case slice.
 */
function buildSubScreensForCaseSlice(
  c: ReferenceImageItem,
  subCount: number,
  globalStartIdx0: number
): DetectedCaseSubScreen[] {
  const count = Math.max(1, subCount);
  const baseTag = (c.tag || c.name || '').replace(/^第\s*\d+\s*屏\s*[·•-]?\s*/i, '').trim();
  const baseDna = (c.extractedLayoutDna || '').trim();

  if (count === 1) {
    return [
      {
        subScreenIndex: 1,
        subScreenTotal: 1,
        regionLabel: '整屏',
        title: baseTag || DEFAULT_SUBSCREEN_TITLES[globalStartIdx0 % DEFAULT_SUBSCREEN_TITLES.length],
        sectionType: baseTag.split(/[+·•\s]/)[0] || '核心卖点展示',
        extractedLayoutDna:
          baseDna ||
          `【模块定位】${baseTag || '核心卖点展示'}；【信息分区与留白规律】上部标题区+中部商品主视觉区+底部卖点信息区，四周留白≥8%`,
      },
    ];
  }

  // Check if baseTag has "+" or "/" or "｜" separated sub-modules
  const tagParts = baseTag
    .split(/[+｜|、/]/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 2);

  return Array.from({ length: count }, (_, subIdx) => {
    const subScreenIndex = subIdx + 1;
    const regionLabel = formatSubScreenRegionLabel(subScreenIndex, count);
    const globalScreenIdx0 = globalStartIdx0 + subIdx;
    const fallbackTitle =
      DEFAULT_SUBSCREEN_TITLES[globalScreenIdx0 % DEFAULT_SUBSCREEN_TITLES.length];
    const partHint = tagParts[subIdx] || (subIdx === 0 && baseTag ? baseTag : '');
    const title = partHint
      ? count > 1 && tagParts.length < count
        ? `${partHint}（${regionLabel.replace(/\s*\([^)]*\)/, '')}）`
        : partHint
      : fallbackTitle;

    return {
      subScreenIndex,
      subScreenTotal: count,
      regionLabel,
      title,
      sectionType: title.split(/[·•\s]/)[0] || '核心卖点模块',
      extractedLayoutDna: baseDna
        ? `【所属切片区域：#${c.code} ${regionLabel}】${baseDna}`
        : `【模块定位】${title}（源自 #${c.code} ${regionLabel}）；【信息分区与留白规律】上部主副标题区+中部商品主视觉展示区+底部卖点信息区，四周保留≥8%呼吸安全留白`,
    };
  });
}

/**
 * Flattens all #Case reference slices into an ordered 1..N logical screen list.
 * - If `detectedSubScreens` are already populated on `caseRefs`, flattens them in sequential order.
 * - Otherwise, if `targetScreenCount` > `caseRefs.length`, proportionally distributes `targetScreenCount`
 *   across the `caseRefs` slices (e.g. 4 slices -> 10 screens: 3 + 2 + 3 + 2) so screens never pile onto the last slice.
 */
export function flattenCaseLogicalScreens(
  caseRefs: ReferenceImageItem[],
  targetScreenCount?: number
): FlattenedLogicalScreenItem[] {
  if (!caseRefs || caseRefs.length === 0) return [];

  const hasExplicitSubScreens = caseRefs.some(
    (c) => Array.isArray(c.detectedSubScreens) && c.detectedSubScreens.length > 0
  );

  const flattened: FlattenedLogicalScreenItem[] = [];

  if (hasExplicitSubScreens) {
    for (const c of caseRefs) {
      const subs =
        Array.isArray(c.detectedSubScreens) && c.detectedSubScreens.length > 0
          ? c.detectedSubScreens
          : buildSubScreensForCaseSlice(c, 1, flattened.length);
      const totalInSlice = subs.length;
      subs.forEach((sub, idx) => {
        const subIdx = idx + 1;
        flattened.push({
          screenNumber: flattened.length + 1,
          sourceCaseId: c.id,
          sourceCaseCode: c.code || `Case-${ idx + 1 }`,
          subScreenIndex: subIdx,
          subScreenTotal: totalInSlice,
          regionLabel:
            sub.regionLabel || formatSubScreenRegionLabel(subIdx, totalInSlice),
          title:
            (sub.title || '').replace(/^第\s*\d+\s*屏\s*[·•-]?\s*/i, '').trim() ||
            DEFAULT_SUBSCREEN_TITLES[flattened.length % DEFAULT_SUBSCREEN_TITLES.length],
          sectionType: sub.sectionType,
          extractedLayoutDna: sub.extractedLayoutDna || c.extractedLayoutDna || '',
        });
      });
    }
    return flattened;
  }

  // No explicit subScreens yet: check if we should proportionally expand across slices
  const effectiveTarget =
    typeof targetScreenCount === 'number' && targetScreenCount > caseRefs.length
      ? Math.min(20, Math.max(caseRefs.length, targetScreenCount))
      : caseRefs.length;

  const M = caseRefs.length;
  for (let i = 0; i < M; i++) {
    const c = caseRefs[i];
    const startScreen = Math.round((i * effectiveTarget) / M);
    const endScreen = Math.round(((i + 1) * effectiveTarget) / M);
    const subCount = Math.max(1, endScreen - startScreen);
    const subs = buildSubScreensForCaseSlice(c, subCount, flattened.length);
    subs.forEach((sub, sIdx) => {
      flattened.push({
        screenNumber: flattened.length + 1,
        sourceCaseId: c.id,
        sourceCaseCode: c.code || `Case-${i + 1}`,
        subScreenIndex: sIdx + 1,
        subScreenTotal: subs.length,
        regionLabel: sub.regionLabel,
        title: sub.title,
        sectionType: sub.sectionType,
        extractedLayoutDna: sub.extractedLayoutDna,
      });
    });
  }

  return flattened;
}

/**
 * Expands or contracts an existing FlattenedLogicalScreenItem[] list to match `targetCount` (e.g., 10 screens),
 * preserving existing edited titles/DNA and distributing sub-screens evenly across #Case slices.
 */
export function expandFlattenedScreensToTargetCount(
  currentList: FlattenedLogicalScreenItem[],
  caseRefs: ReferenceImageItem[],
  targetCount: number
): FlattenedLogicalScreenItem[] {
  const safeTarget = Math.max(1, Math.min(20, targetCount));
  if (caseRefs.length === 0) return currentList.slice(0, safeTarget);

  if (currentList.length === safeTarget) {
    return currentList.map((item, idx) => ({
      ...item,
      screenNumber: idx + 1,
    }));
  }

  // Proportionally allocate safeTarget screens across caseRefs[0..M-1]
  const M = caseRefs.length;
  const existingByCase = new Map<string, FlattenedLogicalScreenItem[]>();
  for (const item of currentList) {
    const arr = existingByCase.get(item.sourceCaseId) || [];
    arr.push(item);
    existingByCase.set(item.sourceCaseId, arr);
  }

  const nextList: FlattenedLogicalScreenItem[] = [];
  for (let i = 0; i < M; i++) {
    const c = caseRefs[i];
    const startScreen = Math.round((i * safeTarget) / M);
    const endScreen = Math.round(((i + 1) * safeTarget) / M);
    const desiredSubCount = Math.max(
      i === M - 1 ? Math.max(0, safeTarget - nextList.length) : 1,
      endScreen - startScreen
    );
    if (desiredSubCount <= 0) continue;

    const existingSubs = existingByCase.get(c.id) || [];
    const generatedFallback = buildSubScreensForCaseSlice(
      c,
      desiredSubCount,
      nextList.length
    );

    for (let sIdx = 0; sIdx < desiredSubCount; sIdx++) {
      if (nextList.length >= safeTarget) break;
      const existingSub = existingSubs[sIdx];
      const fallbackSub = generatedFallback[sIdx];
      const subNumber = sIdx + 1;
      const regionLabel = formatSubScreenRegionLabel(subNumber, desiredSubCount);
      nextList.push({
        screenNumber: nextList.length + 1,
        sourceCaseId: c.id,
        sourceCaseCode: c.code || `Case-${i + 1}`,
        subScreenIndex: subNumber,
        subScreenTotal: desiredSubCount,
        regionLabel,
        title: existingSub?.title || fallbackSub.title,
        sectionType: existingSub?.sectionType || fallbackSub.sectionType,
        extractedLayoutDna:
          existingSub?.extractedLayoutDna || fallbackSub.extractedLayoutDna,
      });
    }
  }

  return nextList;
}

/**
 * Writes the user-confirmed FlattenedLogicalScreenItem[] list back into `referenceImages` (`detectedSubScreens`).
 */
export function syncFlattenedScreensBackToCases(
  allRefs: ReferenceImageItem[],
  confirmedScreens: FlattenedLogicalScreenItem[]
): ReferenceImageItem[] {
  const byCaseId = new Map<string, FlattenedLogicalScreenItem[]>();
  for (const item of confirmedScreens) {
    const list = byCaseId.get(item.sourceCaseId) || [];
    list.push(item);
    byCaseId.set(item.sourceCaseId, list);
  }

  return allRefs.map((ref) => {
    if (ref.category !== 'case') return ref;
    const grouped = byCaseId.get(ref.id);
    if (!grouped || grouped.length === 0) {
      return {
        ...ref,
        detectedSubScreens: [],
      };
    }
    const total = grouped.length;
    const detectedSubScreens: DetectedCaseSubScreen[] = grouped.map((g, idx) => {
      const subIdx = idx + 1;
      const cleanTitle =
        (g.title || '').replace(/^第\s*\d+\s*屏\s*[·•-]?\s*/i, '').trim() ||
        `子屏${subIdx}`;
      return {
        subScreenIndex: subIdx,
        subScreenTotal: total,
        regionLabel: formatSubScreenRegionLabel(subIdx, total),
        title: cleanTitle,
        sectionType: g.sectionType || cleanTitle.split(/[·•\s]/)[0],
        extractedLayoutDna: g.extractedLayoutDna || ref.extractedLayoutDna || '',
      };
    });

    const summaryTag =
      total === 1
        ? `第${grouped[0].screenNumber}屏·${detectedSubScreens[0].title}`
        : `含${total}屏(第${grouped[0].screenNumber}~${grouped[grouped.length - 1].screenNumber}屏)·${detectedSubScreens
            .map((s) => s.title.split(/[·•\s]/)[0])
            .join('+')}`;

    return {
      ...ref,
      tag: summaryTag.slice(0, 42),
      detectedSubScreens,
    };
  });
}

/**
 * Strips accidental leading "/" or "|" inside subtitle quotes or after 副标题 label.
 */
export function stripLeadingSubtitleSlash(text: string | undefined): string {
  if (!text) return '';
  return text
    .replace(/(副标题[：:\s]*[“"「『]?)\s*[/｜|]\s*/g, '$1')
    .replace(/([“"「『])\s*[/｜|]\s*(?=[\u4e00-\u9fa5A-Za-z0-9])/g, '$1');
}

/**
 * Checks whether a reference image item represents a promoted First-Card Master Template (#Case).
 */
export function isMasterCaseReference(c: ReferenceImageItem): boolean {
  const idStr = (c.id || '').toLowerCase();
  const labelStr = `${c.tag || ''} ${c.name || ''}`;
  return (
    idStr.includes('case-master') ||
    /首卡定标母版|首卡母版|定标母版/.test(labelStr)
  );
}

/**
 * Checks whether a reference image item has explicit Lock-Base Swap enabled
 * (either via `isLockBaseSwap === true` or promoted First-Card Master Template).
 */
export function isExplicitLockBaseSwapCase(c?: ReferenceImageItem): boolean {
  if (!c) return false;
  return Boolean(c.isLockBaseSwap) || isMasterCaseReference(c);
}

/**
 * Strips concrete competitor scene objects/props/IP icons from a scene description
 * so that `style` (环境背景) only retains scene category, material texture, and form language
 * for fresh set re-design (unless explicit Lock-Base Swap is active).
 */
export function abstractScenePropsForRedesign(text: string): string {
  if (!text) return '';
  return text
    .replace(/欧式罗马柱拱门|罗马柱拱门|迷你石柱/g, '现代几何立体展台结构')
    .replace(/以横置手机屏幕作为天然矩形画框衬托前景主体/g, '以极简几何背板衬托前景主体')
    .replace(/横置智能手机游戏画面|横置手机屏幕/g, '极简科技感几何背景层次')
    .replace(/搭配迷你石柱与礼盒道具|蓝黄礼盒|礼盒道具/g, '搭配极简同色系几何体块装饰')
    .replace(/米奇公仔|米奇老鼠头|米奇角标|维尼熊|迪士尼/g, '极简几何点缀')
    .replace(/外籍女模特|外籍模特/g, '清爽现代商业人像或极简几何耳廓展示台');
}

/**
 * Filters a reverse-engineered single-screen layout DNA string (`extractedLayoutDna`)
 * strictly according to the user's selected `caseDimensions` (and whether explicit `isLockBaseSwap` is on).
 *
 * Six Dimension Semantics (Analysis Stage Only):
 * - pose (主体姿态): 提取朝向、摆放及组合关系，不继承竞品身份和外形
 * - style (环境背景): 提取场景类型、材质与造型语言，具体布景重新设计
 * - structure (版式骨架): 提取信息分区、主次、图文占比和留白规律，不复制元素坐标及完整构图
 * - content (文案版式): 提取字体性格、字号层级、对齐和间距，不提取文字内容
 * - copy_text (文案内容): 提取卖点主题和表达结构，依据自有产品资料重写，不移植竞品参数与承诺
 * - lighting (光影色调): 提取光向、软硬、反差及色彩关系，不继承场景物件
 */
export function filterExtractedDnaByDimensions(
  dna: string | undefined,
  rawDims: CaseRefDimension[] | string[] | undefined,
  isLockBaseSwap = false
): string {
  const raw = (dna || '').trim();
  if (!raw) return '';

  if (isLockBaseSwap) {
    return raw;
  }

  const dims: string[] =
    Array.isArray(rawDims) && rawDims.length > 0
      ? rawDims
      : ['style', 'structure', 'content', 'lighting'];

  const hasPose = dims.includes('pose');
  const hasStyle = dims.includes('style');
  const hasStructure = dims.includes('structure');
  const hasContent = dims.includes('content');
  const hasCopyText = dims.includes('copy_text');
  const hasLighting = dims.includes('lighting');

  if (
    !hasPose &&
    !hasStyle &&
    !hasStructure &&
    !hasContent &&
    !hasCopyText &&
    !hasLighting
  ) {
    return '';
  }

  const taggedBlocks = raw.match(/【[^】]+】[^【]*/g);
  if (taggedBlocks && taggedBlocks.length > 0) {
    const keptBlocks: string[] = [];
    for (const block of taggedBlocks) {
      const m = block.match(/^【([^】]+)】([\s\S]*)$/);
      if (!m) continue;
      const header = m[1].trim();
      let body = m[2].trim();

      // 1. copy_text: 模块定位 / 卖点主题 / 表达结构 / 文案内容
      if (/模块定位|卖点主题|表达结构|文案内容/.test(header)) {
        if (hasCopyText) {
          keptBlocks.push(`【模块定位与卖点表达结构】${body}`);
        }
        continue;
      }

      // 2. structure: 几何分区 / 信息分区 / 留白规律 / 版式骨架 / 画面构图
      if (/几何分区|信息分区|留白规律|版式骨架|画面构图/.test(header)) {
        if (hasStructure) {
          if (!hasStyle) {
            body = body
              .replace(/微缩桌面主视觉区/g, '下部核心商品主视觉区')
              .replace(/模特佩戴特写区/g, '中部核心产品展示主视觉区')
              .replace(/拱门内/g, '上部区域');
          }
          keptBlocks.push(`【信息分区与留白规律】${body}`);
        }
        continue;
      }

      // 3. content: UI容器 / 辅助图形 / 字体 / 文字排版 / 文案版式 / 排版层级 / 字号 / 对齐
      if (/UI容器|辅助图形|字体|文字排版|文案版式|排版层级|字号|对齐/.test(header)) {
        if (hasContent) {
          keptBlocks.push(`【字体性格与排版层级】${abstractScenePropsForRedesign(body)}`);
        }
        continue;
      }

      // 4. Combined style + lighting header: 环境光影与展台 / 场景材质语言与光影色彩关系 / 场景材质
      if (/环境光影与展台|场景材质语言与光影色彩关系|场景.*光影|光影.*场景/.test(header)) {
        if (hasStyle && hasLighting) {
          keptBlocks.push(
            `【场景材质语言与光影色彩关系（具体布景重新设计）】${abstractScenePropsForRedesign(body)}`
          );
        } else if (hasStyle && !hasLighting) {
          keptBlocks.push(
            `【场景类型与材质造型语言（具体布景重新设计）】${abstractScenePropsForRedesign(body)}`
          );
        } else if (!hasStyle && hasLighting) {
          keptBlocks.push(
            `【光影反差与色彩关系（未提取案例环境背景）】仅提取光向、软硬反差与冷暖色彩关系，采用重新设计的纯净商业布景与几何展台（不继承案例任何场景物件）。`
          );
        }
        continue;
      }

      // 5. style only: 场景 / 材质 / 环境背景 / 展台 / 视觉质感 / 美学风格 / 画面元素 / 装饰机制
      if (/场景|材质|环境背景|展台|视觉质感|美学风格|画面元素|装饰机制/.test(header)) {
        if (hasStyle) {
          keptBlocks.push(
            `【场景类型与材质语言】${abstractScenePropsForRedesign(body)}`
          );
        }
        continue;
      }

      // 6. lighting only: 光影 / 布光 / 色彩 / 色调
      if (/光影|布光|色彩|色调/.test(header)) {
        if (hasLighting) {
          keptBlocks.push(`【光影反差与色彩关系】${body}`);
        }
        continue;
      }

      // 7. pose: 主体姿态 / 组合关系 / 姿态
      if (/主体姿态|组合关系|姿态/.test(header)) {
        if (hasPose) {
          keptBlocks.push(`【主体姿态与组合关系】${body}`);
        }
        continue;
      }

      // Unknown tag fallback: keep if style or structure is enabled
      if (hasStyle || hasStructure) {
        keptBlocks.push(`【${header}】${abstractScenePropsForRedesign(body)}`);
      }
    }

    return keptBlocks
      .join('；')
      .replace(/[；;]{2,}/g, '；')
      .replace(/[；;。\s]+$/, '')
      .trim();
  }

  return abstractScenePropsForRedesign(raw)
    .replace(/[；;。\s]+$/, '')
    .trim();
}

/**
 * Extracts all independent `+约束` (`caseCustomRule`) rules from bound cases.
 * Processed as a standalone high-priority constraint block independent of the 6 dimension tags.
 */
export function extractIndependentCaseCustomRules(
  boundCases: ReferenceImageItem[] | undefined
): string[] {
  if (!boundCases || boundCases.length === 0) return [];
  return boundCases
    .map((c, idx) => {
      const rule = (c.caseCustomRule || '').trim();
      if (!rule) return '';
      const code = c.code ? `#${c.code.replace(/^#/, '')}` : `#Case-${idx + 1}`;
      return `【${code} 独立约束】：${rule}`;
    })
    .filter(Boolean);
}

/**
 * Synthesizes the Page-Wide Unified Visual Specification (整页统一视觉规范 `unifiedVisualSpec`)
 * during the Analysis Stage from the reference cases' checked `style`, `lighting`, and `content` dimensions,
 * binding dimension sources by explicit priority order to avoid whole-image mixing.
 */
export function deriveUnifiedVisualSpecFromCases(
  caseRefs: ReferenceImageItem[],
  globalStylePrefix?: string,
  productInfoText?: string
): string {
  const prefix = (globalStylePrefix || '').trim();
  if (!caseRefs || caseRefs.length === 0) {
    return (
      prefix ||
      '整页统一视觉规范：【场景与材质语言】现代高质感商业摄影棚拍，极简几何展台与细腻材质肌理；【光影与色彩关系】柔和立体主光配轮廓高光，明暗反差适中，全页色温与主辅色调高度统一；【排版与字体规范】现代无衬线商业字体，主副标题字号层级分明、居中或左对齐规整，全页保持充足呼吸留白；【产品身份铁律】产品外观、结构与图案100%以自有 #Prod 产品图为准。'
    );
  }

  const styleSource = caseRefs.find((c) =>
    (c.caseDimensions || ['style', 'structure', 'content', 'lighting']).includes('style')
  );
  const lightingSource = caseRefs.find((c) =>
    (c.caseDimensions || ['style', 'structure', 'content', 'lighting']).includes('lighting')
  );
  const contentSource = caseRefs.find((c) =>
    (c.caseDimensions || ['style', 'structure', 'content', 'lighting']).includes('content')
  );
  const structureSource = caseRefs.find((c) =>
    (c.caseDimensions || ['style', 'structure', 'content', 'lighting']).includes('structure')
  );

  const extractDnaSegment = (c: ReferenceImageItem | undefined, dim: CaseRefDimension): string => {
    if (!c) return '';
    const filtered = filterExtractedDnaByDimensions(c.extractedLayoutDna, [dim], false);
    if (filtered) return filtered.replace(/【[^】]+】/g, '').trim();
    return (c.tag || '').replace(/^第\s*\d+\s*屏\s*[·•-]?\s*/i, '').trim();
  };

  const styleCode = styleSource ? `#${styleSource.code.replace(/^#/, '')}` : '';
  const lightingCode = lightingSource ? `#${lightingSource.code.replace(/^#/, '')}` : '';
  const contentCode = contentSource ? `#${contentSource.code.replace(/^#/, '')}` : '';
  const structureCode = structureSource ? `#${structureSource.code.replace(/^#/, '')}` : '';

  const styleSnippet = extractDnaSegment(styleSource, 'style');
  const lightingSnippet = extractDnaSegment(lightingSource, 'lighting');
  const contentSnippet = extractDnaSegment(contentSource, 'content');

  const parts: string[] = [];

  if (styleSource) {
    parts.push(
      `【环境背景规范（来源优先级：${styleCode}）】提取其场景类型、台面材质肌理与几何造型语言${styleSnippet ? `（${styleSnippet}）` : ''}，各屏围绕我方产品重新设计具体布景，不照搬竞品具体道具或原图坐标`
    );
  } else {
    parts.push(
      '【环境背景规范（未从案例提取）】采用契合我方自有产品的纯净高级商业摄影棚背景与现代几何展台，具体布景全新设计'
    );
  }

  if (lightingSource) {
    parts.push(
      `【光影色调规范（来源优先级：${lightingCode}）】提取其主辅光方向、光质软硬、明暗反差及主辅色彩关系${lightingSnippet ? `（${lightingSnippet}）` : ''}，保持整页冷暖色温与色调统一，不继承竞品场景物件`
    );
  } else {
    parts.push(
      '【光影色调规范（未从案例提取）】采用柔和立体的商业摄影棚布光与和谐高级的色彩关系，保持整页光影统一'
    );
  }

  if (contentSource) {
    parts.push(
      `【文案版式规范（来源优先级：${contentCode}）】提取其字体性格、主副标字号层级、对齐方式与行距间距规律${contentSnippet ? `（${contentSnippet}）` : ''}，不提取竞品文字内容`
    );
  } else {
    parts.push(
      '【文案版式规范（未从案例提取）】采用清晰现代的商业无衬线字体层级与规整对齐间距，文字内容100%基于我方资料生成'
    );
  }

  if (structureSource) {
    parts.push(
      `【版式骨架节奏（来源优先级：${structureCode}）】提取各屏信息分区、主次层级、图文占比与四周安全留白规律（≥8%），重新编排各屏版面，不100%复制竞品元素坐标或完整构图`
    );
  }

  parts.push(
    `【核心权威源铁律】产品身份与外观造型100%以自有 #Prod 产品图为准；文案与参数100%以我方产品资料${productInfoText ? '及用户指定文案' : ''}为准`
  );

  if (prefix) {
    parts.push(`【全局画风补充】${prefix}`);
  }

  const customRules = extractIndependentCaseCustomRules(caseRefs);
  if (customRules.length > 0) {
    parts.push(`【独立补充约束】${customRules.join('；')}`);
  }

  return parts.join('；');
}

/**
 * Builds a strict client-side multi-#Case dimension extraction & priority directive.
 *
 * Key rules enforced:
 * 1. The 6 tags ONLY control Analysis Stage information extraction scope:
 *    - Checked = allow extracting that dimension's abstract pattern/law from this case.
 *    - Unchecked = do NOT extract that dimension from this case (does NOT mean "lock unchanged").
 *    - Selecting all 6 tags does NOT equal copying the whole image!
 * 2. Explicit Lock-Base Swap (`isLockBaseSwap === true` or `isMasterCaseReference`) is an independent mode:
 *    - Only when explicitly enabled does it lock background, layout, copywriting 100% and swap only `#Prod`.
 * 3. Multi-case binds explicit source & priority by dimension order to prevent whole-image blending.
 * 4. `+约束` (`caseCustomRule`) is processed as an independent rule section.
 */
export function buildClientCaseDimensionDirective(
  boundCases: ReferenceImageItem[],
  unifiedLayoutRule?: string,
  studioMode: 'detail' | 'sku' = 'detail'
): string {
  const trimmedRule = (unifiedLayoutRule || '').trim();
  if (!boundCases || boundCases.length === 0) {
    return (
      trimmedRule ||
      '电商标准高质感商业摄影背景，整套保持统一光影色调、统一版式节奏与充足呼吸留白（≥8%），产品身份与外观细节100%以自有 #Prod 实拍图为准，文案与参数100%以自有产品资料为准'
    );
  }

  const dimExtractionRuleMap: Record<CaseRefDimension, string> = {
    pose: '主体姿态(仅提取朝向、摆放角度及主副件组合关系，不继承竞品身份和外形，产品外观100%以#Prod为准)',
    style:
      '环境背景(仅提取场景类型、材质肌理与造型语言，具体布景重新设计，不照搬竞品具体道具)',
    structure:
      '版式骨架(仅提取信息分区、主次层级、图文占比和留白规律，不复制元素坐标及完整构图)',
    content:
      '文案版式(仅提取字体性格、字号层级、对齐方式和间距规律，不提取竞品文字内容)',
    copy_text:
      '文案内容(仅提取卖点主题和表达结构，依据自有产品资料重写，用户指定文案优先，不移植竞品参数与承诺)',
    lighting:
      '光影色调(仅提取光向、软硬、反差及色彩关系，不继承竞品场景物件)',
  };

  const allDims: CaseRefDimension[] = [
    'pose',
    'style',
    'structure',
    'content',
    'copy_text',
    'lighting',
  ];

  // Check if any bound case has EXPLICIT Lock-Base Swap enabled (`isLockBaseSwap` or Master Case)
  const lockBaseCase = boundCases.find(isExplicitLockBaseSwapCase);

  if (lockBaseCase) {
    const mCode = lockBaseCase.code
      ? `#${lockBaseCase.code.replace(/^#/, '')}`
      : '#Case-1';
    const customMasterNote = lockBaseCase.caseCustomRule?.trim()
      ? `⚡【${mCode} 独立约束】：${lockBaseCase.caseCustomRule.trim()}`
      : '';
    return [
      `🔒【显式锁底换款模式(${mCode}) · 100%锁底仅换产品主体】：当前已显式开启锁底换款，必须以 ${mCode} 原图为锁底基准，除替换产品主体（及更新我方指定品牌/款式文案）外，背景环境、展台几何结构、光影色调、版式坐标与UI容器样式全部100%锁定保持一致`,
      `🔄【主体身份唯一权威源】：仅提取自有 #Prod 实拍图中的产品主体（严格还原 #Prod 外观结构、材质与表面图案，忽略 #Prod 自身背景边框）定点替换 ${mCode} 中的竞品主体`,
      customMasterNote,
      trimmedRule ? `补充规范要求：${trimmedRule}` : '',
    ]
      .filter(Boolean)
      .join('；');
  }

  const perCaseRules = boundCases.map((c, idx) => {
    const code = c.code ? `#${c.code.replace(/^#/, '')}` : `#Case-${idx + 1}`;
    const selected: CaseRefDimension[] =
      Array.isArray(c.caseDimensions) && c.caseDimensions.length > 0
        ? c.caseDimensions
        : ['style', 'structure', 'content', 'lighting'];
    const unselected = allDims.filter((d) => !selected.includes(d));
    const allowText = selected.map((d) => dimExtractionRuleMap[d] || d).join('；');

    const unselectedLabels = unselected.map((d) => {
      switch (d) {
        case 'pose':
          return '主体姿态(不从该案例提取姿态，主体朝向与摆放完全按#Prod与本屏策划自由设计)';
        case 'style':
          return '环境背景(不从该案例提取场景类型与材质，背景布景完全围绕我方产品独立设计)';
        case 'structure':
          return '版式骨架(不从该案例提取分区占比，版面构图按本屏主题独立编排)';
        case 'content':
          return '文案版式(不从该案例提取字体层级与对齐方式)';
        case 'copy_text':
          return '文案内容(不从该案例提取卖点表达结构，直接按我方策划案与产品资料撰写)';
        case 'lighting':
          return '光影色调(不从该案例提取光影与色彩关系)';
      }
    });

    const unselectedClause =
      unselected.length > 0
        ? `（未选中不提取维度：${unselectedLabels.join('、')} —— 未选中仅代表不从 ${code} 提取该维度信息，不代表锁定不变）`
        : `（已选中全部六个分析维度：允许从 ${code} 提取全部六个维度的抽象规律用于重新策划背景与排版，⚠️全部选中不等于照搬整图，严禁100%复制具体场景物件、元素坐标或竞品参数文字）`;

    const filteredDna = filterExtractedDnaByDimensions(
      c.extractedLayoutDna,
      selected,
      false
    );
    const dnaClause = filteredDna
      ? `【🧬${code} 按选中标签过滤后的抽象提取结果：${filteredDna}】`
      : '';
    return `${code} 允许提取范围：【${allowText}】${unselectedClause}${dnaClause}`;
  });

  // Multi-case dimension source binding & explicit priority arbitration (prevent whole-image blending)
  const dimPriorityBindings: string[] = [];
  if (boundCases.length > 1) {
    const dimLabelShort: Record<CaseRefDimension, string> = {
      pose: '主体姿态',
      style: '环境背景',
      structure: '版式骨架',
      content: '文案版式',
      copy_text: '文案内容结构',
      lighting: '光影色调',
    };
    for (const dim of allDims) {
      const matchingCases = boundCases.filter((c) =>
        (c.caseDimensions || ['style', 'structure', 'content', 'lighting']).includes(dim)
      );
      if (matchingCases.length > 0) {
        const primaryCode = `#${(matchingCases[0].code || 'Case-1').replace(/^#/, '')}`;
        const fallbackCodes = matchingCases
          .slice(1)
          .map((c) => `#${(c.code || 'Case').replace(/^#/, '')}`);
        dimPriorityBindings.push(
          `${dimLabelShort[dim]} → 主来源锁定 ${primaryCode}${fallbackCodes.length > 0 ? `（次优参考 ${fallbackCodes.join('/')}，禁止整图混合）` : ''}`
        );
      }
    }
  }

  const priorityArbitrationNote =
    dimPriorityBindings.length > 0
      ? `🎯【多案例分维度来源绑定与显式优先级（严禁整图混合）】：${dimPriorityBindings.join(' ｜ ')}`
      : '';

  const customRules = extractIndependentCaseCustomRules(boundCases);
  const customRulesClause =
    customRules.length > 0
      ? `⚡【独立补充约束规则（最高优先级，独立于六维标签生效）】：${customRules.join('；')}`
      : '';

  const authorityClause =
    studioMode === 'detail'
      ? '🛡️【重策划与权威源边界】：产品身份与外观细节100%以自有 #Prod 产品图为准；文案与参数100%以自有产品资料与用户指定文案为准（不移植竞品参数与承诺）；在保持整页视觉风格统一的前提下重新设计具体背景布景与版面编排，不百分百沿用竞品具体场景道具、元素坐标或完整构图'
      : '🛡️【SKU六维提取与权威源边界】：产品身份与外观细节100%以自有 #Prod 产品图为准；SKU标题、卖点角标与参数100%以我方配置与产品资料为准；按选中维度提取规律并保持全套SKU视觉规范统一，不照搬竞品身份或竞品旧参数文字';

  return [
    `参考案例(#Case)六维分析提取范围：${perCaseRules.join('；')}`,
    priorityArbitrationNote,
    customRulesClause,
    trimmedRule ? `统一视觉规范补充：${trimmedRule}` : '',
    authorityClause,
  ]
    .filter(Boolean)
    .join('；');
}

/**
 * Dynamically extracts capsule list from a master SKU task's visualPrompt / typographyPlan / sellingPointBadge.
 */
export function extractMasterCapsulesText(
  task: Pick<SkuTask, 'visualPrompt' | 'typographyPlan' | 'sellingPointBadge'>
): string {
  const combinedSource = `${task.visualPrompt || ''}\n${task.typographyPlan || ''}`;
  const fromPromptMatch = combinedSource.match(
    /(?:胶囊|标签)[^。；\n]*?(?:显示|排列|为)[：:\s]*((?:[「“"][^」”"]+[」”"][、，,\s]*){2,})/
  );
  if (fromPromptMatch?.[1]) {
    return fromPromptMatch[1].trim();
  }
  const badgeParts = (task.sellingPointBadge || '')
    .split(/\s*[｜|、，,]+\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (badgeParts.length > 0) {
    return badgeParts.map((b) => `「${b}」`).join('、');
  }
  return '';
}

/**
 * Dynamically extracts bottom bar description from a master SKU task's typographyPlan / visualPrompt.
 */
export function extractMasterBottomBarClause(
  task: Pick<SkuTask, 'visualPrompt' | 'typographyPlan'>,
  masterCaseCode = '#Case-1'
): string {
  const combinedSource = `${task.typographyPlan || ''}\n${task.visualPrompt || ''}`;
  const bottomMatch = combinedSource.match(
    /(底部(?:通栏|横条|图标|区域|功能)[^。；\n]*)/
  );
  if (bottomMatch?.[1]) {
    return `底部区域与 ${masterCaseCode} 母版原图 100% 视觉一致（${bottomMatch[1].trim()}）`;
  }
  return `底部区域与 ${masterCaseCode} 母版原图保持 100% 像素级一致`;
}

/**
 * Extracts pure #Prod product appearance sentence from a card's existing visualPrompt
 * while stripping conflicting background/podium/capsule descriptions.
 */
export function extractCardProdAppearanceClause(
  cardPrompt: string,
  expectedProdCode: string,
  prodTag: string,
  masterCaseCode = '#Case-1'
): string {
  const codeNorm = expectedProdCode.replace(/^#/, '');
  const sentences = (cardPrompt || '')
    .split(/[。；\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  for (const s of sentences) {
    const mentionsOtherProd =
      /#?Prod-\d+/i.test(s) && !new RegExp(`#?${codeNorm}\\b`, 'i').test(s);
    if (mentionsOtherProd) continue;

    const hasProdDetail =
      new RegExp(`#?${codeNorm}\\b`, 'i').test(s) ||
      /(?:商品主体|产品主体|盒盖|上盖|盒身|机身).*?(?:印有|图案|插画|字样|艺术字|实拍)/.test(
        s
      );
    if (hasProdDetail) {
      const cleaned = s
        .replace(
          /^.*?(?:分割网格|科技展台|圆柱展台|几何展台|展台底座)[，,：:]\s*/,
          ''
        )
        .replace(
          /^(?:画面右侧主体区|展台正上方|展台中央|右侧展台商品主体)[：:\s]*/,
          ''
        )
        .replace(/（仅提取\s*#?Prod-\d+[^）]*）/g, '')
        .trim();
      if (cleaned.length >= 16) {
        return `${cleaned}（仅提取 #${codeNorm} 商品本体替换到 ${masterCaseCode} 母版对应商品位上，彻底忽略 #${codeNorm} 原图自身的背景与边框）`;
      }
    }
  }

  return `在 ${masterCaseCode} 母版相同的商品展台坐标位置放置 #${codeNorm}（${prodTag || codeNorm}）商品本体，100%严格保持 #${codeNorm} 实拍图固有的拍摄透视角度、外观结构比例、材质细节与表面定制图案/文字，色彩锐利不形变（仅提取 #${codeNorm} 商品本体替换到母版商品位上，彻底忽略 #${codeNorm} 原图自身的背景与边框）`;
}

/**
 * Splits a SKU title into [mainTitle, subTitle] supporting `/`, `｜`, `|`, ` · `, ` • `, or leading `【...】` prefix.
 */
export function splitSkuTitleTwoLines(rawTitle: string | undefined): [string, string] {
  const trimmed = (rawTitle || '').trim();
  if (!trimmed) return ['', ''];

  // Priority 1: explicit slash or pipe separator ("C101 / 奶酪火箭鼠款")
  if (/[/｜|]/.test(trimmed)) {
    const parts = trimmed
      .split(/\s*[/｜|]\s*/)
      .map((s) => s.replace(/^[\s/｜|]+/, '').trim())
      .filter(Boolean);
    if (parts.length >= 2) {
      return [parts[0], parts.slice(1).join(' · ')];
    }
    return [parts[0] || trimmed, ''];
  }

  // Priority 2: middle dot separator ("C101 · 奶酪火箭鼠款" or "奶酪火箭鼠款 · 官方标配")
  if (/\s*[·•]\s*/.test(trimmed)) {
    const parts = trimmed
      .split(/\s*[·•]\s*/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length >= 2) {
      return [parts[0], parts.slice(1).join(' · ')];
    }
  }

  // Priority 3: leading bracket code ("【C101】奶酪火箭鼠款")
  const bracketMatch = trimmed.match(/^【([^】]+)】\s*(.+)$/);
  if (bracketMatch) {
    return [bracketMatch[1].trim(), bracketMatch[2].trim()];
  }

  return [trimmed, ''];
}

/**
 * Synchronizes an updated SKU title (1-line or 2-line) into existing typographyPlan and visualPrompt.
 */
export function syncSkuTitleInText(
  oldTitleRaw: string,
  nextTitleRaw: string,
  typographyPlan: string,
  visualPrompt: string
): { typographyPlan: string; visualPrompt: string } {
  const oldTitle = (oldTitleRaw || '').trim();
  const nextTitle = (nextTitleRaw || '').trim();
  const cleanedTypo = stripLeadingSubtitleSlash(typographyPlan);
  const cleanedPrompt = stripLeadingSubtitleSlash(visualPrompt);
  if (!nextTitle) {
    return { typographyPlan: cleanedTypo, visualPrompt: cleanedPrompt };
  }

  const [oldMain, oldSub] = splitSkuTitleTwoLines(oldTitle);
  const [nextMain, nextSub] = splitSkuTitleTwoLines(nextTitle);

  const mainSlotRegex =
    /((?:(?:第1行|第一行|大字|顶部)[^\n，。；：“"‘'「『]{0,14}?)?主标题[：:\s]*[“"‘'「『])([^”"’'」』]+)([”"’'」』])/g;
  const subSlotRegex =
    /((?:(?:第2行|第二行|正下方|紧随其下|下方)[^\n，。；：“"‘'「『]{0,14}?)?副标题[：:\s]*[“"‘'「『])([^”"’'」』]+)([”"’'」』])/g;

  const replaceTitleTokens = (text: string): string => {
    if (!text) return text;
    let res = stripLeadingSubtitleSlash(text);

    const mergedCandidates = [
      oldMain && oldSub ? `${oldMain} / ${oldSub}` : '',
      oldMain && oldSub ? `${oldMain} · ${oldSub}` : '',
      oldMain && oldSub ? `${oldMain} ${oldSub}` : '',
      nextMain && nextSub ? `${nextMain} / ${nextSub}` : '',
      nextMain && nextSub ? `${nextMain} · ${nextSub}` : '',
      nextMain && nextSub ? `${nextMain} ${nextSub}` : '',
    ].filter(Boolean);

    let didExpandMerged = false;
    for (const cand of mergedCandidates) {
      if (nextSub && res.includes(`“${cand}”`)) {
        res = res
          .split(`“${cand}”`)
          .join(`第1行大字主标题“${nextMain}”，正下方第2行副标题“${nextSub}”`);
        didExpandMerged = true;
      } else if (nextSub && res.includes(`"${cand}"`)) {
        res = res
          .split(`"${cand}"`)
          .join(`第1行大字主标题"${nextMain}"，正下方第2行副标题"${nextSub}"`);
        didExpandMerged = true;
      } else if (nextSub && res.includes(`「${cand}」`)) {
        res = res
          .split(`「${cand}」`)
          .join(`第1行大字主标题「${nextMain}」，正下方第2行副标题「${nextSub}」`);
        didExpandMerged = true;
      } else if (nextSub && res.includes(cand)) {
        res = res
          .split(cand)
          .join(`第1行大字主标题“${nextMain}”，正下方第2行副标题“${nextSub}”`);
        didExpandMerged = true;
      }
    }

    const hasSplitSubtitleStructure = /副标题/.test(res);

    if (!didExpandMerged) {
      if (!hasSplitSubtitleStructure && nextSub) {
        // Expanding 1-line title into 2-line title
        if (mainSlotRegex.test(res)) {
          mainSlotRegex.lastIndex = 0;
          res = res.replace(
            mainSlotRegex,
            `$1${nextMain}$3，正下方第2行副标题“${nextSub}”`
          );
        } else if (oldMain && oldMain.length >= 2) {
          if (res.includes(`“${oldMain}”`)) {
            res = res
              .split(`“${oldMain}”`)
              .join(`“${nextMain}”，正下方第2行副标题“${nextSub}”`);
          } else if (res.includes(`「${oldMain}」`)) {
            res = res
              .split(`「${oldMain}」`)
              .join(`「${nextMain}」，正下方第2行副标题「${nextSub}」`);
          } else if (res.includes(oldMain)) {
            res = res
              .split(oldMain)
              .join(`${nextMain}（正下方第2行副标题：${nextSub}）`);
          }
        }
      } else {
        const TOKEN_MAIN = '__SKU_MAIN_SLOT_TOKEN__';
        const TOKEN_SUB = '__SKU_SUB_SLOT_TOKEN__';
        const canReplaceMain = Boolean(
          oldMain &&
            oldMain.length >= 2 &&
            nextMain &&
            oldMain !== nextMain &&
            res.includes(oldMain)
        );
        const canReplaceSub = Boolean(
          oldSub &&
            oldSub.length >= 2 &&
            nextSub &&
            oldSub !== nextSub &&
            res.includes(oldSub)
        );

        if (canReplaceMain) {
          res = res.split(oldMain).join(TOKEN_MAIN);
        }
        if (canReplaceSub) {
          res = res.split(oldSub).join(TOKEN_SUB);
        }
        if (canReplaceMain) {
          res = res.split(TOKEN_MAIN).join(nextMain);
        }
        if (canReplaceSub) {
          res = res.split(TOKEN_SUB).join(nextSub);
        }
      }
    }

    // Slot-level regex sync across all quote styles (“”, "", ‘’, '', 「」, 『』)
    if (nextMain) {
      mainSlotRegex.lastIndex = 0;
      res = res.replace(mainSlotRegex, `$1${nextMain}$3`);
    }
    if (nextSub) {
      subSlotRegex.lastIndex = 0;
      res = res.replace(subSlotRegex, `$1${nextSub}$3`);
    } else if (hasSplitSubtitleStructure) {
      // Collapsing 2-line title into 1-line title: remove dangling 2nd line subtitle clause
      res = res
        .replace(
          /[，,、；;\s]*(?:其)?(?:正下方|紧随其下|下方)?(?:是|为|显示|渲染|排布)?(?:第2行|第二行)?[^\n，。；：“"‘'「『]{0,10}?副标题[：:\s]*[“"‘'「『][^”"’'」』]+[”"’'」』](?:（上下两行(?:独立)?排布）)?/g,
          ''
        )
        .replace(/两行(?:垂直|简体中文|文字)?(?:排列|排版|文字|文案)[：:\s]*/g, '');
    }

    if (nextSub) {
      res = res.replace(
        /主标题([“"‘'「『][^”"’'」』]+[”"’'」』])与副标题([“"‘'「『][^”"’'」』]+[”"’'」』])/g,
        '第1行主标题$1，正下方第2行副标题$2（上下两行独立排布）'
      );
    }

    return stripLeadingSubtitleSlash(res);
  };

  let nextTypography = replaceTitleTokens(cleanedTypo);
  if (nextTypography) {
    const headerRegex = /^顶部(?:规格)?(?:主副|主)?标题[^\n]*\n?/;
    const cleanHeaderText = nextSub
      ? `第1行大字主标题“${nextMain}”，正下方第2行副标题“${nextSub}”（上下两行排布）`
      : `主标题“${nextMain}”`;
    if (headerRegex.test(nextTypography)) {
      nextTypography = nextTypography.replace(
        headerRegex,
        `顶部主副标题：${cleanHeaderText}\n`
      );
    } else if (
      !nextTypography.includes(nextMain) ||
      (nextSub && !nextTypography.includes(nextSub))
    ) {
      nextTypography = `顶部主副标题：${cleanHeaderText}\n${nextTypography}`;
    }
  }

  const nextVisualPrompt = replaceTitleTokens(cleanedPrompt);
  return { typographyPlan: nextTypography, visualPrompt: nextVisualPrompt };
}

/**
 * Synchronizes updated `sellingPointBadge` and `packageSpecNote` into existing `typographyPlan` and `visualPrompt`
 * so applying a Selling Point Preset or editing card badges immediately takes effect without requiring Agent rewrite.
 */
export function syncSellingPointsIntoTypographyAndPrompt(
  oldBadgeRaw: string,
  nextBadgeRaw: string,
  oldNoteRaw: string,
  nextNoteRaw: string,
  typographyPlan: string,
  visualPrompt: string
): { typographyPlan: string; visualPrompt: string } {
  const oldBadge = (oldBadgeRaw || '').trim();
  const nextBadge = (nextBadgeRaw || '').trim();
  const oldNote = (oldNoteRaw || '').trim().replace(/^\*+/, '').trim();
  const nextNote = (nextNoteRaw || '').trim().replace(/^\*+/, '').trim();

  const formatCapsules = (badgeStr: string): string => {
    const parts = badgeStr
      .split(/\s*[｜|、，,]+\s*/)
      .map((s) => s.trim())
      .filter(Boolean);
    return parts.map((p) => `「${p}」`).join('、');
  };

  const syncTextBlock = (text: string, isTypo: boolean): string => {
    if (!text) return text;
    let out = text;

    if (nextBadge) {
      const nextCapsules = formatCapsules(nextBadge);
      if (oldBadge && out.includes(oldBadge)) {
        out = out.split(oldBadge).join(nextBadge);
      } else if (
        /(?:胶囊|标签|角标)[^。；\n]*?(?:显示|排列|为|带有|展示(?:卖点)?)[：:\s]*(?:[「“"][^」”"]+[」”"][、，,\s]*)+/.test(
          out
        )
      ) {
        out = out.replace(
          /((?:胶囊|标签|角标)[^。；\n]*?(?:显示|排列|为|带有|展示(?:卖点)?)[：:\s]*)(?:[「“"][^」”"]+[」”"][、，,\s]*)+/g,
          `$1${nextCapsules}`
        );
      } else if (isTypo && !out.includes(nextBadge)) {
        if (/卖点角标[：:\s]*[^\n]+/.test(out)) {
          out = out.replace(/卖点角标[：:\s]*[^\n]+/, `卖点角标：${nextCapsules}`);
        } else {
          out = `${out.replace(/[。；\s]+$/, '')}；卖点角标：${nextCapsules}。`;
        }
      }
    }

    if (nextNote) {
      if (oldNote && out.includes(oldNote)) {
        out = out.split(oldNote).join(nextNote);
      } else if (
        /(?:配件(?:规格)?(?:小字|说明|清单)|说明小字|底部(?:通栏|规格)?(?:小字|说明|标注|印有|显示))[：:\s]*[「“"]?\*?[^」”"。；\n]+[」”"]?/.test(
          out
        )
      ) {
        out = out.replace(
          /((?:配件(?:规格)?(?:小字|说明|清单)|说明小字|底部(?:通栏|规格)?(?:小字|说明|标注|印有|显示))[：:\s]*[「“"]?\*?)([^」”"。；\n]+)([」”"]?)/g,
          `$1${nextNote}$3`
        );
      } else if (isTypo && !out.includes(nextNote)) {
        out = `${out.replace(/[。；\s]+$/, '')}；底部规格说明：「${nextNote}」。`;
      }
    }

    return out;
  };

  return {
    typographyPlan: syncTextBlock(typographyPlan, true),
    visualPrompt: syncTextBlock(visualPrompt, false),
  };
}

/**
 * Builds the synchronized typographyPlan and 100% pixel-locked visualPrompt when promoting
 * or syncing a First-Card Master Template (#Case) across all SKU cards.
 */
export function buildUnifiedMasterLockPrompt(options: {
  masterTask: SkuTask;
  targetTask: SkuTask;
  prodCode: string;
  prodTag: string;
  masterCaseCode?: string;
}): { syncedTypographyPlan: string; unifiedMasterPrompt: string } {
  const {
    masterTask,
    targetTask,
    prodCode,
    prodTag,
    masterCaseCode = '#Case-1',
  } = options;

  const [targetMain = '', targetSub = ''] = splitSkuTitleTwoLines(
    targetTask.skuTitle
  );

  // Sync title from masterTask -> targetTask using unified two-line title synchronizer
  const baseTypo = masterTask.typographyPlan || targetTask.typographyPlan || '';
  const titleSynced = syncSkuTitleInText(
    masterTask.skuTitle,
    targetTask.skuTitle,
    baseTypo,
    ''
  );

  // Respect targetTask's own sellingPointBadge & packageSpecNote when present
  const effectiveBadge =
    (targetTask.sellingPointBadge || '').trim() ||
    (masterTask.sellingPointBadge || '').trim();
  const effectiveNote = (
    (targetTask.packageSpecNote || '').trim() ||
    (masterTask.packageSpecNote || '').trim()
  ).replace(/^\*+/, '');

  const copySynced = syncSellingPointsIntoTypographyAndPrompt(
    masterTask.sellingPointBadge,
    effectiveBadge,
    masterTask.packageSpecNote,
    effectiveNote,
    titleSynced.typographyPlan,
    ''
  );
  const syncedTypographyPlan = copySynced.typographyPlan;

  const effectiveCapsulesText = extractMasterCapsulesText({
    visualPrompt:
      effectiveBadge === (masterTask.sellingPointBadge || '').trim()
        ? masterTask.visualPrompt
        : '',
    typographyPlan:
      effectiveBadge === (masterTask.sellingPointBadge || '').trim()
        ? masterTask.typographyPlan
        : '',
    sellingPointBadge: effectiveBadge,
  });

  const masterBottomBarClause =
    effectiveNote && effectiveNote !== (masterTask.packageSpecNote || '').trim().replace(/^\*+/, '')
      ? `底部区域与 ${masterCaseCode} 母版原图保持相同坐标与样式（显示「${effectiveNote}」）`
      : extractMasterBottomBarClause(masterTask, masterCaseCode);

  const prodClause = extractCardProdAppearanceClause(
    targetTask.visualPrompt,
    prodCode,
    prodTag,
    masterCaseCode
  );

  const titleClause =
    targetMain && targetSub
      ? `顶部标题区与 ${masterCaseCode} 母版坐标字体完全一致，分上下两行独立排布：第1行大号粗体主标题“${targetMain}”，正下方第2行副标题“${targetSub}”`
      : `顶部标题区与 ${masterCaseCode} 母版坐标字体完全一致，醒目排布标题“${targetTask.skuTitle || targetMain}”`;

  const capsuleClause = effectiveCapsulesText
    ? `卖点胶囊区与 ${masterCaseCode} 母版完全相同坐标、圆角形状与完全相同的柔和浅色胶囊底色及深色文字（严禁将胶囊底色改为高饱和艳色或深色），依次显示${effectiveCapsulesText}`
    : `卖点胶囊区与 ${masterCaseCode} 母版原图保持 100% 相同的坐标、胶囊底色与文字排版`;

  const effectiveTextMode = targetTask.textMode || masterTask.textMode;
  const unifiedMasterPrompt =
    effectiveTextMode === 'without_text'
      ? [
          `8K商业级电商SKU规格纯视觉底图，${masterTask.aspectRatio}画幅。【100%像素级锁底复刻 ${masterCaseCode} 首卡定标母版背景与展台，仅定点替换商品主体】`,
          `背景、环境光影与展台底座 100% 严锁复刻 ${masterCaseCode} 母版原图的背景色相渐变、柔亮商业布光与展台几何造型材质（严禁改变背景冷暖色调，严禁在展台或背景中添加 ${masterCaseCode} 母版不存在的发光灯带、流光轨或多余背景道具）`,
          `商品主体区：${prodClause}`,
          `按照 ${masterCaseCode} 母版的构图比例预留干净留白区，画面内不渲染任何文字或角标。`,
        ].join('。')
      : [
          `8K商业级电商SKU规格图，${masterTask.aspectRatio}画幅。【100%像素级锁底复刻 ${masterCaseCode} 首卡定标母版，仅定点替换商品主体与本款指定文案】`,
          `背景、环境光影与展台底座 100% 严锁复刻 ${masterCaseCode} 母版原图的背景色相渐变、柔亮商业布光与展台几何造型材质（严禁将背景改为其他冷灰/异色，严禁在展台添加母版不存在的发光灯带、流光轨或多余背景道具）`,
          `商品主体区：${prodClause}`,
          `文字与UI排版 100% 锁定 ${masterCaseCode} 母版样式与坐标网格：${titleClause}；${capsuleClause}${
            effectiveNote
              ? `；胶囊列表正下方一行精致说明小字“*${effectiveNote}”`
              : ''
          }；${masterBottomBarClause}。`,
        ].join('。');

  return {
    syncedTypographyPlan,
    unifiedMasterPrompt,
  };
}

/**
 * Detects whether a string looks like a structural layout skeleton tag (e.g. "拱门双展台首焦KV+居中大字",
 * "声学斜向爆炸图+底部三标", "声学卖点中置展台+底栏三等分胶囊") rather than real consumer marketing copywriting.
 */
export function isLayoutSkeletonLabel(text: string | undefined): boolean {
  const s = (text || '').trim();
  if (!s) return false;
  return (
    /\+(?:居中大字|底部三标|底栏|三等分|三胶囊|参数标|胶囊|方标|卡片|分栏|列表)/.test(
      s
    ) ||
    /(?:首焦KV|双展台|中置展台|斜向爆炸图|底栏三|底部三标|几何分区|版式骨架|单屏对标)/.test(
      s
    )
  );
}

/**
 * Detects whether a ScreenTask contains dummy template placeholders ("Brand Header", "核心卖点1", "[核心亮点1]"),
 * has a layout skeleton label ("拱门双展台首焦KV+居中大字") leaked into its copywriting/headline,
 * or violates the bound #Case's checked/unchecked dimensions or container rules.
 */
export function isTaskPollutedByPlaceholdersOrSkeleton(
  task: ScreenTask,
  boundCase?: ReferenceImageItem
): boolean {
  const combined = `${task.copywriting || ''}\n${task.typographyPlan || ''}\n${task.visualPrompt || ''}`;
  if (
    /Brand Header|Brand Logo|核心卖点1\s*[｜|]\s*核心卖点2|\[核心亮点1\]|\[参数亮点1\]|在此输入核心主标题卖点摘要|卖点说明\s*[｜|]/.test(
      combined
    )
  ) {
    return true;
  }

  // Check if copywriting or main headline inside typographyPlan is literally the layout skeleton tag
  const mainTitleMatch = (task.typographyPlan || '').match(
    /主标题[：:\s]*([^\n]+)/
  );
  const mainHeadline = mainTitleMatch?.[1]?.trim() || '';
  if (
    isLayoutSkeletonLabel(task.copywriting) ||
    isLayoutSkeletonLabel(mainHeadline)
  ) {
    return true;
  }

  if (boundCase?.tag) {
    const cleanedCaseTag = boundCase.tag
      .replace(/^第\s*\d+\s*屏\s*[·•-]?\s*/i, '')
      .trim();
    if (
      cleanedCaseTag.length >= 4 &&
      (task.copywriting?.trim() === cleanedCaseTag ||
        mainHeadline === cleanedCaseTag)
    ) {
      return true;
    }
  }

  // Also detect if visualPrompt dumped raw "【模块定位】...【几何分区坐标】" without concrete copy
  if (
    /严格复刻\s*#Case-\d+\s*的版式骨架与几何分区[：:]\s*【模块定位】/.test(
      task.visualPrompt || ''
    )
  ) {
    return true;
  }

  if (boundCase) {
    const dims: CaseRefDimension[] =
      Array.isArray(boundCase.caseDimensions) &&
      boundCase.caseDimensions.length > 0
        ? boundCase.caseDimensions
        : ['style', 'structure'];
    const caseHint = `${boundCase.tag || ''} ${boundCase.extractedLayoutDna || ''}`;

    // 1. If 环境背景 (style) is UNCHECKED on boundCase, but task.visualPrompt still contains concrete background props from extractedLayoutDna
    if (
      !dims.includes('style') &&
      /欧式罗马柱拱门|以横置手机屏幕作为天然矩形画框|迷你石柱与礼盒道具|丝绸波浪肌理背景|深咖色丝绒窗帘背景/.test(
        task.visualPrompt || ''
      )
    ) {
      return true;
    }

    // 2. If 主体姿态 (pose) is UNCHECKED on boundCase, but task.visualPrompt forces open-case + floating earbuds
    if (
      !dims.includes('pose') &&
      /展示我方蓝牙耳机【充电仓开盖状态与悬浮双耳】/.test(
        task.visualPrompt || ''
      )
    ) {
      return true;
    }

    // 3. If boundCase has NO bottom selling-point capsule container (e.g. #Case-1 居中无框排版/地面版权区 or #Case-7 无繁复容器),
    //    yet task.typographyPlan / task.visualPrompt invented "底部卖点卡片区："
    const caseHasNoBottomCapsule =
      /无封闭容器|无繁复容器|居中无框|无框排版|地面版权区|落款区/.test(
        caseHint
      ) && !/三标|方标|三等分胶囊|底栏三|左文右3D耳模|参数表/.test(caseHint);
    if (
      caseHasNoBottomCapsule &&
      /底部卖点卡片区[：:]/.test(task.typographyPlan || '')
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Smartly selects 1~2 optimal #Prod reference images for a given detail screen topic
 * and layerType ('dynamic' vs 'static'), respecting `isCommonAsset` and cross-category visual roles.
 */
export function selectBestProdRefsForScreen(
  screenNum: number,
  topicHint: string,
  prodRefs: ReferenceImageItem[],
  layerType?: ScreenLayerType
): ReferenceImageItem[] {
  if (!prodRefs || prodRefs.length === 0) return [];
  if (prodRefs.length === 1) return [prodRefs[0]];

  // Respect layerType ('static' -> prefer common assets; 'dynamic' -> prefer style-specific assets) when available
  const commonPool = prodRefs.filter((r) => Boolean(r.isCommonAsset));
  const dynamicPool = prodRefs.filter((r) => !r.isCommonAsset);
  const candidateRefs =
    layerType === 'static' && commonPool.length > 0
      ? [...commonPool, ...dynamicPool]
      : layerType === 'dynamic' && dynamicPool.length > 0
        ? [...dynamicPool, ...commonPool]
        : prodRefs;

  const isInnerCloseup = (r: ReferenceImageItem) =>
    /内侧特写|出音网孔|出音孔|LR标识|微距|触点特写|局部特写|细节特写|内部结构|截面|质地|纹理特写|接口特写/i.test(
      `${r.tag || ''} ${r.name || ''}`
    );

  const isHeroCaseOrFullSet = (r: ReferenceImageItem) =>
    !isInnerCloseup(r) &&
    /充电仓|整机|全套|套装|正视|正面|外观|合盖|开盖|图案|印花|保护壳|礼盒|主图|款式|45|主视觉|全身|瓶身|机身|主体/i.test(
      `${r.tag || ''} ${r.name || ''}`
    );

  const isEarbudOrUsageView = (r: ReferenceImageItem) =>
    /单耳|双耳|耳柄|耳机本体|佩戴|侧视|半入耳|出音|上身|使用|手持|场景|模特|体验/i.test(
      `${r.tag || ''} ${r.name || ''}`
    );

  const isPackageOrAccessory = (r: ReferenceImageItem) =>
    /包装|礼盒|保护壳|配件|全家福|清单|挂件|充电线|标配|赠品/i.test(
      `${r.tag || ''} ${r.name || ''}`
    );

  const nonCloseupProds = candidateRefs.filter((r) => !isInnerCloseup(r));
  const heroPool = candidateRefs.filter(isHeroCaseOrFullSet);
  const primaryHeroList =
    heroPool.length > 0
      ? heroPool
      : nonCloseupProds.length > 0
        ? nonCloseupProds
        : candidateRefs;

  const usagePool = candidateRefs.filter(isEarbudOrUsageView);
  const closeupPool = candidateRefs.filter(isInnerCloseup);
  const packagePool = candidateRefs.filter(isPackageOrAccessory);

  const hint = topicHint || '';

  // 1. Static public-mold screen with common assets available: prioritize common asset + detail view
  if (layerType === 'static' && commonPool.length > 0) {
    const firstCommon =
      commonPool.find((r) => /拆解|结构|微距|细节|佩戴|公模|通用/.test(`${r.tag || ''} ${r.name || ''}`) && hint.includes('拆解')) ||
      commonPool[(screenNum - 1) % commonPool.length] ||
      commonPool[0];
    const secondCommon =
      commonPool.find((r) => r.id !== firstCommon.id) ||
      primaryHeroList.find((r) => r.id !== firstCommon.id);
    return secondCommon ? [firstCommon, secondCommon] : [firstCommon];
  }

  // 2. Exploded view / diaphragm / internal structure / ingredient / craftsmanship close-up
  if (/爆炸|拆解|振膜|动圈|腔体|内部结构|声学拆解|核心成分|微距|工艺细节|材质解析/.test(hint)) {
    const bestDetail =
      closeupPool[0] || usagePool[0] || primaryHeroList[0] || candidateRefs[0];
    const bestHero = primaryHeroList.find((r) => r.id !== bestDetail.id);
    return bestHero ? [bestDetail, bestHero] : [bestDetail];
  }

  // 3. Wearing comfort / ergonomic / usage experience
  if (/佩戴|人体工学|半入耳|云感|耳廓|轻盈|无感|上身|使用体验|亲肤|握持/.test(hint)) {
    const bestUsage =
      usagePool.find((r) => !isInnerCloseup(r)) ||
      usagePool[0] ||
      closeupPool[0] ||
      primaryHeroList[0];
    const bestHero = primaryHeroList.find((r) => r.id !== bestUsage.id);
    return bestHero ? [bestUsage, bestHero] : [bestUsage];
  }

  // 4. Package contents / specs table / accessories / protection case
  if (/参数|清单|包装|全家福|配件|保护壳|规格/.test(hint)) {
    const bestPkg = packagePool[0] || primaryHeroList[0];
    const secondHero = primaryHeroList.find((r) => r.id !== bestPkg.id);
    return secondHero ? [bestPkg, secondHero] : [bestPkg];
  }

  // 5. Dual-podium / multi-style / Screen 1 Hero KV
  if (/双展台|双款|多款|合集|矩阵|首焦|首屏|KV/.test(hint) || screenNum === 1) {
    const firstHero = primaryHeroList[0];
    const secondHero =
      primaryHeroList[1] ||
      nonCloseupProds.find((r) => r.id !== firstHero.id) ||
      usagePool.find((r) => r.id !== firstHero.id);
    return secondHero ? [firstHero, secondHero] : [firstHero];
  }

  // 6. General feature screens: rotate gently across primaryHeroList so different screens showcase rich angles
  const heroIdx = (screenNum - 1) % primaryHeroList.length;
  const chosenHero = primaryHeroList[heroIdx] || primaryHeroList[0];
  const companion =
    primaryHeroList.find((r) => r.id !== chosenHero.id) ||
    usagePool.find((r) => r.id !== chosenHero.id && !isInnerCloseup(r));
  return companion ? [chosenHero, companion] : [chosenHero];
}

interface ParsedPlanScreenBlock {
  screenNum: number;
  rawTitle: string;
  mainHeadline: string;
  subHeadline: string;
  bullets: string[];
  bottomCopy: string;
  visualScene: string;
  rawBlock: string;
}

/**
 * Extracts brand name, product category/subject, parsed selling points from `productInfoText`,
 * and per-screen copy blocks from `fullPlanDoc`.
 */
function extractProductAndPlanContext(
  productInfoText: string,
  fullPlanDoc: string,
  prodRefs: ReferenceImageItem[] = []
): {
  brandName: string;
  brandHeader: string;
  productSubjectName: string;
  isEarphoneCategory: boolean;
  parsedSellingPoints: string[];
  specsSummary: string;
  packageSummary: string;
  planScreens: ParsedPlanScreenBlock[];
} {
  const prodTagsCombined = prodRefs
    .map((p) => `${p.tag || ''} ${p.name || ''}`)
    .join(' ');
  const combined = `${productInfoText || ''}\n${fullPlanDoc || ''}\n${prodTagsCombined}`;

  const isEarphoneCategory =
    /耳机|充电仓|耳柄|半入耳|入耳式|声学|动圈|振膜|蓝牙\s*6\.0|蓝牙\s*5\.|Ear['’]?sir|耳朵先森|TWS/i.test(
      combined
    ) || !combined.trim();

  // Extract brand name dynamically
  const brandMatch =
    combined.match(/(?:品牌|品牌名|Brand)[：:\s]*([^\n|｜;；，,\]】]{2,24})/i) ||
    combined.match(/【([^】\n]{2,14}(?:旗舰|官方|正版|工作室|品牌|先森|优品|美妆|科技|生活|家居|服饰|数码))】/) ||
    combined.match(/(Ear['’]?sir\s*耳朵先森|耳朵先森|迪士尼正版授权)/i);

  const brandName =
    brandMatch?.[1]?.trim() ||
    (isEarphoneCategory ? 'Ear’sir 耳朵先森' : '官方旗舰品牌');

  // Extract product subject name from productInfoText or #Prod tags
  const subjectMatch =
    combined.match(/(?:产品名称|商品名称|品名|产品|型号)[：:\s]*([^\n|｜;；，,\]】]{2,28})/) ||
    prodRefs
      .map((p) => (p.tag || p.name || '').replace(/\.(png|jpg|jpeg|webp)$/i, '').trim())
      .find((t) => t.length >= 2 && !/^Prod-\d+$/i.test(t));

  const productSubjectName =
    (typeof subjectMatch === 'string'
      ? subjectMatch
      : subjectMatch?.[1]?.trim()) ||
    (isEarphoneCategory ? '无线蓝牙耳机与充电仓组合' : '自有核心主打商品');

  const hasDisney = /迪士尼|Disney|正版授权/i.test(combined);
  const brandHeader = hasDisney
    ? `${brandName} · 正版授权潮玩旗舰`
    : isEarphoneCategory
      ? `${brandName} · 官方正品声学旗舰`
      : `${brandName} · 官方正品旗舰店`;

  // Parse free-form selling points from productInfoText so that even when fullPlanDoc is empty,
  // user's own selling points are distributed across screens!
  const rawInfoLines = (productInfoText || '')
    .split(/[\n；;]+/)
    .map((line) =>
      line
        .replace(/^\s*(?:[-*•·]|\d+[.、)）]|卖点\s*\d*[：:]?)\s*/, '')
        .trim()
    )
    .filter(
      (line) =>
        line.length >= 3 &&
        !/^(?:品牌|产品名称|商品名称|包装清单|底部参数表)/.test(line)
    );

  const parsedSellingPoints: string[] = [];
  for (const line of rawInfoLines) {
    const parts = line
      .split(/\s*[｜|]\s*/)
      .map((s) => s.trim())
      .filter((s) => s.length >= 3);
    if (parts.length > 1) {
      parsedSellingPoints.push(...parts);
    } else {
      parsedSellingPoints.push(line);
    }
  }

  const specsMatch =
    combined.match(/底部参数表与清单\s*[\[【：:]([^\]】\n]+)/) ||
    combined.match(/(?:核心参数|产品参数|规格参数)[：:\s]*([^\n]+)/);
  const specsSummary =
    specsMatch?.[1]?.trim() ||
    (isEarphoneCategory
      ? `品牌: ${brandName} ｜ 蓝牙版本: 蓝牙6.0+EDR ｜ 音频解码: AAC/SBC ｜ 延迟: 40ms超低延迟 ｜ 续航: 单次约4h / 总续航20h+`
      : parsedSellingPoints.length > 0
        ? `品牌: ${brandName} ｜ 核心亮点: ${parsedSellingPoints.slice(0, 4).join(' ｜ ')}`
        : `品牌: ${brandName} ｜ 品名: ${productSubjectName} ｜ 品质等级: 官方正品旗舰标准`);

  const pkgMatch = combined.match(/(?:包装清单|标配清单|装箱清单)[：:\s]*([^\n\]】;；]+)/);
  const packageSummary =
    pkgMatch?.[1]?.trim() ||
    (isEarphoneCategory
      ? '无线蓝牙耳机1对、充电仓1个、专用保护壳1个、Type-C充电线1条、说明书1份'
      : `${productSubjectName} 主体 × 1、官方原装包装盒 × 1、说明书与品质保障卡 × 1`);

  // Split fullPlanDoc into screen blocks if present
  const planScreens: ParsedPlanScreenBlock[] = [];
  if (fullPlanDoc && fullPlanDoc.trim()) {
    const cleanedDoc = fullPlanDoc
      .replace(/第\s*(\d+)\s*屏\s*[·•-]\s*主图\s*\d+/g, '第$1屏·')
      .replace(/【主图\s*\d+\s*】/g, '');
    const regex =
      /(?:^|\n)\s*(?:#+\s*|\*\*|【)?第\s*(\d+)\s*屏[·•：:\s-]*([^\n】*]*)(?:】|\*\*)?([\s\S]*?)(?=(?:\n\s*(?:#+\s*|\*\*|【)?第\s*\d+\s*屏)|$)/g;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(cleanedDoc)) !== null) {
      const sNum = parseInt(match[1], 10) || planScreens.length + 1;
      const rawTitle = (match[2] || '').replace(/主图\s*\d+\s*/g, '').trim();
      const body = (match[3] || '').trim();

      const mainM =
        body.match(/主标题\s*[\[【：:"“]([^\]】\n"”;；]+)/) ||
        body.match(/大标题\s*[\[【：:"“]([^\]】\n"”;；]+)/);
      const subM =
        body.match(/副标题(?:\/卖点标签)?\s*[\[【：:"“]([^\]】\n"”;；]+)/) ||
        body.match(/卖点标签\s*[\[【：:"“]([^\]】\n"”;；]+)/);
      const botM =
        body.match(
          /底部(?:胶囊卡片|参数胶囊|三标|方标|参数表与清单|落款|标签)\s*[\[【：:"“]([^\]】\n"”]+)/
        ) || body.match(/胶囊卡片\s*[\[【：:"“]([^\]】\n"”]+)/);
      const sceneM = body.match(
        /(?:视觉场景与构图|场景氛围|视觉提示词|画面构图)\s*[\[【：:]([^\n]+)/
      );

      const mainHeadline =
        mainM?.[1]?.trim() ||
        (!isLayoutSkeletonLabel(rawTitle) ? rawTitle : '');
      const subHeadline = subM?.[1]?.trim() || '';
      const bottomCopy = botM?.[1]?.trim() || '';
      const visualScene = sceneM?.[1]?.trim() || '';

      planScreens.push({
        screenNum: sNum,
        rawTitle,
        mainHeadline,
        subHeadline,
        bullets: subHeadline
          .split(/\s*[｜|·•/，,]+\s*/)
          .map((s) => s.trim())
          .filter(Boolean),
        bottomCopy,
        visualScene,
        rawBlock: body,
      });
    }
  }

  return {
    brandName,
    brandHeader,
    productSubjectName,
    isEarphoneCategory,
    parsedSellingPoints,
    specsSummary,
    packageSummary,
    planScreens,
  };
}

/**
 * Synthesizes authentic e-commerce marketing copywriting, container-matched typographyPlan,
 * and concrete visualPrompt for a given screen by combining:
 * 1) Real product selling points & fullPlanDoc (`productInfoText`, `fullPlanDoc`, `#Prod` tags)
 * 2) The bound #Case's reverse-engineered layout skeleton DNA (`extractedLayoutDna` & `tag`)
 *    filtered strictly by the user's checked `caseDimensions` (`pose`, `style`, `structure`, `content`, `copy_text`, `lighting`)!
 * 3) Smartly matched #Prod reference images respecting `layerType` and `isCommonAsset`
 */
export function synthesizeScreenFromCaseAndPlan(options: {
  screenNum: number;
  matchedCase?: ReferenceImageItem;
  matchedSubScreen?: DetectedCaseSubScreen | FlattenedLogicalScreenItem;
  prodRefs: ReferenceImageItem[];
  productInfoText: string;
  fullPlanDoc: string;
  enableStaticLayering: boolean;
  aspectRatio: AspectRatioOption;
  imageSize: ImageSizeOption;
  textMode: TextRenderMode;
  existingTaskId?: string;
  unifiedVisualSpec?: string;
  isLockBaseSwap?: boolean;
}): ScreenTask {
  const {
    screenNum,
    matchedCase,
    matchedSubScreen,
    prodRefs,
    productInfoText,
    fullPlanDoc,
    enableStaticLayering,
    aspectRatio,
    imageSize,
    textMode,
    existingTaskId,
    unifiedVisualSpec,
    isLockBaseSwap: forceLockBaseSwap,
  } = options;

  const ctx = extractProductAndPlanContext(productInfoText, fullPlanDoc, prodRefs);
  const subScreenCleanTitle = matchedSubScreen?.title
    ? matchedSubScreen.title.replace(/^第\s*\d+\s*屏\s*[·•-]?\s*/i, '').trim()
    : '';
  const caseTagClean =
    subScreenCleanTitle ||
    (matchedCase?.tag
      ? matchedCase.tag.replace(/^第\s*\d+\s*屏\s*[·•-]?\s*/i, '').trim()
      : '');
  const caseDna = (
    matchedSubScreen?.extractedLayoutDna ||
    matchedCase?.extractedLayoutDna ||
    ''
  ).trim();
  const combinedCaseHint = `${caseTagClean} ${caseDna}`;

  const effectiveLockBaseSwap = Boolean(
    forceLockBaseSwap || isExplicitLockBaseSwapCase(matchedCase)
  );

  // Inspect user's checked 6-dimension tags on matchedCase (analysis stage extraction scope)
  const selectedDims: CaseRefDimension[] =
    matchedCase &&
    Array.isArray(matchedCase.caseDimensions) &&
    matchedCase.caseDimensions.length > 0
      ? matchedCase.caseDimensions
      : ['style', 'structure', 'content', 'lighting'];

  const hasPose = selectedDims.includes('pose');
  const hasStyle = selectedDims.includes('style');
  const hasStructure = selectedDims.includes('structure');
  const hasContent = selectedDims.includes('content');
  const hasCopyText = selectedDims.includes('copy_text');
  const hasLighting = selectedDims.includes('lighting');

  const layerType: ScreenLayerType = !enableStaticLayering
    ? 'dynamic'
    : screenNum <= 3
      ? 'dynamic'
      : 'static';

  // Determine screen marketing archetype from #Case DNA/tag (or screenNum fallback)
  type ScreenArchetype =
    | 'hero_kv'
    | 'acoustic_explosion'
    | 'spatial_audio'
    | 'ergonomic_wear'
    | 'bluetooth_latency'
    | 'battery_charge'
    | 'multi_sku_ip'
    | 'touch_smart'
    | 'specs_package';

  const detectArchetype = (): ScreenArchetype => {
    if (/参数|清单|规格表|包装清单|信息表/.test(combinedCaseHint)) {
      return 'specs_package';
    }
    if (/爆炸|拆解|振膜|5层|五层|内部结构|腔体拆解|核心成分|微距拆解/.test(combinedCaseHint)) {
      return 'acoustic_explosion';
    }
    if (/佩戴|耳廓|半入耳|云感|人体工学|轻盈|单耳重|上身|亲肤|使用体验/.test(combinedCaseHint)) {
      return 'ergonomic_wear';
    }
    if (/蓝牙|延迟|游戏|闪连|芯片|6\.0|抗干扰|同步|核心性能|黑科技/.test(combinedCaseHint)) {
      return 'bluetooth_latency';
    }
    if (/续航|充电|电量|待机|20h|小时|快充|持久|耐用/.test(combinedCaseHint)) {
      return 'battery_charge';
    }
    if (/触控|指纹|开盖即连|兼容|操作|通话|降噪|多场景|细节品质/.test(combinedCaseHint)) {
      return 'touch_smart';
    }
    if (/多款|合集|矩阵|全家福|花色|保护壳|款式/.test(combinedCaseHint)) {
      return 'multi_sku_ip';
    }
    if (
      /声学|音效|音质|全景|环绕|Hi-Fi|调音|三频|核心功效|深度解析/.test(combinedCaseHint) &&
      screenNum > 1
    ) {
      return 'spatial_audio';
    }
    if (screenNum === 1 || /首屏|首焦|KV|拱门|双展台/.test(combinedCaseHint)) {
      return 'hero_kv';
    }
    const order: ScreenArchetype[] = [
      'hero_kv',
      'acoustic_explosion',
      'spatial_audio',
      'ergonomic_wear',
      'bluetooth_latency',
      'battery_charge',
      'multi_sku_ip',
      'touch_smart',
      'specs_package',
    ];
    return order[(screenNum - 1) % order.length];
  };

  const archetype = detectArchetype();

  const archetypeKeywords: Record<ScreenArchetype, RegExp> = {
    hero_kv: /首屏|KV|颜值|爆款|首焦|登场|潮玩|主视觉/,
    acoustic_explosion: /拆解|爆炸|动圈|振膜|腔体|声学结构|结构|成分|工艺/,
    spatial_audio: /全景|音效|环绕|音质|声场|三频|核心卖点/,
    ergonomic_wear: /佩戴|人体工学|云感|半入耳|轻盈|体验|舒适/,
    bluetooth_latency: /蓝牙|延迟|6\.0|芯片|游戏|闪连|性能/,
    battery_charge: /续航|快充|电量|20h|持久|耐用/,
    multi_sku_ip: /多款|图案|合集|花色|保护壳|礼盒|款式/,
    touch_smart: /触控|开盖|秒连|兼容|操作|场景/,
    specs_package: /参数|清单|包装|规格/,
  };

  const matchedPlanBlock =
    ctx.planScreens.find((p) =>
      archetypeKeywords[archetype].test(
        `${p.rawTitle} ${p.mainHeadline} ${p.subHeadline}`
      )
    ) || ctx.planScreens[screenNum - 1];

  const archetypeDefaults: Record<
    ScreenArchetype,
    {
      moduleTitle: string;
      mainHeadline: string;
      subHeadline: string;
      threeBadges: [string, string, string];
      threeCapsules: [string, string, string];
      productActionDesc: string;
      redesignedSceneDesc: string;
    }
  > = {
    hero_kv: {
      moduleTitle: '高颜值潮玩声学首焦KV',
      mainHeadline: '天生焦点 听见潮流新声',
      subHeadline: '原创定制外观 ｜ HIFI级鲸腔立体声 ｜ 蓝牙6.0旗舰闪连',
      threeBadges: [
        '[正版潮玩设计] 高颜值定制外观与专属保护壳',
        '[360°全景声效] 13mm复合振膜澎湃动圈',
        '[20h持久续航] 全天候音乐陪伴不断电',
      ],
      threeCapsules: [
        '[定制潮玩美学] 精致UV印花配专属保护壳',
        '[HIFI全景音质] 13mm大动圈三频均衡',
        '[蓝牙6.0闪连] 开盖秒连稳定不卡顿',
      ],
      productActionDesc:
        '在画面黄金视觉中心的高低双层几何展台上完整陈列自有产品 #Prod【充电仓主机（带表面定制图案与专属保护壳）+ 成对蓝牙耳机主体】，产品身份与外观造型100%以自有 #Prod 实拍图为准',
      redesignedSceneDesc:
        '全新设计现代高定商业展台场景：采用温润细腻的肌理台面搭配极简几何层次背板与柔和轮廓光晕（保持整页色调与质感统一，不照搬竞品原图的罗马柱拱门或具体道具坐标）',
    },
    acoustic_explosion: {
      moduleTitle: '13mm复合振膜声学结构拆解',
      mainHeadline: '13mm 高分子复合振膜动圈',
      subHeadline: '五层声学腔体精密调校 ｜ 低音澎湃下潜 ｜ 人声清澈通透',
      threeBadges: [
        '[高分子复合振膜] 双单元高解析澎湃动圈',
        '[Hi-Fi无损声学] 影院级宽广立体声场',
        '[AAC高清解码] 丰富音乐细节真实还原',
      ],
      threeCapsules: [
        '[13mm复合振膜] 强劲低频回弹有力',
        '[五层声学腔体] 精密导音减少谐振失真',
        '[AAC/SBC解码] 还原录音室级纯净人声',
      ],
      productActionDesc:
        '画面中央呈斜向立体悬浮展示自有产品 #Prod 蓝牙耳机的【五层精密声学爆炸拆解结构】（依次拆解展现耳机前腔出音网孔外壳、13mm高分子复合振膜、高磁通量磁环、定制声学音腔与耳机后腔耳柄，外观与标识100%以自有 #Prod 为准）',
      redesignedSceneDesc:
        '全新设计声学科技商业空间：纯净渐变流体光影背景配合精细金丝声波轨迹（保持整页统一色调与材质语言，不照搬竞品原图具体背景道具）',
    },
    spatial_audio: {
      moduleTitle: '360°全景环绕空间音效',
      mainHeadline: '360° 全景环绕空间音效',
      subHeadline: '大师级三频均衡调音 ｜ 沉浸式立体声场 ｜ 临场感拉满',
      threeBadges: [
        '[360°空间环绕] 全方位立体声场包裹',
        '[三频均衡调校] 高音通透低音浑厚饱满',
        '[高清双耳通话] 智能滤除环境嘈杂噪音',
      ],
      threeCapsules: [
        '[360°全景环绕音] 身临其境的剧场级听感',
        '[高解析大动圈] 澎湃低音与细腻人声兼备',
        '[AAC高清音频] 丝滑细腻无损听觉享受',
      ],
      productActionDesc:
        '在中央艺术几何展台上精致摆放自有产品 #Prod【充电仓主机与成对蓝牙耳机】，四周环绕细腻的声波涟漪与立体光效，直观展现360°环绕声场能量',
      redesignedSceneDesc:
        '全新设计声学环绕展台布景：采用同色系现代极简圆柱展台与柔和环形声场光晕，空间层次通透干净',
    },
    ergonomic_wear: {
      moduleTitle: '人体工学半入耳云感佩戴',
      mainHeadline: '云感半入耳 久戴不胀痛',
      subHeadline: '轻量化工学曲面贴合耳廓 ｜ 零压迫轻盈稳固 ｜ 狂甩不掉',
      threeBadges: [
        '[人体工学曲面] 贴合亚洲人耳廓弧度',
        '[羽感轻量机身] 单耳轻盈仿若无物',
        '[稳固舒适贴合] 运动通勤全天舒适佩戴',
      ],
      threeCapsules: [
        '[半入耳云感设计] 不挑耳型久戴耳朵不酸痛',
        '[黄金配重支撑] 三点贴合耳廓稳固不易掉',
        '[亲肤温润材质] 细腻抛光机身舒适透气',
      ],
      productActionDesc:
        '中部主视觉突出展示自有产品 #Prod 半入耳式蓝牙耳机的【流线型人体工学曲面耳头与轻盈佩戴贴合状态】，耳机外观、弧度与配色100%以自有 #Prod 实拍图为准',
      redesignedSceneDesc:
        '全新设计云感舒适主题布景：采用柔和晨光质感背景与温润亲肤材质台面，传递轻盈零压迫的佩戴氛围（不照搬竞品原图特定人物或窗帘道具）',
    },
    bluetooth_latency: {
      moduleTitle: '全新蓝牙6.0旗舰芯与40ms低延迟',
      mainHeadline: '全新蓝牙6.0 40ms超低延迟',
      subHeadline: '开盖秒速闪连 ｜ 强抗干扰不断连 ｜ 游戏追剧音画同步',
      threeBadges: [
        '[蓝牙6.0+EDR] 新一代高速稳定传输芯',
        '[40ms超低延迟] 听声辨位音画零感同步',
        '[10米稳定连接] 复杂环境依然流畅不卡顿',
      ],
      threeCapsules: [
        '[蓝牙6.0旗舰芯] 传输速率翻倍功耗更低',
        '[40ms赛事级低延迟] 游戏吃鸡听声辨位快人一步',
        '[霍尔开盖闪连] 配对一次开盖自动秒连',
      ],
      productActionDesc: hasPose
        ? '参考案例提取的主体朝向与组合关系，展示自有产品 #Prod【充电仓主机与成对蓝牙耳机组合】（产品身份、造型与表面图案100%以自有 #Prod 实拍图为准，不继承竞品外形），呈现蓝牙6.0高速闪连与40ms低延迟性能'
        : '严格按自有产品 #Prod 实拍图固有的开合状态与透视角度展示【充电仓主机与成对蓝牙耳机】（未提取案例主体姿态），周围环绕简洁科技声波脉冲以凸显蓝牙6.0与40ms超低延迟',
      redesignedSceneDesc:
        '全新设计低延迟疾速科技感展台布景：采用同色系现代流线型展台搭配轻盈的几何能量光轨（保持整页色调与光影统一，不照搬竞品原图的手机游戏屏、迷你石柱、礼盒或米奇公仔道具）',
    },
    battery_charge: {
      moduleTitle: '20h澎湃长续航与Type-C闪充',
      mainHeadline: '20小时长续航 全天不断电',
      subHeadline: '单次畅听约4小时 ｜ 搭配充电仓总续航20h+ ｜ Type-C便捷快充',
      threeBadges: [
        '[约4h单次续航] 沉浸音乐一路随行',
        '[20h+复合总续航] 大容量充电仓随时补能',
        '[Type-C安全快充] 高效蓄电告别电量焦虑',
      ],
      threeCapsules: [
        '[单次畅听约4h] 满足日常通勤与专注学习',
        '[20h+超长总续航] 充电仓多次补能跨日无忧',
        '[低功耗电源管理] 智能休眠待机持久耐用',
      ],
      productActionDesc:
        '在展台中央展示自有产品 #Prod【充电仓主机与双耳】，周围环绕柔和的能量光环，直观传递20小时持久续航',
      redesignedSceneDesc:
        '全新设计充沛能量主题展台：采用细腻几何层叠底座与温暖通透的光影渐变，保持整页视觉规范统一',
    },
    multi_sku_ip: {
      moduleTitle: '多款潮玩印花与专属保护壳',
      mainHeadline: '高颜值潮玩出街 专属保护壳随行',
      subHeadline: '高清防刮定制印花 ｜ 软萌防摔保护套 ｜ 自用送礼皆出彩',
      threeBadges: [
        '[高清定制印花] 色彩饱满耐磨不掉色',
        '[专属防摔保护壳] 全包贴合防尘防磕碰',
        '[高颜值礼盒包装] 拆盒即享满格仪式感',
      ],
      threeCapsules: [
        '[原创潮玩外观] 出街吸睛彰显个性态度',
        '[附赠专用保护壳] 贴心守护机身历久弥新',
        '[精致伴手好礼] 颜值与实力兼具的心动礼物',
      ],
      productActionDesc:
        '错落有致地展示自有产品 #Prod【充电仓主机、专用保护壳与耳机主体】的多角度陈列，100%还原自有产品印花细节与配件质感',
      redesignedSceneDesc:
        '全新设计潮玩美学陈列空间：采用现代极简高低几何展台与柔和立体漫反射布光，凸显产品颜值',
    },
    touch_smart: {
      moduleTitle: '灵敏指尖触控与全平台广泛兼容',
      mainHeadline: '灵敏感应触控 一触即达',
      subHeadline: '切歌/接听/唤醒语音助手随心控 ｜ 苹果安卓手机平板全兼容',
      threeBadges: [
        '[指纹轻触操控] 告别按压耳道不适感',
        '[单双耳无缝切换] 左右耳独立主机随拿随用',
        '[多设备广泛兼容] 支持iOS/Android/鸿蒙/Windows',
      ],
      threeCapsules: [
        '[盲操防误触设计] 轻触耳柄即可切歌接听电话',
        '[主从切换自如] 单耳佩戴或双耳立体声无缝衔接',
        '[有蓝牙就能连] 手机、平板、笔记本电脑全面兼容',
      ],
      productActionDesc:
        '特写展示自有产品 #Prod 蓝牙耳机耳柄触控感应区（带柔和触控波纹光点）与充电仓主机组合，外观100%以 #Prod 为准',
      redesignedSceneDesc:
        '全新设计极简智慧交互商业背景：干净通透的同色系浅景深空间配柔和轮廓光',
    },
    specs_package: {
      moduleTitle: '产品核心参数与包装清单',
      mainHeadline: '产品核心参数与包装清单',
      subHeadline: `${ctx.brandName} · 官方正品品质保证`,
      threeBadges: [
        `[品牌型号] ${ctx.brandName} ${ctx.isEarphoneCategory ? '无线蓝牙耳机' : ctx.productSubjectName}`,
        ctx.isEarphoneCategory
          ? '[蓝牙与解码] 蓝牙6.0+EDR ｜ AAC/SBC高清解码'
          : `[核心卖点] ${ctx.parsedSellingPoints[0] || '官方正品严选品质'}`,
        ctx.isEarphoneCategory
          ? '[延迟与续航] 40ms低延迟 ｜ 单次4h/总续航20h+'
          : `[包装清单] ${ctx.packageSummary}`,
      ],
      threeCapsules: [
        `[基本参数] ${ctx.specsSummary}`,
        ctx.isEarphoneCategory
          ? '[声学与续航] 解码：AAC/SBC ｜ 延迟：40ms ｜ 续航：单次约4h/总20h+'
          : `[品质保障] ${ctx.brandHeader}`,
        `[包装清单] ${ctx.packageSummary}`,
      ],
      productActionDesc: ctx.isEarphoneCategory
        ? '整齐陈列自有产品 #Prod【充电仓主机、耳机1对、专用保护壳、充电线与包装盒】官方标配全家福，下方配合清晰规整的参数信息表与清单模块'
        : `整齐陈列自有产品 #Prod【${ctx.productSubjectName}与标配包装清单】，下方配合清晰规整的参数信息表与清单模块`,
      redesignedSceneDesc:
        '全新设计规整产品参数陈列台面：干净高级的同色系商业展台与清晰的信息分区留白',
    },
  };

  let def = archetypeDefaults[archetype];

  // If product is NOT an earphone OR user provided custom selling points in `productInfoText` without `fullPlanDoc`,
  // dynamically adapt `def` so we never force earphone copy onto non-earphone products or ignore `productInfoText`!
  if (!ctx.isEarphoneCategory || (ctx.planScreens.length === 0 && ctx.parsedSellingPoints.length > 0)) {
    const pts = ctx.parsedSellingPoints;
    const primaryPt =
      pts[(screenNum - 1) % Math.max(1, pts.length)] ||
      caseTagClean ||
      `${ctx.brandName} 核心品质卖点`;
    const ptA = pts[(screenNum - 1) % Math.max(1, pts.length)] || '匠心严选材质';
    const ptB = pts[screenNum % Math.max(1, pts.length)] || '高定美学设计';
    const ptC = pts[(screenNum + 1) % Math.max(1, pts.length)] || '官方正品保障';
    const genericModuleTitle =
      caseTagClean && !isLayoutSkeletonLabel(caseTagClean)
        ? caseTagClean
        : screenNum === 1
          ? '旗舰首屏KV·核心卖点登场'
          : archetype === 'specs_package'
            ? '产品核心参数与包装清单'
            : `核心卖点深度解析·${primaryPt.slice(0, 12)}`;

    if (!ctx.isEarphoneCategory) {
      def = {
        moduleTitle: genericModuleTitle,
        mainHeadline:
          archetype === 'specs_package'
            ? '产品核心参数与包装清单'
            : primaryPt.slice(0, 18),
        subHeadline: `${ptA} ｜ ${ptB} ｜ ${ptC}`,
        threeBadges: [
          `[核心亮点] ${ptA}`,
          `[匠心品质] ${ptB}`,
          `[正品保障] ${ptC}`,
        ],
        threeCapsules: [
          `[卖点解析] ${ptA}`,
          `[细节亮点] ${ptB}`,
          `[安心之选] ${ptC}`,
        ],
        productActionDesc: hasPose
          ? `参考案例提取的主体朝向与组合关系，在画面核心视觉区完整呈现自有产品 #Prod【${ctx.productSubjectName}】，产品身份、外观造型、材质与图案细节100%以自有 #Prod 实拍图为准`
          : `在画面核心视觉区按自有产品 #Prod 实拍图固有造型与细节完整呈现【${ctx.productSubjectName}】，100%还原真实外观与表面纹理细节`,
        redesignedSceneDesc:
          '全新设计现代高定商业展台场景：采用与自有产品调性匹配的肌理台面、极简几何背板与柔和商业轮廓光（保持整页色调与质感统一，不照搬竞品原图具体背景道具或坐标）',
      };
    } else if (ctx.planScreens.length === 0 && pts.length > 0 && archetype !== 'specs_package') {
      // Earphone product with user's custom productInfoText selling points (no fullPlanDoc yet)
      def = {
        ...def,
        mainHeadline: primaryPt.length <= 18 ? primaryPt : def.mainHeadline,
        subHeadline:
          pts.length >= 2 ? `${ptA} ｜ ${ptB} ｜ ${ptC}` : def.subHeadline,
        threeCapsules: [
          `[核心亮点] ${ptA}`,
          `[品质优势] ${ptB}`,
          `[旗舰体验] ${ptC}`,
        ],
      };
    }
  }

  // User-specified copywriting in fullPlanDoc/productInfoText ALWAYS takes top priority;
  // When `copy_text` (文案内容) is checked, we extract the selling-point theme & expression structure from #Case
  // and rewrite it 100% using our own product data (never transplanting competitor parameters or promises!).
  const resolvedMainHeadline =
    matchedPlanBlock?.mainHeadline &&
    !isLayoutSkeletonLabel(matchedPlanBlock.mainHeadline) &&
    !/Brand Header|核心卖点大标题/.test(matchedPlanBlock.mainHeadline)
      ? matchedPlanBlock.mainHeadline
      : def.mainHeadline;

  const resolvedSubHeadline =
    matchedPlanBlock?.subHeadline &&
    !isLayoutSkeletonLabel(matchedPlanBlock.subHeadline) &&
    !/核心卖点1/.test(matchedPlanBlock.subHeadline)
      ? matchedPlanBlock.subHeadline
      : def.subHeadline;

  const selectedProds = selectBestProdRefsForScreen(
    screenNum,
    `${archetype} ${combinedCaseHint} ${resolvedMainHeadline}`,
    prodRefs,
    layerType
  );

  const refIds: string[] = [
    ...selectedProds.map((p) => p.id),
    ...(matchedCase ? [matchedCase.id] : []),
  ];

  const caseCodeStr = `#${matchedCase?.code || `Case-${screenNum}`}`;

  const isThreeSquareBadges =
    /三标|三列圆角方标|三个方标|3个.*圆角方框|认证徽章/.test(combinedCaseHint);
  const isThreeEqualCapsules =
    /三等分胶囊|底栏三|三列胶囊|三个胶囊|大圆角胶囊框/.test(combinedCaseHint);
  const isLeftTextRightEarCard =
    /左文右3D耳模|左文右耳|底栏耳模卡片|耳模卡片/.test(combinedCaseHint);
  const isSpecsTable =
    archetype === 'specs_package' ||
    /参数表|包装清单|信息表/.test(combinedCaseHint);

  const hasExplicitBottomContainer =
    isThreeSquareBadges ||
    isThreeEqualCapsules ||
    isLeftTextRightEarCard ||
    isSpecsTable ||
    /底部.*(?:胶囊|卡片|三标|方标|徽章|横卡|白卡|圆角卡|参数表|清单)|底栏/.test(
      combinedCaseHint
    );

  const isNoBottomCapsuleContainer =
    /无封闭容器|无繁复容器|居中无框|无框排版|地面版权区|落款区/.test(
      combinedCaseHint
    ) || !hasExplicitBottomContainer;

  let bottomTypographyLine = '';
  let bottomVisualInstruction = '';

  const copyExpressionNote = hasCopyText
    ? `（已提取 ${caseCodeStr} 卖点主题与「主标痛点直击+副标核心利益+分组卖点印证」表达结构，100%依据自有产品资料重写，不移植竞品参数）`
    : '';

  if (effectiveLockBaseSwap && matchedCase) {
    // Explicit Lock-Base Swap mode: lock background, layout, and typography 100% to #Case, replacing product subject & our brand/copy
    const lockBottomCopy =
      matchedPlanBlock?.bottomCopy || def.threeCapsules.join(' ｜ ');
    bottomTypographyLine = `🔒锁底换款文案排版（100%锁定 ${caseCodeStr} 版式坐标与容器样式）：${lockBottomCopy}`;
    bottomVisualInstruction = `【🔒锁底换款排版指令】：100%锁定 ${caseCodeStr} 原图的文字坐标、字体层级与底部容器样式，顶部标头渲染为「${ctx.brandHeader}」，主标题渲染为「${resolvedMainHeadline}」，副标题渲染为「${resolvedSubHeadline}」，底部卖点区渲染我方卖点「${lockBottomCopy}」`;
  } else if (!hasContent) {
    bottomTypographyLine = `排版方式：现代商业极简无框排版（未提取案例文案版式）${copyExpressionNote}`;
    bottomVisualInstruction = `顶部居中或左对齐清晰排版品牌标头「${ctx.brandHeader}」、大号主标题「${resolvedMainHeadline}」与副标题「${resolvedSubHeadline}」（未从 ${caseCodeStr} 提取文案版式，采用干净现代的无衬线商业字体层级与规整留白）`;
  } else if (isSpecsTable) {
    bottomTypographyLine = `底部参数表与包装清单${copyExpressionNote}：${ctx.specsSummary} ｜ 包装清单：${ctx.packageSummary}`;
    bottomVisualInstruction = `底部区域参考参数信息表分区规律，清晰规整排版我方中文参数表与包装清单（${ctx.specsSummary}；包装清单：${ctx.packageSummary}），严禁移植任何竞品品牌名或竞品参数`;
  } else if (isThreeSquareBadges) {
    const badgesText = def.threeBadges.join(' ｜ ');
    bottomTypographyLine = `底部三列卖点徽章区${copyExpressionNote}：${badgesText}`;
    bottomVisualInstruction = `上部标题区清晰排版大字主标题「${resolvedMainHeadline}」与副标题「${resolvedSubHeadline}」（参考字体性格、字号对比与对齐间距）；底部卖点区采用三列均衡圆角徽章排版我方自有产品卖点：${badgesText}（100%使用我方产品参数，严禁出现任何竞品英文词或竞品承诺）`;
  } else if (isLeftTextRightEarCard && ctx.isEarphoneCategory) {
    const earCardCopy =
      '「云感半入耳工学设计」 ｜ 「贴合耳廓弧度 · 零压迫久戴不痛」';
    bottomTypographyLine = `底部圆角图文卖点卡${copyExpressionNote}：${earCardCopy}`;
    bottomVisualInstruction = `上部居中排版品牌标头「${ctx.brandHeader}」、大号主标题「${resolvedMainHeadline}」与副标题「${resolvedSubHeadline}」；底部圆角卖点卡片采用左文右图结构，左侧清晰排版我方卖点「${earCardCopy}」，右侧展示纯净耳廓佩戴贴合示意（严禁照搬竞品IP角标或竞品文字）`;
  } else if (isNoBottomCapsuleContainer) {
    bottomTypographyLine = `底部区域：开阔主视觉留白展示区（无繁复底部卡片）${copyExpressionNote}`;
    bottomVisualInstruction = `上部依次清晰排版顶部标头「${ctx.brandHeader}」、大号主标题「${resolvedMainHeadline}」与副标题「${resolvedSubHeadline}」（遵循提取的字体性格、字号主次层级与行距规律）；下半部保持开阔通透的商品主视觉展示与呼吸留白`;
  } else if (isThreeEqualCapsules) {
    const capsulesText = def.threeCapsules.join(' ｜ ');
    bottomTypographyLine = `底栏三列卖点胶囊区${copyExpressionNote}：${capsulesText}`;
    bottomVisualInstruction = `上部居中分上下两行排版大字主标题「${resolvedMainHeadline}」与副标题「${resolvedSubHeadline}」；底部卖点区采用规整的三等分圆角卖点栏，依次清晰渲染我方核心卖点：${capsulesText}`;
  } else {
    const fallbackBottom =
      matchedPlanBlock?.bottomCopy &&
      !/核心亮点1|参数亮点1/.test(matchedPlanBlock.bottomCopy)
        ? matchedPlanBlock.bottomCopy
        : def.threeCapsules.join(' ｜ ');
    bottomTypographyLine = `底部卖点信息区${copyExpressionNote}：${fallbackBottom}`;
    bottomVisualInstruction = `顶部与主副标题区按清晰的字号层级与对齐间距排版主标题「${resolvedMainHeadline}」与副标题「${resolvedSubHeadline}」；底部卖点区规整呈现我方核心卖点：${fallbackBottom}（100%基于自有产品资料撰写）`;
  }

  const typographyPlan = [
    `顶部标头：${ctx.brandHeader}`,
    `主标题：${resolvedMainHeadline}`,
    `副标题 / 卖点标签：${resolvedSubHeadline}`,
    bottomTypographyLine,
  ]
    .filter(Boolean)
    .join('\n');

  const copywriting = `${resolvedMainHeadline} ｜ ${resolvedSubHeadline}`;

  // Filter extractedLayoutDna strictly according to the user's checked dimensions on matchedCase!
  const filteredDna = filterExtractedDnaByDimensions(
    caseDna,
    selectedDims,
    effectiveLockBaseSwap
  );

  const cleanedLayoutScene = filteredDna
    ? filteredDna
        .replace(/【模块定位】[^；;。]*[；;。]?\s*/g, '')
        .replace(/【信息分区与留白规律】/g, '信息分区与留白规律：')
        .replace(/【几何分区坐标】/g, '信息分区与图文占比：')
        .replace(/【字体性格与排版层级】/g, '字体层级与对齐间距：')
        .replace(/【UI容器与辅助图形】/g, '排版层级与辅助图形：')
        .replace(
          /【场景材质语言与光影色彩关系（具体布景重新设计）】/g,
          '场景材质语言与光影色调：'
        )
        .replace(
          /【场景类型与材质造型语言（具体布景重新设计）】/g,
          '场景类型与材质语言：'
        )
        .replace(/【环境光影与展台】/g, '场景光影与展台：')
        .trim()
    : matchedCase
      ? hasStructure
        ? `参考 ${caseCodeStr} 的信息分区主次、图文占比与四周留白规律重新编排构图`
        : `高质感商业电商竖版海报原创构图`
      : '高质感商业电商竖版海报构图，暖调柔光棚拍质感';

  const prodCodesDesc =
    selectedProds.length > 0
      ? selectedProds
          .map((p) => `#${p.code}（${p.tag || p.name}）`)
          .join(' 与 ')
      : '自有产品实拍图 #Prod';

  const customRuleClause = matchedCase?.caseCustomRule?.trim()
    ? `【⚡独立补充约束（最高优先级）】：${matchedCase.caseCustomRule.trim()}。`
    : '';

  const unifiedSpecClause = unifiedVisualSpec?.trim()
    ? `【整页统一视觉规范】：${unifiedVisualSpec.trim()}。`
    : '';

  let visualPrompt = '';

  if (effectiveLockBaseSwap && matchedCase) {
    visualPrompt = [
      `8K商业级电商详情页竖版海报（${aspectRatio}）。【🔒逐屏锁底换款模式（基准：${caseCodeStr}）】：除替换产品主体与更新我方指定文案外，背景场景、展台结构、光影色调与版式坐标100%锁定 ${caseCodeStr} 原图。`,
      `【自有产品主体替换（唯一产品身份权威源：${prodCodesDesc}）】：将 ${caseCodeStr} 中的竞品主体 100% 定点替换为我方 ${prodCodesDesc}，严格还原我方产品的真实工业外观、结构比例与表面定制图案，忽略 #Prod 原图背景边框。`,
      textMode === 'with_text'
        ? `${bottomVisualInstruction}。`
        : `【纯视觉留白底图模式】：保持 ${caseCodeStr} 的锁底背景与留白区域，不生成文字。`,
      customRuleClause,
    ]
      .filter(Boolean)
      .join('\n');
  } else {
    const bgAndLightingClause = [
      hasStyle
        ? `【本屏场景重新策划（基于提取的场景类型与材质语言重新设计布景）】：${def.redesignedSceneDesc}（借鉴场景材质与造型语言，保持整页风格统一，不100%沿用竞品具体道具、元素坐标或完整构图）`
        : `【本屏原创商业场景（未从案例提取环境背景）】：围绕「${def.moduleTitle}」与自有产品 #Prod 独立设计纯净高级的现代商业摄影棚背景与几何展台`,
      hasLighting
        ? `光影与色彩关系遵循提取的主辅光方向、软硬反差与整页统一色调（不继承竞品场景物件）`
        : `采用柔和立体的商业摄影布光与和谐高级的色彩层次`,
    ].join('；');

    const structureClause = hasStructure
      ? `【本屏版式骨架（提取信息分区、主次层级、图文占比与留白规律重新编排）】：${cleanedLayoutScene}（不直接复制竞品元素像素坐标，画布四周保留至少8%呼吸安全留白）。`
      : `【本屏原创版面编排（未从案例提取版式骨架）】：围绕「${def.moduleTitle}」采用主次分明的现代电商黄金分割构图，画布四周保留至少8%呼吸安全留白。`;

    visualPrompt = [
      `8K商业级电商详情页竖版完整海报（${aspectRatio}）。${unifiedSpecClause}`,
      `${bgAndLightingClause}。`,
      structureClause,
      `【自有产品主体呈现（产品身份唯一权威源：${prodCodesDesc}）】：${def.productActionDesc}，100%还原自有产品的真实工业造型、表面定制印花图案与材质细节（不继承任何竞品身份或外形）。`,
      textMode === 'with_text'
        ? `【屏内中文排版直出指令（文案与参数以自有资料为准，绝不印刷构图术语）】：${bottomVisualInstruction}。`
        : `【纯视觉留白底图模式】：按上述信息分区预留干净的顶部标题留白区与底部卖点留白区，画面中不生成任何文字或UI线框。`,
      customRuleClause,
    ]
      .filter(Boolean)
      .join('\n');
  }

  const subRegionBadge =
    matchedSubScreen && matchedSubScreen.subScreenTotal > 1
      ? ` · ${matchedSubScreen.regionLabel}`
      : '';
  const screenTitle = subScreenCleanTitle
    ? `第${screenNum}屏·${subScreenCleanTitle}`
    : `第${screenNum}屏·${def.moduleTitle}${caseTagClean ? `（${caseTagClean}）` : ''}`;

  // When a sub-screen has its own extractedLayoutDna, pass a virtual case carrying the sub-screen's DNA
  // so `buildClientCaseDimensionDirective` preserves the exact sub-screen DNA!
  const effectiveCaseForBenchmark =
    matchedCase && matchedSubScreen?.extractedLayoutDna
      ? {
          ...matchedCase,
          tag: subScreenCleanTitle || matchedCase.tag,
          extractedLayoutDna: matchedSubScreen.extractedLayoutDna,
        }
      : matchedCase;

  const baseBenchmarkDirective = effectiveCaseForBenchmark
    ? buildClientCaseDimensionDirective(
        [effectiveCaseForBenchmark],
        unifiedVisualSpec,
        'detail'
      )
    : '旗舰店高转化详情视觉基准（整页统一视觉规范）';
  const benchmarkText =
    matchedSubScreen && matchedCase
      ? `【对标来源：${caseCodeStr}${subRegionBadge} · ${subScreenCleanTitle || def.moduleTitle}】${baseBenchmarkDirective}`
      : baseBenchmarkDirective;

  return {
    id: existingTaskId || `screen-auto-${Date.now()}-${screenNum}`,
    screenNumber: screenNum,
    screenCategory: 'detail',
    layerType,
    title: screenTitle,
    sectionType: matchedSubScreen?.sectionType || def.moduleTitle,
    benchmarkCase: benchmarkText,
    copywriting,
    typographyPlan,
    visualPrompt,
    textMode,
    designNotes: effectiveLockBaseSwap
      ? `🔒锁底换款模式：锁定 ${caseCodeStr}${subRegionBadge} 底图，仅替换自有产品 ${selectedProds.map((p) => `#${p.code}`).join('+')}`
      : `已按分析提取维度 [${selectedDims.join('/')}] 重新策划本屏背景/排版/文案，绑定自有产品 ${selectedProds.map((p) => `#${p.code}`).join('+')}（分析来源：${caseCodeStr}${subRegionBadge}）`,
    referenceImageIds: refIds,
    caseDeliveryOverride: effectiveLockBaseSwap ? 'lock_base_swap' : 'inherit',
    aspectRatio,
    imageSize,
    status: 'idle',
    historyImages: [],
  };
}

/**
 * Non-destructively updates a task when the user toggles a #Case dimension checkbox:
 * - If the task's copywriting/title/typographyPlan is polluted or empty, full re-synthesis is used.
 * - If the task already has valid AI-parsed or user-edited copywriting/title/typographyPlan,
 *   we preserve its title, copywriting, and typographyPlan while updating `benchmarkCase`, `designNotes`,
 *   and refreshing the dimension-dependent clauses in `visualPrompt`.
 */
export function refreshTaskOnCaseDimensionChange(options: {
  task: ScreenTask;
  screenNum: number;
  matchedCase: ReferenceImageItem;
  prodRefs: ReferenceImageItem[];
  productInfoText: string;
  fullPlanDoc: string;
  enableStaticLayering: boolean;
  defaultAspectRatio: AspectRatioOption;
  defaultImageSize: ImageSizeOption;
  defaultTextMode: TextRenderMode;
  unifiedVisualSpec: string;
}): ScreenTask {
  const {
    task,
    screenNum,
    matchedCase,
    prodRefs,
    productInfoText,
    fullPlanDoc,
    enableStaticLayering,
    defaultAspectRatio,
    defaultImageSize,
    defaultTextMode,
    unifiedVisualSpec,
  } = options;

  // Detect if the task was bound to a specific sub-screen (e.g. "上半屏 (1/2)")
  const subScreenMatch = (task.benchmarkCase || '').match(
    /【对标来源：#[^\s·]+\s*·\s*([^·】]+?)\s*·\s*([^】]+)】/
  );
  const subRegionLabel = subScreenMatch?.[1]?.trim();
  const matchedSubScreen =
    subRegionLabel && Array.isArray(matchedCase.detectedSubScreens)
      ? matchedCase.detectedSubScreens.find(
          (s) => s.regionLabel === subRegionLabel
        )
      : undefined;

  const synthesized = synthesizeScreenFromCaseAndPlan({
    screenNum,
    matchedCase,
    matchedSubScreen,
    prodRefs,
    productInfoText,
    fullPlanDoc,
    enableStaticLayering,
    aspectRatio: task.aspectRatio || defaultAspectRatio,
    imageSize: task.imageSize || defaultImageSize,
    textMode: task.textMode || defaultTextMode,
    existingTaskId: task.id,
    unifiedVisualSpec,
    isLockBaseSwap: Boolean(matchedCase.isLockBaseSwap),
  });

  const isPolluted = isTaskPollutedByPlaceholdersOrSkeleton(task, matchedCase);
  if (isPolluted) {
    return {
      ...synthesized,
      referenceImageIds: task.referenceImageIds,
      layerType: task.layerType,
      caseDeliveryOverride: task.caseDeliveryOverride,
      resultImageUrl: task.resultImageUrl,
      resultOssUrl: task.resultOssUrl,
      resultCloudUrls: task.resultCloudUrls,
      resultTextNote: task.resultTextNote,
      durationMs: task.durationMs,
      generatedAt: task.generatedAt,
      status: task.status,
      historyImages: task.historyImages,
    };
  }

  // Task has clean AI-parsed or user-edited copywriting/title/typographyPlan -> preserve them!
  let syncedVisualPrompt = synthesized.visualPrompt;
  const existingMainM = (task.typographyPlan || '').match(/主标题[：:\s]*([^\n]+)/);
  const existingSubM = (task.typographyPlan || '').match(
    /副标题[^：:\n]*[：:\s]*([^\n]+)/
  );
  const copyParts = (task.copywriting || '')
    .split(/\s*(?:\n|[｜|])\s*/)
    .map((s) => s.replace(/^(?:主标|副标|卖点)[：:\s]*/, '').trim())
    .filter(Boolean);
  const customMain = existingMainM?.[1]?.trim() || copyParts[0] || '';
  const customSub = existingSubM?.[1]?.trim() || copyParts[1] || '';

  if (customMain && !isLayoutSkeletonLabel(customMain)) {
    syncedVisualPrompt = syncedVisualPrompt.replace(
      /主标题(?:渲染为)?「[^」]+」/g,
      (m) =>
        m.includes('渲染为')
          ? `主标题渲染为「${customMain}」`
          : `主标题「${customMain}」`
    );
  }
  if (customSub && !isLayoutSkeletonLabel(customSub)) {
    syncedVisualPrompt = syncedVisualPrompt.replace(
      /副标题(?:渲染为)?「[^」]+」/g,
      (m) =>
        m.includes('渲染为')
          ? `副标题渲染为「${customSub}」`
          : `副标题「${customSub}」`
    );
  }

  return {
    ...task,
    benchmarkCase: synthesized.benchmarkCase,
    designNotes: synthesized.designNotes,
    visualPrompt: syncedVisualPrompt,
  };
}

/**
 * Builds a concise, render-ready `benchmarkCase` string for `/api/image/generate`.
 * - Preserves sub-screen-specific DNA if `existingBenchmarkCase` was bound to a sub-screen (`上半屏 (1/2)`, etc.).
 * - When `deliveryMode === 'none'` (default: #Case images are NOT sent to the image model),
 *   strips verbose analysis-stage negative meta-rules ("未选中仅代表不从 #Case-X 提取...") so the image model
 *   receives only positive, actionable layout/style/lighting guidance.
 */
export function buildRenderStageBenchmarkSummary(options: {
  analysisCases: ReferenceImageItem[];
  existingBenchmarkCase?: string;
  unifiedVisualSpec?: string;
  deliveryMode: 'none' | 'shared_style' | 'lock_base_swap';
}): string {
  const {
    analysisCases,
    existingBenchmarkCase = '',
    unifiedVisualSpec,
    deliveryMode,
  } = options;

  if (!analysisCases || analysisCases.length === 0) {
    return existingBenchmarkCase;
  }

  // Check if existingBenchmarkCase references a specific sub-screen on analysisCases[0]
  const subScreenMatch = existingBenchmarkCase.match(
    /【对标来源：#[^\s·]+\s*·\s*([^·】]+?)\s*·\s*([^】]+)】/
  );
  const subRegionLabel = subScreenMatch?.[1]?.trim();
  const subTitle = subScreenMatch?.[2]?.trim();

  const casesWithSubScreenDna = analysisCases.map((c, idx) => {
    const isLock =
      deliveryMode === 'lock_base_swap' || Boolean(c.isLockBaseSwap);
    if (
      idx === 0 &&
      subRegionLabel &&
      Array.isArray(c.detectedSubScreens) &&
      c.detectedSubScreens.length > 1
    ) {
      const matchedSub = c.detectedSubScreens.find(
        (s) => s.regionLabel === subRegionLabel
      );
      if (matchedSub?.extractedLayoutDna) {
        return {
          ...c,
          tag: subTitle || matchedSub.title || c.tag,
          extractedLayoutDna: matchedSub.extractedLayoutDna,
          isLockBaseSwap: isLock,
        };
      }
    }
    return {
      ...c,
      isLockBaseSwap: isLock,
    };
  });

  // Pass `undefined` for unifiedVisualSpec here because `unifiedVisualSpec` is already sent as its own top-level field
  let rawDirective = buildClientCaseDimensionDirective(
    casesWithSubScreenDna,
    undefined,
    'detail'
  );

  if (subScreenMatch?.[0]) {
    rawDirective = `${subScreenMatch[0]}${rawDirective}`;
  }

  // When deliveryMode === 'none', strip verbose analysis-stage negative meta-explanations
  if (deliveryMode === 'none') {
    rawDirective = rawDirective
      .replace(
        /｜\s*未选中不提取维度：[^｜\n]+（未选中仅代表不从\s*#Case-\d+\s*提取该维度信息，不代表锁定不变；[^）]+）/g,
        ''
      )
      .replace(
        /【本屏参考案例分析提取范围（分析阶段维度，生图默认不直接传案例原图）】：?/g,
        '【本屏提取的版式与视觉参考要点】：'
      )
      .trim();
  }

  return rawDirective;
}

/**
 * Synchronizes `unifiedVisualSpec` into a single ScreenTask's `visualPrompt` and `benchmarkCase`,
 * matching both `【整页统一视觉规范】` and `【全局统一视觉规范】` while preserving sub-screen prefixes.
 */
export function syncUnifiedVisualSpecToTask(
  task: ScreenTask,
  allReferenceImages: ReferenceImageItem[],
  unifiedVisualSpec?: string
): ScreenTask {
  const trimmedSpec = (unifiedVisualSpec || '').trim();
  let updatedPrompt = task.visualPrompt || '';

  if (trimmedSpec) {
    const specClause = `【整页统一视觉规范】：${trimmedSpec}。`;
    if (/【(?:整页|全局)统一视觉规范[^】]*】：[^\n]+/.test(updatedPrompt)) {
      updatedPrompt = updatedPrompt.replace(
        /【(?:整页|全局)统一视觉规范[^】]*】：[^\n]+/,
        specClause
      );
    } else if (/^8K商业级电商详情页竖版完整海报（[^）]+）。/.test(updatedPrompt)) {
      updatedPrompt = updatedPrompt.replace(
        /^(8K商业级电商详情页竖版完整海报（[^）]+）。)/,
        `$1${specClause}`
      );
    }
  } else {
    updatedPrompt = updatedPrompt.replace(
      /【(?:整页|全局)统一视觉规范[^】]*】：[^\n]+/g,
      ''
    );
  }

  const boundCases = allReferenceImages.filter(
    (r) => task.referenceImageIds.includes(r.id) && r.category === 'case'
  );
  let nextBenchmark = task.benchmarkCase || '';
  if (boundCases.length > 0) {
    const subScreenMatch = nextBenchmark.match(
      /^【对标来源：#[^\s·]+(?:\s*·\s*([^·】]+?))?\s*·\s*([^】]+)】/
    );
    const subRegionLabel = subScreenMatch?.[1]?.trim();
    const subTitle = subScreenMatch?.[2]?.trim();
    const casesWithSubDna = boundCases.map((c, idx) => {
      if (
        idx === 0 &&
        subRegionLabel &&
        Array.isArray(c.detectedSubScreens) &&
        c.detectedSubScreens.length > 1
      ) {
        const matchedSub = c.detectedSubScreens.find(
          (s) => s.regionLabel === subRegionLabel
        );
        if (matchedSub?.extractedLayoutDna) {
          return {
            ...c,
            tag: subTitle || matchedSub.title || c.tag,
            extractedLayoutDna: matchedSub.extractedLayoutDna,
          };
        }
      }
      return c;
    });
    const baseDirective = buildClientCaseDimensionDirective(
      casesWithSubDna,
      trimmedSpec,
      'detail'
    );
    nextBenchmark = subScreenMatch?.[0]
      ? `${subScreenMatch[0]}${baseDirective}`
      : baseDirective;
  } else if (trimmedSpec) {
    nextBenchmark = `统一视觉规范补充：${trimmedSpec}`;
  }

  return {
    ...task,
    visualPrompt: updatedPrompt,
    benchmarkCase: nextBenchmark,
  };
}

/**
 * Non-destructively synchronizes the planning document / product info text from Tab 02
 * into existing ScreenTasks without resetting custom user tweaks, bindings, or reference image IDs.
 */
export function syncPlanDocToExistingTasks(
  tasks: ScreenTask[],
  productInfoText: string,
  fullPlanDoc: string,
  allReferenceImages: ReferenceImageItem[],
  unifiedVisualSpec?: string
): ScreenTask[] {
  if (!tasks || tasks.length === 0) return [];
  const prodRefs = allReferenceImages.filter((r) => r.category !== 'case');
  const ctx = extractProductAndPlanContext(productInfoText, fullPlanDoc, prodRefs);

  return tasks.map((t, idx) => {
    const screenNum = t.screenNumber || idx + 1;
    const planBlock =
      ctx.planScreens.find((p) => p.screenNum === screenNum) ||
      ctx.planScreens[idx];

    let newTitle = t.title;
    let newCopywriting = t.copywriting;
    let newTypographyPlan = t.typographyPlan;
    let updatedPrompt = t.visualPrompt;

    const isLockPrompt = /【🔒锁底换款排版指令】：/.test(updatedPrompt);

    if (planBlock) {
      if (planBlock.mainHeadline && !isLayoutSkeletonLabel(planBlock.mainHeadline)) {
        newTitle = `第${screenNum}屏·${planBlock.mainHeadline}`;
      } else if (planBlock.rawTitle && !isLayoutSkeletonLabel(planBlock.rawTitle)) {
        newTitle = `第${screenNum}屏·${planBlock.rawTitle}`;
      }

      newCopywriting = [
        planBlock.mainHeadline,
        planBlock.subHeadline ? `副标：${planBlock.subHeadline}` : '',
        planBlock.bottomCopy ? `卖点：${planBlock.bottomCopy}` : '',
      ]
        .filter(Boolean)
        .join('\n');

      newTypographyPlan = [
        `顶部品牌/定位标签：${ctx.brandHeader}`,
        planBlock.mainHeadline ? `主标题：${planBlock.mainHeadline}` : '',
        planBlock.subHeadline ? `副标题/卖点说明：${planBlock.subHeadline}` : '',
        planBlock.bottomCopy ? `底部胶囊/辅助信息：${planBlock.bottomCopy}` : '',
      ]
        .filter(Boolean)
        .join('\n');

      if (t.textMode === 'with_text') {
        const textInstruction = isLockPrompt
          ? `【🔒锁底换款排版指令】：100%锁定案例原图的文字坐标、字体层级与底部容器样式，顶部标头渲染为「${ctx.brandHeader}」，主标题渲染为「${planBlock.mainHeadline || '核心爆款卖点'}」，副标题渲染为「${planBlock.subHeadline || ''}」${planBlock.bottomCopy ? `，底部卖点区渲染我方卖点「${planBlock.bottomCopy}」` : ''}。`
          : `【屏内中文排版直出指令（文案与参数以自有资料为准，绝不印刷构图术语）】：顶部印制「${ctx.brandHeader}」；核心大字印制主标「${planBlock.mainHeadline || '核心爆款卖点'}」；副标印制「${planBlock.subHeadline || ''}」${planBlock.bottomCopy ? `；底部印制「${planBlock.bottomCopy}」` : ''}。`;

        if (
          /【(?:屏内中文排版直出指令|🔒锁底换款排版指令|画面文案排版)[^】]*】：[^\n]+/.test(
            updatedPrompt
          )
        ) {
          updatedPrompt = updatedPrompt.replace(
            /【(?:屏内中文排版直出指令|🔒锁底换款排版指令|画面文案排版)[^】]*】：[^\n]+/,
            textInstruction
          );
        } else {
          updatedPrompt = `${updatedPrompt}\n${textInstruction}`;
        }
      }
    } else if (ctx.parsedSellingPoints.length > 0) {
      const pts = ctx.parsedSellingPoints;
      const ptA = pts[(screenNum - 1) % pts.length] || '';
      const ptB = pts[screenNum % pts.length] || '';
      const ptC = pts[(screenNum + 1) % pts.length] || '';
      const isSpecsScreen = /参数|清单|包装|规格/.test(`${t.title} ${t.sectionType}`);

      if (isSpecsScreen) {
        newCopywriting = `参数：${ctx.specsSummary}\n包装清单：${ctx.packageSummary}`;
        newTypographyPlan = `顶部标头：${ctx.brandHeader}\n主标题：产品核心参数与包装清单\n底部参数表与包装清单：${ctx.specsSummary} ｜ 包装清单：${ctx.packageSummary}`;
        if (t.textMode === 'with_text') {
          const textInstruction = `【屏内中文排版直出指令（文案与参数以自有资料为准，绝不印刷构图术语）】：底部区域参考参数信息表分区规律，清晰规整排版我方中文参数表与包装清单（${ctx.specsSummary}；包装清单：${ctx.packageSummary}），严禁移植任何竞品品牌名或竞品参数。`;
          if (
            /【(?:屏内中文排版直出指令|🔒锁底换款排版指令|画面文案排版)[^】]*】：[^\n]+/.test(
              updatedPrompt
            )
          ) {
            updatedPrompt = updatedPrompt.replace(
              /【(?:屏内中文排版直出指令|🔒锁底换款排版指令|画面文案排版)[^】]*】：[^\n]+/,
              textInstruction
            );
          }
        }
      } else if (ptA) {
        const subText =
          pts.length >= 2
            ? [ptA, ptB, ptC].filter(Boolean).join(' ｜ ')
            : `${ctx.brandName} 官方严选品质`;
        newCopywriting = `${ptA} ｜ ${subText}`;
        newTypographyPlan = `顶部品牌/定位标签：${ctx.brandHeader}\n主标题：${ptA}\n副标题/卖点说明：${subText}`;
        if (t.textMode === 'with_text') {
          const textInstruction = isLockPrompt
            ? `【🔒锁底换款排版指令】：100%锁定案例原图的文字坐标与容器样式，顶部标头渲染为「${ctx.brandHeader}」，主标题渲染为「${ptA}」，副标题渲染为「${subText}」。`
            : `【屏内中文排版直出指令（文案与参数以自有资料为准，绝不印刷构图术语）】：顶部印制「${ctx.brandHeader}」；核心大字印制主标「${ptA}」；副标印制「${subText}」。`;
          if (
            /【(?:屏内中文排版直出指令|🔒锁底换款排版指令|画面文案排版)[^】]*】：[^\n]+/.test(
              updatedPrompt
            )
          ) {
            updatedPrompt = updatedPrompt.replace(
              /【(?:屏内中文排版直出指令|🔒锁底换款排版指令|画面文案排版)[^】]*】：[^\n]+/,
              textInstruction
            );
          }
        }
      }
    }

    const taskWithCopy: ScreenTask = {
      ...t,
      title: newTitle,
      copywriting: newCopywriting,
      typographyPlan: newTypographyPlan,
      visualPrompt: updatedPrompt,
    };

    return unifiedVisualSpec !== undefined
      ? syncUnifiedVisualSpecToTask(taskWithCopy, allReferenceImages, unifiedVisualSpec)
      : taskWithCopy;
  });
}




