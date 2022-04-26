import { createTheme } from '@mui/material';

const getTheme = (darkMode?: boolean) =>
    createTheme({
        palette: {
            mode: darkMode ? 'dark' : 'light',
            primary: {
                main: '#1B336A',
            },
            secondary: {
                main: '#C39538',
            },
        },
    });

export default getTheme;
