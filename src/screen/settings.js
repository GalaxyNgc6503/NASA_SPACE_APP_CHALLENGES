// SettingsScreen.js
import React, { useState, useEffect } from 'react';
import { ScrollView, View, StyleSheet, Alert, Text, TouchableOpacity } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Button, Divider, Switch, Provider as PaperProvider } from 'react-native-paper';

const defaultSettings = {
  units: {
    temperature: '°C',
    rainfall: 'mm',
    wind: 'm/s',
  },
  display: {
    graphType: 'line',
  },
  displayData: {
    temperature: true,
    rainfall: true,
    wind: true,
    humidity: false,
    heatIndex: false,
    airQuality: false,
    uvIndex: false,
  },
};

const SelectionButton = ({ label, selected, onPress }) => (
  <TouchableOpacity
    onPress={onPress}
    style={[styles.optionButton, selected && styles.optionButtonSelected]}
  >
    <Text style={[styles.optionText, selected && styles.optionTextSelected]}>{label}</Text>
  </TouchableOpacity>
);

const SettingsScreen = () => {
  const [settings, setSettings] = useState(defaultSettings);

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem('appSettings');
        if (stored) {
          const parsed = JSON.parse(stored);
          setSettings({
            ...defaultSettings,
            ...parsed,
            units: { ...defaultSettings.units, ...parsed.units },
            display: { ...defaultSettings.display, ...parsed.display },
            displayData: { ...defaultSettings.displayData, ...parsed.displayData },
          });
        }
      } catch (e) {
        console.log('Failed to load settings', e);
      }
    })();
  }, []);

  const saveSettings = async () => {
    try {
      await AsyncStorage.setItem('appSettings', JSON.stringify(settings));
      Alert.alert('Settings saved!');
    } catch (e) {
      Alert.alert('Failed to save settings', e.message);
    }
  };

  const resetSettings = () => {
    setSettings(defaultSettings);
  };

  const updateUnits = (key, value) => {
    setSettings(prev => ({ ...prev, units: { ...prev.units, [key]: value } }));
  };

  const updateGraphType = (type) => {
    setSettings(prev => ({ ...prev, display: { ...prev.display, graphType: type } }));
  };

  const toggleDisplayData = (key) => {
    setSettings(prev => ({
      ...prev,
      displayData: {
        ...prev.displayData,
        [key]: !prev.displayData[key],
      },
    }));
  };

  return (
    <PaperProvider>
      <ScrollView style={styles.container}>

        <Text style={styles.sectionTitle}>Units & Preferences</Text>

        <Text style={styles.label}>Temperature Unit</Text>
        <View style={styles.optionRow}>
          {['°C', '°F'].map(unit => (
            <SelectionButton
              key={unit}
              label={unit}
              selected={settings.units.temperature === unit}
              onPress={() => updateUnits('temperature', unit)}
            />
          ))}
        </View>

        <Text style={styles.label}>Rainfall Unit</Text>
        <View style={styles.optionRow}>
          {['mm', 'inches'].map(unit => (
            <SelectionButton
              key={unit}
              label={unit}
              selected={settings.units.rainfall === unit}
              onPress={() => updateUnits('rainfall', unit)}
            />
          ))}
        </View>

        <Text style={styles.label}>Wind Unit</Text>
        <View style={styles.optionRow}>
          {['m/s', 'km/h', 'mph'].map(unit => (
            <SelectionButton
              key={unit}
              label={unit}
              selected={settings.units.wind === unit}
              onPress={() => updateUnits('wind', unit)}
            />
          ))}
        </View>

        <Divider style={{ marginVertical: 10, backgroundColor: '#7aaeff' }} />

        <Text style={styles.sectionTitle}>Graph Type</Text>
        <View style={styles.optionRow}>
          {['line', 'bar', 'map'].map(type => (
            <SelectionButton
              key={type}
              label={type.charAt(0).toUpperCase() + type.slice(1)}
              selected={settings.display.graphType === type}
              onPress={() => updateGraphType(type)}
            />
          ))}
        </View>

        <Divider style={{ marginVertical: 10, backgroundColor: '#7aaeff' }} />

        <Text style={styles.sectionTitle}>Data to Show in App</Text>
        {Object.keys(settings.displayData || {}).map(key => (
          <View key={key} style={styles.row}>
            <Text style={{ color: '#333', flex: 1, textTransform: 'capitalize' }}>
              {key.replace(/([A-Z])/g, ' $1')}
            </Text>
            <Switch
              value={settings.displayData[key]}
              onValueChange={() => toggleDisplayData(key)}
              color="#7aaeff"
            />
          </View>
        ))}

        <Divider style={{ marginVertical: 10, backgroundColor: '#7aaeff' }} />

        <Text style={styles.sectionTitle}>Data Sources</Text>
        <Text style={{ color: '#333' }}>Data comes from NASA MERRA-2, GPM, MODIS, etc.</Text>

        <Divider style={{ marginVertical: 10, backgroundColor: '#7aaeff' }} />

        <Button
          mode="contained"
          onPress={saveSettings}
          style={styles.buttonContained}
          labelStyle={{ color: 'white', fontWeight: '600' }}
        >
          Save Settings
        </Button>
        <Button
          mode="outlined"
          onPress={resetSettings}
          style={[styles.buttonOutlined, { marginBottom: 50 }]}
          labelStyle={{ color: '#7aaeff', fontWeight: '600' }}
        >
          Reset to Default
        </Button>
      </ScrollView>
    </PaperProvider>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 15, backgroundColor: '#e6f0ff' },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#333', marginVertical: 10 },
  label: { color: '#333', marginBottom: 5, marginTop: 10 },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 5 },
  optionButton: { backgroundColor: '#cfe0ff', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, marginRight: 8, marginBottom: 5 },
  optionButtonSelected: { backgroundColor: '#7aaeff' },
  optionText: { color: '#333', fontWeight: '500' },
  optionTextSelected: { color: 'white', fontWeight: '700' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 5 },
  buttonContained: { backgroundColor: '#7aaeff', borderRadius: 10, paddingVertical: 8, marginVertical: 5 },
  buttonOutlined: { borderColor: '#7aaeff', borderWidth: 1, borderRadius: 10, paddingVertical: 8, marginVertical: 5 },
});

export default SettingsScreen;

