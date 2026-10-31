import React from 'react';
import { BookmarkCheck, Check, X } from 'lucide-react';
import { SavedCommonAsset } from '../utils/assetLibraryDb';

interface DetailAssetPickerModalProps {
  open: boolean;
  category: 'product' | 'case';
  selectedIds: string[];
  commonAssets: SavedCommonAsset[];
  onClose: () => void;
  onChangeCategory: (category: 'product' | 'case') => void;
  onToggleSelectId: (id: string) => void;
  onConfirmSelection: (
    chosenAssets: SavedCommonAsset[],
    category: 'product' | 'case'
  ) => void;
}

export const DetailAssetPickerModal: React.FC<DetailAssetPickerModalProps> =
  React.memo(
    ({
      open,
      category,
      selectedIds,
      commonAssets,
      onClose,
      onChangeCategory,
      onToggleSelectId,
      onConfirmSelection,
    }) => {
      const [prodSubFilter, setProdSubFilter] = React.useState<
        'all_prod' | 'sku_prod' | 'mold'
      >('all_prod');

      if (!open) return null;

      const filteredAssets = commonAssets.filter((a) => {
        if (a.category !== category) return false;
        if (category === 'product') {
          if (prodSubFilter === 'mold') return Boolean(a.isCommonAsset);
          if (prodSubFilter === 'sku_prod') return !a.isCommonAsset;
        }
        return true;
      });
      const prodCount = commonAssets.filter(
        (a) => a.category === 'product'
      ).length;
      const skuProdCount = commonAssets.filter(
        (a) => a.category === 'product' && !a.isCommonAsset
      ).length;
      const moldProdCount = commonAssets.filter(
        (a) => a.category === 'product' && Boolean(a.isCommonAsset)
      ).length;
      const caseCount = commonAssets.filter(
        (a) => a.category === 'case'
      ).length;

      return (
        <div
          onClick={onClose}
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white border border-slate-200 rounded-2xl max-w-4xl w-[92vw] max-h-[86vh] flex flex-col overflow-hidden shadow-2xl"
          >
            <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0">
                  <BookmarkCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    从「③ 资产库」选择
                    {category === 'case'
                      ? '对标参考案例图 (#Case)'
                      : '产品图片 (#Prod / 公模)'}{' '}
                    至详情页工作台
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    详情页工作台与 SKU 图工作台素材池相互独立，可从资产库按「款式图 / 公模图 / 对标图」随时调取复用
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200/60 cursor-pointer"
                title="关闭弹窗 (Esc)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-5 py-2.5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-white">
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-lg">
                  <button
                    type="button"
                    onClick={() => onChangeCategory('product')}
                    className={`px-3 py-1 rounded-md text-xs font-semibold cursor-pointer transition-colors ${
                      category === 'product'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    产品图 ({prodCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => onChangeCategory('case')}
                    className={`px-3 py-1 rounded-md text-xs font-semibold cursor-pointer transition-colors ${
                      category === 'case'
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    对标图 #Case ({caseCount})
                  </button>
                </div>

                {category === 'product' && (
                  <div className="flex items-center gap-1 p-1 bg-slate-100/80 rounded-lg border border-slate-200/60">
                    <button
                      type="button"
                      onClick={() => setProdSubFilter('all_prod')}
                      className={`px-2.5 py-0.5 rounded text-[11px] font-medium cursor-pointer transition-colors ${
                        prodSubFilter === 'all_prod'
                          ? 'bg-white text-slate-900 font-semibold shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      全部({prodCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => setProdSubFilter('sku_prod')}
                      className={`px-2.5 py-0.5 rounded text-[11px] font-medium cursor-pointer transition-colors ${
                        prodSubFilter === 'sku_prod'
                          ? 'bg-white text-blue-700 font-semibold shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      款式 #Prod({skuProdCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => setProdSubFilter('mold')}
                      className={`px-2.5 py-0.5 rounded text-[11px] font-medium cursor-pointer transition-colors ${
                        prodSubFilter === 'mold'
                          ? 'bg-emerald-600 text-white font-semibold shadow-2xs'
                          : 'text-emerald-700 hover:text-emerald-900'
                      }`}
                    >
                      公模({moldProdCount})
                    </button>
                  </div>
                )}
              </div>
              <span className="text-xs text-slate-500 font-mono-tabular">
                已选{' '}
                <strong className="font-mono text-blue-600">
                  {selectedIds.length}
                </strong>{' '}
                张
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-5 bg-slate-50/50">
              {filteredAssets.length === 0 ? (
                <div className="py-12 text-center space-y-2">
                  <p className="text-xs font-semibold text-slate-600">
                    资产库暂无该分类素材
                  </p>
                  <p className="text-[11px] text-slate-400">
                    可先在工作台上传后点击「存至资产库」，或在「③ 资产库」批量上传常用素材或归类公模图
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                  {filteredAssets.map((item) => {
                    const isSelected = selectedIds.includes(item.id);
                    return (
                      <div
                        key={item.id}
                        onClick={() => onToggleSelectId(item.id)}
                        className={`rounded-xl border p-1.5 bg-white transition-all cursor-pointer flex flex-col gap-1.5 ${
                          isSelected
                            ? 'border-blue-600 ring-2 ring-blue-500/25 bg-blue-50/20'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="relative aspect-square w-full rounded-lg overflow-hidden bg-slate-100">
                          <img
                            src={item.previewUrl}
                            alt={item.tag}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                          {item.category === 'product' && (
                            <span
                              className={`absolute top-1.5 left-1.5 px-1.5 py-0.5 text-[10px] font-semibold rounded pointer-events-none ${
                                item.isCommonAsset
                                  ? 'bg-emerald-600/90 text-white'
                                  : 'bg-slate-900/75 text-white'
                              }`}
                            >
                              {item.isCommonAsset ? '公模' : '#Prod'}
                            </span>
                          )}
                          <span
                            className={`absolute top-1.5 right-1.5 w-5 h-5 rounded-md flex items-center justify-center border transition-colors ${
                              isSelected
                                ? 'bg-blue-600 border-blue-600 text-white'
                                : 'bg-white/90 border-slate-300 text-transparent'
                            }`}
                          >
                            <Check className="w-3.5 h-3.5" />
                          </span>
                        </div>
                        <div className="text-[11px] font-semibold text-slate-800 truncate px-0.5">
                          {item.tag || item.name}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="px-5 py-3 border-t border-slate-200 bg-white flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                disabled={selectedIds.length === 0}
                onClick={() => {
                  const chosen = commonAssets.filter(
                    (a) => selectedIds.includes(a.id) && a.category === category
                  );
                  onConfirmSelection(chosen, category);
                }}
                className="btn-primary px-4 py-1.5 text-xs font-bold rounded-lg cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                确认添加至详情页工作台 ({selectedIds.length})
              </button>
            </div>
          </div>
        </div>
      );
    }
  );
