import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { Room } from "../types/api";

export type AuthUser = {
  id: string;
  username: string;
  is_guest: boolean;
};

type AuthState = {
  hydrated: boolean;
  token: string | null;
  user: AuthUser | null;
  rooms: Room[];
  setHydrated: (hydrated: boolean) => void;
  setAuth: (token: string, user: AuthUser) => void;
  addRoom: (room: Room) => void;
  removeRoom: (id: string) => void;
  logout: () => void;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      hydrated: false,
      token: null,
      user: null,
      rooms: [],
      setHydrated: (hydrated) => set({ hydrated }),
      setAuth: (token, user) => set({ hydrated: true, token, user }),
      addRoom: (room) =>
        set((s) => ({ rooms: [room, ...s.rooms.filter((r) => r.id !== room.id)] })),
      removeRoom: (id) => set((s) => ({ rooms: s.rooms.filter((r) => r.id !== id) })),
      logout: () => set({ hydrated: true, token: null, user: null, rooms: [] }),
    }),
    {
      name: "nexroom-auth",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        token: state.token,
        user: state.user,
        rooms: state.rooms,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true);
      },
    }
  )
);


