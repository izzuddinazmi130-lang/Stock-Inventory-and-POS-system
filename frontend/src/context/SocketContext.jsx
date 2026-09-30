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

    const socketUrl = window.location.origin.includes('5173') ? 'http://localhost:5000' : window.location.origin;
    const newSocket = io(socketUrl, {
      withCredentials: true
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
