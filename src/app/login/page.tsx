"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Lock, Loader2, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { cn } from "@/lib/utils/cn";

export default function LoginPage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [appName, setAppName] = useState("Kaldik & Doa");

  // check if already logged in
  useEffect(() => {
    const isAuth = localStorage.getItem("kaldik_auth");
    if (isAuth === "true") {
      router.replace("/dashboard");
    }
  }, [router]);

  // load app name
  useEffect(() => {
    const loadAppName = async () => {
      const { data } = await supabase
        .from("settings")
        .select("value")
        .eq("key", "APP_NAME")
        .single();
      if (data?.value) setAppName(data.value);
    };
    loadAppName();
  }, []);

  // auto focus input
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (pin.length !== 4) {
      setError("PIN harus 4 digit");
      return;
    }

    setLoading(true);

    try {
      const { data, error: fetchError } = await supabase
        .from("settings")
        .select("value")
        .eq("key", "APP_PIN")
        .single();

      if (fetchError) throw fetchError;

      const storedPin = data?.value;

      if (pin === storedPin) {
        localStorage.setItem("kaldik_auth", "true");
        localStorage.setItem("kaldik_auth_time", Date.now().toString());
        router.push("/dashboard");
      } else {
        setError("PIN salah. Silakan coba lagi.");
        setPin("");
        inputRef.current?.focus();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Gagal memverifikasi PIN";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handlePinChange = (value: string) => {
    const digitsOnly = value.replace(/\D/g, "").slice(0, 4);
    setPin(digitsOnly);
    setError("");
  };

  return (
    <div className="flex items-center justify-center min-h-[70vh]">
      <div className="w-full max-w-sm">
        {/* Card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Header */}
          <div className="px-6 pt-8 pb-4 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-indigo-50 flex items-center justify-center">
              <Lock className="w-8 h-8 text-indigo-600" />
            </div>
            <h1 className="text-xl font-bold text-slate-900">{appName}</h1>
            <p className="text-sm text-slate-500 mt-1">
              Masukkan PIN untuk mengakses aplikasi
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="px-6 pb-6">
            {/* PIN Input */}
            <div className="relative mb-4">
              <input
                ref={inputRef}
                type={showPin ? "text" : "password"}
                inputMode="numeric"
                maxLength={4}
                value={pin}
                onChange={(e) => handlePinChange(e.target.value)}
                placeholder="Masukkan 4 digit PIN"
                autoComplete="off"
                className={cn(
                  "w-full px-4 py-3 text-center text-2xl tracking-[0.5em] font-mono border rounded-xl focus:outline-none focus:ring-2 focus:border-transparent",
                  error
                    ? "border-red-300 focus:ring-red-500"
                    : "border-slate-300 focus:ring-indigo-500"
                )}
              />
              <button
                type="button"
                onClick={() => setShowPin(!showPin)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                tabIndex={-1}
              >
                {showPin ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {/* Error message */}
            {error && (
              <p className="text-sm text-red-500 text-center mb-4">{error}</p>
            )}

            {/* PIN dots indicator */}
            <div className="flex items-center justify-center gap-3 mb-6">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={cn(
                    "w-3 h-3 rounded-full transition-all duration-150",
                    i < pin.length
                      ? "bg-indigo-600 scale-110"
                      : "bg-slate-200"
                  )}
                />
              ))}
            </div>

            {/* Submit button */}
            <button
              type="submit"
              disabled={loading || pin.length !== 4}
              className={cn(
                "w-full flex items-center justify-center gap-2 py-3 text-sm font-semibold text-white rounded-xl transition-colors",
                loading || pin.length !== 4
                  ? "bg-slate-300 cursor-not-allowed"
                  : "bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800"
              )}
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Memverifikasi...
                </>
              ) : (
                "Masuk"
              )}
            </button>
          </form>
        </div>

        {/* Footer hint */}
        <p className="text-center text-xs text-slate-400 mt-4">
          Hubungi admin jika lupa PIN
        </p>
      </div>
    </div>
  );
}
