import { useState, useEffect, useRef, useCallback } from "react";
import socket from "../socket";

export default function ChatRoom({
  username,
  partnerUsername,
  chatMode,
  revealAt,
  myHasPhoto,
  partnerHasPhoto,
  initialMessages = [],
  onChatEnded,
}) {
  const [messages, setMessages] = useState(
    Array.isArray(initialMessages) ? initialMessages : [],
  );
  const [input, setInput] = useState("");
  const [ended, setEnded] = useState(false);
  const [partnerTyping, setPartnerTyping] = useState(false);
  const [remainingMs, setRemainingMs] = useState(
    revealAt ? Math.max(0, revealAt - Date.now()) : 0,
  );
  const [photoRevealDone, setPhotoRevealDone] = useState(
    Array.isArray(initialMessages)
      ? initialMessages.some((msg) => msg?.type === "photo_reveal")
      : false,
  );
  const [viewerPhoto, setViewerPhoto] = useState(null);
  const [viewerLabel, setViewerLabel] = useState("");
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const isTypingRef = useRef(false);
  const hasMountedRef = useRef(false);

  useEffect(() => {
    const safeInitialMessages = Array.isArray(initialMessages)
      ? initialMessages
      : [];
    setMessages(safeInitialMessages);
    setPhotoRevealDone(
      safeInitialMessages.some((msg) => msg?.type === "photo_reveal"),
    );
  }, [initialMessages]);

  useEffect(() => {
    function onKeyDown(event) {
      if (event.key === "Escape") {
        setViewerPhoto(null);
        setViewerLabel("");
      }
    }

    if (viewerPhoto) {
      window.addEventListener("keydown", onKeyDown);
    }

    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [viewerPhoto]);

  useEffect(() => {
    function onReceiveMessage(data) {
      setMessages((prev) => [...prev, data]);
    }

    function onChatEnded() {
      setEnded(true);
      setPartnerTyping(false);
    }

    function onPartnerTyping() {
      setPartnerTyping(true);
    }

    function onPartnerStopTyping() {
      setPartnerTyping(false);
    }

    function onRevealTimer({ remainingMs }) {
      setRemainingMs(Math.max(0, Number(remainingMs) || 0));
    }

    function onPhotosRevealed({ myPhoto, partnerPhoto, timestamp }) {
      setRemainingMs(0);
      setPhotoRevealDone(true);
      setMessages((prev) => [
        ...prev,
        {
          type: "photo_reveal",
          myPhoto: myPhoto || null,
          partnerPhoto: partnerPhoto || null,
          timestamp:
            typeof timestamp === "number" && Number.isFinite(timestamp)
              ? timestamp
              : Date.now(),
        },
      ]);
    }

    socket.on("receive_message", onReceiveMessage);
    socket.on("chat_ended", onChatEnded);
    socket.on("partner_typing", onPartnerTyping);
    socket.on("partner_stop_typing", onPartnerStopTyping);
    socket.on("reveal_timer", onRevealTimer);
    socket.on("photos_revealed", onPhotosRevealed);

    return () => {
      socket.off("receive_message", onReceiveMessage);
      socket.off("chat_ended", onChatEnded);
      socket.off("partner_typing", onPartnerTyping);
      socket.off("partner_stop_typing", onPartnerStopTyping);
      socket.off("reveal_timer", onRevealTimer);
      socket.off("photos_revealed", onPhotosRevealed);
      clearTimeout(typingTimeoutRef.current);
    };
  }, []);

  // Auto-scroll to latest message or typing indicator
  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }

    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, partnerTyping]);

  useEffect(() => {
    if (window.matchMedia("(pointer: fine)").matches) {
      inputRef.current?.focus({ preventScroll: true });
    }
  }, []);

  const emitStopTyping = useCallback(() => {
    if (isTypingRef.current) {
      socket.emit("stop_typing");
      isTypingRef.current = false;
    }
  }, []);

  function handleInputChange(e) {
    setInput(e.target.value);
    if (ended) return;

    if (!isTypingRef.current) {
      socket.emit("typing");
      isTypingRef.current = true;
    }

    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(emitStopTyping, 1500);
  }

  function sendMessage(e) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || ended) return;
    clearTimeout(typingTimeoutRef.current);
    emitStopTyping();
    socket.emit("send_message", { message: trimmed });
    setInput("");
  }

  function handleEndChat() {
    socket.emit("end_chat");
  }

  function formatCountdown(ms) {
    const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
    const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
    const seconds = String(totalSeconds % 60).padStart(2, "0");
    return `${minutes}:${seconds}`;
  }

  function openPhotoViewer(photoSrc, label) {
    if (!photoSrc) return;
    setViewerPhoto(photoSrc);
    setViewerLabel(label || "Revealed photo");
  }

  function closePhotoViewer() {
    setViewerPhoto(null);
    setViewerLabel("");
  }

  const regularModeReason =
    !myHasPhoto && !partnerHasPhoto
      ? "Regular chat only: neither user added a photo."
      : !myHasPhoto
        ? "Regular chat only: you did not add a photo."
        : !partnerHasPhoto
          ? "Regular chat only: your partner did not add a photo."
          : "Regular chat only: photo reveal is disabled for this session.";

  return (
    <div className="h-dvh overflow-hidden bg-gray-950 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-widest">
            Chatting with
          </p>
          <p className="text-white font-semibold text-lg leading-tight">
            {partnerUsername}
          </p>
        </div>

        {!ended && (
          <button
            onClick={handleEndChat}
            className="bg-red-600 hover:bg-red-500 text-white text-sm font-medium px-4 py-2 rounded-xl transition"
          >
            End Chat
          </button>
        )}
      </header>

      {/* Messages */}
      <main className="flex-1 min-h-0 max-w-6xl mx-auto w-full overflow-y-auto overscroll-contain px-4 py-6 space-y-1.5">
        {/* System message */}
        <div className="flex justify-center">
          <span className="text-xs text-gray-600 bg-gray-900 px-3 py-1 rounded-full">
            You are now connected with{" "}
            <span className="text-gray-400">{partnerUsername}</span>
          </span>
        </div>

        {chatMode === "photo_reveal" && !ended && !photoRevealDone && (
          <div className="flex justify-center">
            <span className="text-xs text-amber-300 bg-amber-950/40 border border-amber-800 px-3 py-1 rounded-full">
              Photo reveal in {formatCountdown(remainingMs)} (synced)
            </span>
          </div>
        )}

        {chatMode === "regular" && (
          <div className="flex justify-center">
            <span className="text-xs text-gray-300 bg-gray-900 border border-gray-800 px-3 py-1 rounded-full">
              {regularModeReason}
            </span>
          </div>
        )}

        {messages.map((msg, idx) => {
          if (msg.type === "photo_reveal") {
            return (
              <div
                key={idx}
                className="bg-gray-900 border border-gray-800 rounded-xl p-4"
              >
                <p className="text-xs text-amber-300 mb-3 text-center">
                  Photos are now revealed.
                </p>
                <div className="flex justify-center">
                  <div className="relative w-56 h-32 sm:w-72 sm:h-40">
                    <button
                      type="button"
                      onClick={() =>
                        openPhotoViewer(msg.myPhoto, "Your revealed photo")
                      }
                      className="absolute left-0 top-1/2 -translate-y-1/2 w-32 h-32 sm:w-40 sm:h-40 rounded-full ring-2 ring-indigo-400 overflow-hidden bg-gray-800 cursor-zoom-in focus:outline-none focus:ring-2 focus:ring-indigo-300 animate-fade-right"
                      aria-label="Open your revealed photo"
                    >
                      <img
                        src={msg.myPhoto}
                        alt="Revealed photo"
                        className="w-full h-full object-cover animate-fade-right animate-delay-200"
                      />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        openPhotoViewer(
                          msg.partnerPhoto,
                          "Partner revealed photo",
                        )
                      }
                      className="absolute right-0 top-1/2 -translate-y-1/2 w-32 h-32 sm:w-40 sm:h-40 rounded-full ring-2 ring-amber-400 overflow-hidden bg-gray-800 cursor-zoom-in focus:outline-none focus:ring-2 focus:ring-amber-300 animate-fade-left animate-delay-300"
                      aria-label="Open partner revealed photo"
                    >
                      <img
                        src={msg.partnerPhoto}
                        alt="Revealed photo"
                        className="w-full h-full object-cover animate-fade-left animate-delay-600"
                      />
                    </button>
                  </div>
                </div>
              </div>
            );
          }

          const isMine = msg.from === username;
          return (
            <div
              key={idx}
              className={`flex flex-col ${isMine ? "items-end animate-fade-up" : "items-start"}`}
            >
              <div
                className={`max-w-xs md:max-w-md lg:max-w-lg px-4 py-2.5 rounded-2xl text-sm wrap-break-word ${
                  isMine
                    ? "bg-indigo-600 text-white rounded-br-sm"
                    : "bg-gray-800 text-gray-100 rounded-bl-sm"
                }`}
              >
                {msg.message}
              </div>
            </div>
          );
        })}

        {/* Chat ended notice */}
        {ended && (
          <div className="flex justify-center mt-4">
            <span className="text-xs text-gray-600 bg-gray-900 px-3 py-1 rounded-full">
              The chat has ended.
            </span>
          </div>
        )}

        {/* Typing indicator */}
        {partnerTyping && !ended && (
          <div className="flex items-start gap-2 animate-fade-up animate-duration-200">
            <div className="bg-gray-800 px-4 py-3 rounded-2xl rounded-bl-sm flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce animate-delay-none" />
              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce animate-delay-150" />
              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce animate-delay-300" />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </main>

      {/* Footer */}
      <footer className="sticky bottom-0 z-20 bg-gray-900 border-t border-gray-800 py-3 px-2">
        {ended ? (
          <button
            onClick={onChatEnded}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-3 rounded-xl transition"
          >
            Find Another Chat
          </button>
        ) : (
          <form onSubmit={sendMessage}>
            <div className="flex w-full items-center gap-2 px-3 sm:px-4">
              <input
                type="text"
                ref={inputRef}
                value={input}
                onChange={handleInputChange}
                placeholder="Type a message…"
                maxLength={500}
                className="min-w-0 flex-1 bg-gray-800 text-white placeholder-gray-500 border border-gray-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
              />
              <button
                type="submit"
                disabled={input.trim().length === 0}
                className="shrink-0 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white px-4 sm:px-5 py-2.5 rounded-xl font-medium text-sm transition"
              >
                Send
              </button>
            </div>
          </form>
        )}
      </footer>

      {viewerPhoto && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={closePhotoViewer}
          role="dialog"
          aria-modal="true"
          aria-label="Photo viewer"
        >
          <button
            type="button"
            onClick={closePhotoViewer}
            className="absolute top-4 right-4 h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 text-white text-2xl leading-none flex items-center justify-center"
            aria-label="Close photo viewer"
          >
            X
          </button>

          <img
            src={viewerPhoto}
            alt={viewerLabel || "Expanded revealed photo"}
            className="max-w-full max-h-full object-contain rounded-lg"
            onClick={(event) => event.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
