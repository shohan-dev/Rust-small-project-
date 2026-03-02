export type AuthResponse = {
  token: string;
  user: {
    id: string;
    username: string;
    is_guest: boolean;
  };
};
