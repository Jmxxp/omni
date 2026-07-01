'use client';

import { AnimatePresence, motion } from 'motion/react';
import { useState, useEffect } from 'react';
import { useSessionContext } from '@livekit/components-react';
import type { AppConfig } from '@/app-config';
import { SessionView } from '@/components/app/session-view';
import { WelcomeView } from '@/components/app/welcome-view';

const MotionWelcomeView = motion.create(WelcomeView);
const MotionSessionView = motion.create(SessionView);

const VIEW_MOTION_PROPS = {
  variants: {
    visible: {
      opacity: 1,
    },
    hidden: {
      opacity: 0,
    },
  },
  initial: 'hidden',
  animate: 'visible',
  exit: 'hidden',
  transition: {
    duration: 0.5,
    ease: 'linear' as const,
  },
};

interface ViewControllerProps {
  appConfig: AppConfig;
}

export function ViewController({ appConfig }: ViewControllerProps) {
  const { isConnected, start, end } = useSessionContext();
  const [isActive, setIsActive] = useState(false);
  const [connectionError, setConnectionError] = useState('');

  // Ativa a sessão apenas quando a conexão é estabelecida.
  useEffect(() => {
    if (isConnected) {
      setConnectionError('');
      setIsActive(true);
    }
  }, [isConnected]);

  const handleStart = async (opts?: any) => {
    setConnectionError('');

    try {
      await start(opts);
    } catch (error) {
      setIsActive(false);
      try {
        end();
      } catch {
        // Session may already be closed.
      }

      const message = error instanceof Error ? error.message : String(error);
      const invalidToken = message.toLowerCase().includes('invalid token');
      setConnectionError(
        invalidToken
          ? 'Token inválido. Confira se LIVEKIT_URL, LIVEKIT_API_KEY e LIVEKIT_API_SECRET são do mesmo projeto LiveKit e se a chave não foi copiada incompleta.'
          : message
      );
    }
  };

  const handleDisconnect = () => {
    setIsActive(false);
    setConnectionError('');
  };

  return (
    <AnimatePresence mode="wait">
      {/* Welcome view */}
      {!isActive && !isConnected && (
        <MotionWelcomeView
          key="welcome"
          {...VIEW_MOTION_PROPS}
          startButtonText={appConfig.startButtonText}
          onStartCall={handleStart}
          connectionError={connectionError}
        />
      )}
      {/* Session view */}
      {(isActive || isConnected) && (
        <MotionSessionView
          key="session-view"
          {...VIEW_MOTION_PROPS}
          appConfig={appConfig}
          onManualDisconnect={handleDisconnect}
        />
      )}
    </AnimatePresence>
  );
}
