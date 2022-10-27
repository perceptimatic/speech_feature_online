import { useContext, useEffect, useState } from 'react';
import { UserContext } from '../Pages/BasePage';
import { useFetchCurrentUser, useRefresh } from '.';

const useAuth = (role?: string) => {
    const [userAuthorized, setUserAuthorized] = useState<boolean>(true);
    const [initialized, setInitialized] = useState<boolean>(false);
    const { user: contextUser, setUser: setContextUser } =
        useContext(UserContext);
    const { fetchUser, loading, user } = useFetchCurrentUser();
    const scheduleRefresh = useRefresh();

    useEffect(() => {
        //order matters

        //prevent console errors and duplicate fetches between first and second tick
        if (!initialized) {
            setInitialized(true);
        }
        if (contextUser) {
            setUserAuthorized(
                role ? contextUser.roles.map(r => r.role).includes(role) : true
            );
            scheduleRefresh();
        } else if (user) {
            setContextUser(user);
        } else if (localStorage.getItem('access_token')) {
            //interceptor will clean up bad jwt
            fetchUser();
        } else {
            setUserAuthorized(false);
        }
        /* eslint-disable-next-line react-hooks/exhaustive-deps */
    }, [contextUser, fetchUser, user]);

    return { userAuthorized, loading: loading || !initialized };
};

export default useAuth;
