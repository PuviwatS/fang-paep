import { z } from "zod";

/** Validation for what the browser sends to /api. */

export const categorySchema = z.enum(["all", "pop", "rock", "luk", "hiphop"]);
export const songCategorySchema = z.enum(["pop", "rock", "luk", "hiphop"]);

const dayNumber = z.coerce.number().int().min(1).max(100_000);

export const puzzleQuerySchema = z.object({
  category: categorySchema.default("all"),
  day: dayNumber.optional(),
});

export const guessBodySchema = z.object({
  category: categorySchema,
  day: dayNumber,
  /** null = skip */
  songId: z.number().int().positive().nullable(),
  /** Attempts already used; only read for guests. */
  attempt: z.number().int().min(0).max(5),
});

export const categoryQuerySchema = z.object({
  category: categorySchema.default("all"),
});

export const leaderboardQuerySchema = z.object({
  category: categorySchema.default("all"),
  day: dayNumber.optional(),
});

export const importBodySchema = z.object({
  games: z
    .array(
      z.object({
        day: dayNumber,
        category: categorySchema,
        guesses: z.array(z.object({ songId: z.number().int().positive().nullable().optional() })).max(6),
      }),
    )
    .max(400),
});

export const displayNameSchema = z.object({
  displayName: z.string().trim().min(1).max(40),
});

export const checkoutBodySchema = z.object({
  planId: z.string().min(1).max(64),
});
