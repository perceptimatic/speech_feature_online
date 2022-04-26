import React from 'react';
import { Box, Button, Grid, Typography } from '@mui/material';
import Modal from './Modal';

interface PydanticErrMsg {
    loc: string[];
    msg: string;
    type: string;
}

interface SubmissionErrorModalProps {
    code?: number;
    detail?: PydanticErrMsg[];
    handleClose: () => void;
    open: boolean;
}

const resolveMessage = (code?: number) => {
    switch (code) {
        case 422:
            return 'Validation Error!';
        default:
            return '';
    }
};

const SubmissionErrorModal: React.FC<SubmissionErrorModalProps> = ({
    code,
    detail,
    handleClose,
    open,
}) => (
    <Modal open={open} handleClose={handleClose}>
        <>
            <Typography color="error" variant="h5" component="h2">
                {resolveMessage(code)}
            </Typography>
            <Typography variant="h6" component="h2">
                Job could not be submitted
            </Typography>

            <Box sx={{ mt: 2 }}>
                {code === 422 &&
                    (detail || []).map(d => (
                        <Typography key={d.msg}>{d.msg}</Typography>
                    ))}
            </Box>
            <Grid container flexWrap="nowrap" direction="row">
                <Grid item>
                    <Button onClick={handleClose}>Close</Button>
                </Grid>
            </Grid>
        </>
    </Modal>
);

export default SubmissionErrorModal;
