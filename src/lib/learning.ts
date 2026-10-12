/** Dados locais do ciclo de aprendizagem. Conteúdo continua estático; só o
 * progresso pessoal vai ao IndexedDB. */
export type LearningEventType = 'lesson_started' | 'lesson_completed' | 'question_answered';
export type LearningResult = 'correct' | 'incorrect';

export interface LearningEvent {
  id: string;
  type: LearningEventType;
  occurredAt: string;
  lessonId?: string;
  conceptIds: string[];
  result?: LearningResult;
  source: 'platform' | 'manual';
}

export interface LearnerProfile {
  goal: 'enem' | 'school' | 'technical' | 'mixed';
  prioritySubjects: string[];
  weeklyAvailability: number;
  onboardingCompleted: boolean;
  /** Impede que o convite inicial volte sem o estudante pedi-lo. */
  onboardingDismissed?: boolean;
}

const DB = 'cdt-aprendizagem';
const VERSION = 1;
const STORE_EVENTS = 'events';
const STORE_META = 'meta';
const LEGACY_MARK = 'legacy-imported-v1';

const defaultProfile = (): LearnerProfile => ({
  goal: 'enem',
  prioritySubjects: [],
  weeklyAvailability: 3,
  onboardingCompleted: false,
  onboardingDismissed: false,
});

function id() {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_EVENTS)) db.createObjectStore(STORE_EVENTS, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(STORE_META)) db.createObjectStore(STORE_META, { keyPath: 'key' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function read<T>(key: string, fallback: T): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE_META).objectStore(STORE_META).get(key);
    request.onsuccess = () => { db.close(); resolve((request.result?.value as T | undefined) ?? fallback); };
    request.onerror = () => { db.close(); reject(request.error); };
  });
}

async function write(key: string, value: unknown) {
  const db = await openDb();
  return new Promise<void>((resolve, reject) => {
    const request = db.transaction(STORE_META, 'readwrite').objectStore(STORE_META).put({ key, value });
    request.onsuccess = () => { db.close(); resolve(); };
    request.onerror = () => { db.close(); reject(request.error); };
  });
}

export async function getProfile() { return read('profile', defaultProfile()); }
export async function saveProfile(profile: LearnerProfile) { await write('profile', profile); }

export async function appendEvent(event: Omit<LearningEvent, 'id' | 'occurredAt' | 'source'> & Partial<Pick<LearningEvent, 'id' | 'occurredAt' | 'source'>>) {
  const value: LearningEvent = { id: event.id ?? id(), occurredAt: event.occurredAt ?? new Date().toISOString(), source: event.source ?? 'platform', ...event };
  const db = await openDb();
  return new Promise<LearningEvent>((resolve, reject) => {
    const request = db.transaction(STORE_EVENTS, 'readwrite').objectStore(STORE_EVENTS).put(value);
    request.onsuccess = () => { db.close(); resolve(value); };
    request.onerror = () => { db.close(); reject(request.error); };
  });
}

export async function listEvents(): Promise<LearningEvent[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE_EVENTS).objectStore(STORE_EVENTS).getAll();
    request.onsuccess = () => { db.close(); resolve(request.result as LearningEvent[]); };
    request.onerror = () => { db.close(); reject(request.error); };
  });
}

/** Importa apenas marcos que já existiam; mantém as chaves legadas intactas. */
export async function importLegacyProgress() {
  if (await read(LEGACY_MARK, false)) return;
  const raw = localStorage.getItem('cdt:progresso');
  if (raw) {
    try {
      const seen = JSON.parse(raw) as Record<string, number>;
      await Promise.all(Object.entries(seen).map(([lessonId, timestamp]) => appendEvent({
        type: 'lesson_completed', lessonId, conceptIds: [], occurredAt: new Date(timestamp).toISOString(), source: 'platform',
      })));
    } catch { /* progresso legado inválido não impede o caderno de abrir */ }
  }
  await write(LEGACY_MARK, true);
}

export async function safeLearning(action: () => Promise<void>) {
  try { await action(); } catch { /* armazenamento privado/bloqueado: interface continua funcionando */ }
}
