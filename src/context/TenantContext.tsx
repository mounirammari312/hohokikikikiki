import React, { createContext, useContext, useState, useEffect } from 'react';

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  domain?: string;
  logo?: string;
  currency: string;
  phone?: string;
  themeColor?: string;
}

interface TenantContextType {
  currentTenant: Tenant | null;
  isPlatform: boolean;
}

const TenantContext = createContext<TenantContextType>({
  currentTenant: null,
  isPlatform: true,
});

export const TenantProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentTenant, setCurrentTenant] = useState<Tenant | null>(null);
  const [isPlatform, setIsPlatform] = useState<boolean>(true);

  useEffect(() => {
    const host = window.location.hostname;
    // Default to Marketplace Platform
    setIsPlatform(true);
  }, []);

  return (
    <TenantContext.Provider value={{ currentTenant, isPlatform }}>
      {children}
    </TenantContext.Provider>
  );
};

export const useTenant = () => useContext(TenantContext);
