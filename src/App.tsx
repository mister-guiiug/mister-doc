import { lazy, Suspense, useEffect, type ReactNode } from 'react';
import {
  HashRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom';
import { X } from 'lucide-react';
import { ConsentBanner } from '@mister-guiiug/dev-pwa-config/react/consent-banner';
import { usePageViews } from '@mister-guiiug/dev-pwa-config/react/use-page-views';
import { ToastProvider } from '@mister-guiiug/dev-pwa-config/react/toast';
import { IconsProvider } from '@mister-guiiug/dev-pwa-config/react/icons-context';
import { LabelsProvider } from '@mister-guiiug/dev-pwa-config/react/labels';
import { lucideIconSet } from '@mister-guiiug/dev-pwa-config/react/icons-lucide';
import { AppFooter } from '@mister-guiiug/dev-pwa-config/react/app-footer';
import { repoUrl } from '@mister-guiiug/dev-pwa-config/apps-catalog';
import { AuthProvider } from './auth/AuthContext.tsx';
import { AuthGate } from './auth/AuthGate.tsx';
import { useAuth } from './auth/useAuth.ts';
import { useI18n } from './i18n/index.ts';
import { ConfirmProvider } from './components/ui/ConfirmProvider.tsx';
import { Header } from './components/Header.tsx';
import { BottomNav } from './components/BottomNav.tsx';
import { OfflineBanner } from './components/OfflineBanner.tsx';
import { UpdatePrompt } from './components/UpdatePrompt.tsx';
import { FullScreenSpinner } from './components/Spinner.tsx';
import { PlanningView } from './features/planning/PlanningView.tsx';

// CHAQUE IMPORT D'UNE VUE PRÉCHARGÉE EST NOMMÉ, parce qu'il sert DEUX FOIS : à
// `lazy` ci-dessous, et au préchargement à l'inactivité de
// `usePrechargeLesVuesDuMenu`. Deux `import()` du même spécificateur ne
// téléchargent qu'une fois — le registre de modules dédoublonne — mais encore
// faut-il que ce soit LITTÉRALEMENT le même spécificateur, sinon le bundler
// émet deux morceaux et le préchargement ne sert plus à rien.
const chargeMonPlanning = () =>
  import('./features/planning/MyPlanningView.tsx');
const chargeEchanges = () => import('./features/swaps/SwapBoard.tsx');
const chargeProfil = () => import('./features/profile/ProfilePage.tsx');

/**
 * Les trois destinations que TOUT LE MONDE a dans les deux menus — l'en-tête
 * sur >= sm, la barre basse sur mobile.
 *
 * `AllCounters` et `AdminPanel` restent dehors : ils ne paraissent qu'aux
 * administrateurs, et les précharger pour tous ferait payer à chacun deux
 * morceaux que presque personne n'ouvre. Pour eux, c'est la pastille qui tourne
 * qui répond au clic.
 */
const CHARGEURS_DU_MENU = [chargeMonPlanning, chargeEchanges, chargeProfil];

/** `navigator.connection` n'est pas dans les types du DOM : il reste un brouillon. */
type NavigateurEconome = Navigator & { connection?: { saveData?: boolean } };

/**
 * PRÉCHARGE LES VUES DU MENU DÈS QUE LE FIL PRINCIPAL SOUFFLE.
 *
 * Sans préchargement, le morceau d'une vue n'est demandé qu'AU CLIC : un
 * aller-retour réseau complet, payé au pire moment — pendant que le reste du
 * bundle arrive et que le service worker précharge ses entrées. Mesuré à froid
 * le 20/09/2026 sur deux sites publiés du parc, première visite : 133 ms sur
 * mister-settle, 161 ms sur mister-molkky, pendant lesquelles l'URL indique
 * déjà la nouvelle route et l'écran affiche encore l'ancien.
 *
 * N'entre PAS dans `bundleBudget.preloadGzipKb` : ce budget ne compte que ce
 * qui est `modulepreload` dans le document, et un `import()` tardif n'y entre
 * pas.
 */
function usePrechargeLesVuesDuMenu() {
  useEffect(() => {
    // `saveData` : le visiteur a demandé qu'on épargne son forfait. On ne
    // télécharge alors que ce qu'il demande vraiment — et c'est précisément
    // pour ce cas-là que les menus, eux, savent désormais dire qu'ils chargent.
    if ((navigator as NavigateurEconome).connection?.saveData) return;

    let annule = false;
    const precharge = () => {
      if (annule) return;
      // Un échec ici est sans conséquence : au clic, `lazy` redemandera le
      // morceau et c'est LUI qui portera l'erreur, dans son propre `Suspense`.
      for (const charge of CHARGEURS_DU_MENU) void charge().catch(() => {});
    };

    // `requestIdleCallback` manque encore à Safari avant la 17 ; le repli
    // minuté vaut mieux que rien.
    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(precharge, { timeout: 3000 });
      return () => {
        annule = true;
        window.cancelIdleCallback?.(id);
      };
    }
    const id = window.setTimeout(precharge, 1200);
    return () => {
      annule = true;
      window.clearTimeout(id);
    };
  }, []);
}

const MyPlanningView = lazy(() =>
  chargeMonPlanning().then(m => ({ default: m.MyPlanningView }))
);
const AdminPanel = lazy(() =>
  import('./features/admin/AdminPanel.tsx').then(m => ({
    default: m.AdminPanel,
  }))
);
const AllCounters = lazy(() =>
  import('./features/admin/AllCounters.tsx').then(m => ({
    default: m.AllCounters,
  }))
);
const SwapBoard = lazy(() =>
  chargeEchanges().then(m => ({ default: m.SwapBoard }))
);
const ProfilePage = lazy(() =>
  chargeProfil().then(m => ({ default: m.ProfilePage }))
);

function AdminRoute({ children }: { children: ReactNode }) {
  const { isAdmin } = useAuth();
  if (!isAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
}

/* Les composants du socle (croix du toast…) dessinent leurs icônes via le
   contrat de rôles : on branche lucide, le jeu d'icônes de l'app, plutôt que
   de laisser cohabiter deux langages visuels. */
const DWC_ICONS = lucideIconSet({ close: X });

/**
 * La mesure d'audience, et rien d'autre.
 *
 * UN COMPOSANT PLUTÔT QUE DEUX LIGNES DANS `App` : `useLocation` n'existe que
 * SOUS le routeur, et `App` monte `HashRouter` — l'appeler là-haut lèverait.
 * Ce composant se rend donc dans `<main>`, à l'intérieur.
 *
 * UNE VUE DE PAGE PAR NAVIGATION — ni zéro, ni deux. Sans ce hook, sous
 * `HashRouter`, toute la navigation serait invisible et la durée de session
 * fausse ; et si on laissait PostHog compter seul, chaque navigation serait
 * comptée DEUX fois, d'où le `capture_pageview: false` du socle. Le hook ne
 * fait rien sans consentement, il se monte donc sans condition.
 *
 * PAS DE `policyHref`, ET C'EST DÉLIBÉRÉ. La politique de confidentialité de
 * cette app est un DIALOGUE (`PrivacyDialog`), pas une route : il n'y a pas
 * d'URL à mettre dans un lien. Et surtout, ses mentions légales portent encore
 * `[À compléter]` — responsable du traitement, base légale, durées de
 * conservation. Y renvoyer depuis un bandeau de consentement donnerait à lire
 * un document qui ne peut pas fonder la collecte.
 *
 * C'est aussi pourquoi `VITE_POSTHOG_KEY` ne doit PAS être posée sur ce
 * dépôt avant que ces mentions soient renseignées : sans elle, ce composant ne
 * rend rien et rien n'est mesuré.
 */
function Mesure() {
  const { pathname } = useLocation();
  usePageViews(pathname);

  return (
    <ConsentBanner
      posthogKey={import.meta.env.VITE_POSTHOG_KEY}
      loader={() => import('posthog-js/dist/module.slim.js')}
      className="mt-8 px-4"
    />
  );
}

export default function App() {
  usePrechargeLesVuesDuMenu();
  const { t, locale } = useI18n();
  return (
    <IconsProvider icons={DWC_ICONS}>
      {/* Les libellés propres aux composants du socle (« Page actuelle » de la
          barre d'onglets, « Fermer » d'un toast, « Confirmer »…) vivent dans
          leur propre dictionnaire, que `createI18n` ne peut pas atteindre.
          Sans ce pont ils restent en FRANÇAIS quand l'utilisateur passe
          l'interface en anglais. */}
      <LabelsProvider locale={locale}>
        <ToastProvider>
          <ConfirmProvider>
            <AuthProvider>
              {/* UN SEUL bandeau réseau pour toute l'application, et AVANT la
                  porte d'accès : se connecter est déjà un appel réseau, et
                  l'écran de connexion ne disait rien d'autre qu'une erreur
                  d'authentification quand c'était le réseau qui manquait.
                  Placé ici, il couvre AUSSI l'attente d'approbation, le défi
                  2FA et l'application elle-même.

                  EN HAUT, ET DANS LE FLUX. Le bas de l'écran est déjà pris sur
                  trois niveaux (BottomNav z-30, InstallPrompt z-40,
                  UpdatePrompt z-50) : un quatrième bandeau y passerait sous ou
                  par-dessus les autres — un défaut qu'aucun test ne verrait. */}
              <OfflineBanner />
              <AuthGate>
                <HashRouter>
                  <div className="min-h-dvh bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
                    <Header />
                    <main className="pb-24">
                      <Suspense
                        fallback={
                          <FullScreenSpinner label={t('common.loading')} />
                        }
                      >
                        <Routes>
                          <Route path="/" element={<PlanningView />} />
                          <Route
                            path="/mon-planning"
                            element={<MyPlanningView />}
                          />
                          <Route path="/echanges" element={<SwapBoard />} />
                          <Route path="/profil" element={<ProfilePage />} />
                          <Route
                            path="/compteurs"
                            element={
                              <AdminRoute>
                                <AllCounters />
                              </AdminRoute>
                            }
                          />
                          <Route
                            path="/admin"
                            element={
                              <AdminRoute>
                                <AdminPanel />
                              </AdminRoute>
                            }
                          />
                          <Route
                            path="*"
                            element={<Navigate to="/" replace />}
                          />
                        </Routes>
                      </Suspense>

                      {/* HORS des routes : le code source et le soutien sont
                          ainsi sur le premier écran comme sur le Profil — la
                          règle famille. Écrit dans un `element={…}`, ce pied
                          de page ne vaudrait que pour une route. Il est DANS
                          `<main>` parce que la barre basse est fixe et que
                          c'est le `pb-24` de `<main>` qui lui réserve sa
                          place. */}
                      <Mesure />
                      <AppFooter
                        version
                        issues
                        className="mt-8 justify-center px-4"
                        repoUrl={repoUrl('mister-doc')}
                      />
                    </main>
                    <BottomNav />
                  </div>
                </HashRouter>
              </AuthGate>
              {/* L'INVITE D'INSTALLATION A QUITTÉ LA COQUILLE pour le
                  planning. Le bandeau maison était une barre flottante empilée
                  au-dessus de la navigation ; celui du socle est un élément de
                  flux, qui n'aurait ici aucune place définie. Et il parle
                  désormais aussi aux iPhone, donc bien plus souvent : sur le
                  planning, le praticien est au repos. */}
              <UpdatePrompt />
            </AuthProvider>
          </ConfirmProvider>
        </ToastProvider>
      </LabelsProvider>
    </IconsProvider>
  );
}
