/* for form state */

export interface GlobalJobConfig {
    channel: string;
    email: string;
    files: string[];
    res: string;
}

export interface JobConfig extends GlobalJobConfig {
    analyses: Record<string, AnalysisConfig>;
}

export interface AnalysisConfig {
    init_args: Record<string, string | boolean | number>;
    postprocessors: string[];
}

/* for field display */

export interface AnalysisFormGroup {
    analysis: FormItem;
    init_args: FormItem[];
}

export interface FormItem extends ProcessorFieldSchema, FieldDisplayItem {}

/* For JSON schema */
export interface ProcessorFieldSchema {
    name: string;
    type: 'string' | 'integer' | 'number' | 'boolean';
    default: string | number | boolean;
    required: boolean;
    options?: string[];
}

export type FieldDisplaySchema = Record<string, FieldDisplayItem>;

export interface FieldDisplayItem {
    component: 'checkbox' | 'text' | 'radio' | 'number';
    helpLinks?: { label: string; href: string }[];
    label?: string | JSX.Element;
}

export interface CommonSchema {
    title: string;
    description: string;
    processors: ProcessorSchema[];
    postprocessors: ProcessorSchema[];
}

export interface ProcessorSchema {
    class_key: string;
    class_name: string;
    init_args: ProcessorFieldSchema[];
}
