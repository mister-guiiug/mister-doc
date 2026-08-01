import {
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import { useReducedMotion } from '@mister-guiiug/dev-wpa-config/react';

/** Une vue empilée dans le deck. */
export interface DeckView {
  /** Clé stable de rendu (jamais l'index : les vues peuvent être réordonnées). */
  key: string;
  /** Nom accessible de la vue (`aria-label` de la diapositive). */
  label: string;
  content: ReactNode;
}

export interface SwipeDeckProps {
  views: DeckView[];
  /** Index affiché — composant CONTRÔLÉ : le parent peut le persister. */
  index: number;
  onIndexChange: (index: number) => void;
  /** Nom accessible du carrousel (obligatoire avec `aria-roledescription`). */
  ariaLabel: string;
  /** `aria-label` d'un point de pagination, ex. « Vue 1 sur 2 ». */
  dotLabel: (position: number, total: number) => string;
  className?: string;
}

/** Distance (px) au-delà de laquelle le glissement change de vue. */
const SWIPE_THRESHOLD = 40;
/** Distance (px) parcourue avant de décider si le geste est horizontal. */
const AXIS_LOCK = 6;

/** Geste de glissement en cours, avec son verrou d'axe. */
interface Gesture {
  x: number;
  y: number;
  axis: 'none' | 'x' | 'y';
}

/**
 * Conteneur qui empile N vues et n'en montre qu'une, avec glissement
 * tactile/souris, points de pagination et navigation clavier.
 *
 * Fait main (pointer events + `translateX`) comme le reste du dépôt : aucune
 * dépendance npm de carrousel. Trois partis pris d'accessibilité :
 *  - le geste n'est JAMAIS le seul accès au contenu (points cliquables, et
 *    flèches gauche/droite dès que le focus est dans le deck) ;
 *  - `touch-action: pan-y` laisse le défilement vertical de la page au
 *    navigateur : seul l'axe horizontal nous appartient ;
 *  - un verrou d'axe évite qu'un mouvement vertical à la souris (qui, lui,
 *    n'est pas filtré par `touch-action`) ne fasse déraper les vues.
 */
export function SwipeDeck({
  views,
  index,
  onIndexChange,
  ariaLabel,
  dotLabel,
  className = '',
}: SwipeDeckProps) {
  const reducedMotion = useReducedMotion();
  const last = views.length - 1;
  // L'index vient du parent (localStorage…) : on le borne, une valeur périmée
  // ne doit jamais afficher une vue vide.
  const current = Math.min(Math.max(index, 0), Math.max(last, 0));

  const [dragX, setDragX] = useState(0);
  const gesture = useRef<Gesture | null>(null);

  // Hauteur de la fenêtre = hauteur de la vue ACTIVE. Sans cela, la piste flex
  // impose à toutes les vues la hauteur de la plus grande : une simple rangée
  // de pastilles resterait aussi haute qu'un calendrier. La mesure est écrite
  // directement dans le style (et non dans un état) : c'est une correction de
  // mise en page, elle ne doit pas provoquer de rendu supplémentaire à chaque
  // redimensionnement. `useLayoutEffect` la pose avant peinture, sans clignotement.
  const viewport = useRef<HTMLDivElement | null>(null);
  const slides = useRef<(HTMLDivElement | null)[]>([]);

  useLayoutEffect(() => {
    const el = slides.current[current];
    const box = viewport.current;
    if (!el || !box) return;
    const measure = () => {
      box.style.height = `${el.offsetHeight}px`;
    };
    measure();
    // ResizeObserver manque à certains environnements de test : la mesure
    // ponctuelle ci-dessus suffit alors.
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [current, views.length]);

  function go(next: number) {
    const clamped = Math.min(Math.max(next, 0), last);
    if (clamped !== current) onIndexChange(clamped);
  }

  function handlePointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    // Bouton principal seulement : un clic droit ne doit pas armer un geste.
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    gesture.current = { x: e.clientX, y: e.clientY, axis: 'none' };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const g = gesture.current;
    if (!g) return;
    const dx = e.clientX - g.x;
    const dy = e.clientY - g.y;
    if (g.axis === 'none') {
      if (Math.abs(dx) < AXIS_LOCK && Math.abs(dy) < AXIS_LOCK) return;
      g.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
    }
    if (g.axis === 'y') return;
    // Résistance aux extrémités : on sent la butée sans pouvoir la franchir.
    const blocked = (current === 0 && dx > 0) || (current === last && dx < 0);
    setDragX(blocked ? dx / 4 : dx);
  }

  function handlePointerEnd(e: ReactPointerEvent<HTMLDivElement>) {
    if (!gesture.current) return;
    gesture.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    if (dragX <= -SWIPE_THRESHOLD) go(current + 1);
    else if (dragX >= SWIPE_THRESHOLD) go(current - 1);
    setDragX(0);
  }

  function handlePointerCancel() {
    // Le navigateur a repris la main (défilement vertical) : on annule tout.
    gesture.current = null;
    setDragX(0);
  }

  function handleKeyDown(e: ReactKeyboardEvent<HTMLDivElement>) {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      go(current + 1);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      go(current - 1);
    }
  }

  const dragging = dragX !== 0;
  // La piste garde la largeur de la fenêtre (ses vues débordent, `shrink-0`) :
  // un `translateX` de -100 % vaut donc exactement une vue.
  const shift = current * 100;

  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- carrousel : les flèches clavier sont le pendant obligatoire du geste tactile.
    <div
      role="group"
      aria-roledescription="carousel"
      aria-label={ariaLabel}
      // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- le deck doit pouvoir recevoir le focus pour que les flèches ←/→ fonctionnent.
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className={`rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-teal-500 dark:focus-visible:ring-teal-400 ${className}`}
    >
      <div
        ref={viewport}
        className="overflow-hidden"
        style={{
          touchAction: 'pan-y',
          transition: reducedMotion ? undefined : 'height 250ms ease-out',
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerCancel}
      >
        <div
          className={`flex items-start ${dragging ? 'select-none' : ''}`}
          style={{
            transform: `translateX(calc(-${shift}% + ${dragX}px))`,
            transition:
              dragging || reducedMotion
                ? undefined
                : 'transform 250ms ease-out',
          }}
        >
          {views.map((view, i) => (
            <div
              key={view.key}
              ref={el => {
                slides.current[i] = el;
              }}
              role="group"
              aria-roledescription="slide"
              aria-label={view.label}
              aria-hidden={i !== current}
              className="w-full shrink-0 grow-0 basis-full"
            >
              {view.content}
            </div>
          ))}
        </div>
      </div>

      {/* Annonce le CHANGEMENT de vue (geste compris) sans bavarder : contrairement
          à un `aria-live` posé sur les vues, ce statut ne se déclenche pas à
          chaque rafraîchissement des compteurs. */}
      <span className="sr-only" role="status" aria-live="polite">
        {views[current]?.label}
      </span>

      {views.length > 1 && (
        <div className="mt-1.5 flex items-center justify-center gap-0.5">
          {views.map((view, i) => (
            <button
              key={view.key}
              type="button"
              onClick={() => go(i)}
              aria-label={dotLabel(i + 1, views.length)}
              aria-current={i === current ? 'true' : undefined}
              className="grid size-8 place-items-center rounded-full transition hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <span
                className={`block rounded-full transition-all ${
                  i === current
                    ? 'h-2 w-5 bg-teal-600 dark:bg-teal-400'
                    : 'size-2 bg-slate-300 dark:bg-slate-600'
                }`}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
