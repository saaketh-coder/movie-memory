import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { SignOutButton } from "@/components/sign-out-button";
import { DashboardContent } from "@/components/dashboard-content";

export default async function DashboardPage() {
  const session = await auth();

  // Redirect unauthenticated users to login
  if (!session?.user?.id) {
    redirect("/");
  }

  // Load user data from the DB
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      favoriteMovie: true,
      onboardedAt: true,
    },
  });

  // If not onboarded, redirect to onboarding
  if (!user?.onboardedAt || !user.favoriteMovie) {
    redirect("/onboarding");
  }

  return (
    <main className="flex-1 flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🎬</span>
            <span className="text-lg font-semibold text-gray-900">
              Movie Memory
            </span>
          </div>
          <SignOutButton />
        </div>
      </header>

      {/* Content */}
      <div className="mx-auto w-full max-w-3xl px-6 py-10 space-y-8">
        <DashboardContent
          name={user.name}
          email={user.email}
          image={user.image}
          favoriteMovie={user.favoriteMovie}
        />
      </div>
    </main>
  );
}
