import { NextResponse } from "next/server";
import { getUserSession } from "@/lib/auth/user";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const user = await getUserSession();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch user's organizations with website counts
    const memberships = await prisma.organizationMember.findMany({
      where: { userId: user.id },
      include: {
        organization: {
          include: {
            _count: { select: { websites: true, members: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ 
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      memberships 
    });
  } catch (error) {
    console.error("Dashboard API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
