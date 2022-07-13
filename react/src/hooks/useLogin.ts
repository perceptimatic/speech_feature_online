import { useCallback, useState } from 'react';
import axios from 'axios';
import { login } from '../api';

const useLogin = () => {
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);

    const submitLogin = useCallback(
        async (creds: { email: string; password: string }) => {
            setLoading(true);
            setError('');
            try {
                const result = await login(creds);
                localStorage.setItem('jwt', result.data.access_token);
                setSuccess(true);
            } catch (e) {
                if (axios.isAxiosError(e) && e?.response?.status === 401) {
                    setError('Invalid credentials');
                } else {
                    console.error(e);
                    setError(
                        'There was an error processing your request, please try again later'
                    );
                }
            } finally {
                setLoading(false);
            }
        },
        []
    );

    return { error, submitLogin, loading, success };
};

export default useLogin;
