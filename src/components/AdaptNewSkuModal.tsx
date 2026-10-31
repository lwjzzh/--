import React from 'react';
import { Check, Loader2, Upload, Wand2, X, Zap } from 'lucide-react';
import { ReferenceImageItem } from '../types';

export interface AdaptNewSkuModalProps {
  open: boolean;
  isAdaptingSku: boolean;
  dynamicCount: number;
  productImages: ReferenceImageItem[];
  selectedSkuImageIds: string[];
  skuNameHintInput: string;
  autoReplaceDynamicRefs: boolean;
  onClose: () => void;
  onTriggerUploadProduct: () => void;
  onToggleSelectSkuModalImage: (id: string) => void;
  onChangeSkuNameHint: (value: string) => void;
  onChangeAutoReplaceDynamicRefs: (checked: boolean) => void;
  onExecuteAdaptNewSku: (autoRunImages: boolean) => void;
}

export const AdaptNewSkuModal: React.FC<AdaptNewSkuModalProps> = ({
  open,
  isAdaptingSku,
  dynamicCount,
  productImages,
  selectedSkuImageIds,
  skuNameHintInput,
  autoReplaceDynamicRefs,
  onClose,
  onTriggerUploadProduct,
  onToggleSelectSkuModalImage,
  onChangeSkuNameHint,
  onChangeAutoReplaceDynamicRefs,
  onExecuteAdaptNewSku,
}) => {
  if (!open) return null;

  return (
    <div
      onClick={() => !isAdaptingSku && onClose()}
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white border border-slate-200 rounded-3xl max-w-5xl w-[92vw] max-h-[92vh] overflow-y-auto p-8 lg:p-10 space-y-7 shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-100 pb-5">
          <div>
            <div className="flex items-center gap-3">
              <span className="px-3 py-1 text-xs font-bold bg-blue-600 text-white rounded-lg">
                3+7 同模极速换款工作流
              </span>
              <h3 className="text-xl font-bold text-slate-900">
                同模换新款图案 · AI 改写动态屏 ({dynamicCount}屏)
              </h3>
            </div>
            <p className="text-sm text-slate-500 mt-2">
              自动提取新款外壳图案、英文标语与氛围色，重写前 {dynamicCount}{' '}
              屏动态款式层；第 4~10 屏静态公模屏 100% 保持锁定复用。
            </p>
          </div>
          <button
            type="button"
            disabled={isAdaptingSku}
            onClick={onClose}
            className="p-2.5 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step 1: Select or Upload the New SKU Pattern Product Image */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-base font-bold text-slate-800">
              1. 选择代表【新款图案】的产品实拍图 (#Prod)
            </label>
            <button
              type="button"
              onClick={onTriggerUploadProduct}
              className="px-4 py-2 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200/80 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              <span>+ 上传新款实拍图</span>
            </button>
          </div>

          <div className="max-h-[420px] overflow-y-auto grid grid-cols-4 sm:grid-cols-5 lg:grid-cols-6 gap-3.5 p-4 bg-slate-50/90 border border-slate-200 rounded-2xl">
            {productImages.map((ref) => {
              const isSelected = selectedSkuImageIds.includes(ref.id);
              return (
                <button
                  key={ref.id}
                  type="button"
                  onClick={() => onToggleSelectSkuModalImage(ref.id)}
                  className={`p-2 rounded-xl border text-left transition-all flex flex-col gap-2 cursor-pointer ${
                    isSelected
                      ? 'border-blue-600 bg-blue-50/90 ring-2 ring-blue-600/80 shadow-sm'
                      : 'border-slate-200 bg-white opacity-85 hover:opacity-100 hover:border-slate-300'
                  }`}
                >
                  <div className="relative aspect-square w-full rounded-lg overflow-hidden bg-slate-100">
                    <img
                      src={ref.previewUrl}
                      alt={ref.tag}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                    <span className="absolute top-1.5 left-1.5 bg-slate-900/85 text-white text-[11px] font-mono-tabular px-1.5 py-0.5 rounded">
                      #{ref.code}
                    </span>
                    {isSelected && (
                      <span className="absolute bottom-1.5 right-1.5 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center shadow">
                        <Check className="w-3.5 h-3.5" />
                      </span>
                    )}
                  </div>
                  <span className="text-xs font-medium text-slate-700 truncate w-full px-0.5">
                    {ref.tag}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Step 2: Optional SKU Theme / Slogan Hint */}
        <div className="space-y-3">
          <label className="block text-base font-bold text-slate-800">
            2. 新款图案名称或主题方向备注（可选，留空则由视觉大模型自动识图提取）
          </label>
          <input
            type="text"
            value={skuNameHintInput}
            onChange={(e) => onChangeSkuNameHint(e.target.value)}
            placeholder="例如：PEACHY DAY 蜜桃水豚泡澡款 / Easy Peasy 考拉香蕉吊床款..."
            className="w-full px-4 py-3 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-blue-600 text-slate-800"
          />
          <div className="flex flex-wrap items-center gap-2.5 pt-0.5">
            <span className="text-xs font-medium text-slate-400">
              快捷填入测试：
            </span>
            {[
              'PEACHY DAY 蜜桃水豚泡澡款',
              'Easy Peasy 考拉香蕉吊床款',
              'fluffy trip 绵羊热气球款',
              'CHERRY JAM 樱桃果酱留声机款',
            ].map((hint) => (
              <button
                key={hint}
                type="button"
                onClick={() => onChangeSkuNameHint(hint)}
                className="px-3 py-1.5 text-xs font-medium bg-slate-100 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 text-slate-700 rounded-lg border border-slate-200 transition-colors cursor-pointer"
              >
                {hint}
              </button>
            ))}
          </div>
        </div>

        {/* Step 3: Auto-rebind Dynamic Screen Product References */}
        <label className="flex items-center gap-3 p-4 bg-blue-50/50 border border-blue-200/80 rounded-xl cursor-pointer">
          <input
            type="checkbox"
            checked={autoReplaceDynamicRefs}
            onChange={(e) => onChangeAutoReplaceDynamicRefs(e.target.checked)}
            className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-slate-700 font-medium">
            自动将第 1 屏（首屏KV）与第 3 屏（场景实拍）的产品参考图切换为上方勾选的新款图（保留原对标案例图 #Case）
          </span>
        </label>

        {/* Footer Execution Buttons */}
        <div className="flex flex-wrap items-center justify-end gap-3.5 pt-4 border-t border-slate-100">
          <button
            type="button"
            disabled={isAdaptingSku}
            onClick={onClose}
            className="px-5 py-2.5 text-sm font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
          >
            取消
          </button>
          <button
            type="button"
            disabled={isAdaptingSku || selectedSkuImageIds.length === 0}
            onClick={() => onExecuteAdaptNewSku(false)}
            className="px-6 py-3 text-sm font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isAdaptingSku ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Wand2 className="w-4 h-4" />
            )}
            <span>仅 AI 改写动态屏提示词 ({dynamicCount}屏)</span>
          </button>
          <button
            type="button"
            disabled={isAdaptingSku || selectedSkuImageIds.length === 0}
            onClick={() => onExecuteAdaptNewSku(true)}
            className="px-6 py-3 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50 shadow-sm"
          >
            {isAdaptingSku ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Zap className="w-4 h-4" />
            )}
            <span>AI 改写动态屏并立即生图 ({dynamicCount}屏)</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export interface ImageLightboxModalProps {
  lightboxImage: {
    url: string;
    title: string;
    subtitle: string;
  } | null;
  onClose: () => void;
}

export const ImageLightboxModal: React.FC<ImageLightboxModalProps> = ({
  lightboxImage,
  onClose,
}) => {
  if (!lightboxImage) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-6"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-w-3xl w-full max-h-[90vh] flex flex-col bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden shadow-2xl"
      >
        <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between text-white">
          <div>
            <h4 className="text-sm font-bold">{lightboxImage.title}</h4>
            <p className="text-xs text-slate-400 font-mono-tabular">
              {lightboxImage.subtitle}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-slate-950">
          <img
            src={lightboxImage.url}
            alt={lightboxImage.title}
            className="max-h-[75vh] w-auto object-contain rounded"
          />
        </div>
      </div>
    </div>
  );
};
