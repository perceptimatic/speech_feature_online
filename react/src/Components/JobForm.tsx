import React, { Reducer, useReducer, useState } from 'react';
import {
    Checkbox,
    FormControl,
    FormControlLabel,
    FormLabel,
    Grid,
    Link,
    List,
    ListItem,
    Popover,
    Radio,
    RadioGroup,
    TextField,
    Typography,
} from '@mui/material';
import { QuestionMark } from '@mui/icons-material';
import { Box } from '@mui/system';
import {
    AnalysisConfig,
    BaseJobConfig,
    CombinedAnalysisConfigFields,
    isPCrepeAnalysisConfigProps,
    isPKaldiAnalysisConfigProps,
    JobConfig,
    PCrepeAnalysisConfigProps,
    PKaldiAnalysisConfigProps,
    Postprocessor,
    StandardAnalysisConfigProps,
} from '../types';

interface Action {
    payload?: Partial<JobConfig>;
    type: string;
}

export const getKeys = <T,>(obj: T) => Object.keys(obj) as (keyof T)[];

export const getValues = <T,>(obj: T) => Object.values(obj) as T[keyof T][];

export const getEntries = <T,>(obj: T) =>
    Object.entries(obj) as [keyof T, T[keyof T]][];

const makeBaseForm = (): JobConfig => ({
    analyses: {},
    channel: globalFields.channel.default as number,
    email: '',
    files: [],
    res: globalFields.res.default as string,
});

export const jobFormReducer: Reducer<JobConfig, Action> = (
    state: JobConfig,
    { payload, type }: Action
) => {
    switch (type) {
        case 'update':
            return { ...state, ...payload };
        case 'clear':
            return makeBaseForm();
        default:
            throw new Error();
    }
};

const Label: React.FC<{
    helpLinks?: { label: string; href: string }[];
    labelText: string | React.ReactElement<any>;
}> = ({ helpLinks, labelText }) => {
    const [anchor, setAnchor] = useState<EventTarget & Element>();
    if (!helpLinks) {
        return <Typography>{labelText}</Typography>;
    } else {
        return (
            <>
                <Box sx={{ display: 'flex' }}>
                    <Typography>{labelText}</Typography>
                    <Box sx={{ fontSize: '10px' }}>
                        &nbsp;
                        <QuestionMark
                            onClick={e => {
                                e.preventDefault();
                                setAnchor(e.currentTarget);
                            }}
                            fontSize="inherit"
                        />
                    </Box>
                </Box>

                <Popover
                    onClose={() => setAnchor(undefined)}
                    open={!!anchor}
                    anchorEl={anchor}
                    anchorOrigin={{
                        vertical: 'top',
                        horizontal: 'right',
                    }}
                >
                    <Box>
                        <List>
                            {helpLinks.map(l => (
                                <ListItem key={l.href}>
                                    <Link
                                        target="_blank"
                                        rel="noopener"
                                        href={l.href}
                                    >
                                        {l.label}
                                    </Link>
                                </ListItem>
                            ))}
                        </List>
                    </Box>
                </Popover>
            </>
        );
    }
};

const isBoolean = (arg: boolean | any): arg is boolean =>
    typeof arg === 'boolean';

export default function JobFormField<K extends boolean | string | number>({
    config,
    update,
    value,
}: {
    config: FormField;
    update: (val: any) => void;
    value: K;
}) {
    switch (config.component) {
        case 'checkbox':
            return (
                <FormControlLabel
                    control={<Checkbox checked={!!value} />}
                    label={
                        <Label
                            labelText={config.label}
                            helpLinks={config.helpLinks}
                        />
                    }
                    onChange={() => {
                        if (isBoolean(value)) {
                            update(!value);
                        }
                    }}
                />
            );

        case 'number':
            return (
                <TextField
                    sx={{ margin: 1, width: '200px' }}
                    key={config.field}
                    type="number"
                    label={
                        <Label
                            labelText={config.label}
                            helpLinks={config.helpLinks}
                        />
                    }
                    onChange={v => update(+v.currentTarget.value)}
                    value={value}
                />
            );
        case 'radio':
            return (
                <FormControl key={config.field}>
                    <FormLabel
                        sx={{
                            marginRight: 1,
                            color: theme => theme.palette.text.primary,
                        }}
                    >
                        <Label
                            labelText={config.label}
                            helpLinks={config.helpLinks}
                        />
                    </FormLabel>
                    <RadioGroup row defaultValue={config.default}>
                        {config.options!.map(o => (
                            <FormControlLabel
                                key={o.value}
                                onChange={() => update(o.value)}
                                value={o.value}
                                control={<Radio />}
                                label={o.label}
                            />
                        ))}
                    </RadioGroup>
                </FormControl>
            );
        default:
            return null;
    }
}

interface ProcessingGroupProps {
    add: <K extends keyof AnalysisConfig>(k: K) => void;
    remove: <K extends keyof AnalysisConfig>(k: K) => void;
    config: AnalysisField;
    state: JobConfig;
    update: <K extends keyof AnalysisConfig>(
        k: K
    ) => <K1 extends keyof CombinedAnalysisConfigFields>(
        k: K1,
        v: CombinedAnalysisConfigFields[K1]
    ) => void;
}

export const ProcessingGroup: React.FC<ProcessingGroupProps> = ({
    add,
    remove,
    config,
    state,
    update,
}) => {
    const {
        //avoid clobering outer variable
        configurationFields: configFields,
        postprocessors,
        ...inputConfig
    } = config;
    const postProcessing = postprocessors
        .sort()
        .map(k => postProcessorFields[k]);

    const groupValues = state.analyses
        ? state.analyses[inputConfig.field]
        : null;

    //todo: might want caller to bind this
    const updateField = update(inputConfig.field);

    return (
        <Grid container item direction="column" spacing={2}>
            <Grid item>
                <JobFormField
                    config={inputConfig}
                    value={!!groupValues}
                    update={() =>
                        groupValues
                            ? remove(inputConfig.field)
                            : add(inputConfig.field)
                    }
                />
            </Grid>
            <Grid container direction="column" item spacing={2}>
                {groupValues &&
                    configFields.map(f => (
                        <Grid item key={f}>
                            <JobFormField
                                config={configurationFields[f]}
                                value={
                                    getConfiguration(groupValues, f) ??
                                    configurationFields[f].default
                                }
                                update={val => updateField(f, val)}
                            />
                        </Grid>
                    ))}

                {postProcessing.length && groupValues && (
                    <Grid item alignItems="center" container direction="row">
                        <Typography>
                            <em>Post-processing:</em>&nbsp;
                        </Typography>
                        {postProcessing.map(f => (
                            <JobFormField
                                key={f.field}
                                config={f}
                                value={
                                    !!(groupValues.postprocessors || []).find(
                                        p => p === f.field
                                    )
                                }
                                update={(val: boolean) => {
                                    const newVal = val
                                        ? [f.field as Postprocessor].concat(
                                              groupValues.postprocessors || []
                                          )
                                        : (
                                              groupValues.postprocessors || []
                                          ).filter(
                                              d =>
                                                  d !==
                                                  (f.field as Postprocessor)
                                          );
                                    updateField('postprocessors', newVal);
                                }}
                            />
                        ))}
                    </Grid>
                )}
            </Grid>
        </Grid>
    );
};

interface FormField {
    component: 'checkbox' | 'number' | 'radio' | 'text';
    default?: string | number | string[] | boolean;
    field:
        | keyof CombinedAnalysisConfigFields
        | Postprocessor
        | keyof BaseJobConfig
        | keyof AnalysisConfig;
    helpLinks?: { label: string; href: string }[];
    label: string | JSX.Element;
    options?: { label: string; value: string }[];
    required: boolean;
    validationRules?: { comparator: '<' | '=' | '>'; value: string | number }[];
}

//reusable postprocessor fields
export const postProcessorFields: Record<Postprocessor, FormField> = {
    delta: {
        component: 'checkbox',
        field: 'delta',
        helpLinks: [
            {
                label: 'Documentation',
                href: 'https://docs.cognitive-ml.fr/shennong/python/postprocessor/delta.html',
            },
        ],
        label: 'Delta Features',
        required: false,
    },
    cmvn: {
        component: 'checkbox',
        field: 'cmvn',
        helpLinks: [
            {
                label: 'Documentation',
                href: 'https://docs.cognitive-ml.fr/shennong/python/postprocessor/cvm.html',
            },
        ],
        label: 'CMVN',
        required: false,
    },
    vad: {
        component: 'checkbox',
        field: 'vad',
        helpLinks: [
            {
                label: 'Documentation',
                href: 'https://docs.cognitive-ml.fr/shennong/python/postprocessor/vad.html',
            },
        ],
        label: 'Voice Activity Detection',
        required: false,
    },
};

// reusable configuration fields
export const configurationFields: Record<
    keyof Omit<
        StandardAnalysisConfigProps &
            PKaldiAnalysisConfigProps &
            PCrepeAnalysisConfigProps,
        'postprocessors'
    >,
    FormField
> = {
    frame_shift: {
        component: 'number',
        default: 0.01,
        field: 'frame_shift',
        label: 'Frame shift (seconds)',
        required: true,
    },
    frame_length: {
        component: 'number',
        default: 0.025,
        field: 'frame_length',
        label: 'Frame length (seconds)',
        required: false,
    },
    max_f0: {
        component: 'number',
        default: 400,
        field: 'max_f0',
        label: 'FO max (Hz)',
        required: true,
    },
    min_f0: {
        component: 'number',
        default: 50,
        field: 'min_f0',
        label: 'FO MIN (Hz)',
        required: true,
    },
    model_capacity: {
        component: 'radio',
        default: 'full',
        field: 'model_capacity',
        label: 'Model Capacity',
        required: true,
        options: [
            {
                label: 'Full',
                value: 'full',
            },
            {
                label: 'Large',
                value: 'large',
            },
            {
                label: 'Medium',
                value: 'medium',
            },
            {
                label: 'Small',
                value: 'small',
            },
            {
                label: 'Tiny',
                value: 'tiny',
            },
        ],
    },
    snip_edges: {
        component: 'checkbox',
        default: false,
        field: 'snip_edges',
        label: 'Snip Edges',
        required: true,
    },
    window_type: {
        component: 'radio',
        default: 'hamming',
        field: 'window_type',
        helpLinks: [
            {
                label: '1',
                href: 'https://www.audiolabs-erlangen.de/resources/MIR/FMP/C2/C2_STFT-Window.html',
            },
            {
                label: '2',
                href: 'https://support.ircam.fr/docs/AudioSculpt/3.0/co/Window%20Step.html',
            },
            {
                label: '3',
                href: 'https://jscholarship.library.jhu.edu/bitstream/handle/1774.2/62248/GHAHREMANI-DISSERTATION-2019.pdf?sequence=1"',
            },
        ],
        label: 'Window Type',
        options: [
            {
                label: 'Hamming',
                value: 'hamming',
            },
            {
                label: 'Hanning',
                value: 'hanning',
            },
            {
                label: 'Povey',
                value: 'povey',
            },
            {
                label: 'Rectangular',
                value: 'rectangular',
            },
            {
                label: 'Blackman',
                value: 'blackman',
            },
        ],
        required: true,
    },
};

//global fields

export const globalFields: Record<
    keyof Omit<BaseJobConfig, 'files'>,
    FormField
> = {
    channel: {
        component: 'radio',
        default: 1,
        field: 'channel',
        label: 'If recording is in stereo, which channel would you like to keep (1 or 2)?',
        options: [
            { label: '1', value: '1' },
            { label: '2', value: '2' },
        ],
        required: true,
    },
    email: {
        component: 'text',
        field: 'email',
        default: 'foo@bar.com',
        label: 'Email',
        required: true,
    },

    res: {
        component: 'radio',
        default: '.pkl',
        field: 'res',
        label: (
            <>
                Please select the format for your data files,{' '}
                <Link
                    target="_blank"
                    href="https://docs.cognitive-ml.fr/shennong/python/features.html#module-shennong.features_collection"
                >
                    {' '}
                    among those Shennong supports
                </Link>
            </>
        ),
        options: [
            {
                label: '.csv',
                value: '.csv',
            },
            {
                label: '.pkl',
                value: '.pkl',
            },
            {
                label: '.npz',
                value: '.npz',
            },
        ],
        required: true,
    },
};

interface AnalysisField extends FormField {
    field: keyof AnalysisConfig;
    configurationFields:
        | (keyof Omit<StandardAnalysisConfigProps, 'postprocessors'>)[]
        | (keyof Omit<PKaldiAnalysisConfigProps, 'postprocessors'>)[]
        | (keyof Omit<PCrepeAnalysisConfigProps, 'postprocessors'>)[];
    postprocessors: Postprocessor[];
}

export const analysisFields: Record<keyof AnalysisConfig, AnalysisField> = {
    energy: {
        component: 'checkbox',
        configurationFields: [
            'frame_length',
            'frame_shift',
            'window_type',
            'snip_edges',
        ] as (keyof Omit<StandardAnalysisConfigProps, 'postprocessors'>)[],
        field: 'energy',
        label: 'Energy',
        postprocessors: ['delta'],
        required: false,
    },
    filterbank: {
        component: 'checkbox',
        configurationFields: [
            'frame_length',
            'frame_shift',
            'window_type',
            'snip_edges',
        ] as (keyof Omit<StandardAnalysisConfigProps, 'postprocessors'>)[],
        field: 'filterbank',
        label: 'Filterbank',
        postprocessors: ['delta'],
        required: false,
    },
    mfcc: {
        component: 'checkbox',
        configurationFields: [
            'frame_length',
            'frame_shift',
            'window_type',
            'snip_edges',
        ] as (keyof Omit<StandardAnalysisConfigProps, 'postprocessors'>)[],
        field: 'mfcc',
        label: 'MFCC',
        postprocessors: ['cmvn', 'delta', 'vad'],
        required: false,
    },
    p_crepe: {
        component: 'checkbox',
        configurationFields: [
            'frame_length',
            'frame_shift',
            'model_capacity',
        ] as (keyof Omit<PCrepeAnalysisConfigProps, 'postprocessors'>)[],
        field: 'p_crepe',
        label: 'Pitch Estimation (Crepe)',
        postprocessors: ['delta'],
        required: false,
    },
    p_kaldi: {
        component: 'checkbox',
        configurationFields: [
            'frame_length',
            'frame_shift',
            'max_f0',
            'min_f0',
        ] as (keyof Omit<PKaldiAnalysisConfigProps, 'postprocessors'>)[],
        field: 'p_kaldi',
        label: 'Pitch Estimation (Kaldi)',
        postprocessors: ['delta'],
        required: false,
    },
    plp: {
        component: 'checkbox',
        configurationFields: [
            'frame_length',
            'frame_shift',
            'window_type',
            'snip_edges',
        ] as (keyof Omit<StandardAnalysisConfigProps, 'postprocessors'>)[],
        field: 'plp',
        label: 'PLP',
        postprocessors: ['cmvn', 'delta', 'vad'],
        required: false,
    },
    spectrogram: {
        component: 'checkbox',
        configurationFields: [
            'frame_length',
            'frame_shift',
            'window_type',
            'snip_edges',
        ] as (keyof Omit<StandardAnalysisConfigProps, 'postprocessors'>)[],
        field: 'spectrogram',
        label: 'Spectrogram',
        postprocessors: ['delta'],
        required: false,
    },
};

/* A typscript wrapper to resolve analysis types (sort of) */
export const getConfiguration = (
    analysis:
        | StandardAnalysisConfigProps
        | PKaldiAnalysisConfigProps
        | PCrepeAnalysisConfigProps,
    field:
        | keyof Omit<StandardAnalysisConfigProps, 'postprocessors'>
        | keyof Omit<PKaldiAnalysisConfigProps, 'postprocessors'>
        | keyof Omit<PCrepeAnalysisConfigProps, 'postprocessors'>
) => {
    if (
        isPKaldiAnalysisConfigProps(analysis) &&
        !!analysis[field as keyof PKaldiAnalysisConfigProps]
    ) {
        return analysis[field as keyof PKaldiAnalysisConfigProps];
    } else if (
        isPCrepeAnalysisConfigProps(analysis) &&
        !!analysis[field as keyof PCrepeAnalysisConfigProps]
    ) {
        return analysis[field as keyof PCrepeAnalysisConfigProps];
    } else {
        //eslint-disable-next-line @typescript-eslint/ban-ts-comment
        //@ts-ignore
        return analysis[field as keyof StandardAnalysisConfigProps];
    }
};

export const useFormReducer = () => useReducer(jobFormReducer, makeBaseForm());
