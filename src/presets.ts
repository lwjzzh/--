import { PresetTemplate, ReferenceImageItem } from './types';

/**
 * 纯净生产级预设定义（已清除全部未确认母版与 Canvas 模拟假图数据）
 * 默认启动为 100% 纯净空白工作台，支持用户在工作台内将已确认的真实方案保存为自定义母版。
 */
export const PRESET_TEMPLATES: PresetTemplate[] = [
  {
    id: 'blank-workspace',
    name: '纯净空白生产工程 (无模拟数据)',
    category: '生产环境 · 空白工作台',
    summary:
      '已清除所有演示模拟数据与未确认母版。请上传真实产品图/参考案例图，输入卖点或设计方案开始生产，确认后可一键存为正式母版。',
    defaultRequirements: {
      taskScope: 'detail_only',
      mainImageCount: 2,
      detailScreenCount: 10,
      mainAspectRatio: '1:1',
      detailAspectRatio: '9:16',
      textMode: 'with_text',
      enableStaticLayering: true,
    },
    globalStylePrefix: '',
    sampleRefs: [],
    productInfoText: '',
    generatedFullPlanDoc: '',
  },
];

export function buildPresetReferenceItems(
  _preset: PresetTemplate
): ReferenceImageItem[] {
  return [];
}

export async function hydratePresetRealAssets(
  _preset: PresetTemplate,
  initialItems: ReferenceImageItem[]
): Promise<ReferenceImageItem[]> {
  return initialItems;
}
