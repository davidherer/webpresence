export type { User, Admin } from "@/generated/prisma/client";

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface SessionUser {
  id: string;
  email: string;
  name: string | null;
}

export interface SessionAdmin {
  id: string;
  email: string;
  name: string | null;
}
