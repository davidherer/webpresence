import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { Resend } from "resend";

const USER_JWT_SECRET = new TextEncoder().encode(process.env.USER_JWT_SECRET);
const resend = new Resend(process.env.RESEND_API_KEY);

const USER_SESSION_COOKIE = "user_session";
const AUTH_CODE_EXPIRY = 10 * 60 * 1000; // 10 minutes
const SESSION_EXPIRY = 7 * 24 * 60 * 60 * 1000; // 7 days

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function sendUserAuthCode(email: string) {
  let user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    user = await prisma.user.create({ data: { email } });
  }

  const code = generateCode();
  const expiresAt = new Date(Date.now() + AUTH_CODE_EXPIRY);

  await prisma.userAuthCode.create({
    data: {
      userId: user.id,
      code,
      expiresAt,
    },
  });

  await resend.emails.send({
    from: process.env.EMAIL_FROM!,
    to: email,
    subject: "Votre code de connexion",
    html: `<p>Votre code de connexion est : <strong>${code}</strong></p><p>Ce code expire dans 10 minutes.</p>`,
  });

  return { success: true };
}

export async function verifyUserAuthCode(email: string, code: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return { success: false, error: "User not found" };

  const authCode = await prisma.userAuthCode.findFirst({
    where: {
      userId: user.id,
      code,
      used: false,
      expiresAt: { gt: new Date() },
    },
  });

  if (!authCode) return { success: false, error: "Invalid or expired code" };

  await prisma.userAuthCode.update({
    where: { id: authCode.id },
    data: { used: true },
  });

  if (!user.emailVerified) {
    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: new Date() },
    });
  }

  const token = await new SignJWT({ userId: user.id, email: user.email })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .sign(USER_JWT_SECRET);

  const expiresAt = new Date(Date.now() + SESSION_EXPIRY);

  await prisma.userSession.create({
    data: {
      userId: user.id,
      token,
      expiresAt,
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(USER_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: expiresAt,
    path: "/",
  });

  return { success: true, user };
}

export async function getUserSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(USER_SESSION_COOKIE)?.value;

  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, USER_JWT_SECRET);

    const session = await prisma.userSession.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!session || session.expiresAt < new Date()) {
      return null;
    }

    return session.user;
  } catch {
    return null;
  }
}

export async function logoutUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(USER_SESSION_COOKIE)?.value;

  if (token) {
    await prisma.userSession.deleteMany({ where: { token } });
  }

  cookieStore.delete(USER_SESSION_COOKIE);
}
