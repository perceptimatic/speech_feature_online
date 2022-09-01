import React, { useContext, useEffect, useMemo, useState } from 'react';
import { Box, Grid, Link, Typography } from '@mui/material';
import { DoNotDisturbOn } from '@mui/icons-material';
import { GridColDef, DataGrid, GridSortModel } from '@mui/x-data-grid';
import { LoadingOverlay, Page } from '../Components';
import { useFetchUserJobs } from '../hooks';
import { Job, SubmittablePaginationMeta } from '../types';
import { UserContext } from './BasePage';

const formatDate = (date: string) => {
    const offset = new Date(date).getTimezoneOffset();
    const parsed = new Date(Date.parse(date) - offset * 60 * 1000);

    return `${parsed.toLocaleDateString()} ${parsed.toLocaleTimeString()}`;
};

const parseAmz = (ts: string) => {
    const y = ts.slice(0, 4);
    const m = ts.slice(4, 6);
    const d = ts.slice(6, 8);
    const h = ts.slice(9, 11);
    const min = ts.slice(11, 13);
    const s = ts.slice(13, 15);
    return new Date(`${y}-${m}-${d}T${h}:${min}:${s}`);
};

export const getIsExpired = (link: string) => {
    const ttlMatch = link.match(/X-Amz-Expires=(\d+)/);
    const createdMatch = link.match(/X-Amz-Date=([A-Za-z0-9]+)/);

    if (Array.isArray(ttlMatch) && Array.isArray(createdMatch)) {
        const ttl = +ttlMatch[1] * 1000;
        const created = parseAmz(createdMatch[1]);
        return Date.parse(created.toUTCString()) + ttl < Date.parse(Date());
    } else return false;
};

const JobListPage: React.FC = () => {
    const [query, setQuery] = useState<SubmittablePaginationMeta>({
        desc: true,
        per_page: 5,
        page: 1,
        sort: 'created',
    });

    const { user } = useContext(UserContext);

    const { jobs, getUserJobs, loading, meta } = useFetchUserJobs();

    const columns: GridColDef<Job>[] = useMemo(() => {
        return [
            {
                field: 'id',
                flex: 1,
                headerName: 'Job ID',
                maxWidth: 75,
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
                maxWidth: 100,
                sortable: false,
                valueGetter: ({ row }) => row.taskmeta?.status || 'PENDING',
            },
            {
                field: 'date_done',
                flex: 1,
                headerName: 'Completed At',
                sortable: false,
                valueGetter: ({ row }) =>
                    row.taskmeta?.date_done
                        ? formatDate(row.taskmeta.date_done)
                        : 'N/A',
            },
            {
                field: 'can_retry',
                flex: 1,
                headerName: 'Retry',
                maxWidth: 125,
                renderCell: ({ row }) =>
                    row.can_retry ? (
                        <Link href={`/${row.id}`}>Retry / Modify</Link>
                    ) : (
                        <DoNotDisturbOn />
                    ),
                sortable: false,
            },
            {
                field: 'result',
                flex: 1,
                headerName: 'Download Link',
                renderCell: ({ row }) =>
                    row.taskmeta?.result &&
                    typeof row.taskmeta.result === 'string' ? (
                        getIsExpired(row.taskmeta.result) ? (
                            'Expired'
                        ) : (
                            <Link href={row.taskmeta.result}>
                                <>{row.taskmeta?.result}</>
                            </Link>
                        )
                    ) : (
                        'Unavailable'
                    ),
                sortable: false,
            },
        ];
    }, []);

    useEffect(() => {
        if (user) {
            getUserJobs(user, query);
        }
    }, [getUserJobs, query, user]);

    const onSortModelChange = (model: GridSortModel) => {
        if (model[0]) {
            requery({
                sort: model[0].field,
                desc: model[0].sort === 'desc',
            });
        } else {
            requery({
                sort: undefined,
                desc: undefined,
            });
        }
    };

    const requery = (newQuery: SubmittablePaginationMeta) =>
        setQuery({ ...query, ...newQuery });

    return (
        <Page title="Job History">
            <Grid container spacing={2} direction="column">
                <Grid item>
                    {!!jobs && !!jobs.length && (
                        <Box sx={{ height: 500, width: '100%' }}>
                            <DataGrid
                                autoHeight
                                columns={columns}
                                disableColumnFilter
                                //note that mui pagination is 0-indexed but server is 1-indexed
                                onPageChange={p => requery({ page: p + 1 })}
                                onPageSizeChange={per_page =>
                                    requery({ per_page })
                                }
                                onSortModelChange={onSortModelChange}
                                page={meta?.page ? meta.page - 1 : 0}
                                paginationMode="server"
                                pageSize={meta?.per_page || 5}
                                rowCount={meta?.total || 1}
                                rows={jobs}
                                rowsPerPageOptions={[5, 10, 20, 30]}
                                sortModel={[
                                    {
                                        field: meta?.sort || query.sort!,
                                        sort: meta
                                            ? meta.desc
                                                ? 'desc'
                                                : 'asc'
                                            : 'desc',
                                    },
                                ]}
                                sortingMode="server"
                            />
                        </Box>
                    )}
                    {jobs && !jobs.length && (
                        <Typography color="error">No Jobs!</Typography>
                    )}
                </Grid>
            </Grid>
            <LoadingOverlay open={loading} />
        </Page>
    );
};

export default JobListPage;
