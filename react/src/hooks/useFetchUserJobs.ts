import { useCallback, useState } from 'react';
import { fetchUserJobs } from '../api';
import { Job, User } from '../types';

const useFetchUserJobs = () => {
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [jobs, setJobs] = useState<Job[]>();

    const getUserJobs = useCallback(async (user: User) => {
        setLoading(true);
        setError('');
        try {
            const result = await fetchUserJobs(user.id);
            setJobs(result.data);
        } catch (e) {
            console.error(e);
            setError(
                'There was an error processing your request, please try again later'
            );
        } finally {
            setLoading(false);
        }
    }, []);

    return { error, getUserJobs, jobs, loading };
};

export default useFetchUserJobs;
