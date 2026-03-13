export type AuthSession = {
  linked: boolean;
  expired: boolean;
  userId?: string | null;
  issuedAt?: string | null;
  loginUrl?: string | null;
};

export function isAuthenticated(session: AuthSession | null): boolean {
  if (!session) {
    return false;
  }
  return session.linked === true && session.expired === false && !!session.userId;
}
