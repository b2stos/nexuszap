/**
 * Validate WhatsApp phone number format
 * Accepts: DDI + DDD + Number (10-15 digits)
 * @param phone - Phone number to validate
 * @returns true if valid
 */
export const validatePhone = (phone: string): boolean => {
  const cleanPhone = phone.replace(/\D/g, "");
  
  // Minimum: DDD (2) + Number (8) = 10 digits
  // Maximum: DDI (3) + DDD (2) + Number (9) + extras = 15 digits
  if (cleanPhone.length < 10 || cleanPhone.length > 15) {
    return false;
  }
  
  // If starts with 55 (Brazil), validate Brazilian format
  if (cleanPhone.startsWith("55")) {
    // Should have 12-13 digits (55 + 2 DDD + 8-9 number)
    return cleanPhone.length >= 12 && cleanPhone.length <= 13;
  }
  
  return true;
};

/**
 * Validate WhatsApp phone with detailed error message
 * @param phone - Phone number to validate
 * @returns Error message or null if valid
 */
export const validatePhoneDetailed = (phone: string): string | null => {
  if (!phone || phone.trim().length === 0) {
    return "Telefone não pode ser vazio";
  }
  
  const cleanPhone = phone.replace(/\D/g, "");
  
  if (cleanPhone.length < 10) {
    return "Telefone muito curto (mínimo 10 dígitos)";
  }
  
  if (cleanPhone.length > 15) {
    return "Telefone muito longo (máximo 15 dígitos)";
  }
  
  if (cleanPhone.startsWith("55") && (cleanPhone.length < 12 || cleanPhone.length > 13)) {
    return "Formato brasileiro inválido (DDI 55 + DDD + 8-9 dígitos)";
  }
  
  return null;
};

export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const validateRequired = (value: string): boolean => {
  return value.trim().length > 0;
};

export const validateMinLength = (value: string, minLength: number): boolean => {
  return value.length >= minLength;
};

export const validateMaxLength = (value: string, maxLength: number): boolean => {
  return value.length <= maxLength;
};

export const getValidationErrors = (fields: Record<string, any>, rules: Record<string, (value: any) => string | null>): Record<string, string> => {
  const errors: Record<string, string> = {};
  
  Object.keys(rules).forEach((field) => {
    const error = rules[field](fields[field]);
    if (error) {
      errors[field] = error;
    }
  });
  
  return errors;
};
