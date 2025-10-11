import React from 'react';
import { View, TextInput, ScrollView, TouchableOpacity, Text, StyleSheet } from 'react-native';

/**
 * SearchBar - presentational search input with floating results.
 * Props:
 * - searchQuery: string
 * - onChange: function(text)
 * - results: array of result objects (should include place_id and display_name)
 * - onSelect: function(item)
 */
export default function SearchBar({ searchQuery, onChange, results, onSelect }) {
    return (
        <View style={{ width: '100%', zIndex: 10 }}>
            <TextInput
                style={styles.searchInput}
                placeholder="Search location..."
                value={searchQuery}
                onChangeText={onChange}
                placeholderTextColor="rgba(255,255,255,0.7)"
            />
            {results && results.length > 0 && (
                <View style={styles.floatingResults}>
                    <ScrollView keyboardShouldPersistTaps="handled">
                        {results.map(item => (
                            <TouchableOpacity key={item.place_id} onPress={() => onSelect && onSelect(item)}>
                                <Text style={styles.resultItem}>{item.display_name}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    searchInput: {
        height: 40,
        backgroundColor: '#7aaeff',
        borderRadius: 10,
        paddingHorizontal: 10,
        marginBottom: 5,
        color: 'white',
    },
    floatingResults: {
        position: 'absolute',
        top: 45,
        width: '100%',
        backgroundColor: '#cfe0ff',
        borderRadius: 8,
        elevation: 5,
        maxHeight: 200,
    },
    resultItem: {
        padding: 10,
        borderBottomWidth: 1,
        borderColor: '#cfe0ff',
        color: '#333',
    },
});
