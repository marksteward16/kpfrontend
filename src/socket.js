import { io } from "socket.io-client";

const socketUrl =
  import.meta.env.VITE_SOCKET_URL || "https://kpbackend-ashy.vercel.app/";
//|| `${window.location.protocol}//${window.location.hostname}:4000`;

const socket = io(socketUrl, {
  autoConnect: false,
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: 5,
});

// Handle "Session ID unknown" errors by forcing a fresh connection
socket.on("connect_error", (error) => {
  if (error.message === "Session ID unknown" || error.data?.content?.message === "Session ID unknown") {
    console.warn("[socket] Session ID unknown - forcing fresh connection");
    socket.disconnect();
    setTimeout(() => {
      socket.connect();
    }, 1000);
  }
});

export default socket;
