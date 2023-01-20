import { useCallback, useState } from 'react';
import { fetchUserJobs } from '../api';
import { Job, PaginationMeta, SubmittablePaginationMeta, User } from '../types';

const useFetchUserJobs = () => {
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [jobs, setJobs] = useState<Job[]>();
    const [meta, setMeta] = useState<PaginationMeta>();

    const getUserJobs = useCallback(
        async (user: User, paginationMeta: SubmittablePaginationMeta = {}) => {
            setLoading(true);
            setError('');
            try {
                const result = await fetchUserJobs(user.id, paginationMeta);
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

    return { error, getUserJobs, jobs, loading, meta };
};

export default useFetchUserJobs;
