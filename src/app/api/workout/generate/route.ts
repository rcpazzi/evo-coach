import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import type { Prisma } from "../../../../../prisma/generated/prisma/client";
import { authOptions } from "@/lib/auth";
import { type GarminWorkoutJson, type WorkoutType } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { buildUserPrompt, generateWorkout } from "@/server/ai";

type GenerateWorkoutBody = {
  workoutType?: unknown;
  distanceKm?: unknown;
  userPrompt?: unknown;
};

const WORKOUT_TYPES: WorkoutType[] = [
  "easy",
  "tempo",
  "interval",
  "long-run",
  "recovery",
];

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

function isWorkoutType(value: unknown): value is WorkoutType {
  return typeof value === "string" && WORKOUT_TYPES.includes(value as WorkoutType);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function getEstimatedDurationMinutes(workout: GarminWorkoutJson): number | null {
  const durationSeconds = workout.estimatedDurationInSecs;
  if (!isFiniteNumber(durationSeconds) || durationSeconds <= 0) {
    return null;
  }

  return Math.max(1, Math.round(durationSeconds / 60));
}

function getEstimatedDistanceKm(
  workout: GarminWorkoutJson,
  requestedDistanceKm: number | null,
): number | null {
  if (requestedDistanceKm !== null) {
    return requestedDistanceKm;
  }

  const distanceMeters = workout.estimatedDistanceInMeters;
  if (!isFiniteNumber(distanceMeters) || distanceMeters <= 0) {
    return null;
  }

  return Number((distanceMeters / 1000).toFixed(2));
}

function getErrorStatus(errorMessage: string): number {
  const normalized = errorMessage.toLowerCase();

  if (
    normalized.includes("fitness profile") ||
    normalized.includes("sync garmin") ||
    normalized.includes("invalid request") ||
    normalized.includes("invalid payload") ||
    normalized.includes("workout prompt")
  ) {
    return 400;
  }

  if (normalized.includes("rate limit")) {
    return 503;
  }

  if (normalized.includes("timed out")) {
    return 504;
  }

  return 500;
}

function normalizeErrorMessage(errorMessage: string): string {
  const normalized = errorMessage.toLowerCase();

  if (
    normalized.includes("no cookie auth credentials found") ||
    normalized.includes("no auth credentials found") ||
    normalized.includes("invalid api key")
  ) {
    return "AI provider authentication failed. Set a valid API key in .env.local and retry.";
  }

  return errorMessage;
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

  let body: GenerateWorkoutBody;
  try {
    body = (await request.json()) as GenerateWorkoutBody;
  } catch {
    return NextResponse.json(
      { success: false, message: "Invalid request payload." },
      { status: 400 },
    );
  }

  if (!isWorkoutType(body.workoutType)) {
    return NextResponse.json(
      {
        success: false,
        message:
          "Invalid workoutType. Use one of: easy, tempo, interval, long-run, recovery.",
      },
      { status: 400 },
    );
  }

  let distanceKm: number | null = null;
  if (body.distanceKm !== undefined && body.distanceKm !== null) {
    if (!isFiniteNumber(body.distanceKm) || body.distanceKm <= 0) {
      return NextResponse.json(
        {
          success: false,
          message: "distanceKm must be a positive number when provided.",
        },
        { status: 400 },
      );
    }

    distanceKm = Number(body.distanceKm.toFixed(2));
  }

  if (body.userPrompt !== undefined && typeof body.userPrompt !== "string") {
    return NextResponse.json(
      {
        success: false,
        message: "userPrompt must be a string when provided.",
      },
      { status: 400 },
    );
  }

  const userPrompt = buildUserPrompt({
    workoutType: body.workoutType,
    distanceKm: distanceKm ?? undefined,
    userPrompt: typeof body.userPrompt === "string" ? body.userPrompt : undefined,
  });

  try {
    const generated = await generateWorkout(userId, userPrompt);

    const workout = await prisma.workout.create({
      data: {
        userId,
        workoutType: body.workoutType,
        title:
          typeof generated.workout.workoutName === "string" &&
          generated.workout.workoutName.trim() !== ""
            ? generated.workout.workoutName
            : `${body.workoutType} workout`,
        aiDescription: generated.explanation,
        workoutJson: generated.workout as Prisma.InputJsonValue,
        totalDistanceKm: getEstimatedDistanceKm(generated.workout, distanceKm),
        estimatedDurationMinutes: getEstimatedDurationMinutes(generated.workout),
        userPrompt: typeof body.userPrompt === "string" ? body.userPrompt.trim() || null : null,
        status: "generated",
      },
      select: {
        id: true,
        status: true,
      },
    });

    return NextResponse.json(
      {
        success: true,
        workoutId: workout.id,
        workout: generated.workout,
        explanation: generated.explanation,
        status: workout.status,
      },
      { status: 201 },
    );
  } catch (error) {
    const rawMessage =
      error instanceof Error ? error.message : "Workout generation failed.";
    const message = normalizeErrorMessage(rawMessage);

    return NextResponse.json(
      {
        success: false,
        message,
      },
      { status: getErrorStatus(rawMessage) },
    );
  }
}
