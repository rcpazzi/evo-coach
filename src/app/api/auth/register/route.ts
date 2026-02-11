import bcrypt from "bcrypt";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type RegisterBody = {
  email?: unknown;
  password?: unknown;
  passwordConfirmation?: unknown;
  confirmPassword?: unknown;
};

function getRegisterPayload(body: RegisterBody) {
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const passwordConfirmation =
    typeof body.passwordConfirmation === "string"
      ? body.passwordConfirmation
      : typeof body.confirmPassword === "string"
        ? body.confirmPassword
        : "";

  return { email, password, passwordConfirmation };
}

export async function POST(request: Request) {
  let body: RegisterBody;

  try {
    body = (await request.json()) as RegisterBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { email, password, passwordConfirmation } = getRegisterPayload(body);

  if (!email) {
    return NextResponse.json({ error: "Email is required." }, { status: 400 });
  }

  if (password.length < 6) {
    return NextResponse.json(
      { error: "Password must be at least 6 characters." },
      { status: 400 },
    );
  }

  if (password !== passwordConfirmation) {
    return NextResponse.json(
      { error: "Password confirmation does not match." },
      { status: 400 },
    );
  }

  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (existingUser) {
    return NextResponse.json(
      { error: "An account with this email already exists." },
      { status: 409 },
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
    },
    select: {
      id: true,
      email: true,
      garminConnected: true,
    },
  });

  return NextResponse.json({ user }, { status: 201 });
}
