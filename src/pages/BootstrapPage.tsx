import { firebaseConfigurationComplete } from '../config/firebase';

const platformItems = [
  ['Frontend', 'React + Vite + TypeScript'],
  ['Data', 'Cloud Firestore'],
  ['Identity', 'Firebase Authentication'],
  ['Files', 'Firebase Storage'],
  ['Hosting', 'GitHub Pages'],
];

export function BootstrapPage() {
  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#/" aria-label="Toyota Payroll home">
          <span className="brand-mark" aria-hidden="true">
            T
          </span>
          <span>Toyota Payroll</span>
        </a>
        <span className="step-label">Step 1 of 12</span>
      </header>

      <main className="main-content">
        <section className="hero" aria-labelledby="page-title">
          <p className="eyebrow">MVP bootstrap</p>
          <h1 id="page-title">Foundation ready</h1>
          <p className="hero-copy">
            The application shell and Firebase boundaries are prepared. Business
            modules remain intentionally untouched until bootstrap approval.
          </p>
          <div
            className={`status ${firebaseConfigurationComplete ? 'status-ready' : 'status-action'}`}
            role="status"
          >
            <span className="status-dot" aria-hidden="true" />
            {firebaseConfigurationComplete
              ? 'Firebase web configuration loaded'
              : 'Add VITE_FIREBASE_API_KEY to connect Firebase locally'}
          </div>
        </section>

        <section className="platform" aria-labelledby="platform-title">
          <div>
            <p className="eyebrow">Locked platform baseline</p>
            <h2 id="platform-title">One lean, maintainable stack</h2>
          </div>
          <dl className="platform-grid">
            {platformItems.map(([term, description]) => (
              <div className="platform-card" key={term}>
                <dt>{term}</dt>
                <dd>{description}</dd>
              </div>
            ))}
          </dl>
        </section>
      </main>

      <footer className="footer">
        <span>toyota-payroll</span>
        <span>Bootstrap only · No payroll logic</span>
      </footer>
    </div>
  );
}
