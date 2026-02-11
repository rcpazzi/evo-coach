import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { CreateWorkoutCard } from "@/components/dashboard/create-workout-card";
import { FitnessProfileCard } from "@/components/dashboard/fitness-profile-card";
import { HealthMetricsCard } from "@/components/dashboard/health-metrics-card";
import { RecentActivitiesTable } from "@/components/dashboard/recent-activities-table";
import { SyncButton } from "@/components/dashboard/sync-button";
import { WorkoutHistoryTable } from "@/components/dashboard/workout-history-table";
import type {
  ActivityRow,
  FitnessProfile,
  HealthReading,
  WorkoutRow,
} from "@/components/dashboard/types";
import { authOptions } from "@/lib/auth";
import { formatDateTime } from "@/lib/utils";
import { prisma } from "@/lib/prisma";

function toIsoDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  const userId = Number(session?.user?.id);

  if (!Number.isInteger(userId) || userId <= 0) {
    redirect("/login");
  }

  const [user, activities, latestHealth, fitness, workoutsRaw] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        email: true,
        garminConnected: true,
        lastSyncAt: true,
      },
    }),
    prisma.activity.findMany({
      where: { userId },
      orderBy: [{ activityDate: "desc" }, { id: "desc" }],
      take: 7,
      select: {
        id: true,
        activityDate: true,
        activityName: true,
        activityType: true,
        distanceMeters: true,
        durationSeconds: true,
        averagePaceSecondsPerKm: true,
        averageHrBpm: true,
        maxHrBpm: true,
      },
    }),
    prisma.dailyHealthReading.findFirst({
      where: { userId },
      orderBy: { readingDate: "desc" },
      select: {
        readingDate: true,
        sleepScore: true,
        totalSleepSeconds: true,
        sleepStress: true,
        avgOvernightHrv: true,
        hrvStatus: true,
        hrv7dayAvg: true,
        restingHr: true,
        restingHr7dayAvg: true,
        bodyBatteryStart: true,
        bodyBatteryEnd: true,
        dataSyncedAt: true,
      },
    }),
    prisma.userRunningFitness.findUnique({
      where: { userId },
      select: {
        predicted5kSeconds: true,
        predicted10kSeconds: true,
        predictedHalfSeconds: true,
        predictedMarathonSeconds: true,
        easyPaceLow: true,
        easyPaceHigh: true,
        tempoPace: true,
        thresholdPace: true,
        intervalPace: true,
        repetitionPace: true,
        weeklyVolumeAvgKm: true,
        longestRunKm: true,
        runningDistanceAvgKm: true,
        racePredictionsLastUpdate: true,
      },
    }),
    prisma.workout.findMany({
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
    }),
  ]);

  if (!user) {
    redirect("/login");
  }

  const workouts: WorkoutRow[] = workoutsRaw.map((workout) => ({
    ...workout,
    garminWorkoutId: workout.garminWorkoutId ? workout.garminWorkoutId.toString() : null,
  }));

  const activitiesData: ActivityRow[] = activities;
  const fitnessData: FitnessProfile | null = fitness;
  const latestHealthData: HealthReading | null = latestHealth;

  const initialHealthDate = latestHealthData
    ? toIsoDateOnly(latestHealthData.readingDate)
    : toIsoDateOnly(new Date());

  return (
    <main className="mx-auto min-h-[calc(100vh-8rem)] max-w-6xl px-4 py-8 sm:py-10">
      <section className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Signed in as <span className="font-medium text-foreground">{user.email}</span>
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Last sync: {user.lastSyncAt ? formatDateTime(user.lastSyncAt) : "Never"}
          </p>
        </div>

        <SyncButton garminConnected={user.garminConnected} />
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-3">
        <FitnessProfileCard fitness={fitnessData} />
        <HealthMetricsCard
          initialDate={initialHealthDate}
          initialReading={
            latestHealthData
              ? {
                  ...latestHealthData,
                  readingDate: latestHealthData.readingDate.toISOString(),
                  dataSyncedAt: latestHealthData.dataSyncedAt.toISOString(),
                }
              : null
          }
        />
        <CreateWorkoutCard />
      </section>

      <section className="mt-6 space-y-6">
        <RecentActivitiesTable activities={activitiesData} />
        <WorkoutHistoryTable workouts={workouts} />
      </section>
    </main>
  );
}
