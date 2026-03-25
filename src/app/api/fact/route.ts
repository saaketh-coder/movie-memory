import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateFunFact } from "@/lib/fact-generator";

export async function GET(request: NextRequest) {
  try {
    // 1. Auth check
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    // Check if the client explicitly wants a fresh (non-cached) fact
    const skipCache =
      request.nextUrl.searchParams.get("fresh") === "true";

    // 2. Load user's favorite movie
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { favoriteMovie: true },
    });

    if (!user?.favoriteMovie) {
      return NextResponse.json(
        { error: "No favorite movie set. Please complete onboarding." },
        { status: 400 }
      );
    }

    // 3. Generate (or retrieve cached) fact — all Variant A logic lives here
    const result = await generateFunFact(
      userId,
      user.favoriteMovie,
      skipCache
    );

    return NextResponse.json({
      fact: result.content,
      movie: result.movie,
      cached: result.cached,
    });
  } catch (err) {
    // The fact-generator throws a user-friendly message on full failure
    const message =
      err instanceof Error
        ? err.message
        : "Internal server error.";
    console.error("Fact API error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
