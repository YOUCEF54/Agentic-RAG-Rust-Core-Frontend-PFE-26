import { useEffect, useState } from 'react';
import {
  collection,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc
} from 'firebase/firestore';
import api from '../services/api';
import { db } from '../services/firebase';
import type { ChatMessage } from '../types/agent.types';

const SESSION_STORAGE_KEY = 'ragChatSessionId';
const SESSION_COLLECTION = 'chat_sessions';

export const useAgentChat = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState(true);

  useEffect(() => {
    const restoreSession = async () => {
      try {
        setIsRestoring(true);
        const storedId = localStorage.getItem(SESSION_STORAGE_KEY);
        const id = storedId || doc(collection(db, SESSION_COLLECTION)).id;
        setSessionId(id);

        const sessionRef = doc(db, SESSION_COLLECTION, id);
        const snapshot = storedId ? await getDoc(sessionRef) : null;

        if (snapshot?.exists()) {
          const data = snapshot.data();
          const savedMessages = Array.isArray(data.messages)
            ? (data.messages as ChatMessage[])
            : [];
          setMessages(savedMessages);
        } else {
          await setDoc(sessionRef, {
            messages: [],
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
          setMessages([]);
        }

        if (!storedId) {
          localStorage.setItem(SESSION_STORAGE_KEY, id);
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Unable to restore chat session.';
        setError(message);
      } finally {
        setIsRestoring(false);
      }
    };

    restoreSession();
  }, []);

  const persistMessages = async (nextMessages: ChatMessage[]) => {
    if (!sessionId) {
      return;
    }
    try {
      await updateDoc(doc(db, SESSION_COLLECTION, sessionId), {
        messages: nextMessages,
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unable to save chat session.';
      setError(message);
    }
  };

  const sendMessage = async (content: string) => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await api.post('/chat', {
        message: content
      });

      const nextMessages = [
        ...messages,
        { role: 'user', content },
        { role: 'agent', content: response.data.response }
      ];
      setMessages(nextMessages);
      await persistMessages(nextMessages);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unable to send message.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return { messages, sendMessage, isLoading, error, isRestoring };
};
