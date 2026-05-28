import { Suspense } from 'react';
import { useRoutes } from 'react-router-dom';
import { DashboardLayout } from './components/DashboardLayout';
import { ErrorBoundary } from './components/ErrorBoundary';
import { PageFallback } from './components/PageFallback';
import { useRealtimeTrading } from './hooks/useRealtimeTrading';
import { appRoutes } from './router/routes';

export default function App() {
  const routeElement = useRoutes(appRoutes);
  useRealtimeTrading();

  return (
    <DashboardLayout>
      <ErrorBoundary>
        <Suspense fallback={<PageFallback />}>{routeElement}</Suspense>
      </ErrorBoundary>
    </DashboardLayout>
  );
}
