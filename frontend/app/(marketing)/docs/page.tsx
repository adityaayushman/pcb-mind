const SECTIONS = [
  { id: "pipeline", title: "The inspection pipeline" },
  { id: "roles", title: "Roles & permissions" },
  { id: "taxonomy", title: "Defect taxonomy & severity" },
  { id: "api", title: "API basics" },
  { id: "faq", title: "FAQ" },
];

export default function DocsPage() {
  return (
    <main className="max-w-5xl mx-auto px-6 py-20">
      <h1 className="text-4xl font-semibold tracking-tight mb-16">Documentation</h1>

      <div className="grid md:grid-cols-[180px_1fr] gap-12">
        <nav className="hidden md:block sticky top-6 self-start space-y-1">
          {SECTIONS.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="block text-sm text-neutral-400 hover:text-neutral-100 py-1"
            >
              {s.title}
            </a>
          ))}
        </nav>

        <div className="space-y-16 max-w-2xl">
          <section id="pipeline">
            <h2 className="text-xl font-semibold mb-4">The inspection pipeline</h2>
            <p className="text-neutral-400 text-sm mb-4">
              Every uploaded photo moves through the same stages before you see a result:
            </p>
            <ol className="space-y-2 text-sm text-neutral-300 list-decimal list-inside">
              <li><strong>Upload</strong> — your photo is stored and queued for analysis.</li>
              <li><strong>Image quality check</strong> — basic validation that the image decoded correctly.</li>
              <li><strong>Preprocessing</strong> — resized and contrast-corrected (CLAHE) so uneven lighting doesn't hide defects.</li>
              <li><strong>AI detection</strong> — the trained model scans the board for defects. This is the slow step — a cold server can take up to a minute.</li>
              <li><strong>Component matching</strong> — detections are compared against your golden PCB reference, if one's attached.</li>
              <li><strong>Defect analysis</strong> — each detection is classified by type and severity.</li>
              <li><strong>Report</strong> — a PDF report is generated on demand from the results.</li>
            </ol>
          </section>

          <section id="roles">
            <h2 className="text-xl font-semibold mb-4">Roles & permissions</h2>
            <p className="text-neutral-400 text-sm mb-4">
              Every user belongs to an organization with one of three roles:
            </p>
            <div className="border border-neutral-800 rounded-xl overflow-hidden text-sm">
              <div className="grid grid-cols-3 gap-4 px-5 py-3 border-b border-neutral-800 text-neutral-500 font-medium">
                <span>Action</span><span>Admin / QA engineer</span><span>Operator</span>
              </div>
              {[
                ["Run inspections", "✓", "✓"],
                ["View dashboard & reports", "✓", "✓"],
                ["Create / manage PCB templates", "✓", "—"],
                ["Upload golden PCB references", "✓", "—"],
                ["Export CSV / Excel", "✓", "—"],
              ].map(([action, a, b]) => (
                <div key={action} className="grid grid-cols-3 gap-4 px-5 py-3 border-b border-neutral-800 last:border-0">
                  <span className="text-neutral-300">{action}</span>
                  <span>{a}</span>
                  <span>{b}</span>
                </div>
              ))}
            </div>
            <p className="text-neutral-500 text-sm mt-4">
              The first person to sign up for an organization becomes its admin.
            </p>
          </section>

          <section id="taxonomy">
            <h2 className="text-xl font-semibold mb-4">Defect taxonomy & severity</h2>
            <p className="text-neutral-400 text-sm mb-4">
              Every detection falls into one of six defect types, each mapped to a severity level:
            </p>
            <div className="border border-neutral-800 rounded-xl overflow-hidden text-sm">
              {[
                ["Short", "Critical", "Two traces or pads that should be isolated are bridged."],
                ["Open circuit", "Critical", "A trace that should connect two points is broken."],
                ["Missing hole", "Major", "A drilled hole expected by the design is absent."],
                ["Spurious copper", "Major", "Copper present where the design calls for bare substrate."],
                ["Mouse bite", "Minor", "Small notches eaten into a copper pad or trace edge."],
                ["Spur", "Minor", "An unwanted stub of copper branching off a trace."],
              ].map(([name, severity, desc]) => (
                <div key={name} className="flex items-start gap-4 px-5 py-3 border-b border-neutral-800 last:border-0">
                  <span className="w-16 shrink-0 text-neutral-300">{name}</span>
                  <span className="w-16 shrink-0 text-neutral-500">{severity}</span>
                  <span className="text-neutral-500">{desc}</span>
                </div>
              ))}
            </div>
          </section>

          <section id="api">
            <h2 className="text-xl font-semibold mb-4">API basics</h2>
            <p className="text-neutral-400 text-sm mb-4">
              The frontend talks to a REST API secured with a Supabase-issued bearer token —
              every request carries <code className="text-neutral-300">Authorization: Bearer &lt;token&gt;</code>.
              Full interactive API docs (OpenAPI) are available at{" "}
              <code className="text-neutral-300">/docs</code> on the API host.
            </p>
            <ul className="space-y-1.5 text-sm text-neutral-300">
              <li><code className="text-neutral-400">POST /api/inspections</code> — run a new inspection</li>
              <li><code className="text-neutral-400">GET /api/inspections/{"{id}"}</code> — fetch a result</li>
              <li><code className="text-neutral-400">GET /api/inspections/export</code> — bulk CSV/Excel export</li>
              <li><code className="text-neutral-400">GET /api/pcb-templates</code> — list templates</li>
              <li><code className="text-neutral-400">GET /api/dashboard</code> — org-wide stats</li>
            </ul>
          </section>

          <section id="faq">
            <h2 className="text-xl font-semibold mb-4">FAQ</h2>
            <div className="space-y-6 text-sm">
              <div>
                <p className="font-medium mb-1">Why did my inspection take so long?</p>
                <p className="text-neutral-500">
                  Free-tier hosting spins down after inactivity — the first request after idle
                  time can take up to a minute while the server wakes up.
                </p>
              </div>
              <div>
                <p className="font-medium mb-1">Can I re-run an inspection?</p>
                <p className="text-neutral-500">
                  Yes — uploading the same or a new photo against the same template creates a new,
                  independent inspection record.
                </p>
              </div>
              <div>
                <p className="font-medium mb-1">Are shared report links secure?</p>
                <p className="text-neutral-500">
                  Report and image links are unauthenticated but unguessable (random IDs) — treat
                  a copied link like you would any file you forward directly.
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
