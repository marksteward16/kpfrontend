export default function WaitingScreen() {
  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-6 px-4">
      {/* Spinner */}
      <div className="w-14 h-14 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />

      <div className="text-center">
        <h2 className="text-2xl font-bold text-white">Looking for someone…</h2>
        {/* PROSPECT: AD SPACE */}
        <div className="size-60 mx-auto my-5 bg-gray-300 flex items-center justify-center">
          <span className="font-bold text-gray-500">AD SPACE</span>
        </div>
        <p className="mt-2 text-gray-400 text-sm">
          Hang tight, we're finding you a chat partner.
        </p>
      </div>
    </div>
  );
}
