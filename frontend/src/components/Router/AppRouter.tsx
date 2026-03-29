import Button from '../UI/Button';

interface AppRouterProps {
  onSelect: (mode: 'langflow' | 'engine') => void;
}

const AppRouter = ({ onSelect }: AppRouterProps) => {
  return (
    <div className="router-shell">
      <header className="router-header">
        <h1>Choose Your Workspace</h1>
        <p>Pick the stack you want to run for this session.</p>
      </header>
      <div className="router-grid">
        <div className="router-card">
          <div>
            <h2>Langflow Agentic App</h2>
            <p>
              The original chat + knowledge console backed by Langflow, Astra DB, and
              Firestore metadata.
            </p>
          </div>
          <Button className="router-cta" onClick={() => onSelect('langflow')}>
            Open Langflow Console
          </Button>
        </div>
        <div className="router-card">
          <div>
            <h2>Python/Rust RAG Engine</h2>
            <p>
              The new pipeline for document uploads, indexing, and querying via your
              custom backend endpoints.
            </p>
          </div>
          <Button className="router-cta" onClick={() => onSelect('engine')}>
            Open RAG Engine
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AppRouter;
