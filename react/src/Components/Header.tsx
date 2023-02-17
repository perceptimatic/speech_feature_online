import React, { useContext, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
    Alert,
    AppBar,
    Container,
    Grid,
    IconButton,
    Menu,
    MenuItem,
    Toolbar,
    Typography,
    useMediaQuery,
    useTheme,
} from '@mui/material';
import {
    LogoutOutlined,
    Menu as MenuIcon,
    Settings,
} from '@mui/icons-material';
import { isChrome, isFirefox } from 'react-device-detect';
import { logout } from '../util';
import { UserContext } from '../Pages/BasePage';
import { MenuLink } from '.';

const Header: React.FC = () => {
    const { user } = useContext(UserContext);

    const navigate = useNavigate();

    const { pathname } = useLocation();

    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));

    const [anchorElNav, setAnchorElNav] = React.useState<null | HTMLElement>(
        null
    );

    const handleOpenNavMenu = (event: React.MouseEvent<HTMLElement>) => {
        setAnchorElNav(event.currentTarget);
    };

    const handleCloseNavMenu = () => {
        setAnchorElNav(null);
    };

    const pages = useMemo(
        () => [
            {
                title: 'New Job',
                target: '/',
                display: () => pathname !== '/',
            },
            {
                title: 'View Jobs',
                target: '/jobs',
                display: () => pathname !== '/jobs',
            },
            {
                title: 'About',
                target: '/about',
                display: () => pathname !== '/about',
            },
            {
                title: 'User Settings',
                target: '/settings',
                display: () => isMobile && pathname !== '/settings',
            },
        ],
        [pathname, isMobile]
    );

    return (
        <>
            <AppBar position="fixed">
                <Container maxWidth="xl">
                    <Toolbar>
                        <Grid container direction="column">
                            <Grid
                                alignItems="center"
                                container
                                wrap="nowrap"
                                item
                                sx={{ padding: 1 }}
                            >
                                <Grid
                                    alignItems="center"
                                    container
                                    item
                                    spacing={3}
                                    wrap="nowrap"
                                >
                                    {!isMobile && (
                                        <Grid item>
                                            <Typography
                                                sx={{ whiteSpace: 'nowrap' }}
                                                variant="h5"
                                            >
                                                Speech Features Online
                                            </Typography>
                                        </Grid>
                                    )}
                                    {user && !isMobile ? (
                                        <Grid
                                            item
                                            wrap="nowrap"
                                            container
                                            spacing={2}
                                            sx={{ whiteSpace: 'nowrap' }}
                                        >
                                            {pages.map(
                                                p =>
                                                    p.display() && (
                                                        <Grid
                                                            item
                                                            key={p.target}
                                                        >
                                                            <MenuLink
                                                                href={p.target}
                                                            >
                                                                {p.title}
                                                            </MenuLink>
                                                        </Grid>
                                                    )
                                            )}
                                        </Grid>
                                    ) : user ? (
                                        <Grid item container>
                                            <IconButton
                                                size="large"
                                                onClick={handleOpenNavMenu}
                                                color="inherit"
                                            >
                                                <MenuIcon />
                                            </IconButton>
                                            <Menu
                                                id="menu-appbar"
                                                anchorEl={anchorElNav}
                                                anchorOrigin={{
                                                    vertical: 'bottom',
                                                    horizontal: 'left',
                                                }}
                                                keepMounted
                                                transformOrigin={{
                                                    vertical: 'top',
                                                    horizontal: 'left',
                                                }}
                                                open={!!anchorElNav}
                                                onClose={handleCloseNavMenu}
                                            >
                                                {pages.map(p => (
                                                    <MenuItem
                                                        key={p.target}
                                                        onClick={() => {
                                                            navigate(p.target);
                                                            handleCloseNavMenu();
                                                        }}
                                                    >
                                                        {p.title}
                                                    </MenuItem>
                                                ))}
                                                <MenuItem onClick={logout}>
                                                    Logout
                                                </MenuItem>
                                            </Menu>
                                        </Grid>
                                    ) : null}
                                </Grid>
                                {isMobile && (
                                    <Grid
                                        container
                                        item
                                        justifyContent="center"
                                    >
                                        <Typography
                                            sx={{ whiteSpace: 'nowrap' }}
                                            variant="h3"
                                        >
                                            SFO
                                        </Typography>
                                    </Grid>
                                )}
                                <Grid
                                    alignItems="center"
                                    container
                                    spacing={2}
                                    item
                                    justifyContent="flex-end"
                                >
                                    {user ? (
                                        <>
                                            <Grid item>
                                                <Typography>
                                                    Hello, {user.username}!
                                                </Typography>
                                            </Grid>
                                            {!isMobile && (
                                                <>
                                                    <Grid item>
                                                        <IconButton
                                                            onClick={() =>
                                                                navigate(
                                                                    '/settings'
                                                                )
                                                            }
                                                            sx={{
                                                                color: theme =>
                                                                    theme
                                                                        .palette
                                                                        .primary
                                                                        .contrastText,
                                                            }}
                                                        >
                                                            <Settings />
                                                        </IconButton>
                                                    </Grid>
                                                    <Grid item>
                                                        <IconButton
                                                            onClick={logout}
                                                            sx={{
                                                                color: theme =>
                                                                    theme
                                                                        .palette
                                                                        .primary
                                                                        .contrastText,
                                                            }}
                                                        >
                                                            <LogoutOutlined />
                                                        </IconButton>
                                                    </Grid>
                                                </>
                                            )}
                                        </>
                                    ) : (
                                        <Grid item>
                                            <MenuLink href="/login">
                                                Log In
                                            </MenuLink>
                                        </Grid>
                                    )}
                                </Grid>
                            </Grid>
                        </Grid>
                    </Toolbar>
                </Container>
            </AppBar>
            <Toolbar />
            {!isChrome && !isFirefox && (
                <Alert severity="warning">
                    For the best experience, please use Speech Features Online
                    with Chrome or Firefox.
                </Alert>
            )}
        </>
    );
};

export default Header;
