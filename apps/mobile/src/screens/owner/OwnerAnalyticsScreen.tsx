import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Settings } from 'lucide-react-native';
import { AppHeader } from '../../components/AppHeader';
import { EmptyState } from '../../components/EmptyState';
import { PrimaryButton } from '../../components/Buttons';
import { colors, radius, space, typography } from '../../constants/theme';
import Svg, {
  Circle,
  Defs,
  G,
  Line,
  LinearGradient,
  Path,
  Rect,
  Stop,
  Text as SvgText
} from 'react-native-svg';
import { analyticsService } from '../../services/analytics.service';
import {
  AnalyticsChartType,
  AnalyticsMetric,
  AnalyticsPeriod,
  OwnerAnalyticsData,
  SalonOwnerData
} from '../../types';

interface OwnerAnalyticsScreenProps {
  token: string | null;
  salon: SalonOwnerData | null;
  onSettings: () => void;
}

const VIOLET = {
  primary: colors.gold,
  secondary: colors.goldDark,
  deep: colors.espresso,
  lightBg: colors.goldLight,
  surface: colors.surfaceWarm,
  white: colors.surface,
  textMain: colors.ink,
  textSecondary: colors.muted,
  border: colors.border,
  borderLight: colors.borderLight,
  success: colors.success,
  warning: colors.warning,
  danger: colors.danger
};

const CHART_TYPES: { key: AnalyticsChartType; label: string; icon: string }[] = [
  { key: 'LINE', label: 'Line', icon: '📈' },
  { key: 'STACKED_BAR', label: 'Stacked Bar', icon: '📊' },
  { key: 'DONUT', label: 'Donut', icon: '🍩' },
  { key: 'PIE', label: 'Pie', icon: '🥧' },
  { key: 'AREA', label: 'Area', icon: '📉' },
  { key: 'CANDLESTICK', label: 'Candlestick', icon: '🕯️' },
  { key: 'HISTOGRAM', label: 'Histogram', icon: '📶' }
];

const PERIODS: { key: AnalyticsPeriod; label: string }[] = [
  { key: 'daily', label: 'Daily' },
  { key: 'weekly', label: 'Weekly' },
  { key: 'monthly', label: 'Monthly' },
  { key: 'yearly', label: 'Yearly' }
];

const METRICS: { key: AnalyticsMetric; label: string }[] = [
  { key: 'TOTAL_BOOKINGS', label: 'Total Bookings' },
  { key: 'GROSS_VALUE', label: 'Gross Value (₹)' },
  { key: 'COMPLETED_BOOKINGS', label: 'Completed' },
  { key: 'CANCELLED_BOOKINGS', label: 'Cancelled' }
];

export function OwnerAnalyticsScreen({ token, salon, onSettings }: OwnerAnalyticsScreenProps) {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();

  const [period, setPeriod] = useState<AnalyticsPeriod>('weekly');
  const [currentDate, setCurrentDate] = useState<string | undefined>(undefined);
  const [chartType, setChartType] = useState<AnalyticsChartType>('LINE');
  const [metric, setMetric] = useState<AnalyticsMetric>('TOTAL_BOOKINGS');

  const [data, setData] = useState<OwnerAnalyticsData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Selected tooltip node in charts
  const [selectedNodeIndex, setSelectedNodeIndex] = useState<number | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Fetch analytics data from backend
  const loadAnalytics = useCallback(
    async (targetPeriod: AnalyticsPeriod, targetDate?: string, isRefresh = false) => {
      if (!token) {
        setError('Authentication token missing. Please sign in again.');
        setLoading(false);
        setRefreshing(false);
        return;
      }

      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      try {
        const res = await analyticsService.getOwnerAnalytics(token, targetPeriod, targetDate);
        setData(res);
        setSelectedNodeIndex(null);
        setSelectedCategory(null);
      } catch (err: unknown) {
        setError(
          err instanceof Error ? err.message : 'Failed to load salon analytics. Please retry.'
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token]
  );

  useEffect(() => {
    void loadAnalytics(period, currentDate);
  }, [period, currentDate, loadAnalytics]);

  const handlePeriodChange = (newPeriod: AnalyticsPeriod) => {
    if (newPeriod === period) return;
    setPeriod(newPeriod);
    setCurrentDate(undefined); // Reset to current window for the new period
  };

  const handlePrev = () => {
    if (data?.previousDate) {
      setCurrentDate(data.previousDate);
    }
  };

  const handleNext = () => {
    if (data?.nextDate) {
      setCurrentDate(data.nextDate);
    }
  };

  const handleResetToday = () => {
    setCurrentDate(undefined);
  };

  // Chart width calculation (responsive with margin)
  const chartWidth = Math.max(240, windowWidth - 64);
  const chartHeight = 220;

  // Extract timeline values based on selected metric
  const timelineValues = useMemo(() => {
    if (!data?.timeline) return [];
    return data.timeline.map((bucket) => {
      switch (metric) {
        case 'GROSS_VALUE':
          return bucket.grossBookingValue;
        case 'COMPLETED_BOOKINGS':
          return bucket.completedBookings;
        case 'CANCELLED_BOOKINGS':
          return bucket.cancelledBookings;
        case 'TOTAL_BOOKINGS':
        default:
          return bucket.totalBookings;
      }
    });
  }, [data?.timeline, metric]);

  // Format currency helper
  const fmtCurrency = (val: number) => `₹${val.toLocaleString('en-IN')}`;

  return (
    <View style={styles.root}>
      <AppHeader
        title="Salon Analytics"
        subtitle={salon?.salonName || data?.salonName || 'Your Salon'}
        rightElement={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open settings"
            onPress={onSettings}
            hitSlop={8}
            style={styles.settingsButton}
          >
            <Settings size={20} color={colors.espresso} />
          </Pressable>
        }
      />

      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void loadAnalytics(period, currentDate, true)}
            tintColor={colors.gold}
            colors={[colors.gold]}
          />
        }
      >
        {/* 2. Period Selector (Daily / Weekly / Monthly / Yearly) */}
        <View style={styles.periodRow}>
          {PERIODS.map((p) => {
            const isActive = period === p.key;
            return (
              <Pressable
                key={p.key}
                accessibilityRole="button"
                accessibilityLabel={`Select ${p.label} view`}
                onPress={() => handlePeriodChange(p.key)}
                style={[styles.periodTab, isActive && styles.periodTabActive]}
              >
                <Text style={[styles.periodTabText, isActive && styles.periodTabTextActive]}>
                  {p.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* 3. Date Navigation Bar */}
        <View style={styles.navBar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Previous period"
            onPress={handlePrev}
            style={({ pressed }) => [styles.navArrow, pressed && styles.pressed]}
          >
            <Text style={styles.navArrowText}>‹</Text>
          </Pressable>

          <View style={styles.navLabelWrap}>
            <Text style={styles.navLabel}>
              {loading && !data ? 'Loading range...' : data?.periodLabel || 'Current Period'}
            </Text>
            {currentDate && (
              <Pressable onPress={handleResetToday} style={styles.todayChip}>
                <Text style={styles.todayChipText}>Reset to Current</Text>
              </Pressable>
            )}
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Next period"
            onPress={handleNext}
            style={({ pressed }) => [styles.navArrow, pressed && styles.pressed]}
          >
            <Text style={styles.navArrowText}>›</Text>
          </Pressable>
        </View>

        {/* Loading Indicator */}
        {loading && !refreshing && (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color={colors.gold} />
            <Text style={styles.loadingText}>Fetching authoritative performance data...</Text>
          </View>
        )}

        {/* Error State */}
        {!loading && error && (
          <View style={styles.errorBox}>
            <EmptyState
              icon="!"
              title="Analytics Unavailable"
              body={error}
            />
            <PrimaryButton
              label="Retry Fetch"
              onPress={() => void loadAnalytics(period, currentDate)}
              style={styles.retryBtn}
            />
          </View>
        )}

        {/* Content Section */}
        {!loading && !error && data && (
          <>
            {/* 4. Performance Summary Cards */}
            <View style={styles.summaryGrid}>
              {/* Total Bookings */}
              <View style={styles.summaryCard}>
                <View style={styles.summaryHeader}>
                  <Text style={styles.summaryLabel}>Total Bookings</Text>
                  <Text style={styles.summaryIcon}>📋</Text>
                </View>
                <Text style={styles.summaryValue}>{data.summary.totalBookings}</Text>
                <Text style={styles.summarySub}>
                  {data.summary.completedBookings} completed · {data.summary.confirmedBookings} confirmed
                </Text>
              </View>

              {/* Gross Booking Value */}
              <View style={styles.summaryCard}>
                <View style={styles.summaryHeader}>
                  <Text style={styles.summaryLabel}>Gross Booking Value</Text>
                  <Text style={styles.summaryIcon}>💳</Text>
                </View>
                <Text style={styles.summaryValue}>{fmtCurrency(data.summary.grossBookingValue)}</Text>
                <Text style={styles.summarySub}>
                  Avg {fmtCurrency(data.summary.averageBookingValue)} / booking
                </Text>
              </View>

              {/* Completed Booking Value */}
              <View style={styles.summaryCard}>
                <View style={styles.summaryHeader}>
                  <Text style={styles.summaryLabel}>Completed Value</Text>
                  <Text style={styles.summaryIcon}>✅</Text>
                </View>
                <Text style={[styles.summaryValue, { color: colors.success }]}>
                  {fmtCurrency(data.summary.completedBookingValue)}
                </Text>
                <Text style={styles.summarySub}>{data.summary.completedBookings} appointments served</Text>
              </View>

              {/* Cancelled / Rejected */}
              <View style={styles.summaryCard}>
                <View style={styles.summaryHeader}>
                  <Text style={styles.summaryLabel}>Cancelled / Rejected</Text>
                  <Text style={styles.summaryIcon}>❌</Text>
                </View>
                <Text style={[styles.summaryValue, { color: colors.danger }]}>
                  {data.summary.cancelledBookings}
                </Text>
                <Text style={styles.summarySub}>
                  {data.summary.pendingBookings} pending approval
                </Text>
              </View>

              {/* Recorded Online Revenue */}
              <View style={[styles.summaryCard, styles.summaryCardFull]}>
                <View style={styles.summaryHeader}>
                  <Text style={styles.summaryLabel}>Online Recorded Revenue</Text>
                  <Text style={styles.badgeOffline}>Settled In-Salon</Text>
                </View>
                <Text style={styles.summaryValue}>{fmtCurrency(data.summary.recordedRevenue)}</Text>
                <Text style={styles.summarySubNote}>{data.summary.recordedRevenueNote}</Text>
              </View>
            </View>

            {/* 5. Chart Controls */}
            <View style={styles.chartControlSection}>
              <Text style={styles.sectionHeading}>Performance Visualizer</Text>

              {/* Chart Type Selector Pills */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chartTypeScroll}
              >
                {CHART_TYPES.map((ct) => {
                  const isActive = chartType === ct.key;
                  return (
                    <Pressable
                      key={ct.key}
                      onPress={() => {
                        setChartType(ct.key);
                        setSelectedNodeIndex(null);
                      }}
                      style={[styles.chartTypePill, isActive && styles.chartTypePillActive]}
                    >
                      <Text style={styles.chartTypeIcon}>{ct.icon}</Text>
                      <Text
                        style={[
                          styles.chartTypePillText,
                          isActive && styles.chartTypePillTextActive
                        ]}
                      >
                        {ct.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              {/* Metric Selector (when in Line, Area, or Stacked Bar mode) */}
              {(chartType === 'LINE' || chartType === 'AREA') && (
                <View style={styles.metricRow}>
                  {METRICS.map((m) => {
                    const isMActive = metric === m.key;
                    return (
                      <Pressable
                        key={m.key}
                        onPress={() => {
                          setMetric(m.key);
                          setSelectedNodeIndex(null);
                        }}
                        style={[styles.metricChip, isMActive && styles.metricChipActive]}
                      >
                        <Text
                          style={[
                            styles.metricChipText,
                            isMActive && styles.metricChipTextActive
                          ]}
                        >
                          {m.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </View>

            {/* 6. Main Interactive Chart Display */}
            <View style={styles.chartCard}>
              {/* Tooltip Header if a node/category is selected */}
              {selectedNodeIndex !== null && data.timeline[selectedNodeIndex] && (
                <View style={styles.activeTooltipBox}>
                  <Text style={styles.tooltipTitle}>
                    {data.timeline[selectedNodeIndex].label} · {data.timeline[selectedNodeIndex].fullDate}
                  </Text>
                  <Text style={styles.tooltipMetric}>
                    {metric === 'GROSS_VALUE'
                      ? fmtCurrency(data.timeline[selectedNodeIndex].grossBookingValue)
                      : `${data.timeline[selectedNodeIndex].totalBookings} Total Bookings`}
                    {'  '}({data.timeline[selectedNodeIndex].completedBookings} Completed,{' '}
                    {data.timeline[selectedNodeIndex].confirmedBookings} Confirmed)
                  </Text>
                </View>
              )}

              {/* Chart Rendering Switch */}
              {renderChart({
                chartType,
                data,
                metric,
                timelineValues,
                chartWidth,
                chartHeight,
                selectedNodeIndex,
                onSelectNode: (idx) => setSelectedNodeIndex(idx === selectedNodeIndex ? null : idx),
                selectedCategory,
                onSelectCategory: (cat) => setSelectedCategory(cat === selectedCategory ? null : cat)
              })}
            </View>

            {/* 7. Status & Service Breakdown Highlights */}
            <View style={styles.breakdownCard}>
              <Text style={styles.breakdownTitle}>Booking Status Reconciled Distribution</Text>
              <Text style={styles.breakdownSubtitle}>
                Total authoritative records: {data.summary.totalBookings} bookings
              </Text>
              <View style={styles.statusLegendList}>
                {data.statusBreakdown.map((item) => (
                  <View key={item.status} style={styles.statusLegendItem}>
                    <View style={[styles.statusDot, { backgroundColor: item.color }]} />
                    <View style={styles.statusLegendDetails}>
                      <Text style={styles.statusLegendName}>{item.label}</Text>
                      <Text style={styles.statusLegendCount}>
                        {item.count} ({item.percentage}%)
                      </Text>
                    </View>
                    <Text style={styles.statusLegendValue}>{fmtCurrency(item.value)}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Top Services Breakdown */}
            {data.serviceBreakdown.length > 0 && (
              <View style={styles.breakdownCard}>
                <Text style={styles.breakdownTitle}>Service Category Demand</Text>
                <View style={styles.serviceList}>
                  {data.serviceBreakdown.map((s, idx) => (
                    <View key={idx} style={styles.serviceItem}>
                      <View style={styles.serviceMeta}>
                        <Text style={styles.serviceName}>{s.serviceName}</Text>
                        <Text style={styles.serviceCount}>{s.count} bookings ({s.percentage}%)</Text>
                      </View>
                      <Text style={styles.serviceRevenue}>{fmtCurrency(s.revenue)}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

// ========================================================
// CHART RENDERERS (Clean, Pure SVG, Zero External Library)
// ========================================================

interface ChartRenderProps {
  chartType: AnalyticsChartType;
  data: OwnerAnalyticsData;
  metric: AnalyticsMetric;
  timelineValues: number[];
  chartWidth: number;
  chartHeight: number;
  selectedNodeIndex: number | null;
  onSelectNode: (idx: number) => void;
  selectedCategory: string | null;
  onSelectCategory: (cat: string) => void;
}

function renderChart(props: ChartRenderProps) {
  const { chartType, data } = props;

  switch (chartType) {
    case 'LINE':
      return <LineChartView {...props} isArea={false} />;
    case 'AREA':
      return <LineChartView {...props} isArea={true} />;
    case 'STACKED_BAR':
      return <StackedBarChartView {...props} />;
    case 'DONUT':
      return <PieOrDonutChartView {...props} isDonut={true} />;
    case 'PIE':
      return <PieOrDonutChartView {...props} isDonut={false} />;
    case 'CANDLESTICK':
      return <CandlestickChartView {...props} />;
    case 'HISTOGRAM':
      return <HistogramChartView {...props} />;
    default:
      return null;
  }
}

// ----------------------------------------------------
// 1 & 5. LINE & AREA CHART
// ----------------------------------------------------
function LineChartView({
  data,
  timelineValues,
  chartWidth,
  chartHeight,
  selectedNodeIndex,
  onSelectNode,
  isArea
}: ChartRenderProps & { isArea: boolean }) {
  const paddingLeft = 40;
  const paddingRight = 20;
  const paddingTop = 20;
  const paddingBottom = 35;

  const innerW = chartWidth - paddingLeft - paddingRight;
  const innerH = chartHeight - paddingTop - paddingBottom;

  const pointsCount = timelineValues.length;
  if (pointsCount === 0) {
    return <EmptyChartNotice message="No data points in this timeline." />;
  }

  const maxVal = Math.max(...timelineValues, 1);
  const minVal = 0;
  const range = maxVal - minVal;

  // Compute (x, y) coordinates for each point
  const points = timelineValues.map((val, idx) => {
    const x = paddingLeft + (pointsCount > 1 ? (idx / (pointsCount - 1)) * innerW : innerW / 2);
    const y = paddingTop + innerH - ((val - minVal) / range) * innerH;
    return { x, y, val, bucket: data.timeline[idx] };
  });

  const pathD = points.reduce((acc, pt, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`, '');
  const areaD = `${pathD} L ${points[points.length - 1].x} ${paddingTop + innerH} L ${points[0].x} ${paddingTop + innerH} Z`;

  // Gridlines (3 lines)
  const gridY = [0, 0.5, 1].map((ratio) => ({
    y: paddingTop + innerH * (1 - ratio),
    label: Math.round(minVal + range * ratio).toString()
  }));

  // Selected node info
  const selectedPt = selectedNodeIndex !== null ? points[selectedNodeIndex] : null;

  return (
    <View style={styles.svgWrap}>
      <Svg width={chartWidth} height={chartHeight}>
        <Defs>
          <LinearGradient id="violetGradient" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={VIOLET.primary} stopOpacity={0.4} />
            <Stop offset="100%" stopColor={VIOLET.primary} stopOpacity={0.02} />
          </LinearGradient>
        </Defs>

        {/* Horizontal Gridlines */}
        {gridY.map((g, idx) => (
          <G key={idx}>
            <Line
              x1={paddingLeft}
              y1={g.y}
              x2={chartWidth - paddingRight}
              y2={g.y}
              stroke={VIOLET.border}
              strokeDasharray="4 4"
              strokeWidth={1}
            />
            <SvgText
              x={paddingLeft - 8}
              y={g.y + 4}
              fontSize="10"
              fill={VIOLET.textSecondary}
              textAnchor="end"
            >
              {g.label}
            </SvgText>
          </G>
        ))}

        {/* Area fill if AREA chart */}
        {isArea && <Path d={areaD} fill="url(#violetGradient)" />}

        {/* Line path */}
        <Path
          d={pathD}
          fill="none"
          stroke={VIOLET.primary}
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Selected vertical crosshair */}
        {selectedPt && (
          <Line
            x1={selectedPt.x}
            y1={paddingTop}
            x2={selectedPt.x}
            y2={paddingTop + innerH}
            stroke={VIOLET.secondary}
            strokeWidth={1.5}
            strokeDasharray="3 3"
          />
        )}

        {/* Data Points */}
        {points.map((pt, idx) => {
          const isSelected = selectedNodeIndex === idx;
          return (
            <G key={idx} onPress={() => onSelectNode(idx)}>
              <Circle
                cx={pt.x}
                cy={pt.y}
                r={isSelected ? 6 : 4}
                fill={isSelected ? VIOLET.deep : VIOLET.white}
                stroke={VIOLET.primary}
                strokeWidth={isSelected ? 3 : 2}
              />
            </G>
          );
        })}

        {/* X Axis Labels (sample spaced labels to prevent overlap) */}
        {points.map((pt, idx) => {
          const step = Math.max(1, Math.floor(points.length / 6));
          if (idx % step !== 0 && idx !== points.length - 1) return null;
          return (
            <SvgText
              key={`lbl-${idx}`}
              x={pt.x}
              y={chartHeight - 10}
              fontSize="10"
              fill={VIOLET.textSecondary}
              textAnchor="middle"
            >
              {pt.bucket.shortLabel || pt.bucket.label}
            </SvgText>
          );
        })}
      </Svg>

      <Text style={styles.chartHint}>Tap any point along the curve to inspect details.</Text>
    </View>
  );
}

// ----------------------------------------------------
// 2. STACKED BAR CHART
// ----------------------------------------------------
function StackedBarChartView({
  data,
  chartWidth,
  chartHeight,
  selectedNodeIndex,
  onSelectNode
}: ChartRenderProps) {
  const paddingLeft = 35;
  const paddingRight = 15;
  const paddingTop = 20;
  const paddingBottom = 35;

  const innerW = chartWidth - paddingLeft - paddingRight;
  const innerH = chartHeight - paddingTop - paddingBottom;

  const buckets = data.timeline;
  if (buckets.length === 0) {
    return <EmptyChartNotice message="No intervals recorded for this period." />;
  }

  const maxTotal = Math.max(...buckets.map((b) => b.totalBookings), 1);
  const barWidth = Math.max(8, Math.min(26, innerW / buckets.length - 4));

  return (
    <View style={styles.svgWrap}>
      <Svg width={chartWidth} height={chartHeight}>
        {/* Gridlines */}
        {[0, 0.5, 1].map((r, i) => {
          const y = paddingTop + innerH * (1 - r);
          const val = Math.round(maxTotal * r);
          return (
            <G key={i}>
              <Line
                x1={paddingLeft}
                y1={y}
                x2={chartWidth - paddingRight}
                y2={y}
                stroke={VIOLET.border}
                strokeDasharray="4 4"
                strokeWidth={1}
              />
              <SvgText
                x={paddingLeft - 6}
                y={y + 4}
                fontSize="10"
                fill={VIOLET.textSecondary}
                textAnchor="end"
              >
                {val}
              </SvgText>
            </G>
          );
        })}

        {/* Stacked Bars */}
        {buckets.map((bucket, idx) => {
          const x = paddingLeft + (idx + 0.5) * (innerW / buckets.length) - barWidth / 2;
          const isSelected = selectedNodeIndex === idx;

          const hComp = (bucket.completedBookings / maxTotal) * innerH;
          const hConf = (bucket.confirmedBookings / maxTotal) * innerH;
          const hPend = (bucket.pendingBookings / maxTotal) * innerH;
          const hCanc = (bucket.cancelledBookings / maxTotal) * innerH;

          let currentY = paddingTop + innerH;

          // Segment 1: Completed
          const yComp = currentY - hComp;
          currentY = yComp;

          // Segment 2: Confirmed
          const yConf = currentY - hConf;
          currentY = yConf;

          // Segment 3: Pending
          const yPend = currentY - hPend;
          currentY = yPend;

          // Segment 4: Cancelled
          const yCanc = currentY - hCanc;

          return (
            <G key={idx} onPress={() => onSelectNode(idx)}>
              {/* Highlight background column if selected */}
              {isSelected && (
                <Rect
                  x={x - 4}
                  y={paddingTop}
                  width={barWidth + 8}
                  height={innerH}
                  fill={VIOLET.lightBg}
                  rx={4}
                />
              )}

              {/* Stacked segments */}
              {hComp > 0 && (
                <Rect x={x} y={yComp} width={barWidth} height={hComp} fill={VIOLET.success} />
              )}
              {hConf > 0 && (
                <Rect x={x} y={yConf} width={barWidth} height={hConf} fill={VIOLET.primary} />
              )}
              {hPend > 0 && (
                <Rect x={x} y={yPend} width={barWidth} height={hPend} fill={VIOLET.warning} />
              )}
              {hCanc > 0 && (
                <Rect x={x} y={yCanc} width={barWidth} height={hCanc} fill={VIOLET.danger} />
              )}

              {/* Total label if non-zero */}
              {bucket.totalBookings > 0 && (
                <SvgText
                  x={x + barWidth / 2}
                  y={yCanc - 4}
                  fontSize="9"
                  fill={VIOLET.textMain}
                  textAnchor="middle"
                  fontWeight="600"
                >
                  {bucket.totalBookings}
                </SvgText>
              )}

              {/* X Axis Label */}
              <SvgText
                x={x + barWidth / 2}
                y={chartHeight - 10}
                fontSize="9"
                fill={VIOLET.textSecondary}
                textAnchor="middle"
              >
                {bucket.shortLabel || bucket.label}
              </SvgText>
            </G>
          );
        })}
      </Svg>

      {/* Legend below */}
      <View style={styles.chartLegendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: VIOLET.success }]} />
          <Text style={styles.legendText}>Completed</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: VIOLET.primary }]} />
          <Text style={styles.legendText}>Confirmed</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: VIOLET.warning }]} />
          <Text style={styles.legendText}>Pending</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: VIOLET.danger }]} />
          <Text style={styles.legendText}>Cancelled</Text>
        </View>
      </View>
    </View>
  );
}

// ----------------------------------------------------
// 3 & 4. DONUT & PIE CHARTS
// ----------------------------------------------------
function PieOrDonutChartView({
  data,
  chartWidth,
  isDonut,
  selectedCategory,
  onSelectCategory
}: ChartRenderProps & { isDonut: boolean }) {
  const total = data.summary.totalBookings;
  if (total === 0) {
    return <EmptyChartNotice message="No bookings in this period to create a categorical chart." />;
  }

  const size = Math.min(chartWidth, 220);
  const cx = size / 2;
  const cy = size / 2;
  const outerRadius = size / 2 - 12;
  const innerRadius = isDonut ? outerRadius * 0.58 : 0;

  // Filter items with positive count
  const slices = data.statusBreakdown.filter((s) => s.count > 0);

  let startAngle = -Math.PI / 2;

  const slicePaths = slices.map((slice) => {
    const angle = (slice.count / total) * 2 * Math.PI;
    const endAngle = startAngle + angle;

    const x1 = cx + outerRadius * Math.cos(startAngle);
    const y1 = cy + outerRadius * Math.sin(startAngle);
    const x2 = cx + outerRadius * Math.cos(endAngle);
    const y2 = cy + outerRadius * Math.sin(endAngle);

    const largeArc = angle > Math.PI ? 1 : 0;

    let d: string;
    if (isDonut) {
      const ix1 = cx + innerRadius * Math.cos(endAngle);
      const iy1 = cy + innerRadius * Math.sin(endAngle);
      const ix2 = cx + innerRadius * Math.cos(startAngle);
      const iy2 = cy + innerRadius * Math.sin(startAngle);

      d = `M ${x1} ${y1} A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${x2} ${y2} L ${ix1} ${iy1} A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${ix2} ${iy2} Z`;
    } else {
      d = `M ${cx} ${cy} L ${x1} ${y1} A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${x2} ${y2} Z`;
    }

    startAngle = endAngle;
    return { ...slice, d };
  });

  return (
    <View style={styles.pieWrap}>
      <Svg width={size} height={size}>
        {slicePaths.map((slice) => {
          const isSelected = selectedCategory === slice.status;
          return (
            <Path
              key={slice.status}
              d={slice.d}
              fill={slice.color}
              stroke={VIOLET.white}
              strokeWidth={2}
              opacity={isSelected ? 1 : 0.9}
              onPress={() => onSelectCategory(slice.status)}
            />
          );
        })}

        {/* Center text for donut */}
        {isDonut && (
          <G>
            <SvgText
              x={cx}
              y={cy - 4}
              fontSize="20"
              fontWeight="700"
              fill={VIOLET.textMain}
              textAnchor="middle"
            >
              {total}
            </SvgText>
            <SvgText
              x={cx}
              y={cy + 14}
              fontSize="10"
              fill={VIOLET.textSecondary}
              textAnchor="middle"
            >
              BOOKINGS
            </SvgText>
          </G>
        )}
      </Svg>

      {/* Categorical breakdown pills */}
      <View style={styles.pieLegendGrid}>
        {slices.map((slice) => {
          const isSelected = selectedCategory === slice.status;
          return (
            <Pressable
              key={slice.status}
              onPress={() => onSelectCategory(slice.status)}
              style={[styles.piePill, isSelected && styles.piePillActive]}
            >
              <View style={[styles.legendDot, { backgroundColor: slice.color }]} />
              <Text style={styles.piePillLabel}>{slice.label}</Text>
              <Text style={styles.piePillValue}>
                {slice.count} ({slice.percentage}%)
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// ----------------------------------------------------
// 6. CANDLESTICK CHART
// ----------------------------------------------------
function CandlestickChartView({ data, chartWidth, chartHeight }: ChartRenderProps) {
  if (!data.candlestick.hasSufficientData) {
    return (
      <View style={styles.explanationBox}>
        <Text style={styles.explanationIcon}>🕯️</Text>
        <Text style={styles.explanationTitle}>Candlestick Chart Unavailable</Text>
        <Text style={styles.explanationMsg}>
          {data.candlestick.reason ||
            'Candlestick OHLC requires at least 2 distinct time intervals with priced booking transactions. The current period has insufficient interval data.'}
        </Text>
        <Text style={styles.explanationAdvice}>
          💡 Tip: Switch to a Weekly or Monthly period with multiple scheduled appointments to observe interval price variations.
        </Text>
      </View>
    );
  }

  const candles = data.candlestick.data;
  const paddingLeft = 45;
  const paddingRight = 20;
  const paddingTop = 20;
  const paddingBottom = 35;

  const innerW = chartWidth - paddingLeft - paddingRight;
  const innerH = chartHeight - paddingTop - paddingBottom;

  const maxVal = Math.max(...candles.map((c) => c.high), 1);
  const minVal = Math.max(0, Math.min(...candles.map((c) => c.low)) * 0.9);
  const range = maxVal - minVal || 1;

  const candleW = Math.max(10, Math.min(22, innerW / candles.length - 6));

  const scaleY = (v: number) => paddingTop + innerH - ((v - minVal) / range) * innerH;

  return (
    <View style={styles.svgWrap}>
      <Svg width={chartWidth} height={chartHeight}>
        {/* Y-axis gridlines */}
        {[0, 0.5, 1].map((r, i) => {
          const y = paddingTop + innerH * (1 - r);
          const val = Math.round(minVal + range * r);
          return (
            <G key={i}>
              <Line
                x1={paddingLeft}
                y1={y}
                x2={chartWidth - paddingRight}
                y2={y}
                stroke={VIOLET.border}
                strokeDasharray="4 4"
                strokeWidth={1}
              />
              <SvgText
                x={paddingLeft - 6}
                y={y + 4}
                fontSize="10"
                fill={VIOLET.textSecondary}
                textAnchor="end"
              >
                ₹{val}
              </SvgText>
            </G>
          );
        })}

        {/* Candles */}
        {candles.map((c, idx) => {
          const cx = paddingLeft + (idx + 0.5) * (innerW / candles.length);
          const yHigh = scaleY(c.high);
          const yLow = scaleY(c.low);
          const yOpen = scaleY(c.open);
          const yClose = scaleY(c.close);

          const isGain = c.close >= c.open;
          const bodyY = Math.min(yOpen, yClose);
          const bodyH = Math.max(3, Math.abs(yClose - yOpen));
          const color = isGain ? VIOLET.success : VIOLET.danger;

          return (
            <G key={idx}>
              {/* Wick */}
              <Line x1={cx} y1={yHigh} x2={cx} y2={yLow} stroke={color} strokeWidth={1.5} />
              {/* Body */}
              <Rect
                x={cx - candleW / 2}
                y={bodyY}
                width={candleW}
                height={bodyH}
                fill={color}
                rx={1}
              />
              {/* X Axis Label */}
              <SvgText
                x={cx}
                y={chartHeight - 10}
                fontSize="9"
                fill={VIOLET.textSecondary}
                textAnchor="middle"
              >
                {c.interval}
              </SvgText>
            </G>
          );
        })}
      </Svg>

      <View style={styles.chartLegendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: VIOLET.success }]} />
          <Text style={styles.legendText}>Close ≥ Open</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: VIOLET.danger }]} />
          <Text style={styles.legendText}>Close &lt; Open</Text>
        </View>
      </View>
    </View>
  );
}

// ----------------------------------------------------
// 7. HISTOGRAM CHART (Value Frequency Distribution)
// ----------------------------------------------------
function HistogramChartView({ data, chartWidth, chartHeight }: ChartRenderProps) {
  if (!data.histogram.hasData || data.histogram.bins.length === 0) {
    return (
      <View style={styles.explanationBox}>
        <Text style={styles.explanationIcon}>📶</Text>
        <Text style={styles.explanationTitle}>Histogram Unavailable</Text>
        <Text style={styles.explanationMsg}>
          {data.histogram.reason ||
            'No booking transactions with valid prices exist in this period to construct a numerical frequency distribution.'}
        </Text>
      </View>
    );
  }

  const bins = data.histogram.bins;
  const paddingLeft = 35;
  const paddingRight = 15;
  const paddingTop = 25;
  const paddingBottom = 40;

  const innerW = chartWidth - paddingLeft - paddingRight;
  const innerH = chartHeight - paddingTop - paddingBottom;

  const maxCount = Math.max(...bins.map((b) => b.count), 1);
  const barW = Math.max(20, Math.min(50, innerW / bins.length - 8));

  return (
    <View style={styles.svgWrap}>
      <Svg width={chartWidth} height={chartHeight}>
        {/* Y Axis Gridlines */}
        {[0, 0.5, 1].map((r, i) => {
          const y = paddingTop + innerH * (1 - r);
          const val = Math.round(maxCount * r);
          return (
            <G key={i}>
              <Line
                x1={paddingLeft}
                y1={y}
                x2={chartWidth - paddingRight}
                y2={y}
                stroke={VIOLET.border}
                strokeDasharray="4 4"
                strokeWidth={1}
              />
              <SvgText
                x={paddingLeft - 6}
                y={y + 4}
                fontSize="10"
                fill={VIOLET.textSecondary}
                textAnchor="end"
              >
                {val}
              </SvgText>
            </G>
          );
        })}

        {/* Histogram Frequency Bars */}
        {bins.map((bin, idx) => {
          const cx = paddingLeft + (idx + 0.5) * (innerW / bins.length);
          const barH = (bin.count / maxCount) * innerH;
          const y = paddingTop + innerH - barH;

          return (
            <G key={bin.binKey}>
              <Rect
                x={cx - barW / 2}
                y={y}
                width={barW}
                height={barH}
                fill={VIOLET.primary}
                rx={4}
              />

              {/* Count on top */}
              {bin.count > 0 && (
                <SvgText
                  x={cx}
                  y={y - 6}
                  fontSize="11"
                  fontWeight="700"
                  fill={VIOLET.deep}
                  textAnchor="middle"
                >
                  {bin.count}
                </SvgText>
              )}

              {/* Price bracket label */}
              <SvgText
                x={cx}
                y={chartHeight - 12}
                fontSize="9"
                fill={VIOLET.textSecondary}
                textAnchor="middle"
              >
                {bin.label}
              </SvgText>
            </G>
          );
        })}
      </Svg>

      <Text style={styles.chartHint}>
        Distribution of booking transaction prices across brackets ({bins.reduce((a, b) => a + b.count, 0)} total).
      </Text>
    </View>
  );
}

function EmptyChartNotice({ message }: { message: string }) {
  return (
    <View style={styles.emptyChartBox}>
      <Text style={styles.emptyChartIcon}>📭</Text>
      <Text style={styles.emptyChartMsg}>{message}</Text>
    </View>
  );
}

// ========================================================
// Styles follow the shared app theme; chart colors use its semantic palette.
// ========================================================

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background
  },
  container: {
    flex: 1,
    backgroundColor: colors.background
  },
  content: {
    padding: space.lg,
    paddingBottom: space.xxl
  },
  pressed: {
    opacity: 0.7
  },
  settingsButton: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border
  },

  // Period Selector Row
  periodRow: {
    flexDirection: 'row',
    backgroundColor: VIOLET.lightBg,
    borderRadius: radius.md,
    padding: space.xs,
    marginBottom: space.md
  },
  periodTab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center'
  },
  periodTabActive: {
    backgroundColor: VIOLET.white,
    shadowColor: VIOLET.deep,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2
  },
  periodTabText: {
    ...typography.bodySmall,
    fontWeight: '600',
    color: VIOLET.textSecondary
  },
  periodTabTextActive: {
    color: VIOLET.primary,
    fontWeight: '700'
  },

  // Date Nav Bar
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: VIOLET.surface,
    borderWidth: 1,
    borderColor: VIOLET.border,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    marginBottom: space.lg
  },
  navArrow: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: VIOLET.white,
    borderWidth: 1,
    borderColor: VIOLET.border,
    alignItems: 'center',
    justifyContent: 'center'
  },
  navArrowText: {
    fontSize: 24,
    color: VIOLET.primary,
    lineHeight: 26,
    fontWeight: '600'
  },
  navLabelWrap: {
    alignItems: 'center'
  },
  navLabel: {
    ...typography.body,
    fontWeight: '700',
    color: VIOLET.textMain
  },
  todayChip: {
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: VIOLET.lightBg,
    borderRadius: radius.xs
  },
  todayChipText: {
    fontSize: 10,
    color: VIOLET.primary,
    fontWeight: '600'
  },

  // Summary Grid
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: space.lg
  },
  summaryCard: {
    width: '48.5%',
    backgroundColor: VIOLET.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: VIOLET.border,
    padding: space.md,
    marginBottom: space.sm,
    shadowColor: colors.espresso,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1
  },
  summaryCardFull: {
    width: '100%'
  },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6
  },
  summaryLabel: {
    ...typography.bodySmall,
    fontWeight: '600',
    color: VIOLET.textSecondary
  },
  summaryIcon: {
    fontSize: 14
  },
  summaryValue: {
    ...typography.displayMedium,
    fontWeight: '700',
    color: VIOLET.textMain,
    marginBottom: 4
  },
  summarySub: {
    ...typography.caption,
    color: VIOLET.textSecondary
  },
  summarySubNote: {
    ...typography.caption,
    color: VIOLET.textSecondary,
    fontStyle: 'italic',
    marginTop: 2
  },
  badgeOffline: {
    ...typography.caption,
    fontWeight: '700',
    color: VIOLET.primary,
    backgroundColor: VIOLET.lightBg,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6
  },

  // Chart Controls
  chartControlSection: {
    marginBottom: 10
  },
  sectionHeading: {
    ...typography.titleSmall,
    fontWeight: '700',
    color: VIOLET.textMain,
    marginBottom: 8
  },
  chartTypeScroll: {
    paddingVertical: 4,
    gap: 8
  },
  chartTypePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    backgroundColor: VIOLET.surface,
    borderWidth: 1,
    borderColor: VIOLET.border,
    marginRight: 6
  },
  chartTypePillActive: {
    backgroundColor: VIOLET.primary,
    borderColor: VIOLET.primary
  },
  chartTypeIcon: {
    fontSize: 13,
    marginRight: 6
  },
  chartTypePillText: {
    ...typography.bodySmall,
    fontWeight: '600',
    color: VIOLET.textMain
  },
  chartTypePillTextActive: {
    color: VIOLET.white,
    fontWeight: '700'
  },
  metricRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10
  },
  metricChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.sm,
    backgroundColor: VIOLET.white,
    borderWidth: 1,
    borderColor: VIOLET.borderLight
  },
  metricChipActive: {
    backgroundColor: VIOLET.lightBg,
    borderColor: VIOLET.secondary
  },
  metricChipText: {
    ...typography.caption,
    fontWeight: '500',
    color: VIOLET.textSecondary
  },
  metricChipTextActive: {
    color: VIOLET.primary,
    fontWeight: '700'
  },

  // Main Chart Card
  chartCard: {
    backgroundColor: VIOLET.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: VIOLET.border,
    padding: space.md,
    marginBottom: space.lg,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.espresso,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2
  },
  svgWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%'
  },
  chartHint: {
    ...typography.caption,
    color: VIOLET.textSecondary,
    fontStyle: 'italic',
    marginTop: 6
  },
  activeTooltipBox: {
    width: '100%',
    padding: space.md,
    borderRadius: radius.sm,
    backgroundColor: VIOLET.lightBg,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: VIOLET.primary
  },
  tooltipTitle: {
    ...typography.bodySmall,
    fontWeight: '700',
    color: VIOLET.deep
  },
  tooltipMetric: {
    ...typography.caption,
    color: VIOLET.textMain,
    marginTop: 2
  },

  // Chart Legends
  chartLegendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
    marginTop: 8
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 5
  },
  legendText: {
    ...typography.caption,
    color: VIOLET.textSecondary,
    fontWeight: '500'
  },

  // Pie & Donut Layout
  pieWrap: {
    alignItems: 'center',
    paddingVertical: 10
  },
  pieLegendGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginTop: 14,
    width: '100%'
  },
  piePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: VIOLET.surface,
    borderWidth: 1,
    borderColor: VIOLET.border
  },
  piePillActive: {
    borderColor: VIOLET.primary,
    backgroundColor: VIOLET.lightBg
  },
  piePillLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: VIOLET.textMain,
    marginRight: 4
  },
  piePillValue: {
    fontSize: 11,
    color: VIOLET.textSecondary
  },

  // Explanation & Empty States
  explanationBox: {
    alignItems: 'center',
    padding: space.xl
  },
  explanationIcon: {
    fontSize: 32,
    marginBottom: 8
  },
  explanationTitle: {
    ...typography.titleSmall,
    fontWeight: '700',
    color: VIOLET.textMain,
    marginBottom: 6
  },
  explanationMsg: {
    ...typography.bodySmall,
    color: VIOLET.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 8
  },
  explanationAdvice: {
    ...typography.caption,
    color: VIOLET.primary,
    textAlign: 'center',
    lineHeight: 16
  },
  emptyChartBox: {
    padding: 30,
    alignItems: 'center'
  },
  emptyChartIcon: {
    fontSize: 32,
    marginBottom: 8
  },
  emptyChartMsg: {
    ...typography.bodySmall,
    color: VIOLET.textSecondary,
    textAlign: 'center'
  },

  // Breakdown Card
  breakdownCard: {
    backgroundColor: VIOLET.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: VIOLET.border,
    padding: space.lg,
    marginBottom: space.lg
  },
  breakdownTitle: {
    ...typography.body,
    fontWeight: '700',
    color: VIOLET.textMain
  },
  breakdownSubtitle: {
    ...typography.caption,
    color: VIOLET.textSecondary,
    marginBottom: 12,
    marginTop: 2
  },
  statusLegendList: {
    gap: 8
  },
  statusLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: VIOLET.borderLight
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10
  },
  statusLegendDetails: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingRight: space.lg
  },
  statusLegendName: {
    ...typography.bodySmall,
    fontWeight: '600',
    color: VIOLET.textMain
  },
  statusLegendCount: {
    ...typography.bodySmall,
    color: VIOLET.textSecondary
  },
  statusLegendValue: {
    ...typography.bodySmall,
    fontWeight: '600',
    color: VIOLET.textMain
  },
  serviceList: {
    gap: 8,
    marginTop: 8
  },
  serviceItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: VIOLET.borderLight
  },
  serviceMeta: {
    flex: 1
  },
  serviceName: {
    fontSize: 13,
    fontWeight: '600',
    color: VIOLET.textMain
  },
  serviceCount: {
    ...typography.caption,
    color: VIOLET.textSecondary,
    marginTop: 1
  },
  serviceRevenue: {
    ...typography.bodySmall,
    fontWeight: '700',
    color: VIOLET.primary
  },

  // Utility Boxes
  centerBox: {
    padding: space.xxl,
    alignItems: 'center',
    justifyContent: 'center'
  },
  loadingText: {
    marginTop: space.md,
    ...typography.bodySmall,
    color: VIOLET.textSecondary
  },
  errorBox: {
    padding: space.lg,
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginVertical: space.md
  },
  retryBtn: {
    alignSelf: 'stretch',
    marginHorizontal: space.lg,
    marginBottom: space.lg
  }
});
