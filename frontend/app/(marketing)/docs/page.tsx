import { SeverityBadge } from "@/components/common/SeverityBadge";
import { Severity } from "@/lib/api";

const SECTIONS = [
  { id: "pipeline", title: "The inspection pipeline" },
  { id: "roles", title: "Roles & permissions" },
  { id: "taxonomy", title: "Defect taxonomy & severity" },
  { id: "api", title: "API basics" },
  { id: "faq", title: "FAQ" },
];

const TAXONOMY: [string, Severity, string][] = [
  ["Short", "critical", "Two traces or pads that should be isolated are bridged."],
  ["Open circuit", "critical", "A trace that should connect two points is broken."],
  ["Missing hole", "major", "A drilled hole expected by the design is absent."],
  ["Spurious copper", "major", "Copper present where the design calls for bare substrate."],
  ["Mouse bite", "minor", "Small notches eaten into a copper pad or trace edge."],
  ["Spur", "minor", "An unwanted stub of copper branching off a trace."],
];

function InlineCode({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[0.8em] text-foreground">
      {children}
    </code>
  );
}

export default function DocsPage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-20">
      <p className="font-mono text-xs uppercase tracking-[0.18em] text-primary">Documentation</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">
        How PCBMind works
      </h1>

      <div className="mt-14 grid gap-12 md:grid-cols-[200px_1fr]">
        <nav className="sticky top-20 hidden space-y-0.5 self-start md:block">
          {SECTIONS.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="block rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-surface-1 hover:text-foreground"
            >
              {s.title}
            </a>
          ))}
        </nav>

        <div className="max-w-2xl space-y-16">
          <section id="pipeline" className="scroll-mt-20">
            <h2 className="text-xl font-semibold tracking-tight">The inspection pipeline</h2>
            <p className="mt-3 text-sm text-muted-foreground">
              Every uploaded photo moves through the same stages before you see a result:
            </p>
            <ol className="mt-4 space-y-3">
              {[
                ["Upload", "your photo is stored and queued for analysis."],
                ["Image quality check", "basic validation that the image decoded correctly."],
                ["Preprocessing", "resized and contrast-corrected (CLAHE) so uneven lighting doesn't hide defects."],
                ["AI detection", "the trained model scans the board for defects. This is the slow step — a cold server can take up to a minute."],
                ["Component matching", "detections are compared against your golden PCB reference, if one's attached."],
                ["Defect analysis", "each detection is classified by type and severity."],
                ["Report", "a PDF report is generated on demand from the results."],
              ].map(([title, body], i) => (
                <li key={title} className="flex gap-3 text-sm">
                  <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded bg-primary/10 font-mono text-[10px] font-semibold text-primary">
                    {i + 1}
                  </span>
                  <span className="text-muted-foreground">
                    <strong className="font-medium text-foreground">{title}</strong> — {body}
                  </span>
                </li>
              ))}
            </ol>
          </section>

          <section id="roles" className="scroll-mt-20">
            <h2 className="text-xl font-semibold tracking-tight">Roles &amp; permissions</h2>
            <p className="mt-3 text-sm text-muted-foreground">
              Every user belongs to an organization with one of three roles:
            </p>
            <div className="mt-4 overflow-hidden rounded-lg border border-border bg-card text-sm">
              <div className="grid grid-cols-3 gap-4 border-b border-border px-5 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <span>Action</span>
                <span>Admin / QA engineer</span>
                <span>Operator</span>
              </div>
              {[
                ["Run inspections", true, true],
                ["View dashboard & reports", true, true],
                ["Create / manage PCB templates", true, false],
                ["Upload golden PCB references", true, false],
                ["Export CSV / Excel", true, false],
              ].map(([action, a, b]) => (
                <div
                  key={String(action)}
                  className="grid grid-cols-3 gap-4 border-b border-border px-5 py-3 last:border-0"
                >
                  <span>{action}</span>
                  <span className={a ? "text-primary" : "text-muted-foreground/50"}>{a ? "✓" : "—"}</span>
                  <span className={b ? "text-primary" : "text-muted-foreground/50"}>{b ? "✓" : "—"}</span>
                </div>
              ))}
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              The first person to sign up for an organization becomes its admin.
            </p>
          </section>

          <section id="taxonomy" className="scroll-mt-20">
            <h2 className="text-xl font-semibold tracking-tight">Defect taxonomy &amp; severity</h2>
            <p className="mt-3 text-sm text-muted-foreground">
              Every detection falls into one of six defect types, each mapped to a severity level:
            </p>
            <div className="mt-4 overflow-hidden rounded-lg border border-border bg-card text-sm">
              {TAXONOMY.map(([name, severity, desc]) => (
                <div key={name} className="flex items-start gap-4 border-b border-border px-5 py-3 last:border-0">
                  <span className="w-28 shrink-0 font-medium">{name}</span>
                  <SeverityBadge severity={severity} className="mt-0.5 w-16 shrink-0 justify-center" />
                  <span className="text-muted-foreground">{desc}</span>
                </div>
              ))}
            </div>
          </section>

          <section id="api" className="scroll-mt-20">
            <h2 className="text-xl font-semibold tracking-tight">API basics</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              The frontend talks to a REST API secured with a Supabase-issued bearer token — every
              request carries <InlineCode>Authorization: Bearer &lt;token&gt;</InlineCode>. Full
              interactive API docs (OpenAPI) are available at <InlineCode>/docs</InlineCode> on the
              API host.
            </p>
            <div className="mt-4 space-y-2 font-mono text-sm">
              {[
                ["POST", "/api/inspections", "run a new inspection"],
                ["GET", "/api/inspections/{id}", "fetch a result"],
                ["GET", "/api/inspections/export", "bulk CSV/Excel export"],
                ["GET", "/api/pcb-templates", "list templates"],
                ["GET", "/api/dashboard", "org-wide stats"],
              ].map(([method, path, desc]) => (
                <div key={path} className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-surface-1 px-3 py-2">
                  <span
                    className={
                      method === "POST"
                        ? "rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold text-primary"
                        : "rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground"
                    }
                  >
                    {method}
                  </span>
                  <span className="text-foreground">{path}</span>
                  <span className="font-sans text-xs text-muted-foreground">{desc}</span>
                </div>
              ))}
            </div>
          </section>

          <section id="faq" className="scroll-mt-20">
            <h2 className="text-xl font-semibold tracking-tight">FAQ</h2>
            <div className="mt-4 space-y-6 text-sm">
              <div>
                <p className="font-medium">Why did my inspection take so long?</p>
                <p className="mt-1 text-muted-foreground">
                  Free-tier hosting spins down after inactivity — the first request after idle time
                  can take up to a minute while the server wakes up.
                </p>
              </div>
              <div>
                <p className="font-medium">Can I re-run an inspection?</p>
                <p className="mt-1 text-muted-foreground">
                  Yes — uploading the same or a new photo against the same template creates a new,
                  independent inspection record.
                </p>
              </div>
              <div>
                <p className="font-medium">Are shared report links secure?</p>
                <p className="mt-1 text-muted-foreground">
                  Report and image links are unauthenticated but unguessable (random IDs) — treat a
                  copied link like you would any file you forward directly.
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
