import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
  const match = new URL(url).pathname.match(/^\/api\/workout\/(\d+)\/reject\/?$/);
  if (!match) {
    return null;
  }

  const workoutId = Number(match[1]);
  if (!Number.isInteger(workoutId) || workoutId <= 0) {
    return null;
  }

  return workoutId;
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
    },
  });

  if (!workout) {
    return NextResponse.json(
      { success: false, message: "Workout not found." },
      { status: 404 },
    );
  }

  await prisma.workout.update({
    where: { id: workout.id },
    data: {
      status: "rejected",
    },
  });

  return NextResponse.json({
    success: true,
    message: "Workout rejected.",
    workoutId: workout.id,
    status: "rejected",
  });
}
