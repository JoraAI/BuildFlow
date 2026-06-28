/**
 * BuildFlow - Site Check-in screen with Google Maps integration.
 *
 * - Shows project site pin on map
 * - Geo-fence validation (500m radius)
 * - Check-in / Check-out with attendance records
 * - Navigate button (deep link to Google/Apple Maps)
 */
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  Alert,
  ActivityIndicator,
  Platform,
  Linking,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import MapView, { Marker, Circle, LatLng } from 'react-native-maps';
import { Card, Badge, Button, EmptyState } from '@/components/ui';
import { useAppStore } from '@/stores/app.store';
import { useProjects, useProject } from '@/services/project.queries';
import {
  useAttendance,
  useCheckIn,
  useCheckOut,
  type AttendanceRecord,
} from '@/services/report.queries';
import { formatTime } from '@/utils/format';
import { FormScreenHeader } from '@/components/layout/ScreenHeader';
import { dismissTo, DISMISS } from '@/utils/navigation';

const GEOFENCE_RADIUS_M = 500;

export default function SiteCheckInScreen() {
  const router = useRouter();
  const activeProjectId = useAppStore((s) => s.activeProjectId);
  const { data: projects } = useProjects();
  const projectId = activeProjectId ?? projects?.[0]?.id ?? '';

  const projectQ = useProject(projectId);
  const project = projectQ.data;

  const today = new Date().toISOString().slice(0, 10);
  const attendanceQ = useAttendance(projectId, today);
  const checkInMut = useCheckIn(projectId);
  const checkOutMut = useCheckOut(projectId);

  const [userLocation, setUserLocation] = useState<LatLng | null>(null);
  const [locationErr, setLocationErr] = useState<string | null>(null);
  const [distance, setDistance] = useState<number | null>(null);

  // Subscribe to location updates
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationErr('Location permission denied. Enable in Settings.');
        return;
      }
      const sub = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 5000,
          distanceInterval: 10,
        },
        (loc) => {
          setUserLocation({
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
          });
        },
      );
      return () => sub.remove();
    })();
  }, []);

  // Compute distance to site
  useEffect(() => {
    if (userLocation && project?.locationLat && project?.locationLng) {
      const dist = haversine(
        userLocation.latitude,
        userLocation.longitude,
        project.locationLat,
        project.locationLng,
      );
      setDistance(Math.round(dist));
    }
  }, [userLocation, project]);

  const siteLatLng =
    project?.locationLat && project?.locationLng
      ? { latitude: project.locationLat, longitude: project.locationLng }
      : null;

  const withinFence = distance !== null && distance <= GEOFENCE_RADIUS_M;
  const todayRecords: AttendanceRecord[] = attendanceQ.data ?? [];
  const myActiveRecord = todayRecords.find((r) => r.checkOutAt === null);

  const handleCheckIn = async () => {
    if (!userLocation) {
      Alert.alert('Location required', 'Waiting for GPS signal. Try again in a moment.');
      return;
    }
    if (!withinFence) {
      Alert.alert(
        'Outside site',
        `You are ${distance}m from the site. Move within ${GEOFENCE_RADIUS_M}m to check in.`,
      );
      return;
    }
    try {
      await checkInMut.mutateAsync({
        lat: userLocation.latitude,
        lng: userLocation.longitude,
      });
      Alert.alert('Checked in', 'Your attendance has been recorded.');
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Check-in failed');
    }
  };

  const handleCheckOut = async () => {
    try {
      await checkOutMut.mutateAsync();
      Alert.alert('Checked out', 'Have a safe day!');
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Check-out failed');
    }
  };

  const openNavigation = () => {
    if (!siteLatLng) return;
    const scheme = Platform.select({
      ios: 'maps://?daddr=',
      android: 'google.navigation:q=',
    });
    const url = `${scheme}${siteLatLng.latitude},${siteLatLng.longitude}`;
    Linking.openURL(url).catch(() => {
      Linking.openURL(
        `https://www.google.com/maps/dir/?api=1&destination=${siteLatLng.latitude},${siteLatLng.longitude}`,
      );
    });
  };

  const isLoading = projectQ.isLoading;
  const isMutating = checkInMut.isPending || checkOutMut.isPending;

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <FormScreenHeader
        title="Site Check-in"
        cancelLabel="Back"
        onCancel={() => dismissTo(DISMISS.reports)}
      />

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#1E3A5F" />
        </View>
      ) : !project ? (
        <EmptyState title="No project selected" description="Select a project first." />
      ) : !siteLatLng ? (
        <EmptyState
          title="No site location"
          description="This project has no GPS coordinates set. Edit the project to add a location."
        />
      ) : (
        <ScrollView className="flex-1">
          {/* Map */}
          <View className="m-4 rounded-lg overflow-hidden border border-border">
            <MapView
              style={{ width: '100%', height: 280 }}
              initialRegion={{
                latitude: siteLatLng.latitude,
                longitude: siteLatLng.longitude,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              }}
              showsUserLocation
            >
              <Marker coordinate={siteLatLng} title={project.name} pinColor="#1E3A5F" />
              <Circle
                center={siteLatLng}
                radius={GEOFENCE_RADIUS_M}
                strokeWidth={2}
                strokeColor="#F59E0B"
                fillColor="rgba(245, 158, 11, 0.15)"
              />
            </MapView>
          </View>

          {/* Status card */}
          <View className="px-4 pb-4">
            <Card className="p-4 mb-3">
              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-sm font-semibold text-text">Your Location</Text>
                {locationErr ? (
                  <Badge label="No GPS" color="danger" />
                ) : withinFence ? (
                  <Badge label="On Site" color="success" />
                ) : (
                  <Badge label="Off Site" color="warning" />
                )}
              </View>
              {locationErr ? (
                <Text className="text-xs text-danger">{locationErr}</Text>
              ) : distance !== null ? (
                <Text className="text-xs text-muted">
                  {distance}m from site ·{' '}
                  {withinFence
                    ? '✓ Within geo-fence'
                    : `Move ${distance - GEOFENCE_RADIUS_M}m closer`}
                </Text>
              ) : (
                <Text className="text-xs text-muted">Acquiring GPS signal...</Text>
              )}
            </Card>

            {/* Action buttons */}
            {myActiveRecord ? (
              <Card className="p-4 mb-3">
                <Text className="text-sm font-semibold text-success mb-1">● Checked In</Text>
                <Text className="text-xs text-muted mb-3">
                  Since {formatTime(myActiveRecord.checkInAt)}
                </Text>
                <Button
                  label={isMutating ? 'Checking out...' : 'Check Out'}
                  variant="danger"
                  onPress={handleCheckOut}
                />
              </Card>
            ) : (
              <Card className="p-4 mb-3">
                <Button
                  label={isMutating ? 'Checking in...' : 'Check In'}
                  onPress={handleCheckIn}
                />
                {!withinFence && distance !== null && (
                  <Text className="text-xs text-warning mt-2 text-center">
                    Must be within {GEOFENCE_RADIUS_M}m of site
                  </Text>
                )}
              </Card>
            )}

            <Button label="Navigate to Site" variant="secondary" onPress={openNavigation} />
          </View>

          {/* Today's attendance */}
          <View className="px-4 pb-8">
            <Text className="text-sm font-semibold text-text mb-2">
              Today's Attendance ({todayRecords.length})
            </Text>
            {todayRecords.length > 0 ? (
              todayRecords.map((r) => <AttendanceRow key={r.id} record={r} />)
            ) : (
              <Text className="text-xs text-muted">No check-ins recorded today.</Text>
            )}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function AttendanceRow({ record }: { record: AttendanceRecord }) {
  return (
    <Card className="p-3 mb-2">
      <View className="flex-row items-center justify-between mb-1">
        <Text className="text-sm font-semibold text-text">{record.user.name}</Text>
        {record.checkOutAt ? (
          <Badge label="Completed" color="neutral" />
        ) : (
          <Badge label="Active" color="success" />
        )}
      </View>
      <View className="flex-row gap-3">
        <Text className="text-xs text-muted">
          In: {formatTime(record.checkInAt)}
        </Text>
        {record.checkOutAt && (
          <Text className="text-xs text-muted">Out: {formatTime(record.checkOutAt)}</Text>
        )}
        <Text className="text-xs text-muted">
          {Math.round(record.distanceFromSite)}m
        </Text>
        {!record.withinFence && (
          <Text className="text-xs text-warning">⚠ Outside fence</Text>
        )}
      </View>
    </Card>
  );
}

/** Haversine distance in meters. */
function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}