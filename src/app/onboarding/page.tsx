import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { OnboardingForm } from "@/components/onboarding-form";

export default async function OnboardingPage() {
  const session = await auth();

  // Redirect unauthenticated users to login
  if (!session?.user?.id) {
    redirect("/");
  }

  // If already onboarded, go to dashboard
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { onboardedAt: true },
  });

  if (user?.onboardedAt) {
    redirect("/dashboard");
  }

  return (
    <main className="flex-1 flex items-center justify-center">
      <div className="max-w-md w-full mx-auto px-6 py-16">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-100 mb-4">
            <span className="text-3xl">🍿</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 mb-2">
            Welcome to Movie Memory!
          </h1>
          <p className="text-gray-600">
            Let&apos;s start by saving your all-time favorite movie.
          </p>
        </div>

        <OnboardingForm />
      </div>
    </main>
  );
}
