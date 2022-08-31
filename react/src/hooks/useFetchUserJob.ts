import { useCallback, useState } from 'react';
import { fetchUserJob } from '../api';
import { Job, User } from '../types';

const useFetchUserJob = () => {
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [job, setJob] = useState<Job>();

    const getUserJob = useCallback(async (user: User, jobId: number) => {
        setLoading(true);
        setError('');
        try {
            const result = await fetchUserJob(user.id, jobId);
            setJob(result.data);
        } catch (e) {
            console.error(e);
            setError(
                'There was an error processing your request, please try again later'
            );
        } finally {
            setLoading(false);
        }
    }, []);

    return { error, getUserJob, job, loading };
};

export default useFetchUserJob;
