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
                Click Next to select your processors, or click More to continue
                uploading files
            </Typography>
            <Grid container flexWrap="nowrap" direction="row">
                <Grid item>
                    <Button onClick={onDone}>Done</Button>
                </Grid>
                <Grid>
                    <Button onClick={onStay}>Continue Uploading</Button>
                </Grid>
            </Grid>
        </>
    </Modal>
);

export default UploadSuccessModal;
