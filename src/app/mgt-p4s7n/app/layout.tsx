import { getAdminSession } from "@/lib/auth/admin"
import { redirect } from "next/navigation"

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const admin = await getAdminSession()

  if (!admin) {
    redirect("/mgt-p4s7n/login")
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-6 py-4 flex justify-between items-center">
          <h1 className="text-lg font-semibold">Admin Panel</h1>
          <span className="text-sm text-muted-foreground">{admin.email}</span>
        </div>
      </header>
      <main>{children}</main>
    </div>
  )
}
