import type { FormEvent } from "react";
import type { CanvasTerminalLogEntry } from "./canvasCommandsTerminal";

export function CanvasCommandTerminal({
  collapsed,
  inputValue,
  log,
  onChangeInput,
  onToggleCollapsed,
  onSubmitCommand,
}: {
  collapsed: boolean;
  inputValue: string;
  log: readonly CanvasTerminalLogEntry[];
  onChangeInput: (value: string) => void;
  onToggleCollapsed: () => void;
  onSubmitCommand: (command: string) => void;
}) {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const command = inputValue.trim();
    if (!command) return;
    onSubmitCommand(command);
  };

  const recentLog = log.slice(0, 20);

  return (
    <section className={`command-terminal ${collapsed ? "is-collapsed" : "is-expanded"}`}>
      <header className="command-terminal__header">
        <div>
          <small>Command Terminal</small>
          <strong>Editor commands only</strong>
        </div>
        <button onClick={onToggleCollapsed} type="button">
          {collapsed ? "Expand" : "Collapse"}
        </button>
      </header>
      {!collapsed ? (
        <>
          <div aria-label="Terminal log" className="command-terminal__log" role="log">
            {recentLog.length === 0 ? (
              <p className="empty-note">
                No terminal commands yet. Run `help` for the current editor command list.
              </p>
            ) : (
              recentLog.map((entry, index) => (
                <article
                  className={`terminal-entry terminal-entry-${entry.kind}`}
                  key={`${entry.at}-${index}`}
                >
                  {entry.command ? (
                    <p className="terminal-entry__command">&gt; {entry.command}</p>
                  ) : null}
                  <p>{entry.message}</p>
                </article>
              ))
            )}
          </div>
          <form className="command-terminal__form" onSubmit={handleSubmit}>
            <input
              aria-label="Command input"
              className="command-terminal__input"
              onChange={(event) => onChangeInput(event.currentTarget.value)}
              placeholder="help, export-summary, checkpoint before audit"
              type="text"
              value={inputValue}
            />
            <button type="submit">Run</button>
          </form>
        </>
      ) : null}
    </section>
  );
}
