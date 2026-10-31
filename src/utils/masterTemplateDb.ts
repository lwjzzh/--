import {
  ReferenceImageItem,
  ScreenTask,
  StudioConfig,
  SkuBatchConfig,
  SkuTask,
} from '../types';

export interface ConfirmedMasterTemplate {
  id: string;
  name: string;
  createdAt: string;
  productInfoText: string;
  fullPlanDoc: string;
  globalStylePrefix: string;
  requirements: StudioConfig['requirements'];
  referenceImages: ReferenceImageItem[];
  skuReferenceImages?: ReferenceImageItem[];
  tasks: ScreenTask[];
  skuBatchConfig?: SkuBatchConfig;
  skuTasks?: SkuTask[];
}

export interface PersistedWorkspaceSnapshot {
  selectedPresetId: string;
  productInfoText: string;
  fullPlanDoc: string;
  campaignSummary: string;
  config: StudioConfig;
  cardLayout: 'storyboard' | 'grid';
  lockCompletedStaticScreens: boolean;
  referenceImages: ReferenceImageItem[];
  skuReferenceImages?: ReferenceImageItem[];
  tasks: ScreenTask[];
  skuBatchConfig?: SkuBatchConfig;
  skuTasks?: SkuTask[];
}

const DB_NAME = 'ecom_studio_idb_v1';
const DB_VERSION = 1;
const STORE_TEMPLATES = 'confirmed_templates';
const STORE_WORKSPACE = 'active_workspace';
const WORKSPACE_KEY = 'current_workspace_v1';

let cachedStudioDbPromise: Promise<IDBDatabase> | null = null;

function openStudioDb(): Promise<IDBDatabase> {
  if (cachedStudioDbPromise) {
    return cachedStudioDbPromise;
  }
  cachedStudioDbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      cachedStudioDbPromise = null;
      reject(new Error('IndexedDB is not supported in this environment'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_TEMPLATES)) {
        db.createObjectStore(STORE_TEMPLATES, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_WORKSPACE)) {
        db.createObjectStore(STORE_WORKSPACE);
      }
    };
    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => {
        db.close();
        cachedStudioDbPromise = null;
      };
      db.onclose = () => {
        cachedStudioDbPromise = null;
      };
      resolve(db);
    };
    req.onerror = () => {
      cachedStudioDbPromise = null;
      reject(req.error || new Error('Failed to open IndexedDB'));
    };
  });
  return cachedStudioDbPromise;
}

function compactRefItemForStorage(item: ReferenceImageItem): ReferenceImageItem {
  if (
    item.previewUrl &&
    item.previewUrl.startsWith('data:') &&
    item.base64Data
  ) {
    // Avoid storing two multi-megabyte copies of the same Base64 payload in IndexedDB
    return {
      ...item,
      base64Data: '',
    };
  }
  return item;
}

function hydrateRefItemFromStorage(item: ReferenceImageItem): ReferenceImageItem {
  if (
    (!item.base64Data || item.base64Data.length === 0) &&
    item.previewUrl &&
    item.previewUrl.startsWith('data:')
  ) {
    const commaIdx = item.previewUrl.indexOf(',');
    if (commaIdx !== -1) {
      return {
        ...item,
        base64Data: item.previewUrl.slice(commaIdx + 1),
      };
    }
  }
  if (
    (!item.previewUrl || item.previewUrl.length === 0) &&
    item.base64Data &&
    item.base64Data.length > 0
  ) {
    const mime = item.mimeType || 'image/jpeg';
    return {
      ...item,
      previewUrl: `data:${mime};base64,${item.base64Data}`,
    };
  }
  return item;
}

export async function loadConfirmedTemplatesFromDb(): Promise<
  ConfirmedMasterTemplate[]
> {
  try {
    const db = await openStudioDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_TEMPLATES, 'readonly');
      const store = tx.objectStore(STORE_TEMPLATES);
      const req = store.getAll();
      req.onsuccess = () => {
        const rawList = Array.isArray(req.result)
          ? (req.result as ConfirmedMasterTemplate[])
          : [];
        const list = rawList.map((tpl) => ({
          ...tpl,
          referenceImages: Array.isArray(tpl.referenceImages)
            ? tpl.referenceImages.map(hydrateRefItemFromStorage)
            : [],
          skuReferenceImages: Array.isArray(tpl.skuReferenceImages)
            ? tpl.skuReferenceImages.map(hydrateRefItemFromStorage)
            : undefined,
        }));
        // Sort newest first by id timestamp if available
        list.sort((a, b) => b.id.localeCompare(a.id));
        resolve(list);
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

export async function saveConfirmedTemplateToDb(
  template: ConfirmedMasterTemplate
): Promise<void> {
  const db = await openStudioDb();
  const compactedTemplate: ConfirmedMasterTemplate = {
    ...template,
    referenceImages: Array.isArray(template.referenceImages)
      ? template.referenceImages.map(compactRefItemForStorage)
      : [],
    skuReferenceImages: Array.isArray(template.skuReferenceImages)
      ? template.skuReferenceImages.map(compactRefItemForStorage)
      : undefined,
  };
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_TEMPLATES, 'readwrite');
    const store = tx.objectStore(STORE_TEMPLATES);
    store.put(compactedTemplate);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function deleteConfirmedTemplateFromDb(
  templateId: string
): Promise<void> {
  const db = await openStudioDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_TEMPLATES, 'readwrite');
    const store = tx.objectStore(STORE_TEMPLATES);
    store.delete(templateId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function saveWorkspaceSnapshotToDb(
  snapshot: PersistedWorkspaceSnapshot
): Promise<void> {
  try {
    const db = await openStudioDb();
    const compactedSnapshot: PersistedWorkspaceSnapshot = {
      ...snapshot,
      referenceImages: Array.isArray(snapshot.referenceImages)
        ? snapshot.referenceImages.map(compactRefItemForStorage)
        : [],
      skuReferenceImages: Array.isArray(snapshot.skuReferenceImages)
        ? snapshot.skuReferenceImages.map(compactRefItemForStorage)
        : undefined,
    };
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_WORKSPACE, 'readwrite');
      const store = tx.objectStore(STORE_WORKSPACE);
      store.put(compactedSnapshot, WORKSPACE_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Fallback handled by caller
  }
}

export async function loadWorkspaceSnapshotFromDb(): Promise<PersistedWorkspaceSnapshot | null> {
  try {
    const db = await openStudioDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_WORKSPACE, 'readonly');
      const store = tx.objectStore(STORE_WORKSPACE);
      const req = store.get(WORKSPACE_KEY);
      req.onsuccess = () => {
        const raw = (req.result as PersistedWorkspaceSnapshot) || null;
        if (!raw) {
          resolve(null);
          return;
        }
        resolve({
          ...raw,
          referenceImages: Array.isArray(raw.referenceImages)
            ? raw.referenceImages.map(hydrateRefItemFromStorage)
            : [],
          skuReferenceImages: Array.isArray(raw.skuReferenceImages)
            ? raw.skuReferenceImages.map(hydrateRefItemFromStorage)
            : undefined,
        });
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

export async function clearWorkspaceSnapshotInDb(): Promise<void> {
  try {
    const db = await openStudioDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_WORKSPACE, 'readwrite');
      const store = tx.objectStore(STORE_WORKSPACE);
      store.delete(WORKSPACE_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Ignore
  }
}

export function exportMasterTemplateToJsonFile(
  template: ConfirmedMasterTemplate
): void {
  const payload = {
    schema: 'ecom_studio_master_template_v1',
    exportedAt: new Date().toISOString(),
    template,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const safeName = template.name.replace(/[\\/:*?"<>|]/g, '_');
  const skuCount = Array.isArray(template.skuTasks) ? template.skuTasks.length : 0;
  const suffix =
    template.tasks.length > 0 && skuCount > 0
      ? `${template.tasks.length}屏_${skuCount}款SKU`
      : skuCount > 0
        ? `${skuCount}款SKU`
        : `${template.tasks.length}屏`;
  a.href = url;
  a.download = `正式母版_${safeName}_${suffix}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function importMasterTemplateFromJsonFile(
  file: File
): Promise<ConfirmedMasterTemplate> {
  const text = await file.text();
  const parsed = JSON.parse(text);
  const raw: ConfirmedMasterTemplate = parsed?.template || parsed;

  if (
    !raw ||
    (!Array.isArray(raw.tasks) && !Array.isArray(raw.skuTasks)) ||
    typeof raw.name !== 'string'
  ) {
    throw new Error('无效的母版文件格式：缺少任务列表或母版名称');
  }

  return {
    id: `master-${Date.now()}`,
    name: raw.name.trim() || '导入的正式母版',
    createdAt: raw.createdAt || new Date().toLocaleDateString('zh-CN'),
    productInfoText: typeof raw.productInfoText === 'string' ? raw.productInfoText : '',
    fullPlanDoc: typeof raw.fullPlanDoc === 'string' ? raw.fullPlanDoc : '',
    globalStylePrefix:
      typeof raw.globalStylePrefix === 'string' ? raw.globalStylePrefix : '',
    requirements: raw.requirements,
    referenceImages: Array.isArray(raw.referenceImages)
      ? raw.referenceImages.map((img) => ({ ...img, ossUploading: false }))
      : [],
    skuReferenceImages: Array.isArray(raw.skuReferenceImages)
      ? raw.skuReferenceImages.map((img) => ({ ...img, ossUploading: false }))
      : [],
    tasks: Array.isArray(raw.tasks)
      ? raw.tasks.map((t) => ({
          ...t,
          referenceImageIds: Array.isArray(t.referenceImageIds)
            ? t.referenceImageIds
            : [],
          status: t.resultImageUrl ? 'completed' : 'idle',
          historyImages: Array.isArray(t.historyImages)
            ? t.historyImages.slice(0, 6)
            : [],
        }))
      : [],
    skuBatchConfig: raw.skuBatchConfig,
    skuTasks: Array.isArray(raw.skuTasks)
      ? raw.skuTasks.map((st) => ({
          ...st,
          caseRefIds: Array.isArray(st.caseRefIds) ? st.caseRefIds : [],
          productRefIds: Array.isArray(st.productRefIds) ? st.productRefIds : [],
          status: st.resultImageUrl ? 'completed' : 'idle',
          historyImages: Array.isArray(st.historyImages)
            ? st.historyImages.slice(0, 6)
            : [],
        }))
      : undefined,
  };
}

