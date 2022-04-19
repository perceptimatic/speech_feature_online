import React from 'react';
import { AppBar, Grid, Toolbar, Typography } from '@mui/material';
import { MenuLink } from '.';

const Header: React.FC = () => (
    <>
        <AppBar position="fixed">
            <Toolbar>
                <Grid container alignItems="center" sx={{ padding: 1 }}>
                    <Grid container item xs={6}>
                        <Typography variant="h5">
                            Speech Feature Online
                        </Typography>
                    </Grid>
                    <Grid container item xs={6} justifyContent="flex-end">
                        <MenuLink href="about">About</MenuLink>
                    </Grid>
                </Grid>
            </Toolbar>
        </AppBar>
        <Toolbar />
    </>
);

export default Header;
