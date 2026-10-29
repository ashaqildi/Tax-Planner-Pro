import { useState, useEffect } from "react";
const logoUrl = "/images/brand.png";

const STORAGE_KEY = "shaqildi_access_granted";
const ACCESS_CODE = process.env.NEXT_PUBLIC_ACCESS_CODE as string;

interface Props {
  children: React.ReactNode;
}

export default function PasscodeGate({ children }: Props) {
  const [granted, setGranted] = useState(false);
  const [input, setInput] = useState("");
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem(STORAGE_KEY) === "true") {
      setGranted(true);
    }
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (input === ACCESS_CODE) {
      sessionStorage.setItem(STORAGE_KEY, "true");
      setGranted(true);
    } else {
      setError(true);
      setShake(true);
      setInput("");
      setTimeout(() => setShake(false), 600);
    }
  }

  if (granted) return <>{children}</>;

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#1a1f2e]">
      <div className="w-full max-w-sm px-4">
        <div className="text-center mb-10">
          <div className="bg-white rounded-2xl px-6 py-4 mb-5 inline-block shadow-lg">
            <img src={logoUrl} alt="Shaqildi CPA Group" className="h-14 w-auto" />
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Enter your access code to continue
          </p>
        </div>

        <form onSubmit={handleSubmit} className={shake ? "animate-shake" : ""}>
          <div className="mb-4">
            <input
              type="password"
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                setError(false);
              }}
              placeholder="Access code"
              autoFocus
              className={`w-full px-4 py-3 rounded-xl text-sm text-white placeholder-slate-500 bg-white/5 border transition-all outline-none focus:ring-2 ${
                error
                  ? "border-red-500/60 focus:ring-red-500/30"
                  : "border-white/10 focus:border-amber-500/50 focus:ring-amber-500/20"
              }`}
            />
            {error && (
              <p className="mt-2 text-xs text-red-400 text-center">
                Incorrect access code. Please try again.
              </p>
            )}
          </div>

          <button
            type="submit"
            className="w-full py-3 rounded-xl text-sm font-semibold text-[#1a1f2e] bg-amber-400 hover:bg-amber-300 transition-colors cursor-pointer"
          >
            Continue
          </button>
        </form>
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          15%       { transform: translateX(-8px); }
          30%       { transform: translateX(8px); }
          45%       { transform: translateX(-6px); }
          60%       { transform: translateX(6px); }
          75%       { transform: translateX(-3px); }
          90%       { transform: translateX(3px); }
        }
        .animate-shake { animation: shake 0.55s ease; }
      `}</style>
    </div>
  );
}
