import React, { useMemo, useState } from 'react';
import {
    BrowserRouter as Router,
    Navigate,
    Routes,
    Route,
    RouteProps,
    useLocation,
} from 'react-router-dom';
import CssBaseline from '@mui/material/CssBaseline';
import Container from '@mui/material/Container';
import { ThemeProvider } from '@mui/private-theming';
import { Box } from '@mui/system';
import getTheme from '../theme';
import { Header, Footer } from '../Components';
import { User } from '../types';
import { useAuth } from '../hooks';
import { FormPage, JobListPage, LoginPage, RegistrationPage } from '.';

export const UserContext = React.createContext<{
    user: User | undefined;
    setUser: (user: User) => void;
}>({
    user: undefined,
    /* eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-empty-function */
    setUser: (user: User) => {},
});

const Main: React.FC = () => {
    const [user, setUser] = useState<User>();
    const [darkMode] = useState(!!window.localStorage.getItem('darkMode'));

    const theme = useMemo(() => getTheme(darkMode), [darkMode]);
    return (
        <>
            <CssBaseline />
            <UserContext.Provider
                value={{ user, setUser: (user: User) => setUser(user) }}
            >
                <ThemeProvider theme={theme}>
                    <Wrapper>
                        <Container maxWidth="lg">
                            <Router>
                                <Header />
                                <Routes>
                                    <Route
                                        path="/"
                                        element={
                                            <PrivateRoute>
                                                <FormPage />
                                            </PrivateRoute>
                                        }
                                    />
                                    <Route
                                        path="/login"
                                        element={<LoginPage />}
                                    />
                                    <Route
                                        path="/register"
                                        element={<RegistrationPage />}
                                    />
                                    <Route
                                        path="/jobs"
                                        element={
                                            <PrivateRoute>
                                                <JobListPage />
                                            </PrivateRoute>
                                        }
                                    />
                                </Routes>
                            </Router>
                        </Container>
                        <Footer />
                    </Wrapper>
                </ThemeProvider>
            </UserContext.Provider>
        </>
    );
};

const Wrapper: React.FC = ({ children }) => (
    <Box
        sx={{
            display: 'flex',
            flexDirection: 'column',
            height: '100vh',
            justifyContent: 'space-between',
        }}
    >
        {children}
    </Box>
);

export default Main;

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
        return <span>Loading...</span>;
    }
    return children as React.ReactElement;
};
