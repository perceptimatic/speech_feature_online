import React, { useEffect, useState } from 'react';
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
    TextField,
    Typography,
    Divider,
    capitalize,
    styled,
    Fade,
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
    removeFileFromS3,
    submitForm,
} from '../api';
import {
    JobFormField,
    ProgressLoadingOverlay,
    SubmissionErrorModal,
    SuccessModal,
    UploadSuccessModal,
} from '../Components';
import {
    AnalysisConfig,
    AnalysisFormGroup,
    CommonSchema,
    FormItem,
    JobConfig,
} from '../types';

const FormPage: React.FC = () => {
    const [activeStep, setActiveStep] = useState(0);
    const [failedFiles, setFailedFiles] = useState<File[]>([]);
    const [invalidFields, setInvalidFields] = useState<string[]>();
    const [postprocessors, setPostProcessors] = useState<FormItem[]>();
    const [progress, setProgress] = useState<ProgressIncrement>();
    const [schema, setSchema] = useState<AnalysisFormGroup[]>();
    const [state, dispatch] = useFormReducer();
    const [submissionSuccess, setSubmissionSuccess] = useState<boolean>();
    const [submissionError, setSubmissionError] = useState<AxiosError>();
    const [uploadSuccess, setUploadSucess] = useState<boolean>();

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
                    required_postprocessors: v.required_postprocessors,
                })
            );
            setSchema(fg);
            setPostProcessors(
                getKeys(schema.postprocessors).map(k => ({
                    ...postProcessorDisplayFields[k],
                    component: 'checkbox',
                    default: false,
                    name: k,
                    required: false,
                    type: 'boolean',
                }))
            );
        };

        cb();
    }, []);

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

    const update = (k: string, v: string | string[] | number | boolean) =>
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
    const uploadFiles = async (files: File[]) => {
        let failures: File[] = failedFiles.slice();
        return postFiles(files, p => setProgress(p))
            .then(r => {
                let success = true;
                const paths = r
                    .map(res => {
                        if (!isUploadError(res)) {
                            // remove from failed list (if applicable)
                            failures = failures.filter(
                                f => f.name !== res.originalFileName
                            );
                            return res.remoteFileName;
                        } else if (isUploadError(res)) {
                            success = false;
                            if (res.file && !failures.includes(res.file!)) {
                                failures.push(res.file!);
                            }
                        }
                    })
                    .filter(Boolean);
                //add to job payload
                update('files', state.files.concat(paths as string[]));
                return success;
            })
            .finally(() => {
                setFailedFiles(failures);
                setProgress(undefined);
            });
    };

    const getAtLeastOneFeatureSelected = () => !!getKeys(state.analyses).length;

    const getEmailIsValid = () =>
        !!state['email'].match(/^[\w-.]+@([\w-]+\.)+[\w-]{2,4}$/);

    const submitJob = () => {
        submitForm(state)
            .then(() => {
                setSubmissionSuccess(true);
            })
            .catch((e: AxiosError) => setSubmissionError(e));
    };

    return (
        <Grid container direction="column" alignItems="flex-start">
            <Grid item>
                <Box>
                    <Typography variant="h3">Run an analysis</Typography>
                    <Typography>
                        Use the controls below to upload an audio file to be
                        processed by the Shennong software. The results will be
                        sent to the email address you enter in the field below.
                    </Typography>
                </Box>
            </Grid>
            <Grid container item direction="row">
                <Divider variant="middle" sx={{ margin: 3, width: '100%' }} />
            </Grid>
            <Grid item container direction="row">
                <Grid item container md={4} direction="column">
                    <Stepper orientation="vertical" activeStep={activeStep}>
                        <Step
                            sx={{ cursor: 'pointer' }}
                            active={activeStep === 0}
                            completed={getEmailIsValid()}
                        >
                            <StyledStepLabel onClick={() => setActiveStep(0)}>
                                Enter an email address.
                            </StyledStepLabel>
                            <StepContent>
                                <Typography variant="caption">
                                    We'll send your results here.
                                </Typography>
                            </StepContent>
                        </Step>
                        <Step
                            active={activeStep === 1}
                            completed={!!state.files.length}
                            sx={{ cursor: 'pointer' }}
                        >
                            <StyledStepLabel onClick={() => setActiveStep(1)}>
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
                            <StyledStepLabel onClick={() => setActiveStep(2)}>
                                Select Processors
                            </StyledStepLabel>
                            <StepContent>
                                <Typography variant="caption">
                                    Configure your job by selecting processors,
                                    post-processors, and options.
                                </Typography>
                            </StepContent>
                        </Step>
                        <Step
                            active={activeStep === 3}
                            completed={!!submissionSuccess}
                            sx={{ cursor: 'pointer' }}
                        >
                            <StyledStepLabel onClick={() => setActiveStep(3)}>
                                Review and Submit
                            </StyledStepLabel>
                            <StepContent>
                                <Typography variant="caption">
                                    Review your job and submit for processing.
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
                        <FadeInStep active={activeStep === 0}>
                            <Grid
                                alignItems="center"
                                container
                                direction="row"
                                item
                                justifyContent="flex-start"
                                spacing={2}
                            >
                                <Grid item>
                                    <TextField
                                        error={!getEmailIsValid()}
                                        label="Your email"
                                        helperText={
                                            getEmailIsValid()
                                                ? 'Results will be sent to this address.'
                                                : 'Please enter a valid email address.'
                                        }
                                        onChange={e =>
                                            update(
                                                'email',
                                                e.currentTarget.value
                                            )
                                        }
                                        type="email"
                                        value={state['email']}
                                        onBlur={() =>
                                            getEmailIsValid()
                                                ? setActiveStep(1)
                                                : setActiveStep(0)
                                        }
                                    />
                                </Grid>
                                <Grid item>
                                    <Button
                                        disabled={!getEmailIsValid()}
                                        variant="contained"
                                    >
                                        Next
                                    </Button>
                                </Grid>
                            </Grid>
                        </FadeInStep>
                        <FadeInStep active={activeStep === 1}>
                            <Grid
                                alignItems="flex-start"
                                container
                                direction="column"
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
                                                if (e.currentTarget.files) {
                                                    uploadFiles(
                                                        Array.from(
                                                            e.currentTarget
                                                                .files
                                                        )
                                                    ).then(a =>
                                                        setUploadSucess(!!a)
                                                    );
                                                }
                                            }}
                                        />
                                    </Button>
                                </Grid>
                                <Grid item>
                                    <Divider />
                                </Grid>
                                <Grid item>
                                    <UploadStatusBox
                                        failedUploads={failedFiles}
                                        removeFailedFile={file => {
                                            const newFailedFiles =
                                                failedFiles.filter(
                                                    f => f.name !== file.name
                                                );
                                            setFailedFiles(newFailedFiles);
                                        }}
                                        removeUploadedFile={(key: string) => {
                                            update(
                                                'files',
                                                state.files.filter(
                                                    f => f !== key
                                                )
                                            );
                                            if (
                                                process.env.STORAGE_DRIVER ===
                                                's3'
                                            ) {
                                                removeFileFromS3(key);
                                            }
                                        }}
                                        retryUploads={(files: File[]) =>
                                            uploadFiles(files)
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
                                            postprocessors &&
                                            schema.map(config => (
                                                <ProcessingGroup
                                                    add={addAnalysis}
                                                    initArgsConfig={
                                                        config.init_args
                                                    }
                                                    key={config.analysis.name}
                                                    postProcessors={
                                                        postprocessors
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
                            <Grid container item direction="column" spacing={2}>
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
                                            content={state.email}
                                            label="Email"
                                            missingOnClick={() =>
                                                setActiveStep(0)
                                            }
                                        />
                                        <SummaryItem
                                            content={state.files.join(', ')}
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
                                            !!failedFiles.length ||
                                            !state.files.length
                                        }
                                    >
                                        Submit
                                    </Button>
                                </Grid>
                                <Grid item>
                                    <Typography>
                                        Your results will arrive in .zip format.
                                        The .zip archive will contain 1 data
                                        file per audio file submitted.
                                    </Typography>
                                </Grid>
                            </Grid>
                        </FadeInStep>
                    </>
                </Grid>
                {progress && <ProgressLoadingOverlay progress={progress} />}
                <SuccessModal
                    handleClose={() => {
                        setSubmissionSuccess(undefined);
                        resetForm();
                        setActiveStep(0);
                    }}
                    header="The job has been sent to the Shennong processing queue."
                    message={`When it has completed, an email will be sent to ${state.email} with a link to the results.`}
                    open={!!submissionSuccess}
                />

                <SubmissionErrorModal
                    code={submissionError?.response?.status}
                    detail={submissionError?.response?.data.detail}
                    open={!!submissionError}
                    handleClose={() => setSubmissionError(undefined)}
                />
                <UploadSuccessModal
                    handleClose={() => {
                        setUploadSucess(undefined);
                    }}
                    onStay={() => setUploadSucess(undefined)}
                    onDone={() => {
                        setActiveStep(2);
                        setUploadSucess(undefined);
                    }}
                    open={!!uploadSuccess}
                />
            </Grid>
        </Grid>
    );
};

interface UploadStatusBoxProps {
    failedUploads: File[];
    removeFailedFile: (file: File) => void;
    removeUploadedFile: (key: string) => void;
    retryUploads: (files: File[]) => void;
    successfulUploads: string[];
}

const UploadStatusBox: React.FC<UploadStatusBoxProps> = ({
    failedUploads,
    removeFailedFile,
    removeUploadedFile,
    retryUploads,
    successfulUploads,
}) => (
    <Grid container item spacing={2} direction="column">
        {successfulUploads.length ? (
            <Grid item>
                <Box sx={{ maxHeight: '350px', overflowY: 'auto' }}>
                    <Typography>
                        The following files will be included in the analysis:
                    </Typography>
                    {successfulUploads.map(f => (
                        <List key={f}>
                            <ListItem disablePadding>
                                <ListItemButton
                                    sx={{ flexGrow: 0 }}
                                    onClick={() => removeUploadedFile(f)}
                                >
                                    <ListItemIcon>
                                        <Delete />
                                    </ListItemIcon>
                                </ListItemButton>
                                <ListItemText>{f}</ListItemText>
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
                    {failedUploads.map(u => (
                        <List key={u.name}>
                            <ListItem disablePadding>
                                <ListItemButton
                                    sx={{ flexGrow: 0 }}
                                    onClick={() => removeFailedFile(u)}
                                >
                                    <ListItemIcon>
                                        <Delete />
                                    </ListItemIcon>
                                </ListItemButton>
                                <ListItemText>{u.name}</ListItemText>
                            </ListItem>
                        </List>
                    ))}
                </List>
                <Button
                    variant="contained"
                    color="error"
                    onClick={() => retryUploads(failedUploads)}
                >
                    Retry All
                </Button>
            </Grid>
        )}
    </Grid>
);

interface SummaryItemProps {
    content?: string;
    label: string;
    missingOnClick: () => void;
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
                <Typography>{content}</Typography>
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
            <span>{children}</span>
        </Fade>
    ) : (
        <span />
    );
};
