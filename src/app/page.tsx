import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { Button } from "@/components/ui/button";
import { authOptions } from "@/lib/auth";

export default async function Home() {
  const session = await getServerSession(authOptions);

  if (session?.user) {
    redirect("/dashboard");
  }

  return (
    <main className="grid min-h-[calc(100vh-8rem)] place-items-center py-8">
      <section className="w-full max-w-2xl rounded-2xl border border-border bg-card p-8 shadow-sm sm:p-12">
        <h1 className="text-4xl font-semibold tracking-tight text-foreground">
          Train smarter with Evo Coach
        </h1>
        <p className="mt-3 max-w-xl text-muted-foreground">
          Personalized running guidance powered by your activity, recovery, and goals.
          Sign in to continue.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Button asChild size="lg">
            <Link href="/login">Sign in</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/register">Create account</Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
