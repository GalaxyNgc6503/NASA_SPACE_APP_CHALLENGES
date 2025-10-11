import React from 'react';
import MapView, { UrlTile, Marker } from 'react-native-maps';
import { StyleSheet } from 'react-native';

/**
 * MapComponent - presentational wrapper around react-native-maps used by HomeScreen
 * Props:
 * - region: Map region object
 * - markerPos: { latitude, longitude }
 * - onRegionChange: callback when region changes (receives region)
 * - onMarkerPress: callback when the map is pressed (receives coordinate)
 * - mapSize: pixel size to use for width/height
 */
export default function MapComponent({ region, markerPos, onRegionChange, onMarkerPress, mapSize }) {
    return (
        <MapView
            style={[styles.map, { width: mapSize, height: mapSize }]}
            region={region}
            onRegionChangeComplete={onRegionChange}
            onPress={(e) => onMarkerPress && onMarkerPress(e.nativeEvent.coordinate)}
        >
            <UrlTile urlTemplate="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" maximumZ={19} tileSize={128} />
            <Marker coordinate={markerPos} title="Selected Location" />
        </MapView>
    );
}

const styles = StyleSheet.create({
    map: { borderRadius: 10, overflow: 'hidden', marginTop: 15 },
});
