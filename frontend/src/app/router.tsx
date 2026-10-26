import { Navigate, createBrowserRouter } from 'react-router-dom';
import { RequireAuth, RequireRole } from './guards';
import { AppShell } from '@/components/layout/app-shell';
import { homeForRole } from '@/lib/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { LoginPage } from '@/pages/LoginPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { UnauthorizedPage } from '@/pages/UnauthorizedPage';
import { AdminDashboardPage } from '@/pages/admin/DashboardPage';
import { UsersPage } from '@/pages/admin/UsersPage';
import { ActivityPage } from '@/pages/admin/ActivityPage';
import { SettingsPage } from '@/pages/admin/SettingsPage';
import { GuruDashboardPage } from '@/pages/guru/DashboardPage';
import { BankSoalPage } from '@/pages/guru/BankSoalPage';
import { ExamListPage } from '@/pages/guru/ExamListPage';
import { ExamFormPage } from '@/pages/guru/ExamFormPage';
import { ResultsPage } from '@/pages/guru/ResultsPage';
import { StatisticsPage } from '@/pages/guru/StatisticsPage';
import { SiswaDashboardPage } from '@/pages/siswa/DashboardPage';
import { SiswaExamListPage } from '@/pages/siswa/ExamListPage';
import { ExamTakePage } from '@/pages/siswa/ExamTakePage';
import { HistoryPage } from '@/pages/siswa/HistoryPage';
import { ResultPage } from '@/pages/siswa/ResultPage';

function RootRedirect() {
  const user = useAuthStore((state) => state.user);
  return <Navigate to={user ? homeForRole(user.role) : '/login'} replace />;
}

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/', element: <RootRedirect /> },
  {
    path: '/admin',
    element: (
      <RequireAuth>
        <RequireRole roles={['admin']}>
          <AppShell />
        </RequireRole>
      </RequireAuth>
    ),
    children: [
      { index: true, element: <AdminDashboardPage /> },
      { path: 'pengguna', element: <UsersPage /> },
      { path: 'statistik', element: <StatisticsPage /> },
      { path: 'aktivitas', element: <ActivityPage /> },
      { path: 'pengaturan', element: <SettingsPage /> },
    ],
  },
  {
    path: '/guru',
    element: (
      <RequireAuth>
        <RequireRole roles={['guru']}>
          <AppShell />
        </RequireRole>
      </RequireAuth>
    ),
    children: [
      { index: true, element: <GuruDashboardPage /> },
      { path: 'bank-soal', element: <BankSoalPage /> },
      { path: 'ujian', element: <ExamListPage /> },
      { path: 'ujian/baru', element: <ExamFormPage /> },
      { path: 'ujian/:id', element: <ExamFormPage /> },
      { path: 'hasil', element: <ResultsPage /> },
      { path: 'statistik', element: <StatisticsPage /> },
    ],
  },
  {
    path: '/siswa',
    element: (
      <RequireAuth>
        <RequireRole roles={['siswa']}>
          <AppShell />
        </RequireRole>
      </RequireAuth>
    ),
    children: [
      { index: true, element: <SiswaDashboardPage /> },
      { path: 'ujian', element: <SiswaExamListPage /> },
      { path: 'hasil', element: <HistoryPage /> },
      { path: 'hasil/:submissionId', element: <ResultPage /> },
    ],
  },
  {
    path: '/siswa/ujian/:examId/kerjakan',
    element: (
      <RequireAuth>
        <RequireRole roles={['siswa']}>
          <ExamTakePage />
        </RequireRole>
      </RequireAuth>
    ),
  },
  {
    path: '/unauthorized',
    element: <UnauthorizedPage />,
  },
  { path: '*', element: <NotFoundPage /> },
]);
