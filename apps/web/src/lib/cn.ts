/**
 * Minimal className combiner — joins truthy class tokens with a single space.
 *
 * Deliberately dependency-free (no clsx / tailwind-merge) for project scope.
 * Later conflicts are resolved manually by ordering tokens in call sites.
 *
 * @example
 *   cn("px-2", condition && "py-1", undefined, "text-sm") // "px-2 py-1 text-sm"
 */
export type ClassValue = string | false | null | undefined;

export function cn(...values: ClassValue[]): string {
  return values.filter(Boolean).join(" ");
}
