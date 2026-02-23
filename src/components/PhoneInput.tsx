import { useCallback, useRef } from 'react';

interface PhoneInputProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
  autoComplete?: string;
}

/**
 * Strips everything except digits and leading +
 */
function stripNonDigits(raw: string): string {
  const hasPlus = raw.startsWith('+');
  const digits = raw.replace(/\D/g, '');
  return hasPlus ? `+${digits}` : digits;
}

/**
 * Formats a raw phone string into international display format:
 *   +XX (XX) XXXXX-XXXX  (for 13 digits like BR)
 *   +X (XXX) XXX-XXXX    (for 11 digits like US)
 *   or simply shows digits as typed with + prefix
 */
function formatPhone(raw: string): string {
  // Ensure it starts with +
  let clean = raw.startsWith('+') ? raw : `+${raw}`;
  const digits = clean.replace(/\D/g, '');

  if (!digits) return '';

  // Build formatted string progressively
  let formatted = '+';
  const d = digits;

  if (d.length <= 2) {
    // Just country code
    formatted += d;
  } else if (d.length <= 4) {
    // Country code + start of area
    formatted += `${d.slice(0, 2)} (${d.slice(2)}`;
  } else if (d.length <= 9) {
    // Country code + area code + start of number
    formatted += `${d.slice(0, 2)} (${d.slice(2, 4)}) ${d.slice(4)}`;
  } else {
    // Full number with dash
    const local = d.slice(4);
    const splitAt = local.length > 4 ? local.length - 4 : 0;
    formatted += `${d.slice(0, 2)} (${d.slice(2, 4)}) ${local.slice(0, splitAt)}-${local.slice(splitAt)}`;
  }

  return formatted;
}

/**
 * Returns only the digits count (excluding +)
 */
export function getPhoneDigitCount(value: string): number {
  return value.replace(/\D/g, '').length;
}

/** Minimum digits for a valid international phone number (country code + local) */
export const MIN_PHONE_DIGITS = 10;

export function PhoneInput({
  id,
  value,
  onChange,
  placeholder = '+55 (11) 99000-0000',
  required,
  className,
  autoComplete = 'tel',
}: PhoneInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;

      // Allow only digits, +, spaces, parens, dashes
      const cleaned = raw.replace(/[^\d+\s()-]/g, '');

      // Extract just digits (max 15 per E.164)
      const stripped = stripNonDigits(cleaned);
      const digits = stripped.replace(/\D/g, '');

      if (digits.length > 15) return; // E.164 max

      // Store the formatted version
      const formatted = formatPhone(stripped);
      onChange(formatted);
    },
    [onChange],
  );

  const isInvalid = required && value && getPhoneDigitCount(value) < MIN_PHONE_DIGITS;

  return (
    <input
      ref={inputRef}
      id={id}
      type="tel"
      value={value}
      onChange={handleChange}
      placeholder={placeholder}
      required={required}
      className={className}
      autoComplete={autoComplete}
      aria-invalid={isInvalid ? 'true' : undefined}
      style={isInvalid ? { borderColor: 'var(--color-error)' } : undefined}
    />
  );
}
