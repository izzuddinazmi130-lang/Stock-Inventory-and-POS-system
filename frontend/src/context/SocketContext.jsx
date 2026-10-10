import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext();

export const SocketProvider = ({ children }) => {
  const { user } = useAuth();
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    if (!user) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
      return;
    }

    // Same address as the page: in development Vite forwards /socket.io to the API, so this also works on a phone
    const socketUrl = window.location.origin;
    const newSocket = io(socketUrl, {
      withCredentials: true,
      // Go straight to WebSocket: the HTTP long-polling handshake left stray "400 session unknown"
      // errors when a page was left mid-handshake or the server restarted. Polling stays as a fallback.
      transports: ['websocket', 'polling'],
    });

    // The server authenticates the socket with the auth cookie and joins it to the
    // rooms for this user's business/branch (or the super admin room) itself.
    newSocket.on('connect', () => {
      console.log('⚡ Socket.io connected:', newSocket.id);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [user]);

  return (
    <SocketContext.Provider value={{ socket }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);
