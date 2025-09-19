import { useState, useCallback, useRef, useEffect } from 'react';
import { ViolationEvent, ViolationType, MonitoringStatus, SessionData } from '@/types/proctoring';
import { proctoringDetector } from '@/lib/detection';
import { useToast } from '@/hooks/use-toast';

export const useProctoring = (candidateName: string = 'Anonymous Candidate') => {
  const [sessionData, setSessionData] = useState<SessionData>({
    candidateName,
    sessionId: `session_${Date.now()}`,
    startTime: new Date(),
    violations: [],
    totalDuration: 0,
    integrityScore: 100
  });

  const [monitoringStatus, setMonitoringStatus] = useState<MonitoringStatus>({
    isRecording: false,
    faceDetected: false,
    objectsDetected: [],
    currentViolation: null,
    violationStartTime: null
  });

  const [isDetectorReady, setIsDetectorReady] = useState(false);
  const violationTimeouts = useRef<Map<ViolationType, NodeJS.Timeout>>(new Map());
  const objectCooldowns = useRef<Map<string, number>>(new Map());
  const violationCooldowns = useRef<Map<ViolationType, number>>(new Map());
  const { toast } = useToast();

  // Initialize the AI detector
  useEffect(() => {
    const initializeDetector = async () => {
      try {
        await proctoringDetector.initialize();
        setIsDetectorReady(true);
        toast({
          title: "AI System Ready",
          description: "Proctoring detection system initialized successfully",
        });
      } catch (error) {
        console.error('Failed to initialize detector:', error);
        toast({
          title: "System Error",
          description: "Failed to initialize AI detection system",
          variant: "destructive",
        });
      }
    };

    initializeDetector();
  }, [toast]);

  const addViolation = useCallback((
    type: ViolationType,
    description: string,
    severity: ViolationEvent['severity'] = 'medium'
  ) => {
    const now = Date.now();
    const lastViolation = violationCooldowns.current.get(type) || 0;
    const cooldownPeriod = getCooldownPeriod(type);
    
    // Check if violation is in cooldown period
    if (now - lastViolation < cooldownPeriod) {
      return; // Skip adding violation if in cooldown
    }

    const violation: ViolationEvent = {
      id: `violation_${Date.now()}`,
      type,
      timestamp: new Date(),
      description,
      severity
    };

    setSessionData(prev => {
      const newViolations = [...prev.violations, violation];
      const newScore = calculateIntegrityScore(newViolations);
      
      return {
        ...prev,
        violations: newViolations,
        integrityScore: newScore
      };
    });

    // Update cooldown
    violationCooldowns.current.set(type, now);

    // Show toast notification
    toast({
      title: "Violation Detected",
      description,
      variant: severity === 'critical' ? 'destructive' : 'default',
    });
  }, [toast]);

  const getCooldownPeriod = (type: ViolationType): number => {
    switch (type) {
      case ViolationType.MULTIPLE_FACES:
        return 15000; // 15 seconds
      case ViolationType.FACE_NOT_VISIBLE:
        return 20000; // 20 seconds
      case ViolationType.LOOKING_AWAY:
        return 10000; // 10 seconds
      case ViolationType.PHONE_DETECTED:
      case ViolationType.DEVICE_DETECTED:
      case ViolationType.BOOK_DETECTED:
        return 30000; // 30 seconds
      default:
        return 10000; // 10 seconds default
    }
  };

  const calculateIntegrityScore = (violations: ViolationEvent[]): number => {
    let deductions = 0;
    
    // Only count unique violation types for score calculation
    const uniqueViolationTypes = new Set<ViolationType>();
    const violationTypeSeverity = new Map<ViolationType, 'low' | 'medium' | 'high' | 'critical'>();
    
    // Get the highest severity for each violation type
    violations.forEach(violation => {
      if (!uniqueViolationTypes.has(violation.type)) {
        uniqueViolationTypes.add(violation.type);
        violationTypeSeverity.set(violation.type, violation.severity);
      } else {
        // If we already have this violation type, keep the highest severity
        const currentSeverity = violationTypeSeverity.get(violation.type)!;
        const severityRank = { low: 1, medium: 2, high: 3, critical: 4 };
        if (severityRank[violation.severity] > severityRank[currentSeverity]) {
          violationTypeSeverity.set(violation.type, violation.severity);
        }
      }
    });
    
    // Calculate deductions based on unique violation types and their highest severity
    violationTypeSeverity.forEach((severity) => {
      switch (severity) {
        case 'low':
          deductions += 2;
          break;
        case 'medium':
          deductions += 5;
          break;
        case 'high':
          deductions += 10;
          break;
        case 'critical':
          deductions += 20;
          break;
      }
    });

    return Math.max(0, 100 - deductions);
  };

  const processVideoFrame = useCallback(async (videoElement: HTMLVideoElement) => {
    if (!isDetectorReady || !monitoringStatus.isRecording) return;

    try {
      // Create canvas and capture frame
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx || !videoElement.videoWidth || !videoElement.videoHeight) return;

      canvas.width = videoElement.videoWidth;
      canvas.height = videoElement.videoHeight;
      ctx.drawImage(videoElement, 0, 0);

      // Convert to image for AI processing
      const imageDataUrl = canvas.toDataURL('image/jpeg', 0.8);
      const img = new Image();
      
      img.onload = async () => {
        try {
          // Detect faces
          const faceResults = await proctoringDetector.detectFaces(img);
          
          // Detect objects
          const objectResults = await proctoringDetector.detectObjects(img);
          
          // Update monitoring status
          setMonitoringStatus(prev => ({
            ...prev,
            faceDetected: faceResults.hasFace,
            objectsDetected: objectResults.map(obj => obj.object)
          }));

          // Process violations
          await processDetectionResults(faceResults, objectResults);
          
        } catch (error) {
          console.error('Frame processing error:', error);
        }
      };
      
      img.src = imageDataUrl;
    } catch (error) {
      console.error('Video frame processing error:', error);
    }
  }, [isDetectorReady, monitoringStatus.isRecording]);

  const processDetectionResults = async (faceResults: any, objectResults: any[]) => {
    if (!process.env.NODE_ENV || process.env.NODE_ENV !== 'production') {
      console.log('Processing detection results:', { 
        faceResults: {
          hasFace: faceResults.hasFace,
          count: faceResults.count,
          facesLength: faceResults.faces?.length
        }, 
        objectResults: objectResults?.length || 0
      });
    }
    
    // Check for face-related violations
    if (!faceResults.hasFace) {
      if (process.env.NODE_ENV !== 'production') {
        console.log('❌ No face detected, starting timeout for FACE_NOT_VISIBLE');
      }
      handleViolationTimeout(
        ViolationType.FACE_NOT_VISIBLE,
        "Candidate's face is not visible for more than 10 seconds",
        'high',
        10000 // 10 seconds
      );
    } else {
      if (process.env.NODE_ENV !== 'production') {
        console.log('✅ Face detected, clearing FACE_NOT_VISIBLE timeout');
      }
      clearViolationTimeout(ViolationType.FACE_NOT_VISIBLE);
    }

    // Check for multiple faces with more strict criteria
    if (faceResults.hasFace && faceResults.count > 1 && faceResults.multipleFaces) {
      if (process.env.NODE_ENV !== 'production') {
        console.log('❌ Multiple faces detected:', faceResults.count);
      }
      addViolation(
        ViolationType.MULTIPLE_FACES,
        `Multiple people detected in frame (${faceResults.count} faces)`,
        'critical'
      );
    }

    // Check for looking away - fix the logic
    if (faceResults.hasFace && faceResults.faces && faceResults.faces.length > 0) {
      const lookingDirection = await proctoringDetector.analyzeLookingDirection(faceResults.faces[0]);
      if (process.env.NODE_ENV !== 'production') {
        console.log('Looking direction analysis:', lookingDirection);
      }
      
      if (lookingDirection.isLookingAway) {
        if (process.env.NODE_ENV !== 'production') {
          console.log('❌ Candidate looking away, starting timeout for LOOKING_AWAY');
        }
        handleViolationTimeout(
          ViolationType.LOOKING_AWAY,
          "Candidate looking away from screen for more than 5 seconds",
          'medium',
          5000 // 5 seconds
        );
      } else {
        if (process.env.NODE_ENV !== 'production') {
          console.log('✅ Candidate looking at screen, clearing LOOKING_AWAY timeout');
        }
        clearViolationTimeout(ViolationType.LOOKING_AWAY);
      }
    } else if (faceResults.hasFace) {
      // If face detected but no face data, clear looking away timeout
      if (process.env.NODE_ENV !== 'production') {
        console.log('✅ Face detected (no pose data), clearing LOOKING_AWAY timeout');
      }
      clearViolationTimeout(ViolationType.LOOKING_AWAY);
    } else {
      // No face detected, also clear looking away timeout since we can't detect direction
      clearViolationTimeout(ViolationType.LOOKING_AWAY);
    }

    // Check for suspicious objects with cooldown mechanism
    const now = Date.now();
    objectResults.forEach(obj => {
      const objectKey = obj.object.toLowerCase();
      const lastDetection = objectCooldowns.current.get(objectKey) || 0;
      const cooldownPeriod = 30000; // 30 seconds cooldown
      
      if (now - lastDetection > cooldownPeriod) {
        if (objectKey.includes('phone')) {
          if (process.env.NODE_ENV !== 'production') {
            console.log('Phone detected with cooldown check passed');
          }
          addViolation(
            ViolationType.PHONE_DETECTED,
            `Mobile phone detected with ${Math.round(obj.confidence * 100)}% confidence`,
            'critical'
          );
          objectCooldowns.current.set(objectKey, now);
        } else if (objectKey.includes('book')) {
          if (process.env.NODE_ENV !== 'production') {
            console.log('Book detected with cooldown check passed');
          }
          addViolation(
            ViolationType.BOOK_DETECTED,
            `Book/notes detected with ${Math.round(obj.confidence * 100)}% confidence`,
            'high'
          );
          objectCooldowns.current.set(objectKey, now);
        } else if (objectKey.includes('laptop') || objectKey.includes('tablet')) {
          if (process.env.NODE_ENV !== 'production') {
            console.log('Device detected with cooldown check passed');
          }
          addViolation(
            ViolationType.DEVICE_DETECTED,
            `Electronic device detected: ${obj.object}`,
            'high'
          );
          objectCooldowns.current.set(objectKey, now);
        }
      } else {
        if (process.env.NODE_ENV !== 'production') {
          console.log(`Object ${objectKey} still in cooldown period`);
        }
      }
    });
  };

  const handleViolationTimeout = (
    type: ViolationType,
    description: string,
    severity: ViolationEvent['severity'],
    delay: number
  ) => {
    if (violationTimeouts.current.has(type)) {
      if (process.env.NODE_ENV !== 'production') {
        console.log(`⏰ Timeout already active for ${type}`);
      }
      return;
    }

    if (process.env.NODE_ENV !== 'production') {
      console.log(`⏰ Starting ${delay/1000}s timeout for ${type}`);
    }
    const timeout = setTimeout(() => {
      if (process.env.NODE_ENV !== 'production') {
        console.log(`⚠️ TIMEOUT TRIGGERED: Adding violation for ${type}`);
      }
      addViolation(type, description, severity);
      violationTimeouts.current.delete(type);
    }, delay);

    violationTimeouts.current.set(type, timeout);
  };

  const clearViolationTimeout = (type: ViolationType) => {
    const timeout = violationTimeouts.current.get(type);
    if (timeout) {
      if (process.env.NODE_ENV !== 'production') {
        console.log(`🔄 Clearing timeout for ${type}`);
      }
      clearTimeout(timeout);
      violationTimeouts.current.delete(type);
    }
  };

  const startMonitoring = useCallback(() => {
    setMonitoringStatus(prev => ({ ...prev, isRecording: true }));
    setSessionData(prev => ({ ...prev, startTime: new Date() }));
  }, []);

  const stopMonitoring = useCallback(() => {
    setMonitoringStatus(prev => ({ ...prev, isRecording: false }));
    setSessionData(prev => ({
      ...prev,
      endTime: new Date(),
      totalDuration: Math.floor((new Date().getTime() - prev.startTime.getTime()) / 1000)
    }));

    // Clear all timeouts and cooldowns
    violationTimeouts.current.forEach(timeout => clearTimeout(timeout));
    violationTimeouts.current.clear();
    violationCooldowns.current.clear();
  }, []);

  return {
    sessionData,
    monitoringStatus,
    isDetectorReady,
    processVideoFrame,
    startMonitoring,
    stopMonitoring,
    addViolation
  };
};