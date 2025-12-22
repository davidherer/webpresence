import { getUserSession } from "@/lib/auth/user"
import { redirect } from "next/navigation"

export default async function UserLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getUserSession()

  if (!user) {
    redirect("/")
  }

  return <>{children}</>
}
