export interface BaseJobConfig {
    channel: number;
    email: string;
    files: string[];
    res: string;
}

export type Postprocessor = 'cmvn' | 'vad' | 'delta';

interface BaseAnalysisConfigProps {
    frame_shift: number;
    frame_length: number;
    postprocessors: Postprocessor[];
}

export interface StandardAnalysisConfigProps extends BaseAnalysisConfigProps {
    window_type: string;
    snip_edges: boolean;
}

export interface PKaldiAnalysisConfigProps extends BaseAnalysisConfigProps {
    min_f0: number;
    max_f0: number;
}

export interface PCrepeAnalysisConfigProps extends BaseAnalysisConfigProps {
    model_capacity: string;
}

//typeguards

export type CombinedAnalysisConfigFields = StandardAnalysisConfigProps &
    PKaldiAnalysisConfigProps &
    PCrepeAnalysisConfigProps;

export const isPKaldiAnalysisConfigProps = (
    config:
        | StandardAnalysisConfigProps
        | PKaldiAnalysisConfigProps
        | PCrepeAnalysisConfigProps
): config is PKaldiAnalysisConfigProps =>
    !!(config as PKaldiAnalysisConfigProps).max_f0;

export const isPCrepeAnalysisConfigProps = (
    config:
        | StandardAnalysisConfigProps
        | PCrepeAnalysisConfigProps
        | PKaldiAnalysisConfigProps
): config is PCrepeAnalysisConfigProps =>
    !!(config as PCrepeAnalysisConfigProps).model_capacity;

type SpectrogramAnalysisConfig = Record<
    'spectrogram',
    StandardAnalysisConfigProps
>;
type FilterBankAnalysisConfig = Record<
    'filterbank',
    StandardAnalysisConfigProps
>;
type MFCCanalysisConfig = Record<'mfcc', StandardAnalysisConfigProps>;
type PLPAnalysisConfig = Record<'plp', StandardAnalysisConfigProps>;
type EnergyAnalysisConfig = Record<'energy', StandardAnalysisConfigProps>;
type PKaldiAnalysisConfig = Record<'p_kaldi', PKaldiAnalysisConfigProps>;
type PCrepeAnalysisConfig = Record<'p_crepe', PCrepeAnalysisConfigProps>;

export type AnalysisConfig = SpectrogramAnalysisConfig &
    FilterBankAnalysisConfig &
    MFCCanalysisConfig &
    PLPAnalysisConfig &
    EnergyAnalysisConfig &
    PKaldiAnalysisConfig &
    PCrepeAnalysisConfig;

export interface JobConfig extends BaseJobConfig {
    analyses: { [K in keyof AnalysisConfig]?: AnalysisConfig[K] };
}
