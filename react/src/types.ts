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
    component: 'checkbox' | 'text' | 'radio' | 'number' | 'select';
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
    type: 'string' | 'integer' | 'number' | 'boolean' | 'tuple';
    default: string | number | boolean | Array<string>;
    required: boolean;
    options?: string[] | number[] | Array<string>[];
}

export interface ProcessorSchema extends PostprocessorSchema {
    required_postprocessors: string[];
    valid_postprocessors: string[];
}

interface BaseUser {
    username: string;
}

export interface UpdatableUser extends BaseUser {
    active: boolean;
    password: string;
}

export interface SubmittableUser extends UpdatableUser {
    email: string;
}

export interface UserModel extends BaseUser {
    active: boolean;
    created: string;
    email: string;
    id: number;
    roles: Role[];
}

export interface User extends UserModel {
    isAdmin: boolean;
}

interface Role {
    id: number;
    role: string;
}

export interface Job {
    id: number;
    can_retry: boolean | undefined;
    created: string;
    taskmeta: JobInfo | null;
    taskmeta_id: string;
    user?: User;
    user_id: number;
}

interface JobInfo {
    id: number;
    date_done: string;
    kwargs: {
        config: {
            analyses: Record<string, AnalysisConfig>;
            bucket: string;
            channel: string;
            files: string[];
            res: string;
            save_path: string;
        };
    };
    status: string;
    result: string;
    task_id: string;
    traceback: string;
}

interface BasePaginationMeta {
    desc: boolean | undefined;
    page: number;
    per_page: number;
    sort: string | undefined;
}

export type SubmittablePaginationMeta = Partial<BasePaginationMeta>;

export interface PaginationMeta extends BasePaginationMeta {
    total: number;
}

export interface PaginatedResult<T extends Record<string, any>>
    extends PaginationMeta {
    data: T[];
}

export interface TokenResponse {
    access_token: string;
    refresh_token: string;
}
