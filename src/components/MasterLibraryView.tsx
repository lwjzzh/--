import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  BookmarkCheck,
  Download,
  Upload,
  Trash2,
  FolderPlus,
  Image as ImageIcon,
  History,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Palette,
  LayoutList,
  FolderDown,
  SlidersHorizontal,
  LayoutGrid,
  Layers,
  List as ListIcon,
  CloudUpload,
  Loader2,
  ArrowUpDown,
  Play,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { ConfirmedMasterTemplate } from '../utils/masterTemplateDb';
import {
  SavedCommonAsset,
  GenerationRecordItem,
} from '../utils/assetLibraryDb';
import {
  CASE_DIMENSION_META,
  CaseRefDimension,
  CloudStorageProvider,
  ReferenceImageItem,
  getCloudUrlForProvider,
} from '../types';
import {
  downloadGenerationRecordImage,
  exportGenerationRecordsAsZip,
} from '../utils/exportHelpers';

export type AssetLibrarySubTab =
  | 'common_assets'
  | 'generation_records'
  | 'master_templates';

type SortOption = 'time_desc' | 'time_asc' | 'name_asc' | 'name_desc';

const CASE_DIM_LABELS: { value: CaseRefDimension; label: string }[] =
  CASE_DIMENSION_META.map((d) => ({ value: d.value, label: d.label }));

interface MasterLibraryViewProps {
  templates: ConfirmedMasterTemplate[];
  activeMasterId: string | null;
  canSaveCurrentWorkspace: boolean;
  commonAssets: SavedCommonAsset[];
  workspaceReferenceImages: ReferenceImageItem[];
  generationRecords: GenerationRecordItem[];
  defaultSubTab?: AssetLibrarySubTab;
  onLoadTemplate: (
    tpl: ConfirmedMasterTemplate,
    switchToStudio?: boolean
  ) => void;
  onDeleteTemplate: (id: string) => void;
  onExportSingleTemplate: (tpl: ConfirmedMasterTemplate) => void;
  onTriggerImportJson: () => void;
  onOpenSaveCurrentModal: () => void;
  onSwitchToDetailStudio: () => void;
  onSwitchToSkuStudio: () => void;
  // Common Assets callbacks
  onUploadCommonAssetFiles: (
    files: FileList | null,
    category: 'product' | 'case',
    isCommonAsset?: boolean
  ) => void;
  onImportFromCurrentWorkspace: () => void;
  onUpdateCommonAsset: (
    id: string,
    patch: Partial<SavedCommonAsset>
  ) => void;
  onDeleteCommonAssets: (ids: string[]) => void;
  onPushAssetsToStudio: (
    assets: SavedCommonAsset[],
    targetStudio: 'detail_studio' | 'sku_studio'
  ) => void;
  onUploadCommonAssetToOss?: (asset: SavedCommonAsset) => Promise<void> | void;
  onBatchUploadCommonAssetsToOss?: (
    assets: SavedCommonAsset[]
  ) => Promise<void> | void;
  // Generation Records callbacks
  onDeleteGenerationRecords: (ids: string[]) => void;
  onSaveRecordsToCommonAssets?: (
    records: GenerationRecordItem[],
    category?: 'case' | 'product'
  ) => void;
  onUploadRecordToOss?: (record: GenerationRecordItem) => Promise<void> | void;
  onBatchUploadRecordsToOss?: (
    records: GenerationRecordItem[]
  ) => Promise<void> | void;
  // Cloud storage state
  ossEnabled?: boolean;
  storageProvider?: CloudStorageProvider;
  // Shared UI callbacks
  onPreviewImage: (url: string, title?: string, subtitle?: string) => void;
  onShowToast: (
    text: string,
    type?: 'info' | 'success' | 'error'
  ) => void;
}

export const MasterLibraryView: React.FC<MasterLibraryViewProps> = ({
  templates,
  activeMasterId,
  canSaveCurrentWorkspace,
  commonAssets,
  workspaceReferenceImages,
  generationRecords,
  onLoadTemplate,
  onDeleteTemplate,
  onExportSingleTemplate,
  onTriggerImportJson,
  onOpenSaveCurrentModal,
  onSwitchToDetailStudio,
  onSwitchToSkuStudio,
  onUploadCommonAssetFiles,
  onImportFromCurrentWorkspace,
  onUpdateCommonAsset,
  onDeleteCommonAssets,
  onPushAssetsToStudio,
  onUploadCommonAssetToOss,
  onBatchUploadCommonAssetsToOss,
  onDeleteGenerationRecords,
  onSaveRecordsToCommonAssets,
  onUploadRecordToOss,
  onBatchUploadRecordsToOss,
  storageProvider = 'aliyun_oss',
  onPreviewImage,
  onShowToast,
}) => {
  const isR2 = storageProvider === 'cloudflare_r2';
  const cloudShort = isR2 ? 'R2' : 'OSS';
  const cloudLabel = isR2 ? 'Cloudflare R2' : '阿里云 OSS';

  // ================= LEFT PANE STATE: 常用素材库 (占比 3 <-> 折叠为 0) =================
  const [isLeftAssetsCollapsed, setIsLeftAssetsCollapsed] = useState(false);
  const [assetCategoryFilter, setAssetCategoryFilter] = useState<
    'all' | 'product' | 'case' | 'mold'
  >('all');
  const [assetSortBy, setAssetSortBy] = useState<SortOption>('time_desc');
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [uploadingOssAssetIds, setUploadingOssAssetIds] = useState<string[]>([]);
  const [isBatchUploadingAssets, setIsBatchUploadingAssets] = useState(false);
  const [isBatchUploadingRecords, setIsBatchUploadingRecords] = useState(false);
  const [isExportingRecordsZip, setIsExportingRecordsZip] = useState(false);
  const [exportingBatchZipId, setExportingBatchZipId] = useState<string | null>(
    null
  );
  const [editingDimAssetId, setEditingDimAssetId] = useState<string | null>(
    null
  );
  const prodUploadInputRef = useRef<HTMLInputElement>(null);
  const moldUploadInputRef = useRef<HTMLInputElement>(null);
  const caseUploadInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editingDimAssetId) return;
    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && !target.closest('[data-dim-editor-root="true"]')) {
        setEditingDimAssetId(null);
      }
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [editingDimAssetId]);

  // ================= CENTER PANE STATE: 生成记录归档 (占比 5) =================
  const [recordDisplayMode, setRecordDisplayMode] = useState<
    'flat' | 'list' | 'batch'
  >('flat');
  const [recordSourceFilter, setRecordSourceFilter] = useState<
    'all' | 'detail_studio' | 'sku_studio'
  >('all');
  const [recordSortBy, setRecordSortBy] = useState<SortOption>('time_desc');
  const [selectedRecordIds, setSelectedRecordIds] = useState<string[]>([]);
  const [uploadingOssRecordIds, setUploadingOssRecordIds] = useState<string[]>(
    []
  );
  const [manualBatchToggle, setManualBatchToggle] = useState<
    Record<string, boolean>
  >({});

  // Prune stale selected IDs when assets or generation records are deleted individually
  useEffect(() => {
    setSelectedAssetIds((prev) => {
      if (prev.length === 0) return prev;
      const validSet = new Set(commonAssets.map((a) => a.id));
      const next = prev.filter((id) => validSet.has(id));
      return next.length === prev.length ? prev : next;
    });
  }, [commonAssets]);

  useEffect(() => {
    setSelectedRecordIds((prev) => {
      if (prev.length === 0) return prev;
      const validSet = new Set(generationRecords.map((r) => r.id));
      const next = prev.filter((id) => validSet.has(id));
      return next.length === prev.length ? prev : next;
    });
  }, [generationRecords]);

  // Counts
  const prodAssetsCount = useMemo(
    () =>
      commonAssets.filter((a) => a.category === 'product' && !a.isCommonAsset)
        .length,
    [commonAssets]
  );
  const moldAssetsCount = useMemo(
    () =>
      commonAssets.filter(
        (a) => a.category === 'product' && Boolean(a.isCommonAsset)
      ).length,
    [commonAssets]
  );
  const caseAssetsCount = useMemo(
    () => commonAssets.filter((a) => a.category === 'case').length,
    [commonAssets]
  );

  // Filtered & Sorted Common Assets (Left Column)
  const filteredCommonAssets = useMemo(() => {
    const base =
      assetCategoryFilter === 'all'
        ? [...commonAssets]
        : assetCategoryFilter === 'mold'
          ? commonAssets.filter(
              (a) => a.category === 'product' && Boolean(a.isCommonAsset)
            )
          : assetCategoryFilter === 'product'
            ? commonAssets.filter(
                (a) => a.category === 'product' && !a.isCommonAsset
              )
            : commonAssets.filter((a) => a.category === assetCategoryFilter);

    base.sort((a, b) => {
      if (assetSortBy === 'time_desc') return b.timestamp - a.timestamp;
      if (assetSortBy === 'time_asc') return a.timestamp - b.timestamp;
      const nameA = (a.tag || a.name || '').trim();
      const nameB = (b.tag || b.name || '').trim();
      if (assetSortBy === 'name_asc') {
        return nameA.localeCompare(nameB, 'zh-CN', { numeric: true });
      }
      return nameB.localeCompare(nameA, 'zh-CN', { numeric: true });
    });

    return base;
  }, [commonAssets, assetCategoryFilter, assetSortBy]);

  const cycleSortOption = (current: SortOption): SortOption => {
    if (current === 'time_desc') return 'time_asc';
    if (current === 'time_asc') return 'name_asc';
    if (current === 'name_asc') return 'name_desc';
    return 'time_desc';
  };

  const getSortLabel = (opt: SortOption): string => {
    if (opt === 'time_desc') return '时间↓';
    if (opt === 'time_asc') return '时间↑';
    if (opt === 'name_asc') return '名称A-Z';
    return '名称Z-A';
  };

  const toggleSelectAsset = (id: string) => {
    setSelectedAssetIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAllFilteredAssets = () => {
    const visibleIds = filteredCommonAssets.map((a) => a.id);
    const allSelected =
      visibleIds.length > 0 &&
      visibleIds.every((id) => selectedAssetIds.includes(id));
    if (allSelected) {
      setSelectedAssetIds((prev) =>
        prev.filter((id) => !visibleIds.includes(id))
      );
    } else {
      setSelectedAssetIds((prev) =>
        Array.from(new Set([...prev, ...visibleIds]))
      );
    }
  };

  const toggleAssetCaseDimension = (
    asset: SavedCommonAsset,
    dim: CaseRefDimension
  ) => {
    const current = asset.caseDimensions || ['style', 'structure'];
    const exists = current.includes(dim);
    const next = exists ? current.filter((d) => d !== dim) : [...current, dim];
    onUpdateCommonAsset(asset.id, {
      caseDimensions: next.length > 0 ? next : ['style'],
    });
  };

  // Filtered & Sorted Generation Records (Center Column)
  const filteredRecords = useMemo(() => {
    const base = generationRecords.filter((rec) => {
      if (
        recordSourceFilter !== 'all' &&
        rec.sourceStudio !== recordSourceFilter
      ) {
        return false;
      }
      return true;
    });

    base.sort((a, b) => {
      if (recordSortBy === 'time_desc') return b.timestamp - a.timestamp;
      if (recordSortBy === 'time_asc') return a.timestamp - b.timestamp;
      const nameA = (a.title || '').trim();
      const nameB = (b.title || '').trim();
      if (recordSortBy === 'name_asc') {
        return nameA.localeCompare(nameB, 'zh-CN', { numeric: true });
      }
      return nameB.localeCompare(nameA, 'zh-CN', { numeric: true });
    });

    return base;
  }, [generationRecords, recordSourceFilter, recordSortBy]);

  const toggleSelectRecord = (id: string) => {
    setSelectedRecordIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAllFilteredRecords = () => {
    const visibleIds = filteredRecords.map((r) => r.id);
    const allSelected =
      visibleIds.length > 0 &&
      visibleIds.every((id) => selectedRecordIds.includes(id));
    if (allSelected) {
      setSelectedRecordIds((prev) =>
        prev.filter((id) => !visibleIds.includes(id))
      );
    } else {
      setSelectedRecordIds((prev) =>
        Array.from(new Set([...prev, ...visibleIds]))
      );
    }
  };

  const handleExportRecordsAsZip = async (
    targetRecords: GenerationRecordItem[],
    archiveTitle = 'EComStudio_历史成图批量导出'
  ) => {
    if (targetRecords.length === 0 || isExportingRecordsZip) return;
    setIsExportingRecordsZip(true);
    try {
      onShowToast(
        `正在将 ${targetRecords.length} 张成图及提示词清单打包为 ZIP 压缩包...`,
        'info'
      );
      await exportGenerationRecordsAsZip(targetRecords, archiveTitle);
      onShowToast(
        `已成功打包导出 ${targetRecords.length} 张成图 (.zip 压缩包)`,
        'success'
      );
    } catch (err: any) {
      onShowToast(err?.message || '批量打包 ZIP 导出失败', 'error');
    } finally {
      setIsExportingRecordsZip(false);
    }
  };

  const handleBatchDownloadSelectedRecords = async () => {
    const chosen = generationRecords.filter((r) =>
      selectedRecordIds.includes(r.id)
    );
    if (chosen.length === 0) return;
    if (chosen.length >= 3) {
      await handleExportRecordsAsZip(chosen, 'EComStudio_生图记录批量导出');
    } else {
      chosen.forEach((item, idx) => {
        setTimeout(() => {
          downloadGenerationRecordImage(item.imageUrl, item.itemIndex, item.title);
        }, idx * 180);
      });
      onShowToast(`已开始直接下载所选的 ${chosen.length} 张成图`, 'success');
    }
  };

  const handleTriggerUploadAssetOss = async (asset: SavedCommonAsset) => {
    const activeUrl = getCloudUrlForProvider(
      asset.ossUrl,
      asset.cloudUrls,
      storageProvider
    );
    if (activeUrl) {
      navigator.clipboard.writeText(activeUrl).catch(() => {});
      onShowToast(
        `已复制「${asset.tag || asset.name}」的 ${cloudLabel} 直链`,
        'success'
      );
      return;
    }
    if (!onUploadCommonAssetToOss) return;
    if (uploadingOssAssetIds.includes(asset.id) || asset.ossUploading) return;
    setUploadingOssAssetIds((prev) => [...prev, asset.id]);
    try {
      await onUploadCommonAssetToOss(asset);
    } finally {
      setUploadingOssAssetIds((prev) => prev.filter((id) => id !== asset.id));
    }
  };

  const handleTriggerUploadRecordOss = async (item: GenerationRecordItem) => {
    const activeUrl = getCloudUrlForProvider(
      item.ossUrl,
      item.cloudUrls,
      storageProvider
    );
    if (activeUrl) {
      navigator.clipboard.writeText(activeUrl).catch(() => {});
      onShowToast(
        `已复制「${item.title}」的 ${cloudLabel} 云端直链`,
        'success'
      );
      return;
    }
    if (!onUploadRecordToOss) return;
    if (uploadingOssRecordIds.includes(item.id) || item.ossUploading) return;
    setUploadingOssRecordIds((prev) => [...prev, item.id]);
    try {
      await onUploadRecordToOss(item);
    } finally {
      setUploadingOssRecordIds((prev) => prev.filter((id) => id !== item.id));
    }
  };

  // Group Generation Records by Batch (Smartly merging single-card regenerations from the same studio & date)
  const groupedBatches = useMemo(() => {
    const map = new Map<
      string,
      {
        batchId: string;
        batchTitle: string;
        sourceStudio: 'detail_studio' | 'sku_studio';
        latestTimestamp: number;
        createdAtLabel: string;
        items: GenerationRecordItem[];
      }
    >();

    const rawBatchCounts = new Map<string, number>();
    for (const rec of filteredRecords) {
      const rawKey = rec.batchId || `single-${rec.id}`;
      rawBatchCounts.set(rawKey, (rawBatchCounts.get(rawKey) || 0) + 1);
    }

    for (const rec of filteredRecords) {
      const rawKey = rec.batchId || `single-${rec.id}`;
      const isSingleCardBatch =
        (rawBatchCounts.get(rawKey) || 0) <= 1 ||
        /单卡生成|单屏生成/.test(rec.batchTitle || '');
      const datePrefix = (rec.createdAt || '').split(' ')[0] || '近期';

      const groupKey = isSingleCardBatch
        ? `merged-single-${rec.sourceStudio}-${datePrefix}`
        : rawKey;

      const existing = map.get(groupKey);
      if (!existing) {
        map.set(groupKey, {
          batchId: groupKey,
          batchTitle: isSingleCardBatch
            ? `${
                rec.sourceStudio === 'sku_studio'
                  ? 'SKU 单卡生成合集'
                  : '详情页单屏生成合集'
              } (${datePrefix})`
            : rec.batchTitle ||
              (rec.sourceStudio === 'sku_studio'
                ? 'SKU 批量图生成批次'
                : '详情页分屏生成批次'),
          sourceStudio: rec.sourceStudio,
          latestTimestamp: rec.timestamp,
          createdAtLabel: rec.createdAt,
          items: [rec],
        });
      } else {
        existing.items.push(rec);
        if (rec.timestamp > existing.latestTimestamp) {
          existing.latestTimestamp = rec.timestamp;
          existing.createdAtLabel = rec.createdAt;
        }
      }
    }

    const groups = Array.from(map.values());
    for (const g of groups) {
      g.items.sort((a, b) => {
        if (recordSortBy === 'time_asc') return a.timestamp - b.timestamp;
        if (recordSortBy === 'name_asc') {
          return (a.title || '').localeCompare(b.title || '', 'zh-CN', {
            numeric: true,
          });
        }
        if (recordSortBy === 'name_desc') {
          return (b.title || '').localeCompare(a.title || '', 'zh-CN', {
            numeric: true,
          });
        }
        return b.timestamp - a.timestamp;
      });
    }
    groups.sort((a, b) =>
      recordSortBy === 'time_asc'
        ? a.latestTimestamp - b.latestTimestamp
        : b.latestTimestamp - a.latestTimestamp
    );

    return groups;
  }, [filteredRecords, recordSortBy]);

  const isBatchExpanded = (batchId: string) => {
    if (batchId in manualBatchToggle) {
      return manualBatchToggle[batchId];
    }
    return true;
  };

  const toggleBatchExpand = (batchId: string, currentlyExpanded: boolean) => {
    setManualBatchToggle((prev) => ({
      ...prev,
      [batchId]: !currentlyExpanded,
    }));
  };

  // Shared 5-icon action bar for a single GenerationRecordItem (Download / Copy Prompt / Save to Common Asset / Upload Cloud with color state / Delete)
  const renderRecordActionButtons = (item: GenerationRecordItem) => {
    const activeRecCloudUrl = getCloudUrlForProvider(
      item.ossUrl,
      item.cloudUrls,
      storageProvider
    );
    const otherProvider: CloudStorageProvider = isR2
      ? 'aliyun_oss'
      : 'cloudflare_r2';
    const otherRecCloudUrl = getCloudUrlForProvider(
      item.ossUrl,
      item.cloudUrls,
      otherProvider
    );
    const isOssUploaded = Boolean(activeRecCloudUrl);
    const isOssUploading =
      uploadingOssRecordIds.includes(item.id) || Boolean(item.ossUploading);

    return (
      <>
        <button
          type="button"
          onClick={() =>
            downloadGenerationRecordImage(
              item.imageUrl,
              item.itemIndex,
              item.title
            )
          }
          className="btn-ghost flex-1 py-1 flex items-center justify-center text-slate-600 hover:text-blue-600 hover:bg-blue-50/60 rounded cursor-pointer transition-colors"
          title="下载高清成图"
        >
          <Download className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={() => {
            navigator.clipboard
              .writeText(item.promptSnapshot || '')
              .catch(() => {});
            onShowToast('已复制该图生成提示词', 'success');
          }}
          className="btn-ghost flex-1 py-1 flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded cursor-pointer transition-colors"
          title="复制生图提示词"
        >
          <Copy className="w-3.5 h-3.5" />
        </button>

        {onSaveRecordsToCommonAssets && (
          <button
            type="button"
            onClick={() => onSaveRecordsToCommonAssets([item], 'case')}
            className="btn-ghost flex-1 py-1 flex items-center justify-center text-slate-600 hover:text-blue-600 hover:bg-blue-50/60 rounded cursor-pointer transition-colors"
            title="存为左侧常用对标素材 (#Case)"
          >
            <FolderPlus className="w-3.5 h-3.5" />
          </button>
        )}

        <button
          type="button"
          onClick={() => handleTriggerUploadRecordOss(item)}
          disabled={isOssUploading}
          className={`flex-1 py-1 flex items-center justify-center rounded cursor-pointer transition-colors ${
            isOssUploaded
              ? isR2
                ? 'text-orange-600 bg-orange-50/90 hover:bg-orange-100'
                : 'text-emerald-600 bg-emerald-50/90 hover:bg-emerald-100'
              : isOssUploading
                ? 'text-blue-600 bg-blue-50/70'
                : otherRecCloudUrl
                  ? 'btn-ghost text-amber-600 hover:text-blue-600 hover:bg-blue-50/60'
                  : 'btn-ghost text-slate-500 hover:text-blue-600 hover:bg-blue-50/60'
          }`}
          title={
            isOssUploaded
              ? `已上传至 ${cloudLabel}（点击复制云端直链: ${activeRecCloudUrl}）`
              : isOssUploading
                ? `正在上传至 ${cloudLabel}...`
                : otherRecCloudUrl
                  ? `原先已传至${isR2 ? '阿里云 OSS' : 'Cloudflare R2'}，点击同步上传至当前 ${cloudLabel}`
                  : `上传此成图至 ${cloudLabel}`
          }
        >
          {isOssUploading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <CloudUpload className="w-3.5 h-3.5" />
          )}
        </button>

        <button
          type="button"
          onClick={() => {
            onDeleteGenerationRecords([item.id]);
            setSelectedRecordIds((prev) =>
              prev.filter((id) => id !== item.id)
            );
          }}
          className="btn-ghost flex-1 py-1 flex items-center justify-center text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded cursor-pointer transition-colors"
          title="删除此条记录"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </>
    );
  };

  // Card renderer for Flat Gallery / Batch Grid modes
  const renderGenerationRecordCard = (item: GenerationRecordItem) => {
    const isSelected = selectedRecordIds.includes(item.id);
    const isSquareRatio = !item.aspectRatio || item.aspectRatio === '1:1';
    const activeRecCloudUrl = getCloudUrlForProvider(
      item.ossUrl,
      item.cloudUrls,
      storageProvider
    );
    const isOssUploaded = Boolean(activeRecCloudUrl);

    return (
      <div
        key={item.id}
        className={`group rounded-lg border p-2 flex flex-col gap-1.5 transition-all bg-white ${
          isSelected
            ? 'border-blue-600 ring-2 ring-blue-500/15 shadow-xs'
            : 'border-slate-200/80 hover:border-slate-300 shadow-[0_1px_2px_rgba(15,23,42,0.02)]'
        }`}
      >
        {/* 1:1 Uncropped Full-Frame Thumbnail Box */}
        <div
          onClick={() =>
            onPreviewImage(
              item.imageUrl,
              item.title,
              `${item.batchTitle || ''} · ${item.aspectRatio} · ${item.imageSize}`
            )
          }
          title="点击放大预览高清完整原图"
          className="relative aspect-square w-full rounded-md overflow-hidden bg-slate-100/90 border border-slate-200/60 cursor-zoom-in flex items-center justify-center"
        >
          <img
            src={item.imageUrl}
            alt={item.title}
            className={`w-full h-full ${
              isSquareRatio ? 'object-cover' : 'object-contain'
            } group-hover:scale-[1.02] transition-transform duration-200`}
          />

          {/* Top-Left Selection Checkbox */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleSelectRecord(item.id);
            }}
            title={isSelected ? '取消勾选' : '勾选此记录用于批量操作'}
            className={`absolute top-1.5 left-1.5 w-5 h-5 rounded flex items-center justify-center transition-all cursor-pointer ${
              isSelected
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'bg-white/95 hover:bg-white text-transparent border border-slate-300/90 group-hover:border-slate-400'
            }`}
          >
            <Check className="w-3 h-3" />
          </button>

          {/* Top-Right Subtle Cloud Status Indicator */}
          {isOssUploaded && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                navigator.clipboard.writeText(activeRecCloudUrl!).catch(() => {});
                onShowToast(
                  `已复制「${item.title}」的 ${cloudLabel} 直链`,
                  'success'
                );
              }}
              title={`已同步至 ${cloudLabel}（点击复制直链）`}
              className={`absolute top-1.5 right-1.5 px-1 py-0.5 text-white text-[9px] font-mono-tabular font-semibold rounded cursor-pointer ${
                isR2
                  ? 'bg-orange-600/90 hover:bg-orange-700'
                  : 'bg-emerald-600/90 hover:bg-emerald-700'
              }`}
            >
              {cloudShort}✓
            </button>
          )}

          {/* Bottom-Left Subtle Spec Label */}
          <span className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 bg-slate-900/70 text-white text-[10px] font-mono-tabular rounded pointer-events-none">
            {item.aspectRatio} · {item.imageSize}
          </span>
        </div>

        {/* Title & Compact Metadata Row */}
        <div className="space-y-0.5 px-0.5">
          <div
            className="text-[11px] font-semibold text-slate-800 truncate"
            title={item.title}
          >
            {item.title}
          </div>
          <div className="flex items-center justify-between gap-1 text-[10px] text-slate-400 font-mono-tabular">
            <span>{item.sourceStudio === 'sku_studio' ? 'SKU' : '详情'}</span>
            <span>{(item.createdAt || '').split(' ')[0]}</span>
          </div>
        </div>

        {/* Bottom Icon-Only Action Bar (Directly below image) */}
        <div className="flex items-center justify-between gap-1 pt-1.5 mt-auto border-t border-slate-100">
          {renderRecordActionButtons(item)}
        </div>
      </div>
    );
  };

  // Row renderer for List Mode ('list')
  const renderGenerationRecordListRow = (item: GenerationRecordItem) => {
    const isSelected = selectedRecordIds.includes(item.id);
    const isSquareRatio = !item.aspectRatio || item.aspectRatio === '1:1';

    return (
      <div
        key={item.id}
        className={`group rounded-lg border px-2.5 py-2 flex items-center gap-3 transition-all bg-white ${
          isSelected
            ? 'border-blue-600 ring-2 ring-blue-500/15 shadow-xs'
            : 'border-slate-200/80 hover:border-slate-300 shadow-[0_1px_2px_rgba(15,23,42,0.02)]'
        }`}
      >
        {/* Selection Checkbox */}
        <button
          type="button"
          onClick={() => toggleSelectRecord(item.id)}
          title={isSelected ? '取消勾选' : '勾选此记录'}
          className={`w-4 h-4 rounded flex items-center justify-center transition-all cursor-pointer shrink-0 ${
            isSelected
              ? 'bg-blue-600 text-white'
              : 'bg-white hover:bg-slate-50 text-transparent border border-slate-300'
          }`}
        >
          <Check className="w-3 h-3" />
        </button>

        {/* Square Uncropped Mini Thumbnail */}
        <div
          onClick={() =>
            onPreviewImage(
              item.imageUrl,
              item.title,
              `${item.batchTitle || ''} · ${item.aspectRatio} · ${item.imageSize}`
            )
          }
          title="点击放大预览高清完整原图"
          className="relative w-12 h-12 rounded-md overflow-hidden bg-slate-100 border border-slate-200/70 shrink-0 cursor-zoom-in flex items-center justify-center"
        >
          <img
            src={item.imageUrl}
            alt={item.title}
            className={`w-full h-full ${
              isSquareRatio ? 'object-cover' : 'object-contain'
            }`}
          />
        </div>

        {/* Title, Batch & Prompt Excerpt */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span
              className="text-xs font-semibold text-slate-900 truncate"
              title={item.title}
            >
              {item.title}
            </span>
            <span className="text-[10px] text-slate-400 shrink-0">
              · {item.sourceStudio === 'sku_studio' ? 'SKU工作台' : '详情页'}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 truncate mt-0.5">
            {item.promptSnapshot || item.batchTitle || '无提示词快照'}
          </p>
        </div>

        {/* Spec & Timestamp */}
        <div className="hidden sm:flex flex-col items-end text-[10px] font-mono-tabular text-slate-400 shrink-0">
          <span className="text-slate-600 font-medium">
            {item.aspectRatio} · {item.imageSize}
          </span>
          <span>{item.createdAt}</span>
        </div>

        {/* Right Icon Action Bar */}
        <div className="flex items-center gap-0.5 shrink-0 w-[150px] border-l border-slate-100 pl-2">
          {renderRecordActionButtons(item)}
        </div>
      </div>
    );
  };

  return (
    <div className="w-full flex-1 overflow-y-auto lg:overflow-hidden bg-[#F4F5F7]">
      {/* Hidden file inputs for Common Assets */}
      <input
        ref={prodUploadInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          onUploadCommonAssetFiles(e.target.files, 'product', false);
          e.target.value = '';
        }}
      />
      <input
        ref={moldUploadInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          onUploadCommonAssetFiles(e.target.files, 'product', true);
          setAssetCategoryFilter('mold');
          e.target.value = '';
        }}
      />
      <input
        ref={caseUploadInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          onUploadCommonAssetFiles(e.target.files, 'case', false);
          e.target.value = '';
        }}
      />

      {/* ================= FULL-BLEED 3-REGION WORKBENCH (3:6:1 <-> 0:8:2 PROPORTION) ================= */}
      <div className="w-full px-3 py-2.5 lg:h-[calc(100vh-56px)] grid grid-cols-1 lg:grid-cols-10 gap-3 items-stretch">
        {/* =====================================================================
            LEFT REGION (占比 3 / 30%, 可向左折叠为 0): 常用素材库
           ===================================================================== */}
        {!isLeftAssetsCollapsed && (
          <section className="lg:col-span-3 bg-white rounded-xl border border-slate-200/80 shadow-[0_1px_2px_rgba(15,23,42,0.02)] flex flex-col lg:h-full overflow-hidden">
            {/* Unified Primary Header (h-10) */}
            <div className="h-10 px-3 border-b border-slate-100 flex items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-1.5 min-w-0">
                <ImageIcon className="w-4 h-4 text-slate-700 shrink-0" />
                <h2 className="text-xs font-semibold text-slate-900 truncate">
                  常用素材库
                </h2>
                <span className="text-[11px] font-mono-tabular text-slate-400">
                  ({commonAssets.length})
                </span>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                {workspaceReferenceImages.length > 0 && (
                  <button
                    type="button"
                    onClick={onImportFromCurrentWorkspace}
                    title="将当前工作台中的参考图一键沉淀到常用素材库"
                    className="btn-ghost h-6 px-1.5 text-[11px] flex items-center gap-1 cursor-pointer font-mono-tabular"
                  >
                    <FolderDown className="w-3 h-3" />
                    <span>沉淀({workspaceReferenceImages.length})</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => moldUploadInputRef.current?.click()}
                  className="btn-secondary h-6 px-1.5 text-[11px] flex items-center gap-0.5 cursor-pointer text-emerald-700 border-emerald-200/90 bg-emerald-50/70 hover:bg-emerald-100/80"
                  title="直接上传通用公模图（自动归类至「公模」分类）"
                >
                  <Upload className="w-3 h-3 text-emerald-600" />
                  <span>+公模</span>
                </button>
                <button
                  type="button"
                  onClick={() => caseUploadInputRef.current?.click()}
                  className="btn-secondary h-6 px-1.5 text-[11px] flex items-center gap-0.5 cursor-pointer"
                  title="上传常用对标案例图 (#Case)"
                >
                  <Upload className="w-3 h-3 text-slate-500" />
                  <span>+#Case</span>
                </button>
                <button
                  type="button"
                  onClick={() => prodUploadInputRef.current?.click()}
                  className="btn-primary h-6 px-1.5 text-[11px] flex items-center gap-0.5 cursor-pointer"
                  title="上传常用款式产品实拍图 (#Prod)"
                >
                  <Upload className="w-3 h-3" />
                  <span>+#Prod</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsLeftAssetsCollapsed(true)}
                  className="btn-ghost h-6 w-6 flex items-center justify-center text-slate-400 hover:text-slate-800 rounded cursor-pointer"
                  title="向左折叠常用素材库（切换为 0 : 8 : 2 大屏浏览比例）"
                >
                  <PanelLeftClose className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

          {/* Unified Secondary Filter, Sort & Batch Toolbar */}
          <div className="min-h-[38px] px-3 py-1.5 border-b border-slate-100 bg-slate-50/60 space-y-1.5 shrink-0 flex flex-col justify-center">
            <div className="flex items-center justify-between gap-1.5">
              <div className="macos-segmented-track flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => setAssetCategoryFilter('all')}
                  className={`px-1.5 py-0.5 rounded-[5px] text-[11px] transition-all cursor-pointer font-mono-tabular ${
                    assetCategoryFilter === 'all'
                      ? 'macos-segmented-thumb-active'
                      : 'text-slate-600 hover:text-slate-900 font-medium'
                  }`}
                >
                  全部({commonAssets.length})
                </button>
                <button
                  type="button"
                  onClick={() => setAssetCategoryFilter('product')}
                  className={`px-1.5 py-0.5 rounded-[5px] text-[11px] transition-all cursor-pointer font-mono-tabular ${
                    assetCategoryFilter === 'product'
                      ? 'macos-segmented-thumb-active'
                      : 'text-slate-600 hover:text-slate-900 font-medium'
                  }`}
                  title="仅查看款式/花色产品图 (#Prod)"
                >
                  #Prod({prodAssetsCount})
                </button>
                <button
                  type="button"
                  onClick={() => setAssetCategoryFilter('case')}
                  className={`px-1.5 py-0.5 rounded-[5px] text-[11px] transition-all cursor-pointer font-mono-tabular ${
                    assetCategoryFilter === 'case'
                      ? 'macos-segmented-thumb-active'
                      : 'text-slate-600 hover:text-slate-900 font-medium'
                  }`}
                  title="仅查看对标案例图 (#Case)"
                >
                  #Case({caseAssetsCount})
                </button>
                <button
                  type="button"
                  onClick={() => setAssetCategoryFilter('mold')}
                  className={`px-1.5 py-0.5 rounded-[5px] text-[11px] transition-all cursor-pointer font-mono-tabular ${
                    assetCategoryFilter === 'mold'
                      ? 'macos-segmented-thumb-active text-emerald-700'
                      : 'text-emerald-700 hover:text-emerald-900 font-medium'
                  }`}
                  title="仅查看通用白壳/结构公模图 (公模)"
                >
                  公模({moldAssetsCount})
                </button>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                {/* Sort by Time / Name Toggle */}
                <button
                  type="button"
                  onClick={() => setAssetSortBy(cycleSortOption(assetSortBy))}
                  className="btn-secondary h-6 px-1.5 text-[11px] flex items-center gap-1 cursor-pointer font-mono-tabular"
                  title="点击切换排序方式：按时间最新/最早 或 按名称 A-Z/Z-A"
                >
                  <ArrowUpDown className="w-3 h-3 text-slate-500" />
                  <span>{getSortLabel(assetSortBy)}</span>
                </button>

                {filteredCommonAssets.length > 0 && (
                  <button
                    type="button"
                    onClick={handleSelectAllFilteredAssets}
                    className="btn-ghost px-1.5 py-0.5 text-[11px] cursor-pointer shrink-0"
                  >
                    {filteredCommonAssets.every((a) =>
                      selectedAssetIds.includes(a.id)
                    )
                      ? '取消'
                      : '全选'}
                  </button>
                )}
              </div>
            </div>

            {selectedAssetIds.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1 border-t border-slate-200/70">
                <span className="text-[11px] font-semibold text-blue-600 font-mono-tabular">
                  已选 {selectedAssetIds.length} 项
                </span>
                <div className="flex flex-wrap items-center gap-1">
                  {commonAssets.some(
                    (a) =>
                      selectedAssetIds.includes(a.id) &&
                      a.category === 'product'
                  ) && (
                    <button
                      type="button"
                      onClick={() => {
                        const chosenProds = commonAssets.filter(
                          (a) =>
                            selectedAssetIds.includes(a.id) &&
                            a.category === 'product'
                        );
                        const allAreMold = chosenProds.every((a) =>
                          Boolean(a.isCommonAsset)
                        );
                        const targetMoldState = !allAreMold;
                        chosenProds.forEach((a) => {
                          onUpdateCommonAsset(a.id, {
                            isCommonAsset: targetMoldState,
                          });
                        });
                        onShowToast(
                          targetMoldState
                            ? `已将所选 ${chosenProds.length} 张产品图归类至「公模」分类`
                            : `已将所选 ${chosenProds.length} 张公模图恢复归类至「#Prod 款式图」`,
                          'success'
                        );
                      }}
                      className="btn-secondary px-1.5 py-0.5 text-[11px] flex items-center gap-1 cursor-pointer text-emerald-700 border-emerald-200 bg-emerald-50/70 hover:bg-emerald-100/80"
                      title="将所选产品图一键批量归类为「公模」或恢复为「#Prod 款式图」"
                    >
                      <span>
                        {commonAssets
                          .filter(
                            (a) =>
                              selectedAssetIds.includes(a.id) &&
                              a.category === 'product'
                          )
                          .every((a) => Boolean(a.isCommonAsset))
                          ? '转#Prod'
                          : '归类公模'}
                      </span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      const chosen = commonAssets.filter((a) =>
                        selectedAssetIds.includes(a.id)
                      );
                      onPushAssetsToStudio(chosen, 'sku_studio');
                    }}
                    className="btn-primary px-2 py-0.5 text-[11px] flex items-center gap-1 cursor-pointer"
                    title="推至 ① 主图/SKU工作台"
                  >
                    <Palette className="w-3 h-3" />
                    <span>推主图/SKU</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const chosen = commonAssets.filter((a) =>
                        selectedAssetIds.includes(a.id)
                      );
                      onPushAssetsToStudio(chosen, 'detail_studio');
                    }}
                    className="btn-secondary px-2 py-0.5 text-[11px] flex items-center gap-1 cursor-pointer"
                    title="推至 ② 详情页工作台"
                  >
                    <LayoutList className="w-3 h-3 text-slate-600" />
                    <span>推详情</span>
                  </button>
                  {onBatchUploadCommonAssetsToOss && (
                    <button
                      type="button"
                      disabled={isBatchUploadingAssets}
                      onClick={async () => {
                        const chosen = commonAssets.filter((a) =>
                          selectedAssetIds.includes(a.id)
                        );
                        if (chosen.length === 0) return;
                        setIsBatchUploadingAssets(true);
                        try {
                          await onBatchUploadCommonAssetsToOss(chosen);
                        } finally {
                          setIsBatchUploadingAssets(false);
                        }
                      }}
                      title={`批量上传所选素材至 ${cloudLabel}`}
                      className="btn-secondary px-2 py-0.5 text-[11px] flex items-center gap-1 cursor-pointer disabled:opacity-50"
                    >
                      {isBatchUploadingAssets ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <CloudUpload
                          className={`w-3 h-3 ${
                            isR2 ? 'text-orange-600' : 'text-emerald-600'
                          }`}
                        />
                      )}
                      <span>上传{cloudShort}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      onDeleteCommonAssets(selectedAssetIds);
                      setSelectedAssetIds([]);
                    }}
                    className="btn-ghost p-1 text-rose-600 hover:bg-rose-50 cursor-pointer"
                    title="批量删除所选素材"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Left Scrollable Assets Grid (4 items per row as requested) */}
          <div className="flex-1 overflow-y-auto p-2.5">
            {filteredCommonAssets.length === 0 ? (
              <div className="h-full min-h-[280px] rounded-lg border border-dashed border-slate-200 bg-slate-50/40 p-6 flex flex-col items-center justify-center text-center space-y-2.5">
                <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center">
                  <ImageIcon className="w-4 h-4" />
                </div>
                <div className="space-y-1 max-w-xs">
                  <h3 className="text-xs font-semibold text-slate-800">
                    {assetCategoryFilter === 'mold'
                      ? '暂无已归类的公模图'
                      : '常用素材库暂无图片'}
                  </h3>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    {assetCategoryFilter === 'mold'
                      ? '可直接上传公模底图，或在 #Prod 列表中将任意款式图一键归类为「公模」。'
                      : '上传高频复用的产品图（#Prod）、公模图或对标案例图（#Case），随时一键推入工作台。'}
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => moldUploadInputRef.current?.click()}
                    className="btn-secondary px-2.5 py-1 text-[11px] flex items-center gap-1 cursor-pointer text-emerald-700 border-emerald-200 bg-emerald-50/60 hover:bg-emerald-100/70"
                  >
                    <Upload className="w-3 h-3 text-emerald-600" />
                    <span>上传公模</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => prodUploadInputRef.current?.click()}
                    className="btn-primary px-2.5 py-1 text-[11px] flex items-center gap-1 cursor-pointer"
                  >
                    <Upload className="w-3 h-3" />
                    <span>上传 #Prod</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => caseUploadInputRef.current?.click()}
                    className="btn-secondary px-2.5 py-1 text-[11px] flex items-center gap-1 cursor-pointer"
                  >
                    <Upload className="w-3 h-3 text-slate-500" />
                    <span>上传 #Case</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {filteredCommonAssets.map((asset) => {
                  const isSelected = selectedAssetIds.includes(asset.id);
                  const isProd = asset.category === 'product';
                  const activeDims = asset.caseDimensions || [
                    'style',
                    'structure',
                  ];
                  const isDimEditorOpen = editingDimAssetId === asset.id;
                  const activeAssetCloudUrl = getCloudUrlForProvider(
                    asset.ossUrl,
                    asset.cloudUrls,
                    storageProvider
                  );
                  const otherProvider: CloudStorageProvider = isR2
                    ? 'aliyun_oss'
                    : 'cloudflare_r2';
                  const otherAssetCloudUrl = getCloudUrlForProvider(
                    asset.ossUrl,
                    asset.cloudUrls,
                    otherProvider
                  );
                  const isAssetUploading =
                    uploadingOssAssetIds.includes(asset.id) ||
                    Boolean(asset.ossUploading);

                  return (
                    <div
                      key={asset.id}
                      className={`group bg-white rounded-lg border p-1.5 flex flex-col gap-1 transition-all relative ${
                        isSelected
                          ? 'border-blue-600 ring-2 ring-blue-500/15 shadow-xs'
                          : 'border-slate-200/80 hover:border-slate-300 shadow-[0_1px_2px_rgba(15,23,42,0.02)]'
                      }`}
                    >
                      {/* 1:1 Thumbnail Box */}
                      <div
                        onClick={() =>
                          onPreviewImage(
                            asset.previewUrl,
                            asset.tag,
                            isProd
                              ? '常用产品参考图 (#Prod)'
                              : '常用对标案例图 (#Case)'
                          )
                        }
                        title="点击图片直接放大预览"
                        className="relative aspect-square w-full rounded overflow-hidden bg-slate-100/90 border border-slate-200/60 cursor-zoom-in"
                      >
                        <img
                          src={asset.previewUrl}
                          alt={asset.tag}
                          className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-200"
                        />

                        {/* Top-Left Selection Checkbox */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleSelectAsset(asset.id);
                          }}
                          title={isSelected ? '取消选择' : '勾选此素材'}
                          className={`absolute top-1 left-1 w-4 h-4 rounded flex items-center justify-center transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-blue-600 text-white shadow-2xs'
                              : 'bg-white/95 hover:bg-white text-transparent border border-slate-300/90 group-hover:border-slate-400'
                          }`}
                        >
                          <Check className="w-2.5 h-2.5" />
                        </button>

                        {/* Top-Right Category Label */}
                        <span
                          className={`absolute top-1 right-1 px-1 py-0.5 text-[9px] font-mono-tabular font-semibold rounded backdrop-blur-xs pointer-events-none ${
                            isProd
                              ? asset.isCommonAsset
                                ? 'bg-emerald-700/85 text-white'
                                : 'bg-slate-900/75 text-white'
                              : 'bg-slate-800/80 text-amber-200'
                          }`}
                        >
                          {isProd
                            ? asset.isCommonAsset
                              ? '公模'
                              : '#Prod'
                            : '#Case'}
                        </span>

                        {/* Bottom-Right Cloud Sync Badge on Thumbnail */}
                        {isAssetUploading ? (
                          <span className="absolute bottom-1 right-1 px-1 py-0.2 bg-blue-600/90 text-white text-[8px] font-mono-tabular rounded flex items-center gap-0.5 pointer-events-none">
                            <Loader2 className="w-2 h-2 animate-spin" />
                            <span>{cloudShort}</span>
                          </span>
                        ) : activeAssetCloudUrl ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigator.clipboard
                                .writeText(activeAssetCloudUrl)
                                .catch(() => {});
                              onShowToast(
                                `已复制「${asset.tag || asset.name}」的 ${cloudLabel} 直链`,
                                'success'
                              );
                            }}
                            title={`已同步至 ${cloudLabel}（点击复制直链）`}
                            className={`absolute bottom-1 right-1 px-1 py-0.2 text-white text-[8px] font-mono-tabular font-semibold rounded cursor-pointer ${
                              isR2
                                ? 'bg-orange-600/90 hover:bg-orange-700'
                                : 'bg-emerald-600/90 hover:bg-emerald-700'
                            }`}
                          >
                            {cloudShort}✓
                          </button>
                        ) : null}
                      </div>

                      {/* Tag Input & Metadata Row */}
                      <div className="space-y-0.5">
                        <input
                          type="text"
                          value={asset.tag}
                          onChange={(e) =>
                            onUpdateCommonAsset(asset.id, {
                              tag: e.target.value,
                            })
                          }
                          placeholder="未命名标签..."
                          className="w-full px-1 py-0.5 text-[10px] font-medium bg-slate-50/70 hover:bg-slate-100/70 border border-transparent focus:border-blue-600 focus:bg-white rounded focus:outline-none text-slate-800 truncate transition-colors"
                        />

                        <div className="flex items-center justify-between gap-1 px-0.5 h-3.5 text-[9px] text-slate-500">
                          {isProd ? (
                            <button
                              type="button"
                              onClick={() => {
                                const nextMold = !asset.isCommonAsset;
                                onUpdateCommonAsset(asset.id, {
                                  isCommonAsset: nextMold,
                                });
                                onShowToast(
                                  nextMold
                                    ? `已将「${asset.tag || asset.name}」归类至「公模」分类`
                                    : `已将「${asset.tag || asset.name}」归类至「#Prod 款式图」分类`,
                                  'info'
                                );
                              }}
                              className="hover:text-slate-900 flex items-center gap-1 cursor-pointer truncate"
                              title="点击一键切换分类：公模图（归入「公模」标签页） vs 款式花色图（归入「#Prod」标签页）"
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                  asset.isCommonAsset
                                    ? 'bg-emerald-500'
                                    : 'bg-blue-600'
                                }`}
                              />
                              <span className="truncate">
                                {asset.isCommonAsset ? '公模' : '花色'}
                              </span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              data-dim-editor-root="true"
                              onClick={() =>
                                setEditingDimAssetId(
                                  isDimEditorOpen ? null : asset.id
                                )
                              }
                              className="hover:text-slate-900 flex items-center gap-0.5 cursor-pointer truncate"
                              title="点击配置对标参考维度"
                            >
                              <SlidersHorizontal className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                              <span className="truncate">
                                {activeDims
                                  .map(
                                    (d) =>
                                      CASE_DIM_LABELS.find(
                                        (l) => l.value === d
                                      )?.label.slice(0, 2) || d
                                  )
                                  .join('·')}
                              </span>
                            </button>
                          )}

                          <span className="font-mono-tabular text-[9px] text-slate-400 shrink-0">
                            {activeAssetCloudUrl
                              ? `${cloudShort}✓`
                              : asset.createdAt.split(' ')[0].slice(5)}
                          </span>
                        </div>
                      </div>

                      {/* Unified Bottom 4-Icon Action Bar (SKU | Detail | Upload Cloud | Delete) */}
                      <div className="flex items-center justify-between gap-0.5 pt-1 mt-auto border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() =>
                            onPushAssetsToStudio([asset], 'sku_studio')
                          }
                          className="btn-ghost flex-1 py-0.5 flex items-center justify-center text-slate-600 hover:text-blue-600 hover:bg-blue-50/60 rounded cursor-pointer transition-colors"
                          title="推至 ① 主图/SKU工作台"
                        >
                          <Palette className="w-3 h-3" />
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            onPushAssetsToStudio([asset], 'detail_studio')
                          }
                          className="btn-ghost flex-1 py-0.5 flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded cursor-pointer transition-colors"
                          title="推至 ② 详情页工作台"
                        >
                          <LayoutList className="w-3 h-3" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleTriggerUploadAssetOss(asset)}
                          disabled={isAssetUploading}
                          className={`flex-1 py-0.5 flex items-center justify-center rounded cursor-pointer transition-colors ${
                            activeAssetCloudUrl
                              ? isR2
                                ? 'text-orange-600 bg-orange-50/90 hover:bg-orange-100'
                                : 'text-emerald-600 bg-emerald-50/90 hover:bg-emerald-100'
                              : isAssetUploading
                                ? 'text-blue-600 bg-blue-50/70'
                                : otherAssetCloudUrl
                                  ? 'btn-ghost text-amber-600 hover:text-blue-600 hover:bg-blue-50/60'
                                  : 'btn-ghost text-slate-500 hover:text-blue-600 hover:bg-blue-50/60'
                          }`}
                          title={
                            activeAssetCloudUrl
                              ? `已上传至 ${cloudLabel}（点击复制云端直链: ${activeAssetCloudUrl}）`
                              : isAssetUploading
                                ? `正在上传至 ${cloudLabel}...`
                                : otherAssetCloudUrl
                                  ? `原先已传至${isR2 ? '阿里云 OSS' : 'Cloudflare R2'}，点击上传至当前 ${cloudLabel}`
                                  : `上传此素材至 ${cloudLabel}`
                          }
                        >
                          {isAssetUploading ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <CloudUpload className="w-3 h-3" />
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            onDeleteCommonAssets([asset.id]);
                            setSelectedAssetIds((prev) =>
                              prev.filter((id) => id !== asset.id)
                            );
                          }}
                          className="btn-ghost flex-1 py-0.5 flex items-center justify-center text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded cursor-pointer transition-colors"
                          title="删除此素材"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>

                      {!isProd && isDimEditorOpen && (
                        <div
                          data-dim-editor-root="true"
                          className="absolute left-1 right-1 bottom-7 bg-white border border-slate-200 rounded-lg shadow-lg p-1.5 z-20 space-y-1"
                        >
                          <div className="flex items-center justify-between text-[9px] text-slate-500 px-0.5">
                            <span>维度</span>
                            <button
                              type="button"
                              onClick={() => setEditingDimAssetId(null)}
                              className="text-blue-600 font-semibold cursor-pointer"
                            >
                              完成
                            </button>
                          </div>
                          <div className="grid grid-cols-2 gap-1">
                            {CASE_DIM_LABELS.map((dim) => {
                              const active = activeDims.includes(dim.value);
                              return (
                                <button
                                  key={dim.value}
                                  type="button"
                                  onClick={() =>
                                    toggleAssetCaseDimension(asset, dim.value)
                                  }
                                  className={`px-1 py-0.5 text-[10px] rounded border font-medium cursor-pointer transition-colors ${
                                    active
                                      ? 'bg-blue-50 text-blue-700 border-blue-200 font-semibold'
                                      : 'bg-slate-50 text-slate-500 border-slate-200/70 hover:text-slate-800'
                                  }`}
                                >
                                  {dim.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
        )}

        {/* =====================================================================
            CENTER REGION (默认占比 5 / 左栏折叠后自动扩展为 8): 生成记录归档
           ===================================================================== */}
        <section
          className={`${
            isLeftAssetsCollapsed ? 'lg:col-span-8' : 'lg:col-span-5'
          } bg-white rounded-xl border border-slate-200/80 shadow-[0_1px_2px_rgba(15,23,42,0.02)] flex flex-col lg:h-full overflow-hidden`}
        >
          {/* Unified Primary Header (h-10) */}
          <div className="h-10 px-3.5 border-b border-slate-100 flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              {isLeftAssetsCollapsed && (
                <button
                  type="button"
                  onClick={() => setIsLeftAssetsCollapsed(false)}
                  className="btn-secondary h-6 px-2 text-[11px] flex items-center gap-1 cursor-pointer shrink-0 font-mono-tabular"
                  title="展开左侧常用素材库（恢复 3 : 5 : 2 三栏比例）"
                >
                  <PanelLeftOpen className="w-3.5 h-3.5 text-blue-600" />
                  <span>素材库({commonAssets.length})</span>
                </button>
              )}
              <History className="w-4 h-4 text-slate-700 shrink-0" />
              <h2 className="text-xs font-semibold text-slate-900 truncate">
                生成记录归档
              </h2>
              <span className="text-[11px] font-mono-tabular text-slate-400">
                共 {generationRecords.length} 张
              </span>
            </div>

            {/* Right: 3 Display Modes (画廊 / 列表 / 按批次) */}
            <div className="flex items-center gap-1.5 shrink-0">
              <div className="macos-segmented-track flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => setRecordDisplayMode('flat')}
                  className={`px-2 py-0.5 rounded-[5px] text-[11px] flex items-center gap-1 transition-all cursor-pointer ${
                    recordDisplayMode === 'flat'
                      ? 'macos-segmented-thumb-active'
                      : 'text-slate-600 hover:text-slate-900 font-medium'
                  }`}
                  title="画廊网格平铺视图"
                >
                  <LayoutGrid className="w-3 h-3" />
                  <span>画廊</span>
                </button>
                <button
                  type="button"
                  onClick={() => setRecordDisplayMode('list')}
                  className={`px-2 py-0.5 rounded-[5px] text-[11px] flex items-center gap-1 transition-all cursor-pointer ${
                    recordDisplayMode === 'list'
                      ? 'macos-segmented-thumb-active'
                      : 'text-slate-600 hover:text-slate-900 font-medium'
                  }`}
                  title="紧凑列表视图"
                >
                  <ListIcon className="w-3 h-3" />
                  <span>列表</span>
                </button>
                <button
                  type="button"
                  onClick={() => setRecordDisplayMode('batch')}
                  className={`px-2 py-0.5 rounded-[5px] text-[11px] flex items-center gap-1 transition-all cursor-pointer ${
                    recordDisplayMode === 'batch'
                      ? 'macos-segmented-thumb-active'
                      : 'text-slate-600 hover:text-slate-900 font-medium'
                  }`}
                  title="按批次折叠视图"
                >
                  <Layers className="w-3 h-3" />
                  <span>按批次</span>
                </button>
              </div>
            </div>
          </div>

          {/* Unified Secondary Filter, Sort & Multi-Select Toolbar */}
          <div className="min-h-[38px] px-3.5 py-1.5 border-b border-slate-100 bg-slate-50/60 space-y-1.5 shrink-0 flex flex-col justify-center">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="macos-segmented-track flex items-center gap-0.5">
                  <button
                    type="button"
                    onClick={() => setRecordSourceFilter('all')}
                    className={`px-2.5 py-0.5 rounded-[5px] text-[11px] transition-all cursor-pointer font-mono-tabular ${
                      recordSourceFilter === 'all'
                        ? 'macos-segmented-thumb-active'
                        : 'text-slate-600 hover:text-slate-900 font-medium'
                    }`}
                  >
                    全部来源 ({generationRecords.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setRecordSourceFilter('sku_studio')}
                    className={`px-2.5 py-0.5 rounded-[5px] text-[11px] transition-all cursor-pointer font-mono-tabular ${
                      recordSourceFilter === 'sku_studio'
                        ? 'macos-segmented-thumb-active'
                        : 'text-slate-600 hover:text-slate-900 font-medium'
                    }`}
                  >
                    ① 主图/SKU (
                    {
                      generationRecords.filter(
                        (r) => r.sourceStudio === 'sku_studio'
                      ).length
                    }
                    )
                  </button>
                  <button
                    type="button"
                    onClick={() => setRecordSourceFilter('detail_studio')}
                    className={`px-2.5 py-0.5 rounded-[5px] text-[11px] transition-all cursor-pointer font-mono-tabular ${
                      recordSourceFilter === 'detail_studio'
                        ? 'macos-segmented-thumb-active'
                        : 'text-slate-600 hover:text-slate-900 font-medium'
                    }`}
                  >
                    ② 详情页 (
                    {
                      generationRecords.filter(
                        (r) => r.sourceStudio === 'detail_studio'
                      ).length
                    }
                    )
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {/* Sort by Time / Name Toggle */}
                <button
                  type="button"
                  onClick={() => setRecordSortBy(cycleSortOption(recordSortBy))}
                  className="btn-secondary h-6 px-2 text-[11px] flex items-center gap-1 cursor-pointer font-mono-tabular"
                  title="点击切换排序方式：按时间最新/最早 或 按名称 A-Z/Z-A"
                >
                  <ArrowUpDown className="w-3 h-3 text-slate-500" />
                  <span>排序: {getSortLabel(recordSortBy)}</span>
                </button>

                {filteredRecords.length > 0 && (
                  <button
                    type="button"
                    onClick={handleSelectAllFilteredRecords}
                    className="btn-ghost px-2 py-0.5 text-[11px] cursor-pointer shrink-0"
                  >
                    {filteredRecords.every((r) =>
                      selectedRecordIds.includes(r.id)
                    )
                      ? '取消全选'
                      : '全选当前'}
                  </button>
                )}
              </div>
            </div>

            {/* Multi-select batch action bar for Generation Records */}
            {selectedRecordIds.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-200/70">
                <span className="text-[11px] font-semibold text-blue-600 font-mono-tabular">
                  已选 {selectedRecordIds.length} 张成图
                  <span className="ml-1.5 font-normal text-slate-400">
                    {selectedRecordIds.length >= 3
                      ? '（满3张自动打包ZIP）'
                      : '（少于3张直接下载原图）'}
                  </span>
                </span>
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    disabled={isExportingRecordsZip}
                    onClick={handleBatchDownloadSelectedRecords}
                    className="btn-primary px-2.5 py-0.5 text-[11px] flex items-center gap-1 cursor-pointer disabled:opacity-50"
                    title={
                      selectedRecordIds.length >= 3
                        ? '已选满 3 张，自动打包为 .zip 压缩包导出（含原图与提示词清单）'
                        : '少于 3 张不打压缩包，直接逐张下载 PNG 原图'
                    }
                  >
                    {isExportingRecordsZip ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Download className="w-3 h-3" />
                    )}
                    <span>
                      {isExportingRecordsZip
                        ? '正在打包ZIP...'
                        : selectedRecordIds.length >= 3
                          ? `打包下载 ZIP (${selectedRecordIds.length})`
                          : `批量下载 (${selectedRecordIds.length})`}
                    </span>
                  </button>
                  {onSaveRecordsToCommonAssets && (
                    <button
                      type="button"
                      onClick={() => {
                        const chosen = generationRecords.filter((r) =>
                          selectedRecordIds.includes(r.id)
                        );
                        onSaveRecordsToCommonAssets(chosen, 'case');
                        setSelectedRecordIds([]);
                      }}
                      className="btn-secondary px-2.5 py-0.5 text-[11px] flex items-center gap-1 cursor-pointer"
                    >
                      <FolderPlus className="w-3 h-3 text-slate-600" />
                      <span>存为 #Case 素材</span>
                    </button>
                  )}
                  {onBatchUploadRecordsToOss && (
                    <button
                      type="button"
                      disabled={isBatchUploadingRecords}
                      onClick={async () => {
                        const chosen = generationRecords.filter((r) =>
                          selectedRecordIds.includes(r.id)
                        );
                        if (chosen.length === 0) return;
                        setIsBatchUploadingRecords(true);
                        try {
                          await onBatchUploadRecordsToOss(chosen);
                        } finally {
                          setIsBatchUploadingRecords(false);
                        }
                      }}
                      title={`批量上传所选成图至 ${cloudLabel}`}
                      className="btn-secondary px-2.5 py-0.5 text-[11px] flex items-center gap-1 cursor-pointer disabled:opacity-50"
                    >
                      {isBatchUploadingRecords ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <CloudUpload
                          className={`w-3 h-3 ${
                            isR2 ? 'text-orange-600' : 'text-emerald-600'
                          }`}
                        />
                      )}
                      <span>上传{cloudShort}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      onDeleteGenerationRecords(selectedRecordIds);
                      setSelectedRecordIds([]);
                    }}
                    className="btn-ghost p-1 text-rose-600 hover:bg-rose-50 cursor-pointer"
                    title="批量删除所选记录"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Center Scrollable Content Area */}
          <div className="flex-1 overflow-y-auto p-3">
            {filteredRecords.length === 0 ? (
              <div className="h-full min-h-[280px] rounded-lg border border-dashed border-slate-200 bg-slate-50/40 p-8 flex flex-col items-center justify-center text-center space-y-3">
                <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center">
                  <History className="w-5 h-5" />
                </div>
                <div className="space-y-1 max-w-sm">
                  <h3 className="text-xs font-semibold text-slate-800">
                    暂无符合筛选条件的生成记录
                  </h3>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    在「① 主图/SKU工作台」或「② 详情页工作台」生成的成品图会自动归档至此。
                  </p>
                </div>
                <div className="flex items-center justify-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={onSwitchToSkuStudio}
                    className="btn-primary px-3 py-1.5 text-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <Palette className="w-3.5 h-3.5" />
                    <span>前往主图/SKU工作台</span>
                  </button>
                  <button
                    type="button"
                    onClick={onSwitchToDetailStudio}
                    className="btn-secondary px-3 py-1.5 text-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <LayoutList className="w-3.5 h-3.5" />
                    <span>前往详情页工作台</span>
                  </button>
                </div>
              </div>
            ) : recordDisplayMode === 'flat' ? (
              /* MODE 1: High-Density Flat Gallery Grid */
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-2.5">
                {filteredRecords.map((item) =>
                  renderGenerationRecordCard(item)
                )}
              </div>
            ) : recordDisplayMode === 'list' ? (
              /* MODE 2: Compact Horizontal List View */
              <div className="space-y-1.5">
                {filteredRecords.map((item) =>
                  renderGenerationRecordListRow(item)
                )}
              </div>
            ) : (
              /* MODE 3: Smart Merged Batch Groups */
              <div className="space-y-2.5">
                {groupedBatches.map((batch) => {
                  const expanded = isBatchExpanded(batch.batchId);
                  const batchIds = batch.items.map((i) => i.id);

                  return (
                    <div
                      key={batch.batchId}
                      className="rounded-lg border border-slate-200/85 bg-white transition-all overflow-hidden"
                    >
                      {/* Batch Header Bar */}
                      <div
                        onClick={() =>
                          toggleBatchExpand(batch.batchId, expanded)
                        }
                        className="px-3 py-2 flex flex-wrap items-center justify-between gap-2 cursor-pointer select-none bg-slate-50/50 hover:bg-slate-100/60 transition-colors"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-slate-400">
                            {expanded ? (
                              <ChevronDown className="w-4 h-4" />
                            ) : (
                              <ChevronRight className="w-4 h-4" />
                            )}
                          </span>

                          <span className="text-[11px] font-medium text-slate-500 shrink-0">
                            {batch.sourceStudio === 'sku_studio'
                              ? 'SKU工作台'
                              : '详情页'}
                          </span>
                          <span className="text-slate-300" aria-hidden="true">
                            ·
                          </span>

                          <h3 className="text-xs font-semibold text-slate-900 truncate">
                            {batch.batchTitle}
                          </h3>

                          <span className="text-slate-300" aria-hidden="true">
                            ·
                          </span>

                          <span className="text-[11px] font-mono-tabular text-slate-500 shrink-0">
                            {batch.items.length} 张
                          </span>
                        </div>

                        <div
                          className="flex items-center gap-1.5 shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <span className="text-[10px] font-mono-tabular text-slate-400 pr-1">
                            {batch.createdAtLabel}
                          </span>

                          <button
                            type="button"
                            onClick={() => {
                              const allBatchSelected = batchIds.every((id) =>
                                selectedRecordIds.includes(id)
                              );
                              if (allBatchSelected) {
                                setSelectedRecordIds((prev) =>
                                  prev.filter((id) => !batchIds.includes(id))
                                );
                              } else {
                                setSelectedRecordIds((prev) =>
                                  Array.from(new Set([...prev, ...batchIds]))
                                );
                              }
                            }}
                            className="btn-ghost px-1.5 py-0.5 text-[11px] text-slate-600 hover:text-blue-600 cursor-pointer"
                            title="一键勾选或取消勾选本批次全部成图"
                          >
                            {batchIds.every((id) =>
                              selectedRecordIds.includes(id)
                            )
                              ? '取消本组'
                              : '全选本组'}
                          </button>

                          <button
                            type="button"
                            disabled={
                              exportingBatchZipId === batch.batchId ||
                              isExportingRecordsZip
                            }
                            onClick={async () => {
                              if (batch.items.length >= 3) {
                                setExportingBatchZipId(batch.batchId);
                                try {
                                  await handleExportRecordsAsZip(
                                    batch.items,
                                    batch.batchTitle || 'EComStudio_批次归档导出'
                                  );
                                } finally {
                                  setExportingBatchZipId(null);
                                }
                              } else {
                                batch.items.forEach((item, idx) => {
                                  setTimeout(() => {
                                    downloadGenerationRecordImage(
                                      item.imageUrl,
                                      item.itemIndex,
                                      item.title
                                    );
                                  }, idx * 180);
                                });
                                onShowToast(`已直接下载本批次 ${batch.items.length} 张成图`, 'success');
                              }
                            }}
                            className="btn-secondary h-6 px-2 text-[11px] flex items-center gap-1 cursor-pointer disabled:opacity-50"
                            title={
                              batch.items.length >= 3
                                ? '将本批次全部成图自动打包为 .zip 压缩包下载'
                                : '本批次少于 3 张，直接下载原图'
                            }
                          >
                            {exportingBatchZipId === batch.batchId ? (
                              <Loader2 className="w-3 h-3 animate-spin text-blue-600" />
                            ) : (
                              <Download className="w-3 h-3 text-blue-600" />
                            )}
                            <span>{batch.items.length >= 3 ? '打包ZIP' : '下载本组'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => onDeleteGenerationRecords(batchIds)}
                            className="btn-ghost p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                            title="删除整组记录"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {expanded && (
                        <div className="p-2.5 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-2.5 bg-white">
                          {batch.items.map((item) =>
                            renderGenerationRecordCard(item)
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* =====================================================================
            RIGHT REGION (默认占比 2 / 20%): 正式母版归档
           ===================================================================== */}
        <aside
          className="lg:col-span-2 bg-white rounded-xl border border-slate-200/80 shadow-[0_1px_2px_rgba(15,23,42,0.02)] flex flex-col lg:h-full overflow-hidden"
        >
          {/* Unified Primary Header (h-10) */}
          <div className="h-10 px-2.5 border-b border-slate-100 flex items-center justify-between gap-1 shrink-0">
            <div className="flex items-center gap-1 min-w-0">
              <BookmarkCheck className="w-3.5 h-3.5 text-slate-700 shrink-0" />
              <h2 className="text-xs font-semibold text-slate-900 truncate">
                母版库
              </h2>
              <span className="text-[10px] font-mono-tabular text-slate-400">
                ({templates.length})
              </span>
            </div>
          </div>

          {/* Unified Secondary Action Toolbar */}
          <div className="min-h-[38px] px-2 py-1.5 border-b border-slate-100 bg-slate-50/60 flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={onOpenSaveCurrentModal}
              disabled={!canSaveCurrentWorkspace}
              className="btn-primary flex-1 h-6 px-1.5 text-[10px] flex items-center justify-center gap-0.5 cursor-pointer truncate"
              title="将当前工作台保存为正式母版"
            >
              <FolderPlus className="w-3 h-3 shrink-0" />
              <span className="truncate">存母版</span>
            </button>
            <button
              type="button"
              onClick={onTriggerImportJson}
              className="btn-secondary h-6 px-1.5 text-[10px] flex items-center justify-center cursor-pointer shrink-0"
              title="导入母版包 (.json)"
            >
              <Upload className="w-3 h-3" />
            </button>
          </div>

          {/* Right Scrollable Master Templates List (with Cover Thumbnail) */}
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {templates.length === 0 ? (
              <div className="h-full min-h-[200px] rounded-lg border border-dashed border-slate-200 bg-slate-50/40 p-3 flex flex-col items-center justify-center text-center space-y-2">
                <div className="text-[11px] font-medium text-slate-600">
                  暂无母版
                </div>
                <div className="text-[10px] text-slate-400 leading-relaxed">
                  定稿后可点上方「存母版」归档复用
                </div>
              </div>
            ) : (
              templates.map((tpl) => {
                const isActive = activeMasterId === tpl.id;

                // Collect all available preview images from detail tasks, SKU tasks, and reference images so every master template has a rich thumbnail
                const detailResultUrls = (tpl.tasks || [])
                  .map((t) => t.resultImageUrl)
                  .filter((u): u is string => Boolean(u));
                const skuResultUrls = (tpl.skuTasks || [])
                  .map((st) => st.resultImageUrl)
                  .filter((u): u is string => Boolean(u));
                const caseRefUrls = [
                  ...(tpl.skuReferenceImages || []),
                  ...(tpl.referenceImages || []),
                ]
                  .filter((r) => r.category === 'case')
                  .map((r) => r.previewUrl || r.ossUrl)
                  .filter((u): u is string => Boolean(u));
                const prodRefUrls = [
                  ...(tpl.skuReferenceImages || []),
                  ...(tpl.referenceImages || []),
                ]
                  .filter((r) => r.category === 'product')
                  .map((r) => r.previewUrl || r.ossUrl)
                  .filter((u): u is string => Boolean(u));

                const allThumbs = Array.from(
                  new Set([
                    ...detailResultUrls,
                    ...skuResultUrls,
                    ...caseRefUrls,
                    ...prodRefUrls,
                  ])
                );
                const coverUrl = allThumbs[0] || '';
                const extraThumbs = allThumbs.slice(1, 4);

                return (
                  <div
                    key={tpl.id}
                    className={`p-1.5 rounded-lg border transition-all flex flex-col gap-1.5 bg-white ${
                      isActive
                        ? 'border-blue-600 ring-2 ring-blue-500/15 shadow-xs'
                        : 'border-slate-200/80 hover:border-slate-300 shadow-[0_1px_2px_rgba(15,23,42,0.02)]'
                    }`}
                  >
                    {/* Cover Thumbnail Box */}
                    <div
                      onClick={() =>
                        coverUrl &&
                        onPreviewImage(
                          coverUrl,
                          tpl.name,
                          `详情 ${tpl.tasks.length} 屏 · SKU ${tpl.skuTasks?.length || 0} 款`
                        )
                      }
                      title={coverUrl ? '点击放大预览母版封面图' : tpl.name}
                      className={`relative aspect-square w-full rounded overflow-hidden bg-slate-100 border border-slate-200/60 flex items-center justify-center ${
                        coverUrl ? 'cursor-zoom-in group' : ''
                      }`}
                    >
                      {coverUrl ? (
                        <img
                          src={coverUrl}
                          alt={tpl.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                        />
                      ) : (
                        <BookmarkCheck className="w-5 h-5 text-slate-300" />
                      )}

                      {isActive && (
                        <span className="absolute top-1 left-1 px-1 py-0.5 bg-blue-600 text-white text-[9px] font-semibold rounded pointer-events-none">
                          当前
                        </span>
                      )}

                      {allThumbs.length > 1 && (
                        <span className="absolute bottom-1 right-1 px-1 py-0.5 bg-slate-900/75 text-white text-[9px] font-mono-tabular rounded pointer-events-none">
                          {allThumbs.length}图
                        </span>
                      )}
                    </div>

                    {/* Mini Strip for Secondary Thumbnails (if available) */}
                    {extraThumbs.length > 0 && (
                      <div className="grid grid-cols-3 gap-1">
                        {extraThumbs.map((u, idx) => (
                          <div
                            key={idx}
                            onClick={() =>
                              onPreviewImage(
                                u,
                                `${tpl.name} (${idx + 2})`,
                                '母版预览图'
                              )
                            }
                            className="aspect-square rounded overflow-hidden bg-slate-100 border border-slate-200/60 cursor-zoom-in"
                          >
                            <img
                              src={u}
                              alt={`${tpl.name}-${idx + 2}`}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Template Title & Stats */}
                    <div className="px-0.5 space-y-0.5">
                      <div
                        className="text-[11px] font-semibold text-slate-800 truncate"
                        title={tpl.name}
                      >
                        {tpl.name}
                      </div>
                      <div className="flex items-center justify-between text-[9px] text-slate-400 font-mono-tabular">
                        <span>
                          详{tpl.tasks.length}·SKU{tpl.skuTasks?.length || 0}
                        </span>
                        <span>{tpl.createdAt.split(' ')[0].slice(5)}</span>
                      </div>
                    </div>

                    {/* Unified Bottom Icon Action Bar */}
                    <div className="flex items-center justify-between gap-0.5 pt-1 mt-auto border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => onLoadTemplate(tpl, true)}
                        className="btn-ghost flex-1 py-0.5 flex items-center justify-center text-blue-600 hover:bg-blue-50/70 rounded cursor-pointer transition-colors"
                        title="加载此母版至工作台"
                      >
                        <Play className="w-3 h-3 fill-current" />
                      </button>

                      <button
                        type="button"
                        onClick={() => onExportSingleTemplate(tpl)}
                        className="btn-ghost flex-1 py-0.5 flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded cursor-pointer transition-colors"
                        title="导出此母版 JSON"
                      >
                        <Download className="w-3 h-3" />
                      </button>

                      <button
                        type="button"
                        onClick={() => onDeleteTemplate(tpl.id)}
                        className="btn-ghost flex-1 py-0.5 flex items-center justify-center text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded cursor-pointer transition-colors"
                        title="删除此母版"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </aside>
      </div>
    </div>
  );
};
