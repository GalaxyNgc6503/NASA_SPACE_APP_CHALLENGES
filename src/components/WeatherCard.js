import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions, ScrollView } from 'react-native';
import { Card } from 'react-native-paper';
import { LineChart, BarChart } from 'react-native-chart-kit';
import AsyncStorage from '@react-native-async-storage/async-storage';

// --- Helpers ---
const convertValue = (value, type, units) => {
  if (value == null || isNaN(value)) return value;
  switch (type) {
    case 'temperature':
      return units.temperature === '°F' ? value * 9 / 5 + 32 : value;
    case 'rainfall':
      return units.rainfall === 'inches' ? value / 25.4 : value;
    case 'wind':
      if (units.wind === 'km/h') return value * 3.6;
      if (units.wind === 'mph') return value * 2.237;
      return value;
    default:
      return value;
  }
};

const getUnitSymbol = (type, units) => {
  switch (type) {
    case 'temperature': return units.temperature || '°C';
    case 'rainfall': return units.rainfall || 'mm';
    case 'wind': return units.wind || 'm/s';
    case 'humidity': return '%';
    case 'uvIndex': return '';
    case 'heatIndex': return units.temperature || '°C';
    default: return '';
  }
};

// --- Determine comfort from data ---
const getComfortStatus = (type, value) => {
  if (value == null || isNaN(value)) return 'Unknown';

  switch (type) {
    case 'temperature':
      return value >= 18 && value <= 28 ? 'Comfortable' : 'Uncomfortable';
    case 'humidity':
      return value >= 30 && value <= 60 ? 'Comfortable' : 'Uncomfortable';
    case 'wind':
      return value <= 10 ? 'Comfortable' : 'Uncomfortable';
    case 'rainfall':
      return value === 0 ? 'Comfortable' : 'Uncomfortable';
    case 'uvIndex':
      return value <= 5 ? 'Comfortable' : 'Uncomfortable';
    case 'heatIndex':
      return value <= 32 ? 'Comfortable' : 'Uncomfortable';
    default:
      return 'Comfortable';
  }
};

export default function WeatherDetailCard({
  title,
  value,
  color,
  chartData,
  chartLabels,
  chartWidth,
  chartLabel,
  large = false,
}) {
  const screenW = Dimensions.get('window').width;
  const compactMax = Math.min(screenW - 160, 160);
  const computedFullWidth = Math.min(screenW - 60, 800);
  const width = large ? computedFullWidth : (chartWidth || compactMax);
  const isFull = large || (chartWidth && chartWidth > compactMax);

  const [tooltip, setTooltip] = useState(null);
  const [units, setUnits] = useState({
    temperature: '°C',
    rainfall: 'mm',
    wind: 'm/s',
  });
  const [graphType, setGraphType] = useState('line');

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem('appSettings');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed.units) setUnits(parsed.units);
          if (parsed.display?.graphType) setGraphType(parsed.display.graphType);
        }
      } catch (err) {
        console.log('Failed to load settings', err);
      }
    })();
  }, []);

  const detectType = () => {
    const key = title.toLowerCase();
    if (key.includes('temp')) return 'temperature';
    if (key.includes('rain')) return 'rainfall';
    if (key.includes('wind')) return 'wind';
    if (key.includes('humid')) return 'humidity';
    if (key.includes('uv')) return 'uvIndex';
    if (key.includes('heat')) return 'heatIndex';
    return 'unknown';
  };

  const type = detectType();
  const convertedValue = convertValue(value, type, units);
  const comfortStatus = getComfortStatus(type, convertedValue);
  const convertedChartData = chartData
    ? chartData.map((v) => convertValue(v, type, units))
    : [];
  const convertedUnit = getUnitSymbol(type, units);

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <Text style={[styles.title, { color }]}>{title}</Text>
        <View
          style={[
            styles.badge,
            {
              backgroundColor:
                comfortStatus === 'Comfortable' ? '#d3f9d8' : '#ffd6d6',
            },
          ]}
        >
          <Text
            style={{
              color: comfortStatus === 'Comfortable' ? '#1b5e20' : '#b71c1c',
              fontWeight: '600',
            }}
          >
            {comfortStatus}
          </Text>
        </View>
      </View>

      <Text style={styles.value}>
        {convertedValue !== null && convertedValue !== undefined
          ? `${convertedValue.toFixed(2)} ${convertedUnit}`
          : '--'}
      </Text>

      {/* Chart */}
      {convertedChartData && convertedChartData.length > 0 && (
        <View style={styles.chartWrap}>
          {chartLabel ? <Text style={styles.chartLabel}>{chartLabel}</Text> : null}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: isFull ? 0 : 16 }}
          >
            {(() => {
              const ChartType = graphType === 'bar' ? BarChart : LineChart;
              return (
                <ChartType
                  data={{
                    labels: chartLabels || [],
                    datasets: [{ data: convertedChartData.map(v => (v == null ? 0 : v)) }],
                  }}
                  width={Math.max(width, (convertedChartData.length || 1) * 60)}
                  height={isFull ? 240 : 140}
                  yAxisSuffix={convertedUnit}
                  fromZero
                  verticalLabelRotation={0}
                  withVerticalLabels
                  withHorizontalLabels
                  yLabelsOffset={10}
                  xLabelsOffset={20}
                  chartConfig={{
                    backgroundGradientFrom: '#dbe9ff',
                    backgroundGradientTo: '#e6f0ff',
                    decimalPlaces: 1,
                    color: (opacity = 1) => `rgba(51,51,51,${opacity})`,
                    labelColor: (opacity = 1) => `rgba(51,51,51,${opacity})`,
                    propsForLabels: { fontSize: 12 },
                    propsForBackgroundLines: { strokeDasharray: '' },
                  }}
                  style={{
                    marginVertical: 10,
                    borderRadius: 8,
                    paddingLeft: 60,
                    paddingRight: 60,
                    paddingBottom: 15,
                    marginLeft: -25,
                    alignSelf: 'center',
                  }}
                  bezier={graphType === 'line'}
                  onDataPointClick={(data) => {
                    setTooltip({
                      x: data.index,
                      y: data.value,
                      label: chartLabels?.[data.index] ?? String(data.index),
                    });
                    setTimeout(() => setTooltip(null), 2000);
                  }}
                />
              );
            })()}
          </ScrollView>
          {tooltip ? (
            <View style={styles.tooltip} pointerEvents="none">
              <Text style={styles.tooltipText}>
                {`${tooltip.label}: ${tooltip.y.toFixed(2)} ${convertedUnit}`}
              </Text>
            </View>
          ) : null}
        </View>
      )}

      <Text style={styles.description}>
        Comfort level based on predictive thresholds
      </Text>
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
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  value: { fontSize: 18, fontWeight: 'bold', marginTop: 10, color: '#333' },
  description: { fontSize: 12, color: '#777', marginTop: 6 },
  chartWrap: { marginTop: 10, marginLeft: 6 },
  chartLabel: { fontSize: 12, color: '#555', marginBottom: 4 },
  tooltip: {
    position: 'absolute',
    top: 8,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  tooltipText: { color: 'white', fontSize: 12 },
});

