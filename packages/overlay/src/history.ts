import { openDB } from 'idb';
import type { DaubSession } from '@daub/core';

const DB_NAME = 'daub';
const STORE = 'sessions';
const MAX_SESSIONS = 20;

let dbFailed = false;

function getDB() {
  if (dbFailed) return null;
  try {
    return openDB(DB_NAME, 1, {
      upgrade(db) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      },
    });
  } catch {
    dbFailed = true;
    console.warn('[Daub] History unavailable (private browsing?)');
    return null;
  }
}

export async function saveSession(session: DaubSession): Promise<void> {
  try {
    const db = await getDB();
    if (!db) return;

    await db.put(STORE, session);

    // Enforce max sessions limit — delete oldest if over MAX_SESSIONS
    const allKeys = await db.getAllKeys(STORE);
    if (allKeys.length > MAX_SESSIONS) {
      const all = await db.getAll(STORE);
      all.sort(
        (a, b) => (a.elementContext.capturedAt ?? 0) - (b.elementContext.capturedAt ?? 0),
      );
      const toDelete = all.slice(0, all.length - MAX_SESSIONS);
      const tx = db.transaction(STORE, 'readwrite');
      for (const s of toDelete) {
        tx.store.delete(s.id);
      }
      await tx.done;
    }
  } catch {
    console.warn('[Daub] History unavailable (private browsing?)');
  }
}

export async function getSessions(): Promise<DaubSession[]> {
  try {
    const db = await getDB();
    if (!db) return [];

    const all = await db.getAll(STORE);
    // Sort by capturedAt descending (newest first)
    all.sort(
      (a, b) => (b.elementContext.capturedAt ?? 0) - (a.elementContext.capturedAt ?? 0),
    );
    return all;
  } catch {
    console.warn('[Daub] History unavailable (private browsing?)');
    return [];
  }
}

export async function getSession(id: string): Promise<DaubSession | undefined> {
  try {
    const db = await getDB();
    if (!db) return undefined;

    return await db.get(STORE, id);
  } catch {
    console.warn('[Daub] History unavailable (private browsing?)');
    return undefined;
  }
}

export async function deleteSession(id: string): Promise<void> {
  try {
    const db = await getDB();
    if (!db) return;

    await db.delete(STORE, id);
  } catch {
    console.warn('[Daub] History unavailable (private browsing?)');
  }
}

export async function clearHistory(): Promise<void> {
  try {
    const db = await getDB();
    if (!db) return;

    await db.clear(STORE);
  } catch {
    console.warn('[Daub] History unavailable (private browsing?)');
  }
}
