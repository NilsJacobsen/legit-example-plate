'use client';

import { LegitProvider } from '@legit-sdk/react';

const Provider = ({ children }: { children: React.ReactNode }) => {
  return (
    
        <LegitProvider>{children}</LegitProvider>

  );
};

export default Provider;