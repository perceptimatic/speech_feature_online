import axios from 'axios';
import AWS from 'aws-sdk';
import { AwsCredentials } from 'aws-sdk/clients/gamelift';
import { Job, JobConfig, User } from './types';

const axiosClient = axios.create();

axiosClient.interceptors.request.use(config => {
    if (localStorage.getItem('jwt')) {
        config.headers = {
            ...config.headers,
            Authorization: `Bearer ${localStorage.getItem('jwt')}`,
        };
    }
    return config;
});

axiosClient.interceptors.response.use(
    response => response,
    error => {
        if (error?.response?.status === 401) {
            if (localStorage.getItem('jwt')) {
                localStorage.removeItem('jwt');
            }
            if (window.location.pathname !== '/login') {
                window.location.pathname = '/login';
            }
        }
        return Promise.reject(error);
    }
);

/**
 * @class ProgressIncrement
 * Exists mainly to smooth over some typescript quirks and provide a single API for ProgressEvent and AWS.S3.ManagedUpload.Progress,
 *    either of which may be emitted
 */
export class ProgressIncrement {
    key: string;
    loaded: number;
    total: number;
    constructor(key: string, loaded: number, total: number) {
        this.key = key;
        this.loaded = loaded;
        this.total = total;
    }

    getRemaining = () => Math.floor((this.loaded / this.total || 1) * 100);
}

/**
 * @class UploadError
 */
export class UploadError {
    error: any;
    file?: File;
    message: string;
    constructor(message: string, error: any, file?: File) {
        this.error = error;
        this.file = file;
        this.message = message;
    }
}

interface CredentialsOptions {
    accessKeyId: string;
    secretAccessKey: string;
    sessionToken?: string;
}

export const isUploadError = (arg: UploadError | any): arg is UploadError =>
    !!(arg as UploadError).error;

const getTempCredentials = async () => {
    let accessKeyId = '',
        secretAccessKey = '',
        sessionToken = '';
    try {
        const result = await axiosClient.get<{
            Credentials: AwsCredentials;
        }>('/api/temp-creds');
        accessKeyId = result.data.Credentials.AccessKeyId!;
        secretAccessKey = result.data.Credentials.SecretAccessKey!;
        sessionToken = result.data.Credentials.SessionToken!;
        return { accessKeyId, secretAccessKey, sessionToken };
    } catch (e) {
        return new UploadError('Error fetching Credentials!', e);
    }
};

const getS3 = (credentials: CredentialsOptions) =>
    new AWS.S3({
        region: process.env.AWS_DEFAULT_REGION!,
        apiVersion: 'latest',
        params: { Bucket: process.env.BUCKET_NAME! },
        credentials: {
            accessKeyId: credentials.accessKeyId,
            secretAccessKey: credentials.secretAccessKey,
            sessionToken: credentials.sessionToken,
        },
    });

interface UploadResponse {
    remoteFileName: string;
    originalFileName: string;
}

const postFilesToS3 = async (
    files: File[],
    progressCb: (progress: ProgressIncrement) => void
): Promise<(UploadResponse | UploadError)[]> => {
    const credentialResponse = await getTempCredentials();

    if (isUploadError(credentialResponse)) {
        return [credentialResponse];
    }

    const s3 = getS3(credentialResponse);

    /* assign a random prefix to prevent files existing with the same name */
    const prefix = Math.random().toString(36).slice(2);

    return Promise.all(
        files.map(f => {
            const request = s3.upload({
                Body: f,
                Bucket: process.env.BUCKET_NAME!,
                Key: `${prefix}/${f.name}`,
            });

            request.on('httpUploadProgress', p => {
                const inc = new ProgressIncrement(f.name, p.loaded, p.total);
                progressCb(inc);
            });

            return request.promise().then(
                d => ({
                    remoteFileName: d.Key,
                    originalFileName: f.name,
                }),
                err => new UploadError('Upload failed!', err, f)
            );
        })
    );
};

export const removeFileFromS3 = async (key: string) => {
    const credentialResponse = await getTempCredentials();
    if (isUploadError(credentialResponse)) {
        return credentialResponse;
    }

    const s3 = getS3(credentialResponse);

    return s3
        .deleteObject({
            Bucket: process.env.BUCKET_NAME!,
            Key: key,
        })
        .promise();
};

export const postFiles = (
    files: File[],
    progressCb: (progress: ProgressIncrement) => void
) => postFilesToS3(files, progressCb);

export const submitForm = (formData: JobConfig) => {
    return axiosClient.post('/api/shennong-job', formData);
};

export const login = async (creds: { email: string; password: string }) =>
    axiosClient.post<{ access_token: string }>('/api/token', creds);

export const register = async (info: {
    email: string;
    password: string;
    username: string;
}) => axiosClient.post<User>('/api/users', info);

export const fetchCurrentUser = async () =>
    axiosClient.get<User>('/api/users/current');

export const fetchUserJobs = async (userId: number) =>
    axiosClient.get<Job[]>(`/api/users/${userId}/tasks`);

export const verifyRegistration = async (
    email: string,
    verification_code: string
) =>
    axiosClient.post<{ access_token: string }>(
        `/api/users/${email}/verification_code`,
        {
            verification_code,
        }
    );
