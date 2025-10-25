export interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export interface Device {
  serial: string;
  type: 'device' | 'emulator';
  name: string;
  model: string;
  ipAddress: string;
  state: 'device' | 'offline' | 'connecting' | 'unauthorized';
  screenImageUrl: string | null;
  currentScreenDescription: string;
  isLoading: boolean;
  layoutBoundsVisible: boolean;
  infoOverlay: string | null;
}