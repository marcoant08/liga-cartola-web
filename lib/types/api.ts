export type User = {
  id: string;
  email: string;
  name: string;
  teamName: string;
  pixKey: string;
  emailVerified: boolean;
  leagues: string[];
  createdAt: string;
  updatedAt: string;
};

export type LeagueMember = {
  userId: string;
  userName: string;
  joinedAt: string;
  isGuest: boolean;
  pixKey: string;
  teamName: string;
};

export type Round = {
  roundNumber: number;
  winnerId: string;
  winnerName: string;
  registeredAt: string;
};

export type League = {
  id: string;
  name: string;
  description: string;
  adminId: string;
  roundValue: number;
  maxParticipants: number;
  inviteToken?: string;
  inviteTokenExpiresAt?: string;
  members: LeagueMember[];
  rounds: Round[];
  createdAt: string;
  updatedAt: string;
};

export type ApiErrorBody = {
  statusCode: number;
  message: string | string[];
  path?: string;
  error?: string;
};
