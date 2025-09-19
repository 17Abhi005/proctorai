import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ViolationEvent, ViolationType } from '@/types/proctoring';
import { AlertTriangle, Eye, Users, Phone, Book, Monitor, UserX } from 'lucide-react';
import { format } from 'date-fns';

interface AlertsPanelProps {
  violations: ViolationEvent[];
  isLive?: boolean;
}

export const AlertsPanel: React.FC<AlertsPanelProps> = ({ violations, isLive = true }) => {
  const getViolationIcon = (type: ViolationType) => {
    switch (type) {
      case ViolationType.FACE_NOT_VISIBLE:
        return <UserX className="w-4 h-4" />;
      case ViolationType.LOOKING_AWAY:
        return <Eye className="w-4 h-4" />;
      case ViolationType.MULTIPLE_FACES:
        return <Users className="w-4 h-4" />;
      case ViolationType.PHONE_DETECTED:
        return <Phone className="w-4 h-4" />;
      case ViolationType.BOOK_DETECTED:
        return <Book className="w-4 h-4" />;
      case ViolationType.DEVICE_DETECTED:
        return <Monitor className="w-4 h-4" />;
      default:
        return <AlertTriangle className="w-4 h-4" />;
    }
  };

  const getSeverityColor = (severity: ViolationEvent['severity']) => {
    switch (severity) {
      case 'low':
        return 'bg-alert-info/10 text-alert-info border-alert-info/20';
      case 'medium':
        return 'bg-alert-warning/10 text-alert-warning border-alert-warning/20';
      case 'high':
        return 'bg-alert-warning/20 text-alert-warning border-alert-warning/30';
      case 'critical':
        return 'bg-alert-critical/10 text-alert-critical border-alert-critical/20';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const recentViolations = violations
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    .slice(0, 20);

  const criticalViolations = violations.filter(v => v.severity === 'critical').length;
  const highViolations = violations.filter(v => v.severity === 'high').length;

  return (
    <Card className="h-full bg-card border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-foreground">
            Security Alerts
          </CardTitle>
          {isLive && (
            <Badge className="bg-status-online/10 text-status-online border-status-online/20 animate-pulse">
              LIVE
            </Badge>
          )}
        </div>
        
        {/* Alert Summary */}
        <div className="grid grid-cols-3 gap-3 mt-4">
          <div className="text-center p-3 bg-alert-critical/5 rounded-lg border border-alert-critical/10">
            <div className="text-2xl font-bold text-alert-critical">{criticalViolations}</div>
            <div className="text-xs text-muted-foreground">Critical</div>
          </div>
          <div className="text-center p-3 bg-alert-warning/5 rounded-lg border border-alert-warning/10">
            <div className="text-2xl font-bold text-alert-warning">{highViolations}</div>
            <div className="text-xs text-muted-foreground">High</div>
          </div>
          <div className="text-center p-3 bg-muted/30 rounded-lg border border-border">
            <div className="text-2xl font-bold text-foreground">{violations.length}</div>
            <div className="text-xs text-muted-foreground">Total</div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <ScrollArea className="h-[400px] px-6">
          {recentViolations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No violations detected</p>
              {isLive && <p className="text-xs mt-1">Monitoring in progress...</p>}
            </div>
          ) : (
            <div className="space-y-3 pb-4">
              {recentViolations.map((violation) => (
                <div
                  key={violation.id}
                  className="p-3 rounded-lg border bg-card/50 hover:bg-card/80 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 p-1.5 rounded-full ${getSeverityColor(violation.severity)}`}>
                      {getViolationIcon(violation.type)}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge 
                          variant="secondary"
                          className={`text-xs ${getSeverityColor(violation.severity)}`}
                        >
                          {violation.severity.toUpperCase()}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {format(violation.timestamp, 'HH:mm:ss')}
                        </span>
                      </div>
                      
                      <p className="text-sm text-foreground leading-relaxed">
                        {violation.description}
                      </p>
                      
                      {violation.duration && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Duration: {violation.duration}s
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
};