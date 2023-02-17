import React, { useEffect, useState } from 'react';
import {
    Backdrop,
    Box,
    Divider,
    Grid,
    LinearProgress,
    Paper,
    Typography,
} from '@mui/material';

import { ProgressIncrement } from '../api';

const ProgressLoadingOverlay: React.FC<{ progress: ProgressIncrement }> = ({
    progress,
}) => {
    return (
        <Backdrop
            sx={{
                color: '#fff',
                zIndex: theme => theme.zIndex.drawer + 1,
            }}
            open={!!progress}
        >
            <Box
                sx={{
                    display: 'flex',
                    width: '50%',
                }}
            >
                <Paper
                    sx={{
                        width: '100%',
                        padding: 3,
                        flexWrap: 'nowrap',
                        maxHeight: '350px',
                        overflowY: 'auto',
                    }}
                >
                    <Typography variant="h4">Upload in Progress</Typography>
                    <Divider />
                    <UploadProgressIndicator progress={progress} />
                </Paper>
            </Box>
        </Backdrop>
    );
};

/* parent component that maintains map of current uploads */
interface UploadProgressProps {
    progress: ProgressIncrement;
}

const UploadProgressIndicator: React.FC<UploadProgressProps> = ({
    progress,
}) => {
    const [progressMap, setProgressMap] = useState<
        Record<string, ProgressIncrement>
    >({});

    useEffect(() => {
        if (
            !progressMap[progress.key] ||
            progressMap[progress.key].loaded < progress.loaded
        ) {
            progressMap[progress.key] = progress;
            setProgressMap(progressMap);
        }
        /*eslint-disable-next-line react-hooks/exhaustive-deps*/
    }, [progress]);

    return (
        <Grid container direction="column">
            {Object.entries(progressMap).map(([k, v], i) => (
                <Grid container direction="row" key={k} item>
                    <UploadProgressBar progress={v} index={i} />
                </Grid>
            ))}
        </Grid>
    );
};

interface UploadProgressBarProps {
    index: number;
    progress: ProgressIncrement;
}

const UploadProgressBar: React.FC<UploadProgressBarProps> = ({
    index,
    progress,
}) => {
    return (
        <Grid
            container
            wrap="nowrap"
            direction="row"
            flexGrow={1}
            alignItems="center"
        >
            <Grid item xs={6} md={4}>
                <Typography variant="caption">{`${progress.key} (${index})`}</Typography>
                :
            </Grid>
            <Grid item xs={3} md={8}>
                <LinearProgress
                    variant="determinate"
                    value={progress.getRemaining()}
                />
            </Grid>
        </Grid>
    );
};

export default ProgressLoadingOverlay;
