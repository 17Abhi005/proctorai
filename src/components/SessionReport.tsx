import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { SessionData, ViolationType } from '@/types/proctoring';
import { Download, FileText, Clock, User, Shield, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';

interface SessionReportProps {
  sessionData: SessionData;
  onExportReport?: () => void;
}

export const SessionReport: React.FC<SessionReportProps> = ({
  sessionData,
  onExportReport
}) => {
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-status-online';
    if (score >= 60) return 'text-alert-warning';
    return 'text-alert-critical';
  };

  const getScoreBadgeColor = (score: number) => {
    if (score >= 80) return 'bg-status-online/10 text-status-online border-status-online/20';
    if (score >= 60) return 'bg-alert-warning/10 text-alert-warning border-alert-warning/20';
    return 'bg-alert-critical/10 text-alert-critical border-alert-critical/20';
  };

  const violationCounts = sessionData.violations.reduce((acc, violation) => {
    acc[violation.type] = (acc[violation.type] || 0) + 1;
    return acc;
  }, {} as Record<ViolationType, number>);

  const getViolationLabel = (type: ViolationType) => {
    switch (type) {
      case ViolationType.FACE_NOT_VISIBLE:
        return 'Face Not Visible';
      case ViolationType.LOOKING_AWAY:
        return 'Looking Away';
      case ViolationType.MULTIPLE_FACES:
        return 'Multiple Faces';
      case ViolationType.PHONE_DETECTED:
        return 'Phone Detected';
      case ViolationType.BOOK_DETECTED:
        return 'Books/Notes Detected';
      case ViolationType.DEVICE_DETECTED:
        return 'Electronic Device';
      case ViolationType.CANDIDATE_ABSENT:
        return 'Candidate Absent';
      default:
        return type;
    }
  };

  const generateTextReport = () => {
    const report = `
PROCTORING REPORT
================

Session Information:
- Candidate: ${sessionData.candidateName}
- Session ID: ${sessionData.sessionId}
- Start Time: ${format(sessionData.startTime, 'PPpp')}
- End Time: ${sessionData.endTime ? format(sessionData.endTime, 'PPpp') : 'Session ongoing'}
- Duration: ${formatDuration(sessionData.totalDuration)}

Integrity Assessment:
- Final Score: ${sessionData.integrityScore}/100
- Total Violations: ${sessionData.violations.length}

Violation Summary:
${Object.entries(violationCounts)
  .map(([type, count]) => `- ${getViolationLabel(type as ViolationType)}: ${count}`)
  .join('\n')}

Detailed Violations:
${sessionData.violations
  .map((v, i) => `${i + 1}. [${format(v.timestamp, 'HH:mm:ss')}] ${v.severity.toUpperCase()}: ${v.description}`)
  .join('\n')}

Report generated: ${format(new Date(), 'PPpp')}
    `.trim();

    return report;
  };

  const downloadReport = () => {
    const report = generateTextReport();
    const blob = new Blob([report], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `proctoring-report-${sessionData.sessionId}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-muted-foreground" />
            <CardTitle className="text-lg">Session Report</CardTitle>
          </div>
          <Button 
            onClick={downloadReport}
            variant="outline" 
            size="sm"
            className="gap-2"
          >
            <Download className="w-4 h-4" />
            Export Report
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Session Overview */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <User className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">Candidate:</span>
              <span className="font-medium">{sessionData.candidateName}</span>
            </div>
            
            <div className="flex items-center gap-2 text-sm">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">Duration:</span>
              <span className="font-medium">{formatDuration(sessionData.totalDuration)}</span>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <Shield className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">Integrity Score:</span>
              <Badge className={getScoreBadgeColor(sessionData.integrityScore)}>
                {sessionData.integrityScore}/100
              </Badge>
            </div>
            
            <div className="flex items-center gap-2 text-sm">
              <AlertTriangle className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">Total Violations:</span>
              <span className="font-medium">{sessionData.violations.length}</span>
            </div>
          </div>
        </div>

        <Separator />

        {/* Session Timeline */}
        <div>
          <h4 className="font-medium mb-3 text-foreground">Session Timeline</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Started:</span>
              <span>{format(sessionData.startTime, 'PPp')}</span>
            </div>
            {sessionData.endTime && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Ended:</span>
                <span>{format(sessionData.endTime, 'PPp')}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Session ID:</span>
              <span className="font-mono text-xs">{sessionData.sessionId}</span>
            </div>
          </div>
        </div>

        <Separator />

        {/* Violation Breakdown */}
        <div>
          <h4 className="font-medium mb-3 text-foreground">Violation Breakdown</h4>
          {Object.keys(violationCounts).length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No violations detected during this session
            </p>
          ) : (
            <div className="space-y-2">
              {Object.entries(violationCounts).map(([type, count]) => (
                <div key={type} className="flex justify-between items-center p-2 bg-muted/30 rounded">
                  <span className="text-sm">{getViolationLabel(type as ViolationType)}</span>
                  <Badge variant="secondary" className="bg-background">
                    {count}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Integrity Assessment */}
        <div className="bg-gradient-to-r from-security-surface to-security-accent/30 p-4 rounded-lg border border-border">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-foreground">Final Integrity Assessment</h4>
              <p className="text-sm text-muted-foreground mt-1">
                Based on monitoring analysis and violation detection
              </p>
            </div>
            <div className="text-right">
              <div className={`text-3xl font-bold ${getScoreColor(sessionData.integrityScore)}`}>
                {sessionData.integrityScore}
              </div>
              <div className="text-sm text-muted-foreground">out of 100</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};