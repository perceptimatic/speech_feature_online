import { useCallback, useState } from 'react';
import { fetchCurrentUser } from '../api';
import { User } from '../types';

const useFetchCurrentUser = () => {
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [user, setUser] = useState<User>();

    const fetchUser = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const result = await fetchCurrentUser();
            const userModel = result.data;

            (userModel as User).isAdmin = !!userModel.roles.find(
                r => r.role === 'admin'
            );
            setUser(userModel as User);
        } catch (e) {
            console.error(e);
            setError(
                'There was an error processing your request, please try again later'
            );
        } finally {
            setLoading(false);
        }
    }, []);

    return { error, fetchUser, loading, user };
};

export default useFetchCurrentUser;
