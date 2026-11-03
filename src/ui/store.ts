// App state: the persona being edited, 3 saved slots in localStorage, options and view selections.

import { create } from 'zustand';
import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';
import { DEFAULT_OPTIONS, type CalcOptions, type Persona } from '../engine/types';
import { DEFAULT_PERSONA, normalizePersona } from '../engine/personas';

const KEY = 'implicit-tax:v1';
export const SLOT_COUNT = 3;

interface Saved {
  slots: (Persona | null)[];
  working: Persona;
  active: number;
}

function load(): Saved {
  const fallback: Saved = { slots: [structuredClone(DEFAULT_PERSONA), null, null], working: structuredClone(DEFAULT_PERSONA), active: 0 };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return fallback;
    const s = JSON.parse(raw) as Partial<Saved>;
    const slots = Array.from({ length: SLOT_COUNT }, (_, i) => (s.slots?.[i] ? normalizePersona(s.slots[i]!) : null));
    return { slots, working: normalizePersona(s.working), active: s.active ?? 0 };
  } catch {
    return fallback;
  }
}

function persist(s: Saved) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* storage unavailable (private mode, blocked): the app still works for this session */
  }
}

export function personaFromHash(): Persona | null {
  try {
    const m = location.hash.match(/p=([^&]+)/);
    if (!m) return null;
    const json = decompressFromEncodedURIComponent(m[1]);
    return json ? normalizePersona(JSON.parse(json)) : null;
  } catch {
    return null;
  }
}

export function shareLink(p: Persona): string {
  return `${location.origin}${location.pathname}#p=${compressToEncodedURIComponent(JSON.stringify(p))}`;
}

export type Tab = 'compare' | 'city' | 'move' | 'history' | 'curve' | 'personas' | 'method';

interface State extends Saved {
  options: CalcOptions;
  tab: Tab;
  cityId: string;
  fromId: string;
  toId: string;
  setWorking: (p: Persona) => void;
  update: (f: (p: Persona) => void) => void;
  saveSlot: (i: number) => void;
  loadSlot: (i: number) => void;
  clearSlot: (i: number) => void;
  renameSlot: (i: number, name: string) => void;
  setOptions: (o: Partial<CalcOptions>) => void;
  setTab: (t: Tab) => void;
  setCity: (id: string) => void;
  setMove: (from: string, to: string) => void;
}

const initial = load();
const fromHash = personaFromHash();

export const useStore = create<State>((set, get) => {
  const save = () => {
    const { slots, working, active } = get();
    persist({ slots, working, active });
  };
  return {
    ...initial,
    working: fromHash ?? initial.working,
    options: DEFAULT_OPTIONS,
    tab: 'compare',
    cityId: 'toronto',
    fromId: 'calgary',
    toId: 'toronto',
    setWorking: (p) => { set({ working: p }); save(); },
    update: (f) => {
      const p = structuredClone(get().working);
      f(p);
      set({ working: p });
      save();
    },
    saveSlot: (i) => {
      const slots = [...get().slots];
      slots[i] = structuredClone(get().working);
      set({ slots, active: i });
      save();
    },
    loadSlot: (i) => {
      const p = get().slots[i];
      if (p) { set({ working: structuredClone(p), active: i }); save(); }
    },
    clearSlot: (i) => {
      const slots = [...get().slots];
      slots[i] = null;
      set({ slots });
      save();
    },
    renameSlot: (i, name) => {
      const slots = [...get().slots];
      if (slots[i]) slots[i] = { ...slots[i]!, name };
      set({ slots });
      save();
    },
    setOptions: (o) => set({ options: { ...get().options, ...o } }),
    setTab: (tab) => set({ tab }),
    setCity: (cityId) => set({ cityId }),
    setMove: (fromId, toId) => set({ fromId, toId }),
  };
});
