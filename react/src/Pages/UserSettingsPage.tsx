import React, { useContext, useEffect, useMemo, useState } from 'react';
import {
    Avatar,
    Card,
    CardContent,
    CardHeader,
    Grid,
    Typography,
    TextField,
    Button,
} from '@mui/material';
import { LoadingOverlay, Page, SuccessModal } from '../Components';
import { useUpdateUser } from '../hooks';
import { filterObject } from '../util';
import { UserContext } from './BasePage';

const UserSettingsPage: React.FC = () => {
    const { user, setUser } = useContext(UserContext);

    const [username, setUsername] = useState(user?.username);
    const [password, setPassword] = useState<string>('');
    const [successModalOpen, setSuccessModalOpen] = useState(false);

    const usernameError = useMemo(() => {
        if (!!username && (username.length < 5 || username.length > 25)) {
            return 'Username must be between 5 and 25 characters!';
        }
        return '';
    }, [username]);

    const passwordError = useMemo(() => {
        if (!!password && password.length < 7) {
            return 'Password must be at least 7 characters!';
        }
        return '';
    }, [password]);

    const { updateUser, loading, user: userResult } = useUpdateUser();

    useEffect(() => {
        if (userResult) {
            setUser(userResult);
            setSuccessModalOpen(true);
        }
    }, [userResult, setUser]);

    const submitForm = () => {
        const payload = filterObject({ username, password });
        updateUser(user!.id, payload);
    };

    const getSubmitDisabled = () =>
        !!usernameError || !!passwordError || (!username && !password);

    return (
        <Page title="User Settings">
            {user && (
                <Grid container justifyContent="center">
                    <Card>
                        <CardHeader>
                            <Avatar />
                        </CardHeader>
                        <CardContent>
                            <Grid
                                container
                                width="350px"
                                spacing={2}
                                item
                                direction="column"
                            >
                                <Grid item>
                                    <Typography variant="h5">
                                        Update your profile
                                    </Typography>
                                </Grid>
                                <Grid item>
                                    <TextField
                                        error={!!usernameError}
                                        fullWidth={true}
                                        helperText={
                                            !!usernameError && usernameError
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
                                        error={!!passwordError}
                                        fullWidth={true}
                                        helperText={
                                            !!passwordError && passwordError
                                        }
                                        label={'new password'}
                                        onChange={e =>
                                            setPassword(e.currentTarget.value)
                                        }
                                        type="password"
                                        value={password}
                                    />
                                </Grid>
                                <Grid item>
                                    <Button
                                        disabled={getSubmitDisabled()}
                                        onClick={submitForm}
                                        variant="outlined"
                                    >
                                        Submit
                                    </Button>
                                </Grid>
                            </Grid>
                        </CardContent>
                    </Card>
                </Grid>
            )}
            <LoadingOverlay open={loading} />
            <SuccessModal
                handleClose={() => setSuccessModalOpen(false)}
                message="Your information has been updated!"
                open={successModalOpen}
            />
        </Page>
    );
};

export default UserSettingsPage;
