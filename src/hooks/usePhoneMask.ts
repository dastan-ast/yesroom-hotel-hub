import { useState, useCallback } from 'react';

export function usePhoneMask(initialValue = '') {
  const [value, setValue] = useState(initialValue);

  const formatPhone = useCallback((input: string) => {
    // Remove all non-digits
    const digits = input.replace(/\D/g, '');
    
    if (digits.length === 0) {
      return '';
    }
    
    // Handle starting with 8 or 7, normalize to 7
    let normalizedDigits = digits;
    if (digits.startsWith('8') && digits.length > 1) {
      normalizedDigits = '7' + digits.slice(1);
    } else if (!digits.startsWith('7') && digits.length > 0) {
      normalizedDigits = '7' + digits;
    }
    
    const d = normalizedDigits;
    let formatted = '';
    
    // Format as +7 (7xx) xxx-xx-xx
    if (d.length >= 1) formatted = '+' + d.charAt(0);
    if (d.length >= 2) formatted += ' (' + d.substring(1, Math.min(4, d.length));
    if (d.length >= 4) formatted += ')';
    if (d.length >= 5) formatted += ' ' + d.substring(4, Math.min(7, d.length));
    if (d.length >= 8) formatted += '-' + d.substring(7, Math.min(9, d.length));
    if (d.length >= 10) formatted += '-' + d.substring(9, Math.min(11, d.length));
    
    return formatted;
  }, []);

  const handleChange = useCallback((input: string) => {
    const formatted = formatPhone(input);
    setValue(formatted);
    return formatted;
  }, [formatPhone]);

  const getRawPhone = useCallback(() => {
    return value.replace(/\D/g, '');
  }, [value]);

  return {
    value,
    setValue,
    handleChange,
    getRawPhone,
    formatted: value,
  };
}
