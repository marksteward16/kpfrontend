import { io } from "socket.io-client";

const socketUrl =
  import.meta.env.VITE_SOCKET_URL ||
  "https://kpbackend-ashy.vercel.app/" ||
  `${window.location.protocol}//${window.location.hostname}:4000`;

const socket = io(socketUrl, { autoConnect: false });

export default socket;
