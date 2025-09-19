import React, { useState } from 'react';
import { VideoMonitor } from '@/components/VideoMonitor';
import { AlertsPanel } from '@/components/AlertsPanel';
import { SessionReport } from '@/components/SessionReport';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Shield, Eye, Brain, FileText } from 'lucide-react';
import { SessionData } from '@/types/proctoring';

const Index = () => {
  const [candidateName, setCandidateName] = useState('John Doe');
  const [sessionData, setSessionData] = useState<SessionData | null>(null);

  const handleSessionUpdate = (data: SessionData) => {
    setSessionData(data);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border bg-security-surface">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-security-primary rounded-lg">
                <Shield className="w-6 h-6 text-security-primary-foreground" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">SecureProctor AI</h1>
                <p className="text-sm text-muted-foreground">Advanced Video Proctoring System</p>
              </div>
            </div>
            
            <div className="flex items-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-security-primary" />
                <span>Live Monitoring</span>
              </div>
              <div className="flex items-center gap-2">
                <Brain className="w-4 h-4 text-security-primary" />
                <span>AI Detection</span>
              </div>
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-security-primary" />
                <span>Smart Reporting</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-6">
        {/* Candidate Setup */}
        <div className="mb-6">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-lg">Interview Setup</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <div className="flex-1 max-w-sm">
                  <Label htmlFor="candidateName" className="text-sm font-medium">
                    Candidate Name
                  </Label>
                  <Input
                    id="candidateName"
                    value={candidateName}
                    onChange={(e) => setCandidateName(e.target.value)}
                    placeholder="Enter candidate name"
                    className="mt-1"
                  />
                </div>
                <div className="text-sm text-muted-foreground">
                  <p>✓ Camera permissions required</p>
                  <p>✓ AI detection system ready</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Monitoring Interface */}
        <ErrorBoundary>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Video Monitor - Takes up 2 columns on large screens */}
            <div className="lg:col-span-2">
              <VideoMonitor 
                candidateName={candidateName}
                onSessionUpdate={handleSessionUpdate}
              />
            </div>

            {/* Alerts Panel */}
            <div>
              <AlertsPanel 
                violations={sessionData?.violations || []}
                isLive={true}
              />
            </div>
          </div>
        </ErrorBoundary>

        {/* Session Report */}
        {sessionData && (
          <div className="mt-6">
            <SessionReport sessionData={sessionData} />
          </div>
        )}

        {/* Feature Overview */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="bg-gradient-to-br from-security-surface to-security-accent/30 border-security-accent">
            <CardContent className="p-6 text-center">
              <Eye className="w-8 h-8 mx-auto mb-3 text-security-primary" />
              <h3 className="font-semibold mb-2">Focus Detection</h3>
              <p className="text-sm text-muted-foreground">
                Advanced eye tracking and head pose analysis to detect when candidates look away
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-security-surface to-security-accent/30 border-security-accent">
            <CardContent className="p-6 text-center">
              <Brain className="w-8 h-8 mx-auto mb-3 text-security-primary" />
              <h3 className="font-semibold mb-2">Object Detection</h3>
              <p className="text-sm text-muted-foreground">
                AI-powered recognition of phones, books, notes, and unauthorized devices
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-security-surface to-security-accent/30 border-security-accent">
            <CardContent className="p-6 text-center">
              <FileText className="w-8 h-8 mx-auto mb-3 text-security-primary" />
              <h3 className="font-semibold mb-2">Smart Reporting</h3>
              <p className="text-sm text-muted-foreground">
                Automated integrity scoring and detailed violation reports with timestamps
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Index;