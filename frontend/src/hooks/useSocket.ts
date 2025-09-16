import { useEffect, useRef } from 'react';
import { socketService } from '../services/socket';
import { SocketEvents } from '../types';

export const useSocket = <K extends keyof SocketEvents>(
  event: K,
  callback: SocketEvents[K],
  deps: any[] = []
) => {
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    const wrappedCallback = (...args: any[]):any => {
      // callbackRef.current(...args);
       (callbackRef.current as any)?.(...args);
    };

    socketService.on(event, wrappedCallback);

    return () => {
      socketService.off(event, wrappedCallback);
    };
  }, [event, ...deps]);
};

export const useSocketConnection = () => {
  const joinProject = (projectId: string) => {
    socketService.joinProject(projectId);
  };

  const leaveProject = (projectId: string) => {
    socketService.leaveProject(projectId);
  };

  const isConnected = () => {
    return socketService.isConnected();
  };

  return {
    joinProject,
    leaveProject,
    isConnected,
  };
};
