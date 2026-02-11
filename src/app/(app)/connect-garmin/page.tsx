import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { ConnectGarminPanel } from "@/components/garmin/connect-garmin-panel";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function ConnectGarminPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const userId = Number(session.user.id);
  if (!Number.isInteger(userId) || userId <= 0) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      email: true,
      garminConnected: true,
      lastSyncAt: true,
    },
  });

  if (!user) {
    redirect("/login");
  }

  return (
    <main className="mx-auto min-h-[calc(100vh-8rem)] max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-semibold text-foreground">Connect Garmin</h1>
      <p className="mt-2 text-muted-foreground">
        Manage Garmin credentials and run on-demand sync for activities, health metrics,
        and fitness profile data.
      </p>

      <div className="mt-8">
        <ConnectGarminPanel
          initialConnected={user.garminConnected}
          initialUserEmail={user.email}
          initialLastSyncAt={user.lastSyncAt ? user.lastSyncAt.toISOString() : null}
        />
      </div>
    </main>
  );
}
