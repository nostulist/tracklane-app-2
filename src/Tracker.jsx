import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from "recharts";
import {
  Plus, Trash2, Flame, Dumbbell, Footprints, Swords, Activity,
  Clock, ChevronLeft, ChevronRight, Check, Bell, AlertTriangle,
  Briefcase, GraduationCap, Lightbulb, CheckCircle2, Circle,
  Wallet, TrendingUp, TrendingDown, LogOut
} from "lucide-react";
import { supabase } from "./supabaseClient";

/* ---------- palette (dark) ---------- */

const BG = "#0B0B0D";
const PANEL = "#17151A";
const BORDER = "#37333A";
const TEXT = "#EDE8DC";
const SUBTEXT = "#9C978A";
const MUTED_BG = "#211F24";

const CATEGORIES = [
  { key: "sleep", label: "Сон", color: "#5B5566" },
  { key: "work", label: "Работа", color: "#7C838C" },
  { key: "study", label: "Учёба", color: "#39C6FF" },
  { key: "sport", label: "Спорт", color: "#39FF6A" },
  { key: "chores", label: "Быт", color: "#8B8F7E" },
  { key: "rest", label: "Отдых", color: "#9D3DFF" },
  { key: "personal", label: "Личное", color: "#B39468" },
];

const HABIT_COLORS = ["#7C838C", "#39FF6A", "#5B5566", "#8B8F7E", "#9D3DFF", "#B39468", "#C7C2AE"];

const WORKOUT_TYPES = [
  { key: "run", label: "Бег", icon: Footprints },
  { key: "gym", label: "Зал", icon: Dumbbell },
  { key: "martial", label: "Единоборства", icon: Swords },
  { key: "other", label: "Другое", icon: Activity },
];

const TASK_CATEGORIES = [
  { key: "work", label: "Работа", color: "#7C838C", icon: Briefcase },
  { key: "study", label: "Учёба", color: "#B39468", icon: GraduationCap },
  { key: "project", label: "Личный проект", color: "#39FF6A", icon: Lightbulb },
];

const EXPENSE_CATEGORIES = [
  { key: "food", label: "Еда", color: "#9D3DFF" },
  { key: "transport", label: "Транспорт", color: "#7C838C" },
  { key: "housing", label: "Жильё", color: "#5B5566" },
  { key: "fun", label: "Развлечения", color: "#39FF6A" },
  { key: "health", label: "Здоровье", color: "#C7C2AE" },
  { key: "clothes", label: "Одежда", color: "#B39468" },
  { key: "bills", label: "Связь/счета", color: "#8B8F7E" },
  { key: "other_exp", label: "Прочее", color: "#6E6A63" },
];

const INCOME_CATEGORIES = [
  { key: "salary", label: "Зарплата", color: "#9D3DFF" },
  { key: "freelance", label: "Подработка", color: "#7C838C" },
  { key: "gift", label: "Подарки", color: "#B39468" },
  { key: "other_inc", label: "Прочее", color: "#6E6A63" },
];

const emptyData = {
  habits: [],
  timeblocks: {},
  workouts: [],
  tasks: [],
  transactions: [],
  university: { groupId: "", lastSync: null },
};

function fmtDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function todayStr() { return fmtDate(new Date()); }
function addDays(dateStr, n) {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + n);
  return fmtDate(d);
}
function shortLabel(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" });
}
function monthLabel(monthKey) {
  const d = new Date(monthKey + "-01T00:00:00");
  return d.toLocaleDateString("ru-RU", { month: "short", year: "2-digit" });
}
function weekdayLabel(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("ru-RU", { weekday: "short" });
}
function timeToMin(t) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}
function daysUntil(dateStr) {
  const today = todayStr();
  const a = new Date(today + "T00:00:00");
  const b = new Date(dateStr + "T00:00:00");
  return Math.round((b - a) / 86400000);
}
function uid() { return Math.random().toString(36).slice(2, 10); }
function fmtMoney(n) {
  return new Intl.NumberFormat("ru-RU").format(Math.round(n));
}

function parseRuDate(d) {
  // "6.11.2022" -> "2022-11-06"
  const [day, month, year] = d.split(".").map(Number);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function flattenScheduleResponse(resp) {
  return (resp.lessons || []).filter((l) => l && l.date && l.start_time && l.name);
}

const inputStyle = {
  padding: "0.5rem 0.75rem",
  borderRadius: "0.5rem",
  border: `1px solid ${BORDER}`,
  background: MUTED_BG,
  color: TEXT,
};

/* ---------- main component ---------- */

export default function Tracker({ userId, userEmail, onSignOut }) {
  const [data, setData] = useState(emptyData);
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState("menu");
  const [saveError, setSaveError] = useState(false);
  const [notifPermission, setNotifPermission] = useState(
    typeof Notification !== "undefined" ? Notification.permission : "unsupported"
  );
  const notifiedRef = useRef(new Set());

  // Load this user's row. Row Level Security guarantees the query can
  // only ever return the row belonging to the currently authenticated
  // user, no matter what — even if this code were tampered with.
  useEffect(() => {
    (async () => {
      try {
        const { data: row, error } = await supabase
          .from("tracker_data")
          .select("data")
          .eq("user_id", userId)
          .maybeSingle();
        if (error) throw error;
        if (row && row.data) setData({ ...emptyData, ...row.data });
      } catch (e) {
        console.error("Load failed", e);
      } finally {
        setLoaded(true);
      }
    })();
  }, [userId]);

  // Debounced autosave. upsert always stamps user_id = userId, and RLS
  // rejects any write where user_id doesn't match the logged-in user.
  useEffect(() => {
    if (!loaded) return;
    const t = setTimeout(async () => {
      try {
        const { error } = await supabase
          .from("tracker_data")
          .upsert({ user_id: userId, data, updated_at: new Date().toISOString() });
        if (error) throw error;
        setSaveError(false);
      } catch (e) {
        console.error("Save failed", e);
        setSaveError(true);
      }
    }, 500);
    return () => clearTimeout(t);
  }, [data, loaded, userId]);

  const update = useCallback((fn) => setData((prev) => fn(prev)), []);

  const [syncStatus, setSyncStatus] = useState("idle"); // idle | loading | done | error

  const syncUniversitySchedule = useCallback(async (groupId) => {
    if (!groupId) return;
    setSyncStatus("loading");
    try {
      const res = await fetch(`/api/schedule?group=${encodeURIComponent(groupId)}`);
      if (!res.ok) throw new Error("bad response");
      const json = await res.json();
      const lessons = flattenScheduleResponse(json);

      const byDate = {};
      lessons.forEach((l) => {
        const date = parseRuDate(l.date);
        if (!byDate[date]) byDate[date] = [];
        const id = `univ-${date}-${l.start_time}-${l.name}`.replace(/\s+/g, "_");
        byDate[date].push({
          id,
          category: "study",
          start: l.start_time,
          end: l.end_time,
          subject: l.name,
          room: l.classroom || "",
          lecturer: l.lecturer || "",
          source: "university",
        });
      });

      update((prev) => {
        const newBlocks = { ...prev.timeblocks };
        Object.keys(byDate).forEach((date) => {
          const manual = (newBlocks[date] || []).filter((b) => b.source !== "university");
          newBlocks[date] = [...manual, ...byDate[date]];
        });
        return {
          ...prev,
          timeblocks: newBlocks,
          university: { groupId, lastSync: new Date().toISOString() },
        };
      });
      setSyncStatus("done");
    } catch (e) {
      console.error("Schedule sync failed", e);
      setSyncStatus("error");
    }
  }, [update]);

  // Автоматическая синхронизация: раз в сутки, без участия пользователя.
  useEffect(() => {
    if (!loaded) return;
    const groupId = data.university?.groupId;
    if (!groupId) return;
    const last = data.university?.lastSync;
    const stale = !last || Date.now() - new Date(last).getTime() > 20 * 60 * 60 * 1000;
    if (stale) syncUniversitySchedule(groupId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  const urgentTasks = useMemo(
    () =>
      data.tasks
        .filter((t) => !t.done)
        .map((t) => ({ ...t, days: daysUntil(t.deadline) }))
        .filter((t) => t.days <= 2)
        .sort((a, b) => a.days - b.days),
    [data.tasks]
  );

  useEffect(() => {
    if (notifPermission !== "granted") return;
    urgentTasks.forEach((t) => {
      if (t.days <= 1 && !notifiedRef.current.has(t.id)) {
        notifiedRef.current.add(t.id);
        try {
          const label = t.days < 0 ? "Просрочено" : t.days === 0 ? "Дедлайн сегодня" : "Дедлайн завтра";
          new Notification(`${label}: ${t.title}`);
        } catch (e) { /* ignore */ }
      }
    });
  }, [urgentTasks, notifPermission]);

  const requestNotifications = () => {
    if (typeof Notification === "undefined") return;
    Notification.requestPermission().then(setNotifPermission);
  };

  const NAV_ITEMS = [
    { key: "menu", label: "Меню" },
    { key: "habits", label: "Привычки" },
    { key: "time", label: "День" },
    { key: "training", label: "Тренировки" },
    { key: "tasks", label: "Задачи" },
    { key: "finance", label: "Финансы" },
  ];

  return (
    <div
      style={{
        fontFamily: "'Manrope', sans-serif",
        background: `radial-gradient(circle at 1px 1px, rgba(237,232,220,0.05) 1px, transparent 0) 0 0/7px 7px, ${BG}`,
        minHeight: "100vh",
        color: TEXT,
      }}
      className="w-full"
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Special+Elite&family=Manrope:wght@400;500;700&family=JetBrains+Mono:wght@400;600&display=swap');
        .display-font { font-family: 'Bebas Neue', sans-serif; letter-spacing: 0.03em; }
        .noir-font { font-family: 'Special Elite', 'Manrope', sans-serif; }
        .mono-font { font-family: 'JetBrains Mono', monospace; }
        input::placeholder { color: #6B7570; }
        select option { background: ${MUTED_BG}; color: ${TEXT}; }
        .comic-card { box-shadow: 5px 5px 0 #9D3DFF, 5px 5px 0 1px #000; }
      `}</style>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {urgentTasks.length > 0 && (
          <div className="rounded-xl p-3 mb-5 flex items-start gap-2" style={{ backgroundColor: "#241631", border: "1px solid #9D3DFF" }}>
            <AlertTriangle size={18} style={{ color: "#9D3DFF" }} className="shrink-0 mt-0.5" />
            <div className="text-sm">
              <span className="font-semibold" style={{ color: "#9D3DFF" }}>Близкие дедлайны: </span>
              {urgentTasks.map((t, i) => (
                <span key={t.id}>
                  {t.title} ({t.days < 0 ? "просрочено" : t.days === 0 ? "сегодня" : "завтра"}){i < urgentTasks.length - 1 ? ", " : ""}
                </span>
              ))}
            </div>
          </div>
        )}

        {saveError && (
          <div className="rounded-xl p-3 mb-5 text-sm" style={{ backgroundColor: "#241631", border: "1px solid #9D3DFF", color: "#9D3DFF" }}>
            Не удалось сохранить последние изменения — проверь подключение к интернету.
          </div>
        )}

        <div className="flex items-center justify-between mb-1">
          <nav className="flex gap-1 border-b-2 overflow-x-auto flex-1" style={{ borderColor: "#000" }}>
            {NAV_ITEMS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className="display-font px-4 py-2 text-xl tracking-wide transition-colors whitespace-nowrap"
                style={{
                  borderBottom: tab === t.key ? "4px solid #9D3DFF" : "4px solid transparent",
                  color: tab === t.key ? "#9D3DFF" : SUBTEXT,
                  transform: tab === t.key ? "skewX(-6deg)" : "none",
                }}
              >
                {t.label.toUpperCase()}
              </button>
            ))}
          </nav>
          <button
            onClick={onSignOut}
            title={userEmail}
            className="flex items-center gap-1 px-3 py-2 text-xs shrink-0 noir-font"
            style={{ color: SUBTEXT }}
          >
            <LogOut size={14} /> Выйти
          </button>
        </div>
        <div className="mb-5" />

        {tab === "menu" && <MenuTab data={data} goTo={setTab} />}
        {tab === "habits" && <HabitsTab data={data} update={update} />}
        {tab === "time" && (
          <TimeTab
            data={data}
            update={update}
            syncStatus={syncStatus}
            syncUniversitySchedule={syncUniversitySchedule}
          />
        )}
        {tab === "training" && <TrainingTab data={data} update={update} />}
        {tab === "tasks" && (
          <TasksTab data={data} update={update} notifPermission={notifPermission} requestNotifications={requestNotifications} />
        )}
        {tab === "finance" && <FinanceTab data={data} update={update} />}
      </div>
    </div>
  );
}

/* ================= MENU (HOME) TAB ================= */

function MenuTab({ data, goTo }) {
  const today = todayStr();
  const bestStreak = useMemo(() => {
    let best = 0;
    data.habits.forEach((h) => {
      let count = 0, d = today;
      while (h.entries[d]) { count++; d = addDays(d, -1); }
      if (count > best) best = count;
    });
    return best;
  }, [data.habits, today]);

  const todayHours = useMemo(() => {
    const blocks = data.timeblocks[today] || [];
    const mins = blocks.reduce((s, b) => s + (timeToMin(b.end) - timeToMin(b.start)), 0);
    return (mins / 60).toFixed(1);
  }, [data.timeblocks, today]);

  const weekWorkouts = useMemo(() => {
    const weekAgo = addDays(today, -6);
    return data.workouts.filter((w) => w.date >= weekAgo && w.date <= today).length;
  }, [data.workouts, today]);

  const urgentCount = useMemo(
    () => data.tasks.filter((t) => !t.done && daysUntil(t.deadline) <= 2).length,
    [data.tasks, today]
  );

  const monthBalance = useMemo(() => {
    const month = today.slice(0, 7);
    return data.transactions
      .filter((t) => t.date.slice(0, 7) === month)
      .reduce((s, t) => s + (t.type === "income" ? t.amount : -t.amount), 0);
  }, [data.transactions, today]);

  const cards = [
    {
      key: "habits", label: "ПРИВЫЧКИ", rot: -2,
      stat: `${data.habits.length}`, statLabel: "активных",
      sub: bestStreak > 0 ? `Лучшая серия: ${bestStreak} дн.` : "Серий пока нет",
    },
    {
      key: "time", label: "ДЕНЬ", rot: 1.5,
      stat: `${todayHours} ч`, statLabel: "отмечено сегодня",
      sub: "Хронометраж суток",
    },
    {
      key: "training", label: "ТРЕНИРОВКИ", rot: -1,
      stat: `${weekWorkouts}`, statLabel: "за 7 дней",
      sub: `Всего записей: ${data.workouts.length}`,
    },
    {
      key: "tasks", label: "ЗАДАЧИ", rot: 2,
      stat: `${urgentCount}`, statLabel: urgentCount === 1 ? "срочная" : "срочных",
      sub: `Открытых всего: ${data.tasks.filter((t) => !t.done).length}`,
      danger: urgentCount > 0,
    },
    {
      key: "finance", label: "ФИНАНСЫ", rot: -1.5,
      stat: `${monthBalance >= 0 ? "+" : "−"}${fmtMoney(Math.abs(monthBalance))} ₽`, statLabel: "баланс месяца",
      sub: "Досье по расходам",
      danger: monthBalance < 0,
    },
  ];

  return (
    <div className="relative py-4">
      <div className="mb-8 text-center relative">
        <h1 className="display-font text-6xl md:text-7xl leading-none" style={{ color: TEXT }}>
          СВОДКА <span style={{ color: "#9D3DFF" }}>ДНЯ</span>
        </h1>
        <div className="w-40 h-1 mx-auto mt-3" style={{ backgroundColor: "#9D3DFF" }} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-10">
        {cards.map((c) => (
          <button
            key={c.key}
            onClick={() => goTo(c.key)}
            className="text-left rounded-sm p-5 relative comic-card transition-transform hover:-translate-y-1"
            style={{
              backgroundColor: "#100F11",
              border: "3px solid #000",
              transform: `rotate(${c.rot}deg)`,
            }}
          >
            <span
              className="absolute -top-3 left-6 w-5 h-5 rounded-full"
              style={{ backgroundColor: c.danger ? "#9D3DFF" : "#39FF6A", border: "2px solid #000" }}
            />
            <p className="display-font text-2xl tracking-widest mb-3" style={{ color: c.danger ? "#9D3DFF" : TEXT }}>
              {c.label}
            </p>
            <p className="mono-font text-4xl font-bold" style={{ color: c.danger ? "#9D3DFF" : "#39FF6A" }}>{c.stat}</p>
            <p className="noir-font text-xs mb-2" style={{ color: "#9C978A" }}>{c.statLabel}</p>
            <div className="w-full h-px my-2" style={{ backgroundColor: "#37333A" }} />
            <p className="noir-font text-xs" style={{ color: "#9C978A" }}>{c.sub}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ================= HABITS TAB ================= */

function HabitsTab({ data, update }) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(HABIT_COLORS[0]);
  const today = todayStr();

  const addHabit = () => {
    if (!name.trim()) return;
    update((prev) => ({
      ...prev,
      habits: [...prev.habits, { id: uid(), name: name.trim(), color, entries: {} }],
    }));
    setName("");
  };

  const toggleToday = (habitId) => {
    update((prev) => ({
      ...prev,
      habits: prev.habits.map((h) =>
        h.id === habitId ? { ...h, entries: { ...h.entries, [today]: !h.entries[today] } } : h
      ),
    }));
  };

  const deleteHabit = (habitId) => {
    update((prev) => ({ ...prev, habits: prev.habits.filter((h) => h.id !== habitId) }));
  };

  const streak = (habit) => {
    let count = 0;
    let d = today;
    while (habit.entries[d]) {
      count++;
      d = addDays(d, -1);
    }
    return count;
  };

  const last30 = useMemo(() => {
    const arr = [];
    for (let i = 29; i >= 0; i--) arr.push(addDays(today, -i));
    return arr;
  }, [today]);

  const last14 = useMemo(() => {
    const arr = [];
    for (let i = 13; i >= 0; i--) arr.push(addDays(today, -i));
    return arr;
  }, [today]);

  const completionData = useMemo(() => {
    if (data.habits.length === 0) return [];
    return last14.map((d) => {
      const done = data.habits.filter((h) => h.entries[d]).length;
      return { date: shortLabel(d), "% выполнено": Math.round((done / data.habits.length) * 100) };
    });
  }, [data.habits, last14]);

  return (
    <div>
      <div className="rounded-xl p-4 mb-5 flex flex-wrap gap-3 items-center" style={{ backgroundColor: PANEL, border: `1px solid ${BORDER}` }}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addHabit()}
          placeholder="Новая привычка (например, 'Читать 20 мин')"
          className="flex-1 min-w-[200px] outline-none focus:border-[#9D3DFF]"
          style={inputStyle}
        />
        <div className="flex gap-1">
          {HABIT_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className="w-6 h-6 rounded-full"
              style={{ backgroundColor: c, outline: color === c ? `2px solid ${TEXT}` : "none", outlineOffset: "2px" }}
            />
          ))}
        </div>
        <button onClick={addHabit} className="flex items-center gap-1 px-4 py-2 rounded-lg font-semibold" style={{ backgroundColor: "#9D3DFF", color: "#F2EFE6" }}>
          <Plus size={18} /> Добавить
        </button>
      </div>

      {data.habits.length === 0 && <p className="text-sm" style={{ color: SUBTEXT }}>Пока нет привычек — добавь первую выше.</p>}

      <div className="flex flex-col gap-3 mb-6">
        {data.habits.map((h) => (
          <div key={h.id} className="rounded-xl p-4" style={{ backgroundColor: PANEL, border: `1px solid ${BORDER}` }}>
            <div className="flex items-center gap-3 mb-3">
              <button
                onClick={() => toggleToday(h.id)}
                className="w-8 h-8 rounded-md flex items-center justify-center shrink-0 border-2"
                style={{ borderColor: h.color, backgroundColor: h.entries[today] ? h.color : "transparent" }}
              >
                {h.entries[today] && <Check size={18} color="#F2EFE6" />}
              </button>
              <span className="font-semibold flex-1">{h.name}</span>
              <span className="flex items-center gap-1 mono-font text-sm" style={{ color: "#39FF6A" }}>
                <Flame size={16} /> {streak(h)}
              </span>
              <button onClick={() => deleteHabit(h.id)} style={{ color: SUBTEXT }} className="hover:text-[#9D3DFF]">
                <Trash2 size={16} />
              </button>
            </div>
            <div className="flex gap-1">
              {last30.map((d) => (
                <div key={d} title={d} className="flex-1 h-4 rounded-sm" style={{ backgroundColor: h.entries[d] ? h.color : MUTED_BG }} />
              ))}
            </div>
          </div>
        ))}
      </div>

      {completionData.length > 0 && (
        <ChartCard title="Общий процент выполнения привычек (14 дней)">
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={completionData}>
              <CartesianGrid strokeDasharray="3 3" stroke={BORDER} />
              <XAxis dataKey="date" tick={{ fontSize: 12, fill: SUBTEXT }} />
              <YAxis tick={{ fontSize: 12, fill: SUBTEXT }} domain={[0, 100]} />
              <Tooltip contentStyle={{ background: MUTED_BG, border: `1px solid ${BORDER}`, color: TEXT }} />
              <Line type="monotone" dataKey="% выполнено" stroke="#9D3DFF" strokeWidth={3} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      )}
    </div>
  );
}

/* ================= TIME TAB ================= */

function DayLane({ blocks, height = 40 }) {
  const sorted = [...blocks].sort((a, b) => timeToMin(a.start) - timeToMin(b.start));
  return (
    <div className="relative w-full rounded-lg overflow-hidden" style={{ height, backgroundColor: MUTED_BG }}>
      {sorted.map((b) => {
        const cat = CATEGORIES.find((c) => c.key === b.category);
        const left = (timeToMin(b.start) / 1440) * 100;
        const width = Math.max(((timeToMin(b.end) - timeToMin(b.start)) / 1440) * 100, 0.3);
        const tooltip = b.source === "university"
          ? `${b.subject}${b.room ? " · ауд. " + b.room : ""} ${b.start}–${b.end}`
          : `${cat?.label} ${b.start}–${b.end}`;
        return (
          <div key={b.id} title={tooltip} className="absolute top-0 bottom-0"
            style={{ left: `${left}%`, width: `${width}%`, backgroundColor: cat?.color || "#999" }} />
        );
      })}
    </div>
  );
}

function TimeTab({ data, update, syncStatus, syncUniversitySchedule }) {
  const [date, setDate] = useState(todayStr());
  const [category, setCategory] = useState(CATEGORIES[1].key);
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("10:00");
  const [groupInput, setGroupInput] = useState(data.university?.groupId || "");

  const blocks = data.timeblocks[date] || [];

  const addBlock = () => {
    if (timeToMin(end) <= timeToMin(start)) return;
    update((prev) => ({
      ...prev,
      timeblocks: { ...prev.timeblocks, [date]: [...(prev.timeblocks[date] || []), { id: uid(), category, start, end }] },
    }));
  };

  const deleteBlock = (id) => {
    update((prev) => ({
      ...prev,
      timeblocks: { ...prev.timeblocks, [date]: (prev.timeblocks[date] || []).filter((b) => b.id !== id) },
    }));
  };

  const totals = useMemo(() => {
    const t = {};
    CATEGORIES.forEach((c) => (t[c.key] = 0));
    blocks.forEach((b) => { t[b.category] = (t[b.category] || 0) + (timeToMin(b.end) - timeToMin(b.start)); });
    return t;
  }, [blocks]);

  const weekDates = useMemo(() => {
    const arr = [];
    for (let i = 6; i >= 0; i--) arr.push(addDays(date, -i));
    return arr;
  }, [date]);

  const weekChartData = useMemo(() => {
    return weekDates.map((d) => {
      const row = { date: `${weekdayLabel(d)} ${shortLabel(d)}` };
      const dayBlocks = data.timeblocks[d] || [];
      CATEGORIES.forEach((c) => {
        const mins = dayBlocks.filter((b) => b.category === c.key).reduce((s, b) => s + (timeToMin(b.end) - timeToMin(b.start)), 0);
        row[c.label] = +(mins / 60).toFixed(1);
      });
      return row;
    });
  }, [weekDates, data.timeblocks]);

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => setDate(addDays(date, -1))} className="p-2 rounded-lg" style={{ backgroundColor: PANEL, border: `1px solid ${BORDER}` }}>
          <ChevronLeft size={18} />
        </button>
        <div className="display-font text-2xl font-bold">
          {new Date(date + "T00:00:00").toLocaleDateString("ru-RU", { day: "numeric", month: "long", weekday: "long" })}
        </div>
        <button onClick={() => setDate(addDays(date, 1))} className="p-2 rounded-lg" style={{ backgroundColor: PANEL, border: `1px solid ${BORDER}` }}>
          <ChevronRight size={18} />
        </button>
        {date !== todayStr() && (
          <button onClick={() => setDate(todayStr())} className="ml-auto text-sm underline" style={{ color: "#9D3DFF" }}>Сегодня</button>
        )}
      </div>

      <div className="rounded-xl p-4 mb-3 flex flex-wrap items-center gap-3" style={{ backgroundColor: PANEL, border: `1px solid ${BORDER}` }}>
        <div className="flex flex-col gap-1">
          <label className="text-xs" style={{ color: SUBTEXT }}>Номер группы</label>
          <input
            value={groupInput}
            onChange={(e) => setGroupInput(e.target.value)}
            placeholder="21307"
            className="mono-font"
            style={{ ...inputStyle, width: 100 }}
          />
        </div>
        <button
          onClick={() => syncUniversitySchedule(groupInput.trim())}
          disabled={syncStatus === "loading" || !groupInput.trim()}
          className="flex items-center gap-1 px-4 py-2 rounded-lg font-semibold self-end"
          style={{ backgroundColor: "#39C6FF", color: "#0A1A20", opacity: syncStatus === "loading" ? 0.6 : 1 }}
        >
          {syncStatus === "loading" ? "Загрузка..." : "Загрузить расписание"}
        </button>
        <div className="text-xs self-end" style={{ color: syncStatus === "error" ? "#9D3DFF" : SUBTEXT }}>
          {syncStatus === "error" && "Не удалось получить расписание — попробуй ещё раз."}
          {syncStatus !== "error" && data.university?.lastSync &&
            `Обновлено: ${new Date(data.university.lastSync).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}`}
          {syncStatus !== "error" && !data.university?.lastSync && "Пары из университета появятся здесь после загрузки"}
        </div>
      </div>

      <div className="rounded-xl p-4 mb-3" style={{ backgroundColor: PANEL, border: `1px solid ${BORDER}` }}>
        <DayLane blocks={blocks} height={48} />
        <div className="flex justify-between mono-font text-xs mt-1" style={{ color: SUBTEXT }}>
          {[0, 3, 6, 9, 12, 15, 18, 21, 24].map((h) => <span key={h}>{String(h).padStart(2, "0")}:00</span>)}
        </div>
      </div>

      <div className="rounded-xl p-4 mb-5 flex flex-wrap gap-3 items-end" style={{ backgroundColor: PANEL, border: `1px solid ${BORDER}` }}>
        <div className="flex flex-col gap-1">
          <label className="text-xs" style={{ color: SUBTEXT }}>Категория</label>
          <select value={category} onChange={(e) => setCategory(e.target.value)} style={inputStyle}>
            {CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs" style={{ color: SUBTEXT }}>Начало</label>
          <input type="time" value={start} onChange={(e) => setStart(e.target.value)} className="mono-font" style={inputStyle} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs" style={{ color: SUBTEXT }}>Конец</label>
          <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className="mono-font" style={inputStyle} />
        </div>
        <button onClick={addBlock} className="flex items-center gap-1 px-4 py-2 rounded-lg font-semibold" style={{ backgroundColor: "#9D3DFF", color: "#F2EFE6" }}>
          <Plus size={18} /> Добавить блок
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-6">
        {CATEGORIES.map((c) => {
          const mins = totals[c.key] || 0;
          if (mins === 0) return null;
          return (
            <div key={c.key} className="rounded-lg px-3 py-2 flex items-center gap-2" style={{ backgroundColor: PANEL, border: `1px solid ${BORDER}` }}>
              <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
              <span className="text-sm flex-1">{c.label}</span>
              <span className="mono-font text-sm font-semibold">{(mins / 60).toFixed(1)} ч</span>
            </div>
          );
        })}
      </div>

      {blocks.length > 0 && (
        <div className="rounded-xl p-4 mb-6" style={{ backgroundColor: PANEL, border: `1px solid ${BORDER}` }}>
          <p className="text-sm font-semibold mb-2">Блоки за день</p>
          <div className="flex flex-col gap-1">
            {[...blocks].sort((a, b) => timeToMin(a.start) - timeToMin(b.start)).map((b) => {
              const cat = CATEGORIES.find((c) => c.key === b.category);
              return (
                <div key={b.id} className="flex items-center gap-2 text-sm py-1">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cat?.color }} />
                  <span className="mono-font">{b.start}–{b.end}</span>
                  <span className="flex-1 min-w-0">
                    {b.source === "university" ? (
                      <>
                        <span className="font-semibold">{b.subject}</span>
                        {b.room && <span style={{ color: SUBTEXT }}> · ауд. {b.room}</span>}
                        {b.lecturer && <span style={{ color: SUBTEXT }}> · {b.lecturer}</span>}
                      </>
                    ) : (
                      cat?.label
                    )}
                  </span>
                  <button onClick={() => deleteBlock(b.id)} style={{ color: SUBTEXT }} className="hover:text-[#9D3DFF] shrink-0">
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="mb-6">
        <p className="display-font text-xl font-bold mb-2">НЕДЕЛЯ</p>
        <div className="flex flex-col gap-2">
          {weekDates.map((d) => (
            <div key={d} className="flex items-center gap-3">
              <span className="mono-font text-xs w-16 capitalize" style={{ color: SUBTEXT }}>{weekdayLabel(d)} {shortLabel(d)}</span>
              <div className="flex-1"><DayLane blocks={data.timeblocks[d] || []} height={20} /></div>
            </div>
          ))}
        </div>
      </div>

      <ChartCard title="Часы по категориям за неделю">
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={weekChartData}>
            <CartesianGrid strokeDasharray="3 3" stroke={BORDER} />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: SUBTEXT }} />
            <YAxis tick={{ fontSize: 12, fill: SUBTEXT }} />
            <Tooltip contentStyle={{ background: MUTED_BG, border: `1px solid ${BORDER}`, color: TEXT }} />
            <Legend wrapperStyle={{ fontSize: 12, color: SUBTEXT }} />
            {CATEGORIES.map((c) => (
              <Bar key={c.key} dataKey={c.label} stackId="a" fill={c.color} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}

/* ================= TRAINING TAB ================= */

function TrainingTab({ data, update }) {
  const [type, setType] = useState("run");
  const [date, setDate] = useState(todayStr());
  const [distance, setDistance] = useState("");
  const [duration, setDuration] = useState("");
  const [exercise, setExercise] = useState("");
  const [weight, setWeight] = useState("");
  const [reps, setReps] = useState("");
  const [sets, setSets] = useState("");
  const [intensity, setIntensity] = useState(5);
  const [note, setNote] = useState("");
  const [exerciseFilter, setExerciseFilter] = useState("");

  const resetFields = () => {
    setDistance(""); setDuration(""); setExercise(""); setWeight(""); setReps(""); setSets(""); setNote(""); setIntensity(5);
  };

  const addWorkout = () => {
    const base = { id: uid(), type, date, intensity: Number(intensity), note: note.trim() };
    let entry = null;
    if (type === "run") {
      if (!distance || !duration) return;
      entry = { ...base, distance: Number(distance), duration: Number(duration) };
    } else if (type === "gym") {
      if (!exercise.trim()) return;
      entry = { ...base, exercise: exercise.trim(), weight: Number(weight) || 0, reps: Number(reps) || 0, sets: Number(sets) || 1 };
    } else if (type === "martial") {
      if (!duration) return;
      entry = { ...base, duration: Number(duration) };
    } else {
      entry = { ...base, duration: Number(duration) || 0 };
    }
    update((prev) => ({ ...prev, workouts: [entry, ...prev.workouts] }));
    resetFields();
  };

  const deleteWorkout = (id) => update((prev) => ({ ...prev, workouts: prev.workouts.filter((w) => w.id !== id) }));

  const sorted = useMemo(() => [...data.workouts].sort((a, b) => (a.date < b.date ? 1 : -1)), [data.workouts]);

  const runData = useMemo(
    () => data.workouts.filter((w) => w.type === "run").sort((a, b) => (a.date > b.date ? 1 : -1))
      .map((w) => ({ date: shortLabel(w.date), "Дистанция": w.distance })),
    [data.workouts]
  );

  const gymExercises = useMemo(
    () => Array.from(new Set(data.workouts.filter((w) => w.type === "gym").map((w) => w.exercise))),
    [data.workouts]
  );

  useEffect(() => { if (!exerciseFilter && gymExercises.length > 0) setExerciseFilter(gymExercises[0]); }, [gymExercises, exerciseFilter]);

  const gymData = useMemo(
    () => data.workouts.filter((w) => w.type === "gym" && w.exercise === exerciseFilter).sort((a, b) => (a.date > b.date ? 1 : -1))
      .map((w) => ({ date: shortLabel(w.date), "Вес": w.weight })),
    [data.workouts, exerciseFilter]
  );

  const countsByType = useMemo(() => {
    const map = {};
    WORKOUT_TYPES.forEach((t) => (map[t.key] = 0));
    data.workouts.forEach((w) => (map[w.type] = (map[w.type] || 0) + 1));
    return WORKOUT_TYPES.map((t) => ({ type: t.label, "Тренировок": map[t.key] }));
  }, [data.workouts]);

  return (
    <div>
      <div className="rounded-xl p-4 mb-5" style={{ backgroundColor: PANEL, border: `1px solid ${BORDER}` }}>
        <div className="flex gap-2 mb-3 flex-wrap">
          {WORKOUT_TYPES.map((t) => {
            const Icon = t.icon;
            return (
              <button key={t.key} onClick={() => setType(t.key)} className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-semibold"
                style={{ backgroundColor: type === t.key ? "#9D3DFF" : MUTED_BG, color: type === t.key ? "#F2EFE6" : TEXT }}>
                <Icon size={16} /> {t.label}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-3 items-end">
          <Field label="Дата"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mono-font" style={inputStyle} /></Field>

          {type === "run" && (<>
            <Field label="Дистанция, км"><input type="number" step="0.1" value={distance} onChange={(e) => setDistance(e.target.value)} style={{ ...inputStyle, width: 100 }} /></Field>
            <Field label="Время, мин"><input type="number" value={duration} onChange={(e) => setDuration(e.target.value)} style={{ ...inputStyle, width: 100 }} /></Field>
          </>)}
          {type === "gym" && (<>
            <Field label="Упражнение"><input value={exercise} onChange={(e) => setExercise(e.target.value)} placeholder="Жим лёжа" style={{ ...inputStyle, width: 140 }} /></Field>
            <Field label="Вес, кг"><input type="number" value={weight} onChange={(e) => setWeight(e.target.value)} style={{ ...inputStyle, width: 80 }} /></Field>
            <Field label="Повторы"><input type="number" value={reps} onChange={(e) => setReps(e.target.value)} style={{ ...inputStyle, width: 80 }} /></Field>
            <Field label="Подходы"><input type="number" value={sets} onChange={(e) => setSets(e.target.value)} style={{ ...inputStyle, width: 80 }} /></Field>
          </>)}
          {(type === "martial" || type === "other") && (
            <Field label="Длительность, мин"><input type="number" value={duration} onChange={(e) => setDuration(e.target.value)} style={{ ...inputStyle, width: 100 }} /></Field>
          )}

          <Field label={`Интенсивность: ${intensity}/10`}>
            <input type="range" min="1" max="10" value={intensity} onChange={(e) => setIntensity(e.target.value)} className="w-28" />
          </Field>
          <Field label="Заметка"><input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Как прошло..." style={{ ...inputStyle, minWidth: 160 }} /></Field>

          <button onClick={addWorkout} className="flex items-center gap-1 px-4 py-2 rounded-lg font-semibold" style={{ backgroundColor: "#9D3DFF", color: "#F2EFE6" }}>
            <Plus size={18} /> Записать
          </button>
        </div>
      </div>

      {runData.length > 1 && (
        <ChartCard title="Прогресс в беге (км)">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={runData}>
              <CartesianGrid strokeDasharray="3 3" stroke={BORDER} />
              <XAxis dataKey="date" tick={{ fontSize: 12, fill: SUBTEXT }} />
              <YAxis tick={{ fontSize: 12, fill: SUBTEXT }} />
              <Tooltip contentStyle={{ background: MUTED_BG, border: `1px solid ${BORDER}`, color: TEXT }} />
              <Line type="monotone" dataKey="Дистанция" stroke="#39FF6A" strokeWidth={3} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      {gymExercises.length > 0 && (
        <ChartCard title="Прогресс в зале" right={
          <select value={exerciseFilter} onChange={(e) => setExerciseFilter(e.target.value)} style={inputStyle}>
            {gymExercises.map((ex) => <option key={ex} value={ex}>{ex}</option>)}
          </select>
        }>
          {gymData.length > 1 ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={gymData}>
                <CartesianGrid strokeDasharray="3 3" stroke={BORDER} />
                <XAxis dataKey="date" tick={{ fontSize: 12, fill: SUBTEXT }} />
                <YAxis tick={{ fontSize: 12, fill: SUBTEXT }} />
                <Tooltip contentStyle={{ background: MUTED_BG, border: `1px solid ${BORDER}`, color: TEXT }} />
                <Line type="monotone" dataKey="Вес" stroke="#7C838C" strokeWidth={3} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : <p className="text-sm" style={{ color: SUBTEXT }}>Нужна ещё хотя бы одна запись для графика.</p>}
        </ChartCard>
      )}

      {data.workouts.length > 0 && (
        <ChartCard title="Тренировок по видам">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={countsByType}>
              <CartesianGrid strokeDasharray="3 3" stroke={BORDER} />
              <XAxis dataKey="type" tick={{ fontSize: 12, fill: SUBTEXT }} />
              <YAxis tick={{ fontSize: 12, fill: SUBTEXT }} allowDecimals={false} />
              <Tooltip contentStyle={{ background: MUTED_BG, border: `1px solid ${BORDER}`, color: TEXT }} />
              <Bar dataKey="Тренировок" fill="#9D3DFF" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      <div className="mt-6">
        <p className="display-font text-xl font-bold mb-2">ЖУРНАЛ</p>
        {sorted.length === 0 && <p className="text-sm" style={{ color: SUBTEXT }}>Пока нет записей — добавь первую тренировку выше.</p>}
        <div className="flex flex-col gap-2">
          {sorted.map((w) => <WorkoutRow key={w.id} w={w} onDelete={() => deleteWorkout(w.id)} />)}
        </div>
      </div>
    </div>
  );
}

/* ================= TASKS TAB ================= */

function TasksTab({ data, update, notifPermission, requestNotifications }) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState(TASK_CATEGORIES[0].key);
  const [deadline, setDeadline] = useState(todayStr());
  const [showDone, setShowDone] = useState(false);

  const addTask = () => {
    if (!title.trim()) return;
    update((prev) => ({
      ...prev,
      tasks: [...prev.tasks, { id: uid(), title: title.trim(), category, deadline, done: false, createdAt: todayStr() }],
    }));
    setTitle("");
  };

  const toggleDone = (id) => update((prev) => ({
    ...prev,
    tasks: prev.tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t)),
  }));

  const deleteTask = (id) => update((prev) => ({ ...prev, tasks: prev.tasks.filter((t) => t.id !== id) }));

  const visibleTasks = useMemo(() => {
    return data.tasks
      .filter((t) => showDone || !t.done)
      .sort((a, b) => (a.deadline > b.deadline ? 1 : -1));
  }, [data.tasks, showDone]);

  const completedByWeek = useMemo(() => {
    const doneTasks = data.tasks.filter((t) => t.done);
    if (doneTasks.length === 0) return [];
    const buckets = {};
    doneTasks.forEach((t) => {
      const d = new Date(t.deadline + "T00:00:00");
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() - d.getDay());
      const key = fmtDate(weekStart);
      buckets[key] = (buckets[key] || 0) + 1;
    });
    return Object.keys(buckets).sort().slice(-8).map((k) => ({ week: shortLabel(k), "Выполнено": buckets[k] }));
  }, [data.tasks]);

  const byCategory = useMemo(() => {
    return TASK_CATEGORIES.map((c) => ({
      cat: c.label,
      "Активные": data.tasks.filter((t) => t.category === c.key && !t.done).length,
      "Выполнено": data.tasks.filter((t) => t.category === c.key && t.done).length,
    }));
  }, [data.tasks]);

  return (
    <div>
      <div className="rounded-xl p-4 mb-5 flex flex-wrap gap-3 items-end" style={{ backgroundColor: PANEL, border: `1px solid ${BORDER}` }}>
        <Field label="Задача">
          <input value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addTask()}
            placeholder="Например, 'Сдать отчёт'" style={{ ...inputStyle, minWidth: 220 }} />
        </Field>
        <Field label="Категория">
          <select value={category} onChange={(e) => setCategory(e.target.value)} style={inputStyle}>
            {TASK_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
        </Field>
        <Field label="Дедлайн">
          <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className="mono-font" style={inputStyle} />
        </Field>
        <button onClick={addTask} className="flex items-center gap-1 px-4 py-2 rounded-lg font-semibold" style={{ backgroundColor: "#9D3DFF", color: "#F2EFE6" }}>
          <Plus size={18} /> Добавить
        </button>
        {notifPermission !== "granted" && notifPermission !== "unsupported" && (
          <button onClick={requestNotifications} className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-semibold ml-auto"
            style={{ backgroundColor: MUTED_BG, border: `1px solid ${BORDER}`, color: TEXT }}>
            <Bell size={14} /> Включить уведомления
          </button>
        )}
      </div>

      <div className="flex items-center justify-between mb-3">
        <p className="display-font text-xl font-bold">ЗАДАЧИ</p>
        <label className="flex items-center gap-2 text-sm" style={{ color: SUBTEXT }}>
          <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} />
          Показывать выполненные
        </label>
      </div>

      {visibleTasks.length === 0 && <p className="text-sm mb-6" style={{ color: SUBTEXT }}>Нет задач — добавь первую выше.</p>}

      <div className="flex flex-col gap-2 mb-6">
        {visibleTasks.map((t) => {
          const cat = TASK_CATEGORIES.find((c) => c.key === t.category);
          const Icon = cat?.icon || Briefcase;
          const days = daysUntil(t.deadline);
          let badge = `через ${days} дн.`;
          let badgeColor = SUBTEXT;
          if (t.done) { badge = "выполнено"; badgeColor = "#C7C2AE"; }
          else if (days < 0) { badge = `просрочено на ${Math.abs(days)} дн.`; badgeColor = "#9D3DFF"; }
          else if (days === 0) { badge = "сегодня"; badgeColor = "#39FF6A"; }
          else if (days === 1) { badge = "завтра"; badgeColor = "#39FF6A"; }

          return (
            <div key={t.id} className="rounded-lg p-3 flex items-center gap-3" style={{ backgroundColor: PANEL, border: `1px solid ${BORDER}`, opacity: t.done ? 0.6 : 1 }}>
              <button onClick={() => toggleDone(t.id)} className="shrink-0" style={{ color: t.done ? "#C7C2AE" : SUBTEXT }}>
                {t.done ? <CheckCircle2 size={20} /> : <Circle size={20} />}
              </button>
              <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: MUTED_BG, color: cat?.color }}>
                <Icon size={15} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold" style={{ textDecoration: t.done ? "line-through" : "none" }}>{t.title}</p>
                <p className="text-xs" style={{ color: SUBTEXT }}>{cat?.label} · {shortLabel(t.deadline)}</p>
              </div>
              <span className="text-xs font-semibold mono-font shrink-0" style={{ color: badgeColor }}>{badge}</span>
              <button onClick={() => deleteTask(t.id)} style={{ color: SUBTEXT }} className="hover:text-[#9D3DFF] shrink-0">
                <Trash2 size={16} />
              </button>
            </div>
          );
        })}
      </div>

      {data.tasks.length > 0 && (
        <ChartCard title="Задачи по категориям">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={byCategory}>
              <CartesianGrid strokeDasharray="3 3" stroke={BORDER} />
              <XAxis dataKey="cat" tick={{ fontSize: 12, fill: SUBTEXT }} />
              <YAxis tick={{ fontSize: 12, fill: SUBTEXT }} allowDecimals={false} />
              <Tooltip contentStyle={{ background: MUTED_BG, border: `1px solid ${BORDER}`, color: TEXT }} />
              <Legend wrapperStyle={{ fontSize: 12, color: SUBTEXT }} />
              <Bar dataKey="Активные" fill="#7C838C" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Выполнено" fill="#C7C2AE" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      {completedByWeek.length > 1 && (
        <ChartCard title="Выполнено задач по неделям">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={completedByWeek}>
              <CartesianGrid strokeDasharray="3 3" stroke={BORDER} />
              <XAxis dataKey="week" tick={{ fontSize: 12, fill: SUBTEXT }} />
              <YAxis tick={{ fontSize: 12, fill: SUBTEXT }} allowDecimals={false} />
              <Tooltip contentStyle={{ background: MUTED_BG, border: `1px solid ${BORDER}`, color: TEXT }} />
              <Bar dataKey="Выполнено" fill="#39FF6A" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}
    </div>
  );
}

/* ================= FINANCE TAB ================= */

function FinanceTab({ data, update }) {
  const [type, setType] = useState("expense");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState(EXPENSE_CATEGORIES[0].key);
  const [date, setDate] = useState(todayStr());
  const [note, setNote] = useState("");
  const [pieScope, setPieScope] = useState("month");

  const categoryList = type === "expense" ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;

  useEffect(() => {
    setCategory(categoryList[0].key);
  }, [type]);

  const addTransaction = () => {
    const n = Number(amount);
    if (!n || n <= 0) return;
    update((prev) => ({
      ...prev,
      transactions: [{ id: uid(), type, amount: n, category, date, note: note.trim() }, ...prev.transactions],
    }));
    setAmount(""); setNote("");
  };

  const deleteTransaction = (id) => update((prev) => ({ ...prev, transactions: prev.transactions.filter((t) => t.id !== id) }));

  const currentMonth = todayStr().slice(0, 7);
  const monthTx = useMemo(() => data.transactions.filter((t) => t.date.slice(0, 7) === currentMonth), [data.transactions, currentMonth]);
  const monthIncome = monthTx.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const monthExpense = monthTx.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const totalBalance = useMemo(
    () => data.transactions.reduce((s, t) => s + (t.type === "income" ? t.amount : -t.amount), 0),
    [data.transactions]
  );

  const pieSource = pieScope === "month" ? monthTx : data.transactions;
  const expensePieData = useMemo(() => {
    return EXPENSE_CATEGORIES.map((c) => ({
      name: c.label,
      value: pieSource.filter((t) => t.type === "expense" && t.category === c.key).reduce((s, t) => s + t.amount, 0),
      color: c.color,
    })).filter((d) => d.value > 0);
  }, [pieSource]);

  const monthlyTrend = useMemo(() => {
    const buckets = {};
    data.transactions.forEach((t) => {
      const key = t.date.slice(0, 7);
      if (!buckets[key]) buckets[key] = { income: 0, expense: 0 };
      buckets[key][t.type] += t.amount;
    });
    return Object.keys(buckets).sort().slice(-6).map((k) => ({
      month: monthLabel(k), "Доход": buckets[k].income, "Расход": buckets[k].expense,
    }));
  }, [data.transactions]);

  const sortedTx = useMemo(() => [...data.transactions].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 40), [data.transactions]);

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
        <SummaryCard icon={TrendingUp} label="Доход в этом месяце" value={`${fmtMoney(monthIncome)} ₽`} color="#C7C2AE" />
        <SummaryCard icon={TrendingDown} label="Расход в этом месяце" value={`${fmtMoney(monthExpense)} ₽`} color="#9D3DFF" />
        <SummaryCard icon={Wallet} label="Общий баланс" value={`${totalBalance >= 0 ? "" : "−"}${fmtMoney(Math.abs(totalBalance))} ₽`} color="#39FF6A" />
      </div>

      <div className="rounded-xl p-4 mb-5" style={{ backgroundColor: PANEL, border: `1px solid ${BORDER}` }}>
        <div className="flex gap-2 mb-3">
          <button onClick={() => setType("expense")} className="flex-1 px-3 py-2 rounded-lg text-sm font-semibold"
            style={{ backgroundColor: type === "expense" ? "#9D3DFF" : MUTED_BG, color: type === "expense" ? "#F2EFE6" : TEXT }}>
            Расход
          </button>
          <button onClick={() => setType("income")} className="flex-1 px-3 py-2 rounded-lg text-sm font-semibold"
            style={{ backgroundColor: type === "income" ? "#C7C2AE" : MUTED_BG, color: type === "income" ? "#F2EFE6" : TEXT }}>
            Доход
          </button>
        </div>
        <div className="flex flex-wrap gap-3 items-end">
          <Field label="Сумма, ₽"><input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} style={{ ...inputStyle, width: 120 }} /></Field>
          <Field label="Категория">
            <select value={category} onChange={(e) => setCategory(e.target.value)} style={inputStyle}>
              {categoryList.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
          </Field>
          <Field label="Дата"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mono-font" style={inputStyle} /></Field>
          <Field label="Заметка"><input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Необязательно" style={{ ...inputStyle, minWidth: 160 }} /></Field>
          <button onClick={addTransaction} className="flex items-center gap-1 px-4 py-2 rounded-lg font-semibold" style={{ backgroundColor: "#9D3DFF", color: "#F2EFE6" }}>
            <Plus size={18} /> Записать
          </button>
        </div>
      </div>

      {expensePieData.length > 0 && (
        <ChartCard title="Структура расходов" right={
          <div className="flex gap-1 text-xs">
            <button onClick={() => setPieScope("month")} className="px-2 py-1 rounded"
              style={{ backgroundColor: pieScope === "month" ? "#9D3DFF" : MUTED_BG, color: pieScope === "month" ? "#F2EFE6" : SUBTEXT }}>
              Этот месяц
            </button>
            <button onClick={() => setPieScope("all")} className="px-2 py-1 rounded"
              style={{ backgroundColor: pieScope === "all" ? "#9D3DFF" : MUTED_BG, color: pieScope === "all" ? "#F2EFE6" : SUBTEXT }}>
              Всё время
            </button>
          </div>
        }>
          <div className="flex flex-col md:flex-row items-center gap-4">
            <ResponsiveContainer width="100%" height={220} className="md:flex-1">
              <PieChart>
                <Pie data={expensePieData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2}>
                  {expensePieData.map((d, i) => <Cell key={i} fill={d.color} stroke={PANEL} strokeWidth={2} />)}
                </Pie>
                <Tooltip contentStyle={{ background: MUTED_BG, border: `1px solid ${BORDER}`, color: TEXT }} formatter={(v) => `${fmtMoney(v)} ₽`} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-col gap-1.5 md:w-48 shrink-0">
              {expensePieData.sort((a, b) => b.value - a.value).map((d) => (
                <div key={d.name} className="flex items-center gap-2 text-sm">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                  <span className="flex-1">{d.name}</span>
                  <span className="mono-font" style={{ color: SUBTEXT }}>{fmtMoney(d.value)} ₽</span>
                </div>
              ))}
            </div>
          </div>
        </ChartCard>
      )}

      {monthlyTrend.length > 1 && (
        <ChartCard title="Доходы и расходы по месяцам">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthlyTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke={BORDER} />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: SUBTEXT }} />
              <YAxis tick={{ fontSize: 12, fill: SUBTEXT }} />
              <Tooltip contentStyle={{ background: MUTED_BG, border: `1px solid ${BORDER}`, color: TEXT }} formatter={(v) => `${fmtMoney(v)} ₽`} />
              <Legend wrapperStyle={{ fontSize: 12, color: SUBTEXT }} />
              <Bar dataKey="Доход" fill="#C7C2AE" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Расход" fill="#9D3DFF" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      <div className="mt-6">
        <p className="display-font text-xl font-bold mb-2">ОПЕРАЦИИ</p>
        {sortedTx.length === 0 && <p className="text-sm" style={{ color: SUBTEXT }}>Пока нет операций — добавь первую выше.</p>}
        <div className="flex flex-col gap-2">
          {sortedTx.map((t) => {
            const cat = (t.type === "expense" ? EXPENSE_CATEGORIES : INCOME_CATEGORIES).find((c) => c.key === t.category);
            return (
              <div key={t.id} className="rounded-lg p-3 flex items-center gap-3" style={{ backgroundColor: PANEL, border: `1px solid ${BORDER}` }}>
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cat?.color }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">{cat?.label}{t.note ? ` — ${t.note}` : ""}</p>
                  <p className="text-xs mono-font" style={{ color: SUBTEXT }}>{shortLabel(t.date)}</p>
                </div>
                <span className="mono-font text-sm font-semibold shrink-0" style={{ color: t.type === "income" ? "#C7C2AE" : "#9D3DFF" }}>
                  {t.type === "income" ? "+" : "−"}{fmtMoney(t.amount)} ₽
                </span>
                <button onClick={() => deleteTransaction(t.id)} style={{ color: SUBTEXT }} className="hover:text-[#9D3DFF] shrink-0">
                  <Trash2 size={16} />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, color }) {
  return (
    <div className="rounded-xl p-4 flex items-center gap-3" style={{ backgroundColor: PANEL, border: `1px solid ${BORDER}` }}>
      <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: MUTED_BG, color }}>
        <Icon size={18} />
      </div>
      <div>
        <p className="text-xs" style={{ color: SUBTEXT }}>{label}</p>
        <p className="mono-font text-lg font-bold">{value}</p>
      </div>
    </div>
  );
}

/* ================= shared bits ================= */

function Field({ label, children }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs" style={{ color: SUBTEXT }}>{label}</label>
      {children}
    </div>
  );
}

function ChartCard({ title, right, children }) {
  return (
    <div className="rounded-xl p-4 mb-5" style={{ backgroundColor: PANEL, border: `1px solid ${BORDER}` }}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-semibold">{title}</p>
        {right}
      </div>
      {children}
    </div>
  );
}

function WorkoutRow({ w, onDelete }) {
  const meta = WORKOUT_TYPES.find((t) => t.key === w.type);
  const Icon = meta?.icon || Activity;
  let detail = "";
  if (w.type === "run") detail = `${w.distance} км · ${w.duration} мин · темп ${(w.duration / w.distance).toFixed(2)} мин/км`;
  else if (w.type === "gym") detail = `${w.exercise} — ${w.weight} кг × ${w.reps} × ${w.sets} подх.`;
  else detail = `${w.duration} мин`;

  return (
    <div className="rounded-lg p-3 flex items-center gap-3" style={{ backgroundColor: PANEL, border: `1px solid ${BORDER}` }}>
      <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: MUTED_BG }}>
        <Icon size={16} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-semibold">{meta?.label}</span>
          <span className="mono-font text-xs" style={{ color: SUBTEXT }}>{shortLabel(w.date)}</span>
          <span className="flex items-center gap-1 text-xs" style={{ color: "#39FF6A" }}>
            <Clock size={12} /> {w.intensity}/10
          </span>
        </div>
        <p className="text-sm truncate" style={{ color: SUBTEXT }}>{detail}{w.note ? ` — ${w.note}` : ""}</p>
      </div>
      <button onClick={onDelete} style={{ color: SUBTEXT }} className="hover:text-[#9D3DFF] shrink-0">
        <Trash2 size={16} />
      </button>
    </div>
  );
}
