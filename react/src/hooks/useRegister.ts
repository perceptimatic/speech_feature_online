import { useCallback, useState } from 'react';
import axios from 'axios';
import { register } from '../api';

const useRegister = () => {
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);

    const submitRegistration = useCallback(
        async (fields: {
            email: string;
            password: string;
            username: string;
        }) => {
            setLoading(true);
            setError('');
            try {
                await register(fields);
                setSuccess(true);
            } catch (e) {
                if (axios.isAxiosError(e) && e?.response?.status === 401) {
                    setError('Invalid credentials');
                } else if (
                    axios.isAxiosError(e) &&
                    e?.response?.status === 422 &&
                    e.response?.data.detail
                ) {
                    setError(e.response.data.detail);
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

    return { error, submitRegistration, loading, success };
};

export default useRegister;
