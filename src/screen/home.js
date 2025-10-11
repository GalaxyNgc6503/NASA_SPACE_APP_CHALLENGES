import React, { useState, useEffect, useCallback } from 'react';
import {
    StyleSheet,
    View,
    TextInput,
    ScrollView,
    TouchableOpacity,
    Text,
    Dimensions,
    Alert,
    ActivityIndicator,
} from 'react-native';
// Use presentational components for map, search and weather cards
import MapComponent from '../components/Map';
import SearchBar from '../components/SearchBar';
import WeatherDetailCard from '../components/WeatherCard';
import { multipleLinearRegression, predict } from '../utils/calculations';
import { calculateHeatIndex } from '../utils/predictions';
import { fetchHistoricalData } from '../utils/nasaApi';
import { Button, IconButton, Card } from 'react-native-paper';
import { DatePickerModal } from 'react-native-paper-dates';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LineChart, BarChart } from 'react-native-chart-kit';

const screenWidth = Dimensions.get('window').width;
const containerPadding = 20;
const mapSize = screenWidth - containerPadding * 2;

export default function HomeScreen({ navigation }) {
    const [region, setRegion] = useState({
        latitude: 37.78825,
        longitude: -122.4324,
        latitudeDelta: 0.1,
        longitudeDelta: 0.1,
    });
    const [markerPos, setMarkerPos] = useState({
        latitude: 37.78825,
        longitude: -122.4324,
    });
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [debounceTimer, setDebounceTimer] = useState(null);
    const [openDate, setOpenDate] = useState(false);
    const [selectedDate, setSelectedDate] = useState(undefined);
    const [settings, setSettings] = useState(null);
    const [loading, setLoading] = useState(false);

    const [temperatureData, setTemperatureData] = useState([]);
    const [rainfallData, setRainfallData] = useState([]);
    const [windData, setWindData] = useState([]);
    const [humidityData, setHumidityData] = useState([]);
    const [uvIndexData, setUvIndexData] = useState([]);
    const [labels, setLabels] = useState([]);
    const [predictionData, setPredictionData] = useState(null);

    useEffect(() => {
        const unsubscribe = navigation.addListener('focus', () => loadSettings());
        return unsubscribe;
    }, [navigation]);

    const loadSettings = async () => {
        try {
            const stored = await AsyncStorage.getItem('appSettings');
            if (stored) {
                const parsed = JSON.parse(stored);
                // ensure displayData exists and has defaults for any missing keys
                const defaultDisplay = {
                    temperature: true,
                    rainfall: true,
                    wind: true,
                    humidity: false,
                    heatIndex: false,
                    airQuality: false,
                    uvIndex: false,
                };
                parsed.displayData = { ...defaultDisplay, ...(parsed.displayData || {}) };
                setSettings(parsed);
            }
        } catch (e) {
            console.log('Failed to load settings', e);
        }
    };

    const handleSearchChange = (text) => {
        setSearchQuery(text);
        if (debounceTimer) clearTimeout(debounceTimer);
        setDebounceTimer(setTimeout(() => searchLocation(text), 500));
    };

    const searchLocation = async (text) => {
        if (text.length < 3) return setSearchResults([]);
        try {
            const res = await fetch(
                `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(text)}`,
                {
                    headers: {
                        'User-Agent': 'EventSkyApp/1.0',
                        'Accept-Language': 'en',
                    },
                }
            );
            const data = await res.json();
            setSearchResults(data);
        } catch {
            setSearchResults([]);
        }
    };

    const selectLocation = (item) => {
        const lat = parseFloat(item.lat);
        const lon = parseFloat(item.lon);
        setMarkerPos({ latitude: lat, longitude: lon });
        setRegion({
            ...region,
            latitude: lat,
            longitude: lon,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
        });
        setSearchResults([]);
        setSearchQuery(item.display_name);
    };

    const onDismissDate = () => setOpenDate(false);
    const onConfirmDate = ({ date }) => {
        setOpenDate(false);
        setSelectedDate(date);
        (async () => {
            setLoading(true);
            try {
                const d = await fetchHistoricalData(markerPos.latitude, markerPos.longitude, date);
                if (d) {
                    setTemperatureData(d.temperature || []);
                    setRainfallData(d.rainfall || []);
                    setWindData(d.wind || []);
                    setHumidityData(d.humidity || []);
                    setUvIndexData(d.uvIndex || []);
                    setLabels(d.labels || []);
                    // run prediction after data is set
                    makePrediction();
                }
            } catch (err) {
                console.error('Error fetching NASA data on date confirm', err);
            } finally {
                setLoading(false);
            }
        })();
    };

    // prediction helpers moved to src/utils/predictions.js

    // Using fetchHistoricalData from src/utils/nasaApi.js

    const makePrediction = () => {
        if (!temperatureData.length) return;

        // derived target series
    const hiArr = temperatureData.map((t, i) => calculateHeatIndex(t, humidityData[i]));

        // helper to run MLR for a given target array and predictor arrays
        const runMLR = (targetArr, predictorArrs) => {
            const X = [];
            const y = [];
            for (let i = 0; i < targetArr.length; i++) {
                const row = [];
                let skip = false;
                for (const arr of predictorArrs) {
                    const v = arr[i];
                    if (v == null || isNaN(v)) { skip = true; break; }
                    row.push(v);
                }
                const t = targetArr[i];
                if (skip || t == null || isNaN(t)) continue;
                X.push(row);
                y.push(t);
            }
            if (X.length < 2) return { pred: null, coeffs: null };
            try {
                const coeffs = multipleLinearRegression(X, y);
                // build features for prediction using latest available or mean
                const latestOrMean = (arr) => {
                    for (let i = arr.length - 1; i >= 0; i--) if (arr[i] != null && !isNaN(arr[i])) return arr[i];
                    const clean = arr.filter(v => v != null && !isNaN(v));
                    return clean.length ? clean.reduce((s, v) => s + v, 0) / clean.length : 0;
                };
                const featureVec = predictorArrs.map(a => latestOrMean(a));
                const p = predict(coeffs, featureVec);
                return { pred: parseFloat(p.toFixed(2)), coeffs };
            } catch (err) {
                console.warn('MLR error', err);
                return { pred: null, coeffs: null };
            }
        };

        // predictor arrays for different targets
        const preds = {
            temperature: [humidityData, rainfallData, windData, uvIndexData],
            rainfall: [temperatureData, humidityData, windData, uvIndexData],
            wind: [temperatureData, humidityData, rainfallData, uvIndexData],
            humidity: [temperatureData, rainfallData, windData, uvIndexData],
            uvIndex: [temperatureData, humidityData, rainfallData, windData],
            heatIndex: [temperatureData, humidityData, rainfallData, windData, uvIndexData],
        };

        const result = {};
        // run MLR for each target
        const targets = {
            temperature: temperatureData,
            rainfall: rainfallData,
            wind: windData,
            humidity: humidityData,
            uvIndex: uvIndexData,
            heatIndex: hiArr,
        };

        for (const key of Object.keys(targets)) {
            const { pred, coeffs } = runMLR(targets[key], preds[key]);
            result[key] = pred;
            if (coeffs) result[`${key}Coefficients`] = coeffs;
        }

        console.log('📊 Prediction data (MLR):', result);
        setPredictionData(result);
    };

    const handlePredict = async () => {
        if (!temperatureData.length) {
            Alert.alert('No data', 'Fetching NASA DATA. Need A moment.');
            return;
        }
        makePrediction();
    };

    // 🚀 Automatically refetch and predict when marker changes
    useEffect(() => {
    if (!markerPos.latitude || !markerPos.longitude || !selectedDate) return;

        console.log('📍 Location changed:', markerPos);
        const fetchAndPredict = async () => {
            try {
                setLoading(true);
                const d = await fetchHistoricalData(markerPos.latitude, markerPos.longitude, selectedDate);
                if (d) {
                    setTemperatureData(d.temperature || []);
                    setRainfallData(d.rainfall || []);
                    setWindData(d.wind || []);
                    setHumidityData(d.humidity || []);
                    setUvIndexData(d.uvIndex || []);
                    setLabels(d.labels || []);
                    makePrediction();
                }
            } catch (err) {
                console.error('❌ Auto-fetch error:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchAndPredict();
    }, [markerPos]);

    // prediction chart removed per request

    const renderCharts = useCallback(() => {
    if (!settings?.displayData) return null;
        const chartConfig = {
            backgroundGradientFrom: '#dbe9ff',
            backgroundGradientTo: '#e6f0ff',
            decimalPlaces: 1,
            color: (opacity = 1) => `rgba(51,51,51,${opacity})`,
            labelColor: (opacity = 1) => `rgba(51,51,51,${opacity})`,
        };

        const datasets = {
            temperature: { data: temperatureData, label: 'Temperature', unit: '°C' },
            rainfall: { data: rainfallData, label: 'Rainfall', unit: 'mm' },
            wind: { data: windData, label: 'Wind', unit: 'm/s' },
            humidity: { data: humidityData, label: 'Humidity', unit: '%' },
            uvIndex: { data: uvIndexData, label: 'UV Index', unit: '' },
        };

        return Object.keys(datasets).map((key) => {
            // respect settings toggles: only render datasets enabled in displayData
            if (!settings.displayData[key]) return null;
            const ds = datasets[key];
            if (!ds.data.length) return null;
            return (
                <Card key={key} style={styles.dataCard}>
                    <Text style={styles.chartTitle}>{`${ds.label} Chart for same day in each year`}</Text>
                    <LineChart
                        data={{ labels, datasets: [{ data: ds.data }] }}
                        width={mapSize - 20}
                        height={220}
                        yAxisSuffix={ds.unit}
                        chartConfig={chartConfig}
                        bezier
                        style={{ borderRadius: 16 }}
                    />
                </Card>
            );
        });
    }, [temperatureData, rainfallData, windData, humidityData, uvIndexData, labels]);

    return (
        <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
            {/* Search - delegated to SearchBar component (presentational) */}
            <View style={{ width: mapSize, marginTop: 15, zIndex: 10 }}>
                <SearchBar
                    searchQuery={searchQuery}
                    onChange={handleSearchChange}
                    results={searchResults}
                    onSelect={selectLocation}
                />
            </View>

            {/* Map - delegated to MapComponent which wraps react-native-maps */}
            <MapComponent
                region={region}
                markerPos={markerPos}
                onRegionChange={setRegion}
                onMarkerPress={(coord) => setMarkerPos(coord)}
                mapSize={mapSize}
            />

            {/* Date picker */}
            <View style={[styles.datePickerContainer, { width: mapSize }]}>
                <View style={styles.dateRow}>
                    <View>
                        <Text style={styles.dateLabel}>Selected Date:</Text>
                        {selectedDate && (
                            <Text style={styles.dateTextPlain}>{selectedDate.toLocaleDateString()}</Text>
                        )}
                    </View>
                    <Button onPress={() => setOpenDate(true)} mode="contained" style={styles.dateButton} labelStyle={{ fontSize: 14, color: 'white' }}>
                        Pick Date
                    </Button>
                </View>
            </View>

            {/* Predict */}
            <Button
                mode="contained"
                onPress={handlePredict}
                style={[styles.dateButton, { marginTop: 15, alignSelf: 'center', width: mapSize }]}
                labelStyle={{ fontSize: 16, color: 'white' }}
            >
                Predict
            </Button>

            {loading && <ActivityIndicator style={{ marginTop: 15 }} size="large" color="#7aaeff" />}

            {/* prediction chart removed */}
            {renderCharts()}

            {/* Weather Detail Cards (predictions) - presentational component usage */}
            {predictionData && Object.keys(predictionData).length > 0 && (
                <View style={styles.cardGrid}>
                    {settings?.displayData?.temperature ? (
                        <WeatherDetailCard title="Temperature" value={predictionData.temperature} unit="°C" status="Anomalous" color="#f76b1c" chartData={temperatureData} chartLabels={labels} chartWidth={mapSize - 40} chartLabel="Temperature (°C) per year" />
                    ) : null}

                    {settings?.displayData?.rainfall ? (
                        <WeatherDetailCard title="Precipitation" value={predictionData.rainfall} unit="mm/day" status="Normal" color="#0088cc" chartData={rainfallData} chartLabels={labels} chartWidth={mapSize - 40} chartLabel="Precipitation (mm) per year" />
                    ) : null}

                    {settings?.displayData?.humidity ? (
                        <WeatherDetailCard title="Humidity" value={predictionData.humidity} unit="%" status="Normal" color="#1e90ff" chartData={humidityData} chartLabels={labels} chartWidth={mapSize - 40} chartLabel="Humidity (%) per year" />
                    ) : null}

                    {settings?.displayData?.wind ? (
                        <WeatherDetailCard title="Wind Speed" value={predictionData.wind} unit="m/s" status="Normal" color="#00b894" chartData={windData} chartLabels={labels} chartWidth={mapSize - 40} chartLabel="Wind (m/s) per year" />
                    ) : null}

                    {settings?.displayData?.uvIndex ? (
                        <WeatherDetailCard title="UV Index" value={predictionData.uvIndex} unit="" status="Normal" color="#e67e22" chartData={uvIndexData} chartLabels={labels} chartWidth={mapSize - 40} chartLabel="UV Index per year" />
                    ) : null}

                    {settings?.displayData?.heatIndex ? (
                        <WeatherDetailCard title="Heat Index" value={predictionData.heatIndex} unit="°C" status="Anomalous" color="#e74c3c" chartData={temperatureData.map((t,i) => calculateHeatIndex(t, humidityData[i]))} chartLabels={labels} chartWidth={mapSize - 40} chartLabel="Heat Index (°C) per year" />
                    ) : null}
                </View>
            )}

            <DatePickerModal mode="single" visible={openDate} date={selectedDate} onDismiss={onDismissDate} onConfirm={onConfirmDate} locale="en" />
        </ScrollView>
    );
}

HomeScreen.HeaderRight = ({ navigation }) => (
    <IconButton icon="cog" size={24} onPress={() => navigation.navigate('Settings')} iconColor="white" />
);

const styles = StyleSheet.create({
    scrollContainer: {
        alignItems: 'center',
        paddingBottom: 20,
        backgroundColor: '#e6f0ff',
    },
    searchInput: {
        height: 40,
        backgroundColor: '#7aaeff',
        borderRadius: 10,
        paddingHorizontal: 10,
        marginBottom: 5,
        color: 'white',
    },
    map: { borderRadius: 10, overflow: 'hidden' },
    floatingResults: {
        position: 'absolute',
        top: 45,
        width: '100%',
        backgroundColor: '#cfe0ff',
        borderRadius: 8,
        elevation: 5,
        zIndex: 999,
        maxHeight: 200,
    },
    resultItem: {
        padding: 10,
        borderBottomWidth: 1,
        borderColor: '#cfe0ff',
        color: '#333',
    },
    datePickerContainer: {
        marginTop: 20,
        backgroundColor: '#dbe9ff',
        padding: 10,
        borderRadius: 12,
        elevation: 3,
    },
    dateRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    dateLabel: { fontSize: 14, fontWeight: '600', color: '#333' },
    dateTextPlain: { fontSize: 14, color: '#333', marginTop: 3 },
    dateButton: {
        backgroundColor: '#7aaeff',
        paddingVertical: 3,
        paddingHorizontal: 14,
        borderRadius: 8,
    },
    predictionCard: {
        marginTop: 20,
        borderRadius: 16,
        padding: 10,
        width: mapSize,
        backgroundColor: '#fff4e6',
    },
    chartTitle: { fontSize: 16, fontWeight: 'bold'},

    dataCard: {
        marginTop: 20,
        borderRadius: 16,
        padding: 10,
        width: mapSize,
        backgroundColor: '#dbe9ff',
    },

    cardGrid: {
        flexDirection: 'column',
        marginTop: 20,
        width: mapSize,
    },

    resultItemText: { color: '#333' },
});
