// src/App.tsx
import { useEffect } from 'react';
import AppRouter from './routes/AppRouter';

function App() {
  // Periodically poll for due scheduled PLU changes
  useEffect(() => {
    const interval = setInterval(() => {
      import('./store/appStore').then(({ useAppStore }) => {
        useAppStore.getState().applyDueScheduledChanges();
      });
    }, 60_000);
    return () => clearInterval(interval);
  }, []);

  return <AppRouter />;
}


export default App;
