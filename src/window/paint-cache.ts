/** Painted layers kept between launches in IndexedDB, so a room you've seen at this size appears at once instead
 *  of painting again. Keyed by the app build, the scene and the window size; only the last few are kept. */
import type { Painted } from "./packs/paint";

const DB = "a-window-paint";
const STORE = "paintings";
const KEEP = 6;

type Entry = { key: string; at: number; blobs: (Blob | null)[]; sizes: [number, number][] };

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "key" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function request<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

/** The cached layers for a key, decoded off the main thread, or null. */
export async function loadPainting(key: string): Promise<{ images: (Painted | null)[]; sizes: [number, number][] } | null> {
  try {
    const db = await open();
    const e = (await request(db.transaction(STORE).objectStore(STORE).get(key))) as Entry | undefined;
    if (!e) return null;
    const images = await Promise.all(e.blobs.map((b) => (b ? createImageBitmap(b) : null)));
    // Touch it, so the least recently used go first.
    void request(db.transaction(STORE, "readwrite").objectStore(STORE).put({ ...e, at: Date.now() }));
    return { images, sizes: e.sizes };
  } catch {
    return null;
  }
}

const toBlob = (img: Painted): Promise<Blob | null> => {
  const c = document.createElement("canvas");
  c.width = img.width;
  c.height = img.height;
  c.getContext("2d")!.drawImage(img, 0, 0);
  // WebP keeps the paint's soft gradients well at a fraction of PNG's size, alpha included.
  return new Promise((resolve) => c.toBlob(resolve, "image/webp", 0.92));
};

/** Stores the layers for a key, dropping the oldest paintings beyond the last few. */
export async function savePainting(key: string, images: (Painted | null)[], sizes: [number, number][]) {
  try {
    const blobs = await Promise.all(images.map((i) => (i ? toBlob(i) : null)));
    const db = await open();
    const store = db.transaction(STORE, "readwrite").objectStore(STORE);
    await request(store.put({ key, at: Date.now(), blobs, sizes } satisfies Entry));
    const all = (await request(db.transaction(STORE).objectStore(STORE).getAll())) as Entry[];
    const old = all.sort((a, b) => b.at - a.at).slice(KEEP);
    if (old.length) {
      const del = db.transaction(STORE, "readwrite").objectStore(STORE);
      for (const e of old) del.delete(e.key);
    }
  } catch {
    /* storage full or unavailable: it just paints next time */
  }
}
