import {
  AspectRatioOption,
  CaseRefDimension,
  CloudStorageProvider,
  DetectedCaseSubScreen,
  ImageSizeOption,
  ReferenceImageItem,
  inferUrlStorageProvider,
} from '../types';

export interface SavedCommonAsset {
  id: string;
  category: 'product' | 'case';
  isCommonAsset?: boolean;
  name: string;
  tag: string;
  caseDimensions?: CaseRefDimension[];
  caseCustomRule?: string;
  extractedLayoutDna?: string;
  detectedSubScreens?: DetectedCaseSubScreen[];
  isLockBaseSwap?: boolean;
  mimeType: string;
  base64Data: string;
  previewUrl: string;
  ossUrl?: string;
  ossObjectKey?: string;
  ossUploading?: boolean;
  cloudUrls?: Partial<Record<CloudStorageProvider, string>>;
  cloudObjectKeys?: Partial<Record<CloudStorageProvider, string>>;
  createdAt: string;
  timestamp: number;
}

export interface GenerationRecordItem {
  id: string;
  batchId: string;
  batchTitle: string;
  sourceStudio: 'detail_studio' | 'sku_studio';
  itemIndex: number;
  title: string;
  promptSnapshot: string;
  copywriting?: string;
  aspectRatio: AspectRatioOption;
  imageSize: ImageSizeOption;
  imageUrl: string;
  ossUrl?: string;
  ossObjectKey?: string;
  ossUploading?: boolean;
  cloudUrls?: Partial<Record<CloudStorageProvider, string>>;
  cloudObjectKeys?: Partial<Record<CloudStorageProvider, string>>;
  createdAt: string;
  timestamp: number;
  isViewed: boolean;
}

const ASSET_DB_NAME = 'ecom_studio_asset_library_v1';
const ASSET_DB_VERSION = 1;
const STORE_COMMON_ASSETS = 'common_assets';
const STORE_GEN_RECORDS = 'generation_records';

let cachedAssetDbPromise: Promise<IDBDatabase> | null = null;

function openAssetLibraryDb(): Promise<IDBDatabase> {
  if (cachedAssetDbPromise) {
    return cachedAssetDbPromise;
  }
  cachedAssetDbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      cachedAssetDbPromise = null;
      reject(new Error('IndexedDB is not supported'));
      return;
    }
    const req = indexedDB.open(ASSET_DB_NAME, ASSET_DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_COMMON_ASSETS)) {
        db.createObjectStore(STORE_COMMON_ASSETS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_GEN_RECORDS)) {
        db.createObjectStore(STORE_GEN_RECORDS, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => {
        db.close();
        cachedAssetDbPromise = null;
      };
      db.onclose = () => {
        cachedAssetDbPromise = null;
      };
      resolve(db);
    };
    req.onerror = () => {
      cachedAssetDbPromise = null;
      reject(req.error || new Error('Failed to open Asset Library IndexedDB'));
    };
  });
  return cachedAssetDbPromise;
}

export async function loadCommonAssetsFromDb(): Promise<SavedCommonAsset[]> {
  try {
    const db = await openAssetLibraryDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_COMMON_ASSETS, 'readonly');
      const store = tx.objectStore(STORE_COMMON_ASSETS);
      const req = store.getAll();
      req.onsuccess = () => {
        const list = Array.isArray(req.result)
          ? (req.result as SavedCommonAsset[])
          : [];
        list.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        resolve(list);
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

export async function saveCommonAssetsToDb(
  assets: SavedCommonAsset[]
): Promise<void> {
  if (assets.length === 0) return;
  try {
    const db = await openAssetLibraryDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_COMMON_ASSETS, 'readwrite');
      const store = tx.objectStore(STORE_COMMON_ASSETS);
      for (const item of assets) {
        store.put(item);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Ignore IDB errors in restricted environments
  }
}

export async function deleteCommonAssetsFromDb(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  try {
    const db = await openAssetLibraryDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_COMMON_ASSETS, 'readwrite');
      const store = tx.objectStore(STORE_COMMON_ASSETS);
      for (const id of ids) {
        store.delete(id);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Ignore
  }
}

export async function loadGenerationRecordsFromDb(): Promise<
  GenerationRecordItem[]
> {
  try {
    const db = await openAssetLibraryDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_GEN_RECORDS, 'readonly');
      const store = tx.objectStore(STORE_GEN_RECORDS);
      const req = store.getAll();
      req.onsuccess = () => {
        const list = Array.isArray(req.result)
          ? (req.result as GenerationRecordItem[])
          : [];
        list.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        resolve(list);
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

export async function saveGenerationRecordToDb(
  record: GenerationRecordItem
): Promise<void> {
  try {
    const db = await openAssetLibraryDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_GEN_RECORDS, 'readwrite');
      const store = tx.objectStore(STORE_GEN_RECORDS);
      store.put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Ignore
  }
}

export async function updateGenerationRecordsInDb(
  records: GenerationRecordItem[]
): Promise<void> {
  if (records.length === 0) return;
  try {
    const db = await openAssetLibraryDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_GEN_RECORDS, 'readwrite');
      const store = tx.objectStore(STORE_GEN_RECORDS);
      for (const rec of records) {
        store.put(rec);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Ignore
  }
}

export async function deleteGenerationRecordsFromDb(
  ids: string[]
): Promise<void> {
  if (ids.length === 0) return;
  try {
    const db = await openAssetLibraryDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_GEN_RECORDS, 'readwrite');
      const store = tx.objectStore(STORE_GEN_RECORDS);
      for (const id of ids) {
        store.delete(id);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Ignore
  }
}

export function convertRefItemToCommonAsset(
  ref: ReferenceImageItem
): SavedCommonAsset {
  const now = new Date();
  const inferred = inferUrlStorageProvider(ref.ossUrl);
  const nextCloudUrls: Partial<Record<CloudStorageProvider, string>> = {
    ...(ref.cloudUrls || {}),
    ...(inferred && ref.ossUrl ? { [inferred]: ref.ossUrl } : {}),
  };
  const nextCloudKeys: Partial<Record<CloudStorageProvider, string>> = {
    ...(ref.cloudObjectKeys || {}),
    ...(inferred && ref.ossObjectKey ? { [inferred]: ref.ossObjectKey } : {}),
  };
  return {
    id: `asset-${ref.category}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    category: ref.category,
    isCommonAsset: ref.isCommonAsset ?? false,
    name: ref.name,
    tag: ref.tag,
    caseDimensions: ref.caseDimensions
      ? [...ref.caseDimensions]
      : ref.category === 'case'
        ? ['style', 'structure']
        : undefined,
    caseCustomRule: ref.caseCustomRule?.trim() || undefined,
    extractedLayoutDna: ref.extractedLayoutDna?.trim() || undefined,
    detectedSubScreens:
      Array.isArray(ref.detectedSubScreens) && ref.detectedSubScreens.length > 0
        ? ref.detectedSubScreens
        : undefined,
    isLockBaseSwap: Boolean(ref.isLockBaseSwap),
    mimeType: ref.mimeType,
    base64Data: ref.base64Data,
    previewUrl: ref.previewUrl,
    ossUrl: ref.ossUrl,
    ossObjectKey: ref.ossObjectKey,
    cloudUrls: Object.keys(nextCloudUrls).length > 0 ? nextCloudUrls : undefined,
    cloudObjectKeys:
      Object.keys(nextCloudKeys).length > 0 ? nextCloudKeys : undefined,
    createdAt: `${now.toLocaleDateString('zh-CN')} ${now.toLocaleTimeString(
      'zh-CN',
      {
        hour: '2-digit',
        minute: '2-digit',
      }
    )}`,
    timestamp: Date.now(),
  };
}
