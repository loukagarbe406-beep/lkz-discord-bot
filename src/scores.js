/**
 * Scores live / finaux (source ESPN — Flashscore bloque les bots).
 * Même idée : matchs du jour + résultat auto.
 */

function stripAccents(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** Normalise un nom d’équipe pour comparer */
export function normalizeTeam(name) {
  return stripAccents(name)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(
      /\b(fc|cf|sc|afc|cfc|ac|as|ss|ud|cd|rc|women|womens|w|men|mens|u19|u21|u23|ii|b|reserve|reserves)\b/g,
      " "
    )
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(name) {
  return normalizeTeam(name).split(" ").filter((t) => t.length > 1);
}

/** Score de similarité 0–1 entre deux noms d’équipes */
export function teamSimilarity(a, b) {
  const na = normalizeTeam(a);
  const nb = normalizeTeam(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.92;

  const ta = tokens(a);
  const tb = tokens(b);
  if (!ta.length || !tb.length) return 0;
  const setB = new Set(tb);
  const inter = ta.filter((t) => setB.has(t)).length;
  const union = new Set([...ta, ...tb]).size;
  return inter / union;
}

function parseEvent(e) {
  const c = e.competitions?.[0];
  if (!c) return null;
  const home = c.competitors?.find((x) => x.homeAway === "home");
  const away = c.competitors?.find((x) => x.homeAway === "away");
  if (!home || !away) return null;
  const type = c.status?.type || {};
  return {
    home: home.team?.displayName || home.team?.name || "",
    away: away.team?.displayName || away.team?.name || "",
    homeScore: Number(home.score),
    awayScore: Number(away.score),
    completed: Boolean(type.completed),
    state: String(type.state || ""),
    status: String(type.name || ""),
    league: e.league?.name || c.league?.name || "",
  };
}

/** Récupère les matchs foot du jour (ESPN). */
export async function fetchDayScores() {
  const res = await fetch(
    "https://site.api.espn.com/apis/site/v2/sports/soccer/all/scoreboard",
    {
      headers: {
        Accept: "application/json",
        "User-Agent": "LKZ-PronosBot/1.0",
      },
      cache: "no-store",
    }
  );
  if (!res.ok) throw new Error(`scores HTTP ${res.status}`);
  const data = await res.json();
  return (data.events || []).map(parseEvent).filter(Boolean);
}

/**
 * Trouve un score final pour home/away.
 * @returns {{ homeScore: number, awayScore: number, home: string, away: string } | null}
 */
export function findFinishedScore(home, away, dayScores) {
  let best = null;
  let bestScore = 0;

  for (const m of dayScores) {
    if (!m.completed) continue;
    if (!Number.isFinite(m.homeScore) || !Number.isFinite(m.awayScore)) continue;

    const sameWay =
      teamSimilarity(home, m.home) * 0.5 + teamSimilarity(away, m.away) * 0.5;
    const flipped =
      teamSimilarity(home, m.away) * 0.5 + teamSimilarity(away, m.home) * 0.5;

    if (sameWay >= 0.72 && sameWay > bestScore) {
      bestScore = sameWay;
      best = {
        homeScore: m.homeScore,
        awayScore: m.awayScore,
        home: m.home,
        away: m.away,
        confidence: sameWay,
      };
    }
    if (flipped >= 0.72 && flipped > bestScore) {
      bestScore = flipped;
      best = {
        homeScore: m.awayScore,
        awayScore: m.homeScore,
        home: m.away,
        away: m.home,
        confidence: flipped,
      };
    }
  }

  return best;
}
