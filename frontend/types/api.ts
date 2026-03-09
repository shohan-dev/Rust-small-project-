export type UserPublic = {
  id: string;
  username: string;
  is_guest: boolean;
};

export type AuthResponse = {
  token: string;
  user: UserPublic;
};

export type Room = {
  id: string;
  owner_id: string;
  name: string;
  is_private: number; // 0 | 1
  access_key: string | null;
  created_at: string;
};

export type Message = {
  id: number;
  room_id: string;
  user_id: string;
  content: string;
  created_at: string;
};

export type CreateRoomRequest = {
  name: string;
  is_private: boolean;
  access_key?: string;
};

export type JoinRoomRequest = {
  room_id: string;
  access_key?: string;
};

