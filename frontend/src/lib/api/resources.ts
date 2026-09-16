import { apiClient } from './client';

export type ResourceType = 'shelter' | 'hospital' | 'fire_station' | 'police_station' | 'relief_center' | 'other_emergency_resource';
export type VerificationStatus = 'verified' | 'unverified';
export type RecordType = 'historical' | 'predictive' | 'demo';

export interface EmergencyResource {
  id: number;
  name: string;
  resource_type: ResourceType;
  latitude: number;
  longitude: number;
  address?: string;
  district?: string;
  source: string;
  source_reference?: string;
  record_type: RecordType;
  verification_status: VerificationStatus;
  last_verified_at?: string;
  capacity?: number;
  contact_info?: string;
  created_at: string;
  updated_at: string;
  distance_km?: number;
}

export interface PaginatedResourceResponse {
  items: EmergencyResource[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface ResourceQueryParams {
  skip?: number;
  limit?: number;
  resource_type?: ResourceType;
  verification_status?: VerificationStatus;
  latitude?: number;
  longitude?: number;
  radius_km?: number;
}

class ResourcesAPI {
  async getResources(params?: ResourceQueryParams): Promise<PaginatedResourceResponse> {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.append(key, value.toString());
        }
      });
    }
    const queryString = searchParams.toString();
    return apiClient<PaginatedResourceResponse>(`/resources${queryString ? `?${queryString}` : ''}`);
  }

  async getResourceById(id: number): Promise<EmergencyResource> {
    return apiClient<EmergencyResource>(`/resources/${id}`);
  }
}

export const resourcesApi = new ResourcesAPI();
