import React, { useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppBar, Grid, IconButton, Toolbar, Typography } from '@mui/material';
import { Settings } from '@mui/icons-material';
import { UserContext } from '../Pages/BasePage';
import { MenuLink } from '.';

const Header: React.FC = () => {
    const { user } = useContext(UserContext);

    const logout = () => {
        window.location.assign('/login');
        localStorage.removeItem('jwt');
    };

    const navigate = useNavigate();

    return (
        <>
            <AppBar position="fixed">
                <Toolbar>
                    <Grid container alignItems="center" sx={{ padding: 1 }}>
                        <Grid container item xs={6}>
                            <Typography variant="h5">
                                <MenuLink href="/">
                                    Speech Feature Online
                                </MenuLink>
                            </Typography>
                        </Grid>
                        <Grid
                            alignItems="center"
                            container
                            spacing={2}
                            item
                            xs={6}
                            justifyContent="flex-end"
                        >
                            <Grid item>
                                <MenuLink href="about">About</MenuLink>
                            </Grid>
                            {user ? (
                                <>
                                    <Grid item>
                                        <Typography>
                                            Hello, {user.username}!
                                        </Typography>
                                    </Grid>
                                    <Grid item>
                                        <IconButton
                                            onClick={() =>
                                                navigate('/settings')
                                            }
                                            sx={{
                                                color: theme =>
                                                    theme.palette.primary
                                                        .contrastText,
                                            }}
                                        >
                                            <Settings />
                                        </IconButton>
                                    </Grid>
                                    <Grid item>
                                        <MenuLink href="/">New job</MenuLink>
                                    </Grid>
                                    <Grid item>
                                        <MenuLink href="/jobs">
                                            View jobs
                                        </MenuLink>
                                    </Grid>
                                    <Grid item>
                                        <MenuLink href="#" onClick={logout}>
                                            Logout
                                        </MenuLink>
                                    </Grid>
                                </>
                            ) : (
                                <Grid item>
                                    <MenuLink href="/login">Log In</MenuLink>
                                </Grid>
                            )}
                        </Grid>
                    </Grid>
                </Toolbar>
            </AppBar>
            <Toolbar />
        </>
    );
};

export default Header;
