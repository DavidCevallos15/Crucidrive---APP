import { create } from 'zustand';

export type ServiceType = 'viaje' | 'encomienda';
export const useServiceStore = create<{ service: ServiceType; selectService: (service: ServiceType) => void }>((set) => ({
  service: 'viaje',
  selectService: (service) => set({ service }),
}));
