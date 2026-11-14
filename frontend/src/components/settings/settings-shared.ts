import { ApiError } from "@/lib/api";

export type Resource<T> = {
  state: "loading" | "ready" | "error";
  data: T | null;
  error: string | null;
};

export function initial<T>(): Resource<T> {
  return { state: "loading", data: null, error: null };
}

export function messageFor(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return "Something went wrong. Please try again.";
}
