import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * LE CLIENT VIENT DE LA FABRIQUE DU SOCLE, MAIS LES OPTIONS SONT CELLES DE
 * L'APP — et ce test les tient une à une. La copie locale passait
 * `persistSession`, `autoRefreshToken`, `flowType: 'pkce'` et
 * `experimental.passkey` ; la fabrique fusionne ses défauts avec ce qu'on lui
 * donne, et une option perdue dans la fusion ne se verrait qu'en production :
 * une connexion par lien qui n'aboutit pas, une passkey qui lève.
 *
 * Le SDK est doublé au niveau de `createClient` : c'est exactement ce que la
 * fabrique reçoit, `loader` lui rendant l'import statique.
 */
const { createClient, client, canal } = vi.hoisted(() => {
  const canal = {
    on: vi.fn(),
    subscribe: vi.fn(),
  };
  canal.on.mockReturnValue(canal);
  canal.subscribe.mockReturnValue(canal);
  const client = {
    channel: vi.fn(() => canal),
    removeChannel: vi.fn(async () => 'ok'),
  };
  return { createClient: vi.fn(() => client), client, canal };
});

vi.mock('@supabase/supabase-js', () => ({ createClient }));

import { getSupabase, subscribeTable, supabase } from './supabase.ts';

/** Laisse passer les micro-tâches : la fabrique résout le client en une. */
const microTaches = () => getSupabase();

beforeEach(() => {
  vi.clearAllMocks();
  supabase.reset();
});

describe('getSupabase', () => {
  it('crée UN client, avec les options de l’app fusionnées sur celles du socle', async () => {
    const premier = await getSupabase();
    const second = await getSupabase();

    expect(second).toBe(premier);
    expect(createClient).toHaveBeenCalledTimes(1);
    expect(createClient).toHaveBeenCalledWith(
      import.meta.env.VITE_SUPABASE_URL,
      import.meta.env.VITE_SUPABASE_ANON_KEY,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          flowType: 'pkce',
          experimental: { passkey: true },
        },
      }
    );
  });
});

describe('subscribeTable', () => {
  it('ouvre le canal de la table à la résolution et le retire au désabonnement', async () => {
    const onChange = vi.fn();
    const desabonner = subscribeTable('shifts', onChange);
    await microTaches();

    expect(client.channel).toHaveBeenCalledWith('shifts-changes');
    expect(canal.on).toHaveBeenCalledWith(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'shifts' },
      expect.any(Function)
    );
    expect(canal.subscribe).toHaveBeenCalledTimes(1);

    // Le rappel du canal relaie bien vers `onChange`.
    const relais = canal.on.mock.calls[0]![2] as () => void;
    relais();
    expect(onChange).toHaveBeenCalledTimes(1);

    desabonner();
    expect(client.removeChannel).toHaveBeenCalledWith(canal);
  });

  it('n’ouvre AUCUN canal quand le désabonnement précède la résolution', async () => {
    // Le cas du `useEffect` démonté aussitôt (StrictMode, navigation
    // immédiate) : sans cette garde, le canal survivrait à son composant.
    const desabonner = subscribeTable('shifts', vi.fn());
    desabonner();
    await microTaches();

    expect(client.channel).not.toHaveBeenCalled();
    expect(client.removeChannel).not.toHaveBeenCalled();
  });
});
