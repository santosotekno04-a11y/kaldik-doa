'use client';
export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Building2, CalendarClock,
  ChevronRight, ArrowRight, Clock, Loader2,
  Church, BookOpen, Cake,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { supabase } from '@/lib/supabase/client';
import { getMonthName } from '@/lib/utils/date';
import Link from 'next/link';

/* ============================================================
   Bible Verses — rotates daily based on date
   ============================================================ */
const BIBLE_VERSES: { text: string; ref: string }[] = [
  { text: "Karena Aku ini mengetahui rancangan-rancangan apa yang ada pada-Ku mengenai kamu, demikianlah firman TUHAN, yaitu rancangan damai sejahtera dan bukan rancangan celaka, untuk memberikan kepadamu hari depan yang penuh harapan.", ref: "Yeremia 29:11" },
  { text: "TUHAN adalah gembalaku, takkan kekurangan aku. Ia membaringkan aku di padang yang berumput hijau, Ia membimbing aku ke air yang tenang.", ref: "Mazmur 23:1-2" },
  { text: "Percayalah kepada TUHAN dengan segenap hatimu, dan janganlah bersandar kepada pengertianmu sendiri. Akuilah Dia dalam segala lakumu, maka Ia akan meluruskan jalanmu.", ref: "Amsal 3:5-6" },
  { text: "Tetapi orang-orang yang menanti-nantikan TUHAN mendapat kekuatan baru: mereka seumpama rajawali yang naik terbang dengan kekuatan sayapnya; mereka berlari dan tidak menjadi lesu, mereka berjalan dan tidak menjadi lelah.", ref: "Yesaya 40:31" },
  { text: "Segala perkara dapat kutanggung di dalam Dia yang memberi kekuatan kepadaku.", ref: "Filipi 4:13" },
  { text: "Janganlah hendaknya kamu kuatir tentang apa pun juga, tetapi nyatakanlah dalam segala hal keinginanmu kepada Allah dalam doa dan permohonan dengan ucapan syukur.", ref: "Filipi 4:6" },
  { text: "Sebab Allah bukan memberikan kepada kita roh ketakutan, melainkan roh yang membangkitkan kekuatan, kasih dan ketertiban.", ref: "2 Timotius 1:7" },
  { text: "Berbahagialah orang yang mengandalkan TUHAN, yang menaruh harapannya pada TUHAN!", ref: "Yeremia 17:7" },
  { text: "TUHAN adalah terangku dan keselamatanku, kepada siapakah aku harus takut? TUHAN adalah benteng hidupku, terhadap siapakah aku harus gemetar?", ref: "Mazmur 27:1" },
  { text: "Kasih TUHAN tidak berkesudahan, rahmat-Nya tidak pernah habis, setiap pagi menjadi baru, besar kesetiaan-Mu!", ref: "Ratapan 3:22-23" },
  { text: "Aku berkata kepadamu: Sesungguhnya setiap orang yang percaya kepada-Ku, akan melakukan juga pekerjaan-pekerjaan yang Aku lakukan, bahkan pekerjaan-pekerjaan yang lebih besar dari pada itu.", ref: "Yohanes 14:12" },
  { text: "Marilah kepada-Ku, semua yang letih lesu dan berbeban berat, Aku akan memberi kelegaan kepadamu.", ref: "Matius 11:28" },
  { text: "Yesus Kristus tetap sama, baik kemarin maupun hari ini dan sampai selama-lamanya.", ref: "Ibrani 13:8" },
  { text: "Jikalau kamu tinggal di dalam Aku dan firman-Ku tinggal di dalam kamu, mintalah apa saja yang kamu kehendaki, dan kamu akan menerimanya.", ref: "Yohanes 15:7" },
  { text: "Hati yang gembira adalah obat yang manjur, tetapi semangat yang patah mengeringkan tulang.", ref: "Amsal 17:22" },
  { text: "TUHAN dekat kepada semua orang yang berseru kepada-Nya, kepada semua orang yang berseru kepada-Nya dalam kesetiaan.", ref: "Mazmur 145:18" },
  { text: "Kita tahu sekarang, bahwa Allah turut bekerja dalam segala sesuatu untuk mendatangkan kebaikan bagi mereka yang mengasihi Dia.", ref: "Roma 8:28" },
  { text: "Janganlah takut, sebab Aku menyertai engkau, janganlah bimbang, sebab Aku ini Allahmu; Aku akan meneguhkan, bahkan akan menolong engkau.", ref: "Yesaya 41:10" },
  { text: "Carilah TUHAN selama Ia berkenan ditemui; berserulah kepada-Nya selama Ia dekat!", ref: "Yesaya 55:6" },
  { text: "Dan pengharapan tidak mengecewakan, karena kasih Allah telah dicurahkan di dalam hati kita oleh Roh Kudus yang telah dikaruniakan kepada kita.", ref: "Roma 5:5" },
  { text: "Biarlah segala yang bernafas memuji TUHAN! Haleluya!", ref: "Mazmur 150:6" },
  { text: "Karena begitu besar kasih Allah akan dunia ini, sehingga Ia telah mengaruniakan Anak-Nya yang tunggal, supaya setiap orang yang percaya kepada-Nya tidak binasa, melainkan beroleh hidup yang kekal.", ref: "Yohanes 3:16" },
  { text: "Aku adalah pokok anggur dan kamulah ranting-rantingnya. Barangsiapa tinggal di dalam Aku dan Aku di dalam dia, ia berbuah banyak.", ref: "Yohanes 15:5" },
  { text: "TUHAN akan berperang untuk kamu, dan kamu diam saja.", ref: "Keluaran 14:14" },
  { text: "Berikanlah kepada kami hikmat, supaya kami dapat memperhitungkan hari-hari kami dengan tepat, sehingga kami beroleh hati yang bijaksana.", ref: "Mazmur 90:12" },
  { text: "Jadikanlah segala pekerjaanmu menjadi karya bagi kemuliaan Tuhan, maka Ia akan memberkati setiap langkahmu.", ref: "Kolose 3:23" },
  { text: "Sebab di mana dua atau tiga orang berkumpul dalam nama-Ku, di situ Aku ada di tengah-tengah mereka.", ref: "Matius 18:20" },
  { text: "Ya TUHAN, Engkaulah Allahku; aku hendak meninggikan Engkau, aku hendak memuji nama-Mu, sebab Kaubuat ajaib-ajaib.", ref: "Yesaya 25:1" },
  { text: "Bersyukurlah kepada TUHAN, sebab Ia baik! Bahwasanya untuk selama-lamanya kasih setia-Nya.", ref: "Mazmur 136:1" },
  { text: "Mintalah, maka akan diberikan kepadamu; carilah, maka kamu akan mendapat; ketoklah, maka pintu akan dibukakan bagimu.", ref: "Matius 7:7" },
];

function getDailyVerse(): { text: string; ref: string } {
  const today = new Date();
  const dayOfYear = Math.floor((today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / 86400000);
  return BIBLE_VERSES[dayOfYear % BIBLE_VERSES.length];
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour >= 0 && hour < 12) return 'Selamat pagi';
  if (hour >= 12 && hour < 18) return 'Selamat siang';
  return 'Selamat malam';
}

/* ============================================================
   Main Dashboard
   ============================================================ */
interface AgendaItem {
  id: string;
  nama_kegiatan: string;
  kategori: string;
  tanggal_mulai: string | null;
  tanggal_selesai: string | null;
  status: string;
  unit?: { name: string; color: string } | null;
}

interface JadwalItem {
  id: string;
  tanggal: string;
  pelayan_ibadah: string;
  pemberita_firman: string;
  tema_ibadah_bulanan: string;
  nas_alkitab: string;
  bulan: string;
}

interface HMItem {
  id: string;
  tanggal: string;
  pelayan_holy_morning: string;
  tema_bulanan: string;
  nas_alkitab: string;
  bulan: string;
}

interface PortalItem {
  sheetName: string;
  row: number;
  unit: string;
  tanggal: string;
  tanggalDisplay?: string;
  acara: string;
  jamMulai: string;
  jamSelesai: string;
  jam: string;
  hadirin: number;
  status: string;
}

interface BirthdayItem {
  id: string;
  nama: string;
  tanggal_lahir: string;
  jabatan: string | null;
  unit?: { name: string; color: string } | null;
}

export default function DashboardPage() {
  const [jadwalList, setJadwalList] = useState<JadwalItem[]>([]);
  const [portalList, setPortalList] = useState<PortalItem[]>([]);
  const [agendaTerdekat, setAgendaTerdekat] = useState<AgendaItem[]>([]);
  const [birthdayList, setBirthdayList] = useState<BirthdayItem[]>([]);
  const [hmList, setHmList] = useState<HMItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [jadwalTab, setJadwalTab] = useState<'ibadah' | 'holy_morning'>('ibadah');

  const { todayStr, in7Days, bulan, tahun } = useMemo(() => {
    const n = new Date();
    return {
      todayStr: n.toISOString().split('T')[0],
      in7Days: new Date(n.getTime() + 7 * 86400000).toISOString().split('T')[0],
      bulan: n.getMonth() + 1,
      tahun: n.getFullYear(),
    };
  }, []);

  const dailyVerse = useMemo(() => getDailyVerse(), []);
  const greeting = useMemo(() => getGreeting(), []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [
        jadwalRes,
        agendaTerdekatRes,
        hmRes,
        birthdayRes,
      ] = await Promise.all([
        supabase
          .from('jadwal_ibadah')
          .select('id, tanggal, pelayan_ibadah, pemberita_firman, tema_ibadah_bulanan, nas_alkitab, bulan')
          .eq('tahun_ajaran', '2026-2027')
          .order('tanggal_sort', { ascending: true, nullsFirst: false })
          .limit(10),
        supabase
          .from('kaldik')
          .select('id, nama_kegiatan, kategori, tanggal_mulai, tanggal_selesai, status, unit:units(name, color)')
          .gte('tanggal_mulai', todayStr)
          .lte('tanggal_mulai', in7Days)
          .neq('status', 'Dibatalkan')
          .order('tanggal_mulai', { ascending: true })
          .limit(10),
        supabase
          .from('holy_morning')
          .select('id, tanggal, pelayan_holy_morning, tema_bulanan, tema_mingguan, nas_alkitab, bulan')
          .eq('tahun_ajaran', '2026-2027')
          .order('tanggal_sort', { ascending: true, nullsFirst: false })
          .limit(10),
        supabase
          .from('karyawan')
          .select('id, nama, tanggal_lahir, jabatan, unit:units(name, color)')
          .eq('status', 'Aktif')
          .not('tanggal_lahir', 'is', null),
      ]);

      setJadwalList((jadwalRes.data || []) as unknown as JadwalItem[]);
      setAgendaTerdekat((agendaTerdekatRes.data || []) as unknown as AgendaItem[]);
      setHmList((hmRes.data || []) as unknown as HMItem[]);

      // Filter birthday for current month
      const allBirthdays = (birthdayRes.data || []) as unknown as BirthdayItem[];
      const monthBirthdays = allBirthdays.filter((k) => {
        if (!k.tanggal_lahir) return false;
        const parts = k.tanggal_lahir.split('-');
        return parseInt(parts[1]) === bulan;
      }).sort((a, b) => {
        const dayA = parseInt(a.tanggal_lahir.split('-')[2]);
        const dayB = parseInt(b.tanggal_lahir.split('-')[2]);
        return dayA - dayB;
      });
      setBirthdayList(monthBirthdays);

      // Fetch portal data (non-blocking)
      try {
        const portalRes = await fetch('/api/portal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'getJadwal', unit: 'ALL', bulan, tahun }),
        });
        const portalData = await portalRes.json();
        if (portalData.data) {
          const now = new Date();
          const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          const futureData = portalData.data.filter((p: PortalItem) => {
            if (p.status !== 'Approved') return false;
            try {
              const dateStr = p.tanggalDisplay || p.tanggal;
              if (!dateStr) return true;
              const parts = dateStr.split(/[\/\-]/);
              if (parts.length >= 3) {
                const day = parseInt(parts[0]);
                const month = parseInt(parts[1]) - 1;
                const year = parseInt(parts[2].length === 2 ? '20' + parts[2] : parts[2]);
                const eventDate = new Date(year, month, day);
                return eventDate >= today;
              }
              return true;
            } catch { return true; }
          });
          setPortalList(futureData.slice(0, 10));
        }
      } catch {
        // Portal not configured is OK
      }
    } catch (err) {
      console.error('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [todayStr, in7Days, bulan, tahun]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const monthName = useMemo(() => getMonthName(bulan), [bulan]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5 overflow-x-hidden pb-4">
      {/* ============================================================
          Personalized Header
          ============================================================ */}
      <div className="rounded-2xl overflow-hidden bg-gradient-to-br from-blue-700 via-indigo-700 to-purple-700 shadow-lg">
        <div className="px-5 py-6 sm:px-8 sm:py-8">
          <p className="text-blue-100 text-sm sm:text-base font-medium">{greeting}, Admin</p>
          <h1 className="text-white text-xl sm:text-2xl font-bold mt-1 leading-tight">
            Selamat beraktivitas hari ini
          </h1>
          <div className="mt-4 pt-4 border-t border-white/20">
            <div className="flex items-start gap-2">
              <BookOpen className="w-4 h-4 text-blue-200 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-blue-50 text-xs sm:text-sm leading-relaxed italic">
                  &ldquo;{dailyVerse.text}&rdquo;
                </p>
                <p className="text-blue-200 text-xs mt-1.5 font-semibold">
                  — {dailyVerse.ref}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================
          Widget 1: Peminjaman Gereja (Portal)
          ============================================================ */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <Link href="/portal" className="flex items-center gap-2 mb-3 group">
          <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center">
            <Church className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <h3 className="text-xs font-semibold text-slate-700 group-hover:text-emerald-600 transition-colors">Peminjaman Gereja</h3>
          <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-emerald-500 ml-auto" />
        </Link>
        {portalList.filter(p => p.status === 'Approved').length === 0 ? (
          <p className="text-xs text-slate-400 py-2">Tidak ada peminjaman mendatang</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {portalList.filter(p => p.status === 'Approved').slice(0, 6).map((item, idx) => (
              <Link key={`${item.unit}-${item.row}-${idx}`} href="/portal" className="flex items-center gap-2.5 p-2.5 rounded-lg border border-slate-100 hover:bg-emerald-50/50 hover:border-emerald-200 transition-colors group">
                <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                  <Building2 className="w-3.5 h-3.5 text-emerald-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-slate-900 truncate">{item.acara}</p>
                  <p className="text-[10px] text-slate-400 truncate">{item.tanggalDisplay || item.tanggal} · {item.jam}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* ============================================================
          Widget 2: Ulang Tahun Bulan Ini
          ============================================================ */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <Link href="/karyawan" className="flex items-center gap-2 mb-3 group">
          <div className="w-7 h-7 rounded-lg bg-pink-50 flex items-center justify-center">
            <Cake className="w-3.5 h-3.5 text-pink-600" />
          </div>
          <h3 className="text-xs font-semibold text-slate-700 group-hover:text-pink-600 transition-colors">Ulang Tahun {monthName} {tahun}</h3>
          <span className="text-[10px] font-bold text-pink-500 bg-pink-50 px-1.5 py-0.5 rounded-full ml-auto">{birthdayList.length}</span>
        </Link>
        {birthdayList.length === 0 ? (
          <p className="text-xs text-slate-400 py-2">Tidak ada ulang tahun bulan ini</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {birthdayList.slice(0, 8).map((item) => {
              const day = item.tanggal_lahir.split('-')[2];
              return (
                <div key={item.id} className="flex items-center gap-2 p-2 rounded-lg border border-slate-100 hover:bg-pink-50/50 hover:border-pink-200 transition-colors">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-pink-50 flex flex-col items-center justify-center">
                    <span className="text-[10px] font-bold text-pink-600">{day}</span>
                    <span className="text-[8px] text-pink-400">{monthName.slice(0, 3)}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-medium text-slate-900 truncate">{item.nama}</p>
                    {item.unit && (
                      <span className="inline-flex px-1 py-0.5 rounded text-[8px] font-semibold text-white mt-0.5" style={{ backgroundColor: item.unit.color || '#ec4899' }}>
                        {item.unit.name}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
            {birthdayList.length > 8 && (
              <Link href="/karyawan" className="flex items-center justify-center p-2 rounded-lg border border-dashed border-slate-200 text-[11px] font-medium text-pink-600 hover:bg-pink-50 transition-colors">
                +{birthdayList.length - 8} lainnya
              </Link>
            )}
          </div>
        )}
      </div>

      {/* ============================================================
          Widget 3: Jadwal Ibadah (2 Tabs)
          ============================================================ */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <Link href="/jadwal" className="flex items-center gap-2 group">
            <div className="w-7 h-7 rounded-lg bg-purple-50 flex items-center justify-center">
              <CalendarClock className="w-3.5 h-3.5 text-purple-600" />
            </div>
            <h3 className="text-xs font-semibold text-slate-700 group-hover:text-purple-600 transition-colors">Jadwal Ibadah</h3>
          </Link>
          {/* Tabs */}
          <div className="flex bg-slate-100 rounded-lg p-0.5">
            <button
              type="button"
              onClick={() => setJadwalTab('ibadah')}
              className={cn(
                "px-2.5 py-1 text-[10px] font-semibold rounded-md transition-all",
                jadwalTab === 'ibadah' ? "bg-white text-purple-700 shadow-sm" : "text-slate-400 hover:text-slate-600"
              )}
            >
              Ibadah
            </button>
            <button
              type="button"
              onClick={() => setJadwalTab('holy_morning')}
              className={cn(
                "px-2.5 py-1 text-[10px] font-semibold rounded-md transition-all",
                jadwalTab === 'holy_morning' ? "bg-white text-purple-700 shadow-sm" : "text-slate-400 hover:text-slate-600"
              )}
            >
              Holy Morning
            </button>
          </div>
        </div>

        {jadwalTab === 'ibadah' ? (
          jadwalList.length === 0 ? (
            <p className="text-xs text-slate-400 py-2">Tidak ada jadwal ibadah</p>
          ) : (
            <div className="space-y-1.5">
              {jadwalList.slice(0, 5).map((item) => (
                <Link key={item.id} href="/jadwal" className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-purple-50/50 transition-colors group">
                  <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-purple-50 flex flex-col items-center justify-center">
                    <span className="text-[9px] font-bold text-purple-600">{item.bulan?.slice(0, 3)}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-slate-900 truncate">{item.tanggal}</p>
                    <p className="text-[10px] text-slate-400 truncate">{item.pemberita_firman || item.pelayan_ibadah}</p>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-purple-500 flex-shrink-0" />
                </Link>
              ))}
              {jadwalList.length > 5 && (
                <Link href="/jadwal" className="flex items-center justify-center gap-1 pt-1 text-[11px] font-medium text-purple-600 hover:text-purple-700">
                  +{jadwalList.length - 5} lainnya <ArrowRight className="w-3 h-3" />
                </Link>
              )}
            </div>
          )
        ) : (
          hmList.length === 0 ? (
            <p className="text-xs text-slate-400 py-2">Tidak ada jadwal Holy Morning</p>
          ) : (
            <div className="space-y-1.5">
              {hmList.slice(0, 5).map((item) => (
                <Link key={item.id} href="/jadwal" className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-purple-50/50 transition-colors group">
                  <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-indigo-50 flex flex-col items-center justify-center">
                    <span className="text-[9px] font-bold text-indigo-600">{item.bulan?.slice(0, 3)}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-slate-900 truncate">{item.tanggal}</p>
                    <p className="text-[10px] text-slate-400 truncate">{item.pelayan_holy_morning}</p>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-purple-500 flex-shrink-0" />
                </Link>
              ))}
              {hmList.length > 5 && (
                <Link href="/jadwal" className="flex items-center justify-center gap-1 pt-1 text-[11px] font-medium text-purple-600 hover:text-purple-700">
                  +{hmList.length - 5} lainnya <ArrowRight className="w-3 h-3" />
                </Link>
              )}
            </div>
          )
        )}
      </div>

      {/* ============================================================
          Widget 4: Agenda 7 Hari ke Depan
          ============================================================ */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <Link href="/kaldik" className="flex items-center gap-2 mb-3 group">
          <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center">
            <Clock className="w-3.5 h-3.5 text-indigo-600" />
          </div>
          <h3 className="text-xs font-semibold text-slate-700 group-hover:text-indigo-600 transition-colors">Agenda 7 Hari ke Depan</h3>
          <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-indigo-500 ml-auto" />
        </Link>
        {agendaTerdekat.length === 0 ? (
          <p className="text-xs text-slate-400 py-2">Tidak ada agenda dalam 7 hari ke depan</p>
        ) : (
          <div className="space-y-1.5">
            {agendaTerdekat.slice(0, 5).map((item) => (
              <Link key={item.id} href="/kaldik" className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-indigo-50/50 transition-colors group">
                <div className="flex-shrink-0 w-8 h-8 rounded-lg flex flex-col items-center justify-center" style={{ backgroundColor: item.unit?.color ? `${item.unit.color}15` : '#eef2ff' }}>
                  <span className="text-[10px] font-bold" style={{ color: item.unit?.color || '#6366f1' }}>{item.tanggal_mulai?.split('-')[2]}</span>
                  <span className="text-[8px]" style={{ color: item.unit?.color ? `${item.unit.color}80` : '#a5b4fc' }}>{getMonthName(parseInt(item.tanggal_mulai?.split('-')[1] || '0')).slice(0, 3)}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-slate-900 truncate">{item.nama_kegiatan}</p>
                  {item.unit && (
                    <span className="inline-flex px-1.5 py-0.5 rounded text-[9px] font-semibold text-white mt-0.5" style={{ backgroundColor: item.unit.color || '#6366f1' }}>
                      {item.unit.name}
                    </span>
                  )}
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-indigo-500 flex-shrink-0" />
              </Link>
            ))}
            {agendaTerdekat.length > 5 && (
              <Link href="/kaldik" className="flex items-center justify-center gap-1 pt-1 text-[11px] font-medium text-indigo-600 hover:text-indigo-700">
                +{agendaTerdekat.length - 5} lainnya <ArrowRight className="w-3 h-3" />
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
