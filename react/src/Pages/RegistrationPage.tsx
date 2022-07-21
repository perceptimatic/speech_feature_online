import React, { useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Button,
    Card,
    CardContent,
    CardHeader,
    Grid,
    TextField,
    Typography,
} from '@mui/material';
import {
    useFetchCurrentUser,
    useRegister,
    useVerifyRegistration,
} from '../hooks';
import { Page, VerifyRegistrationModal } from '../Components';
import { UserContext } from './BasePage';

const RegistrationPage: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [username, setUsername] = useState('');
    const [verificationModalOpen, setVerificationModalOpen] = useState(false);

    const { setUser } = useContext(UserContext);

    const {
        error: registrationError,
        loading: registrationLoading,
        submitRegistration,
        success: registrationSuccess,
    } = useRegister();

    const {
        error: userFetchError,
        fetchUser,
        loading: currentUserLoading,
        user,
    } = useFetchCurrentUser();

    const {
        error: verificationError,
        submitCode,
        loading: verficationLoading,
        success: verificationSuccess,
    } = useVerifyRegistration();

    const navigate = useNavigate();

    useEffect(() => {
        if (registrationSuccess) {
            setVerificationModalOpen(true);
        }
    }, [registrationSuccess]);

    useEffect(() => {
        if (verificationSuccess) {
            fetchUser();
        }
    }, [fetchUser, verificationSuccess]);

    useEffect(() => {
        if (user) {
            setUser(user);
            navigate('/');
        }
    }, [navigate, setUser, user]);

    const emailIsValid = () =>
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(email);

    const getError = () =>
        [registrationError, userFetchError, verificationError].filter(
            Boolean
        )[0];

    const getLoading = () =>
        [registrationLoading, currentUserLoading, verficationLoading].some(
            v => !!v
        );

    const getFormValid = () =>
        emailIsValid() && username.length >= 5 && password.length >= 5;

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
                            title="Register"
                        />
                        <CardContent>
                            <Grid
                                container
                                spacing={2}
                                direction="column"
                                alignItems="stretch"
                            >
                                <Grid item>
                                    <TextField
                                        error={username.length < 5}
                                        fullWidth
                                        helperText={
                                            username.length < 5 &&
                                            'Username must be at least 5 characters'
                                        }
                                        label={'username'}
                                        onChange={e =>
                                            setUsername(e.currentTarget.value)
                                        }
                                        value={username}
                                    />
                                </Grid>
                                <Grid item>
                                    <TextField
                                        error={!emailIsValid()}
                                        fullWidth
                                        helperText={
                                            !emailIsValid() &&
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
                                        error={password.length < 5}
                                        fullWidth
                                        helperText={
                                            password.length < 5 &&
                                            'Password must be at least 5 characters'
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
                                        disabled={!getFormValid()}
                                        onClick={submitRegistration.bind(null, {
                                            email,
                                            password,
                                            username,
                                        })}
                                        variant="outlined"
                                    >
                                        Submit
                                    </Button>
                                </Grid>
                            </Grid>
                            {!!getError() && (
                                <Typography color="error">
                                    {getError()}
                                </Typography>
                            )}
                            {getLoading() && (
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
            </Grid>
            <VerifyRegistrationModal
                closeModal={() => setVerificationModalOpen(false)}
                emailAddress={email}
                error={verificationError}
                open={verificationModalOpen}
                onSubmit={code => submitCode.bind(null, email)(code)}
            />
        </Page>
    );
};

export default RegistrationPage;
