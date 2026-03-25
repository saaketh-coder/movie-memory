import { prisma } from "@/lib/prisma";
import { openai } from "@/lib/openai";

const CACHE_WINDOW_MS = 60_000; // 60 seconds

// ─── In-Memory Lock Map ────────────────────────────────────────────────────────
// Prevents concurrent fact generation for the same user+movie.
// Limitation: Only works within a single server process. In a multi-instance
// deployment, you would need a distributed lock (e.g. Redis SETNX) or a DB-level
// advisory lock. Documented per Variant A requirements.
const generationLocks = new Map<string, Promise<FactResult>>();

export interface FactResult {
  content: string;
  movie: string;
  cached: boolean;
}

/**
 * Core fact generation logic implementing Variant A requirements:
 * 1. 60-second cache window — reuse recent facts
 * 2. Burst / idempotency protection — in-memory lock per user+movie
 * 3. Failure handling — fall back to cached fact on OpenAI error
 */
export async function generateFunFact(
  userId: string,
  movie: string,
  skipCache = false
): Promise<FactResult> {
  const lockKey = `${userId}:${movie}`;

  // ── Burst Protection ─────────────────────────────────────────────────────
  // If a generation is already in-flight for this user+movie, wait for it
  // instead of firing a duplicate OpenAI request.
  const inFlight = generationLocks.get(lockKey);
  if (inFlight) {
    return inFlight;
  }

  // Wrap the entire generation in a promise so concurrent callers share it
  const generationPromise = _generateFunFactInner(userId, movie, lockKey, skipCache);
  generationLocks.set(lockKey, generationPromise);

  try {
    return await generationPromise;
  } finally {
    generationLocks.delete(lockKey);
  }
}

async function _generateFunFactInner(
  userId: string,
  movie: string,
  _lockKey: string,
  skipCache: boolean
): Promise<FactResult> {
  // ── 1. Check 60-second cache (skipped when user explicitly requests a new fact) ──
  if (!skipCache) {
    const cacheThreshold = new Date(Date.now() - CACHE_WINDOW_MS);

    const cachedFact = await prisma.fact.findFirst({
      where: {
        userId,
        movie,
        createdAt: { gte: cacheThreshold },
      },
      orderBy: { createdAt: "desc" },
    });

    if (cachedFact) {
      return {
        content: cachedFact.content,
        movie: cachedFact.movie,
        cached: true,
      };
    }
  }

  // ── 2. Generate a new fact via OpenAI ───────────────────────────────────
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content:
            "You are a movie trivia expert. Respond with exactly one fun, surprising, and specific fact about the given movie. Keep it to 2-3 sentences. Do not repeat common knowledge.",
        },
        {
          role: "user",
          content: `Tell me a fun fact about the movie: "${movie}"`,
        },
      ],
      max_tokens: 200,
      temperature: 0.9, // High temperature for varied facts
    });

    const factText =
      completion.choices[0]?.message?.content?.trim() ??
      "No fact could be generated.";

    // ── 3. Store in DB ──────────────────────────────────────────────────────
    const newFact = await prisma.fact.create({
      data: {
        userId,
        movie,
        content: factText,
      },
    });

    return {
      content: newFact.content,
      movie: newFact.movie,
      cached: false,
    };
  } catch (error) {
    // ── 4. Failure Handling ────────────────────────────────────────────────
    // If OpenAI fails, attempt to return the most recent cached fact
    console.error("OpenAI fact generation failed:", error);

    const fallbackFact = await prisma.fact.findFirst({
      where: { userId, movie },
      orderBy: { createdAt: "desc" },
    });

    if (fallbackFact) {
      return {
        content: fallbackFact.content,
        movie: fallbackFact.movie,
        cached: true,
      };
    }

    // No cached fact exists at all — return user-friendly error
    throw new Error(
      "We couldn't generate a fun fact right now, and no previous facts are available. Please try again later."
    );
  }
}
