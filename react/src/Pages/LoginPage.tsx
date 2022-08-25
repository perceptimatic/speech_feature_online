import React, { useContext, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
    Button,
    Card,
    CardContent,
    CardHeader,
    Grid,
    TextField,
    Typography,
} from '@mui/material';
import { useFetchCurrentUser, useLogin, useResetPassword } from '../hooks';
import { Page, SuccessModal } from '../Components';
import { UserContext } from './BasePage';

const LoginPage: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const userContext = useContext(UserContext);

    const { error, loading, submitLogin, success } = useLogin();

    const {
        error: resetPasswordError,
        resetPassword,
        resetSuccess: resetResetPasswordSuccess,
        success: resetPasswordSuccess,
    } = useResetPassword();

    const navigate = useNavigate();

    const { fetchUser, user } = useFetchCurrentUser();

    useEffect(() => {
        if (success) {
            fetchUser();
        }
    }, [fetchUser, success]);

    useEffect(() => {
        if (user) {
            userContext.setUser(user);
            navigate('/');
        }
    }, [navigate, user, userContext]);

    const emailIsValid = () =>
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(email);

    return (
        <Page>
            <Grid container spacing={4} direction="column">
                <Grid
                    container
                    item
                    xs={12}
                    flexGrow={1}
                    direction="row"
                    justifyContent="center"
                >
                    <Card sx={{ width: '400px' }} raised>
                        <CardHeader
                            sx={{
                                backgroundColor: 'primary.light',
                                color: 'primary.contrastText',
                                textAlign: 'center',
                            }}
                            title="Log In"
                        />
                        <CardContent>
                            <Grid
                                container
                                spacing={2}
                                direction="column"
                                alignItems="center"
                            >
                                <Grid item>
                                    <TextField
                                        error={!emailIsValid()}
                                        helperText={
                                            !emailIsValid &&
                                            'Please enter a valid email'
                                        }
                                        label={'email'}
                                        onChange={e =>
                                            setEmail(e.currentTarget.value)
                                        }
                                        value={email}
                                    />
                                </Grid>
                                <Grid item>
                                    <TextField
                                        error={!password}
                                        helperText={
                                            !password &&
                                            'Please enter a password'
                                        }
                                        label={'password'}
                                        onChange={e =>
                                            setPassword(e.currentTarget.value)
                                        }
                                        type="password"
                                        value={password}
                                    />
                                </Grid>
                                <Grid item container justifyContent="center">
                                    <Button
                                        disabled={!password || !emailIsValid()}
                                        onClick={submitLogin.bind(null, {
                                            email,
                                            password,
                                        })}
                                        variant="outlined"
                                    >
                                        Submit
                                    </Button>
                                </Grid>
                            </Grid>
                            {!!error && (
                                <Typography color="error">{error}</Typography>
                            )}
                            {loading && (
                                <Typography
                                    alignContent="center"
                                    color="primary"
                                >
                                    Loading!
                                </Typography>
                            )}
                        </CardContent>
                    </Card>
                </Grid>
                <Grid container justifyContent="center" item>
                    <Link to="/register">Register</Link>
                </Grid>
                <Grid container direction="column" alignItems="center" item>
                    <Grid item>
                        <Button
                            disabled={!emailIsValid()}
                            disableElevation={true}
                            onClick={() => resetPassword(email)}
                            variant="text"
                        >
                            Reset password
                        </Button>
                    </Grid>
                    {!!resetPasswordError && (
                        <Grid item>
                            <Typography color="error">
                                {resetPasswordError}
                            </Typography>
                        </Grid>
                    )}
                </Grid>
            </Grid>
            <SuccessModal
                handleClose={resetResetPasswordSuccess}
                header="Password reset!"
                message="Check your email for your new password"
                open={resetPasswordSuccess}
            />
        </Page>
    );
};

export default LoginPage;
