import axios from 'axios';
import AWS from 'aws-sdk';
import { AwsCredentials } from 'aws-sdk/clients/gamelift';
import { JobConfig } from './types';

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

    getRemaining = () =>
        Math.floor((this.loaded / this.total || Infinity) * 100);
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

const getS3KeyBaseName = (path: string) => {
    let key = path;

    try {
        key = path.split('/')[1];
        //eslint-disable-next-line no-empty
    } catch (e) {}

    return key;
};

export const isUploadError = (arg: UploadError | any): arg is UploadError =>
    !!(arg as UploadError).error;

const getTempCredentials = async () => {
    let accessKeyId = '',
        secretAccessKey = '',
        sessionToken = '';
    try {
        const result = await axios.get<{
            Credentials: AwsCredentials;
        }>(process.env.REACT_TMP_CRED_ENDPOINT!);
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

    return Promise.all(
        files.map(f => {
            const ret = s3.upload({
                Body: f,
                Bucket: process.env.BUCKET_NAME!,
                Key: f.name,
            });

            ret.on('httpUploadProgress', p => {
                const inc = new ProgressIncrement(f.name, p.loaded, p.total);
                progressCb(inc);
            });

            return ret.promise().then(
                d => {
                    return {
                        remoteFileName: d.Key,
                        originalFileName: f.name,
                    };
                },
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
            Key: getS3KeyBaseName(key),
        })
        .promise();
};

const postFilesToLocalServer = (files: File[]) =>
    Promise.all(
        files.map(f => {
            const upload = new FormData();
            upload.append('upload', f);
            return axios
                .post<{ contentUrl: string }>(
                    process.env.REACT_UPLOAD_ENDPOINT!,
                    upload
                )
                .then(r => ({
                    remoteFileName: r.data.contentUrl,
                    originalFileName: f.name,
                }));
        })
    );

const resolveUploadMethod = (
    files: File[],
    progressCb?: (progress: ProgressIncrement) => void
) => {
    if (process.env.STORAGE_DRIVER == 's3' && progressCb) {
        return postFilesToS3(files, progressCb);
    } else {
        return postFilesToLocalServer(files);
    }
};

export const postFiles = (
    files: File[],
    progressCb?: (progress: ProgressIncrement) => void
) => resolveUploadMethod(files, progressCb);

export const submitForm = (formData: JobConfig) => {
    return axios.post('/api/shennong-job', formData);
};
