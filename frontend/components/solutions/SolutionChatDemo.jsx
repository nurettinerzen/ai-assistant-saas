'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence, useInView } from 'framer-motion';

export default function SolutionChatDemo({
  messages = [],
  botName = 'Telyx AI',
  botInitials = 'AI',
  statusText = 'Online',
  typingDelay = 800,
  messageDelay = 1200,
  restartDelay = 2500,
}) {
  const containerRef = useRef(null);
  const inView = useInView(containerRef, { once: false, margin: '-20px' });
  const [visibleMessages, setVisibleMessages] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const cancelledRef = useRef(false);

  const sleep = (ms) =>
    new Promise((resolve) => {
      const id = setTimeout(resolve, ms);
      return () => clearTimeout(id);
    });

  const runLoop = useCallback(async () => {
    cancelledRef.current = false;

    while (!cancelledRef.current) {
      setVisibleMessages([]);
      setIsTyping(false);

      for (let i = 0; i < messages.length; i++) {
        if (cancelledRef.current) return;

        const msg = messages[i];

        if (msg.type === 'bot') {
          setIsTyping(true);
          await sleep(typingDelay);
          if (cancelledRef.current) return;
          setIsTyping(false);
        }

        setVisibleMessages((prev) => [...prev, { ...msg, id: `${Date.now()}-${i}` }]);
        await sleep(messageDelay);
        if (cancelledRef.current) return;
      }

      await sleep(restartDelay);
      if (cancelledRef.current) return;
    }
  }, [messages, typingDelay, messageDelay, restartDelay]);

  useEffect(() => {
    if (inView) {
      runLoop();
    } else {
      cancelledRef.current = true;
      setVisibleMessages([]);
      setIsTyping(false);
    }
    return () => {
      cancelledRef.current = true;
    };
  }, [inView, runLoop]);

  const chatBodyRef = useRef(null);

  useEffect(() => {
    if (chatBodyRef.current) {
      chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight;
    }
  }, [visibleMessages, isTyping]);

  return (
    <div ref={containerRef} className="sol-chat-window">
      {/* Header */}
      <div className="sol-chat-header">
        <div className="sol-chat-avatar">{botInitials}</div>
        <div>
          <div className="sol-chat-header-name">{botName}</div>
          <div className="sol-chat-header-status">{statusText}</div>
        </div>
      </div>

      {/* Messages */}
      <div ref={chatBodyRef} className="sol-chat-messages">
        <AnimatePresence mode="popLayout">
          {visibleMessages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className={`sol-chat-msg ${msg.type}`}
            >
              {msg.text}
            </motion.div>
          ))}

          {isTyping && (
            <motion.div
              key="typing"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="sol-chat-msg bot"
            >
              <div className="sol-typing-dots">
                <span />
                <span />
                <span />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
