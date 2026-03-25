/**
 * Server-side validation for movie input.
 * Returns a sanitized movie name or throws an error message.
 */
export function validateMovie(input: unknown): string {
  if (typeof input !== "string") {
    throw new ValidationError("Movie name must be a string.");
  }

  const trimmed = input.trim();

  if (trimmed.length === 0) {
    throw new ValidationError("Movie name cannot be empty.");
  }

  if (trimmed.length < 2) {
    throw new ValidationError(
      "Movie name is too short (min 2 characters)."
    );
  }

  if (trimmed.length > 200) {
    throw new ValidationError(
      "Movie name is too long (max 200 characters)."
    );
  }

  // Basic sanitization: collapse multiple spaces
  return trimmed.replace(/\s+/g, " ");
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}
