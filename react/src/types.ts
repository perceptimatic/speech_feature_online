export interface UploadResponse {
    remoteFileName: string;
    originalFile: {
        name: string;
        size: number;
    };
}

export interface BaseJobConfig {
    analyses: Record<string, AnalysisConfig>;
    channel: string;
    email: string;
    res: string;
}

export interface JobConfig extends BaseJobConfig {
    files: UploadResponse[];
}

export interface SubmittableJobConfig extends BaseJobConfig {
    files: string[];
}

export interface AnalysisConfig {
    init_args: Record<string, string | boolean | number>;
    postprocessors: string[];
}

/* for field display */

export interface AnalysisFormGroup {
    analysis: FormItem;
    init_args: FormItem[];
    postprocessors: FormItem[];
    required_postprocessors: string[];
}

export interface FormItem extends ProcessorFieldSchema, FieldDisplayItem {}

export interface FieldDisplayItem {
    component: 'checkbox' | 'text' | 'radio' | 'number';
    helpLinks?: { label: string; href: string }[];
    label?: string | JSX.Element;
}

export type FieldDisplaySchema = Record<string, FieldDisplayItem>;

/* For JSON schema */
export interface CommonSchema {
    title: string;
    description: string;
    processors: Record<string, ProcessorSchema>;
    postprocessors: Record<string, PostprocessorSchema>;
}

export interface PostprocessorSchema {
    class_name: string;
    init_args: ProcessorFieldSchema[];
}

export interface ProcessorFieldSchema {
    name: string;
    type: 'string' | 'integer' | 'number' | 'boolean';
    default: string | number | boolean;
    required: boolean;
    options?: string[];
}

export interface ProcessorSchema extends PostprocessorSchema {
    required_postprocessors: string[];
    valid_postprocessors: string[];
}

interface BaseUser {
    username: string;
}

export interface UpdatableUser extends BaseUser {
    password: string;
}

export interface SubmittableUser extends UpdatableUser {
    email: string;
}

export interface User extends BaseUser {
    created: string;
    email: string;
    id: number;
    roles: Role[];
}

interface Role {
    id: number;
    role: string;
}

export interface Job {
    created: string;
    task_info: JobInfo | null;
    taskmeta_id: string;
    user_id: number;
}

interface JobInfo {
    id: number;
    task_id: string;
    status: string;
    result: string;
    date_done: string;
    traceback: string;
}
