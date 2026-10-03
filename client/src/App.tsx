import type { ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { useAuth } from './lib/auth';
import Spinner from './components/Spinner';
import AppShell from './components/shell/AppShell';
import { CallProvider } from './context/call';
import { FriendsProvider } from './context/friends';
import { RoomsProvider } from './context/rooms';
import { UiProvider } from './context/ui';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import FriendsPage from './pages/app/FriendsPage';
import MessageRequestsPage from './pages/app/MessageRequestsPage';
import ExplorePage from './pages/app/ExplorePage';
import RoomPage from './pages/app/RoomPage';
import DmPage from './pages/app/DmPage';
import GroupPage from './pages/app/GroupPage';
import { DmProvider } from './context/dms';
import { GroupsProvider } from './context/groups';

/** Endereço antigo das chamadas privadas, que agora vivem na DM. */
function CallRedirect() {
  return <Navigate to={`/app/dm/${useParams().friendId}`} replace />;
}

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Spinner fullscreen />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
}

function GuestOnly({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Spinner fullscreen />;
  if (user) {
    const from = (location.state as { from?: string } | null)?.from;
    return <Navigate to={from ?? '/app'} replace />;
  }
  return <>{children}</>;
}

/** Os providers ficam montados enquanto o usuário navega dentro do app (a chamada não cai). */
function AuthedApp() {
  const { user } = useAuth();
  return (
    <RequireAuth>
      <UiProvider>
        <RoomsProvider key={user?.id}>
          <FriendsProvider>
            <DmProvider>
              <GroupsProvider>
                <CallProvider>
                  <AppShell />
                </CallProvider>
              </GroupsProvider>
            </DmProvider>
          </FriendsProvider>
        </RoomsProvider>
      </UiProvider>
    </RequireAuth>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<GuestOnly><Landing /></GuestOnly>} />
      <Route path="/login" element={<GuestOnly><Login /></GuestOnly>} />
      <Route path="/register" element={<GuestOnly><Register /></GuestOnly>} />
      <Route path="/app" element={<AuthedApp />}>
        <Route index element={<Navigate to="friends" replace />} />
        <Route path="friends" element={<FriendsPage />} />
        <Route path="message-requests" element={<MessageRequestsPage />} />
        <Route path="explore" element={<ExplorePage />} />
        <Route path="room/:roomId" element={<RoomPage />} />
        <Route path="dm/:friendId" element={<DmPage />} />
        <Route path="group/:groupId" element={<GroupPage />} />
        <Route path="call/:friendId" element={<CallRedirect />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
