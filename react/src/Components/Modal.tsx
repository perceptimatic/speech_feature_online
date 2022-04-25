import React from 'react';
import { Modal as MuiModal } from '@mui/material';
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
    open: boolean;
}

const Modal: React.FC<SuccessModalProps> = ({
    children,
    handleClose,
    open,
}) => (
    <MuiModal
        open={open}
        onClose={handleClose}
        aria-labelledby="modal-modal-title"
        aria-describedby="modal-modal-description"
    >
        <Box sx={style}>{children}</Box>
    </MuiModal>
);

export default Modal;
