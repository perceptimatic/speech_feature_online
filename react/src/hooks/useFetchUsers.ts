import { useCallback, useState } from 'react';
import { fetchUsers } from '../api';
import { User } from '../types';

const useFetchUsers = () => {
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [users, setUsers] = useState<User[]>();

    const getUsers = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const result = await fetchUsers();
            const { data: users } = result;
            setUsers(users);
        } catch (e) {
            console.error(e);
            setError(
                'There was an error processing your request, please try again later'
            );
        } finally {
            setLoading(false);
        }
    }, []);

    return { error, getUsers, users, loading };
};

export default useFetchUsers;
