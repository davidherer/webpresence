import { NextRequest, NextResponse } from "next/server";
import { verifyUserAuthCode } from "@/lib/auth/user";
import { codeSchema } from "@/types/auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = codeSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Données invalides" },
        { status: 400 }
      );
    }

    const result = await verifyUserAuthCode(
      parsed.data.email,
      parsed.data.code
    );
    return NextResponse.json(result);
  } catch (error) {
    console.error("Error verifying user auth code:", error);
    return NextResponse.json(
      { success: false, error: "Erreur serveur" },
      { status: 500 }
    );
  }
}
