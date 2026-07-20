import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { WebsiteProvider } from './context/WebsiteContext';
import { PageProvider } from './context/PageContext';
import { MediaProvider } from './context/MediaContext';
import { GlobalProvider } from './context/GlobalContext';
import { SearchProvider } from './context/SearchContext';
import { ToastProvider } from './context/ToastContext';
import App from './App.jsx';
import './index.css';

const queryClient = new QueryClient();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <ToastProvider>
            <WebsiteProvider>
              <PageProvider>
                <MediaProvider>
                  <GlobalProvider>
                    <SearchProvider>
                      <App />
                    </SearchProvider>
                  </GlobalProvider>
                </MediaProvider>
              </PageProvider>
            </WebsiteProvider>
          </ToastProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>
);
