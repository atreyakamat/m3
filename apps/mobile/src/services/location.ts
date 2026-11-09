/**
 * Device Location Service for M3 Malaria Surveillance Worker Application.
 *
 * Captures GPS coordinates at authorized workflow points:
 * 1. Post-registration location capture
 * 2. Entry in Goa
 * 3. Exit from Goa
 * 4. Not Feeling Well symptom reporting
 * 5. Worksite transfer request
 *
 * Uses expo-location with web navigator.geolocation fallback.
 * Never performs background tracking.
 */

import * as Location from 'expo-location';
import { Platform } from 'react-native';

export interface CapturedLocation {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  timestamp: number;
  formattedText: string;
}

export async function captureDeviceLocation(): Promise<CapturedLocation> {
  // 1. Try expo-location native API
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status === 'granted') {
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const lat = loc.coords.latitude;
      const lon = loc.coords.longitude;
      const latDir = lat >= 0 ? 'N' : 'S';
      const lonDir = lon >= 0 ? 'E' : 'W';
      const formattedText = `${Math.abs(lat).toFixed(4)}° ${latDir}, ${Math.abs(lon).toFixed(4)}° ${lonDir}`;
      return {
        latitude: lat,
        longitude: lon,
        accuracy: loc.coords.accuracy,
        timestamp: loc.timestamp || Date.now(),
        formattedText,
      };
    } else if (Platform.OS !== 'web') {
      throw new Error('Location permission was denied. Please grant location access in device settings.');
    }
  } catch (expoErr: any) {
    if (Platform.OS !== 'web') {
      throw new Error(expoErr?.message || 'Could not retrieve device location. Please ensure GPS is turned on.');
    }
  }

  // 2. Web fallback if running under react-native-web
  if (typeof navigator !== 'undefined' && navigator.geolocation) {
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lon = pos.coords.longitude;
          const latDir = lat >= 0 ? 'N' : 'S';
          const lonDir = lon >= 0 ? 'E' : 'W';
          const formattedText = `${Math.abs(lat).toFixed(4)}° ${latDir}, ${Math.abs(lon).toFixed(4)}° ${lonDir}`;
          resolve({
            latitude: lat,
            longitude: lon,
            accuracy: pos.coords.accuracy,
            timestamp: pos.timestamp || Date.now(),
            formattedText,
          });
        },
        (err) => {
          reject(new Error(err.message || 'Location permission denied or unavailable in browser'));
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
      );
    });
  }

  throw new Error('Location services are not available on this device.');
}
