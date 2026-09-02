// Vercel serverless function — proxies the university schedule API.
// Calling it from our own domain avoids browser CORS restrictions,
// and keeps the upstream URL out of client-side network requests.
export default async function handler(req, res) {
  const { group } = req.query;
  if (!group || typeof group !== "string") {
    return res.status(400).json({ error: "Параметр group обязателен" });
  }
  try {
    const upstream = await fetch(
      `https://petrsu.egipti.com/api/v2/schedule/${encodeURIComponent(group)}`
    );
    if (!upstream.ok) {
      return res.status(502).json({ error: "Источник расписания недоступен" });
    }
    const data = await upstream.json();
    res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400");
    return res.status(200).json(data);
  } catch (e) {
    return res.status(502).json({ error: "Не удалось получить расписание" });
  }
}
