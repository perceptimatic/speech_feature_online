import React, { useContext, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AxiosError } from 'axios';
import {
    Box,
    Button,
    Grid,
    List,
    ListItem,
    ListItemButton,
    ListItemIcon,
    ListItemText,
    Step,
    StepContent,
    Stepper,
    StepLabel,
    Typography,
    Divider,
    capitalize,
    styled,
    Fade,
    Checkbox,
} from '@mui/material';
import { Delete } from '@mui/icons-material';
import {
    analysisDisplayFields,
    argumentDisplayFields,
    getEntries,
    getKeys,
    globalDisplayFields,
    postProcessorDisplayFields,
    ProcessingGroup,
    useFormReducer,
} from '../Components/JobForm';
import {
    isUploadError,
    postFiles,
    ProgressIncrement,
    submitForm,
} from '../api';
import {
    FailureModal,
    JobFormField,
    LoadingOverlay,
    Page,
    ProgressLoadingOverlay,
    SubmissionErrorModal,
    SuccessModal,
    UploadSuccessModal,
} from '../Components';
import {
    AnalysisConfig,
    AnalysisFormGroup,
    CommonSchema,
    JobConfig,
    SubmittableJobConfig,
    UploadResponse,
} from '../types';
import { useFetchUserJob } from '../hooks';
import { UserContext } from './BasePage';

enum FailureType {
    FILE_TOO_LARGE = 'The file exceeds 50MB maximum size. Please compress or split your samples into smaller files.',
    FILES_TOO_LARGE = 'The total file size of your jobs exceeds the 1GB maximum size. Please compress or split your samples into separate jobs.',
    UPLOAD_FAILURE = 'The file failed to upload. Please check your connection and try again.',
}

interface UploadFailure {
    file: File;
    reason: FailureType;
}

const FormPage: React.FC = () => {
    const { user } = useContext(UserContext);

    const [activeStep, setActiveStep] = useState(1);
    const [failedFiles, setFailedFiles] = useState<UploadFailure[]>([]);
    const [invalidFields, setInvalidFields] = useState<string[]>();
    const [progress, setProgress] = useState<ProgressIncrement>();
    const [schema, setSchema] = useState<AnalysisFormGroup[]>();
    const [state, dispatch] = useFormReducer(user!.email);
    const [submissionSuccess, setSubmissionSuccess] = useState(false);
    const [submissionError, setSubmissionError] = useState<AxiosError>();
    const [uploadHasFailures, setUploadHasFailures] = useState(false);
    const [uploadSuccess, setUploadSuccess] = useState(false);

    useEffect(() => {
        const cb = async () => {
            const res = await fetch(`/static/processor-schema.json`);
            const schema: CommonSchema = await res.json();
            const fg = getEntries(schema.processors).map<AnalysisFormGroup>(
                ([k, v]) => ({
                    analysis: {
                        ...analysisDisplayFields[k],
                        name: k,
                        type: 'boolean',
                        default: false,
                        required: false,
                    },
                    init_args: v.init_args.map(iArg => ({
                        ...argumentDisplayFields[iArg.name],
                        ...iArg,
                    })),
                    postprocessors: v.valid_postprocessors.map(k => ({
                        ...postProcessorDisplayFields[k],
                        component: 'checkbox',
                        default: false,
                        name: k,
                        required: false,
                        type: 'boolean',
                    })),
                    required_postprocessors: v.required_postprocessors,
                })
            );
            setSchema(fg);
        };

        cb();
    }, []);

    const { jobId } = useParams<{ jobId: string }>();

    const { getUserJob, loading, job } = useFetchUserJob();

    useEffect(() => {
        if (jobId && user) {
            getUserJob(user, +jobId);
        }
    }, [jobId, user, getUserJob]);

    useEffect(() => {
        if (job && jobId) {
            if (job.can_retry && job.taskmeta?.kwargs) {
                const { config } = job.taskmeta.kwargs;
                dispatch({
                    type: 'update',
                    payload: {
                        analyses: config.analyses,
                        channel: config.channel,
                        files: config.files.map(f => ({
                            remoteFileName: f,
                            originalFile: {
                                name: f.split(/[\\/]/).pop()!,
                                size: 0,
                            },
                        })),
                        res: config.res,
                    },
                });
            }
        }
    }, [dispatch, job, jobId]);

    useEffect(() => {
        const invalid: string[] = [];

        globalDisplayFields.forEach(k => {
            if (
                globalDisplayFields.find(n => n.name === k.name)!.required &&
                !state[k.name as keyof JobConfig]
            ) {
                invalid.push(k.name);
            }
        });

        if (state.analyses) {
            getKeys(state.analyses).forEach(k => {
                const analysis = schema?.find(g => k === g.analysis.name);
                analysis?.init_args.forEach(f => {
                    if (
                        f.required &&
                        !!state.analyses &&
                        state.analyses[k] === undefined
                    ) {
                        invalid.push(`${k}.${f}`);
                    }
                });
            });
        }

        if (!state.files) {
            invalid.push('files');
        }

        setInvalidFields(invalid);
    }, [state, schema]);

    const resetForm = () =>
        dispatch({
            type: 'clear',
        });

    const update = (
        k: string,
        v: string | string[] | number | boolean | UploadResponse[]
    ) =>
        dispatch({
            type: 'update',
            payload: { [k]: v },
        });

    const updateAnalysis = (
        processorName: string,
        slice: Partial<AnalysisConfig>
    ) => {
        dispatch({
            type: 'update',
            payload: {
                ...state,
                analyses: {
                    ...state.analyses,
                    [processorName]: {
                        ...state.analyses[processorName],
                        ...slice,
                    },
                },
            },
        });
    };

    const addAnalysis = (key: string) => {
        const schemaEntry = schema!.find(d => d.analysis.name === key)!;

        const newAnalysis = {
            init_args: schemaEntry.init_args.reduce<Record<string, any>>(
                (acc, curr) => ({
                    ...acc,
                    [curr.name]: curr.default,
                }),
                {}
            ),
            postprocessors: schemaEntry.required_postprocessors,
        };

        dispatch({
            type: 'update',
            payload: {
                ...state,
                analyses: {
                    ...state.analyses,
                    [key]: newAnalysis,
                },
            },
        });
    };

    const removeAnalysis = (k: string) => {
        const analyses = {} as Record<string, any>;

        for (const analysis in state.analyses!) {
            if (analysis !== k) {
                analyses[k] = state.analyses[analysis];
            }
        }

        dispatch({
            type: 'update',
            payload: {
                ...state,
                analyses,
            },
        });
    };

    const uploadFiles = async (files: File[], uploaded: UploadResponse[]) => {
        const totalUploaded = uploaded.reduce(
            (acc, curr) => acc + curr.originalFile.size,
            0
        );
        let failures = failedFiles.slice();
        let SUCCESS = true;
        const existingNames = uploaded.map(f => f.originalFile.name);

        const _files = files
            /* ensure no file is bigger than 50MB */
            .filter(f => {
                let passes = true;
                if (f.size > 50 * 2 ** 20) {
                    //50MB
                    passes = false;
                    SUCCESS = false;
                    failures.push({
                        file: f,
                        reason: FailureType.FILE_TOO_LARGE,
                    });
                }
                return passes;
            })
            /* remove duplicate files */
            .filter(file => !existingNames.includes(file.name))
            /* ensure total is less than 1 GB */
            .reduce<[File[], number]>(
                (acc, curr) => {
                    acc[1] += curr.size;
                    if (acc[1] > 2 ** 30) {
                        SUCCESS = false;
                        failures.push({
                            file: curr,
                            reason: FailureType.FILES_TOO_LARGE,
                        });
                    } else {
                        acc[0].push(curr);
                    }
                    return acc;
                },
                [[], totalUploaded]
            )[0];

        return postFiles(_files, setProgress)
            .then(r => {
                const files = r
                    .map(res => {
                        if (!isUploadError(res)) {
                            // remove from failed list (if applicable)
                            failures = failures.filter(
                                f => f.file.name !== res.originalFile.name
                            );
                            return res;
                        } else if (isUploadError(res)) {
                            SUCCESS = false;
                            if (
                                res.file &&
                                !failures.map(f => f.file).includes(res.file)
                            ) {
                                failures.push({
                                    file: res.file,
                                    reason: FailureType.UPLOAD_FAILURE,
                                });
                            }
                        }
                    })
                    .filter(Boolean) as UploadResponse[];
                //add to job payload
                update('files', state.files.concat(files));
                return SUCCESS;
            })
            .finally(() => {
                setFailedFiles(failures);
                setProgress(undefined);
            });
    };

    const setUploadStatus = (success: boolean) =>
        success ? setUploadSuccess(true) : setUploadHasFailures(true);

    const getAtLeastOneFeatureSelected = () => !!getKeys(state.analyses).length;

    const submitJob = () => {
        const submittable = {} as SubmittableJobConfig;

        getKeys(state).forEach(k => {
            if (k === 'files') {
                submittable.files = state[k].map(f => f.remoteFileName);
            } else if (k === 'analyses') {
                //type narrowing....
                submittable[k] = state[k];
            } else {
                submittable[k] = state[k];
            }
        });

        submitForm(submittable)
            .then(() => setSubmissionSuccess(true))
            .catch((e: AxiosError) => setSubmissionError(e));
    };

    return (
        <Page title="Run an Analysis">
            <Grid container direction="column" alignItems="flex-start">
                <Grid item>
                    <Typography>
                        Use the controls below to upload an audio file to be
                        processed by the Shennong software. The results will be
                        sent to the email address associated with your user
                        account.
                    </Typography>
                    <Typography variant="caption">
                        For best results, begin with small jobs, adjusting
                        parameters as necessary after inspecting results. You
                        can rerun jobs with new parameters and/or files by
                        choosing the "Retry/Modify" option on the{' '}
                        <Link to="/jobs">Job History page</Link>.
                    </Typography>
                </Grid>
                <Grid container item direction="row">
                    <Divider
                        variant="middle"
                        sx={{ margin: 3, width: '100%' }}
                    />
                </Grid>
                <Grid item container direction="row">
                    <Grid item container md={4} direction="column">
                        <Stepper orientation="vertical" activeStep={activeStep}>
                            <Step
                                active={activeStep === 1}
                                completed={!!state.files.length}
                                sx={{ cursor: 'pointer' }}
                            >
                                <StyledStepLabel
                                    onClick={() => setActiveStep(1)}
                                >
                                    Select Files
                                </StyledStepLabel>
                                <StepContent>
                                    <Typography variant="caption">
                                        Use the button to upload the audio files
                                        you'd like processed.
                                    </Typography>
                                </StepContent>
                            </Step>
                            <Step
                                active={activeStep === 2}
                                completed={getAtLeastOneFeatureSelected()}
                                sx={{ cursor: 'pointer' }}
                            >
                                <StyledStepLabel
                                    onClick={() => setActiveStep(2)}
                                >
                                    Select Processors
                                </StyledStepLabel>
                                <StepContent>
                                    <Typography variant="caption">
                                        Configure your job by selecting
                                        processors, post-processors, and
                                        options.
                                    </Typography>
                                </StepContent>
                            </Step>
                            <Step
                                active={activeStep === 3}
                                completed={!!submissionSuccess}
                                sx={{ cursor: 'pointer' }}
                            >
                                <StyledStepLabel
                                    onClick={() => setActiveStep(3)}
                                >
                                    Review and Submit
                                </StyledStepLabel>
                                <StepContent>
                                    <Typography variant="caption">
                                        Review your job and submit for
                                        processing.
                                    </Typography>
                                </StepContent>
                            </Step>
                        </Stepper>
                    </Grid>

                    <Grid
                        md={8}
                        item
                        container
                        alignItems="flex-start"
                        direction="column"
                    >
                        <>
                            <FadeInStep active={activeStep === 1}>
                                <Grid
                                    alignItems="flex-start"
                                    container
                                    direction="column"
                                    item
                                    spacing={2}
                                >
                                    <Grid
                                        alignItems="center"
                                        container
                                        direction="row"
                                        item
                                        spacing={2}
                                    >
                                        <Grid item>
                                            <Button
                                                variant="contained"
                                                component="label"
                                            >
                                                Add files
                                                <input
                                                    accept=".mp3,.wav,.ogg,.flac"
                                                    type="file"
                                                    hidden
                                                    multiple
                                                    onChange={e => {
                                                        if (
                                                            e.currentTarget
                                                                .files
                                                        ) {
                                                            uploadFiles(
                                                                Array.from(
                                                                    e
                                                                        .currentTarget
                                                                        .files
                                                                ),
                                                                state.files
                                                            ).then(
                                                                setUploadStatus
                                                            );
                                                        }
                                                    }}
                                                />
                                            </Button>
                                        </Grid>
                                        <Grid item>
                                            <Typography variant="caption">
                                                For best results, mono .wav
                                                files are recommended
                                            </Typography>
                                        </Grid>
                                    </Grid>
                                    <Grid item>
                                        <Divider />
                                    </Grid>
                                    <Grid item container>
                                        <UploadStatusBox
                                            failedUploads={failedFiles}
                                            removeFailedFile={file => {
                                                const newFailedFiles =
                                                    failedFiles.filter(
                                                        f =>
                                                            f.file.name !==
                                                            file.file.name
                                                    );
                                                setFailedFiles(newFailedFiles);
                                            }}
                                            removeUploadedFile={(
                                                key: string
                                            ) => {
                                                update(
                                                    'files',
                                                    state.files.filter(
                                                        f =>
                                                            f.remoteFileName !==
                                                            key
                                                    )
                                                );
                                                //leaving in s3 for now to prevent files from previous runs from being removed
                                                //during reruns
                                                //removeFileFromS3(key);
                                            }}
                                            retryUploads={(
                                                files: UploadFailure[]
                                            ) =>
                                                uploadFiles(
                                                    files.map(f => f.file),
                                                    state.files
                                                )
                                            }
                                            successfulUploads={state.files}
                                        />
                                    </Grid>
                                </Grid>
                            </FadeInStep>
                            <FadeInStep active={activeStep === 2}>
                                <Grid
                                    item
                                    container
                                    flexWrap="nowrap"
                                    direction="column"
                                >
                                    <Grid item container>
                                        {globalDisplayFields.map(f => (
                                            <Grid item key={f.name}>
                                                <JobFormField
                                                    config={f}
                                                    update={update.bind(
                                                        null,
                                                        f.name
                                                    )}
                                                    value={
                                                        state[
                                                            f.name as keyof JobConfig
                                                        ] as string
                                                    }
                                                />
                                            </Grid>
                                        ))}
                                    </Grid>
                                    <Grid item>
                                        <Typography variant="h6">
                                            Shennong Processors
                                        </Typography>
                                    </Grid>
                                    <Grid
                                        alignItems="center"
                                        container
                                        direction="row"
                                        item
                                        flexWrap="nowrap"
                                    >
                                        <Grid
                                            item
                                            xs={9}
                                            container
                                            direction="column"
                                        >
                                            {schema &&
                                                schema.map(config => (
                                                    <ProcessingGroup
                                                        add={addAnalysis}
                                                        initArgsConfig={
                                                            config.init_args
                                                        }
                                                        key={
                                                            config.analysis.name
                                                        }
                                                        postProcessors={
                                                            config.postprocessors
                                                        }
                                                        processorConfig={
                                                            config.analysis
                                                        }
                                                        remove={removeAnalysis}
                                                        requiredPostprocessors={
                                                            config.required_postprocessors
                                                        }
                                                        state={state}
                                                        update={updateAnalysis}
                                                    />
                                                ))}
                                        </Grid>
                                        <Grid
                                            alignItems="flex-start"
                                            container
                                            direction="column"
                                            item
                                            xs={3}
                                        >
                                            <Button
                                                disabled={
                                                    !getAtLeastOneFeatureSelected()
                                                }
                                                onClick={() => setActiveStep(3)}
                                                sx={{
                                                    bottom: '25vh',
                                                    position: 'fixed',
                                                }}
                                                variant="contained"
                                            >
                                                Done
                                            </Button>
                                        </Grid>
                                    </Grid>
                                </Grid>
                            </FadeInStep>
                            <FadeInStep active={activeStep === 3}>
                                <Grid
                                    container
                                    item
                                    direction="column"
                                    spacing={2}
                                >
                                    <Grid container item>
                                        <Grid item>
                                            <Typography variant="h4">
                                                Summary
                                            </Typography>
                                        </Grid>
                                        <Grid
                                            container
                                            alignItems="flex-start"
                                            direction="column"
                                            item
                                        >
                                            <SummaryItem
                                                content={user!.email}
                                                label="Email"
                                            />
                                            <SummaryItem
                                                content={state.files
                                                    .map(
                                                        f => f.originalFile.name
                                                    )
                                                    .join(', ')}
                                                label="Files"
                                                missingOnClick={() =>
                                                    setActiveStep(1)
                                                }
                                            />
                                            <SummaryItem
                                                content={getKeys(state.analyses)
                                                    .map(capitalize)
                                                    .join(', ')}
                                                label="Processors"
                                                missingOnClick={() =>
                                                    setActiveStep(2)
                                                }
                                            />
                                            <SummaryItem
                                                content={state.res}
                                                label="Output"
                                                missingOnClick={() =>
                                                    setActiveStep(2)
                                                }
                                            />
                                        </Grid>
                                    </Grid>
                                    <Grid item>
                                        <Button
                                            onClick={() => {
                                                submitJob();
                                            }}
                                            variant="contained"
                                            disabled={
                                                !!invalidFields?.length ||
                                                !getAtLeastOneFeatureSelected() ||
                                                !state.files.length
                                            }
                                        >
                                            Submit
                                        </Button>
                                    </Grid>
                                    <Grid item>
                                        <Typography>
                                            Your results will arrive in .zip
                                            format. The .zip archive will
                                            contain 1 data file per audio file
                                            submitted.
                                        </Typography>
                                    </Grid>
                                </Grid>
                            </FadeInStep>
                        </>
                    </Grid>
                    {progress && <ProgressLoadingOverlay progress={progress} />}
                    <LoadingOverlay open={loading} />
                    <SuccessModal
                        handleClose={() => {
                            setSubmissionSuccess(false);
                            resetForm();
                            setActiveStep(1);
                        }}
                        header="The job has been sent to the Shennong processing queue."
                        message={`When it has completed, an email will be sent to ${
                            user!.email
                        } with a link to the results.`}
                        open={!!submissionSuccess}
                    />
                    <FailureModal
                        handleClose={() => setUploadHasFailures(false)}
                        header="One or more files failed to upload."
                        message={
                            'See the upload results panel for details and actions'
                        }
                        open={uploadHasFailures}
                    />

                    <SubmissionErrorModal
                        code={submissionError?.response?.status}
                        detail={submissionError?.response?.data.detail}
                        open={!!submissionError}
                        handleClose={() => setSubmissionError(undefined)}
                    />
                    <UploadSuccessModal
                        handleClose={() => {
                            setUploadSuccess(false);
                        }}
                        onStay={() => setUploadSuccess(false)}
                        onDone={() => {
                            setActiveStep(2);
                            setUploadSuccess(false);
                        }}
                        open={!!uploadSuccess}
                    />
                </Grid>
            </Grid>
        </Page>
    );
};

interface UploadStatusBoxProps {
    failedUploads: UploadFailure[];
    removeFailedFile: (file: UploadFailure) => void;
    removeUploadedFile: (key: string) => void;
    retryUploads: (files: UploadFailure[]) => void;
    successfulUploads: UploadResponse[];
}

const UploadStatusBox: React.FC<UploadStatusBoxProps> = ({
    failedUploads,
    removeFailedFile,
    removeUploadedFile,
    retryUploads,
    successfulUploads,
}) => {
    const [retries, setRetries] = useState<UploadFailure[]>();

    const toggleRetry = (f: UploadFailure) =>
        retries?.map(f => f.file.name).includes(f.file.name)
            ? setRetries(retries.filter(i => i.file.name !== f.file.name))
            : setRetries(retries?.concat(f));

    return (
        <Grid container item spacing={2} direction="column">
            {successfulUploads.length ? (
                <Grid item>
                    <Typography>
                        The following files will be included in the analysis:
                    </Typography>
                    <Box sx={{ maxHeight: '400px', overflowY: 'auto' }}>
                        {successfulUploads.map(f => (
                            <List key={f.remoteFileName}>
                                <ListItem disablePadding>
                                    <ListItemButton
                                        sx={{ flexGrow: 0 }}
                                        onClick={() =>
                                            removeUploadedFile(f.remoteFileName)
                                        }
                                    >
                                        <ListItemIcon>
                                            <Delete />
                                        </ListItemIcon>
                                    </ListItemButton>
                                    <ListItemText>
                                        {f.originalFile.name}
                                    </ListItemText>
                                </ListItem>
                            </List>
                        ))}
                    </Box>
                </Grid>
            ) : (
                <Grid item>
                    <Typography color="error">
                        Please select at least one file.
                    </Typography>
                </Grid>
            )}
            {!!failedUploads.length && (
                <Grid item>
                    <Typography color="error">
                        The following uploads were unsuccessful:
                    </Typography>
                    <List>
                        <Box sx={{ maxHeight: '400px', overflowY: 'auto' }}>
                            {failedUploads.map((u, i) => (
                                <ListItem
                                    disablePadding
                                    key={`${u.file.name}-${i}}`}
                                >
                                    <Grid container direction="column">
                                        <Grid
                                            item
                                            container
                                            direction="row"
                                            wrap="nowrap"
                                        >
                                            <ListItemButton
                                                sx={{ flexGrow: 0 }}
                                                onClick={() =>
                                                    removeFailedFile(u)
                                                }
                                            >
                                                <ListItemIcon>
                                                    <Delete />
                                                </ListItemIcon>
                                            </ListItemButton>
                                            <ListItemText>
                                                {u.file.name}
                                            </ListItemText>
                                        </Grid>
                                        <Grid
                                            item
                                            container
                                            direction="row"
                                            wrap="nowrap"
                                        >
                                            <ListItemText>
                                                Reason: {u.reason}
                                            </ListItemText>
                                            {u.reason ===
                                                FailureType.UPLOAD_FAILURE && (
                                                <Checkbox
                                                    checked={
                                                        retries &&
                                                        retries
                                                            .map(
                                                                f => f.file.name
                                                            )
                                                            .includes(
                                                                u.file.name
                                                            )
                                                    }
                                                    onChange={() =>
                                                        toggleRetry(u)
                                                    }
                                                />
                                            )}
                                        </Grid>
                                    </Grid>
                                </ListItem>
                            ))}
                        </Box>
                    </List>
                    <Button
                        variant="contained"
                        color="error"
                        disabled={!(retries || []).length}
                        onClick={() => !!retries && retryUploads(retries)}
                    >
                        Retry All
                    </Button>
                </Grid>
            )}
        </Grid>
    );
};

interface SummaryItemProps {
    content?: string;
    label: string;
    missingOnClick?: () => void;
}

const SummaryItem: React.FC<SummaryItemProps> = ({
    content,
    label,
    missingOnClick,
}) => (
    <Grid container direction="row" item>
        <Grid xs={2} item>
            <Typography>
                <strong>{label}</strong>
            </Typography>
        </Grid>
        <Grid xs={10} item>
            {content ? (
                <Box sx={{ maxHeight: '300px', overflowY: 'auto' }}>
                    <Typography>{content}</Typography>
                </Box>
            ) : (
                <Typography
                    sx={{ cursor: 'pointer' }}
                    onClick={missingOnClick}
                    color="error"
                >
                    Incomplete! Click to return.
                </Typography>
            )}
        </Grid>
    </Grid>
);

export default FormPage;

const StyledStepLabel = styled(StepLabel)(({ theme }) => ({
    '.MuiStepIcon-root.Mui-active': {
        color: theme.palette.secondary.light,
    },
    '.MuiStepIcon-root.Mui-completed': {
        color: theme.palette.secondary.dark,
    },
}));

const FadeInStep: React.FC<{ active: boolean }> = ({ active, children }) => {
    return active ? (
        <Fade in={true} timeout={500}>
            <Box sx={{ width: '100%' }}>{children}</Box>
        </Fade>
    ) : (
        <span />
    );
};
