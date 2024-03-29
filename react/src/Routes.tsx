import React, { Suspense, lazy } from 'react';
import {
    BrowserRouter as Router,
    Navigate,
    Routes as RouterRoutes,
    Route,
    RouteProps,
    useLocation,
} from 'react-router-dom';
import { useAuth } from './hooks';
import { Header, LoadingOverlay } from './Components';

const AboutPage = lazy(() => import('./Pages/AboutPage'));
const FormPage = lazy(() => import('./Pages/FormPage'));
const JobListPage = lazy(() => import('./Pages/JobListPage'));
const LoginPage = lazy(() => import('./Pages/LoginPage'));
const RegistrationPage = lazy(() => import('./Pages/RegistrationPage'));
const UserSettingsPage = lazy(() => import('./Pages/UserSettingsPage'));

const Routes: React.FC = () => (
    <Router>
        <Header />
        <Suspense fallback={<LoadingOverlay open={true} />}>
            <RouterRoutes>
                <Route path="/about" element={<AboutPage />} />
                <Route path="/">
                    <Route
                        path=""
                        element={
                            <PrivateRoute>
                                <FormPage />
                            </PrivateRoute>
                        }
                    />
                    <Route
                        path=":jobId"
                        element={
                            <PrivateRoute>
                                <FormPage />
                            </PrivateRoute>
                        }
                    />
                </Route>

                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegistrationPage />} />
                <Route
                    path="/settings"
                    element={
                        <PrivateRoute>
                            <UserSettingsPage />
                        </PrivateRoute>
                    }
                />
                <Route
                    path="/jobs"
                    element={
                        <PrivateRoute>
                            <JobListPage />
                        </PrivateRoute>
                    }
                />
            </RouterRoutes>
        </Suspense>
    </Router>
);

const PrivateRoute: React.FC<{ role?: string } & RouteProps> = ({
    children,
    role,
}) => {
    const { loading, userAuthorized } = useAuth(role);
    const location = useLocation();

    if (!userAuthorized) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    if (loading) {
        return <LoadingOverlay open={true} />;
    }
    return children as React.ReactElement;
};

export default Routes;
