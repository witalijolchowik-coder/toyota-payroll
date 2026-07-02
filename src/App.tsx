import { Navigate, Route, Routes } from 'react-router-dom';

import { BootstrapPage } from './pages/BootstrapPage';

export function App() {
  return (
    <Routes>
      <Route path="/" element={<BootstrapPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
