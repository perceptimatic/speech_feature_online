import React from 'react';
import { Typography } from '@mui/material';
import Modal from './Modal';

interface SuccessModalProps {
    handleClose: () => void;
    header?: string;
    message: string;
    open: boolean;
}

const SuccessModal: React.FC<SuccessModalProps> = ({
    handleClose,
    header,
    message,
    open,
}) => (
    <Modal open={open} handleClose={handleClose}>
        <Typography variant="h5" component="h2">
            Success!
        </Typography>
        {header && (
            <Typography variant="h6" component="h2">
                {header}
            </Typography>
        )}
        <Typography sx={{ mt: 2 }}>{message} </Typography>
    </Modal>
);

export default SuccessModal;
