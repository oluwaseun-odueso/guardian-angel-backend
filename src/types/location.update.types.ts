export interface LocationUpdate {
  userId: string;
  coordinates: [number, number]; // Keep as tuple
  accuracy: number;
  alertId?: string;
  isResponder: boolean;
}