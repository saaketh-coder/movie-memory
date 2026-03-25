"use client";

import { useState } from "react";
import { UserProfile } from "@/components/user-profile";
import { FunFact } from "@/components/fun-fact";

interface DashboardContentProps {
  name: string | null;
  email: string | null;
  image: string | null;
  favoriteMovie: string;
}

export function DashboardContent({
  name,
  email,
  image,
  favoriteMovie,
}: DashboardContentProps) {
  // Key is used to force FunFact to remount & fetch a new fact when the movie changes
  const [factKey, setFactKey] = useState(0);

  function handleMovieChanged() {
    setFactKey((k) => k + 1);
  }

  return (
    <>
      <UserProfile
        name={name}
        email={email}
        image={image}
        favoriteMovie={favoriteMovie}
        onMovieChanged={handleMovieChanged}
      />
      <FunFact key={factKey} />
    </>
  );
}
