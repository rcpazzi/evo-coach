import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

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
  if (!DATE_ONLY_REGEX.test(value)) {
    throw new Error("Invalid date format. Use YYYY-MM-DD.");
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== value
  ) {
    throw new Error("Invalid date format. Use YYYY-MM-DD.");
  }

  return parsed;
}

function todayDateOnly(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function GET(request: Request) {
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

  const { searchParams } = new URL(request.url);
  const dateQuery = searchParams.get("date")?.trim() || todayDateOnly();

  let readingDate: Date;
  try {
    readingDate = parseDateOnly(dateQuery);
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Invalid date format.",
      },
      { status: 400 },
    );
  }

  const reading = await prisma.dailyHealthReading.findUnique({
    where: {
      userId_readingDate: {
        userId,
        readingDate,
      },
    },
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
  });

  return NextResponse.json({
    success: true,
    date: dateQuery,
    reading: reading
      ? {
          ...reading,
          readingDate: reading.readingDate.toISOString(),
          dataSyncedAt: reading.dataSyncedAt.toISOString(),
        }
      : null,
  });
}
