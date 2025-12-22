import { z } from "zod";

export const emailSchema = z.object({
  email: z.string().email("Email invalide"),
});

export const codeSchema = z.object({
  email: z.string().email("Email invalide"),
  code: z.string().length(6, "Code invalide"),
});

export type EmailInput = z.infer<typeof emailSchema>;
export type CodeInput = z.infer<typeof codeSchema>;
