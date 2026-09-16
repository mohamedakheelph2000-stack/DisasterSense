export type AlertStatus = "active" | "acknowledged" | "response_in_progress" | "resolved" | "dismissed";

export interface AlertAuditRead {
  id: number;
  alert_id: number;
  actor: string;
  action: string;
  note: string | null;
  timestamp: string;
}

export interface AlertRead {
  id: number;
  location_id: number;
  disaster_event_id: number;
  source_cluster_id?: string | null;
  cluster_metadata?: Record<string, any> | null;
  severity?: "info" | "low" | "moderate" | "high" | "critical" | null;
  title: string;
  message: string;
  status: AlertStatus;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
  audit_logs?: AlertAuditRead[];
}

export interface AlertCreate {
  location_id: number;
  disaster_event_id: number;
  title: string;
  message: string;
}

export interface AlertAcknowledge {
  acknowledged_by: string;
}

export interface AlertUpdate {
  title?: string | null;
  message?: string | null;
  status?: AlertStatus | null;
}

export interface PaginatedAlerts {
  items: AlertRead[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}
