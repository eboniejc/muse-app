import { z } from "zod";

// No input parameters required for this endpoint
export const schema = z.object({});

export type InputType = z.infer<typeof schema>;

// The output is plain text, so we don't define a strict JSON structure for OutputType
// But for client usage, we can define it as string
export type OutputType = string;

// Client helper
export const getSheetScript = async (
  input: InputType = {},
  init?: RequestInit
): Promise<string> => {
  const result = await fetch(`/_api/sheets/script`, {
    method: "GET",
    ...init,
    headers: {
      ...(init?.headers ?? {}),
    },
  });

  if (!result.ok) {
    throw new Error(`Failed to fetch script: ${result.statusText}`);
  }

  return await result.text();
};