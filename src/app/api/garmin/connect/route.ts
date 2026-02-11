import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createGarminConnection } from "@/server/garmin";

type ConnectBody = {
  email?: unknown;
  password?: unknown;
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

  let body: ConnectBody;
  try {
    body = (await request.json()) as ConnectBody;
  } catch {
    return NextResponse.json(
      { success: false, message: "Invalid request payload." },
      { status: 400 },
    );
  }

  const email = typeof body.email === "string" ? body.email.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!email || !password) {
    return NextResponse.json(
      { success: false, message: "Email and password are required." },
      { status: 400 },
    );
  }

  const connectResult = await createGarminConnection(email, password);
  if (!connectResult.success) {
    return NextResponse.json(
      { success: false, message: connectResult.message },
      { status: connectResult.status ?? 500 },
    );
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      garminConnected: true,
      garminOauthToken: new Uint8Array(connectResult.encryptedToken),
    },
  });

  return NextResponse.json({
    success: true,
    message: "Garmin connected.",
  });
}
