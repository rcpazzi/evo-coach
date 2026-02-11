import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { uploadWorkoutToGarmin } from "@/server/sync";

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

function parseWorkoutId(url: string): number | null {
  const match = new URL(url).pathname.match(/^\/api\/workout\/(\d+)\/accept\/?$/);
  if (!match) {
    return null;
  }

  const workoutId = Number(match[1]);
  if (!Number.isInteger(workoutId) || workoutId <= 0) {
    return null;
  }

  return workoutId;
}

function uploadFailureStatus(message: string): number {
  const normalized = message.toLowerCase();
  if (
    normalized.includes("not connected") ||
    normalized.includes("invalid") ||
    normalized.includes("reconnect")
  ) {
    return 400;
  }

  return 500;
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

  const workoutId = parseWorkoutId(request.url);
  if (!workoutId) {
    return NextResponse.json(
      { success: false, message: "Invalid workout id." },
      { status: 400 },
    );
  }

  const workout = await prisma.workout.findFirst({
    where: {
      id: workoutId,
      userId,
    },
    select: {
      id: true,
      status: true,
      workoutJson: true,
    },
  });

  if (!workout) {
    return NextResponse.json(
      { success: false, message: "Workout not found." },
      { status: 404 },
    );
  }

  if (workout.status !== "generated") {
    return NextResponse.json(
      {
        success: false,
        message: "Only generated workouts can be accepted.",
      },
      { status: 400 },
    );
  }

  const uploadResult = await uploadWorkoutToGarmin(userId, workout.workoutJson);
  if (!uploadResult.success) {
    return NextResponse.json(
      {
        success: false,
        message: uploadResult.message,
      },
      { status: uploadFailureStatus(uploadResult.message) },
    );
  }

  const garminWorkoutId =
    typeof uploadResult.workoutId === "number" && Number.isFinite(uploadResult.workoutId)
      ? Math.trunc(uploadResult.workoutId)
      : null;

  await prisma.workout.update({
    where: { id: workout.id },
    data: {
      status: "uploaded",
      garminWorkoutId:
        garminWorkoutId !== null ? BigInt(garminWorkoutId) : null,
    },
  });

  return NextResponse.json({
    success: true,
    message: "Workout uploaded to Garmin.",
    workoutId: workout.id,
    status: "uploaded",
    garminWorkoutId: garminWorkoutId ?? undefined,
  });
}
