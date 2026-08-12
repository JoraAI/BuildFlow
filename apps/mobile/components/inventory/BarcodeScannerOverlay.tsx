/**
 * BuildFlow - Barcode camera scanner overlay (INVENTORY_HORIZONTAL_PLATFORM Phase 8.2).
 *
 * Device camera barcode scan for Stock Find / issue. Phone = full-bleed overlay;
 * desktop = centered max-w-lg. Keyboard/paste stays the primary input path (the
 * Find button remains). Gated to native platforms - the web build falls back to
 * a "use keyboard/paste" note (expo-camera is a native module).
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Modal, Pressable, Platform } from 'react-native';
import { Button } from '@/components/ui';
import { useViewport } from '@/hooks/useViewport';

export function BarcodeScannerOverlay({
  open,
  onClose,
  onScanned,
}: {
  open: boolean;
  onClose: () => void;
  onScanned: (code: string) => void;
}) {
  const { isPhone } = useViewport();
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null);
  const [nativeError, setNativeError] = useState<string | null>(null);
  const [cameraType, setCameraType] = useState<'back' | 'front'>('back');
  const busyRef = useRef(false);

  const isNative = Platform.OS !== 'web';

  useEffect(() => {
    if (!open) return;
    busyRef.current = false;
    setNativeError(null);

    if (!isNative) {
      setPermissionGranted(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const Camera = require('expo-camera');
        const request =
          Camera.requestCameraPermissionsAsync ??
          Camera.Camera?.requestCameraPermissionsAsync;
        if (typeof request !== 'function') {
          throw new Error('requestCameraPermissionsAsync unavailable');
        }
        const result = await request();
        if (!cancelled) setPermissionGranted(Boolean(result?.granted));
      } catch {
        if (!cancelled) {
          setPermissionGranted(false);
          setNativeError('Camera is not available in this build. Use keyboard/paste to find items.');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, isNative]);

  const handleScan = useCallback(
    (code: string) => {
      const trimmed = (code ?? '').trim();
      if (!trimmed || busyRef.current) return;
      busyRef.current = true;
      onScanned(trimmed);
      setTimeout(() => {
        busyRef.current = false;
      }, 1200);
    },
    [onScanned],
  );

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable className="flex-1 bg-black/70" onPress={onClose}>
        <View className={`flex-1 ${isPhone ? '' : 'items-center justify-center p-4'}`}>
          <Pressable
            onPress={(e) => e.stopPropagation()}
            className={`bg-card ${isPhone ? 'flex-1 w-full' : 'rounded-2xl max-w-lg w-full overflow-hidden'}`}
          >
            <View className="flex-row items-center justify-between px-4 pt-4 pb-2 border-b border-border">
              <Text className="text-base font-bold text-text">Scan barcode</Text>
              <Pressable onPress={onClose} className="p-1">
                <Text className="text-muted text-xl">×</Text>
              </Pressable>
            </View>

            {isNative ? (
              permissionGranted ? (
                <View style={{ width: '100%', aspectRatio: isPhone ? undefined : 16 / 9, flex: isPhone ? 1 : undefined }}>
                  <NativeCameraScanner
                    cameraType={cameraType}
                    onScanned={handleScan}
                    onError={() => {
                      setPermissionGranted(false);
                      setNativeError('Camera could not start. Use keyboard/paste to find items.');
                    }}
                  />
                </View>
              ) : (
                <View className="p-6 items-center">
                  <Text className="text-sm text-text text-center mb-1">
                    {permissionGranted === null ? 'Checking camera…' : 'Camera permission needed'}
                  </Text>
                  <Text className="text-xs text-muted text-center mb-4">
                    {nativeError ?? 'Allow camera access to scan barcodes, or use the barcode input below.'}
                  </Text>
                  <Button label="Close" variant="secondary" onPress={onClose} />
                </View>
              )
            ) : (
              <View className="p-6 items-center">
                <Text className="text-sm text-text text-center mb-1">Camera scanner is mobile-only</Text>
                <Text className="text-xs text-muted text-center mb-4">
                  On desktop, type or paste the barcode into the search box next to Find.
                </Text>
                <Button label="Close" variant="secondary" onPress={onClose} />
              </View>
            )}

            {isPhone && isNative && permissionGranted ? (
              <View className="p-3 border-t border-border flex-row items-center justify-between">
                <Text className="text-[11px] text-muted">Point the camera at the item barcode.</Text>
                <Button
                  label="Flip camera"
                  variant="secondary"
                  size="sm"
                  onPress={() => setCameraType((c) => (c === 'back' ? 'front' : 'back'))}
                />
              </View>
            ) : null}
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}

function NativeCameraScanner({
  cameraType,
  onScanned,
  onError,
}: {
  cameraType: 'back' | 'front';
  onScanned: (code: string) => void;
  onError: () => void;
}) {
  const [CameraView, setCameraView] = useState<React.ComponentType<Record<string, unknown>> | null>(null);

  useEffect(() => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const mod = require('expo-camera');
      setCameraView(() => mod.CameraView);
    } catch {
      onError();
    }
  }, [onError]);

  if (!CameraView) {
    return (
      <View className="flex-1 items-center justify-center p-6" style={{ minHeight: 260 }}>
        <Text className="text-xs text-muted">Starting camera…</Text>
      </View>
    );
  }

  return (
    <CameraView
      style={{ flex: 1, minHeight: 260 }}
      facing={cameraType}
      barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'code128', 'code39', 'upc_a', 'upc_e', 'qr'] }}
      onBarcodeScanned={({ data }: { data: string }) => onScanned(data)}
      onMountError={onError}
    />
  );
}
