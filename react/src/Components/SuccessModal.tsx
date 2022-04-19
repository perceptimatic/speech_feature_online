import React from 'react';
import { Modal, Typography } from '@mui/material';
import { Box } from '@mui/system';

const style = {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: 400,
    bgcolor: 'background.paper',
    border: '2px solid #000',
    boxShadow: 24,
    p: 4,
};

interface SuccessModalProps {
    handleClose: () => void;
    header: string;
    message: string;
    open: boolean;
}

const SuccessModal: React.FC<SuccessModalProps> = ({
    handleClose,
    header,
    message,
    open,
}) => (
    <Modal
        open={open}
        onClose={handleClose}
        aria-labelledby="modal-modal-title"
        aria-describedby="modal-modal-description"
    >
        <Box sx={style}>
            <Typography variant="h5" component="h2">
                Success!
            </Typography>
            <Typography variant="h6" component="h2">
                {header}
            </Typography>
            <Typography sx={{ mt: 2 }}>{message} </Typography>
        </Box>
    </Modal>
);

export default SuccessModal;
