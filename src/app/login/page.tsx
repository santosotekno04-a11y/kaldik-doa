"use client";
export const dynamic = 'force-dynamic';

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [showForgotPin, setShowForgotPin] = useState(false);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-blue-600 via-blue-700 to-slate-800">
      {/* Decorative background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-slate-600/30 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-blue-400/10 blur-3xl" />
      </div>

      {/* Login Card */}
      <div className="relative w-full max-w-xs mx-4">
        <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl shadow-blue-900/30 overflow-hidden border border-white/20">
          {/* Header with gradient accent */}
          <div className="relative px-6 pt-8 pb-5 text-center">
            {/* Subtle gradient bar at top */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-400 via-blue-600 to-blue-800" />

            <div className="w-16 h-16 mx-auto mb-3 rounded-xl overflow-hidden shadow-lg shadow-blue-900/10 ring-2 ring-blue-100">
              <Image
                src="/logo-tbi.png"
                alt="Logo TBI"
                width={64}
                height={64}
                className="w-full h-full object-contain"
                priority
              />
            </div>
            <h1 className="text-lg font-bold text-slate-800 tracking-tight">
              {appName}
            </h1>
            <p className="text-xs text-slate-400 mt-1 font-medium">
              Masukkan PIN untuk mengakses aplikasi
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="px-6 pb-7">
            {/* PIN Input */}
            <div className="relative mb-3">
              <input
                ref={inputRef}
                type={showPin ? "text" : "password"}
                inputMode="numeric"
                maxLength={4}
                value={pin}
                onChange={(e) => handlePinChange(e.target.value)}
                placeholder="PIN"
                autoComplete="off"
                className={`w-full px-4 py-2.5 text-center text-base tracking-[0.35em] font-semibold font-mono border rounded-xl focus:outline-none focus:ring-2 focus:border-transparent transition-all ${
                  error
                    ? "border-red-300 focus:ring-red-400 bg-red-50/50"
                    : "border-slate-200 focus:ring-blue-500 bg-slate-50/50"
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPin(!showPin)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                tabIndex={-1}
              >
                {showPin ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            {/* Error message */}
            {error && (
              <p className="text-xs text-red-500 text-center mb-3 font-medium">
                {error}
              </p>
            )}

            {/* PIN dots indicator */}
            <div className="flex items-center justify-center gap-2.5 mb-4">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={`w-2.5 h-2.5 rounded-full transition-all duration-200 ${
                    i < pin.length
                      ? "bg-blue-600 scale-110 shadow-sm shadow-blue-600/40"
                      : "bg-slate-200"
                  }`}
                />
              ))}
            </div>

            {/* Submit button */}
            <button
              type="submit"
              disabled={loading || pin.length !== 4}
              className={`w-full flex items-center justify-center gap-2 py-2.5 text-sm font-semibold text-white rounded-xl transition-all duration-200 ${
                loading || pin.length !== 4
                  ? "bg-slate-300 cursor-not-allowed"
                  : "bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 active:from-blue-800 active:to-blue-900 shadow-lg shadow-blue-600/25 hover:shadow-blue-700/30"
              }`}
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Memverifikasi...
                </>
              ) : (
                "Masuk"
              )}
            </button>

            {/* Forgot PIN */}
            <div className="text-center mt-4">
              <button
                type="button"
                onClick={() => setShowForgotPin(!showForgotPin)}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors"
              >
                Lupa PIN?
              </button>
              {showForgotPin && (
                <div className="mt-2 p-2.5 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-[11px] text-amber-700 leading-relaxed">
                    Hubungi administrator untuk reset PIN
                  </p>
                </div>
              )}
            </div>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-[11px] text-blue-200/60 mt-5 font-medium">
          Hubungi admin jika lupa PIN
        </p>
      </div>
    </div>
  );
}
