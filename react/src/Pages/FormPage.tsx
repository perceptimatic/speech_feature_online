import React, { useEffect, useState } from 'react';
import {
    Box,
    Button,
    Divider,
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
} from '@mui/material';
import { Delete } from '@mui/icons-material';
import {
    analysisFields,
    configurationFields,
    getConfiguration,
    getEntries,
    getKeys,
    globalFields,
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
    SuccessModal,
} from '../Components';
import {
    AnalysisConfig,
    CombinedAnalysisConfigFields,
    JobConfig,
    PCrepeAnalysisConfigProps,
    PKaldiAnalysisConfigProps,
    StandardAnalysisConfigProps,
} from '../types';
interface SubmissionState {
    state: 'PENDING' | 'ERROR' | 'SUCCESS';
    message?: string;
}

const FormPage: React.FC = () => {
    const [activeStep, setActiveStep] = useState(0);
    const [failedFiles, setFailedFiles] = useState<File[]>([]);
    const [invalidFields, setInvalidFields] = useState<string[]>();
    const [progress, setProgress] = useState<ProgressIncrement>();
    const [submissionState, setSubmissionState] = useState<SubmissionState>({
        state: 'PENDING',
    });
    const [state, dispatch] = useFormReducer();

    useEffect(() => {
        const invalid: string[] = [];

        getKeys(globalFields).forEach(k => {
            if (globalFields[k].required && !state[k]) {
                invalid.push(k);
            }
        });

        /* todo: print these at the bottom, but also include in component itself */
        if (state.analyses) {
            getKeys(state.analyses).forEach(k => {
                const analysis = analysisFields[k];
                analysis.configurationFields.forEach(f => {
                    if (
                        configurationFields[f].required &&
                        !!state.analyses &&
                        getConfiguration(state.analyses[k]!, f) === undefined
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
    }, [state]);

    const update = <K extends keyof JobConfig>(k: K, v: JobConfig[K]) =>
        dispatch({
            type: 'update',
            payload: { [k]: v },
        });

    const updateAnalysis =
        (ka: keyof AnalysisConfig) =>
        <K extends keyof CombinedAnalysisConfigFields>(
            k: K,
            v: CombinedAnalysisConfigFields[K]
        ) => {
            dispatch({
                type: 'update',
                payload: {
                    ...state,
                    analyses: {
                        ...state.analyses,
                        [ka]: { ...state.analyses[ka], [k]: v },
                    },
                },
            });
        };

    const addAnalysis = (k: keyof AnalysisConfig) => {
        const newAnalysis = {
            frame_length: configurationFields.frame_length.default,
            frame_shift: configurationFields.frame_shift.default,
        } as CombinedAnalysisConfigFields;
        if (
            ['spectrogram', 'energy', 'plp', 'mfcc', 'filterbank'].includes(k)
        ) {
            (newAnalysis as StandardAnalysisConfigProps).window_type =
                configurationFields.window_type.default as string;
            (newAnalysis as StandardAnalysisConfigProps).snip_edges =
                configurationFields.snip_edges.default as boolean;
        } else if (['p_kaldi'].includes(k)) {
            (newAnalysis as PKaldiAnalysisConfigProps).max_f0 =
                configurationFields.max_f0.default as number;
            (newAnalysis as PKaldiAnalysisConfigProps).min_f0 =
                configurationFields.min_f0.default as number;
        } else {
            (newAnalysis as PCrepeAnalysisConfigProps).model_capacity =
                configurationFields.model_capacity.default as string;
        }
        dispatch({
            type: 'update',
            payload: {
                ...state,
                analyses: {
                    ...state.analyses,
                    [k]: newAnalysis,
                },
            },
        });
    };

    const removeAnalysis = (k: keyof AnalysisConfig) => {
        const analyses = {} as Record<keyof AnalysisConfig, any>;

        for (const analysis in state.analyses!) {
            if (analysis !== k) {
                analyses[k] = state.analyses[analysis as keyof AnalysisConfig];
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
                            failures.push(res.file!);
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
        submitForm(state);
        setSubmissionState({ state: 'SUCCESS' });
    };

    return (
        <Grid container direction="column" alignItems="flex-start">
            <Typography variant="h3">Run an analysis</Typography>
            <Typography>
                Use the controls below to upload an audio file to be processed
                by the Shennong software. The results will be sent to the email
                address you enter in the field below.
            </Typography>
            <Divider flexItem orientation="vertical" />
            <Stepper orientation="vertical" activeStep={activeStep}>
                <Step
                    sx={{ cursor: 'pointer' }}
                    active={activeStep === 0}
                    completed={getEmailIsValid()}
                >
                    <StepLabel onClick={() => setActiveStep(0)}>
                        Enter an email address to receive your results.
                    </StepLabel>
                    <StepContent>
                        <TextField
                            error={!getEmailIsValid()}
                            label="Your email"
                            helperText={
                                getEmailIsValid()
                                    ? 'Results will be sent to this address.'
                                    : 'Please enter a valid email address.'
                            }
                            onChange={e =>
                                update('email', e.currentTarget.value)
                            }
                            type="email"
                            value={state['email']}
                            onBlur={() =>
                                getEmailIsValid()
                                    ? setActiveStep(1)
                                    : setActiveStep(0)
                            }
                        />
                    </StepContent>
                </Step>
                <Step
                    active={activeStep === 1}
                    completed={!!state.files.length}
                    sx={{ cursor: 'pointer' }}
                >
                    <StepLabel onClick={() => setActiveStep(1)}>
                        Select Files
                    </StepLabel>

                    <StepContent>
                        <Button variant="contained" component="label">
                            Select files
                            <input
                                accept=".mp3,.wav,.ogg,.flac"
                                type="file"
                                hidden
                                multiple
                                onChange={e => {
                                    if (e.currentTarget.files) {
                                        uploadFiles(
                                            Array.from(e.currentTarget.files)
                                        ).then(() => setActiveStep(2));
                                    }
                                }}
                            />
                        </Button>

                        <UploadStatusBox
                            failedUploads={failedFiles}
                            removeFailedFile={file => {
                                const newFailedFiles = failedFiles.filter(
                                    f => f.name !== file.name
                                );
                                setFailedFiles(newFailedFiles);
                            }}
                            removeUploadedFile={(key: string) => {
                                update(
                                    'files',
                                    state.files.filter(f => f !== key)
                                );
                                if (process.env.STORAGE_DRIVER === 's3') {
                                    removeFileFromS3(key);
                                }
                            }}
                            retryUploads={(files: File[]) => uploadFiles(files)}
                            successfulUploads={state.files}
                        />
                    </StepContent>
                </Step>
                <Step
                    active={activeStep === 2}
                    completed={getAtLeastOneFeatureSelected()}
                    sx={{ cursor: 'pointer' }}
                >
                    <StepLabel onClick={() => setActiveStep(2)}>
                        Select Processors
                    </StepLabel>
                    <StepContent>
                        {getEntries(globalFields).map(([key, config]) => (
                            <JobFormField
                                key={key}
                                config={config}
                                update={update.bind(null, key)}
                                value={state[key]}
                            />
                        ))}
                        <Typography variant="h6">
                            Shennong Processors
                        </Typography>
                        {getEntries(analysisFields).map(([k, config]) => (
                            <ProcessingGroup
                                add={addAnalysis}
                                config={config}
                                key={k}
                                state={state}
                                update={updateAnalysis}
                                remove={removeAnalysis}
                            />
                        ))}
                        <Typography variant="h6">Results Options</Typography>
                        <Typography>
                            Your results will arrive in .zip format. The .zip
                            archive will contain 1 data file per audio file
                            submitted.
                        </Typography>
                    </StepContent>
                    <Button
                        disabled={
                            !!invalidFields?.length ||
                            !getAtLeastOneFeatureSelected() ||
                            !!failedFiles.length ||
                            !state.files.length
                        }
                        onClick={() => {
                            submitJob();
                            dispatch({ type: 'clear' });
                        }}
                        variant="contained"
                    >
                        Submit
                    </Button>
                    {!getAtLeastOneFeatureSelected() && (
                        <Typography color="error">
                            Please select at least one Shennong feature.
                        </Typography>
                    )}
                    {!getEmailIsValid() && (
                        <Typography color="error">
                            Please enter a valid email address.
                        </Typography>
                    )}
                </Step>
            </Stepper>
            {progress && <ProgressLoadingOverlay progress={progress} />}
            <SuccessModal
                handleClose={() => {
                    setSubmissionState({ state: 'PENDING' });
                }}
                header="The job has been sent to the Shennong processing queue."
                message={`When it has completed, an email will be sent to ${state.email} with a link to the results.`}
                open={submissionState.state === 'SUCCESS'}
            />
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
    <Grid container spacing={2} direction="column">
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
                    variant="outlined"
                    color="error"
                    onClick={() => retryUploads(failedUploads)}
                >
                    Retry All
                </Button>
            </Grid>
        )}
    </Grid>
);

export default FormPage;
