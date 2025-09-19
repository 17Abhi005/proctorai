import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { setupGlobalErrorHandlers } from "./utils/errorReporting";

// Initialize global error handling for production monitoring
setupGlobalErrorHandlers();

createRoot(document.getElementById("root")!).render(<App />);
