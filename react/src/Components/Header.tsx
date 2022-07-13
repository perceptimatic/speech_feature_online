import React, { useContext } from 'react';
import { AppBar, Grid, Toolbar, Typography } from '@mui/material';
import { UserContext } from '../Pages/HomePage';
import { MenuLink } from '.';

const Header: React.FC = () => {
    const { user } = useContext(UserContext);

    const logout = () => {
        window.location.assign('/login');
        localStorage.removeItem('jwt');
    };

    return (
        <>
            <AppBar position="fixed">
                <Toolbar>
                    <Grid container alignItems="center" sx={{ padding: 1 }}>
                        <Grid container item xs={6}>
                            <Typography variant="h5">
                                Speech Feature Online
                            </Typography>
                        </Grid>
                        <Grid
                            container
                            spacing={2}
                            item
                            xs={6}
                            justifyContent="flex-end"
                        >
                            <Grid item>
                                <MenuLink href="about">About</MenuLink>
                            </Grid>
                            {user && (
                                <>
                                    <Grid item>
                                        <Typography>
                                            Hello, {user.username}!
                                        </Typography>
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
