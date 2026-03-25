"use client";

import Image from "next/image";
import { useState } from "react";

interface UserProfileProps {
  name: string | null;
  email: string | null;
  image: string | null;
  favoriteMovie: string;
  onMovieChanged?: (newMovie: string) => void;
}

export function UserProfile({
  name,
  email,
  image,
  favoriteMovie,
  onMovieChanged,
}: UserProfileProps) {
  const [editing, setEditing] = useState(false);
  const [movie, setMovie] = useState(favoriteMovie);
  const [input, setInput] = useState(favoriteMovie);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    const trimmed = input.trim();
    if (trimmed.length < 2) {
      setError("Movie name must be at least 2 characters.");
      return;
    }
    if (trimmed === movie) {
      setEditing(false);
      setError(null);
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/change-movie", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ movie: trimmed }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Failed to update movie.");
        return;
      }

      const data = await res.json();
      setMovie(data.movie);
      setInput(data.movie);
      setEditing(false);
      onMovieChanged?.(data.movie);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
      <div className="flex items-start gap-4">
        {/* Avatar */}
        <div className="flex-shrink-0">
          {image ? (
            <Image
              src={image}
              alt={name || "User"}
              width={64}
              height={64}
              className="rounded-full ring-2 ring-gray-100"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-indigo-100 text-2xl font-bold text-indigo-600">
              {(name || email || "U").charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-semibold text-gray-900 truncate">
            {name || "Movie Lover"}
          </h2>
          {email && (
            <p className="text-sm text-gray-500 truncate">{email}</p>
          )}
          <div className="mt-3">
            {editing ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🎥</span>
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    maxLength={200}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSave();
                      if (e.key === "Escape") {
                        setEditing(false);
                        setInput(movie);
                        setError(null);
                      }
                    }}
                    className="flex-1 rounded-md border border-gray-300 px-2 py-1 text-sm text-gray-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                  />
                </div>
                <div className="flex items-center gap-2 ml-7">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="rounded-md bg-indigo-600 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {saving ? "Saving…" : "Save"}
                  </button>
                  <button
                    onClick={() => {
                      setEditing(false);
                      setInput(movie);
                      setError(null);
                    }}
                    disabled={saving}
                    className="rounded-md bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-200 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
                {error && (
                  <p className="ml-7 text-xs text-red-600">{error}</p>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-lg">🎥</span>
                <span className="text-sm text-gray-600">
                  Favorite movie:{" "}
                  <span className="font-medium text-gray-900">{movie}</span>
                </span>
                <button
                  onClick={() => setEditing(true)}
                  className="ml-1 rounded-md p-1 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                  title="Change movie"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="h-3.5 w-3.5"
                  >
                    <path d="m5.433 13.917 1.262-3.155A4 4 0 0 1 7.58 9.42l6.92-6.918a2.121 2.121 0 0 1 3 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 0 1-.65-.65Z" />
                    <path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0 0 10 3H4.75A2.75 2.75 0 0 0 2 5.75v9.5A2.75 2.75 0 0 0 4.75 18h9.5A2.75 2.75 0 0 0 17 15.25V10a.75.75 0 0 0-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25v-9.5Z" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
