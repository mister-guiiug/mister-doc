// Edge Function « calendar » — flux iCalendar (.ics) du planning mister-doc.
//
// Accès par token secret dans l'URL :
//   - token PAR MÉDECIN (doctors.calendar_token, révocable) → &scope=me possible ;
//   - ou ancien token partagé (app_config.calendar_token) → équipe seule.
// verify_jwt = false ; lecture via REST + service_role (aucun import externe).
//
//   ?token=SECRET               → toute l'équipe
//   ?token=DOCTOR_TOKEN&scope=me → uniquement ce médecin
//   ?token=...&timed=1          → événements horodatés (sinon journée entière)

const SHIFT_LABEL: Record<string, string> = {
  S1J: 'S1 Jour',
  S1N: 'S1 Nuit',
  S2J: 'S2 Jour',
  S3: 'S3',
};
const SHIFT_HOURS: Record<string, number> = { S1J: 10, S1N: 15, S2J: 8, S3: 8 };
// [début, fin, décalage de jour de la fin]
const SHIFT_TIMES: Record<string, [string, string, number]> = {
  S1J: ['080000', '180000', 0],
  S1N: ['180000', '090000', 1],
  S2J: ['080000', '160000', 0],
  S3: ['080000', '160000', 0],
};

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

const esc = (s: string) =>
  s
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');

const dateOnly = (iso: string) => iso.replace(/-/g, '');
function nextDay(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1))
    .toISOString()
    .slice(0, 10)
    .replace(/-/g, '');
}
const stamp = () =>
  new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');

function allDay(uid: string, start: string, summary: string, cat: string) {
  return [
    'BEGIN:VEVENT',
    `UID:${uid}@mister-doc`,
    `DTSTAMP:${stamp()}`,
    `DTSTART;VALUE=DATE:${dateOnly(start)}`,
    `DTEND;VALUE=DATE:${nextDay(start)}`,
    `SUMMARY:${esc(summary)}`,
    `CATEGORIES:${esc(cat)}`,
    'TRANSP:TRANSPARENT',
    'END:VEVENT',
  ].join('\r\n');
}

function timed(
  uid: string,
  start: string,
  type: string,
  summary: string,
  cat: string
) {
  const t = SHIFT_TIMES[type];
  if (!t) return allDay(uid, start, summary, cat);
  const startDT = `${dateOnly(start)}T${t[0]}`;
  const endDate = t[2] === 1 ? nextDay(start) : dateOnly(start);
  return [
    'BEGIN:VEVENT',
    `UID:${uid}@mister-doc`,
    `DTSTAMP:${stamp()}`,
    `DTSTART:${startDT}`,
    `DTEND:${endDate}T${t[1]}`,
    `SUMMARY:${esc(summary)}`,
    `CATEGORIES:${esc(cat)}`,
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
interface Note {
  work_date: string;
  note: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const url = new URL(req.url);
    const token = url.searchParams.get('token') ?? '';
    const wantTimed = url.searchParams.get('timed') === '1';
    const wantMine = url.searchParams.get('scope') === 'me';

    if (!token) return new Response('Token requis.', { status: 401, headers: CORS });

    // 1) token par médecin ?
    const owner = await rest<{ id: string }[]>(
      `doctors?calendar_token=eq.${encodeURIComponent(token)}&select=id`
    );
    let scopedDoctorId: string | null = null;
    if (owner.length > 0) {
      if (wantMine) scopedDoctorId = owner[0].id;
    } else {
      // 2) ancien token partagé (équipe) ?
      const cfg = await rest<{ calendar_token: string | null }[]>(
        'app_config?id=eq.1&select=calendar_token'
      );
      if (!cfg[0]?.calendar_token || token !== cfg[0].calendar_token) {
        return new Response('Token invalide.', { status: 401, headers: CORS });
      }
    }

    const filter = scopedDoctorId
      ? `&doctor_id=eq.${encodeURIComponent(scopedDoctorId)}`
      : '';
    const [doctors, shifts, leaves, notes] = await Promise.all([
      rest<Doctor[]>('doctors?select=id,name'),
      rest<Shift[]>(`shifts?select=id,work_date,shift_type,doctor_id${filter}`),
      rest<Leave[]>(`leaves?select=id,work_date,kind,hours,doctor_id${filter}`),
      scopedDoctorId
        ? Promise.resolve([] as Note[])
        : rest<Note[]>('day_notes?select=work_date,note'),
    ]);
    const nameById = new Map(doctors.map(d => [d.id, d.name]));

    const events: string[] = [];
    for (const s of shifts) {
      const who = nameById.get(s.doctor_id) ?? '?';
      const label = SHIFT_LABEL[s.shift_type] ?? s.shift_type;
      const h = SHIFT_HOURS[s.shift_type] ?? 0;
      const summary = `${label} · ${who} (${h}h)`;
      events.push(
        wantTimed
          ? timed(`shift-${s.id}`, s.work_date, s.shift_type, summary, label)
          : allDay(`shift-${s.id}`, s.work_date, summary, label)
      );
    }
    for (const l of leaves) {
      const who = nameById.get(l.doctor_id) ?? '?';
      const summary =
        l.kind === 'training'
          ? `Formation · ${who}${l.hours != null ? ` (${l.hours}h)` : ''}`
          : `Congé annuel · ${who}`;
      events.push(
        allDay(
          `leave-${l.id}`,
          l.work_date,
          summary,
          l.kind === 'training' ? 'Formation' : 'Congé'
        )
      );
    }
    for (const n of notes) {
      events.push(allDay(`note-${n.work_date}`, n.work_date, `📝 ${n.note}`, 'Note'));
    }

    const calName = scopedDoctorId
      ? `mister-doc — ${nameById.get(scopedDoctorId) ?? 'médecin'}`
      : 'mister-doc — Planning de gardes';

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
