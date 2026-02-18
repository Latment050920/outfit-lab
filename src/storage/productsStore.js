const DB_NAME = 'outfitlab.db';
const STORE = 'productLinks';
const LS_KEY = 'outfitlab.productLinks';

function withFallbackRead() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || '[]');
  } catch {
    return [];
  }
}

function withFallbackWrite(list) {
  localStorage.setItem(LS_KEY, JSON.stringify(list));
}

function openDb() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) return resolve(null);
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const s = db.createObjectStore(STORE, { keyPath: 'id' });
        s.createIndex('createdAt', 'createdAt');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function runIdb(mode, work) {
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const store = tx.objectStore(STORE);
    work(store);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadProducts() {
  try {
    const db = await openDb();
    if (!db) return withFallbackRead();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const store = tx.objectStore(STORE);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return withFallbackRead();
  }
}

export async function upsertProduct(item) {
  try {
    const result = await runIdb('readwrite', (store) => store.put(item));
    if (result) return;
  } catch {
    // fallback below
  }
  const list = withFallbackRead();
  const idx = list.findIndex((i) => i.id === item.id);
  if (idx >= 0) list[idx] = item;
  else list.push(item);
  withFallbackWrite(list);
}

export async function removeProduct(id) {
  try {
    const result = await runIdb('readwrite', (store) => store.delete(id));
    if (result) return;
  } catch {
    // fallback below
  }
  const list = withFallbackRead().filter((i) => i.id !== id);
  withFallbackWrite(list);
}

export async function clearProducts() {
  try {
    const result = await runIdb('readwrite', (store) => store.clear());
    if (result) return;
  } catch {
    // fallback below
  }
  localStorage.removeItem(LS_KEY);
}
