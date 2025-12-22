import { NextRequest, NextResponse } from "next/server";
import { getUserSession } from "@/lib/auth/user";
import { getAdminSession } from "@/lib/auth/admin";

type ApiHandler = (
  req: NextRequest,
  context: { params: Promise<Record<string, string>> }
) => Promise<NextResponse>;

export function withUserAuth(handler: ApiHandler): ApiHandler {
  return async (req, context) => {
    const user = await getUserSession();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    (req as NextRequest & { user: typeof user }).user = user;
    return handler(req, context);
  };
}

export function withAdminAuth(handler: ApiHandler): ApiHandler {
  return async (req, context) => {
    const admin = await getAdminSession();

    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    (req as NextRequest & { admin: typeof admin }).admin = admin;
    return handler(req, context);
  };
}
