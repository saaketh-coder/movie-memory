import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { validateMovie, ValidationError } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    // 1. Authentication check
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Parse and validate input
    const body = await request.json();
    let movie: string;

    try {
      movie = validateMovie(body.movie);
    } catch (err) {
      if (err instanceof ValidationError) {
        return NextResponse.json({ error: err.message }, { status: 400 });
      }
      return NextResponse.json(
        { error: "Invalid request body." },
        { status: 400 }
      );
    }

    // 3. Check if user is already onboarded (idempotent — don't overwrite)
    const existingUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { onboardedAt: true },
    });

    if (existingUser?.onboardedAt) {
      return NextResponse.json(
        { error: "Already onboarded." },
        { status: 409 }
      );
    }

    // 4. Store the movie and mark onboarding complete
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        favoriteMovie: movie,
        onboardedAt: new Date(),
      },
    });

    return NextResponse.json({ success: true });
  } catch {
    console.error("Onboarding error");
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}
