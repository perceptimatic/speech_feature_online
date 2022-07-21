import React, { useMemo, useState } from 'react';

import CssBaseline from '@mui/material/CssBaseline';
import Container from '@mui/material/Container';
import { ThemeProvider } from '@mui/private-theming';
import { Box } from '@mui/system';
import getTheme from '../theme';
import { Footer } from '../Components';
import { User } from '../types';
import Routes from '../Routes';

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
                            <Routes />
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
