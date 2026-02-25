const COMMON_COMPROMISED_PASSWORDS = new Set<string>([
  "123456",
  "123456789",
  "12345678",
  "password",
  "password123",
  "qwerty",
  "qwerty123",
  "abc123",
  "111111",
  "123123",
  "admin",
  "letmein",
  "welcome",
  "iloveyou",
  "monkey",
  "dragon",
  "baseball",
  "football",
  "princess",
  "sunshine",
  "superman",
  "trustno1",
  "passw0rd",
  "p@ssw0rd",
  "000000",
  "654321",
  "1q2w3e4r",
  "zaq12wsx",
  "google",
  "asdfghjkl",
]);

type PasswordPolicyContext = {
  email?: string;
  displayName?: string;
};

export function validatePasswordPolicy(
  password: string,
  context: PasswordPolicyContext = {}
): string | null {
  if (password.length < 12) {
    return "Password must be at least 12 characters long.";
  }

  if (!/[a-z]/.test(password)) return "Password must include a lowercase letter.";
  if (!/[A-Z]/.test(password)) return "Password must include an uppercase letter.";
  if (!/[0-9]/.test(password)) return "Password must include a number.";
  if (!/[^A-Za-z0-9]/.test(password)) {
    return "Password must include a special character.";
  }

  const lowerPassword = password.toLowerCase();
  if (COMMON_COMPROMISED_PASSWORDS.has(lowerPassword)) {
    return "This password is too common. Choose a stronger password.";
  }

  if (context.email) {
    const emailLocalPart = context.email.split("@")[0]?.toLowerCase();
    if (emailLocalPart && emailLocalPart.length >= 3 && lowerPassword.includes(emailLocalPart)) {
      return "Password cannot contain your email name.";
    }
  }

  if (context.displayName) {
    const normalizedName = context.displayName.toLowerCase().replace(/\s+/g, "");
    if (normalizedName.length >= 3 && lowerPassword.includes(normalizedName)) {
      return "Password cannot contain your name.";
    }
  }

  return null;
}
