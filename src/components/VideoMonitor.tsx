import React, { useRef, useEffect, useCallback, useState } from 'react';
import Webcam from 'react-webcam';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { Play, Square, Camera, AlertTriangle, Video, VideoOff, CameraOff } from 'lucide-react';
import { useProctoring } from '@/hooks/useProctoring';
import { handleCameraError } from '@/utils/errorReporting';
import { throttle } from '@/utils/performance';

interface VideoMonitorProps {
  candidateName?: string;
  onSessionUpdate?: (sessionData: any) => void;
}

export const VideoMonitor: React.FC<VideoMonitorProps> = ({
  candidateName = 'Test Candidate',
  onSessionUpdate
}) => {
  const webcamRef = useRef<Webcam>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [cameraError, setCameraError] = useState<string | null>(null);
  
  const {
    sessionData,
    monitoringStatus,
    isDetectorReady,
    processVideoFrame,
    startMonitoring,
    stopMonitoring
  } = useProctoring(candidateName);

  // Throttled video processing to improve performance
  const throttledProcessFrame = useCallback(
    throttle(() => {
      const video = webcamRef.current?.video;
      if (video && video.readyState === 4) {
        processVideoFrame(video);
      }
    }, 1500), // Process every 1.5 seconds instead of every second
    [processVideoFrame]
  );

  // Process video frames at regular intervals with throttling
  useEffect(() => {
    if (!monitoringStatus.isRecording || !webcamRef.current) return;

    const interval = setInterval(() => {
      throttledProcessFrame();
    }, 1500); // Increased interval for better performance

    return () => clearInterval(interval);
  }, [monitoringStatus.isRecording, throttledProcessFrame]);

  // Notify parent component of session updates
  useEffect(() => {
    if (onSessionUpdate) {
      onSessionUpdate(sessionData);
    }
  }, [sessionData, onSessionUpdate]);

  const handleStartMonitoring = useCallback(() => {
    if (isDetectorReady) {
      startMonitoring();
    }
  }, [isDetectorReady, startMonitoring]);


  const getSupportedMimeType = () => {
    const types = [
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm',
      'video/mp4'
    ];
    return types.find(type => MediaRecorder.isTypeSupported(type)) || 'video/webm';
  };

  const handleStartRecording = useCallback(() => {
    if (webcamRef.current?.stream) {
      // Clear previous chunks
      recordedChunksRef.current = [];
      
      const mimeType = getSupportedMimeType();
      const mediaRecorder = new MediaRecorder(webcamRef.current.stream, {
        mimeType,
        videoBitsPerSecond: 2500000, // 2.5 Mbps for good quality
      });
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        if (recordedChunksRef.current.length > 0) {
          const blob = new Blob(recordedChunksRef.current, { type: mimeType });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `interview-recording-${sessionData.sessionId || 'session'}.webm`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          
          // Clear chunks after download
          recordedChunksRef.current = [];
        }
      };
      
      mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder error:', event);
        setIsRecording(false);
      };
      
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(1000); // Capture data every second
      setIsRecording(true);
    }
  }, [sessionData.sessionId]);

  const handleStopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, [isRecording]);

  const handleToggleCamera = useCallback(() => {
    setIsCameraOn(prev => !prev);
    setCameraError(null);
  }, []);

  const handleCameraErrorLocal = useCallback((error: any) => {
    const errorMessage = handleCameraError(error);
    setCameraError(errorMessage);
  }, []);

  const getStatusColor = () => {
    if (!monitoringStatus.isRecording) return 'status-neutral';
    if (!monitoringStatus.faceDetected) return 'status-offline';
    if (monitoringStatus.objectsDetected.length > 0) return 'alert-warning';
    return 'status-online';
  };

  const getStatusText = () => {
    if (!monitoringStatus.isRecording) return 'Not Recording';
    if (!monitoringStatus.faceDetected) return 'No Face Detected';
    if (monitoringStatus.objectsDetected.length > 0) return 'Objects Detected';
    return 'Monitoring Active';
  };

  return (
    <Card className="overflow-hidden bg-card border-border">
      <div className="relative">
        {/* Video Feed */}
        <div className="aspect-video bg-muted relative">
          {isCameraOn ? (
            <>
              {cameraError ? (
                <div className="w-full h-full flex items-center justify-center bg-muted">
                  <div className="text-center p-6">
                    <AlertTriangle className="w-16 h-16 mx-auto mb-4 text-destructive" />
                    <h3 className="font-semibold mb-2 text-destructive">Camera Error</h3>
                    <p className="text-sm text-muted-foreground mb-4">{cameraError}</p>
                    <Button 
                      onClick={() => {
                        setCameraError(null);
                        setIsCameraOn(false);
                        setTimeout(() => setIsCameraOn(true), 100);
                      }}
                      size="sm"
                      variant="outline"
                    >
                      Retry Camera Access
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  {!isDetectorReady && (
                    <div className="absolute inset-0 z-10 bg-background/80 backdrop-blur-sm">
                      <LoadingSpinner 
                        message="Initializing AI Detection System..." 
                        type="ai" 
                        showCard={false}
                      />
                    </div>
                  )}
                  <Webcam
                    ref={webcamRef}
                    audio={false}
                    screenshotFormat="image/jpeg"
                    className="w-full h-full object-cover scale-x-[-1]"
                    onUserMediaError={handleCameraErrorLocal}
                  />
                </>
              )}
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-muted">
              <div className="text-center">
                <CameraOff className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">Camera is off</p>
              </div>
            </div>
          )}
          
          {/* Status Overlay */}
          <div className="absolute top-4 left-4 flex items-center gap-2">
            <div 
              className={`w-3 h-3 rounded-full ${
                monitoringStatus.isRecording ? 'bg-status-online animate-pulse' : 'bg-status-neutral'
              }`}
            />
            <Badge 
              variant="secondary" 
              className={`bg-${getStatusColor()}/10 text-${getStatusColor()} border-${getStatusColor()}/20`}
            >
              {getStatusText()}
            </Badge>
          </div>

          {/* AI Readiness Indicator */}
          <div className="absolute top-4 right-4">
            <Badge 
              variant={isDetectorReady ? "default" : "secondary"}
              className={`${
                isDetectorReady 
                  ? 'bg-status-online/10 text-status-online border-status-online/20' 
                  : 'bg-status-neutral/10 text-status-neutral border-status-neutral/20'
              }`}
            >
              AI {isDetectorReady ? 'Ready' : 'Loading...'}
            </Badge>
          </div>

          {/* Violations Alert */}
          {monitoringStatus.objectsDetected.length > 0 && (
            <div className="absolute bottom-4 left-4 right-4">
              <div className="bg-alert-critical/90 text-white p-3 rounded-lg flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                <span className="text-sm font-medium">
                  Suspicious objects detected: {monitoringStatus.objectsDetected.join(', ')}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="p-4 bg-card border-t border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Camera className="w-5 h-5 text-muted-foreground" />
                <span className="text-sm font-medium">{candidateName}</span>
              </div>
              
              <div className="text-sm text-muted-foreground">
                Session: {sessionData.sessionId.slice(-8)}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button 
                onClick={handleToggleCamera}
                variant="outline"
                size="sm"
              >
                {isCameraOn ? (
                  <>
                    <CameraOff className="w-4 h-4 mr-2" />
                    Turn Off Camera
                  </>
                ) : (
                  <>
                    <Camera className="w-4 h-4 mr-2" />
                    Turn On Camera
                  </>
                )}
              </Button>
              
              {!isRecording ? (
                <Button 
                  onClick={handleStartRecording}
                  variant="default"
                  size="sm"
                  className="bg-status-online hover:bg-status-online/90"
                  disabled={!isCameraOn}
                >
                  <Video className="w-4 h-4 mr-2" />
                  Start Recording
                </Button>
              ) : (
                <Button 
                  onClick={handleStopRecording}
                  variant="destructive"
                  size="sm"
                >
                  <VideoOff className="w-4 h-4 mr-2" />
                  Stop Recording
                </Button>
              )}
              
              {!monitoringStatus.isRecording ? (
                <Button 
                  onClick={handleStartMonitoring}
                  disabled={!isDetectorReady}
                  variant="outline"
                  size="sm"
                >
                  <Play className="w-4 h-4 mr-2" />
                  Start Monitoring
                </Button>
              ) : (
                <Button 
                  onClick={stopMonitoring}
                  variant="outline"
                  size="sm"
                >
                  <Square className="w-4 h-4 mr-2" />
                  Stop Monitoring
                </Button>
              )}
            </div>
          </div>

          {/* Session Stats */}
          <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
            <div>
              <div className="text-muted-foreground">Violations</div>
              <div className="font-medium text-foreground">{sessionData.violations.length}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Integrity Score</div>
              <div className={`font-medium ${
                sessionData.integrityScore >= 80 ? 'text-status-online' :
                sessionData.integrityScore >= 60 ? 'text-alert-warning' :
                'text-alert-critical'
              }`}>
                {sessionData.integrityScore}%
              </div>
            </div>
            <div>
              <div className="text-muted-foreground">Duration</div>
              <div className="font-medium text-foreground">
                {monitoringStatus.isRecording 
                  ? `${Math.floor((Date.now() - sessionData.startTime.getTime()) / 1000)}s`
                  : `${sessionData.totalDuration}s`
                }
              </div>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};