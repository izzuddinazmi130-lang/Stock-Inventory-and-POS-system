import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { useAuth } from './AuthContext';
import { useSocket } from './SocketContext';

const BusinessContext = createContext({});

export function BusinessProvider({ children }) {
  const { user } = useAuth();
  const { socket } = useSocket() || {};
  const [businesses, setBusinesses] = useState([]);
  const [selectedBusiness, setSelectedBusiness] = useState(null);
  const [productCounts, setProductCounts] = useState({});

  const reloadBusinesses = useCallback(() => {
    if (!user) return;
    api.get('/businesses').then(r => {
      if (r.data.success) {
        const bizs = r.data.businesses || r.data.data || [];
        setBusinesses(bizs);
      }
    }).catch(() => {});
  }, [user]);

  const reloadProductCounts = useCallback(() => {
    if (!user) return;
    api.get('/products').then(r => {
      if (r.data.success) {
        const counts = {};
        (r.data.items || []).forEach(item => {
          if (item.business_name) {
            counts[item.business_name] = (counts[item.business_name] || 0) + 1;
          }
        });
        setProductCounts(counts);
      }
    }).catch(() => {});
  }, [user]);

  useEffect(() => {
    reloadBusinesses();
    reloadProductCounts();
  }, [reloadBusinesses, reloadProductCounts]);

  // Real-time updates via Socket.io
  useEffect(() => {
    if (!socket) return;

    const handleUpdate = () => {
      reloadBusinesses();
      reloadProductCounts();
    };

    socket.on('business_updated', handleUpdate);
    socket.on('branch_updated', handleUpdate);
    socket.on('inventory_updated', handleUpdate);
    socket.on('product_deleted', handleUpdate);

    return () => {
      socket.off('business_updated', handleUpdate);
      socket.off('branch_updated', handleUpdate);
      socket.off('inventory_updated', handleUpdate);
      socket.off('product_deleted', handleUpdate);
    };
  }, [socket, reloadBusinesses, reloadProductCounts]);

  return (
    <BusinessContext.Provider value={{ 
      businesses, 
      selectedBusiness, 
      setSelectedBusiness, 
      productCounts,
      reloadBusinesses,
      reloadProductCounts
    }}>
      {children}
    </BusinessContext.Provider>
  );
}

export function useBusiness() {
  return useContext(BusinessContext);
}

