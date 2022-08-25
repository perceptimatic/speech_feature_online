import { useCallback, useState } from 'react';
import axios from 'axios';
import { resetPassword as _resetPassword } from '../api';

const useResetPassword = () => {
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);

    const resetPassword = useCallback(async (email: string) => {
        setLoading(true);
        setError('');
        try {
            await _resetPassword(email);
            setSuccess(true);
        } catch (e) {
            if (axios.isAxiosError(e) && e?.response?.status === 404) {
                setError('User not found!');
            } else {
                console.error(e);
                setError(
                    'There was an error processing your request, please try again later'
                );
            }
        } finally {
            setLoading(false);
        }
    }, []);

    return {
        error,
        resetPassword,
        loading,
        success,
        resetSuccess: () => setSuccess(false),
    };
};

export default useResetPassword;
