import { useState } from 'react';
import Button from '../UI/Button';

interface MessageInputProps {
  onSend: (content: string) => Promise<void> | void;
  disabled?: boolean;
}

const MessageInput = ({ onSend, disabled }: MessageInputProps) => {
  const [value, setValue] = useState('');

  const handleSubmit = async () => {
    if (!value.trim()) {
      return;
    }
    await onSend(value.trim());
    setValue('');
  };

  return (
    <div className="input-row">
      <textarea
        placeholder="Ask your agent something..."
        value={value}
        onChange={(event) => setValue(event.target.value)}
        disabled={disabled}
      />
      <Button onClick={handleSubmit} disabled={disabled || !value.trim()}>
        Send
      </Button>
    </div>
  );
};

export default MessageInput;
