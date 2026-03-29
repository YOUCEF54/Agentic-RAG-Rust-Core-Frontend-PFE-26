import { useState } from 'react';
import AppRouter from './components/Router/AppRouter';
import LangflowWorkspace from './components/Langflow/LangflowWorkspace';
import EngineWorkspace from './components/Engine/EngineWorkspace';

type AppMode = 'router' | 'langflow' | 'engine';

const App = () => {
  const [mode, setMode] = useState<AppMode>('router');

  if (mode === 'langflow') {
    return <LangflowWorkspace onBack={() => setMode('router')} />;
  }

  if (mode === 'engine') {
    return <EngineWorkspace onBack={() => setMode('router')} />;
  }

  return <AppRouter onSelect={(nextMode) => setMode(nextMode)} />;
};

export default App;
