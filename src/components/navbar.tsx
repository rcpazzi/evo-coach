import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { SignOutButton } from "@/components/sign-out-button";
import { ThemeToggle } from "@/components/theme-toggle";

export async function Navbar() {
  const session = await getServerSession(authOptions);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-sm">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4">
        <Link href="/" className="text-lg font-semibold tracking-tight text-foreground">
          Evo Coach
        </Link>

        <nav className="flex items-center gap-2">
          {session?.user ? (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link href="/dashboard">Dashboard</Link>
              </Button>
              <Button asChild variant="ghost" size="sm">
                <Link href="/workout">Workout</Link>
              </Button>
              <Button asChild variant="ghost" size="sm">
                <Link href="/connect-garmin">Connect Garmin</Link>
              </Button>
              <SignOutButton />
            </>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link href="/login">Login</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/register">Register</Link>
              </Button>
            </>
          )}

          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
