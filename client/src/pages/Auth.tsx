import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { APP_NAME, APP_TAGLINE } from "@/lib/brand";

type Mode = "login" | "register";

/**
 * Email and password, against the session endpoints in server/routes.ts.
 *
 * Swap this page and useAuth for an OAuth provider if you prefer — the rest of
 * the app only ever asks `useAuth()` who the user is, and the server only ever
 * reads the session, so nothing else has to change.
 */
export default function Auth() {
  const [, setLocation] = useLocation();
  const { login, register } = useAuth();

  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);

    const result =
      mode === "login"
        ? await login(email, password)
        : await register({ email, username, password, displayName: displayName || undefined });

    setBusy(false);

    if (result.ok) {
      setLocation("/");
    } else {
      setError(result.error ?? "Something went wrong");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-dark text-light px-4">
      <div className="w-full max-w-sm">
        <div className="mb-10 text-center">
          <div className="text-2xl font-bold tracking-tight text-primary">{APP_NAME}</div>
          <p className="mt-1 text-sm text-gray-500">{APP_TAGLINE}</p>
        </div>

        <h1 className="text-3xl font-bold mb-1 text-center">
          {mode === "login" ? "Welcome back" : "Create an account"}
        </h1>
        <p className="text-sm text-gray-400 mb-8 text-center">
          {mode === "login"
            ? "Sign in to post, swipe and message."
            : "Pick a username — it is how other people will find you."}
        </p>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>

          {mode === "register" && (
            <>
              <div>
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="3-20 characters"
                />
              </div>
              <div>
                <Label htmlFor="displayName">Display name (optional)</Label>
                <Input
                  id="displayName"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Shown on your profile"
                />
              </div>
            </>
          )}

          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === "login" ? "" : "At least 8 characters"}
            />
          </div>

          {error && (
            <p role="alert" className="text-sm text-red-400">
              {error}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={busy}>
            {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {mode === "login" ? "Sign in" : "Create account"}
          </Button>
        </form>

        <p className="text-sm text-gray-400 mt-6 text-center">
          {mode === "login" ? "No account yet? " : "Already have an account? "}
          <button
            type="button"
            className="text-primary underline"
            onClick={() => {
              setMode(mode === "login" ? "register" : "login");
              setError(null);
            }}
          >
            {mode === "login" ? "Create one" : "Sign in"}
          </button>
        </p>

        <p className="text-xs text-gray-600 mt-8 text-center">
          Seeded a demo database? Sign in with any address printed by{" "}
          <code>bun run db:seed</code>.
        </p>
      </div>
    </div>
  );
}
