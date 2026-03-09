import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Room } from "../types/api";

export type AuthUser = {
  id: string;
  username: string;
  is_guest: boolean;
};

type AuthState = {
  token: string | null;
  user: AuthUser | null;
  rooms: Room[];
  setAuth: (token: string, user: AuthUser) => void;
  addRoom: (room: Room) => void;
  removeRoom: (id: string) => void;
  logout: () => void;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      rooms: [],
      setAuth: (token, user) => set({ token, user }),
      addRoom: (room) =>
        set((s) => ({ rooms: [room, ...s.rooms.filter((r) => r.id !== room.id)] })),
      removeRoom: (id) => set((s) => ({ rooms: s.rooms.filter((r) => r.id !== id) })),
      logout: () => set({ token: null, user: null, rooms: [] }),
    }),
    { name: "nexroom-auth" }
  )
);


