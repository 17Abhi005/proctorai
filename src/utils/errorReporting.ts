// Error reporting utilities for production monitoring

interface ErrorReport {
  message: string;
  stack?: string;
  url: string;
  userAgent: string;
  timestamp: Date;
  userId?: string;
  sessionId?: string;
}

export const reportError = (error: Error, context?: Record<string, any>) => {
  const errorReport: ErrorReport = {
    message: error.message,
    stack: error.stack,
    url: window.location.href,
    userAgent: navigator.userAgent,
    timestamp: new Date(),
    ...context
  };

  if (process.env.NODE_ENV === 'production') {
    // In production, send to your error reporting service (e.g., Sentry, LogRocket)
    console.error('Error Report:', errorReport);
    
    // Example: Send to a monitoring service
    // sendToErrorService(errorReport);
  } else {
    console.error('Development Error:', errorReport);
  }
};

export const setupGlobalErrorHandlers = () => {
  // Handle uncaught JavaScript errors
  window.addEventListener('error', (event) => {
    reportError(new Error(event.message), {
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno
    });
  });

  // Handle unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    reportError(new Error('Unhandled Promise Rejection'), {
      reason: event.reason,
      promise: event.promise
    });
  });
};

// Camera-specific error handling
export const handleCameraError = (error: any) => {
  let message = 'Camera access failed';
  
  if (error.name === 'NotAllowedError') {
    message = 'Camera permission denied by user';
  } else if (error.name === 'NotFoundError') {
    message = 'No camera device found';
  } else if (error.name === 'NotReadableError') {
    message = 'Camera is already in use by another application';
  } else if (error.name === 'OverconstrainedError') {
    message = 'Camera constraints could not be satisfied';
  }

  reportError(new Error(message), {
    originalError: error.name,
    errorType: 'camera'
  });

  return message;
};