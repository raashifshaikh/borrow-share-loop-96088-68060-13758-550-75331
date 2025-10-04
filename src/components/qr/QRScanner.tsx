import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Camera, X, CheckCircle2, XCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface QRScannerProps {
  onScan: (data: any) => void;
  onError?: (error: string) => void;
  title?: string;
  description?: string;
}

export const QRScanner = ({ onScan, onError, title = 'Scan QR Code', description = 'Position the QR code within the frame' }: QRScannerProps) => {
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<{ success: boolean; message: string } | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [cameraPermission, setCameraPermission] = useState<'granted' | 'denied' | 'prompt'>('prompt');

  const startScanning = async () => {
    try {
      // Request camera permission
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach(track => track.stop());
      setCameraPermission('granted');

      const scanner = new Html5Qrcode('qr-reader');
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 }
        },
        (decodedText) => {
          try {
            const parsedData = JSON.parse(decodedText);
            setScanResult({ success: true, message: 'QR Code scanned successfully!' });
            onScan(parsedData);
            stopScanning();
          } catch (err) {
            setScanResult({ success: false, message: 'Invalid QR code format' });
            if (onError) onError('Invalid QR code');
          }
        },
        (errorMessage) => {
          // Ignore errors, they happen frequently during scanning
        }
      );

      setIsScanning(true);
    } catch (err: any) {
      console.error('Scanner error:', err);
      setCameraPermission('denied');
      setScanResult({ success: false, message: 'Camera permission denied' });
      if (onError) onError(err.message);
    }
  };

  const stopScanning = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch (err) {
        console.error('Error stopping scanner:', err);
      }
      scannerRef.current = null;
    }
    setIsScanning(false);
  };

  useEffect(() => {
    return () => {
      stopScanning();
    };
  }, []);

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-4">
        {scanResult && (
          <Alert variant={scanResult.success ? 'default' : 'destructive'}>
            {scanResult.success ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <XCircle className="h-4 w-4" />
            )}
            <AlertDescription>{scanResult.message}</AlertDescription>
          </Alert>
        )}

        {cameraPermission === 'denied' && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertDescription>
              Camera permission is required to scan QR codes. Please enable it in your browser settings.
            </AlertDescription>
          </Alert>
        )}

        <div className="relative">
          <div
            id="qr-reader"
            className={`w-full ${isScanning ? 'block' : 'hidden'} rounded-lg overflow-hidden`}
          />
          {!isScanning && (
            <div className="flex items-center justify-center h-64 bg-muted rounded-lg">
              <Camera className="h-16 w-16 text-muted-foreground" />
            </div>
          )}
        </div>

        <div className="flex gap-2">
          {!isScanning ? (
            <Button onClick={startScanning} className="w-full">
              <Camera className="h-4 w-4 mr-2" />
              Start Scanning
            </Button>
          ) : (
            <Button onClick={stopScanning} variant="destructive" className="w-full">
              <X className="h-4 w-4 mr-2" />
              Stop Scanning
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
