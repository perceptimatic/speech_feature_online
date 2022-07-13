import React, { useState } from 'react';
import { Button, Grid, Link, TextField, Typography } from '@mui/material';
import Modal from './Modal';

interface VerifyRegistrationModalProps {
    closeModal: () => void;
    emailAddress: string;
    error?: string;
    onSubmit: (code: string) => void;
    open: boolean;
}

const VerifyRegistrationModal: React.FC<VerifyRegistrationModalProps> = ({
    closeModal,
    emailAddress,
    error,
    onSubmit,
    open,
}) => {
    const [code, setCode] = useState('');

    return (
        /* user can close only by clicking the cancel button */
        <Modal open={open} handleClose={() => false}>
            <Grid container direction="column" spacing={2}>
                <Grid item>
                    <Typography variant="h5" component="h2">
                        Check your email!
                    </Typography>
                </Grid>
                <Grid item>
                    <Typography variant="h6" component="h2">
                        An email has been sent to {emailAddress}. Open the email
                        to retrieve your validation code and enter it into the
                        box below to complete your registration.
                    </Typography>
                </Grid>
                <Grid
                    container
                    direction="row"
                    item
                    justifyContent="space-between"
                    spacing={2}
                >
                    <Grid
                        container
                        alignItems="center"
                        item
                        direction="row"
                        spacing={1}
                    >
                        <Grid item>
                            <TextField
                                error={code.length !== 6}
                                helperText={
                                    code.length !== 6 &&
                                    'Code must be six characters long.'
                                }
                                label="Validation code"
                                onChange={e => setCode(e.currentTarget.value)}
                                value={code}
                            />
                        </Grid>
                        <Grid item>
                            <Button
                                disabled={code.length !== 6}
                                onClick={() => onSubmit(code)}
                                variant="outlined"
                            >
                                Submit
                            </Button>
                        </Grid>
                    </Grid>
                    {error && (
                        <Grid container item>
                            <Typography color="error">{error}</Typography>
                        </Grid>
                    )}
                    <Grid container item>
                        <Link onClick={() => closeModal()}>
                            Cancel Registration
                        </Link>
                    </Grid>
                </Grid>
            </Grid>
        </Modal>
    );
};

export default VerifyRegistrationModal;
