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

export async function POST() {
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

  await prisma.user.update({
    where: { id: userId },
    data: {
      garminConnected: false,
      garminOauthToken: null,
    },
  });

  return NextResponse.json({
    success: true,
    message: "Garmin disconnected.",
  });
}
