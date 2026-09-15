import { useEffect, useMemo, useRef } from 'react';
import { Animated, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { BrandMark } from './brand';
import { Skeleton } from './primitives';
import { fontFamily, radius, useAppTheme } from './theme';

type ContentSkeletonVariant = 'cards' | 'dashboard' | 'reports' | 'rows';

export function AppLoadingScreen({ label = 'Preparing your workspace' }: { label?: string }) {
  const styles = useLoadingStyles();
  return (
    <View accessibilityLabel="Loading Faura Farmer" accessibilityRole="progressbar" style={styles.appLoading}>
      <View style={styles.brandArea}>
        <BrandMark size={76} />
        <Text style={styles.wordmark}>Faura Farmer</Text>
        <Text style={styles.loadingLabel}>{label}</Text>
      </View>
      <LoadingBar />
    </View>
  );
}

export function ContentSkeleton({ variant = 'cards' }: { variant?: ContentSkeletonVariant }) {
  const styles = useLoadingStyles();
  const isDashboard = variant === 'dashboard';
  const isReports = variant === 'reports';
  const isRows = variant === 'rows';
  return (
    <View accessibilityLabel="Loading content" accessibilityRole="progressbar" style={styles.contentSkeleton}>
      <View style={styles.heading}>
        <Skeleton style={styles.headingLine} />
        <Skeleton style={styles.subheadingLine} />
      </View>
      {isDashboard ? <DashboardPlaceholder /> : null}
      {isReports ? <ReportPlaceholder /> : null}
      {!isDashboard && !isReports ? <CardPlaceholders rows={isRows ? 4 : 3} rowStyle={isRows ? styles.rowCard : styles.card} /> : null}
    </View>
  );
}

function LoadingBar() {
  const styles = useLoadingStyles();
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(Animated.timing(progress, { toValue: 1, duration: 1_250, useNativeDriver: true }));
    animation.start();
    return () => animation.stop();
  }, [progress]);

  const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [-124, 124] });
  return <View style={styles.loadingTrack}><Animated.View style={[styles.loadingFill, { transform: [{ translateX }] }]} /></View>;
}

function DashboardPlaceholder() {
  const styles = useLoadingStyles();
  return (
    <>
      <View style={styles.metrics}>
        <View style={styles.card}><Skeleton style={styles.metricLabel} /><Skeleton style={styles.metricValue} /></View>
        <View style={styles.metricPair}>
          <View style={[styles.card, styles.metricHalf]}><Skeleton style={styles.metricLabel} /><Skeleton style={styles.metricSmallValue} /></View>
          <View style={[styles.card, styles.metricHalf]}><Skeleton style={styles.metricLabel} /><Skeleton style={styles.metricSmallValue} /></View>
        </View>
      </View>
      <CardPlaceholders rows={2} rowStyle={styles.card} />
    </>
  );
}

function ReportPlaceholder() {
  const styles = useLoadingStyles();
  return (
    <>
      <View style={styles.card}><Skeleton style={styles.chart} /><Skeleton style={styles.chartCaption} /></View>
      <CardPlaceholders rows={2} rowStyle={styles.card} />
    </>
  );
}

function CardPlaceholders({ rowStyle, rows }: { rowStyle: StyleProp<ViewStyle>; rows: number }) {
  const styles = useLoadingStyles();
  return <View style={styles.cards}>{Array.from({ length: rows }, (_, index) => <View key={index} style={rowStyle}><View style={styles.placeholderRow}><Skeleton style={styles.identity} /><View style={styles.placeholderCopy}><Skeleton style={styles.rowTitle} /><Skeleton style={styles.rowMeta} /></View><Skeleton style={styles.rowAmount} /></View></View>)}</View>;
}

function useLoadingStyles() {
  const { theme } = useAppTheme();
  return useMemo(() => StyleSheet.create({
    appLoading: { flex: 1, justifyContent: 'space-between', backgroundColor: theme.primarySolid, paddingHorizontal: 28, paddingTop: '46%', paddingBottom: 44 },
    brandArea: { alignItems: 'center', gap: 12 },
    wordmark: { color: theme.primarySolidForeground, fontFamily: fontFamily.display, fontSize: 19, fontWeight: '600', letterSpacing: -0.8 },
    loadingLabel: { color: 'rgba(255, 255, 255, 0.72)', fontFamily: fontFamily.body, fontSize: 14, lineHeight: 20 },
    loadingTrack: { alignSelf: 'center', width: '100%', maxWidth: 280, height: 4, overflow: 'hidden', borderRadius: 999, backgroundColor: 'rgba(255, 255, 255, 0.18)' },
    loadingFill: { width: 124, height: '100%', borderRadius: 999, backgroundColor: theme.primarySolidForeground },
    contentSkeleton: { gap: 16, paddingBottom: 28 },
    heading: { gap: 9, marginBottom: 4 },
    headingLine: { width: '42%', height: 28 },
    subheadingLine: { width: '72%', height: 15 },
    cards: { gap: 12 },
    card: { gap: 16, borderCurve: 'continuous', borderRadius: radius.card, borderColor: theme.border, borderWidth: StyleSheet.hairlineWidth, backgroundColor: theme.card, padding: 16 },
    rowCard: { borderBottomColor: theme.border, borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 14 },
    placeholderRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    identity: { width: 38, height: 38, borderRadius: 19 },
    placeholderCopy: { flex: 1, gap: 8 },
    rowTitle: { width: '62%', height: 15 },
    rowMeta: { width: '43%', height: 12 },
    rowAmount: { width: 58, height: 15 },
    metrics: { gap: 12 },
    metricPair: { flexDirection: 'row', gap: 12 },
    metricHalf: { flex: 1, minWidth: 0 },
    metricLabel: { width: '46%', height: 12 },
    metricValue: { width: '56%', height: 28 },
    metricSmallValue: { width: '74%', height: 21 },
    chart: { height: 172, borderRadius: radius.control },
    chartCaption: { width: '58%', height: 14 },
  }), [theme]);
}
