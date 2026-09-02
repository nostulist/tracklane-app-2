// Proxies /api/v2/week — tells us whether the current week is
// "числитель" (numerator) or "знаменатель" (denominator).
export default async function handler(req, res) {
  try {
    const upstream = await fetch("https://petrsu.egipti.com/api/v2/week");
    const data = await upstream.json();
    res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400");
    return res.status(200).json(data);
  } catch (e) {
    return res.status(502).json({ error: "Не удалось получить тип недели" });
  }
}
