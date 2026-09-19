export type LoginValidation = { valid: true } | { valid: false; reason: string };

export function validateLocalLogin(username: string, password: string): LoginValidation {
  const normalized = username.trim();
  if (normalized.length < 3) return { valid: false, reason: "أدخل اسم مستخدم من 3 أحرف على الأقل." };
  if (password.length < 4) return { valid: false, reason: "أدخل كلمة مرور من 4 أحرف على الأقل." };
  return { valid: true };
}

export function normalizeUsername(username: string) {
  return username.trim();
}
