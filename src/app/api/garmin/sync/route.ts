import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  syncDailyHealthData,
  syncUserActivities,
  syncUserRunningFitness,
} from "@/server/sync";

type SyncBody = {
  startDate?: unknown;
  endDate?: unknown;
};

function getUserId(
  session: { user?: { id?: string | null } } | null,
): number | null {
  const userIdRaw = session?.user?.id;
  const userId = Number(userIdRaw);

  if (!Number.isInteger(userId) || userId <= 0) {
    return null;
  }

  return userId;
}

function parseDateOnly(value: string): Date {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Invalid date format. Use YYYY-MM-DD.");
  }
  return parsed;
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export async function POST(request: Request) {
  const session = (await getServerSession(authOptions)) as {
    user?: { id?: string | null };
  } | null;
  const userId = getUserId(session);

  if (!userId) {
    return NextResponse.json(
      { success: false, message: "Unauthorized." },
      { status: 401 },
    );
  }

  let body: SyncBody = {};
  try {
    if (request.headers.get("content-length") !== "0") {
      body = (await request.json()) as SyncBody;
    }
  } catch {
    return NextResponse.json(
      { success: false, message: "Invalid request payload." },
      { status: 400 },
    );
  }

  const today = new Date();
  const defaultEndDate = formatDate(today);
  const defaultStartDate = formatDate(new Date(today.getTime() - 30 * 86400000));

  const startDate =
    typeof body.startDate === "string" && body.startDate.trim() !== ""
      ? body.startDate
      : defaultStartDate;
  const endDate =
    typeof body.endDate === "string" && body.endDate.trim() !== ""
      ? body.endDate
      : defaultEndDate;

  let parsedStart: Date;
  let parsedEnd: Date;
  try {
    parsedStart = parseDateOnly(startDate);
    parsedEnd = parseDateOnly(endDate);
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Invalid date format.",
      },
      { status: 400 },
    );
  }

  if (parsedStart > parsedEnd) {
    return NextResponse.json(
      {
        success: false,
        message: "startDate must be before or equal to endDate.",
      },
      { status: 400 },
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { garminConnected: true, garminOauthToken: true },
  });

  if (!user?.garminConnected || !user.garminOauthToken) {
    return NextResponse.json(
      {
        success: false,
        message: "Garmin not connected. Connect your Garmin account first.",
      },
      { status: 400 },
    );
  }

  const [activityResult, healthResult, fitnessResult] = await Promise.all([
    syncUserActivities(userId, startDate, endDate),
    syncDailyHealthData(userId, startDate, endDate),
    syncUserRunningFitness(userId),
  ]);

  const hasFailure =
    !activityResult.success || !healthResult.success || !fitnessResult.success;

  if (hasFailure) {
    return NextResponse.json(
      {
        success: false,
        message: "Garmin sync failed.",
        details: {
          activities: activityResult,
          health: healthResult,
          fitness: fitnessResult,
        },
      },
      { status: 500 },
    );
  }

  await prisma.user.update({
    where: { id: userId },
    data: { lastSyncAt: new Date() },
  });

  return NextResponse.json({
    success: true,
    message: "Garmin sync complete.",
    activitiesSynced: activityResult.synced,
    healthDaysSynced: healthResult.synced,
    fitnessSynced: fitnessResult.synced,
  });
}
