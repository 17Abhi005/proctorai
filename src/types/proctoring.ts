export interface ViolationEvent {
  id: string;
  type: ViolationType;
  timestamp: Date;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  duration?: number; // in seconds
}

export enum ViolationType {
  FACE_NOT_VISIBLE = 'face_not_visible',
  LOOKING_AWAY = 'looking_away',
  MULTIPLE_FACES = 'multiple_faces',
  PHONE_DETECTED = 'phone_detected',
  BOOK_DETECTED = 'book_detected',
  DEVICE_DETECTED = 'device_detected',
  CANDIDATE_ABSENT = 'candidate_absent'
}

export interface SessionData {
  candidateName: string;
  sessionId: string;
  startTime: Date;
  endTime?: Date;
  violations: ViolationEvent[];
  totalDuration: number;
  integrityScore: number;
}

export interface DetectionConfig {
  faceAbsenceThreshold: number; // seconds
  lookingAwayThreshold: number; // seconds
  confidenceThreshold: number; // 0-1
  objectDetectionEnabled: boolean;
}

export interface MonitoringStatus {
  isRecording: boolean;
  faceDetected: boolean;
  objectsDetected: string[];
  currentViolation: ViolationType | null;
  violationStartTime: Date | null;
}