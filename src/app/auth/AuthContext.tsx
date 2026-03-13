import * as React from "react";
import type { AuthSession } from "./authTypes";

type AuthContextValue = {
  session: AuthSession | null;
  setSession: React.Dispatch<React.SetStateAction<AuthSession | null>>;
  refreshToken: number;
  requestRefresh: () => void;
};

const AuthContext = React.createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [session, setSession] = React.useState<AuthSession | null>(null);
  const [refreshToken, setRefreshToken] = React.useState(0);

  const requestRefresh = React.useCallback(() => {
    setRefreshToken((value) => value + 1);
  }, []);

  const value = React.useMemo<AuthContextValue>(
    () => ({ session, setSession, refreshToken, requestRefresh }),
    [session, refreshToken, requestRefresh]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuthSession() {
  const value = React.useContext(AuthContext);
  if (!value) {
    throw new Error("useAuthSession must be used within AuthProvider");
  }
  return value;
}
