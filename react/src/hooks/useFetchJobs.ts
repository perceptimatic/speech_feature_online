import { useCallback, useState } from 'react';
import { fetchJobs } from '../api';
import { Job, PaginationMeta, SubmittablePaginationMeta } from '../types';

const useFetchJobs = () => {
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [jobs, setJobs] = useState<Job[]>();
    const [meta, setMeta] = useState<PaginationMeta>();

    const getJobs = useCallback(
        async (paginationMeta: SubmittablePaginationMeta = {}) => {
            setLoading(true);
            setError('');
            try {
                const result = await fetchJobs(paginationMeta);
                const { data: jobs, ...meta } = result.data;
                setJobs(jobs);
                setMeta(meta);
            } catch (e) {
                console.error(e);
                setError(
                    'There was an error processing your request, please try again later'
                );
            } finally {
                setLoading(false);
            }
        },
        []
    );

    return { error, getJobs, jobs, loading, meta };
};

export default useFetchJobs;
