// src/App.tsx
import AppRouter from './routes/AppRouter';
import ErrorBoundary from './components/UI/ErrorBoundary';

function App() {
  return (
    <ErrorBoundary>
      <AppRouter />
    </ErrorBoundary>
  );
}


export default App;
