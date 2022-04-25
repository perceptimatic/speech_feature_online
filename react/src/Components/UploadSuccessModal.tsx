import React from 'react';
import { Button, Grid, Typography } from '@mui/material';
import Modal from './Modal';

interface UploadSuccessModalProps {
    handleClose: () => void;
    onDone: () => void;
    onStay: () => void;
    open: boolean;
}

const UploadSuccessModal: React.FC<UploadSuccessModalProps> = ({
    handleClose,
    onDone,
    onStay,
    open,
}) => (
    <Modal open={open} handleClose={handleClose}>
        <>
            <Typography variant="h5" component="h2">
                Success!
            </Typography>
            <Typography variant="h6" component="h2">
                File Uploaded Successfully
            </Typography>
            <Typography sx={{ mt: 2 }}>
                Click Done to select your processors, or select Continue to
                upload more files.
            </Typography>
            <Grid container flexWrap="nowrap" direction="row">
                <Grid item>
                    <Button onClick={onDone}>Done</Button>
                </Grid>
                <Grid>
                    <Button onClick={onStay}>Continue</Button>
                </Grid>
            </Grid>
        </>
    </Modal>
);

export default UploadSuccessModal;
