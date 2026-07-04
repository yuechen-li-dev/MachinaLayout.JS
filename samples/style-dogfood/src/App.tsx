const tokenSwatches = [
  ["swatchPrimary", "Primary"],
  ["swatchDanger", "Danger"],
  ["swatchWarning", "Warning"],
  ["swatchSuccess", "Success"],
] as const;

const stateRows = [
  ["Idle", "buttonBase", "badgeNeutral", "Queued"],
  ["Ready", "buttonPrimary", "badgeSuccess", "Live"],
  ["Compact", "buttonCompactPrimary", "badgeNeutral", "Dense"],
  ["Danger", "buttonDanger", "badgeDanger", "Armed"],
  ["Ghost", "buttonGhost", "badgeWarning", "No fill"],
] as const;

export function App() {
  return (
    <main className="page">
      <header className="header">
        <p className="eyebrow">MachinaStyle dogfood</p>
        <h1 className="title">Control Panel</h1>
        <p className="subtitle">
          A tiny React page whose paint comes from style.ts lowered to checked-in CSS.
        </p>
      </header>

      <section className="panel">
        <h2 className="sectionTitle">Tokens</h2>
        <div className="tokenRow">
          {tokenSwatches.map(([className, label]) => (
            <span className="tokenItem" key={className}>
              <span className={className} />
              <span className="mutedText">{label}</span>
            </span>
          ))}
        </div>
      </section>

      <section className="panel">
        <h2 className="sectionTitle">Buttons</h2>
        <div className="buttonRow">
          <button className="buttonBase" type="button">
            Base
          </button>
          <button className="buttonPrimary" type="button">
            Primary
          </button>
          <button className="buttonDanger" type="button">
            Danger
          </button>
          <button className="buttonGhost" type="button">
            Ghost
          </button>
          <button className="buttonDisabled" type="button" aria-disabled="true">
            Disabled
          </button>
        </div>
      </section>

      <section className="cardGrid">
        <article className="cardBase">
          <h2 className="sectionTitle">Base card</h2>
          <p className="bodyText">Concrete record plus a border layer.</p>
        </article>
        <article className="cardElevated">
          <h2 className="sectionTitle">Elevated card</h2>
          <p className="bodyText">Composes the base card with an effect layer.</p>
        </article>
        <article className="cardWarning">
          <h2 className="sectionTitle">Warning card</h2>
          <p className="bodyText">Uses set slots for semantic warning color.</p>
        </article>
      </section>

      <section className="panel">
        <h2 className="sectionTitle">Badges and field</h2>
        <div className="badgeRow">
          <span className="badgeNeutral">Neutral</span>
          <span className="badgeSuccess">Success</span>
          <span className="badgeWarning">Warning</span>
          <span className="badgeDanger">Danger</span>
        </div>
        <div className="field">machina.control.mode = manual</div>
        <div className="alertInfo">
          Validation stays explicit: unresolved slots are rejected before CSS.
        </div>
      </section>

      <section className="panel">
        <h2 className="sectionTitle">State Matrix</h2>
        <div className="matrix">
          {stateRows.map(([state, buttonClass, badgeClass, badgeText]) => (
            <div className="matrixRow" key={state}>
              <span className="matrixLabel">{state}</span>
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
