"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Round photos live in IndexedDB (not localStorage — too small for images),
 * keyed by round id. A tiny hand-written wrapper instead of a dependency.
 * Stored as { type, data: ArrayBuffer } rather than a Blob, which older
 * iOS Safari versions handled unreliably.
 */
const DB_NAME = "foremind-photos";
const STORE = "photos";

type StoredPhoto = { type: string; data: ArrayBuffer; savedAt: string };

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB unavailable"));
      return;
    }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("IndexedDB blocked"));
  });
}

async function run<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const request = action(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(request.result);
      tx.onerror = () => reject(tx.error ?? request.error);
      tx.onabort = () => reject(tx.error ?? new Error("Transaction aborted"));
    });
  } finally {
    db.close();
  }
}

// --- Small cache + subscription so thumbnails update everywhere at once ---

const urlCache = new Map<string, string | null>();
const loading = new Set<string>();
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

function setCachedBlob(roundId: string, blob: Blob | null) {
  const previous = urlCache.get(roundId);
  if (previous) URL.revokeObjectURL(previous);
  urlCache.set(roundId, blob ? URL.createObjectURL(blob) : null);
  notify();
}

function load(roundId: string) {
  if (urlCache.has(roundId) || loading.has(roundId)) return;
  loading.add(roundId);
  run<StoredPhoto | undefined>("readonly", (store) => store.get(roundId))
    .then((stored) => {
      setCachedBlob(roundId, stored ? new Blob([stored.data], { type: stored.type }) : null);
    })
    .catch(() => setCachedBlob(roundId, null))
    .finally(() => loading.delete(roundId));
}

/** Throws if the photo can't be stored (quota, private browsing, no IndexedDB). */
export async function saveRoundPhoto(roundId: string, blob: Blob): Promise<void> {
  const record: StoredPhoto = {
    type: blob.type || "image/jpeg",
    data: await blob.arrayBuffer(),
    savedAt: new Date().toISOString(),
  };
  await run("readwrite", (store) => store.put(record, roundId));
  setCachedBlob(roundId, blob);
}

export async function removeRoundPhoto(roundId: string): Promise<void> {
  try {
    await run("readwrite", (store) => store.delete(roundId));
  } finally {
    setCachedBlob(roundId, null);
  }
}

/** Object URL of the round's photo, or null (none, still loading, or unavailable). */
export function useRoundPhotoUrl(roundId: string | null | undefined): string | null {
  const subscribe = useCallback(
    (listener: () => void) => {
      listeners.add(listener);
      if (roundId) load(roundId);
      return () => {
        listeners.delete(listener);
      };
    },
    [roundId],
  );
  return useSyncExternalStore(
    subscribe,
    () => (roundId ? (urlCache.get(roundId) ?? null) : null),
    () => null,
  );
}
