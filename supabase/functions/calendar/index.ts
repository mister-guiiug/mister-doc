// Edge Function « calendar » — flux iCalendar (.ics) du planning mister-doc.
//
// Accès protégé par un token secret dans l'URL (?token=...), validé contre
// app_config.calendar_token. Déployée avec verify_jwt = false (les agendas ne
// peuvent pas envoyer de JWT Supabase). Lecture via l'API REST + clé
// service_role (aucun import externe → démarrage fiable).
//
//   GET /functions/v1/calendar?token=SECRET            → toute l'équipe
//   GET /functions/v1/calendar?token=SECRET&doctor=ID  → un seul médecin

const SHIFT_LABEL: Record<string, string> = {
  S1J: 'S1 Jour',
  S1N: 'S1 Nuit',
  S2J: 'S2 Jour',
  S3: 'S3',
};
const SHIFT_HOURS: Record<string, number> = { S1J: 10, S1N: 15, S2J: 8, S3: 8 };

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

async function rest<T>(path: string): Promise<T> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  });
  if (!res.ok) throw new Error(`REST ${path}: ${res.status}`);
  return (await res.json()) as T;
}

function esc(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

function dateOnly(iso: string): string {
  return iso.replace(/-/g, '');
}

function nextDay(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1))
    .toISOString()
    .slice(0, 10)
    .replace(/-/g, '');
}

function stamp(): string {
  return new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function vevent(
  uid: string,
  start: string,
  summary: string,
  category: string
): string {
  return [
    'BEGIN:VEVENT',
    `UID:${uid}@mister-doc`,
    `DTSTAMP:${stamp()}`,
    `DTSTART;VALUE=DATE:${dateOnly(start)}`,
    `DTEND;VALUE=DATE:${nextDay(start)}`,
    `SUMMARY:${esc(summary)}`,
    `CATEGORIES:${esc(category)}`,
    'TRANSP:TRANSPARENT',
    'END:VEVENT',
  ].join('\r\n');
}

interface Doctor {
  id: string;
  name: string;
}
interface Shift {
  id: string;
  work_date: string;
  shift_type: string;
  doctor_id: string;
}
interface Leave {
  id: string;
  work_date: string;
  kind: string;
  hours: number | null;
  doctor_id: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get('token');
    const doctorFilter = url.searchParams.get('doctor');

    const cfg = await rest<{ calendar_token: string | null }[]>(
      'app_config?id=eq.1&select=calendar_token'
    );
    const expected = cfg[0]?.calendar_token;
    if (!token || !expected || token !== expected) {
      return new Response('Token invalide.', { status: 401, headers: CORS });
    }

    const filter = doctorFilter
      ? `&doctor_id=eq.${encodeURIComponent(doctorFilter)}`
      : '';
    const [doctors, shifts, leaves] = await Promise.all([
      rest<Doctor[]>('doctors?select=id,name'),
      rest<Shift[]>(`shifts?select=id,work_date,shift_type,doctor_id${filter}`),
      rest<Leave[]>(`leaves?select=id,work_date,kind,hours,doctor_id${filter}`),
    ]);
    const nameById = new Map(doctors.map(d => [d.id, d.name]));

    const events: string[] = [];
    for (const s of shifts) {
      const who = nameById.get(s.doctor_id) ?? '?';
      const label = SHIFT_LABEL[s.shift_type] ?? s.shift_type;
      const h = SHIFT_HOURS[s.shift_type] ?? 0;
      events.push(
        vevent(`shift-${s.id}`, s.work_date, `${label} · ${who} (${h}h)`, label)
      );
    }
    for (const l of leaves) {
      const who = nameById.get(l.doctor_id) ?? '?';
      const summary =
        l.kind === 'training'
          ? `Formation · ${who}${l.hours != null ? ` (${l.hours}h)` : ''}`
          : `Congé annuel · ${who}`;
      events.push(
        vevent(
          `leave-${l.id}`,
          l.work_date,
          summary,
          l.kind === 'training' ? 'Formation' : 'Congé'
        )
      );
    }

    const calName = doctorFilter
      ? `mister-doc — ${nameById.get(doctorFilter) ?? 'médecin'}`
      : 'mister-doc — Planning anesthésie';

    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//mister-doc//planning//FR',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      `X-WR-CALNAME:${esc(calName)}`,
      'X-WR-TIMEZONE:Europe/Paris',
      'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
      'X-PUBLISHED-TTL:PT1H',
      ...events,
      'END:VCALENDAR',
    ].join('\r\n');

    return new Response(ics, {
      headers: {
        ...CORS,
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'inline; filename="mister-doc.ics"',
        'Cache-Control': 'public, max-age=300',
      },
    });
  } catch (e) {
    return new Response(`Erreur: ${e instanceof Error ? e.message : e}`, {
      status: 500,
      headers: CORS,
    });
  }
});
