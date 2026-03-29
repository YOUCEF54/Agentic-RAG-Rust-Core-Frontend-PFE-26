import MessageList from './MessageList';
import MessageInput from './MessageInput';
import { useAgentChat } from '../../hooks/useAgentChat';

const ChatInterface = () => {
  const { messages, sendMessage, isLoading, error, isRestoring } = useAgentChat();

  const handleSend = async (content: string) => {
    await sendMessage(content);
  };

  return (
    <section className="chat-shell">
      {error ? <div className="error-banner">{error}</div> : null}
      <MessageList messages={messages} isLoading={isLoading} />
      <div className="input-area">
        <MessageInput onSend={handleSend} disabled={isLoading || isRestoring} />
      </div>
    </section>
  );
};

export default ChatInterface;
