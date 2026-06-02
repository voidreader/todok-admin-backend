export interface AppMetadata {
  role?: string;
  [key: string]: unknown;
}

export interface AuthenticatedUser {
  userId: string;
  email?: string;
  appMetadata: AppMetadata;
}
