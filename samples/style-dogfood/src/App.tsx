import { classes } from "./style";

const tokenSwatches = [
  [classes.swatchPrimary, "Primary"],
  [classes.swatchDanger, "Danger"],
  [classes.swatchWarning, "Warning"],
  [classes.swatchSuccess, "Success"],
] as const;

const stateRows = [
  ["Idle", classes.buttonBase, classes.badgeNeutral, "Queued"],
  ["Ready", classes.buttonPrimary, classes.badgeSuccess, "Live"],
  ["Compact", classes.buttonCompactPrimary, classes.badgeNeutral, "Dense"],
  ["Danger", classes.buttonDanger, classes.badgeDanger, "Armed"],
  ["Ghost", classes.buttonGhost, classes.badgeWarning, "No fill"],
] as const;

export function App() {
  return (
    <main className={classes.page}>
      <header className={classes.header}>
        <p className={classes.eyebrow}>MachinaStyle dogfood</p>
        <h1 className={classes.title}>Control Panel</h1>
        <p className={classes.subtitle}>
          A tiny React page whose paint comes from style.ts lowered to checked-in CSS.
        </p>
      </header>

      <section className={classes.panel}>
        <h2 className={classes.sectionTitle}>Tokens</h2>
        <div className={classes.tokenRow}>
          {tokenSwatches.map(([className, label]) => (
            <span className={classes.tokenItem} key={className}>
              <span className={className} />
              <span className={classes.mutedText}>{label}</span>
            </span>
          ))}
        </div>
      </section>

      <section className={classes.panel}>
        <h2 className={classes.sectionTitle}>Buttons</h2>
        <div className={classes.buttonRow}>
          <button className={classes.buttonBase} type="button">
            Base
          </button>
          <button className={classes.buttonPrimary} type="button">
            Primary
          </button>
          <button className={classes.buttonDanger} type="button">
            Danger
          </button>
          <button className={classes.buttonGhost} type="button">
            Ghost
          </button>
          <button className={classes.buttonDisabled} type="button" aria-disabled="true">
            Disabled
          </button>
        </div>
      </section>

      <section className={classes.cardGrid}>
        <article className={classes.cardBase}>
          <h2 className={classes.sectionTitle}>Base card</h2>
          <p className={classes.bodyText}>Concrete record plus a border layer.</p>
        </article>
        <article className={classes.cardElevated}>
          <h2 className={classes.sectionTitle}>Elevated card</h2>
          <p className={classes.bodyText}>Composes the base card with an effect layer.</p>
        </article>
        <article className={classes.cardWarning}>
          <h2 className={classes.sectionTitle}>Warning card</h2>
          <p className={classes.bodyText}>Uses set slots for semantic warning color.</p>
        </article>
      </section>

      <section className={classes.panel}>
        <h2 className={classes.sectionTitle}>Badges and field</h2>
        <div className={classes.buttonRow}>
          <span className={classes.badgeNeutral}>Neutral</span>
          <span className={classes.badgeSuccess}>Success</span>
          <span className={classes.badgeWarning}>Warning</span>
          <span className={classes.badgeDanger}>Danger</span>
        </div>
        <div className={classes.field}>machina.control.mode = manual</div>
        <div className={classes.alertInfo}>
          Validation stays explicit: unresolved slots are rejected before CSS.
        </div>
      </section>

      <section className={classes.panel}>
        <h2 className={classes.sectionTitle}>State Matrix</h2>
        <div className={classes.matrix}>
          {stateRows.map(([state, buttonClass, badgeClass, badgeText]) => (
            <div className={classes.matrixRow} key={state}>
              <span className={classes.matrixLabel}>{state}</span>
              <button className={buttonClass} type="button">
                Action
              </button>
              <span className={badgeClass}>{badgeText}</span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
