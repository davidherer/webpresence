import { NextRequest, NextResponse } from "next/server";
import { sendUserAuthCode } from "@/lib/auth/user";
import { emailSchema } from "@/types/auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = emailSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Email invalide" },
        { status: 400 }
      );
    }

    const result = await sendUserAuthCode(parsed.data.email);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Error sending user auth code:", error);
    return NextResponse.json(
      { success: false, error: "Erreur serveur" },
      { status: 500 }
    );
  }
}
