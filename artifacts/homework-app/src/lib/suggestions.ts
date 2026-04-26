const STORAGE_KEY = "hw_suggestions";
const MAX_ITEMS = 20;

interface SuggestionsStore {
  subjects: string[];
  classes: string[];
  questions: string[];
}

function getStore(): SuggestionsStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { subjects: [], classes: [], questions: [] };
}

function saveStore(store: SuggestionsStore) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {}
}

function addToList(list: string[], value: string): string[] {
  const trimmed = value.trim();
  if (!trimmed) return list;
  const filtered = list.filter((v) => v !== trimmed);
  filtered.unshift(trimmed);
  return filtered.slice(0, MAX_ITEMS);
}

export function getSuggestions(field: keyof SuggestionsStore): string[] {
  return getStore()[field];
}

export function addSuggestion(field: keyof SuggestionsStore, value: string) {
  const store = getStore();
  store[field] = addToList(store[field], value);
  saveStore(store);
}

export function addMultipleSuggestions(entries: Partial<Record<keyof SuggestionsStore, string>>) {
  const store = getStore();
  for (const [field, value] of Object.entries(entries)) {
    if (value) {
      store[field as keyof SuggestionsStore] = addToList(
        store[field as keyof SuggestionsStore],
        value
      );
    }
  }
  saveStore(store);
}
