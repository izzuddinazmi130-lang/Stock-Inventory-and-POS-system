import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthContext';
import api from '../services/api';

const BusinessScopeContext = createContext(null);

export function BusinessScopeProvider({ children }) {
  const { user } = useAuth();
  const [businesses, setBusinesses] = useState([]);
  const [productCounts, setProductCounts] = useState({});
  const [selectedBusiness, setSelectedBusiness] = useState(null);

  useEffect(() => {
    if (!user) {
      setBusinesses([]);
      setProductCounts({});
      setSelectedBusiness(null);
      return;
    }

    const fetchBusinessScope = async () => {
      try {
        if (user.role === 'super_admin') {
          const res = await api.get('/businesses');
          const businessList = (res.data?.data || res.data?.businesses || []).map((business) => ({
            ...business,
            productCount: 0,
          }));
          setBusinesses(businessList);
          setSelectedBusiness((current) => current || businessList[0] || null);
        } else {
          const fallback = {
            id: user.business_id || 0,
            name: user.business_name || 'Current business',
            productCount: 0,
          };
          setBusinesses([fallback]);
          setSelectedBusiness(fallback);
        }
      } catch (error) {
        console.error('Business scope fetch failed:', error);
      }
    };

    fetchBusinessScope();
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const fetchCounts = async () => {
      try {
        const res = await api.get('/products');
        const items = res.data?.items || [];
        const counts = {};

        items.forEach((item) => {
          const businessName = item.business_name || item.business || 'Unassigned';
          counts[businessName] = (counts[businessName] || 0) + 1;
        });

        setProductCounts(counts);

        setBusinesses((current) =>
          current.map((business) => ({
            ...business,
            productCount: counts[business.name] || 0,
          }))
        );
      } catch (error) {
        console.error('Product count fetch failed:', error);
      }
    };

    fetchCounts();
  }, [user]);

  useEffect(() => {
    if (!selectedBusiness && businesses.length) {
      setSelectedBusiness(businesses[0]);
      return;
    }

    if (selectedBusiness && !businesses.some((business) => business.id === selectedBusiness.id)) {
      setSelectedBusiness(businesses[0] || null);
    }
  }, [businesses, selectedBusiness]);

  const value = useMemo(
    () => ({
      businesses,
      selectedBusiness,
      setSelectedBusiness,
      productCounts,
    }),
    [businesses, selectedBusiness, productCounts]
  );

  return <BusinessScopeContext.Provider value={value}>{children}</BusinessScopeContext.Provider>;
}

export const useBusinessScope = () => useContext(BusinessScopeContext);
