/**
 * Variant A – Backend Tests
 *
 * Tests for:
 * 1. 60-second cache window logic
 * 2. Authorization (user cannot fetch another user's facts)
 *
 * These tests mock Prisma and OpenAI to isolate the fact-generator logic.
 */

// ─── Mocks ─────────────────────────────────────────────────────────────────────

// Mock Prisma
const mockFindFirst = jest.fn();
const mockCreate = jest.fn();

jest.mock("@/lib/prisma", () => ({
  prisma: {
    fact: {
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
      create: (...args: unknown[]) => mockCreate(...args),
    },
  },
}));

// Mock OpenAI
const mockChatCreate = jest.fn();

jest.mock("@/lib/openai", () => ({
  openai: {
    chat: {
      completions: {
        create: (...args: unknown[]) => mockChatCreate(...args),
      },
    },
  },
}));

import { generateFunFact } from "@/lib/fact-generator";

// ─── Test Suite ────────────────────────────────────────────────────────────────

describe("generateFunFact — Variant A", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── 1. 60-Second Cache Window ─────────────────────────────────────────────

  describe("60-second cache window", () => {
    it("returns a cached fact when one exists within 60 seconds", async () => {
      const recentFact = {
        id: "fact-1",
        userId: "user-1",
        movie: "Inception",
        content: "Fun fact about Inception",
        createdAt: new Date(), // just now — within window
      };

      mockFindFirst.mockResolvedValue(recentFact);

      const result = await generateFunFact("user-1", "Inception");

      expect(result.cached).toBe(true);
      expect(result.content).toBe("Fun fact about Inception");
      expect(result.movie).toBe("Inception");

      // Should NOT have called OpenAI
      expect(mockChatCreate).not.toHaveBeenCalled();
      // Should NOT have created a new fact
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it("generates a new fact when cache is older than 60 seconds", async () => {
      // First call: findFirst returns null (no recent fact)
      mockFindFirst.mockResolvedValue(null);

      mockChatCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: "A brand new fun fact about Inception",
            },
          },
        ],
      });

      mockCreate.mockResolvedValue({
        id: "fact-2",
        userId: "user-1",
        movie: "Inception",
        content: "A brand new fun fact about Inception",
        createdAt: new Date(),
      });

      const result = await generateFunFact("user-1", "Inception");

      expect(result.cached).toBe(false);
      expect(result.content).toBe("A brand new fun fact about Inception");

      // Should have called OpenAI
      expect(mockChatCreate).toHaveBeenCalledTimes(1);
      // Should have stored the fact
      expect(mockCreate).toHaveBeenCalledTimes(1);
      expect(mockCreate).toHaveBeenCalledWith({
        data: {
          userId: "user-1",
          movie: "Inception",
          content: "A brand new fun fact about Inception",
        },
      });
    });

    it("passes correct date threshold to cache lookup", async () => {
      mockFindFirst.mockResolvedValue(null);
      mockChatCreate.mockResolvedValue({
        choices: [{ message: { content: "Fact text" } }],
      });
      mockCreate.mockResolvedValue({
        id: "f",
        userId: "user-1",
        movie: "Inception",
        content: "Fact text",
        createdAt: new Date(),
      });

      const before = Date.now();
      await generateFunFact("user-1", "Inception");
      const after = Date.now();

      // The cache lookup should have filtered by createdAt >= (now - 60s)
      const findFirstCall = mockFindFirst.mock.calls[0][0];
      expect(findFirstCall.where.userId).toBe("user-1");
      expect(findFirstCall.where.movie).toBe("Inception");

      const threshold = findFirstCall.where.createdAt.gte.getTime();
      // The threshold should be approximately 60 seconds before now
      expect(threshold).toBeGreaterThanOrEqual(before - 60_000 - 100);
      expect(threshold).toBeLessThanOrEqual(after - 60_000 + 100);
    });
  });

  // ── 2. Authorization ─────────────────────────────────────────────────────

  describe("authorization — user isolation", () => {
    it("only queries facts belonging to the requesting user", async () => {
      mockFindFirst.mockResolvedValue(null);
      mockChatCreate.mockResolvedValue({
        choices: [{ message: { content: "Fact" } }],
      });
      mockCreate.mockResolvedValue({
        id: "f",
        userId: "user-A",
        movie: "Tenet",
        content: "Fact",
        createdAt: new Date(),
      });

      await generateFunFact("user-A", "Tenet");

      // The Prisma query should scope to user-A, not any other user
      const query = mockFindFirst.mock.calls[0][0];
      expect(query.where.userId).toBe("user-A");
    });

    it("does not return facts from a different user", async () => {
      // Simulate: user-B has no cached facts
      mockFindFirst.mockResolvedValue(null);
      mockChatCreate.mockResolvedValue({
        choices: [{ message: { content: "User B's fact" } }],
      });
      mockCreate.mockResolvedValue({
        id: "f",
        userId: "user-B",
        movie: "Tenet",
        content: "User B's fact",
        createdAt: new Date(),
      });

      const result = await generateFunFact("user-B", "Tenet");

      // The fact should be attributed to user-B
      const createCall = mockCreate.mock.calls[0][0];
      expect(createCall.data.userId).toBe("user-B");

      // The result is not cached (generated fresh for user-B)
      expect(result.cached).toBe(false);
    });
  });

  // ── 3. Failure Handling ───────────────────────────────────────────────────

  describe("failure handling", () => {
    it("returns fallback cached fact when OpenAI fails", async () => {
      // No recent fact in cache window
      mockFindFirst
        .mockResolvedValueOnce(null) // first call: cache check
        .mockResolvedValueOnce({
          // second call: fallback lookup
          id: "old-fact",
          userId: "user-1",
          movie: "Inception",
          content: "An older fact about Inception",
          createdAt: new Date(Date.now() - 120_000), // 2 min ago
        });

      // OpenAI throws
      mockChatCreate.mockRejectedValue(new Error("OpenAI timeout"));

      const result = await generateFunFact("user-1", "Inception");

      expect(result.cached).toBe(true);
      expect(result.content).toBe("An older fact about Inception");
    });

    it("throws a user-friendly error when OpenAI fails and no cached fact exists", async () => {
      mockFindFirst.mockResolvedValue(null); // no facts at all

      mockChatCreate.mockRejectedValue(new Error("OpenAI error"));

      await expect(
        generateFunFact("user-1", "Unknown Movie")
      ).rejects.toThrow("couldn't generate a fun fact");
    });
  });

  // ── 4. Burst / Idempotency Protection ────────────────────────────────────

  describe("burst protection", () => {
    it("deduplicates concurrent requests for the same user+movie", async () => {
      let resolveOpenAI: (value: unknown) => void;
      const openAIPromise = new Promise((resolve) => {
        resolveOpenAI = resolve;
      });

      mockFindFirst.mockResolvedValue(null);
      mockChatCreate.mockReturnValue(openAIPromise);
      mockCreate.mockResolvedValue({
        id: "f",
        userId: "user-1",
        movie: "Inception",
        content: "Deduplicated fact",
        createdAt: new Date(),
      });

      // Fire two concurrent requests
      const p1 = generateFunFact("user-1", "Inception");
      const p2 = generateFunFact("user-1", "Inception");

      // Resolve OpenAI
      resolveOpenAI!({
        choices: [{ message: { content: "Deduplicated fact" } }],
      });

      const [r1, r2] = await Promise.all([p1, p2]);

      // Both should return the same fact
      expect(r1.content).toBe("Deduplicated fact");
      expect(r2.content).toBe("Deduplicated fact");

      // OpenAI should only have been called ONCE (not twice)
      expect(mockChatCreate).toHaveBeenCalledTimes(1);
    });
  });
});
