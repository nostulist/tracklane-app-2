// Vercel serverless function — reads the group's schedule directly from
// petrsu.ru (the university's own public schedule pages, no login
// required) and returns it as clean JSON. This runs on our own server,
// not in the visitor's browser, so it isn't limited by CORS. It's used
// for personal, low-frequency access (once a day) to one's own class
// schedule — not bulk crawling.
import { parse } from "node-html-parser";

function mondayOf(d) {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  return monday;
}

function fmtRuDate(d) {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}.${mm}.${d.getFullYear()}`;
}

async function fetchWeek(group, weekStart) {
  const url = `https://petrsu.ru/schedule/term?group=${encodeURIComponent(group)}&date=${fmtRuDate(weekStart)}`;
  const r = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (personal schedule sync)" },
  });
  if (!r.ok) return [];
  const html = await r.text();
  const root = parse(html);
  const panels = root.querySelectorAll(".accordion-schedule .panel-schedule");
  const lessons = [];

  panels.forEach((panel, dayIndex) => {
    const cls = panel.getAttribute("class") || "";
    if (cls.includes("panel-nonexist")) return;

    const rows = panel.querySelectorAll(".rTableRow");
    rows.forEach((row) => {
      const cells = row.querySelectorAll(".rTableCell");
      if (cells.length < 5) return;

      const timeLines = cells[1].innerText.split("\n").map((s) => s.trim()).filter(Boolean);
      const subjectEl = cells[2].querySelector("b");
      const lecturerEl = cells[2].querySelector(".cyan-text");
      const typeLines = cells[3].innerText.split("\n").map((s) => s.trim()).filter(Boolean);

      const lessonDate = new Date(weekStart);
      lessonDate.setDate(weekStart.getDate() + dayIndex);

      lessons.push({
        date: fmtRuDate(lessonDate),
        start_time: timeLines[0] || "",
        end_time: timeLines[1] || "",
        name: subjectEl ? subjectEl.innerText.trim() : "",
        lecturer: lecturerEl ? lecturerEl.innerText.replace(/\s+/g, " ").trim() : "",
        classroom: cells[4].innerText.replace(/\s+/g, " ").trim(),
        type: typeLines[0] || "",
      });
    });
  });

  return lessons;
}

export default async function handler(req, res) {
  const { group, debug } = req.query;
  if (!group || typeof group !== "string") {
    return res.status(400).json({ error: "Параметр group обязателен" });
  }

  try {
    const monday = mondayOf(new Date());

    if (debug) {
      const url = `https://petrsu.ru/schedule/term?group=${encodeURIComponent(group)}&date=${fmtRuDate(monday)}`;
      const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (personal schedule sync)" } });
      const html = await r.text();
      return res.status(200).json({
        requestedUrl: url,
        upstreamStatus: r.status,
        htmlLength: html.length,
        htmlSnippet: html.slice(0, 1500),
      });
    }

    const weekStarts = [0, 1, 2, 3].map((i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i * 7);
      return d;
    });

    const weeks = await Promise.all(weekStarts.map((d) => fetchWeek(group, d)));
    const lessons = weeks.flat();

    res.setHeader("Cache-Control", "s-maxage=21600, stale-while-revalidate=86400");
    return res.status(200).json({ lessons });
  } catch (e) {
    console.error("Schedule fetch failed", e);
    return res.status(502).json({ error: "Не удалось получить расписание с сайта университета" });
  }
}
