'use client';
export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  CalendarDays, Users, BookHeart, Building2, CalendarClock,
  ChevronDown, ChevronRight, ArrowRight, Clock, MapPin, Loader2,
  Church, Heart, Star, BookOpen,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { supabase } from '@/lib/supabase/client';
import { formatDate, getMonthName } from '@/lib/utils/date';
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
   Collapsible Panel Component
   ============================================================ */
function CollapsiblePanel({
  title,
  icon: Icon,
  iconColor,
  count,
  defaultOpen = true,
  action,
  children,
}: {
  title: string;
  icon: React.ElementType;
  iconColor: string;
  count?: number;
  defaultOpen?: boolean;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 sm:px-5 sm:py-4 hover:bg-slate-50/50 transition-colors"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0", iconColor)}>
            <Icon className="w-4 h-4 text-white" />
          </div>
          <h3 className="text-sm font-semibold text-slate-900 truncate">{title}</h3>
          {count !== undefined && (
            <span className="inline-flex items-center justify-center px-2 py-0.5 text-[10px] font-bold rounded-full bg-slate-100 text-slate-600">
              {count}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {action}
          <ChevronDown
            className={cn(
              "w-4 h-4 text-slate-400 transition-transform duration-300",
              open && "rotate-180"
            )}
          />
        </div>
      </button>
      <div
        className={cn(
          "overflow-hidden transition-all duration-300 ease-in-out",
          open ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0"
        )}
      >
        <div className="border-t border-slate-100">{children}</div>
      </div>
    </div>
  );
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

interface KaryawanItem {
  id: string;
  nama: string;
  jabatan: string | null;
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

interface DoaItem {
  id: string;
  tanggal: string;
  bulan: number;
  tahun: number;
  judul: string | null;
  isi_doa: string | null;
  status_doa: string;
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

export default function DashboardPage() {
  const [agendaList, setAgendaList] = useState<AgendaItem[]>([]);
  const [karyawanList, setKaryawanList] = useState<KaryawanItem[]>([]);
  const [karyawanCount, setKaryawanCount] = useState(0);
  const [jadwalList, setJadwalList] = useState<JadwalItem[]>([]);
  const [doaList, setDoaList] = useState<DoaItem[]>([]);
  const [portalList, setPortalList] = useState<PortalItem[]>([]);
  const [agendaTerdekat, setAgendaTerdekat] = useState<AgendaItem[]>([]);
  const [loading, setLoading] = useState(true);

  const now = new Date();
  const bulan = now.getMonth() + 1;
  const tahun = now.getFullYear();
  const todayStr = now.toISOString().split('T')[0];
  const in7Days = new Date(now.getTime() + 7 * 86400000).toISOString().split('T')[0];

  const dailyVerse = useMemo(() => getDailyVerse(), []);
  const greeting = useMemo(() => getGreeting(), []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [
        agendaRes,
        karyawanCountRes,
        karyawanListRes,
        jadwalRes,
        doaRes,
        agendaTerdekatRes,
      ] = await Promise.all([
        supabase
          .from('kaldik')
          .select('id, nama_kegiatan, kategori, tanggal_mulai, tanggal_selesai, status, unit:units(name, color)')
          .eq('bulan', bulan).eq('tahun', tahun)
          .neq('status', 'Dibatalkan')
          .order('tanggal_mulai', { ascending: true })
          .limit(50),
        supabase
          .from('karyawan')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'Aktif'),
        supabase
          .from('karyawan')
          .select('id, nama, jabatan, unit:units(name, color)')
          .eq('status', 'Aktif')
          .order('nama')
          .limit(20),
        supabase
          .from('jadwal_ibadah')
          .select('id, tanggal, pelayan_ibadah, pemberita_firman, tema_ibadah_bulanan, nas_alkitab, bulan')
          .eq('tahun_ajaran', '2026-2027')
          .order('tanggal_sort', { ascending: true, nullsFirst: false })
          .limit(10),
        supabase
          .from('pokok_doa')
          .select('id, tanggal, bulan, tahun, judul, isi_doa, status_doa')
          .eq('bulan', bulan).eq('tahun', tahun)
          .order('tanggal', { ascending: true })
          .limit(10),
        supabase
          .from('kaldik')
          .select('id, nama_kegiatan, kategori, tanggal_mulai, tanggal_selesai, status, unit:units(name, color)')
          .gte('tanggal_mulai', todayStr)
          .lte('tanggal_mulai', in7Days)
          .neq('status', 'Dibatalkan')
          .order('tanggal_mulai', { ascending: true })
          .limit(10),
      ]);

      setAgendaList((agendaRes.data || []) as unknown as AgendaItem[]);
      setKaryawanCount(karyawanCountRes.count || 0);
      setKaryawanList((karyawanListRes.data || []) as unknown as KaryawanItem[]);
      setJadwalList((jadwalRes.data || []) as unknown as JadwalItem[]);
      setDoaList((doaRes.data || []) as unknown as DoaItem[]);
      setAgendaTerdekat((agendaTerdekatRes.data || []) as unknown as AgendaItem[]);

      // Fetch portal data (non-blocking)
      try {
        const portalRes = await fetch('/api/portal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'getJadwal', unit: 'ALL', bulan, tahun }),
        });
        const portalData = await portalRes.json();
        if (portalData.data) {
          setPortalList(portalData.data.slice(0, 10));
        }
      } catch {
        // Portal not configured is OK
      }
    } catch (err) {
      console.error('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [bulan, tahun, todayStr, in7Days]);

  useEffect(() => { fetchData(); }, [fetchData]);

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
          3 Priority Widgets
          ============================================================ */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Widget: Agenda Terdekat */}
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center">
              <Clock className="w-3.5 h-3.5 text-indigo-600" />
            </div>
            <h3 className="text-xs font-semibold text-slate-700">Agenda 7 Hari ke Depan</h3>
          </div>
          {agendaTerdekat.length === 0 ? (
            <p className="text-xs text-slate-400 py-2">Tidak ada agenda dalam 7 hari ke depan</p>
          ) : (
            <div className="space-y-2">
              {agendaTerdekat.slice(0, 3).map((item) => (
                <Link key={item.id} href="/kaldik" className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-slate-50 transition-colors group">
                  <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-indigo-50 flex flex-col items-center justify-center">
                    <span className="text-[10px] font-bold text-indigo-600">{item.tanggal_mulai?.split('-')[2]}</span>
                    <span className="text-[8px] text-indigo-400">{getMonthName(parseInt(item.tanggal_mulai?.split('-')[1] || '0')).slice(0, 3)}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-slate-900 truncate">{item.nama_kegiatan}</p>
                    <p className="text-[10px] text-slate-400 truncate">{item.kategori}</p>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-indigo-500 flex-shrink-0" />
                </Link>
              ))}
              {agendaTerdekat.length > 3 && (
                <Link href="/kaldik" className="flex items-center justify-center gap-1 pt-1 text-[11px] font-medium text-indigo-600 hover:text-indigo-700">
                  +{agendaTerdekat.length - 3} lainnya <ArrowRight className="w-3 h-3" />
                </Link>
              )}
            </div>
          )}
        </div>

        {/* Widget: Peminjaman Gereja */}
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center">
              <Church className="w-3.5 h-3.5 text-emerald-600" />
            </div>
            <h3 className="text-xs font-semibold text-slate-700">Peminjaman Gereja</h3>
          </div>
          {portalList.length === 0 ? (
            <p className="text-xs text-slate-400 py-2">Tidak ada jadwal peminjaman</p>
          ) : (
            <div className="space-y-2">
              {portalList.filter(p => p.status === 'Approved').slice(0, 3).map((item, idx) => (
                <Link key={`${item.unit}-${item.row}-${idx}`} href="/portal" className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-slate-50 transition-colors group">
                  <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                    <Building2 className="w-3.5 h-3.5 text-emerald-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-slate-900 truncate">{item.acara}</p>
                    <p className="text-[10px] text-slate-400 truncate">{item.tanggalDisplay || item.tanggal} · {item.jam}</p>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-emerald-500 flex-shrink-0" />
                </Link>
              ))}
              {portalList.filter(p => p.status === 'Approved').length === 0 && (
                <p className="text-xs text-slate-400 py-2">Tidak ada peminjaman yang disetujui</p>
              )}
            </div>
          )}
        </div>

        {/* Widget: Jadwal Ibadah */}
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-lg bg-purple-50 flex items-center justify-center">
              <Heart className="w-3.5 h-3.5 text-purple-600" />
            </div>
            <h3 className="text-xs font-semibold text-slate-700">Jadwal Ibadah</h3>
          </div>
          {jadwalList.length === 0 ? (
            <p className="text-xs text-slate-400 py-2">Tidak ada jadwal ibadah</p>
          ) : (
            <div className="space-y-2">
              {jadwalList.slice(0, 3).map((item) => (
                <Link key={item.id} href="/jadwal" className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-slate-50 transition-colors group">
                  <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-purple-50 flex flex-col items-center justify-center">
                    <CalendarClock className="w-3.5 h-3.5 text-purple-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-slate-900 truncate">{item.tanggal}</p>
                    <p className="text-[10px] text-slate-400 truncate">{item.pemberita_firman || item.pelayan_ibadah}</p>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-purple-500 flex-shrink-0" />
                </Link>
              ))}
              {jadwalList.length > 3 && (
                <Link href="/jadwal" className="flex items-center justify-center gap-1 pt-1 text-[11px] font-medium text-purple-600 hover:text-purple-700">
                  +{jadwalList.length - 3} lainnya <ArrowRight className="w-3 h-3" />
                </Link>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ============================================================
          5 Collapsible Panels
          ============================================================ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Panel 1: Agenda Bulan Ini */}
        <CollapsiblePanel
          title={`Agenda ${getMonthName(bulan)} ${tahun}`}
          icon={CalendarDays}
          iconColor="bg-indigo-600"
          count={agendaList.length}
          action={
            <Link
              href="/kaldik"
              onClick={(e) => e.stopPropagation()}
              className="text-[11px] font-medium text-indigo-600 hover:text-indigo-700 flex items-center gap-0.5"
            >
              Detail <ArrowRight className="w-3 h-3" />
            </Link>
          }
        >
          {agendaList.length === 0 ? (
            <div className="px-5 py-6 text-center text-sm text-slate-400">
              Belum ada agenda bulan ini
            </div>
          ) : (
            <div className="divide-y divide-slate-50 max-h-72 overflow-y-auto">
              {agendaList.map((item) => (
                <div key={item.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50/50 transition-colors">
                  <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-indigo-50 flex flex-col items-center justify-center">
                    <span className="text-[10px] font-bold text-indigo-600">
                      {item.tanggal_mulai?.split('-')[2] || '—'}
                    </span>
                    <span className="text-[8px] text-indigo-400">
                      {item.tanggal_mulai ? getMonthName(parseInt(item.tanggal_mulai.split('-')[1])).slice(0, 3) : ''}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-slate-900 truncate">{item.nama_kegiatan}</p>
                    <p className="text-[10px] text-slate-400">{item.kategori}</p>
                  </div>
                  {item.unit && (
                    <span
                      className="hidden sm:inline-flex px-1.5 py-0.5 rounded text-[9px] font-semibold text-white"
                      style={{ backgroundColor: item.unit.color || '#6366f1' }}
                    >
                      {item.unit.name}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </CollapsiblePanel>

        {/* Panel 2: Portal Gedung */}
        <CollapsiblePanel
          title="Portal Gedung"
          icon={Building2}
          iconColor="bg-emerald-600"
          count={portalList.length}
          action={
            <Link
              href="/portal"
              onClick={(e) => e.stopPropagation()}
              className="text-[11px] font-medium text-emerald-600 hover:text-emerald-700 flex items-center gap-0.5"
            >
              Detail <ArrowRight className="w-3 h-3" />
            </Link>
          }
        >
          {portalList.length === 0 ? (
            <div className="px-5 py-6 text-center text-sm text-slate-400">
              Tidak ada data portal
            </div>
          ) : (
            <div className="divide-y divide-slate-50 max-h-72 overflow-y-auto">
              {portalList.map((item, idx) => {
                const statusColors: Record<string, string> = {
                  Pending: 'bg-amber-50 text-amber-700',
                  Approved: 'bg-emerald-50 text-emerald-700',
                  Rejected: 'bg-red-50 text-red-700',
                };
                return (
                  <Link key={`${item.unit}-${item.row}-${idx}`} href="/portal" className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50/50 transition-colors">
                    <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                      <Building2 className="w-3.5 h-3.5 text-emerald-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-slate-900 truncate">{item.acara}</p>
                      <p className="text-[10px] text-slate-400">{item.tanggalDisplay || item.tanggal} · {item.jam}</p>
                    </div>
                    <span className={cn("px-1.5 py-0.5 rounded text-[9px] font-semibold", statusColors[item.status] || 'bg-slate-50 text-slate-500')}>
                      {item.status}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </CollapsiblePanel>

        {/* Panel 3: Karyawan Aktif */}
        <CollapsiblePanel
          title="Karyawan Aktif"
          icon={Users}
          iconColor="bg-teal-600"
          count={karyawanCount}
          defaultOpen={false}
          action={
            <Link
              href="/karyawan"
              onClick={(e) => e.stopPropagation()}
              className="text-[11px] font-medium text-teal-600 hover:text-teal-700 flex items-center gap-0.5"
            >
              Detail <ArrowRight className="w-3 h-3" />
            </Link>
          }
        >
          {karyawanList.length === 0 ? (
            <div className="px-5 py-6 text-center text-sm text-slate-400">
              Belum ada data karyawan
            </div>
          ) : (
            <div className="divide-y divide-slate-50 max-h-72 overflow-y-auto">
              {karyawanList.map((item) => (
                <Link key={item.id} href="/karyawan" className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50/50 transition-colors">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-teal-50 flex items-center justify-center">
                    <span className="text-[10px] font-bold text-teal-600">
                      {item.nama.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-slate-900 truncate">{item.nama}</p>
                    <p className="text-[10px] text-slate-400">{item.jabatan || '—'}</p>
                  </div>
                  {item.unit && (
                    <span
                      className="hidden sm:inline-flex px-1.5 py-0.5 rounded text-[9px] font-semibold text-white"
                      style={{ backgroundColor: item.unit.color || '#14b8a6' }}
                    >
                      {item.unit.name}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          )}
        </CollapsiblePanel>

        {/* Panel 4: Jadwal Ibadah & Holy Morning */}
        <CollapsiblePanel
          title="Jadwal Ibadah"
          icon={CalendarClock}
          iconColor="bg-purple-600"
          count={jadwalList.length}
          defaultOpen={false}
          action={
            <Link
              href="/jadwal"
              onClick={(e) => e.stopPropagation()}
              className="text-[11px] font-medium text-purple-600 hover:text-purple-700 flex items-center gap-0.5"
            >
              Detail <ArrowRight className="w-3 h-3" />
            </Link>
          }
        >
          {jadwalList.length === 0 ? (
            <div className="px-5 py-6 text-center text-sm text-slate-400">
              Belum ada jadwal ibadah
            </div>
          ) : (
            <div className="divide-y divide-slate-50 max-h-72 overflow-y-auto">
              {jadwalList.map((item) => (
                <Link key={item.id} href="/jadwal" className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50/50 transition-colors">
                  <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-purple-50 flex flex-col items-center justify-center">
                    <CalendarClock className="w-3.5 h-3.5 text-purple-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-slate-900 truncate">{item.tanggal}</p>
                    <p className="text-[10px] text-slate-400 truncate">
                      {item.pemberita_firman || item.pelayan_ibadah}
                    </p>
                  </div>
                  {item.nas_alkitab && (
                    <span className="text-[10px] text-slate-400 hidden sm:inline">{item.nas_alkitab}</span>
                  )}
                </Link>
              ))}
            </div>
          )}
        </CollapsiblePanel>

        {/* Panel 5: Pokok Doa */}
        <CollapsiblePanel
          title={`Pokok Doa ${getMonthName(bulan)}`}
          icon={BookHeart}
          iconColor="bg-rose-600"
          count={doaList.length}
          defaultOpen={false}
          action={
            <Link
              href="/hasil-pokok-doa"
              onClick={(e) => e.stopPropagation()}
              className="text-[11px] font-medium text-rose-600 hover:text-rose-700 flex items-center gap-0.5"
            >
              Detail <ArrowRight className="w-3 h-3" />
            </Link>
          }
        >
          {doaList.length === 0 ? (
            <div className="px-5 py-6 text-center text-sm text-slate-400">
              Belum ada pokok doa bulan ini
            </div>
          ) : (
            <div className="divide-y divide-slate-50 max-h-72 overflow-y-auto">
              {doaList.map((item) => {
                const statusColors: Record<string, string> = {
                  'Auto Draft': 'bg-amber-50 text-amber-700',
                  'Edited Manual': 'bg-blue-50 text-blue-700',
                  'Final': 'bg-emerald-50 text-emerald-700',
                };
                return (
                  <Link key={item.id} href="/hasil-pokok-doa" className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50/50 transition-colors">
                    <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center">
                      <BookHeart className="w-3.5 h-3.5 text-rose-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-slate-900 truncate">{item.judul || item.tanggal}</p>
                      {item.isi_doa && (
                        <p className="text-[10px] text-slate-400 truncate">{item.isi_doa.slice(0, 60)}...</p>
                      )}
                    </div>
                    <span className={cn("px-1.5 py-0.5 rounded text-[9px] font-semibold", statusColors[item.status_doa] || 'bg-slate-50 text-slate-500')}>
                      {item.status_doa}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </CollapsiblePanel>
      </div>
    </div>
  );
}
