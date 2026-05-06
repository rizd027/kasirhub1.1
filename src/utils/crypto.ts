/**
 * Password hashing utility using Web Crypto API (SHA-256).
 * Works in both browser and Node.js (Next.js).
 *
 * Migration strategy: Progressive — on login, if hashed comparison fails,
 * fall back to plain-text check and auto-migrate to hashed version.
 */

export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Returns true if plaintext password matches a stored value.
 * Handles both hashed (64-char hex) and legacy plain-text passwords.
 */
export async function verifyPassword(
  inputPassword: string,
  storedPassword: string
): Promise<{ matches: boolean; isLegacy: boolean }> {
  const hashed = await hashPassword(inputPassword);

  if (hashed === storedPassword) {
    return { matches: true, isLegacy: false };
  }

  // Fallback: compare plain-text (legacy migration)
  if (inputPassword === storedPassword) {
    return { matches: true, isLegacy: true };
  }

  return { matches: false, isLegacy: false };
}
