import { z } from "zod";

/**
 * WhatsApp phone number validation schema
 * Accepts formats: 5511999999999, +5511999999999, (11) 99999-9999, etc.
 * Validates DDI + DDD + Number format
 */
export const whatsappPhoneSchema = z.string()
  .trim()
  .transform((val) => val.replace(/\D/g, "")) // Remove non-digits
  .refine((val) => val.length >= 10 && val.length <= 15, {
    message: "Telefone deve ter entre 10 e 15 dígitos",
  })
  .refine((val) => {
    // Check if starts with valid country code for Brazil (55)
    // or has valid length for international numbers
    if (val.startsWith("55")) {
      // Brazil: DDI (55) + DDD (2 digits) + Number (8-9 digits)
      return val.length >= 12 && val.length <= 13;
    }
    // Other countries
    return val.length >= 10 && val.length <= 15;
  }, {
    message: "Formato de telefone inválido para WhatsApp",
  });

/**
 * Format phone number for WhatsApp
 * @param phone - Raw phone number
 * @returns Formatted phone number with DDI
 */
export const formatWhatsAppPhone = (phone: string): string => {
  const cleaned = phone.replace(/\D/g, "");
  
  // If doesn't start with country code, assume Brazil (55)
  if (!cleaned.startsWith("55") && cleaned.length <= 11) {
    return `55${cleaned}`;
  }
  
  return cleaned;
};

/**
 * Validate if phone number is valid for WhatsApp
 * @param phone - Phone number to validate
 * @returns true if valid, false otherwise
 */
export const isValidWhatsAppPhone = (phone: string): boolean => {
  try {
    whatsappPhoneSchema.parse(phone);
    return true;
  } catch {
    return false;
  }
};

/**
 * Get phone validation error message
 * @param phone - Phone number to validate
 * @returns Error message or null if valid
 */
export const getPhoneValidationError = (phone: string): string | null => {
  try {
    whatsappPhoneSchema.parse(phone);
    return null;
  } catch (error: any) {
    return error.errors?.[0]?.message || "Telefone inválido";
  }
};
