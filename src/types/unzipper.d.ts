declare module 'unzipper' {
  export interface ExtractOptions {
    path: string;
  }
  
  export function Extract(options: ExtractOptions): NodeJS.WritableStream;
}