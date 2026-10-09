import { create } from 'zustand';
import type { LugarAdmin } from '../utils/lugaresAdmin';

/**
 * Última lista de lugares que vio el administrador (paso 003, T15). El formulario de edición
 * toma el lugar de aquí: el backend no tiene GET por id y la lista ya trae todo lo editable.
 */
interface LugaresAdminState {
  lugares: LugarAdmin[];
  setLugares: (lugares: LugarAdmin[]) => void;
  /** Reemplaza o agrega un lugar tras guardarlo. */
  guardado: (lugar: LugarAdmin) => void;
}

export const useLugaresAdminStore = create<LugaresAdminState>((set) => ({
  lugares: [],
  setLugares: (lugares) => set({ lugares }),
  guardado: (lugar) =>
    set((s) => ({
      lugares: s.lugares.some((l) => l.id === lugar.id)
        ? s.lugares.map((l) => (l.id === lugar.id ? lugar : l))
        : [lugar, ...s.lugares],
    })),
}));
