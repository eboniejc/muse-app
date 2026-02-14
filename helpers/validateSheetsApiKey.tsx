import { z } from "zod";
import superjson from "superjson";

export type ValidationResult =
  | {
      valid: true;
    }
  | {
      valid: false;
      response: Response;
    };

export function validateSheetsApiKey(request: Request): ValidationResult {
  const apiKey = request.headers.get("x-api-key");
  const validApiKey = process.env.SHEETS_API_KEY;

  if (!validApiKey) {
    console.error("SHEETS_API_KEY is not defined in environment variables.");
    return {
      valid: false,
      response: new Response(
        superjson.stringify({ error: "Server misconfiguration" }),
        { status: 500 }
      ),
    };
  }

  if (apiKey !== validApiKey) {
    return {
      valid: false,
      response: new Response(superjson.stringify({ error: "Unauthorized" }), {
        status: 401,
      }),
    };
  }

  return { valid: true };
}