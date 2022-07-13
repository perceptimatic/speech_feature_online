import { useCallback, useState } from 'react';
import axios from 'axios';
import { verifyRegistration } from '../api';

const useVerifyRegistration = () => {
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);

    const submitCode = useCallback(async (email: string, code: string) => {
        setLoading(true);
        setError('');
        try {
            const {
                data: { access_token },
            } = await verifyRegistration(email, code);
            localStorage.setItem('jwt', access_token);
            setSuccess(true);
        } catch (e) {
            if (axios.isAxiosError(e) && e?.response?.status === 403) {
                setError('Invalid code!');
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

    return { error, submitCode, loading, success };
};

export default useVerifyRegistration;
