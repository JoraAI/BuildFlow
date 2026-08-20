/**
 * BuildFlow - Barcode camera scanner overlay (INVENTORY_HORIZONTAL_PLATFORM Phase 8.2).
 *
 * Device camera barcode scan for Stock Find / issue. Phone = full-bleed overlay;
 * desktop = centered max-w-lg. Keyboard/paste stays the primary input path (the
 * Find button remains).
 *
 * M1 (INVENTORY_UX_POLISH): web phone/tablet builds now open the camera too:
 *   - `getUserMedia({ video: { facingMode: 'environment' } })` (rear camera)
 *   - decode via native `BarcodeDetector` when available, else `@zxing/browser`
 *   - requires a secure context (HTTPS) - clear permission / unsupported messages
 * Desktop web keeps the keyboard/paste-only note. Native uses expo-camera.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Modal, Pressable, Platform } from 'react-native';
import { Button } from '@/components/ui';
import { useViewport } from '@/hooks/useViewport';

/** Minimal typing for the native `BarcodeDetector` API (Chrome/Android/newer Safari). */
type WebBarcodeDetector = new (opts?: { formats?: string[] }) => {
  detect(el: unknown): Promise<Array<{ rawValue: string }>>;
};

export function BarcodeScannerOverlay({
  open,
  onClose,
  onScanned,
}: {
  open: boolean;
  onClose: () => void;
  onScanned: (code: string) => void;
}) {
  const { isPhone, isTablet } = useViewport();
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null);
  const [nativeError, setNativeError] = useState<string | null>(null);
  const [cameraType, setCameraType] = useState<'back' | 'front'>('back');
  const busyRef = useRef(false);

  const isNative = Platform.OS !== 'web';
  // M1: web phone/tablet (incl. iPad Safari/Chrome) gets the camera; desktop web
  // stays keyboard/paste-only.
  const isWebMobile = Platform.OS === 'web' && (isPhone || isTablet);

  // M1 web scanner state.
  const webContainerRef = useRef<View | null>(null);
  const webControlsRef = useRef<{ stop: () => void } | null>(null);
  const [webError, setWebError] = useState<string | null>(null);

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

  // M1: web mobile camera - rear camera + BarcodeDetector / @zxing/browser.
  useEffect(() => {
    if (!open || !isWebMobile || typeof window === 'undefined') return;
    let cancelled = false;
    let stream: MediaStream | null = null;
    let raf = 0;

    const stop = () => {
      if (raf) cancelAnimationFrame(raf);
      webControlsRef.current?.stop();
      webControlsRef.current = null;
      stream?.getTracks().forEach((t) => t.stop());
      stream = null;
      const container = webContainerRef.current as unknown as HTMLDivElement | null;
      const video = container?.querySelector('video');
      if (video) {
        (video as HTMLVideoElement).srcObject = null;
        video.remove();
      }
    };

    (async () => {
      setWebError(null);
      setPermissionGranted(null);
      if (window.isSecureContext === false) {
        setPermissionGranted(false);
        setWebError('Camera needs a secure (HTTPS) connection. Use keyboard/paste to find items.');
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        setPermissionGranted(false);
        setWebError('Camera is not supported in this browser. Use keyboard/paste to find items.');
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: cameraType === 'back' ? 'environment' : 'user' },
          audio: false,
        });
      } catch {
        if (!cancelled) {
          setPermissionGranted(false);
          setWebError('Camera permission denied or unavailable. Allow camera access, or use keyboard/paste to find items.');
        }
        return;
      }
      if (cancelled) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      setPermissionGranted(true);

      // react-native-web cannot render a <video> element directly - create the
      // DOM node and mount it into the container View.
      const container = webContainerRef.current as unknown as HTMLDivElement | null;
      const video = document.createElement('video');
      video.muted = true;
      video.autoplay = true;
      video.playsInline = true;
      video.setAttribute('playsinline', '');
      video.srcObject = stream;
      video.style.width = '100%';
      video.style.height = '100%';
      video.style.objectFit = 'cover';
      container?.appendChild(video);
      await video.play().catch(() => undefined);

      // Prefer the native BarcodeDetector; fall back to @zxing/browser.
      const DetectorCtor = (window as unknown as { BarcodeDetector?: WebBarcodeDetector }).BarcodeDetector;
      let detector: { detect(el: unknown): Promise<Array<{ rawValue: string }>> } | null = null;
      if (DetectorCtor) {
        try {
          detector = new DetectorCtor({
            formats: ['ean_13', 'ean_8', 'code_128', 'code_39', 'upc_a', 'upc_e', 'qr_code'],
          });
        } catch {
          detector = null;
        }
      }
      if (detector) {
        const tick = async () => {
          if (cancelled) return;
          if (video.readyState >= 2) {
            try {
              const codes = await detector!.detect(video);
              if (codes.length > 0 && codes[0].rawValue) {
                handleScan(codes[0].rawValue);
              }
            } catch {
              // transient decode error - keep scanning
            }
          }
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      } else {
        try {
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const { BrowserMultiFormatReader } = require('@zxing/browser');
          const reader = new BrowserMultiFormatReader();
          const controls = await reader.decodeFromVideoElement(video, (result: { getText(): string } | null | undefined) => {
            if (result && !cancelled) handleScan(result.getText());
          });
          webControlsRef.current = controls;
        } catch {
          if (!cancelled) {
            setPermissionGranted(false);
            setWebError('Barcode decoding is not supported in this browser. Use keyboard/paste to find items.');
          }
        }
      }
    })();

    return () => {
      cancelled = true;
      stop();
    };
  }, [open, isWebMobile, cameraType, handleScan]);

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
            ) : isWebMobile ? (
              <View
                style={{
                  width: '100%',
                  aspectRatio: isPhone ? undefined : 16 / 9,
                  flex: isPhone ? 1 : undefined,
                }}
              >
                {/* M1: the video container must ALWAYS be mounted so the async
                    getUserMedia flow can attach the <video> element once the
                    stream resolves. */}
                <View
                  ref={webContainerRef}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    overflow: 'hidden',
                    backgroundColor: '#0F172A',
                  }}
                />
                {!permissionGranted ? (
                  <View
                    className="p-6 items-center justify-center"
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      backgroundColor: 'rgba(255,255,255,0.04)',
                    }}
                  >
                    <Text className="text-sm text-text text-center mb-1">
                      {permissionGranted === null ? 'Starting camera…' : 'Camera unavailable'}
                    </Text>
                    <Text className="text-xs text-muted text-center mb-4">
                      {webError ?? 'Allow camera access to scan barcodes, or use the barcode input below.'}
                    </Text>
                    {webError ? (
                      <Button label="Close" variant="secondary" onPress={onClose} />
                    ) : (
                      <Button
                        label="Try again"
                        variant="secondary"
                        onPress={() => setPermissionGranted(null)}
                      />
                    )}
                  </View>
                ) : null}
              </View>
            ) : (
              <View className="p-6 items-center">
                <Text className="text-sm text-text text-center mb-1">Camera scanner is mobile-only</Text>
                <Text className="text-xs text-muted text-center mb-4">
                  On desktop, type or paste the barcode into the search box next to Find.
                </Text>
                <Button label="Close" variant="secondary" onPress={onClose} />
              </View>
            )}

            {isPhone && (isNative || isWebMobile) && permissionGranted ? (
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
