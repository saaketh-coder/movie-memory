"use client";

import { useState, useEffect, useCallback } from "react";

interface FactResponse {
  fact: string;
  cached: boolean;
  movie: string;
}

export function FunFact() {
  const [fact, setFact] = useState<string | null>(null);
  const [movie, setMovie] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFact = useCallback(async (fresh = false) => {
    setLoading(true);
    setError(null);

    try {
      const url = fresh ? "/api/fact?fresh=true" : "/api/fact";
      const res = await fetch(url);

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Failed to load fun fact.");
        return;
      }

      const data: FactResponse = await res.json();
      setFact(data.fact);
      setMovie(data.movie);
    } catch {
      setError("Network error. Could not load fun fact.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFact();
  }, [fetchFact]);

  return (
    <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <span>💡</span>
          Fun Fact
        </h3>
        <button
          onClick={() => fetchFact(true)}
          disabled={loading}
          className="rounded-lg bg-indigo-50 px-3 py-1.5 text-sm font-medium text-indigo-600 transition-colors hover:bg-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Loading…" : "New Fact"}
        </button>
      </div>

      {loading && !fact && (
        <div className="flex items-center gap-3 py-4">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
          <p className="text-sm text-gray-500">
            Generating a fun fact about your movie…
          </p>
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-red-50 p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {fact && (
        <div>
          {movie && (
            <p className="text-xs text-gray-400 mb-2">About: {movie}</p>
          )}
          <p className="text-gray-700 leading-relaxed">{fact}</p>
        </div>
      )}
    </div>
  );
}
