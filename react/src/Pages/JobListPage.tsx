import React, { useContext, useEffect, useMemo } from 'react';
import { Box, Grid, Link, Typography } from '@mui/material';
import { GridColDef, DataGrid } from '@mui/x-data-grid';
import { Page } from '../Components';
import { useFetchUserJobs } from '../hooks';
import { Job } from '../types';
import { UserContext } from './HomePage';

const formatDate = (date: string) => {
    const offset = new Date(date).getTimezoneOffset();
    const parsed = new Date(Date.parse(date) - offset * 60 * 1000);

    return `${parsed.toLocaleDateString()} ${parsed.toLocaleTimeString()}`;
};

const JobListPage: React.FC = () => {
    const { user } = useContext(UserContext);

    const { jobs: _jobs, getUserJobs } = useFetchUserJobs();

    const jobs = useMemo(() => {
        if (_jobs) {
            return _jobs.sort((a, b) => (a.created > b.created ? -1 : 1));
        }
    }, [_jobs]);

    const columns: GridColDef<Job>[] = useMemo(() => {
        return [
            {
                field: 'id',
                flex: 1,
                headerName: 'Job ID',
            },
            {
                field: 'created',
                flex: 1,
                headerName: 'Created Date',
                valueGetter: ({ row }) => formatDate(row.created),
            },
            {
                field: 'status',
                flex: 1,
                headerName: 'Status',
                valueGetter: ({ row }) => row.task_info?.status || 'PENDING',
            },
            {
                field: 'date_done',
                flex: 1,
                headerName: 'Completed At',
                valueGetter: ({ row }) =>
                    row.task_info?.date_done
                        ? formatDate(row.task_info.date_done)
                        : 'N/A',
            },
            {
                field: 'result',
                flex: 1,
                headerName: 'Download Link',
                renderCell: ({ row }) =>
                    row.task_info?.result &&
                    typeof row.task_info.result === 'string' ? (
                        <Link href={row.task_info.result}>
                            <>{row.task_info?.result}</>
                        </Link>
                    ) : (
                        'Unavailable'
                    ),
            },
        ];
    }, []);

    useEffect(() => {
        if (user) {
            getUserJobs(user);
        }
    }, [user, getUserJobs]);

    return (
        <Page>
            <Grid container spacing={2} direction="column">
                <Grid item>
                    <Typography align="center" variant="h3">
                        Job History
                    </Typography>
                </Grid>
                <Grid item>
                    {jobs && jobs.length ? (
                        <Box sx={{ height: 500, width: '100%' }}>
                            <DataGrid rows={jobs} columns={columns} />
                        </Box>
                    ) : (
                        <Typography color="error">No Jobs!</Typography>
                    )}
                </Grid>
            </Grid>
        </Page>
    );
};

export default JobListPage;
