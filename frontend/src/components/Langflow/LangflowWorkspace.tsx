import { useState } from 'react';
import Header from '../Layout/Header';
import Sidebar from '../Layout/Sidebar';
import ChatInterface from '../Chat/ChatInterface';
import KnowledgeManager from '../Knowledge/KnowledgeManager';
import Button from '../UI/Button';

type WorkspaceView = 'chat' | 'knowledge';

interface LangflowWorkspaceProps {
  onBack: () => void;
}

const LangflowWorkspace = ({ onBack }: LangflowWorkspaceProps) => {
  const [activeView, setActiveView] = useState<WorkspaceView>('chat');

  return (
    <div className="app-shell">
      <Header />
      <div className="content">
        <Sidebar />
        <main className="chat-area">
          <div className="workspace-toolbar">
            <Button className="ghost-button" onClick={onBack}>
              Back to Router
            </Button>
            <div className="view-toggle" role="tablist" aria-label="Workspace views">
              <Button
                className={`toggle-button ${activeView === 'chat' ? 'active' : ''}`}
                onClick={() => setActiveView('chat')}
                type="button"
              >
                Chat
              </Button>
              <Button
                className={`toggle-button ${activeView === 'knowledge' ? 'active' : ''}`}
                onClick={() => setActiveView('knowledge')}
                type="button"
              >
                Knowledge
              </Button>
            </div>
          </div>
          <div className="view-panel">
            {activeView === 'chat' ? <ChatInterface /> : <KnowledgeManager />}
          </div>
        </main>
      </div>
    </div>
  );
};

export default LangflowWorkspace;
