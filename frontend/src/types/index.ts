export interface Factory {
    id: number;
    name: string;
    description?: string;
    algorithms_count?: number;
    models_count?: number;
    created_at?: string;
    algorithm_names?: string[];
}

export interface Algorithm {
    id: number;
    name: string;
    description?: string;
    models_count?: number;
    created_at?: string;
    accuracy?: number | null;
}

export interface Model {
    id: number;
    name: string;
    versions_count: number;
    created_at: string;
}

export interface LatestDeployment {
    version_number: number;
    updated_at: string;
    accuracy: number | null;
    f1_score: number | null;
    inference_time: number | null;
    gpu_utilization: number | null;
    cpu_utilization: number | null;
    model_name: string;
    algorithm_name: string;
    factory_name: string;
}

export interface Stats {
    factories: number;
    algorithms: number;
    models: number;
    active_versions: number;
    total_storage_bytes: number;
    latest_deployment?: LatestDeployment | null;
}

export interface ActivityItem {
    type?: 'version_event' | 'factory_event';
    timestamp: string;
    created_at: string;
    factory_id: number;
    factory_name: string;
    version_id?: number;
    version_number?: number;
    model_id?: number;
    model_name?: string;
    algorithm_id?: number;
    algorithm_name?: string;
}

export interface ChartDataItem {
    name: string;
    value: number;
}

export interface ActiveModel {
    model_id: number;
    model_name: string;
    version_number: number;
    updated_at: string;
}

export interface AlgorithmStatus {
    algorithm_id: number;
    algorithm_name: string;
    active_models: ActiveModel[];
}

export interface FactoryStatus {
    factory_id: number;
    factory_name: string;
    algorithms: AlgorithmStatus[];
}
