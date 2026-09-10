import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { getApiUrl } from "@/lib/api";
import type { User } from "@/lib/types";

/**
 * Session-based auth.
 *
 * The server sets an httpOnly cookie at sign-in and derives the acting user from
 * it on every request. Nothing here holds a token, and nothing sends a user id —
 * the client cannot influence who the server thinks it is talking to.
 */

export interface RegisterInput {
  email: string;
  username: string;
  password: string;
  displayName?: string;
}

export interface AuthResult {
  ok: boolean;
  /** Message suitable for showing the user. */
  error?: string;
  /** Which form field the error belongs to, when the server said. */
  field?: string;
}

export interface AuthContextType {
  user: User | null;
  /** True until the initial "am I signed in?" check completes. */
  loading: boolean;
  register: (input: RegisterInput) => Promise<AuthResult>;
  login: (email: string, password: string) => Promise<AuthResult>;
  logout: () => Promise<void>;
  updateUserProfile: (updated: Partial<User> | FormData) => Promise<boolean>;
  /** Re-reads the session — e.g. after an action that changed the user's points. */
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  register: async () => ({ ok: false }),
  login: async () => ({ ok: false }),
  logout: async () => {},
  updateUserProfile: async () => false,
  refresh: async () => {},
});

export const useAuth = () => useContext(AuthContext);

/** Pulls { message, field } out of a failed response without throwing. */
async function readError(res: Response): Promise<AuthResult> {
  try {
    const body = await res.json();
    return { ok: false, error: body?.message ?? "Something went wrong", field: body?.field };
  } catch {
    return { ok: false, error: `Request failed (${res.status})` };
  }
}

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(getApiUrl("/api/auth/me"), { credentials: "include" });
      setUser(res.ok ? await res.json() : null);
    } catch {
      setUser(null);
    }
  }, []);

  // One check on mount: 200 means a valid session, 401 means signed out.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(getApiUrl("/api/auth/me"), { credentials: "include" });
        if (!cancelled) setUser(res.ok ? await res.json() : null);
      } catch {
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const register = useCallback(async (input: RegisterInput): Promise<AuthResult> => {
    const res = await fetch(getApiUrl("/api/auth/register"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      credentials: "include",
    });
    if (!res.ok) return readError(res);
    setUser(await res.json());
    return { ok: true };
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    const res = await fetch(getApiUrl("/api/auth/login"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
      credentials: "include",
    });
    if (!res.ok) return readError(res);
    setUser(await res.json());
    return { ok: true };
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch(getApiUrl("/api/auth/logout"), { method: "POST", credentials: "include" });
    } finally {
      // Clear locally even if the request failed. A signed-out UI with a live
      // cookie is confusing, and the cookie expires on its own.
      setUser(null);
    }
  }, []);

  const updateUserProfile = useCallback(
    async (updated: Partial<User> | FormData): Promise<boolean> => {
      if (!user) return false;
      try {
        const isForm = updated instanceof FormData;
        const res = await fetch(getApiUrl(`/api/users/${user.id}`), {
          method: "PATCH",
          headers: isForm ? undefined : { "Content-Type": "application/json" },
          body: isForm ? updated : JSON.stringify(updated),
          credentials: "include",
        });
        if (!res.ok) {
          console.error("Failed to update profile:", await res.text());
          return false;
        }
        setUser(await res.json());
        return true;
      } catch (error) {
        console.error("Error updating profile:", error);
        return false;
      }
    },
    [user]
  );

  return React.createElement(
    AuthContext.Provider,
    { value: { user, loading, register, login, logout, updateUserProfile, refresh } },
    children
  );
};
