import { NextResponse } from "next/server";
import { getUserSession } from "@/lib/auth/user";

export async function GET() {
  try {
    const user = await getUserSession();
    
    if (!user) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    return NextResponse.json({ 
      authenticated: true, 
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      }
    });
  } catch (error) {
    return NextResponse.json({ authenticated: false }, { status: 500 });
  }
}
