/**
 * BuildFlow — SummaryBreakdownCard
 *
 * Renders a labeled row: label | amount (Rs, grouped) | % of total,
 * with a color-coded progress bar. Used in estimate summaries, rate analysis
 * component breakdowns, and P&L cards.
 */
import { useMemo } from 'react';
import { View, Text } from 'react-native';
import { COLORS } from '@/constants';

export interface SummaryBreakdownRow {
  label: string;
  amount: number;
  /** Optional explicit color; otherwise auto-assigned by index. */
  color?: string;
}

interface SummaryBreakdownCardProps {
  title?: string;
  rows: SummaryBreakdownRow[];
  /** Denominator for percentage computation. Defaults to sum of rows. */
  total?: number;
  /** Show a grand-total row at the bottom. Defaults to true. */
  showTotal?: boolean;
  /** Label for the total row. */
  totalLabel?: string;
}

const ROW_COLORS = [
  COLORS.primary,
  COLORS.accent,
  COLORS.success,
  COLORS.warning,
  '#8B5CF6', // violet for subcontractor/extra
];

function formatINR(n: number): string {
  const rounded = Math.round(n);
  const neg = rounded < 0;
  const abs = Math.abs(rounded);
  const str = abs.toString();
  let grouped: string;
  if (str.length <= 3) {
    grouped = str;
  } else {
    const last3 = str.slice(-3);
    const rest = str.slice(0, -3);
    grouped = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + last3;
  }
  return `${neg ? '-' : ''}${grouped}`;
}

export function SummaryBreakdownCard({
  title,
  rows,
  total,
  showTotal = true,
  totalLabel = 'Total',
}: SummaryBreakdownCardProps): JSX.Element {
  const computedTotal = useMemo(
    () => total ?? rows.reduce((sum, r) => sum + (Number.isFinite(r.amount) ? r.amount : 0), 0),
    [rows, total],
  );

  return (
    <View
      style={{
        backgroundColor: COLORS.card,
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: COLORS.border,
      }}
    >
      {title ? (
        <Text style={{ fontSize: 16, fontWeight: '700', color: COLORS.text, marginBottom: 12 }}>
          {title}
        </Text>
      ) : null}

      {rows.map((row, idx) => {
        const pct = computedTotal > 0 ? (row.amount / computedTotal) * 100 : 0;
        const color = row.color ?? ROW_COLORS[idx % ROW_COLORS.length];
        return (
          <View key={`${row.label}-${idx}`} style={{ marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
              <Text style={{ fontSize: 14, color: COLORS.text, flexShrink: 1 }}>{row.label}</Text>
              <Text style={{ fontSize: 14, fontWeight: '600', color: COLORS.text, marginLeft: 8 }}>
                Rs {formatINR(row.amount)}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View
                style={{
                  flex: 1,
                  height: 8,
                  backgroundColor: COLORS.surface,
                  borderRadius: 4,
                  marginRight: 8,
                  overflow: 'hidden',
                }}
              >
                <View
                  style={{
                    width: `${Math.min(Math.max(pct, 0), 100)}%`,
                    height: '100%',
                    backgroundColor: color,
                  }}
                />
              </View>
              <Text style={{ fontSize: 12, color: COLORS.muted, width: 44, textAlign: 'right' }}>
                {pct.toFixed(1)}%
              </Text>
            </View>
          </View>
        );
      })}

      {showTotal ? (
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            borderTopWidth: 1,
            borderTopColor: COLORS.border,
            paddingTop: 12,
            marginTop: 4,
          }}
        >
          <Text style={{ fontSize: 15, fontWeight: '700', color: COLORS.text }}>{totalLabel}</Text>
          <Text style={{ fontSize: 15, fontWeight: '700', color: COLORS.primary }}>
            Rs {formatINR(computedTotal)}
          </Text>
        </View>
      ) : null}
    </View>
  );
}