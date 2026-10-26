/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GAS_API_URL?: string;
  readonly VITE_APP_NAME?: string;
  readonly VITE_GOOGLE_CLIENT_ID?: string;
  readonly VITE_USE_MOCK?: string;
  readonly VITE_MOCK_ERROR_RATE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface Window {
  google?: {
    accounts: {
      id: {
        initialize: (config: {
          client_id: string;
          callback: (response: { credential?: string }) => void;
        }) => void;
        renderButton: (
          element: HTMLElement,
          options: { theme?: string; size?: string; text?: string; width?: number },
        ) => void;
        disableAutoSelect: () => void;
      };
    };
  };
}
