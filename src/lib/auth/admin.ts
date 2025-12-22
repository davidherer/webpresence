import { SignJWT, jwtVerify } from "jose";
import { cookies, headers } from "next/headers";
import { prisma } from "@/lib/db";
import { Resend } from "resend";

const ADMIN_JWT_SECRET = new TextEncoder().encode(process.env.ADMIN_JWT_SECRET);
const resend = new Resend(process.env.RESEND_API_KEY);

const ADMIN_SESSION_COOKIE = "admin_session";
const AUTH_CODE_EXPIRY = 5 * 60 * 1000; // 5 minutes (more strict for admin)
const SESSION_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours (shorter for admin)

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function getClientInfo() {
  const headersList = await headers();
  return {
    userAgent: headersList.get("user-agent") || undefined,
    ipAddress:
      headersList.get("x-forwarded-for")?.split(",")[0] ||
      headersList.get("x-real-ip") ||
      undefined,
  };
}

export async function sendAdminAuthCode(email: string) {
  const admin = await prisma.admin.findUnique({ where: { email } });

  if (!admin) {
    return { success: false, error: "Admin not found" };
  }

  const code = generateCode();
  const expiresAt = new Date(Date.now() + AUTH_CODE_EXPIRY);

  await prisma.adminAuthCode.create({
    data: {
      adminId: admin.id,
      code,
      expiresAt,
    },
  });

  // En développement, afficher le code dans la console
  if (process.env.NODE_ENV === "development") {
    console.log("\n" + "=".repeat(60));
    console.log("🔐 CODE D'AUTHENTIFICATION ADMIN");
    console.log("=".repeat(60));
    console.log(`Email: ${email}`);
    console.log(`Code:  ${code}`);
    console.log(`Expire: ${expiresAt.toLocaleString("fr-FR")}`);
    console.log("=".repeat(60) + "\n");
  }

  await resend.emails.send({
    from: process.env.EMAIL_FROM!,
    to: email,
    subject: "[Admin] Votre code de connexion",
    html: `<p>Votre code de connexion admin est : <strong>${code}</strong></p><p>Ce code expire dans 5 minutes.</p>`,
  });

  return { success: true };
}

export async function verifyAdminAuthCode(email: string, code: string) {
  const admin = await prisma.admin.findUnique({ where: { email } });
  if (!admin) return { success: false, error: "Admin not found" };

  const authCode = await prisma.adminAuthCode.findFirst({
    where: {
      adminId: admin.id,
      code,
      used: false,
      expiresAt: { gt: new Date() },
    },
  });

  if (!authCode) return { success: false, error: "Invalid or expired code" };

  await prisma.adminAuthCode.update({
    where: { id: authCode.id },
    data: { used: true },
  });

  if (!admin.emailVerified) {
    await prisma.admin.update({
      where: { id: admin.id },
      data: { emailVerified: new Date() },
    });
  }

  const token = await new SignJWT({ adminId: admin.id, email: admin.email })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("24h")
    .sign(ADMIN_JWT_SECRET);

  const expiresAt = new Date(Date.now() + SESSION_EXPIRY);
  const { userAgent, ipAddress } = await getClientInfo();

  await prisma.adminSession.create({
    data: {
      adminId: admin.id,
      token,
      expiresAt,
      userAgent,
      ipAddress,
    },
  });

  await logAdminAction(admin.id, "LOGIN", { ipAddress });

  const cookieStore = await cookies();
  cookieStore.set(ADMIN_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    expires: expiresAt,
    path: "/",
  });

  return { success: true, admin };
}

export async function getAdminSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;

  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, ADMIN_JWT_SECRET);

    const session = await prisma.adminSession.findUnique({
      where: { token },
      include: { admin: true },
    });

    if (!session || session.expiresAt < new Date()) {
      return null;
    }

    return session.admin;
  } catch {
    return null;
  }
}

export async function logoutAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;

  if (token) {
    const session = await prisma.adminSession.findUnique({ where: { token } });
    if (session) {
      await logAdminAction(session.adminId, "LOGOUT", {});
    }
    await prisma.adminSession.deleteMany({ where: { token } });
  }

  cookieStore.delete(ADMIN_SESSION_COOKIE);
}

export async function logAdminAction(
  adminId: string,
  action: string,
  details: object
) {
  const { ipAddress } = await getClientInfo();

  await prisma.adminAuditLog.create({
    data: {
      adminId,
      action,
      details: details as never,
      ipAddress,
    },
  });
}
