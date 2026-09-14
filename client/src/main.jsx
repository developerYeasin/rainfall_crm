import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { router } from './routes/router.jsx';
import { AuthProvider } from './features/auth/AuthContext.jsx';
import { LanguageBoundary, LanguageProvider } from './i18n/index.jsx';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <AuthProvider>
          <LanguageBoundary>
            <RouterProvider router={router} />
          </LanguageBoundary>
          <Toaster position="top-right" toastOptions={{ style: { fontFamily: 'inherit', fontSize: '14px' } }} />
        </AuthProvider>
      </LanguageProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
