import Button from '../UI/Button';

interface AppRouterProps {
  onSelect: (mode: 'langflow' | 'engine') => void;
}

const AppRouter = ({ onSelect }: AppRouterProps) => {
  return (
    <div className="router-shell">
      <header className="router-header">
        <h1>Choisissez votre espace de travail</h1>
        <p>Choisissez la stack que vous souhaitez utiliser pour cette session.</p>
      </header>
      <div className="router-grid">
        <div className="router-card">
          <div>
            <h2>Langflow Agentic App</h2>
            <p>
              La console de chat et de base de connaissances d'origine, s'appuyant sur Langflow, Astra DB et les métadonnées de Firestore.
            </p>
          </div>
          <Button className="router-cta" onClick={() => onSelect('langflow')}>
            Ouvrir la console Langflow
          </Button>
        </div>
        <div className="router-card">
          <div>
            <h2>Python/Rust RAG Engine</h2>
            <p>
              Le nouveau pipeline avec RAG Agentique / multi-agents
            </p>
          </div>
          <Button className="router-cta" onClick={() => onSelect('engine')}>
            Ouvrire le mouteur RAG Agentique
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AppRouter;
