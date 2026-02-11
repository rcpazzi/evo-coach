import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { WorkoutHistoryTable } from "@/components/dashboard/workout-history-table";
import type { WorkoutRow } from "@/components/dashboard/types";
import { WorkoutActions } from "@/components/workout/workout-actions";
import { WorkoutForm } from "@/components/workout/workout-form";
import { WorkoutPreview } from "@/components/workout/workout-preview";
import type { WorkoutPreviewItem } from "@/components/workout/types";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function WorkoutPage() {
  const session = await getServerSession(authOptions);
  const userId = Number(session?.user?.id);

  if (!Number.isInteger(userId) || userId <= 0) {
    redirect("/login");
  }

  const workoutsRaw = await prisma.workout.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      workoutType: true,
      title: true,
      aiDescription: true,
      workoutJson: true,
      totalDistanceKm: true,
      estimatedDurationMinutes: true,
      status: true,
      scheduledDate: true,
      garminWorkoutId: true,
      createdAt: true,
    },
  });

  const previewCandidate =
    workoutsRaw.find((workout) => workout.status.toLowerCase() === "generated") ??
    workoutsRaw[0] ??
    null;

  const previewWorkout: WorkoutPreviewItem | null = previewCandidate
    ? {
        id: previewCandidate.id,
        title: previewCandidate.title,
        workoutType: previewCandidate.workoutType,
        status: previewCandidate.status,
        aiDescription: previewCandidate.aiDescription,
        workoutJson: previewCandidate.workoutJson,
        totalDistanceKm: previewCandidate.totalDistanceKm,
        estimatedDurationMinutes: previewCandidate.estimatedDurationMinutes,
        createdAt: previewCandidate.createdAt.toISOString(),
      }
    : null;

  const workoutHistory: WorkoutRow[] = workoutsRaw.map((workout) => ({
    ...workout,
    garminWorkoutId: workout.garminWorkoutId ? workout.garminWorkoutId.toString() : null,
  }));

  return (
    <main className="mx-auto min-h-[calc(100vh-8rem)] w-full max-w-6xl px-4 py-8 sm:py-10">
      <header className="mb-6 rounded-xl border border-border bg-card p-5 sm:p-6">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Workout Builder</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Generate AI workouts from your synced Garmin fitness profile, then accept to upload
          directly to Garmin Connect.
        </p>
      </header>

      <section className="grid gap-6 lg:grid-cols-2">
        <WorkoutForm />
        <WorkoutPreview
          workout={previewWorkout}
          actions={
            previewWorkout ? (
              <WorkoutActions workoutId={previewWorkout.id} status={previewWorkout.status} />
            ) : undefined
          }
        />
      </section>

      <section className="mt-6">
        <WorkoutHistoryTable workouts={workoutHistory} />
      </section>
    </main>
  );
}
