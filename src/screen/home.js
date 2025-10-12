import React, { useState, useEffect, useCallback } from 'react';
import {
    StyleSheet,
    View,
    ScrollView,
    Text,
    Dimensions,
    Alert,
    ActivityIndicator,
} from 'react-native';
import MapComponent from '../components/Map';
import SearchBar from '../components/SearchBar';
import WeatherDetailCard from '../components/WeatherCard';
import { multipleLinearRegression, predict } from '../utils/calculations';
import { calculateHeatIndex } from '../utils/predictions';
import { fetchHistoricalData } from '../utils/nasaApi';
import { Button, IconButton } from 'react-native-paper';
import { DatePickerModal } from 'react-native-paper-dates';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
                    makePrediction();
                }
            } catch (err) {
                console.error('Error fetching NASA data on date confirm', err);
            } finally {
                setLoading(false);
            }
        })();
    };

    const makePrediction = () => {
        if (!temperatureData.length) return;
        const hiArr = temperatureData.map((t, i) => calculateHeatIndex(t, humidityData[i]));

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

        const preds = {
            temperature: [humidityData, rainfallData, windData, uvIndexData],
            rainfall: [temperatureData, humidityData, windData, uvIndexData],
            wind: [temperatureData, humidityData, rainfallData, uvIndexData],
            humidity: [temperatureData, rainfallData, windData, uvIndexData],
            uvIndex: [temperatureData, humidityData, rainfallData, windData],
            heatIndex: [temperatureData, humidityData, rainfallData, windData, uvIndexData],
        };

        const result = {};
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
            let sanitized = pred;
            if (sanitized != null) {
                if (key === 'rainfall' || key === 'wind' || key === 'uvIndex') sanitized = Math.max(sanitized, 0);
                if (key === 'humidity') sanitized = Math.min(Math.max(sanitized, 0), 100);
            }
            result[key] = sanitized;
            if (coeffs) result[`${key}Coefficients`] = coeffs;
        }
        setPredictionData(result);
    };

    const handlePredict = async () => {
        if (!temperatureData.length) {
            Alert.alert('No data', 'Fetching NASA DATA. Need a moment.');
            return;
        }
        makePrediction();
    };

    useEffect(() => {
        if (!markerPos.latitude || !markerPos.longitude || !selectedDate) return;
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
                console.error('Auto-fetch error:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchAndPredict();
    }, [markerPos]);

    return (
        <ScrollView contentContainerStyle={styles.scrollContainer}>
            <View style={{ width: mapSize, marginTop: 15 }}>
                <SearchBar searchQuery={searchQuery} onChange={handleSearchChange} results={searchResults} onSelect={selectLocation} />
            </View>
            <MapComponent region={region} markerPos={markerPos} onRegionChange={setRegion} onMarkerPress={(coord) => setMarkerPos(coord)} mapSize={mapSize} />
            <View style={[styles.datePickerContainer, { width: mapSize }]}>
                <View style={styles.dateRow}>
                    <View>
                        <Text style={styles.dateLabel}>Selected Date:</Text>
                        {selectedDate && <Text style={styles.dateTextPlain}>{selectedDate.toLocaleDateString()}</Text>}
                    </View>
                    <Button onPress={() => setOpenDate(true)} mode="contained" style={styles.dateButton}>Pick Date</Button>
                </View>
            </View>
            <Button mode="contained" onPress={handlePredict} style={[styles.dateButton, { marginTop: 15, alignSelf: 'center', width: mapSize }]}>Predict</Button>
            {loading && <ActivityIndicator style={{ marginTop: 15 }} size="large" color="#7aaeff" />}
            {predictionData && (
                <View style={styles.cardGrid}>
                    {settings?.displayData?.temperature && <WeatherDetailCard title="Temperature" value={predictionData.temperature} unit="°C" chartData={temperatureData} chartLabels={labels} chartWidth={mapSize - 40} />}
                    {settings?.displayData?.rainfall && <WeatherDetailCard title="Precipitation" value={predictionData.rainfall} unit="mm/day" chartData={rainfallData} chartLabels={labels} chartWidth={mapSize - 40} />}
                    {settings?.displayData?.humidity && <WeatherDetailCard title="Humidity" value={predictionData.humidity} unit="%" chartData={humidityData} chartLabels={labels} chartWidth={mapSize - 40} />}
                    {settings?.displayData?.wind && <WeatherDetailCard title="Wind Speed" value={predictionData.wind} unit="m/s" chartData={windData} chartLabels={labels} chartWidth={mapSize - 40} />}
                    {settings?.displayData?.uvIndex && <WeatherDetailCard title="UV Index" value={predictionData.uvIndex} unit="" chartData={uvIndexData} chartLabels={labels} chartWidth={mapSize - 40} />}
                    {settings?.displayData?.heatIndex && <WeatherDetailCard title="Heat Index" value={predictionData.heatIndex} unit="°C" chartData={temperatureData.map((t, i) => calculateHeatIndex(t, humidityData[i]))} chartLabels={labels} chartWidth={mapSize - 40} />}
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
    scrollContainer: { alignItems: 'center', paddingBottom: 20, backgroundColor: '#e6f0ff' },
    datePickerContainer: { marginTop: 20, backgroundColor: '#dbe9ff', padding: 10, borderRadius: 12 },
    dateRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    dateLabel: { fontSize: 14, fontWeight: '600', color: '#333' },
    dateTextPlain: { fontSize: 14, color: '#333', marginTop: 3 },
    dateButton: { backgroundColor: '#7aaeff', paddingVertical: 3, borderRadius: 8 },
    cardGrid: { flexDirection: 'column', marginTop: 20, width: mapSize },
});

