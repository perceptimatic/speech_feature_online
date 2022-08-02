import React from 'react';
import { Typography } from '@mui/material';
import Modal from './Modal';

interface FailureModalProps {
    handleClose: () => void;
    header: string;
    message: string;
    open: boolean;
}

const FailureModal: React.FC<FailureModalProps> = ({
    handleClose,
    header,
    message,
    open,
}) => (
    <Modal open={open} handleClose={handleClose}>
        <Typography color="error" variant="h5" component="h2">
            Warning!
        </Typography>
        <Typography variant="h6" component="h2">
            {header}
        </Typography>
        <Typography sx={{ mt: 2 }}>{message} </Typography>
    </Modal>
);

export default FailureModal;
