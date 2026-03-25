"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function OnboardingForm() {
  const router = useRouter();
  const [movie, setMovie] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const trimmed = movie.trim();

    // Client-side pre-validation (server also validates)
    if (trimmed.length === 0) {
      setError("Please enter a movie name.");
      return;
    }
    if (trimmed.length < 2) {
      setError("Movie name is too short (min 2 characters).");
      return;
    }
    if (trimmed.length > 200) {
      setError("Movie name is too long (max 200 characters).");
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ movie: trimmed }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Something went wrong. Please try again.");
        return;
      }

      router.push("/dashboard");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label
          htmlFor="movie"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Your favorite movie
        </label>
        <input
          id="movie"
          type="text"
          value={movie}
          onChange={(e) => setMovie(e.target.value)}
          placeholder="e.g. The Shawshank Redemption"
          maxLength={200}
          className="block w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 placeholder-gray-400 shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none transition-all"
          autoFocus
          disabled={isSubmitting}
        />
        {error && (
          <p className="mt-2 text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-lg bg-indigo-600 px-4 py-3 text-base font-medium text-white shadow-sm transition-all hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
      >
        {isSubmitting ? "Saving…" : "Save & Continue"}
      </button>
    </form>
  );
}
