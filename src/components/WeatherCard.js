import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { Card } from 'react-native-paper';
import { LineChart } from 'react-native-chart-kit';

/**
 * WeatherDetailCard
 * Props:
 * - title, value, unit, status, color (existing)
 * - chartData: array of numeric values (one per year) to show a mini chart
 * - chartLabels: array of labels (years) matching chartData
 * - chartWidth: optional numeric width for the chart
 */
export default function WeatherDetailCard({ title, value, unit, status, color, chartData, chartLabels, chartWidth, chartLabel }) {
  const screenW = Dimensions.get('window').width;
  // make the mini-chart smaller so it comfortably fits inside the card on narrow screens
  // default max width lowered further to 180 for compact cards
  const width = chartWidth || Math.min(screenW - 120, 180);

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <Text style={[styles.title, { color }]}>{title}</Text>
        <View style={[styles.badge, { backgroundColor: status === 'Normal' ? '#d3f9d8' : '#ffd6d6' }]}> 
          <Text style={{ color: status === 'Normal' ? '#1b5e20' : '#b71c1c', fontWeight: '600' }}>{status}</Text>
        </View>
      </View>
      <Text style={styles.value}>{value !== null && value !== undefined ? `${value} ${unit}` : '--'}</Text>

      {/* small inline chart showing historical values (one point per year) */}
      {chartData && chartData.length > 0 && (
        <View style={styles.chartWrap}>
          {chartLabel ? <Text style={styles.chartLabel}>{chartLabel}</Text> : null}
          <LineChart
            data={{ labels: chartLabels || [], datasets: [{ data: chartData.map(v => v == null ? 0 : v) }] }}
            width={width}
            height={64}
            withDots={true}
            dotRadius={2}
            withInnerLines={false}
            withOuterLines={false}
            yAxisSuffix={unit}
            yLabelsOffset={8}
            chartConfig={{
              backgroundGradientFrom: '#ffffff',
              backgroundGradientTo: '#ffffff',
              color: (opacity = 1) => `rgba(33,33,33,${opacity})`,
              labelColor: (opacity = 1) => `rgba(60,60,60,${opacity})`,
            }}
            style={{ paddingRight: 0, paddingBottom: 8, alignSelf: 'center' }}
            bezier
          />
        </View>
      )}

      <Text style={styles.description}>Status based on predictive analysis</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    backgroundColor: '#ffffff',
    padding: 15,
    borderRadius: 16,
    marginBottom: 15,
    elevation: 2,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 14, fontWeight: '600' },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  value: { fontSize: 18, fontWeight: 'bold', marginTop: 10, color: '#333' },
  description: { fontSize: 12, color: '#777', marginTop: 6 },
  chartWrap: { marginTop: 10, marginLeft: 12 },
  chartLabel: { fontSize: 12, color: '#555', marginBottom: 4 },
});
