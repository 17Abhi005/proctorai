import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Wifi, WifiOff, Camera, Mic, Brain } from 'lucide-react';

interface SystemStatusProps {
  isDetectorReady: boolean;
  cameraStatus: 'connected' | 'error' | 'disabled';
  onRunDiagnostics?: () => void;
}

export const SystemStatus: React.FC<SystemStatusProps> = ({
  isDetectorReady,
  cameraStatus,
  onRunDiagnostics
}) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [browserSupport, setBrowserSupport] = useState({
    webrtc: false,
    mediaRecorder: false,
    webgl: false
  });

  useEffect(() => {
    const handleOnlineChange = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', handleOnlineChange);
    window.addEventListener('offline', handleOnlineChange);

    // Check browser capabilities
    setBrowserSupport({
      webrtc: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
      mediaRecorder: !!window.MediaRecorder,
      webgl: !!document.createElement('canvas').getContext('webgl')
    });

    return () => {
      window.removeEventListener('online', handleOnlineChange);
      window.removeEventListener('offline', handleOnlineChange);
    };
  }, []);

  const getStatusIcon = (status: boolean) => {
    return status ? (
      <div className="w-2 h-2 bg-status-online rounded-full" />
    ) : (
      <div className="w-2 h-2 bg-status-offline rounded-full" />
    );
  };

  const allSystemsReady = isOnline && 
    isDetectorReady && 
    cameraStatus === 'connected' && 
    browserSupport.webrtc && 
    browserSupport.webgl;

  return (
    <Card className="bg-card/50 border-border">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-medium text-foreground">System Status</h4>
          <Badge 
            className={
              allSystemsReady 
                ? 'bg-status-online/10 text-status-online border-status-online/20' 
                : 'bg-status-offline/10 text-status-offline border-status-offline/20'
            }
          >
            {allSystemsReady ? 'All Systems Ready' : 'Issues Detected'}
          </Badge>
        </div>

        <div className="space-y-3 text-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isOnline ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
              <span>Network Connection</span>
            </div>
            {getStatusIcon(isOnline)}
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Camera className="w-4 h-4" />
              <span>Camera Access</span>
            </div>
            {getStatusIcon(cameraStatus === 'connected')}
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Brain className="w-4 h-4" />
              <span>AI Detection Models</span>
            </div>
            {getStatusIcon(isDetectorReady)}
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Mic className="w-4 h-4" />
              <span>WebRTC Support</span>
            </div>
            {getStatusIcon(browserSupport.webrtc)}
          </div>
        </div>

        {onRunDiagnostics && (
          <Button 
            onClick={onRunDiagnostics}
            variant="outline" 
            size="sm" 
            className="w-full mt-4"
          >
            Run Diagnostics
          </Button>
        )}
      </CardContent>
    </Card>
  );
};