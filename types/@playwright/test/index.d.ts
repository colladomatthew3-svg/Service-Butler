declare module "@playwright/test" {
  export const test: {
    (name: string, fn: (args: { page: any }) => Promise<void> | void): void;
  };

  export const expect: any;

  export function defineConfig(config: any): any;
  export const devices: Record<string, any>;
}
