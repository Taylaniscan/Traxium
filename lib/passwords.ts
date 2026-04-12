export const MIN_PASSWORD_LENGTH = 12;

export function getPasswordValidationError(password: string) {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }

  if (!/[a-z]/u.test(password)) {
    return "Password must include at least one lowercase letter.";
  }

  if (!/[A-Z]/u.test(password)) {
    return "Password must include at least one uppercase letter.";
  }

  if (!/[0-9]/u.test(password)) {
    return "Password must include at least one number.";
  }

  return null;
}

export function getPasswordConfirmationError(
  password: string,
  confirmPassword: string
) {
  if (password !== confirmPassword) {
    return "Password confirmation does not match.";
  }

  return null;
}
