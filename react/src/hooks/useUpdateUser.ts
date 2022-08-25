import { useCallback, useState } from 'react';
import { updateUser as _updateUser } from '../api';
import { UpdatableUser, User } from '../types';

const useUpdateUser = () => {
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [user, setUser] = useState<User>();

    const updateUser = useCallback(
        async (userId: number, payload: Partial<UpdatableUser>) => {
            setLoading(true);
            setError('');
            try {
                const result = await _updateUser(userId, payload);
                setUser(result.data);
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

    return { error, updateUser, user, loading };
};

export default useUpdateUser;
