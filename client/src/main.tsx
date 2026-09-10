import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Import Inter font using Google Fonts
const link = document.createElement('link');
link.rel = 'stylesheet';
link.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap';
document.head.appendChild(link);

createRoot(document.getElementById("root")!).render(<App />);
