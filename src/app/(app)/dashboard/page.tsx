import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-semibold text-zinc-900">Dashboard</h1>
      <p className="mt-2 text-zinc-600">
        Signed in as <span className="font-medium text-zinc-900">{session?.user.email}</span>
      </p>
    </main>
  );
}
