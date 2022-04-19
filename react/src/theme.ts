import { createTheme } from '@mui/material';

const getTheme = (darkMode?: boolean) =>
    createTheme({
        components: {
            MuiFormLabel: {
                styleOverrides: {
                    root: {
                        color: 'green',
                        fontSize: '30px',
                    },
                    colorSecondary: {
                        color: 'orange',
                    },
                },
            },
        },
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
