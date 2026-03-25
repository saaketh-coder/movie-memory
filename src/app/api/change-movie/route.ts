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

    // 3. Update the user's favorite movie
    await prisma.user.update({
      where: { id: session.user.id },
      data: { favoriteMovie: movie },
    });

    return NextResponse.json({ success: true, movie });
  } catch {
    console.error("Change movie error");
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}
