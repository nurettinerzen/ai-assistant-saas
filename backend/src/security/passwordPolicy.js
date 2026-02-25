const MIN_PASSWORD_LENGTH = 12;

export function validatePasswordPolicy(password = '') {
  const errors = [];
  const value = String(password || '');

  if (value.length < MIN_PASSWORD_LENGTH) {
    errors.push(`at least ${MIN_PASSWORD_LENGTH} characters`);
  }
  if (!/[A-Z]/.test(value)) {
    errors.push('at least 1 uppercase letter');
  }
  if (!/[a-z]/.test(value)) {
    errors.push('at least 1 lowercase letter');
  }
  if (!/[0-9]/.test(value)) {
    errors.push('at least 1 number');
  }
  if (!/[!@#$%^&*(),.?":{}|<>_\-+=[\]\\;/`~']/u.test(value)) {
    errors.push('at least 1 symbol');
  }

  return {
    valid: errors.length === 0,
    errors,
    minLength: MIN_PASSWORD_LENGTH,
  };
}

export function passwordPolicyMessage() {
  return 'Password must contain at least 12 characters, including uppercase, lowercase, number, and symbol.';
}

export default {
  validatePasswordPolicy,
  passwordPolicyMessage,
  MIN_PASSWORD_LENGTH,
};
