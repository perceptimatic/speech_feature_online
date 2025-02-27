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

const makeBaseForm = (email: string): JobConfig => ({
    analyses: {},
    channel: globalDisplayFields.find(f => f.name === 'channel')!
        .default as string,
    email,
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
            return makeBaseForm(state.email);
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
                <Grid container flexWrap="nowrap">
                    <Typography>{labelText}</Typography>
                    <Box sx={{ fontSize: '10px', paddingLeft: 1 }}>
                        <QuestionMark
                            onClick={e => {
                                e.preventDefault();
                                setAnchor(e.currentTarget);
                            }}
                            fontSize="inherit"
                        />
                    </Box>
                </Grid>

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
    disabled,
    update,
    value,
}: {
    config: FormItem;
    disabled?: boolean;
    update: (val: any) => void;
    value: K;
}) {
    const component = resolveInputComponent(config);

    switch (component) {
        case 'checkbox':
            return (
                <FormControlLabel
                    control={<Checkbox checked={!!value} />}
                    disabled={disabled}
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
                    disabled={disabled}
                    key={config.name}
                    label={
                        <Label
                            labelText={config.label || config.name}
                            helpLinks={config.helpLinks}
                        />
                    }
                    onChange={v => update(+v.currentTarget.value)}
                    sx={{ margin: 1, width: '200px' }}
                    type="number"
                    value={value}
                />
            );
        case 'radio':
            return (
                <FormControl disabled={disabled} key={config.name}>
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
                                label={capitalize(o.toString())}
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
    initArgsConfig: FormItem[];
    postProcessors: FormItem[];
    processorConfig: FormItem;
    remove: (k: string) => void;
    requiredPostprocessors: string[];
    state: JobConfig;
    update: (processorName: string, slice: Partial<AnalysisConfig>) => void;
}

/* This takes a single Processing field schema and returns the form fields */
export const ProcessingGroup: React.FC<ProcessingGroupProps> = ({
    add,
    initArgsConfig,
    postProcessors,
    processorConfig,
    remove,
    requiredPostprocessors,
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
            <Grid
                sx={{ marginLeft: '10px' }}
                container
                direction="column"
                item
                spacing={2}
            >
                {existingValues &&
                    initArgsConfig.map(f => (
                        <Grid item key={f.name}>
                            <JobFormField
                                config={f}
                                update={val => updateInitArgs(f.name, val)}
                                value={
                                    existingValues.init_args[f.name] ??
                                    f.default
                                }
                            />
                        </Grid>
                    ))}

                {existingValues && (
                    <Grid item alignItems="center" container direction="row">
                        <PostProcessorContainer>
                            {postProcessors.map(f => (
                                <JobFormField
                                    config={f}
                                    disabled={requiredPostprocessors.includes(
                                        f.name
                                    )}
                                    key={f.name}
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
                                    value={
                                        !!(
                                            existingValues.postprocessors || []
                                        ).find(p => p === f.name)
                                    }
                                />
                            ))}
                        </PostProcessorContainer>
                    </Grid>
                )}
            </Grid>
        </Grid>
    );
};

const PostProcessorContainer: React.FC = ({ children }) => {
    return (
        <Box
            sx={{
                borderColor: theme => theme.palette.primary.main,
                borderRadius: '5px',
                borderStyle: 'solid',
                borderWidth: '1px',
                padding: '10px',
                width: '90%',
            }}
        >
            <Typography sx={{ marginRight: 1 }}>
                <em>Post-processing:</em>
            </Typography>
            {children}
        </Box>
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
    pitch_crepe: {
        component: 'checkbox',
        label: 'Crepe Pitch Postprocessor',
    },
    pitch_kaldi: {
        component: 'checkbox',
        label: 'Kaldi Pitch Postprocessor',
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
    enc_layer: {
        component: 'radio',
        label: 'Layer number',
    },
    layer_type: {
        component: 'radio',
        label: 'Layer type',
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
        options: [1, 2],
        required: true,
    },

    {
        name: 'res',
        component: 'radio',
        default: '.pkl',
        type: 'string',
        label: (
            <>
                SFO currently supports the{' '}
                <Link
                    target="_blank"
                    href="https://docs.python.org/3/library/pickle.html"
                >
                    {' '}
                    .pkl format
                </Link>
                , which will return each result set as a serialized{' '}
                <Link
                    target="_blank"
                    href="https://pandas.pydata.org/docs/reference/api/pandas.DataFrame.html"
                >
                    Pandas dataframe
                </Link>
                , or csv.
            </>
        ),
        options: ['.pkl', '.csv'],
        required: true,
    },
];

export const analysisDisplayFields: FieldDisplaySchema = {
    bottleneck: {
        component: 'checkbox',
        label: 'Bottleneck',
    },
    energy: {
        component: 'checkbox',
        label: 'Energy',
    },
    filterbank: {
        component: 'checkbox',
        label: 'Filterbank',
    },
    hubert_large_ls960_ft: {
        component: 'checkbox',
        label: 'Facebook large HuBERT finetuned on 960h of librispeech',
    },
    mfcc: {
        component: 'checkbox',
        label: 'MFCC',
    },
    mHuBERT_147: {
        component: 'checkbox',
        label: 'mHuBERT-147',
    },
    pitch_crepe: {
        component: 'checkbox',
        label: 'Pitch Estimation (Crepe)',
    },
    pitch_kaldi: {
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

export const useFormReducer = (email: string) =>
    useReducer(jobFormReducer, makeBaseForm(email));
