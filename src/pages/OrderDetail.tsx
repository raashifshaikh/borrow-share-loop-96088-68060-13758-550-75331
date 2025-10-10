// OrderDetail-debug.tsx
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

const OrderDetailDebug = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [debugInfo, setDebugInfo] = useState<string[]>([]);

  useEffect(() => {
    const info = [];
    info.push(`Page loaded at: ${new Date().toISOString()}`);
    info.push(`Order ID from URL: ${id}`);
    info.push(`Current URL: ${window.location.href}`);
    info.push(`User agent: ${navigator.userAgent}`);
    setDebugInfo(info);
  }, [id]);

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6 p-6">
        <h1 className="text-3xl font-bold">Order Details Debug</h1>
        
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            This is a debug page to help identify routing issues.
          </AlertDescription>
        </Alert>

        <Card>
          <CardContent className="pt-6">
            <h2 className="text-xl font-semibold mb-4">Debug Information:</h2>
            <div className="space-y-2">
              {debugInfo.map((info, index) => (
                <div key={index} className="p-2 bg-muted rounded">
                  <code>{info}</code>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-4">
          <Button onClick={() => navigate('/orders')}>
            Back to Orders
          </Button>
          <Button variant="outline" onClick={() => window.location.reload()}>
            Reload Page
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default OrderDetailDebug;
