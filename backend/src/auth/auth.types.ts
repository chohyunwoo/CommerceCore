export interface CurrentUser {
  id: number;
  email: string;
  name: string;
  role: string;
}

export interface AuthResponse {
  token: string;
  user: CurrentUser;
}

export interface SessionData {
  userId: number;
  email: string;
  name: string;
  role: string;
}
