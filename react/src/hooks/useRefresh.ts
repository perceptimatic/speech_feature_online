import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import jwtDecode from 'jwt-decode';
import { logout } from '../util';
import { refresh } from '../api';

const submitRefresh = async () => {
    try {
        const refreshToken = localStorage.getItem('refresh_token')!;
        const result = await refresh(refreshToken);
        const { access_token, refresh_token } = result.data;
        localStorage.setItem('access_token', access_token);
        localStorage.setItem('refresh_token', refresh_token);
    } catch (e) {
        if (axios.isAxiosError(e) && e?.response?.status === 401) {
            logout();
        } else {
            console.error(e);
        }
    }
};

/* This sets a timeout to refetch in the background, it should only be initialized once, as it will reset itself */
const useRefresh = () => {
    const [to, setTo] = useState<NodeJS.Timeout>();
    const [resetFlag, setResetFlag] = useState<string>();

    const handleRefresh = useCallback(() => {
        const access_token = localStorage.getItem('access_token');
        if (access_token) {
            const { exp } = jwtDecode<{ exp: number }>(access_token);
            const ttl = exp * 1000 - Date.now();
            setTo(
                setTimeout(
                    () =>
                        submitRefresh().then(() =>
                            setResetFlag(Math.random().toString(32).slice(3))
                        ),
                    ttl
                )
            );
        }
    }, []);

    useEffect(() => {
        if (resetFlag) {
            handleRefresh();
        }
    }, [resetFlag, handleRefresh]);

    useEffect(() => {
        return () => clearTimeout(to);
    }, [to]);

    return handleRefresh;
};

export default useRefresh;
