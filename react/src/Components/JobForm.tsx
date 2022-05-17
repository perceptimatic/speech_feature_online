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
    FieldDisplaySchema,
    FormItem,
    JobConfig,
} from '../types';
import { capitalize } from '../util';

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
    channel: globalDisplayFields.find(f => f.name === 'channel')!
        .default as string,
    email: '',
    files: [],
    res: globalDisplayFields.find(f => f.name === 'res')!.default as string,
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

const resolveInputComponent = (config: FormItem) => {
    if (config.component) {
        return config.component;
    }
    switch (config.type) {
        case 'boolean':
            return 'checkbox';
        case 'integer':
            return 'number';
        case 'number':
            return 'number';
        case 'string':
            return 'radio';
    }
};

export default function JobFormField<K extends boolean | string | number>({
    config,
    update,
    value,
}: {
    config: FormItem;
    update: (val: any) => void;
    value: K;
}) {
    const component = resolveInputComponent(config);

    switch (component) {
        case 'checkbox':
            return (
                <FormControlLabel
                    control={<Checkbox checked={!!value} />}
                    label={
                        <Label
                            labelText={config.label || config.name}
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
                    key={config.name}
                    type="number"
                    label={
                        <Label
                            labelText={config.label || config.name}
                            helpLinks={config.helpLinks}
                        />
                    }
                    onChange={v => update(+v.currentTarget.value)}
                    value={value}
                />
            );
        case 'radio':
            return (
                <FormControl key={config.name}>
                    <FormLabel
                        sx={{
                            marginRight: 1,
                            color: theme => theme.palette.text.primary,
                        }}
                    >
                        <Label
                            labelText={config.label || ''}
                            helpLinks={config.helpLinks}
                        />
                    </FormLabel>
                    <RadioGroup row defaultValue={config.default}>
                        {(config.options || []).map(o => (
                            <FormControlLabel
                                key={o}
                                onChange={() => update(o)}
                                value={o}
                                control={<Radio />}
                                label={capitalize(o)}
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
    add: (k: string) => void;
    postProcessors: FormItem[];
    processorConfig: FormItem;
    initArgsConfig: FormItem[];
    state: JobConfig;
    remove: (k: string) => void;
    update: (processorName: string, slice: Partial<AnalysisConfig>) => void;
}

/* This takes a single Processing field schema and returns the display unit */
export const ProcessingGroup: React.FC<ProcessingGroupProps> = ({
    add,
    initArgsConfig,
    postProcessors,
    processorConfig,
    remove,
    state,
    update,
}) => {
    const existingValues = state.analyses
        ? state.analyses[processorConfig.name]
        : null;

    const updateInitArgs = (field: string, val: number | string | boolean) =>
        update(processorConfig.name, {
            init_args: {
                ...state.analyses[processorConfig.name].init_args,
                [field]: val,
            },
        });

    const updatePostProcessors = (postprocessors: string[]) =>
        update(processorConfig.name, {
            postprocessors,
        });

    return (
        <Grid container item direction="column" spacing={2}>
            <Grid item>
                <JobFormField
                    config={processorConfig}
                    value={!!existingValues}
                    update={() =>
                        existingValues
                            ? remove(processorConfig.name)
                            : add(processorConfig.name)
                    }
                />
            </Grid>
            <Grid container direction="column" item spacing={2}>
                {existingValues &&
                    initArgsConfig.map(f => (
                        <Grid item key={f.name}>
                            <JobFormField
                                config={f}
                                value={
                                    existingValues.init_args[f.name] ??
                                    f.default
                                }
                                update={val => updateInitArgs(f.name, val)}
                            />
                        </Grid>
                    ))}

                {existingValues && (
                    <Grid item alignItems="center" container direction="row">
                        <Typography>
                            <em>Post-processing:</em>&nbsp;
                        </Typography>
                        {postProcessors.map(f => (
                            <JobFormField
                                key={f.name}
                                config={f}
                                value={
                                    !!(
                                        existingValues.postprocessors || []
                                    ).find(p => p === f.name)
                                }
                                update={(val: boolean) => {
                                    const newVal = val
                                        ? [f.name].concat(
                                              existingValues.postprocessors ||
                                                  []
                                          )
                                        : (
                                              existingValues.postprocessors ||
                                              []
                                          ).filter(d => d !== f.name);
                                    updatePostProcessors(newVal);
                                }}
                            />
                        ))}
                    </Grid>
                )}
            </Grid>
        </Grid>
    );
};

//postprocessor fields
export const postProcessorDisplayFields: FieldDisplaySchema = {
    delta: {
        component: 'checkbox',
        helpLinks: [
            {
                label: 'Documentation',
                href: 'https://docs.cognitive-ml.fr/shennong/python/postprocessor/delta.html',
            },
        ],
        label: 'Delta Features',
    },
    cmvn: {
        component: 'checkbox',
        helpLinks: [
            {
                label: 'Documentation',
                href: 'https://docs.cognitive-ml.fr/shennong/python/postprocessor/cvm.html',
            },
        ],
        label: 'CMVN',
    },
    vad: {
        component: 'checkbox',
        helpLinks: [
            {
                label: 'Documentation',
                href: 'https://docs.cognitive-ml.fr/shennong/python/postprocessor/vad.html',
            },
        ],
        label: 'Voice Activity Detection',
    },
};

export const argumentDisplayFields: FieldDisplaySchema = {
    frame_shift: {
        component: 'number',
        label: 'Frame shift (seconds)',
    },
    frame_length: {
        component: 'number',
        label: 'Frame length (seconds)',
    },
    max_f0: {
        component: 'number',
        label: 'FO max (Hz)',
    },
    min_f0: {
        component: 'number',
        label: 'FO MIN (Hz)',
    },
    model_capacity: {
        component: 'radio',
        label: 'Model Capacity',
    },
    snip_edges: {
        component: 'checkbox',
        label: 'Snip Edges',
    },
    window_type: {
        component: 'radio',
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
    },
};

//global fields
export const globalDisplayFields: FormItem[] = [
    {
        name: 'channel',
        type: 'string',
        component: 'radio',
        default: 1,
        label: 'If recording is in stereo, which channel would you like to keep (1 or 2)?',
        options: ['1', '2'],
        required: true,
    },

    {
        name: 'res',
        component: 'radio',
        default: '.pkl',
        type: 'string',
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
        options: ['.csv', '.pkl', '.npz'],
        required: true,
    },
];

export const analysisDisplayFields: FieldDisplaySchema = {
    energy: {
        component: 'checkbox',
        label: 'Energy',
    },
    filterbank: {
        component: 'checkbox',
        label: 'Filterbank',
    },
    mfcc: {
        component: 'checkbox',
        label: 'MFCC',
    },
    p_crepe: {
        component: 'checkbox',
        label: 'Pitch Estimation (Crepe)',
    },
    p_kaldi: {
        component: 'checkbox',
        label: 'Pitch Estimation (Kaldi)',
    },
    plp: {
        component: 'checkbox',
        label: 'PLP',
    },
    spectrogram: {
        component: 'checkbox',
        label: 'Spectrogram',
    },
};

export const useFormReducer = () => useReducer(jobFormReducer, makeBaseForm());
