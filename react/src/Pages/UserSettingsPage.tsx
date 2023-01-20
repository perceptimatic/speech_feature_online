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
    Tab,
    Tabs,
    Box,
} from '@mui/material';
import { Check } from '@mui/icons-material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { LoadingOverlay, Page, SuccessModal } from '../Components';
import { useFetchUsers, useResetPassword, useUpdateUser } from '../hooks';
import { filterObject } from '../util';
import { User } from '../types';
import { UserContext } from './BasePage';

const UserSettingsPage: React.FC = () => {
    const { user, setUser } = useContext(UserContext);
    const [selectedTab, setSelectedTab] = useState(0);

    return (
        <Page title="Settings">
            <Grid container direction="column">
                <Grid item container justifyContent="center">
                    <Tabs
                        value={selectedTab}
                        onChange={(e, v) => setSelectedTab(v)}
                    >
                        <Tab label="My Settings" />
                        {user && user.isAdmin && <Tab label="All Users" />}
                    </Tabs>
                </Grid>
            </Grid>
            {!!user && selectedTab === 0 && (
                <UserSettingsCard user={user} setUser={setUser} />
            )}
            {!!user && selectedTab === 1 && user.isAdmin && <AllUserTable />}
        </Page>
    );
};

interface UserSettingsCardProps {
    setUser: (user: User) => void;
    user: User;
}

const UserSettingsCard: React.FC<UserSettingsCardProps> = ({
    setUser,
    user,
}) => {
    const [username, setUsername] = useState(user.username);
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
        <>
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
            <LoadingOverlay open={loading} />
            <SuccessModal
                handleClose={() => setSuccessModalOpen(false)}
                message="Your information has been updated!"
                open={successModalOpen}
            />
        </>
    );
};

const AllUserTable: React.FC = () => {
    const { users, getUsers, loading: getUsersLoading } = useFetchUsers();

    const {
        loading: resetPasswordLoading,
        resetPassword,
        resetSuccess: resetResetPasswordState,
        success: resetPasswordSuccess,
    } = useResetPassword();

    const {
        loading: updateUserLoading,
        resetSuccess: resetUpdateUserState,
        success: updateUserSuccess,
        updateUser,
    } = useUpdateUser();

    useEffect(() => {
        if (!users) {
            getUsers();
        }
        /*eslint-disable-next-line react-hooks/exhaustive-deps  */
    }, []);

    const setUserActive = (user: User) => updateUser(user.id, { active: true });

    const resetUserPassword = (user: User) => resetPassword(user.email);

    const columns = useMemo(() => {
        return [
            {
                field: 'id',
                flex: 1,
                headerName: 'User ID',
                maxWidth: 75,
            },
            {
                field: 'username',
                flex: 1,
                headerName: 'Username',
                maxWidth: 200,
                valueGetter: ({ row }) => row.username,
            },
            {
                field: 'created',
                flex: 1,
                headerName: 'Creaed',
                maxWidth: 200,
                sortable: false,
                valueGetter: ({ row }) => row.created,
            },
            {
                field: 'active',
                flex: 1,
                headerName: 'Active',
                maxWidth: 150,
                sortable: false,
                renderCell: ({ row }) =>
                    row.active ? (
                        <Check />
                    ) : (
                        <Button onClick={() => setUserActive(row)}>
                            Activate
                        </Button>
                    ),
            },
            {
                field: 'email',
                flex: 1,
                headerName: 'Email',
                maxWidth: 200,
                sortable: false,
                valueGetter: ({ row }) => row.email,
            },
            {
                field: 'resetPassword',
                flex: 1,
                headerName: 'Reset Password',
                maxWidth: 200,
                sortable: false,
                renderCell: ({ row }) => {
                    return (
                        <Button onClick={() => resetUserPassword(row)}>
                            Reset
                        </Button>
                    );
                },
                valueGetter: ({ row }) => row.email,
            },
        ] as GridColDef<User>[];
        /*eslint-disable-next-line react-hooks/exhaustive-deps  */
    }, []);

    return (
        <Box sx={{ width: '100%' }}>
            {users && (
                <DataGrid
                    autoHeight
                    columns={columns}
                    disableColumnFilter
                    rows={users}
                />
            )}
            <LoadingOverlay
                open={
                    updateUserLoading || resetPasswordLoading || getUsersLoading
                }
            />
            <SuccessModal
                handleClose={() => resetResetPasswordState()}
                message="Password reset successfully!"
                open={resetPasswordSuccess}
            />
            <SuccessModal
                handleClose={() => {
                    getUsers();
                    resetUpdateUserState();
                }}
                message="User set to active!"
                open={updateUserSuccess}
            />
        </Box>
    );
};

export default UserSettingsPage;
