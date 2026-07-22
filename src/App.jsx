import { useState, useEffect } from "react";
import socket from "./socket";
import UsernameScreen from "./components/UsernameScreen";
import WaitingScreen from "./components/WaitingScreen";
import ChatRoom from "./components/ChatRoom";

const RESUME_STORAGE_KEY = "koopals_resume_session";
const PROFILE_STORAGE_KEY = "koopals_profile";

function saveProfile(profile) {
  try {
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // Ignore storage write failures (e.g. quota limits).
  }
}

function loadProfile() {
  try {
    const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;

    return {
      username: typeof parsed.username === "string" ? parsed.username : "",
      photoData:
        typeof parsed.photoData === "string" && parsed.photoData.length > 0
          ? parsed.photoData
          : null,
    };
  } catch {
    return null;
  }
}

// App states
const SCREEN = {
  USERNAME: "username",
  WAITING: "waiting",
  CHAT: "chat",
};

function App() {
  const [screen, setScreen] = useState(SCREEN.USERNAME);
  const [username, setUsername] = useState(() => loadProfile()?.username || "");
  const [photoData, setPhotoData] = useState(
    () => loadProfile()?.photoData || null,
  );
  const [partnerUsername, setPartnerUsername] = useState("");
  const [chatMode, setChatMode] = useState("regular");
  const [revealAt, setRevealAt] = useState(null);
  const [myHasPhoto, setMyHasPhoto] = useState(false);
  const [partnerHasPhoto, setPartnerHasPhoto] = useState(false);
  const [chatHistory, setChatHistory] = useState([]);

  function saveResumeSession({ roomId, resumeToken }) {
    if (!roomId || !resumeToken) return;
    localStorage.setItem(
      RESUME_STORAGE_KEY,
      JSON.stringify({ roomId, resumeToken }),
    );
  }

  function loadResumeSession() {
    const raw = localStorage.getItem(RESUME_STORAGE_KEY);
    if (!raw) return null;

    try {
      const parsed = JSON.parse(raw);
      if (
        parsed &&
        typeof parsed.roomId === "string" &&
        typeof parsed.resumeToken === "string"
      ) {
        return parsed;
      }
    } catch {
      // Ignore malformed persisted data.
    }

    localStorage.removeItem(RESUME_STORAGE_KEY);
    return null;
  }

  function clearResumeSession() {
    localStorage.removeItem(RESUME_STORAGE_KEY);
  }

  useEffect(() => {
    function onWaiting() {
      setScreen(SCREEN.WAITING);
    }

    function onChatStarted({
      roomId,
      resumeToken,
      myUsername,
      partnerUsername,
      chatMode,
      revealAt,
      myHasPhoto,
      partnerHasPhoto,
    }) {
      saveResumeSession({ roomId, resumeToken });
      if (typeof myUsername === "string" && myUsername.length > 0) {
        setUsername(myUsername);
      }
      setChatHistory([]);
      setPartnerUsername(partnerUsername);
      setChatMode(chatMode || "regular");
      setRevealAt(revealAt || null);
      setMyHasPhoto(Boolean(myHasPhoto));
      setPartnerHasPhoto(Boolean(partnerHasPhoto));
      setScreen(SCREEN.CHAT);
    }

    function onResumeSuccess({
      roomId,
      myUsername,
      partnerUsername,
      chatMode,
      revealAt,
      myHasPhoto,
      partnerHasPhoto,
      messageHistory,
    }) {
      const cached = loadResumeSession();
      if (cached && cached.roomId === roomId) {
        saveResumeSession(cached);
      }

      if (typeof myUsername === "string" && myUsername.length > 0) {
        setUsername(myUsername);
      }
      setChatHistory(Array.isArray(messageHistory) ? messageHistory : []);
      setPartnerUsername(partnerUsername);
      setChatMode(chatMode || "regular");
      setRevealAt(revealAt || null);
      setMyHasPhoto(Boolean(myHasPhoto));
      setPartnerHasPhoto(Boolean(partnerHasPhoto));
      setScreen(SCREEN.CHAT);
    }

    function onChatEnded() {
      clearResumeSession();
    }

    function onResumeFailed() {
      console.warn("[app] Resume failed - clearing stale session");
      clearResumeSession();
    }

    function onConnect() {
      const resume = loadResumeSession();
      if (resume) {
        socket.emit("resume_chat", resume);
      }
    }

    socket.on("connect", onConnect);
    socket.on("waiting", onWaiting);
    socket.on("chat_started", onChatStarted);
    socket.on("resume_success", onResumeSuccess);
    socket.on("resume_failed", onResumeFailed);
    socket.on("chat_ended", onChatEnded);

    if (!socket.connected) {
      socket.connect();
    } else {
      onConnect();
    }

    return () => {
      socket.off("connect", onConnect);
      socket.off("waiting", onWaiting);
      socket.off("chat_started", onChatStarted);
      socket.off("resume_success", onResumeSuccess);
      socket.off("resume_failed", onResumeFailed);
      socket.off("chat_ended", onChatEnded);
    };
  }, []);

  function requestFindChat(nextUsername, nextPhotoData) {
    socket.emit("find_chat", {
      username: nextUsername,
      photoData: nextPhotoData || null,
    });

    if (!socket.connected) {
      socket.connect();
    }
  }

  function handleStart(chosenUsername, chosenPhotoData) {
    setUsername(chosenUsername);
    setPhotoData(chosenPhotoData || null);
    saveProfile({
      username: chosenUsername,
      photoData: chosenPhotoData || null,
    });
    setChatHistory([]);
    clearResumeSession();
    setScreen(SCREEN.WAITING);
    requestFindChat(chosenUsername, chosenPhotoData);
  }

  function handleChatEnded() {
    clearResumeSession();
    setChatHistory([]);
    setScreen(SCREEN.WAITING);
    requestFindChat(username, photoData);
  }

  return (
    <>
      {screen === SCREEN.USERNAME && <UsernameScreen onStart={handleStart} />}
      {screen === SCREEN.WAITING && <WaitingScreen />}
      {screen === SCREEN.CHAT && (
        <ChatRoom
          username={username}
          partnerUsername={partnerUsername}
          chatMode={chatMode}
          revealAt={revealAt}
          myHasPhoto={myHasPhoto}
          partnerHasPhoto={partnerHasPhoto}
          initialMessages={chatHistory}
          onChatEnded={handleChatEnded}
        />
      )}
    </>
  );
}

export default App;
