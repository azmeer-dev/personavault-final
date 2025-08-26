export type GitHubProfile = {
  id: number;
  login: string;
  name?: string | null;
  email?: string | null;
  avatar_url?: string | null;
};

export type GitHubEmail = {
  email: string;
  primary: boolean;
  verified: boolean;
  visibility: string | null;
};

export type TwitchProfile = {
  sub: string; // Twitch user ID
  preferred_username?: string;
  email?: string;
  picture?: string;
};