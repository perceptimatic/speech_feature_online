import React, { useMemo, useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import CssBaseline from '@mui/material/CssBaseline';
import Container from '@mui/material/Container';
import { ThemeProvider } from '@mui/private-theming';
import { Box } from '@mui/system';
import getTheme from '../theme';
import { Header, Footer } from '../Components';
import { FormPage } from '.';

const Main: React.FC = () => {
    const [darkMode] = useState(!!window.localStorage.getItem('darkMode'));

    const theme = useMemo(() => getTheme(darkMode), [darkMode]);
    return (
        <>
            <CssBaseline />
            <ThemeProvider theme={theme}>
                <Wrapper>
                    <Container maxWidth="lg">
                        <Router>
                            <Header />
                            <Routes>
                                <Route path="*" element={<FormPage />} />
                            </Routes>
                        </Router>
                    </Container>
                    <Footer />
                </Wrapper>
            </ThemeProvider>
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
