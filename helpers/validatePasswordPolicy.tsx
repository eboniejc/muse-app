export function validatePasswordPolicy(
  password: string,
  _context: { email?: string; displayName?: string } = {}
): string | null {
  if (password.length < 6) {
    return "Password must be at least 6 characters long.";
  }
  return null;
}
