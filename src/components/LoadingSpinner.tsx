import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Brain, Camera } from 'lucide-react';

interface LoadingSpinnerProps {
  message?: string;
  type?: 'default' | 'ai' | 'camera';
  showCard?: boolean;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  message = 'Loading...', 
  type = 'default',
  showCard = true 
}) => {
  const getIcon = () => {
    switch (type) {
      case 'ai':
        return <Brain className="w-6 h-6 text-primary animate-pulse" />;
      case 'camera':
        return <Camera className="w-6 h-6 text-primary animate-pulse" />;
      default:
        return <Loader2 className="w-6 h-6 animate-spin text-primary" />;
    }
  };

  const content = (
    <div className="flex flex-col items-center justify-center p-8 space-y-4">
      {getIcon()}
      <div className="text-center">
        <p className="text-sm font-medium text-foreground">{message}</p>
        {type === 'ai' && (
          <p className="text-xs text-muted-foreground mt-1">
            Initializing AI detection models...
          </p>
        )}
      </div>
    </div>
  );

  if (!showCard) {
    return content;
  }

  return (
    <Card className="w-full">
      <CardContent className="p-0">
        {content}
      </CardContent>
    </Card>
  );
};