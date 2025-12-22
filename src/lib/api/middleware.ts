import { NextRequest, NextResponse } from "next/server";
import { getUserSession } from "@/lib/auth/user";
import { getAdminSession } from "@/lib/auth/admin";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ApiHandler<TContext = { params: Promise<any> }> = (
  req: NextRequest,
  context: TContext
) => Promise<NextResponse>;

export function withUserAuth<
  TContext = { params: Promise<Record<string, string>> }
>(handler: ApiHandler<TContext>): ApiHandler<TContext> {
  return async (req, context) => {
    const user = await getUserSession();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    (req as NextRequest & { user: typeof user }).user = user;
    return handler(req, context);
  };
}

export function withAdminAuth<
  TContext = { params: Promise<Record<string, string>> }
>(handler: ApiHandler<TContext>): ApiHandler<TContext> {
  return async (req, context) => {
    const admin = await getAdminSession();

    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    (req as NextRequest & { admin: typeof admin }).admin = admin;
    return handler(req, context);
  };
}
