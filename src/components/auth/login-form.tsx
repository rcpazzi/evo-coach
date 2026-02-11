"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { FormEvent, useMemo, useState } from "react";

const NEXT_AUTH_ERROR_MESSAGES: Record<string, string> = {
  CredentialsSignin: "Invalid email or password.",
  Default: "Unable to sign in. Please try again.",
};

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const queryErrorMessage = useMemo(() => {
    const errorKey = searchParams.get("error");
    if (!errorKey) {
      return null;
    }

    return NEXT_AUTH_ERROR_MESSAGES[errorKey] ?? NEXT_AUTH_ERROR_MESSAGES.Default;
  }, [searchParams]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const result = await signIn("credentials", {
        email: email.trim().toLowerCase(),
        password,
        redirect: false,
        callbackUrl: "/dashboard",
      });

      if (!result || result.error) {
        setError(
          result?.error
            ? NEXT_AUTH_ERROR_MESSAGES[result.error] ?? NEXT_AUTH_ERROR_MESSAGES.Default
            : NEXT_AUTH_ERROR_MESSAGES.Default,
        );
        return;
      }

      router.push(result.url ?? "/dashboard");
      router.refresh();
    } catch {
      setError(NEXT_AUTH_ERROR_MESSAGES.Default);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label htmlFor="email" className="block text-sm font-medium text-zinc-900">
          Email
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none ring-offset-white transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-500/20"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="password" className="block text-sm font-medium text-zinc-900">
          Password
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none ring-offset-white transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-500/20"
        />
      </div>

      {(error || queryErrorMessage) && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error ?? queryErrorMessage}
        </p>
      )}

      <button
        type="submit"
        disabled={isLoading}
        className="w-full rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isLoading ? "Signing in..." : "Sign in"}
      </button>

      <p className="text-sm text-zinc-600">
        No account yet?{" "}
        <Link href="/register" className="font-medium text-zinc-900 hover:underline">
          Create one
        </Link>
      </p>
    </form>
  );
}
