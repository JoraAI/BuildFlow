/**
 * BuildFlow — NumberInput
 *
 * Currency-aware numeric input. Prefixes "Rs" for INR formatting and
 * comma-separates thousands on display while emitting a raw number.
 */
import { forwardRef, useCallback, useMemo, useState } from 'react';
import { TextInput, TextInputProps, View, Text } from 'react-native';
import { COLORS } from '@/constants';

export interface NumberInputProps
  extends Omit<TextInputProps, 'value' | 'onChangeText' | 'defaultValue'> {
  label?: string;
  error?: string;
  helper?: string;
  /** Value as a plain number (controlled). */
  value: number | null | undefined;
  /** Called with the parsed number (or null when empty). */
  onValueChange: (value: number | null) => void;
  /** Show "Rs" prefix and group digits (default true). */
  currency?: boolean;
  /** Suffix string, e.g. "%" or "/cum". */
  suffix?: string;
  /** Minimum selectable value. */
  min?: number;
  /** Maximum selectable value. */
  max?: number;
  /** Decimal places allowed (default 2). */
  decimals?: number;
}

function groupThousands(numStr: string): string {
  if (!numStr) return '';
  const [intPart, decPart] = numStr.split('.');
  // Indian numbering grouping (last 3, then groups of 2)
  const isNegative = intPart.startsWith('-');
  const digits = isNegative ? intPart.slice(1) : intPart;
  if (digits.length <= 3) {
    return (isNegative ? '-' : '') + digits + (decPart !== undefined ? `.${decPart}` : '');
  }
  const last3 = digits.slice(-3);
  const rest = digits.slice(0, -3);
  const grouped = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + last3;
  return (isNegative ? '-' : '') + grouped + (decPart !== undefined ? `.${decPart}` : '');
}

function parseDisplayToNumber(display: string, decimals: number): number | null {
  const cleaned = display.replace(/[^0-9.\-]/g, '');
  if (cleaned === '' || cleaned === '-' || cleaned === '.') return null;
  const num = parseFloat(cleaned);
  if (Number.isNaN(num)) return null;
  const factor = Math.pow(10, decimals);
  return Math.round(num * factor) / factor;
}

function formatForDisplay(num: number | null | undefined, currency: boolean): string {
  if (num === null || num === undefined || Number.isNaN(num)) return '';
  const str = String(num);
  return currency ? groupThousands(str) : str;
}

export const NumberInput = forwardRef<TextInput, NumberInputProps>(function NumberInput(
  {
    label,
    error,
    helper,
    value,
    onValueChange,
    currency = true,
    suffix,
    min,
    max,
    decimals = 2,
    editable = true,
    ...rest
  },
  ref,
) {
  const [focused, setFocused] = useState(false);
  const display = useMemo(() => {
    if (focused) {
      // While editing show raw number for easy editing
      return value === null || value === undefined ? '' : String(value);
    }
    return formatForDisplay(value, currency);
  }, [value, currency, focused]);

  const handleChange = useCallback(
    (text: string) => {
      let parsed = parseDisplayToNumber(text, decimals);
      if (parsed !== null) {
        if (min !== undefined && parsed < min) parsed = min;
        if (max !== undefined && parsed > max) parsed = max;
      }
      onValueChange(parsed);
    },
    [decimals, max, min, onValueChange],
  );

  const borderColor = error ? COLORS.danger : focused ? COLORS.primary : COLORS.border;

  return (
    <View>
      {label ? (
        <Text style={{ fontSize: 14, fontWeight: '600', color: COLORS.text, marginBottom: 6 }}>
          {label}
        </Text>
      ) : null}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          borderWidth: 1,
          borderColor,
          borderRadius: 8,
          backgroundColor: COLORS.card,
          paddingHorizontal: 12,
          opacity: editable ? 1 : 0.6,
        }}
      >
        {currency ? (
          <Text style={{ color: COLORS.muted, fontWeight: '600', marginRight: 6 }}>Rs</Text>
        ) : null}
        <TextInput
          ref={ref}
          value={display}
          onChangeText={handleChange}
          onFocus={(e) => {
            setFocused(true);
            rest.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            rest.onBlur?.(e);
          }}
          keyboardType="decimal-pad"
          editable={editable}
          style={{ flex: 1, paddingVertical: 12, fontSize: 16, color: COLORS.text }}
          {...rest}
        />
        {suffix ? (
          <Text style={{ color: COLORS.muted, fontWeight: '600', marginLeft: 6 }}>{suffix}</Text>
        ) : null}
      </View>
      {error ? (
        <Text style={{ color: COLORS.danger, fontSize: 12, marginTop: 4 }}>{error}</Text>
      ) : helper ? (
        <Text style={{ color: COLORS.muted, fontSize: 12, marginTop: 4 }}>{helper}</Text>
      ) : null}
    </View>
  );
});