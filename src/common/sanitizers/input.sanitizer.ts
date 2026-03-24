import { Transform } from 'class-transformer';
import { sanitize } from 'class-sanitizer';
import DOMPurify from 'isomorphic-dompurify';

/**
 * Sanitizes string input by trimming whitespace and removing HTML/script tags
 */
export function SanitizeString() {
  return Transform(({ value }) => {
    if (typeof value !== 'string') {
      return value;
    }
    
    // Trim whitespace
    let sanitized = value.trim();
    
    // Remove HTML tags and potential XSS
    sanitized = DOMPurify.sanitize(sanitized, { 
      ALLOWED_TAGS: [],
      ALLOWED_ATTR: []
    });
    
    // Remove null bytes and control characters
    sanitized = sanitized.replace(/[\x00-\x1F\x7F]/g, '');
    
    return sanitized;
  });
}

/**
 * Sanitizes and normalizes email addresses
 */
export function SanitizeEmail() {
  return Transform(({ value }) => {
    if (typeof value !== 'string') {
      return value;
    }
    
    // Trim and convert to lowercase
    let email = value.trim().toLowerCase();
    
    // Remove HTML tags
    email = DOMPurify.sanitize(email, { 
      ALLOWED_TAGS: [],
      ALLOWED_ATTR: []
    });
    
    // Basic email format validation during sanitization
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return value; // Return original if invalid format
    }
    
    return email;
  });
}

/**
 * Sanitizes numeric input and converts to number
 */
export function SanitizeNumber() {
  return Transform(({ value }) => {
    if (typeof value === 'number') {
      return value;
    }
    
    if (typeof value === 'string') {
      // Remove non-numeric characters except decimal point and minus sign
      const cleaned = value.replace(/[^0-9.-]/g, '');
      const parsed = parseFloat(cleaned);
      
      return isNaN(parsed) ? value : parsed;
    }
    
    return value;
  });
}

/**
 * Sanitizes boolean input
 */
export function SanitizeBoolean() {
  return Transform(({ value }) => {
    if (typeof value === 'boolean') {
      return value;
    }
    
    if (typeof value === 'string') {
      const lower = value.toLowerCase().trim();
      if (lower === 'true' || lower === '1' || lower === 'yes') {
        return true;
      }
      if (lower === 'false' || lower === '0' || lower === 'no') {
        return false;
      }
    }
    
    if (typeof value === 'number') {
      return Boolean(value);
    }
    
    return value;
  });
}

/**
 * Sanitizes array input by filtering out invalid elements
 */
export function SanitizeArray() {
  return Transform(({ value }) => {
    if (!Array.isArray(value)) {
      return value;
    }
    
    return value.filter(item => {
      // Filter out null, undefined, and empty strings
      if (item === null || item === undefined || item === '') {
        return false;
      }
      
      // If it's a string, sanitize it
      if (typeof item === 'string') {
        const sanitized = DOMPurify.sanitize(item.trim(), { 
          ALLOWED_TAGS: [],
          ALLOWED_ATTR: []
        });
        return sanitized.length > 0;
      }
      
      return true;
    });
  });
}

/**
 * Sanitizes Stellar address input
 */
export function SanitizeStellarAddress() {
  return Transform(({ value }) => {
    if (typeof value !== 'string') {
      return value;
    }
    
    // Trim whitespace and convert to uppercase
    let address = value.trim().toUpperCase();
    
    // Remove any non-alphanumeric characters
    address = address.replace(/[^A-Z0-9]/g, '');
    
    // Validate basic format (G, S, or M followed by 55 characters)
    if (!/^[GSM][A-Z0-9]{55}$/.test(address)) {
      return value; // Return original if invalid format
    }
    
    return address;
  });
}

/**
 * Sanitizes asset code input
 */
export function SanitizeAssetCode() {
  return Transform(({ value }) => {
    if (typeof value !== 'string') {
      return value;
    }
    
    // Trim and convert to uppercase
    let code = value.trim().toUpperCase();
    
    // Remove non-alphanumeric characters
    code = code.replace(/[^A-Z0-9]/g, '');
    
    // Limit to 12 characters (Stellar asset code limit)
    code = code.substring(0, 12);
    
    return code;
  });
}

/**
 * Sanitizes JSON input
 */
export function SanitizeJSON() {
  return Transform(({ value }) => {
    if (typeof value === 'object') {
      return value;
    }
    
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch (error) {
        return value; // Return original if invalid JSON
      }
    }
    
    return value;
  });
}

/**
 * Removes SQL injection patterns
 */
export function SanitizeSQL() {
  return Transform(({ value }) => {
    if (typeof value !== 'string') {
      return value;
    }
    
    // Remove common SQL injection patterns
    const sqlPatterns = [
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)/gi,
      /(--|\/\*|\*\/|;|'|"|`)/g,
      /(\bOR\b|\bAND\b)\s+\d+\s*=\s*\d+/gi
    ];
    
    let sanitized = value;
    sqlPatterns.forEach(pattern => {
      sanitized = sanitized.replace(pattern, '');
    });
    
    return sanitized.trim();
  });
}