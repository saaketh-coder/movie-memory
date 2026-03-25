import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { SignInButton } from "@/components/sign-in-button";

export default async function LandingPage() {
  const session = await auth();

  // If authenticated, redirect based on onboarding status
  if (session?.user) {
    const { prisma } = await import("@/lib/prisma");
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { onboardedAt: true },
    });

    if (user?.onboardedAt) {
      redirect("/dashboard");
    } else {
      redirect("/onboarding");
    }
  }

  return (
    <main className="flex-1 flex items-center justify-center">
      <div className="max-w-md w-full mx-auto px-6 py-16 text-center">
        {/* Logo / Hero */}
        <div className="mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-indigo-100 mb-6">
            <span className="text-4xl">🎬</span>
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 mb-3">
            Movie Memory
          </h1>
          <p className="text-lg text-gray-600 leading-relaxed">
            Save your favorite movie and discover fun facts about it, powered by
            AI.
          </p>
        </div>

        {/* Sign-in */}
        <SignInButton />

        <p className="mt-6 text-sm text-gray-400">
          We only use your Google profile to personalize your experience.
        </p>
      </div>
    </main>
  );
}
