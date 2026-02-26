import { useCallback, useRef, useEffect } from 'react';
import IntlTelInput from "intl-tel-input/reactWithUtils";
import "intl-tel-input/styles";
import type { IntlTelInputRef } from "intl-tel-input/react";
import type { Iso2 } from "intl-tel-input/data";

interface PhoneInputProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
  autoComplete?: string;
  onBlur?: () => void;
  defaultCountry?: Iso2 | 'auto' | '';
}

/**
 * Returns only the digits count (excluding +)
 */
export function getPhoneDigitCount(value: string): number {
  return value.replace(/\D/g, '').length;
}

/** Minimum digits for a valid international phone number */
export const MIN_PHONE_DIGITS = 6; // Adjusted since intl-tel-input handles validation better

export function PhoneInput({
  id,
  value,
  onChange,
  placeholder = 'Enter phone number',
  required,
  className,
  autoComplete = 'tel',
  onBlur,
  defaultCountry = 'auto',
}: PhoneInputProps) {
  const phoneRef = useRef<IntlTelInputRef>(null);

  const handleChange = useCallback(
    (newNumber: string) => {
      onChange(newNumber);
    },
    [onChange],
  );

  const handleValidityChange = useCallback(
    (_isValid: boolean) => {
      // Internal validity tracking if needed
    },
    []
  );

  // Initialize value if provided
  const isInitialized = useRef(false);
  useEffect(() => {
    if (!isInitialized.current && value && phoneRef.current) {
      const instance = phoneRef.current.getInstance();
      if (instance) {
        instance.setNumber(value);
        isInitialized.current = true;
      }
    }
  }, [value]);

  return (
    <div className="phone-input-container">
      <IntlTelInput
        ref={phoneRef}
        onChangeNumber={handleChange}
        onChangeValidity={handleValidityChange}
        initOptions={{
          initialCountry: defaultCountry,
          geoIpLookup: (success: (countryCode: any) => void, failure: () => void) => {
            fetch("https://ipapi.co/json")
              .then(res => res.json())
              .then(data => success(data.country_code))
              .catch(() => failure());
          },
          strictMode: true,
          formatAsYouType: true,
          countrySearch: true,
          separateDialCode: true,
        }}
        inputProps={{
          id,
          placeholder,
          required,
          className: `phone-input-field ${className || ''}`,
          autoComplete,
          onBlur,
        }}
      />
    </div>
  );
}

