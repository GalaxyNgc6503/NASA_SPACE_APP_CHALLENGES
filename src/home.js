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
import MapView, { UrlTile, Marker } from 'react-native-maps';
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
    const [pollenCountData, setPollenCountData] = useState([]);
    const [labels, setLabels] = useState([]);
    const [predictionData, setPredictionData] = useState(null);

    useEffect(() => {
        const unsubscribe = navigation.addListener('focus', () => loadSettings());
        return unsubscribe;
    }, [navigation]);

    const loadSettings = async () => {
        try {
            const stored = await AsyncStorage.getItem('appSettings');
            if (stored) setSettings(JSON.parse(stored));
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
        fetchHistoricalData(markerPos.latitude, markerPos.longitude, date);
    };

    const linearRegressionPredict = (data) => {
        const cleanData = data.filter((v) => v !== null && !isNaN(v));
        if (cleanData.length === 0) return null;
        const n = cleanData.length;
        const xMean = (n - 1) / 2;
        const yMean = cleanData.reduce((a, b) => a + b, 0) / n;
        let num = 0,
        den = 0;
        for (let i = 0; i < n; i++) {
            num += (i - xMean) * (cleanData[i] - yMean);
            den += (i - xMean) ** 2;
        }
        const slope = den !== 0 ? num / den : 0;
        const intercept = yMean - slope * xMean;
        return parseFloat((slope * n + intercept).toFixed(2));
    };

    const calculateHeatIndex = (T, H) => {
        if (T === null || H === null) return null;
        const hi =
            -8.78469475556 +
                1.61139411 * T +
                2.33854883889 * H -
                0.14611605 * T * H -
                0.012308094 * T * T -
                0.016424828 * H * H +
                0.002211732 * T * T * H +
                0.00072546 * T * H * H -
                0.000003582 * T * T * H * H;
        return parseFloat(hi.toFixed(2));
    };

    const calculateAirQuality = (pollenArr) => {
        return pollenArr.map((val) => (val ? val * 2 : null));
    };

    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

    const fetchHistoricalData = async (lat, lon, date) => {
        if (!date || !lat || !lon) return;
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const currentYear = new Date().getFullYear();
        const startYear = currentYear - 6;

        const tempArr = [],
        rainArr = [],
        windArr = [],
        humArr = [],
        uvArr = [],
        pollenArr = [],
        labelArr = [];

        for (let y = startYear; y <= currentYear; y++) {
            try {
                const url = `https://power.larc.nasa.gov/api/temporal/daily/point?parameters=T2M_MAX,T2M_MIN,PRECTOTCORR,WS10M,RH2M,ALLSKY_SFC_UV_INDEX&community=RE&longitude=${lon}&latitude=${lat}&start=${y}${month}${day}&end=${y}${month}${day}&format=JSON`;
                const res = await fetch(url, {
                    headers: { Accept: 'application/json', 'User-Agent': 'NASAApp/1.0' },
                });
                const json = await res.json();
                const params = json?.properties?.parameter;
                if (!params) continue;
                const key = `${y}${month}${day}`;
                const tMax = params.T2M_MAX?.[key] ?? null;
                const tMin = params.T2M_MIN?.[key] ?? null;
                const avgTemp = tMax && tMin ? (tMax + tMin) / 2 : tMax ?? tMin;
                tempArr.push(avgTemp ?? null);
                rainArr.push(params.PRECTOTCORR?.[key] ?? null);
                windArr.push(params.WS10M?.[key] ?? null);
                humArr.push(params.RH2M?.[key] ?? null);
                uvArr.push(params.ALLSKY_SFC_UV_INDEX?.[key] ?? null);
                pollenArr.push(Math.floor(Math.random() * 50));
                labelArr.push(String(y));
            } catch (err) {
                console.log(`Error fetching NASA data for ${y}`, err);
            }
            await sleep(1000);
        }

        setTemperatureData(tempArr);
        setRainfallData(rainArr);
        setWindData(windArr);
        setHumidityData(humArr);
        setUvIndexData(uvArr);
        setPollenCountData(pollenArr);
        setLabels(labelArr);
        console.log('✅ All NASA data fetched successfully');
    };

    const makePrediction = () => {
        if (!temperatureData.length) return;
        const hiArr = temperatureData.map((t, i) =>
            calculateHeatIndex(t, humidityData[i])
        );
        const aqArr = calculateAirQuality(pollenCountData);
        const prediction = {
            temperature: linearRegressionPredict(temperatureData),
            rainfall: linearRegressionPredict(rainfallData),
            wind: linearRegressionPredict(windData),
            humidity: linearRegressionPredict(humidityData),
            heatIndex: linearRegressionPredict(hiArr),
            airQuality: linearRegressionPredict(aqArr),
            uvIndex: linearRegressionPredict(uvIndexData),
            pollenCount: linearRegressionPredict(pollenCountData),
        };
        console.log('📊 Prediction data:', prediction);
        setPredictionData(prediction);
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
                await fetchHistoricalData(markerPos.latitude, markerPos.longitude, selectedDate);
                makePrediction();
            } catch (err) {
                console.error('❌ Auto-fetch error:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchAndPredict();
    }, [markerPos]);

    const renderPredictionChart = () => {
        if (!predictionData) return null;
        const chartConfig = {
            backgroundGradientFrom: '#fff4e6',
            backgroundGradientTo: '#ffe6cc',
            decimalPlaces: 1,
            color: (opacity = 1) => `rgba(51,51,51,${opacity})`,
            labelColor: (opacity = 1) => `rgba(51,51,51,${opacity})`,
        };

        return (
            <Card style={styles.predictionCard}>
                <Text style={styles.chartTitle}>Prediction Chart</Text>
                <BarChart
                    data={{
                        labels: ['Temp','Rain','Wind','Humid','HeatIdx','AQ','UV','Pollen'],
                        datasets: [{ data: [
                            predictionData.temperature || 0,
                            predictionData.rainfall || 0,
                            predictionData.wind || 0,
                            predictionData.humidity || 0,
                            predictionData.heatIndex || 0,
                            predictionData.airQuality || 0,
                            predictionData.uvIndex || 0,
                            predictionData.pollenCount || 0,
                        ]}],
                    }}
                    width={mapSize - 20}
                    height={220}
                    chartConfig={chartConfig}
                    style={{ borderRadius: 16 }}
                />
            </Card>
        );
    };

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
            pollenCount: { data: pollenCountData, label: 'Pollen Count', unit: '' },
        };

        return Object.keys(datasets).map((key) => {
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
    }, [temperatureData, rainfallData, windData, humidityData, uvIndexData, pollenCountData, labels]);

    return (
        <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
            {/* Search */}
            <View style={{ width: mapSize, marginTop: 15, zIndex: 10 }}>
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search location..."
                    value={searchQuery}
                    onChangeText={handleSearchChange}
                    placeholderTextColor="rgba(255,255,255,0.7)"
                />
                {searchResults.length > 0 && (
                    <View style={styles.floatingResults}>
                        <ScrollView keyboardShouldPersistTaps="handled">
                            {searchResults.map((item) => (
                                <TouchableOpacity key={item.place_id} onPress={() => selectLocation(item)}>
                                    <Text style={styles.resultItem}>{item.display_name}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                )}
            </View>

            {/* Map */}
            <MapView
                style={[styles.map, { width: mapSize, height: mapSize, marginTop: 15 }]}
                region={region}
                onRegionChangeComplete={setRegion}
                onPress={(e) => setMarkerPos(e.nativeEvent.coordinate)}
            >
                <UrlTile urlTemplate="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" maximumZ={19} tileSize={128} />
                <Marker coordinate={markerPos} title="Selected Location" />
            </MapView>

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

            {renderPredictionChart()}
            {renderCharts()}

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

    resultItemText: { color: '#333' },
});

