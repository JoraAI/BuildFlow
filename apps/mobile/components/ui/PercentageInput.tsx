/**
 * BuildFlow — PercentageInput
 *
 * Numeric input constrained to 0–100 with a "%" suffix.
 */
import { forwardRef } from 'react';
import { TextInput } from 'react-native';
import { NumberInput, NumberInputProps } from './NumberInput';

interface PercentageInputProps extends Omit<NumberInputProps, 'currency' | 'suffix' | 'min' | 'max'> {
  /** Allow values > 100 (e.g. for material wastage). Defaults to false. */
  allowOver?: boolean;
}

export const PercentageInput = forwardRef<TextInput, PercentageInputProps>(
  function PercentageInput({ allowOver = false, ...rest }, ref) {
    return (
      <NumberInput
        ref={ref}
        currency={false}
        suffix="%"
        min={0}
        max={allowOver ? undefined : 100}
        decimals={2}
        {...rest}
      />
    );
  },
);