import { io } from "socket.io-client";

const socketUrl =
  import.meta.env.VITE_SOCKET_URL || "https://kpbackend-ashy.vercel.app/";
//|| `${window.location.protocol}//${window.location.hostname}:4000`;

const socket = io(socketUrl, {
  autoConnect: false,
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: Infinity,
  reconnectionDelayMax: 3000,
});

// Handle all connection errors gracefully
socket.on("connect_error", (error) => {
  console.warn("[socket] Connection error:", error.message);

  // If resume failed or session is unknown, clear it and force fresh connection
  if (
    error.message?.includes("Session ID unknown") ||
    error.message?.includes("ECONNREFUSED") ||
    error.message?.includes("closed before")
  ) {
    console.warn("[socket] Clearing stale session and reconnecting...");
    localStorage.removeItem("koopals_resume_session");
    setTimeout(() => {
      socket.disconnect();
      setTimeout(() => socket.connect(), 500);
    }, 1000);
  }
});

socket.on("disconnect", (reason) => {
  console.log("[socket] Disconnected:", reason);
});

export default socket;
