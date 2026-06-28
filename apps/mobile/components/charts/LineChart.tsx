/**
 * BuildFlow - Lightweight SVG LineChart.
 * Avoids heavy chart deps; works with react-native-svg.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Polyline, Circle, Line, Text as SvgText } from 'react-native-svg';

interface DataPoint {
  x: number | string;
  y: number;
  label?: string;
}

interface LineChartProps {
  data: DataPoint[];
  width?: number;
  height?: number;
  color?: string;
  showAxes?: boolean;
  showDots?: boolean;
  yLabelPrefix?: string;
  xTickFormat?: (v: number | string, i: number) => string;
  yTickCount?: number;
}

export function LineChart({
  data,
  width = 300,
  height = 220,
  color = '#1E3A5F',
  showAxes = true,
  showDots = true,
  yLabelPrefix = '',
  xTickFormat,
  yTickCount = 4,
}: LineChartProps) {
  if (data.length === 0) {
    return (
      <View style={{ width, height, alignItems: 'center', justifyContent: 'center' }}>
        <Text className="text-sm text-text-muted">No data</Text>
      </View>
    );
  }

  const padLeft = showAxes ? 48 : 4;
  const padRight = 12;
  const padTop = 12;
  const padBottom = showAxes ? 28 : 8;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const ys = data.map((d) => d.y);
  let yMin = Math.min(...ys);
  let yMax = Math.max(...ys);
  if (yMin === yMax) {
    yMin -= 1;
    yMax += 1;
  }
  const yRange = yMax - yMin;

  const n = data.length;
  const xScale = (i: number) => padLeft + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const yScale = (v: number) => padTop + plotH - ((v - yMin) / yRange) * plotH;

  const points = data.map((d, i) => `${xScale(i)},${yScale(d.y)}`).join(' ');

  // Y axis ticks
  const yTicks: number[] = [];
  for (let i = 0; i <= yTickCount; i++) {
    yTicks.push(yMin + (yRange * i) / yTickCount);
  }

  return (
    <View>
      <Svg width={width} height={height}>
        {/* Y axis grid + labels */}
        {showAxes &&
          yTicks.map((t, i) => {
            const y = yScale(t);
            return (
              <React.Fragment key={`y${i}`}>
                <Line x1={padLeft} y1={y} x2={width - padRight} y2={y} stroke="#E2E8F0" strokeWidth={1} />
                <SvgText x={padLeft - 6} y={y + 3} fontSize={10} fill="#64748B" textAnchor="end">
                  {yLabelPrefix}
                  {Math.round(t).toLocaleString('en-IN')}
                </SvgText>
              </React.Fragment>
            );
          })}

        {/* X axis labels */}
        {showAxes &&
          data.map((d, i) => {
            const label = xTickFormat ? xTickFormat(d.x, i) : String(d.x);
            const shouldShow = n <= 8 || i % Math.ceil(n / 6) === 0;
            if (!shouldShow) return null;
            return (
              <SvgText key={`x${i}`} x={xScale(i)} y={height - 8} fontSize={9} fill="#64748B" textAnchor="middle">
                {label}
              </SvgText>
            );
          })}

        {/* Main line */}
        <Polyline points={points} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />

        {/* Dots */}
        {showDots &&
          data.map((d, i) => (
            <Circle key={`d${i}`} cx={xScale(i)} cy={yScale(d.y)} r={3} fill={color} />
          ))}
      </Svg>
    </View>
  );
}

/** Compact sparkline (no axes, inline). */
export function Sparkline({
  data,
  width = 120,
  height = 32,
  color = '#1E3A5F',
}: {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
}) {
  if (data.length === 0) return null;
  const pad = 3;
  const plotW = width - pad * 2;
  const plotH = height - pad * 2;
  const ys = data;
  let yMin = Math.min(...ys);
  let yMax = Math.max(...ys);
  if (yMin === yMax) {
    yMin -= 1;
    yMax += 1;
  }
  const yRange = yMax - yMin;
  const n = data.length;
  const xScale = (i: number) => pad + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const yScale = (v: number) => pad + plotH - ((v - yMin) / yRange) * plotH;
  const points = data.map((v, i) => `${xScale(i)},${yScale(v)}`).join(' ');

  return (
    <Svg width={width} height={height}>
      <Polyline points={points} fill="none" stroke={color} strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" />
    </Svg>
  );
}